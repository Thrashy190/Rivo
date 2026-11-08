package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/Thrashy190/Rivo/services/shared/models/connection"
	"github.com/Thrashy190/Rivo/services/shared/models/deployment"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/storage"
	"github.com/Thrashy190/Rivo/services/shared/tfgen"
)

type Deployments interface {
	Get(ctx context.Context, workspaceID, id string) (*deployment.Deployment, error)
	Transition(ctx context.Context, workspaceID, id string, from []string, to string, fields map[string]any) (*deployment.Deployment, error)
	AddUsage(ctx context.Context, workspaceID string, at time.Time, seconds int64) error
}

type Projects interface {
	GetByID(ctx context.Context, workspaceID, id string) (*project.Project, error)
	Unlock(ctx context.Context, workspaceID, id, deploymentID string, res *repository.DeploymentResult) error
}

type Connections interface {
	Get(ctx context.Context, workspaceID, id string) (*connection.Connection, error)
}

type Files interface {
	Get(ctx context.Context, key string) ([]byte, string, error)
	PutFile(ctx context.Context, key string, body []byte, contentType string) error
}

type runner struct {
	workspaceID, deploymentID, phase string
	bucket, stateRegion              string
	terraform, pluginDir, workDir    string

	deployments Deployments
	projects    Projects
	connections Connections
	files       Files

	log *logWriter
}

// run does one phase and records how it went. A failure is recorded on the
// deployment; the error returned only makes the task exit non-zero.
func (r *runner) run(ctx context.Context) error {
	d, err := r.deployments.Get(ctx, r.workspaceID, r.deploymentID)
	if err != nil {
		return fmt.Errorf("loading the deployment: %w", err)
	}
	r.log = newLogWriter(ctx, r.files, storage.DeploymentKey(d.WorkspaceID, d.ProjectID, d.ID, r.phase+".log"))
	defer r.log.Close()

	started := time.Now()
	var phaseErr error
	if r.phase == deployment.PhasePlan {
		phaseErr = r.plan(ctx, d, started)
	} else {
		phaseErr = r.apply(ctx, d, started)
	}
	seconds := int64(time.Since(started).Seconds()) + 1
	if err := r.deployments.AddUsage(ctx, d.WorkspaceID, started, seconds); err != nil {
		r.log.Printf("Could not record usage: %v\n", err)
	}
	if phaseErr != nil {
		r.fail(ctx, d, phaseErr, seconds)
		return phaseErr
	}
	return nil
}

func (r *runner) fail(ctx context.Context, d *deployment.Deployment, cause error, seconds int64) {
	msg := cause.Error()
	var tf *terraformError
	if errors.As(cause, &tf) {
		msg = tf.summary()
	}
	r.log.Printf("\nThe deployment failed: %s\n", msg)
	field := "plan_seconds"
	if r.phase == deployment.PhaseApply {
		field = "apply_seconds"
	}
	if _, err := r.deployments.Transition(ctx, d.WorkspaceID, d.ID,
		[]string{deployment.StatusQueued, deployment.StatusPlanning, deployment.StatusApplying},
		deployment.StatusFailed, map[string]any{"error": truncate(msg, 2000), "finished_at": time.Now().UnixMilli(), field: seconds},
	); err != nil {
		r.log.Printf("Could not record the failure: %v\n", err)
	}
	// A failed plan changed nothing. A failed apply may have changed some of
	// the account, so the project keeps its connection.
	var res *repository.DeploymentResult
	if r.phase == deployment.PhaseApply {
		res = &repository.DeploymentResult{Status: project.StatusFailed, ConnectionID: d.ConnectionID}
	}
	if err := r.projects.Unlock(ctx, d.WorkspaceID, d.ProjectID, d.ID, res); err != nil {
		r.log.Printf("Could not release the project: %v\n", err)
	}
}

