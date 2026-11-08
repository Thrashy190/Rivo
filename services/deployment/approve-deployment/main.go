package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/ecs"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	"github.com/Thrashy190/Rivo/services/shared/engine"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/deployment"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type Deployments interface {
	Get(ctx context.Context, workspaceID, id string) (*deployment.Deployment, error)
	Transition(ctx context.Context, workspaceID, id string, from []string, to string, fields map[string]any) (*deployment.Deployment, error)
}

type Projects interface {
	MarkConnection(ctx context.Context, workspaceID, id, connectionID string) error
	Unlock(ctx context.Context, workspaceID, id, deploymentID string, res *repository.DeploymentResult) error
}

type Engine interface {
	Start(ctx context.Context, workspaceID, deploymentID, phase string) (string, error)
}

var (
	users       authz.UserLoader
	members     authz.MembershipLoader
	deployments Deployments
	projects    Projects
	runner      Engine
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
	users = repository.NewDynamoDBUserRepository(client, os.Getenv("USERS_TABLE_NAME"))
	members = repository.NewDynamoDBMembershipRepository(client, os.Getenv("MEMBERS_TABLE_NAME"))
	deployments = repository.NewDynamoDBDeploymentRepository(client, os.Getenv("DEPLOYMENTS_TABLE_NAME"), "")
	projects = repository.NewDynamoDBProjectRepository(client, os.Getenv("PROJECTS_TABLE_NAME"))
	runner = engine.NewLauncher(ecs.NewFromConfig(cfg), engine.Config{
		Cluster:        os.Getenv("ENGINE_CLUSTER"),
		TaskDefinition: os.Getenv("ENGINE_TASK_DEFINITION"),
		Subnets:        os.Getenv("ENGINE_SUBNETS"),
		SecurityGroup:  os.Getenv("ENGINE_SECURITY_GROUP"),
	})
}

// Approves a planned deployment: the engine applies exactly the plan that was
// shown, or fails if the account changed since.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	u, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermDeploymentsRun)
	if err != nil {
		return apigateway.Error(err), nil
	}
	id := req.PathParameters["deploymentId"]
	if !deployment.ValidID(id) {
		return apigateway.Error(apierrors.NotFound("deployment")), nil
	}
	d, err := deployments.Get(ctx, m.WorkspaceID, id)
	if err != nil {
		return apigateway.Error(err), nil
	}
	if d.Status != deployment.StatusPlanned {
		return apigateway.Error(apierrors.Conflict("only a planned deployment can be approved; this one is " + d.Status)), nil
	}
	d, err = deployments.Transition(ctx, d.WorkspaceID, d.ID, []string{deployment.StatusPlanned}, deployment.StatusApplying, map[string]any{
		"approved_by": u.ID, "approved_email": u.Email, "approved_at": time.Now().UnixMilli(),
	})
	if err != nil {
		return apigateway.Error(err), nil
	}
	// From here the account may change, so the project remembers which one.
	if err := projects.MarkConnection(ctx, d.WorkspaceID, d.ProjectID, d.ConnectionID); err != nil {
		return apigateway.Error(err), nil
	}
	task, err := runner.Start(ctx, d.WorkspaceID, d.ID, deployment.PhaseApply)
	if err != nil {
		_, _ = deployments.Transition(ctx, d.WorkspaceID, d.ID, []string{deployment.StatusApplying}, deployment.StatusFailed,
			map[string]any{"error": "The engine could not start, so nothing was applied. Plan again.", "finished_at": time.Now().UnixMilli()})
		_ = projects.Unlock(ctx, d.WorkspaceID, d.ProjectID, d.ID, &repository.DeploymentResult{Status: project.StatusFailed, ConnectionID: d.ConnectionID})
		return apigateway.Error(err), nil
	}
	if updated, err := deployments.Transition(ctx, d.WorkspaceID, d.ID, []string{deployment.StatusApplying}, deployment.StatusApplying, map[string]any{"task_arn": task}); err == nil {
		d = updated
	}
	return apigateway.Success(http.StatusAccepted, d), nil
}

func main() {
	lambda.Start(handler)
}
