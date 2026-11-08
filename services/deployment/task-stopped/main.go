package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/Thrashy190/Rivo/services/shared/models/deployment"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/repository"
)

type Deployments interface {
	Get(ctx context.Context, workspaceID, id string) (*deployment.Deployment, error)
	Transition(ctx context.Context, workspaceID, id string, from []string, to string, fields map[string]any) (*deployment.Deployment, error)
}

type Projects interface {
	Unlock(ctx context.Context, workspaceID, id, deploymentID string, res *repository.DeploymentResult) error
}

var (
	deployments Deployments
	projects    Projects
)

func init() {
	if os.Getenv("AWS_LAMBDA_FUNCTION_NAME") == "" {
		return
	}
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	client := dynamodb.NewFromConfig(cfg)
	deployments = repository.NewDynamoDBDeploymentRepository(client, os.Getenv("DEPLOYMENTS_TABLE_NAME"), "")
	projects = repository.NewDynamoDBProjectRepository(client, os.Getenv("PROJECTS_TABLE_NAME"))
}

// The parts of an ECS task state change this needs.
type taskStopped struct {
	LastStatus    string `json:"lastStatus"`
	StoppedReason string `json:"stoppedReason"`
	Containers    []struct {
		Name     string `json:"name"`
		ExitCode *int   `json:"exitCode"`
		Reason   string `json:"reason"`
	} `json:"containers"`
	Overrides struct {
		ContainerOverrides []struct {
			Environment []struct {
				Name  string `json:"name"`
				Value string `json:"value"`
			} `json:"environment"`
		} `json:"containerOverrides"`
	} `json:"overrides"`
}

// Runs when an engine task stops. The engine records its own result, so this
// only acts when the task died first (out of memory, stopped, timed out):
// the deployment fails and its project is released.
func handler(ctx context.Context, ev events.CloudWatchEvent) error {
	var t taskStopped
	if err := json.Unmarshal(ev.Detail, &t); err != nil || t.LastStatus != "STOPPED" {
		return nil
	}
	env := map[string]string{}
	for _, o := range t.Overrides.ContainerOverrides {
		for _, kv := range o.Environment {
			env[kv.Name] = kv.Value
		}
	}
	ws, id, phase := env["WORKSPACE_ID"], env["DEPLOYMENT_ID"], env["PHASE"]
	if ws == "" || !deployment.ValidID(id) {
		return nil
	}
	d, err := deployments.Get(ctx, ws, id)
	if err != nil {
		return err
	}
	if !stillRunning(phase, d.Status) {
		return nil
	}
	reason := t.StoppedReason
	for _, c := range t.Containers {
		if c.Reason != "" {
			reason += ": " + c.Reason
		}
	}
	msg := "The engine stopped before finishing"
	if r := strings.TrimSpace(reason); r != "" {
		msg += " (" + r + ")"
	}
	log.Printf("deployment %s/%s: %s", ws, id, msg)
	if _, err := deployments.Transition(ctx, ws, id, phaseStatuses(phase), deployment.StatusFailed,
		map[string]any{"error": msg + ". Plan again to continue.", "finished_at": time.Now().UnixMilli()}); err != nil {
		return nil // it finished in the meantime
	}
	var res *repository.DeploymentResult
	if phase == deployment.PhaseApply {
		res = &repository.DeploymentResult{Status: project.StatusFailed, ConnectionID: d.ConnectionID}
	}
	return projects.Unlock(ctx, ws, d.ProjectID, d.ID, res)
}

// phaseStatuses are the statuses a deployment has while a task of this phase
// works on it. The plan task stops after someone may already have approved
// the plan, and that must not fail the apply that is running.
func phaseStatuses(phase string) []string {
	if phase == deployment.PhaseApply {
		return []string{deployment.StatusApplying}
	}
	return []string{deployment.StatusQueued, deployment.StatusPlanning}
}

func stillRunning(phase, status string) bool {
	for _, s := range phaseStatuses(phase) {
		if s == status {
			return true
		}
	}
	return false
}

func main() {
	lambda.Start(handler)
}
