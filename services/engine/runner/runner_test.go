package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/connection"
	"github.com/Thrashy190/Rivo/services/shared/models/deployment"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/storage"
)

const diagram = `{"version":"canvas/1","nodes":[
 {"id":"api","type":"api-gateway","config":{"name":"items-api"}},
 {"id":"fn","type":"lambda","config":{"name":"items","runtime":"python3.13","source":"inline","code":"def handler(e, c):\n    return {}\n"}}
],"edges":[{"id":"e","sourceId":"api","targetId":"fn","config":{"routes":[{"method":"GET","path":"/items"}]}}]}`

// A Terraform that plans one change, or fails when FAKE_TF_FAIL names the command.
const fakeTerraform = `#!/bin/sh
echo "terraform $*" >> "$FAKE_TF_CALLS"
if [ "$FAKE_TF_FAIL" = "$1" ]; then echo "Error: AccessDenied: not allowed to lambda:CreateFunction" >&2; exit 1; fi
case "$1" in
  plan) test -f providers.tf || exit 9; echo "Plan: 1 to add"; touch tfplan; exit 2 ;;
  show) echo '{"resource_changes":[{"address":"aws_lambda_function.items","mode":"managed","type":"aws_lambda_function","change":{"actions":["create"]}},{"address":"data.archive_file.items","mode":"data","type":"archive_file","change":{"actions":["read"]}}]}' ;;
  apply) test -f tfplan || exit 8; echo "Apply complete!" ;;
  output) echo '{"items_api_url":{"value":"https://abc.execute-api.us-east-1.amazonaws.com","sensitive":false,"type":"string"}}' ;;
esac
`

type fakeDeployments struct {
	mu    sync.Mutex
	items map[string]*deployment.Deployment
	usage int64
}

func (f *fakeDeployments) Get(_ context.Context, ws, id string) (*deployment.Deployment, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	d, ok := f.items[ws+"/"+id]
	if !ok {
		return nil, apierrors.NotFound("deployment")
	}
	c := *d
	return &c, nil
}

func (f *fakeDeployments) Transition(_ context.Context, ws, id string, from []string, to string, fields map[string]any) (*deployment.Deployment, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	d := f.items[ws+"/"+id]
	ok := false
	for _, s := range from {
		ok = ok || d.Status == s
	}
	if !ok {
		return nil, apierrors.Conflict("changed")
	}
	d.Status = to
	if s, ok := fields["summary"].(deployment.Summary); ok {
		d.Summary = &s
	}
	if e, ok := fields["error"].(string); ok {
		d.Error = e
	}
	if e, ok := fields["endpoints"].(map[string]map[string]string); ok {
		d.Endpoints = e
	}
	c := *d
	return &c, nil
}

func (f *fakeDeployments) AddUsage(_ context.Context, _ string, _ time.Time, s int64) error {
	f.usage += s
	return nil
}

type fakeProjects struct {
	unlocked []*repository.DeploymentResult
}

func (f *fakeProjects) GetByID(_ context.Context, ws, id string) (*project.Project, error) {
	return &project.Project{WorkspaceID: ws, ID: id, Name: "Shop", Region: "us-east-1"}, nil
}

func (f *fakeProjects) Unlock(_ context.Context, _, _, _ string, res *repository.DeploymentResult) error {
	f.unlocked = append(f.unlocked, res)
	return nil
}

type fakeConnections struct{}

func (fakeConnections) Get(_ context.Context, ws, id string) (*connection.Connection, error) {
	return &connection.Connection{WorkspaceID: ws, ID: id, AccountID: "123456789012", RoleARN: "arn:aws:iam::123456789012:role/RivoDeploy", ExternalID: "rivo-x", Status: connection.StatusVerified}, nil
}

type memFiles struct {
	mu      sync.Mutex
	objects map[string][]byte
}

func (m *memFiles) Get(_ context.Context, key string) ([]byte, string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if b, ok := m.objects[key]; ok {
		return b, "", nil
	}
	return nil, "", apierrors.NotFound("object")
}

func (m *memFiles) PutFile(_ context.Context, key string, body []byte, _ string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.objects[key] = body
	return nil
}

func setupRunner(t *testing.T) (*runner, *fakeDeployments, *fakeProjects, *memFiles, string) {
	t.Helper()
	tmp := t.TempDir()
	bin := filepath.Join(tmp, "terraform")
	if err := os.WriteFile(bin, []byte(fakeTerraform), 0o755); err != nil {
		t.Fatal(err)
	}
	calls := filepath.Join(tmp, "calls")
	t.Setenv("FAKE_TF_CALLS", calls)
	t.Setenv("FAKE_TF_FAIL", "")
	id := deployment.NewID(time.Now())
	deps := &fakeDeployments{items: map[string]*deployment.Deployment{
		"ws/" + id: {WorkspaceID: "ws", ID: id, ProjectID: "p", ConnectionID: "c", AccountID: "123456789012", Region: "us-east-1", Action: deployment.ActionDeploy, Status: deployment.StatusQueued},
	}}
	files := &memFiles{objects: map[string][]byte{storage.DeploymentKey("ws", "p", id, "diagram.json"): []byte(diagram)}}
	projects := &fakeProjects{}
	r := &runner{
		workspaceID: "ws", deploymentID: id, phase: deployment.PhasePlan,
		bucket: "state-bucket", stateRegion: "us-east-1",
		terraform: bin, pluginDir: "/plugins", workDir: filepath.Join(tmp, "work"),
		deployments: deps, projects: projects, connections: fakeConnections{}, files: files,
	}
	return r, deps, projects, files, calls
}