// prepare loads what both phases need and the directory to work in.
func (r *runner) prepare(ctx context.Context, d *deployment.Deployment) (*project.Project, *connection.Connection, string, error) {
	p, err := r.projects.GetByID(ctx, d.WorkspaceID, d.ProjectID)
	if err != nil {
		return nil, nil, "", fmt.Errorf("loading the project: %w", err)
	}
	c, err := r.connections.Get(ctx, d.WorkspaceID, d.ConnectionID)
	if err != nil {
		return nil, nil, "", fmt.Errorf("loading the AWS account: %w", err)
	}
	if c.Status != connection.StatusVerified || connection.AccountOf(c.RoleARN) != c.AccountID {
		return nil, nil, "", errors.New("the AWS account is not verified: verify it again in the workspace settings")
	}
	if c.AccountID != d.AccountID {
		return nil, nil, "", errors.New("the AWS account's role changed to another account since the plan")
	}
	dir := filepath.Join(r.workDir, d.ID)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, nil, "", err
	}
	return p, c, dir, nil
}

func (r *runner) target(d *deployment.Deployment, c *connection.Connection) *tfgen.Deploy {
	return &tfgen.Deploy{
		AccountID:   c.AccountID,
		RoleARN:     c.RoleARN,
		ExternalID:  c.ExternalID,
		SessionName: "rivo-" + d.ID,
		StateBucket: r.bucket,
		StateKey:    storage.StateKey(d.WorkspaceID, d.ProjectID),
		StateRegion: r.stateRegion,
	}
}

func (r *runner) plan(ctx context.Context, d *deployment.Deployment, started time.Time) error {
	d, err := r.deployments.Transition(ctx, d.WorkspaceID, d.ID, []string{deployment.StatusQueued}, deployment.StatusPlanning,
		map[string]any{"started_at": started.UnixMilli()})
	if err != nil {
		return fmt.Errorf("starting the plan: %w", err)
	}
	p, c, dir, err := r.prepare(ctx, d)
	if err != nil {
		return err
	}
	r.log.Printf("Planning %s of %s in account %s (%s)\n\n", d.Action, p.Name, c.AccountID, d.Region)

	opts := tfgen.Options{ProjectName: p.Name, Region: d.Region, Deploy: r.target(d, c)}
	var res *tfgen.Result
	if d.Action == deployment.ActionDestroy {
		res = tfgen.Teardown(opts)
	} else {
		body, _, err := r.files.Get(ctx, storage.DeploymentKey(d.WorkspaceID, d.ProjectID, d.ID, "diagram.json"))
		if err != nil {
			return fmt.Errorf("reading the diagram: %w", err)
		}
		diagram, err := tfgen.Parse(body)
		if err != nil {
			return errors.New("the diagram could not be read")
		}
		res, err = tfgen.Generate(diagram, opts)
		if err != nil {
			return err
		}
	}
	for _, w := range res.Warnings {
		r.log.Printf("Note: %s\n", w.Message)
	}
	if err := r.write(ctx, d, dir, res); err != nil {
		return err
	}

	if err := r.tf(ctx, dir, r.initArgs()...); err != nil {
		return err
	}
	args := []string{"plan", "-input=false", "-no-color", "-lock-timeout=120s", "-out=tfplan", "-detailed-exitcode"}
	if d.Action == deployment.ActionDestroy {
		args = append(args, "-destroy")
	}
	changes := true
	if err := r.tf(ctx, dir, args...); err != nil {
		var tfErr *terraformError
		if !errors.As(err, &tfErr) || tfErr.code != 2 {
			return err
		}
	} else {
		changes = false // -detailed-exitcode: 0 is no changes, 2 is changes
	}

	shown, err := r.output(ctx, dir, "show", "-json", "tfplan")
	if err != nil {
		return err
	}
	plan, err := readPlan(shown)
	if err != nil {
		return err
	}
	plan.Outputs = outputRefs(res.Outputs)
	for _, w := range res.Warnings {
		plan.Warnings = append(plan.Warnings, deployment.Warning{NodeID: w.NodeID, Message: w.Message})
	}
	planJSON, _ := json.Marshal(plan)
	if err := r.files.PutFile(ctx, storage.DeploymentKey(d.WorkspaceID, d.ProjectID, d.ID, "plan.json"), planJSON, "application/json"); err != nil {
		return fmt.Errorf("saving the plan: %w", err)
	}
	seconds := int64(time.Since(started).Seconds()) + 1
	summary := plan.Summary

	if !changes {
		r.log.Printf("\nNothing to change: the account already matches.\n")
		endpoints, err := r.endpoints(ctx, dir, plan.Outputs)
		if err != nil {
			return err
		}
		return r.finish(ctx, d, map[string]any{"summary": summary, "planned_at": time.Now().UnixMilli(), "plan_seconds": seconds, "endpoints": endpoints}, endpoints)
	}

	archive, err := tarDir(dir)
	if err != nil {
		return fmt.Errorf("packing the plan: %w", err)
	}
	if err := r.files.PutFile(ctx, storage.DeploymentKey(d.WorkspaceID, d.ProjectID, d.ID, "workdir.tar.gz"), archive, "application/gzip"); err != nil {
		return fmt.Errorf("saving the plan: %w", err)
	}
	if _, err := r.deployments.Transition(ctx, d.WorkspaceID, d.ID, []string{deployment.StatusPlanning}, deployment.StatusPlanned,
		map[string]any{"summary": summary, "planned_at": time.Now().UnixMilli(), "plan_seconds": seconds}); err != nil {
		return err
	}
	r.log.Printf("\nPlanned: %d to add, %d to change, %d to destroy. Waiting for approval.\n", summary.Add, summary.Change, summary.Destroy)
	return nil
}