func TestPlanThenApply(t *testing.T) {
	r, deps, projects, files, calls := setupRunner(t)
	ctx := context.Background()
	if err := r.run(ctx); err != nil {
		t.Fatal(err)
	}
	d, _ := deps.Get(ctx, "ws", r.deploymentID)
	if d.Status != deployment.StatusPlanned || d.Summary == nil || d.Summary.Add != 1 {
		t.Fatalf("after the plan: %+v", d)
	}
	if len(projects.unlocked) != 0 {
		t.Error("a plan waiting for approval released the project")
	}
	key := func(name string) string { return storage.DeploymentKey("ws", "p", r.deploymentID, name) }
	for _, name := range []string{"plan.json", "workdir.tar.gz", "plan.log"} {
		if _, ok := files.objects[key(name)]; !ok {
			t.Errorf("%s was not saved", name)
		}
	}
	if !strings.Contains(string(files.objects[key("plan.log")]), "Planned: 1 to add") {
		t.Errorf("log:\n%s", files.objects[key("plan.log")])
	}

	// The backend and the role were generated into the configuration.
	providers, _ := os.ReadFile(filepath.Join(r.workDir, r.deploymentID, "providers.tf"))
	for _, want := range []string{`backend "s3"`, "workspaces/ws/projects/p/state/terraform.tfstate", "rivo-x", `allowed_account_ids = ["123456789012"]`} {
		if !strings.Contains(string(providers), want) {
			t.Errorf("providers.tf is missing %q:\n%s", want, providers)
		}
	}

	// Approve and apply on a fresh machine: everything comes from storage.
	os.RemoveAll(r.workDir)
	deps.items["ws/"+r.deploymentID].Status = deployment.StatusApplying
	r.phase = deployment.PhaseApply
	if err := r.run(ctx); err != nil {
		t.Fatal(err)
	}
	d, _ = deps.Get(ctx, "ws", r.deploymentID)
	if d.Status != deployment.StatusSucceeded || d.Endpoints["api"]["url"] != "https://abc.execute-api.us-east-1.amazonaws.com" {
		t.Fatalf("after the apply: %+v", d)
	}
	if len(projects.unlocked) != 1 || projects.unlocked[0].Status != project.StatusDeployed || projects.unlocked[0].ConnectionID != "c" {
		t.Errorf("project result: %+v", projects.unlocked)
	}
	log, _ := os.ReadFile(calls)
	if !strings.Contains(string(log), "init -input=false -no-color -plugin-dir=/plugins") || !strings.Contains(string(log), "apply -input=false -no-color -lock-timeout=120s tfplan") {
		t.Errorf("terraform calls:\n%s", log)
	}
	if deps.usage < 2 {
		t.Errorf("usage was not recorded: %d", deps.usage)
	}
}

func TestFailedApplyKeepsTheConnection(t *testing.T) {
	r, deps, projects, _, _ := setupRunner(t)
	ctx := context.Background()
	if err := r.run(ctx); err != nil {
		t.Fatal(err)
	}
	deps.items["ws/"+r.deploymentID].Status = deployment.StatusApplying
	r.phase = deployment.PhaseApply
	t.Setenv("FAKE_TF_FAIL", "apply")
	if err := r.run(ctx); err == nil {
		t.Fatal("the apply should fail")
	}
	d, _ := deps.Get(ctx, "ws", r.deploymentID)
	if d.Status != deployment.StatusFailed || !strings.HasPrefix(d.Error, "Error: AccessDenied") {
		t.Fatalf("after the failure: %+v", d)
	}
	if len(projects.unlocked) != 1 || projects.unlocked[0].Status != project.StatusFailed || projects.unlocked[0].ConnectionID != "c" {
		t.Errorf("project result: %+v", projects.unlocked[0])
	}
}

func TestFailedPlanChangesNothing(t *testing.T) {
	r, deps, projects, _, _ := setupRunner(t)
	t.Setenv("FAKE_TF_FAIL", "plan")
	if err := r.run(context.Background()); err == nil {
		t.Fatal("the plan should fail")
	}
	d, _ := deps.Get(context.Background(), "ws", r.deploymentID)
	if d.Status != deployment.StatusFailed || len(projects.unlocked) != 1 || projects.unlocked[0] != nil {
		t.Errorf("deployment %+v, project %+v", d, projects.unlocked)
	}
}

func TestUntarRefusesPathsOutside(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "main.tf"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	os.MkdirAll(filepath.Join(dir, ".terraform", "providers"), 0o700)
	os.WriteFile(filepath.Join(dir, ".terraform", "providers", "big"), []byte("x"), 0o600)
	archive, err := tarDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	out := t.TempDir()
	if err := untarDir(archive, out); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(out, ".terraform")); err == nil {
		t.Error("the providers were packed")
	}
}