func (r *runner) apply(ctx context.Context, d *deployment.Deployment, started time.Time) error {
	if d.Status != deployment.StatusApplying {
		return fmt.Errorf("the deployment is %s, not approved", d.Status)
	}
	_, _, dir, err := r.prepare(ctx, d)
	if err != nil {
		return err
	}
	archive, _, err := r.files.Get(ctx, storage.DeploymentKey(d.WorkspaceID, d.ProjectID, d.ID, "workdir.tar.gz"))
	if err != nil {
		return fmt.Errorf("reading the plan: %w", err)
	}
	if err := untarDir(archive, dir); err != nil {
		return fmt.Errorf("unpacking the plan: %w", err)
	}
	planJSON, _, err := r.files.Get(ctx, storage.DeploymentKey(d.WorkspaceID, d.ProjectID, d.ID, "plan.json"))
	if err != nil {
		return fmt.Errorf("reading the plan: %w", err)
	}
	var plan deployment.Plan
	if err := json.Unmarshal(planJSON, &plan); err != nil {
		return fmt.Errorf("reading the plan: %w", err)
	}

	r.log.Printf("Applying the approved plan to account %s (%s)\n\n", d.AccountID, d.Region)
	if err := r.tf(ctx, dir, r.initArgs()...); err != nil {
		return err
	}
	if err := r.tf(ctx, dir, "apply", "-input=false", "-no-color", "-lock-timeout=120s", "tfplan"); err != nil {
		return err
	}
	endpoints := map[string]map[string]string{}
	if d.Action != deployment.ActionDestroy {
		if endpoints, err = r.endpoints(ctx, dir, plan.Outputs); err != nil {
			return err
		}
	}
	seconds := int64(time.Since(started).Seconds()) + 1
	return r.finish(ctx, d, map[string]any{"apply_seconds": seconds, "endpoints": endpoints}, endpoints)
}

// finish records a deployment that ended well and releases its project.
func (r *runner) finish(ctx context.Context, d *deployment.Deployment, fields map[string]any, endpoints map[string]map[string]string) error {
	fields["finished_at"] = time.Now().UnixMilli()
	if _, err := r.deployments.Transition(ctx, d.WorkspaceID, d.ID, []string{deployment.StatusPlanning, deployment.StatusApplying}, deployment.StatusSucceeded, fields); err != nil {
		return err
	}
	res := &repository.DeploymentResult{Status: project.StatusDeployed, ConnectionID: d.ConnectionID, Endpoints: endpoints, Applied: true}
	if d.Action == deployment.ActionDestroy {
		res = &repository.DeploymentResult{Status: project.StatusDraft, Applied: true}
	}
	if err := r.projects.Unlock(ctx, d.WorkspaceID, d.ProjectID, d.ID, res); err != nil {
		return err
	}
	if d.Action == deployment.ActionDestroy {
		r.log.Printf("\nDone: everything the project created in the account is gone.\n")
	} else {
		r.log.Printf("\nDone: the account matches the diagram.\n")
	}
	return nil
}

// write puts the generated files and the Lambda packages they use in dir.
func (r *runner) write(ctx context.Context, d *deployment.Deployment, dir string, res *tfgen.Result) error {
	put := func(rel string, body []byte) error {
		path := filepath.Join(dir, filepath.FromSlash(rel))
		if !strings.HasPrefix(path, dir+string(os.PathSeparator)) {
			return fmt.Errorf("%s is outside the configuration", rel)
		}
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			return err
		}
		return os.WriteFile(path, body, 0o600)
	}
	for _, f := range res.Files {
		if err := put(f.Path, []byte(f.Content)); err != nil {
			return err
		}
	}
	for _, pkg := range res.Packages {
		body, _, err := r.files.Get(ctx, storage.PackageKey(d.WorkspaceID, d.ProjectID, pkg.PackageID))
		if err != nil {
			return fmt.Errorf("the package %s was not found: upload it again", pkg.Path)
		}
		if err := put(pkg.Path, body); err != nil {
			return err
		}
	}
	return nil
}

// Providers come only from the image, so a configuration cannot pull in
// anything else.
func (r *runner) initArgs() []string {
	return []string{"init", "-input=false", "-no-color", "-plugin-dir=" + r.pluginDir}
}

// tf runs Terraform with its output in the log.
func (r *runner) tf(ctx context.Context, dir string, args ...string) error {
	r.log.Printf("$ terraform %s\n", strings.Join(args, " "))
	cmd := r.command(ctx, dir, args...)
	tail := &tailWriter{max: 8000}
	cmd.Stdout = r.log
	cmd.Stderr = multi(r.log, tail)
	if err := cmd.Run(); err != nil {
		code := -1
		var exit *exec.ExitError
		if errors.As(err, &exit) {
			code = exit.ExitCode()
		}
		return &terraformError{command: args[0], code: code, stderr: tail.String()}
	}
	return nil
}

// output runs Terraform and returns what it prints, without logging it.
func (r *runner) output(ctx context.Context, dir string, args ...string) ([]byte, error) {
	cmd := r.command(ctx, dir, args...)
	tail := &tailWriter{max: 8000}
	cmd.Stderr = multi(r.log, tail)
	out, err := cmd.Output()
	if err != nil {
		return nil, &terraformError{command: args[0], code: -1, stderr: tail.String()}
	}
	return out, nil
}

func (r *runner) command(ctx context.Context, dir string, args ...string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, r.terraform, args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(),
		"TF_IN_AUTOMATION=1",
		"TF_INPUT=0",
		"CHECKPOINT_DISABLE=1",
		"HOME="+r.workDir,
	)
	return cmd
}

func (r *runner) endpoints(ctx context.Context, dir string, refs []deployment.OutputRef) (map[string]map[string]string, error) {
	out, err := r.output(ctx, dir, "output", "-json")
	if err != nil {
		return nil, err
	}
	return readEndpoints(out, refs)
}

func outputRefs(outs []tfgen.Output) []deployment.OutputRef {
	refs := make([]deployment.OutputRef, len(outs))
	for i, o := range outs {
		refs[i] = deployment.OutputRef{Name: o.Name, NodeID: o.NodeID, Kind: o.Kind}
	}
	return refs
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
