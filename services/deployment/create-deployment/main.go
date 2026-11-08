package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/ecs"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	"github.com/Thrashy190/Rivo/services/shared/engine"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/connection"
	"github.com/Thrashy190/Rivo/services/shared/models/deployment"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/storage"
	"github.com/Thrashy190/Rivo/services/shared/tfgen"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type Projects interface {
	GetByID(ctx context.Context, workspaceID, id string) (*project.Project, error)
	Lock(ctx context.Context, workspaceID, id, deploymentID, stale string) error
	Unlock(ctx context.Context, workspaceID, id, deploymentID string, res *repository.DeploymentResult) error
}

type Deployments interface {
	Create(ctx context.Context, d *deployment.Deployment) error
	Get(ctx context.Context, workspaceID, id string) (*deployment.Deployment, error)
	Transition(ctx context.Context, workspaceID, id string, from []string, to string, fields map[string]any) (*deployment.Deployment, error)
}

type Connections interface {
	Get(ctx context.Context, workspaceID, id string) (*connection.Connection, error)
}

type Files interface {
	Get(ctx context.Context, key string) ([]byte, string, error)
	PutFile(ctx context.Context, key string, body []byte, contentType string) error
}

type Engine interface {
	Start(ctx context.Context, workspaceID, deploymentID, phase string) (string, error)
}

var (
	users       authz.UserLoader
	members     authz.MembershipLoader
	projects    Projects
	deployments Deployments
	connections Connections
	files       Files
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
	projects = repository.NewDynamoDBProjectRepository(client, os.Getenv("PROJECTS_TABLE_NAME"))
	deployments = repository.NewDynamoDBDeploymentRepository(client, os.Getenv("DEPLOYMENTS_TABLE_NAME"), "")
	connections = repository.NewDynamoDBConnectionRepository(client, os.Getenv("CONNECTIONS_TABLE_NAME"))
	files = storage.NewS3(s3.NewFromConfig(cfg), os.Getenv("DIAGRAMS_BUCKET"))
	runner = engine.NewLauncher(ecs.NewFromConfig(cfg), engine.Config{
		Cluster:        os.Getenv("ENGINE_CLUSTER"),
		TaskDefinition: os.Getenv("ENGINE_TASK_DEFINITION"),
		Subnets:        os.Getenv("ENGINE_SUBNETS"),
		SecurityGroup:  os.Getenv("ENGINE_SECURITY_GROUP"),
	})
}

// Starts a deployment: snapshots the saved diagram and has the engine plan
// it. Nothing changes in AWS until someone approves the plan.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	u, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermDeploymentsRun)
	if err != nil {
		return apigateway.Error(err), nil
	}
	var in deployment.CreateInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("send the AWS account to deploy to")), nil
	}
	if in.Action == "" {
		in.Action = deployment.ActionDeploy
	}
	if in.Action != deployment.ActionDeploy && in.Action != deployment.ActionDestroy {
		return apigateway.Error(apierrors.Validation("action is deploy or destroy")), nil
	}

	p, err := projects.GetByID(ctx, m.WorkspaceID, req.PathParameters["projectId"])
	if err != nil {
		return apigateway.Error(err), nil
	}
	if in.Action == deployment.ActionDestroy && p.ConnectionID == "" {
		return apigateway.Error(apierrors.Validation("the project has nothing deployed to destroy")), nil
	}
	if in.Action == deployment.ActionDestroy || strings.TrimSpace(in.ConnectionID) == "" {
		in.ConnectionID = p.ConnectionID
	}
	if p.ConnectionID != "" && in.ConnectionID != p.ConnectionID {
		return apigateway.Error(apierrors.Conflict("the project's infrastructure is in another AWS account: destroy it there before deploying somewhere else")), nil
	}
	c, err := connections.Get(ctx, m.WorkspaceID, in.ConnectionID)
	if err != nil {
		return apigateway.Error(err), nil
	}
	if c.Status != connection.StatusVerified {
		return apigateway.Error(apierrors.Validation(c.Name + " is not verified yet: finish connecting it in the workspace settings")), nil
	}

	now := time.Now()
	d := &deployment.Deployment{
		WorkspaceID:    m.WorkspaceID,
		ID:             deployment.NewID(now),
		ProjectID:      p.ID,
		ProjectName:    p.Name,
		ConnectionID:   c.ID,
		ConnectionName: c.Name,
		AccountID:      c.AccountID,
		Region:         p.Region,
		Action:         in.Action,
		Status:         deployment.StatusQueued,
		CreatedBy:      u.ID,
		CreatedByEmail: u.Email,
		CreatedAt:      now.UnixMilli(),
		UpdatedAt:      now.UnixMilli(),
	}

	// The diagram is copied, so the deployment keeps what it deployed even
	// after the project changes.
	if in.Action == deployment.ActionDeploy {
		body, _, err := files.Get(ctx, storage.DraftKey(p.WorkspaceID, p.ID))
		if err != nil {
			if isNotFound(err) {
				return apigateway.Error(apierrors.Validation("save the diagram before deploying it")), nil
			}
			return apigateway.Error(err), nil
		}
		diagram, err := tfgen.Parse(body)
		if err != nil {
			return apigateway.Error(apierrors.Validation("the diagram could not be read")), nil
		}
		if _, err := tfgen.Generate(diagram, tfgen.Options{ProjectName: p.Name, Region: p.Region}); err != nil {
			return apigateway.Error(apierrors.Validation(err.Error())), nil
		}
		if err := files.PutFile(ctx, storage.DeploymentKey(p.WorkspaceID, p.ID, d.ID, "diagram.json"), body, "application/json"); err != nil {
			return apigateway.Error(err), nil
		}
	}

	if err := lock(ctx, p, d.ID); err != nil {
		return apigateway.Error(err), nil
	}
	if err := deployments.Create(ctx, d); err != nil {
		_ = projects.Unlock(ctx, p.WorkspaceID, p.ID, d.ID, nil)
		return apigateway.Error(err), nil
	}
	task, err := runner.Start(ctx, d.WorkspaceID, d.ID, deployment.PhasePlan)
	if err != nil {
		_, _ = deployments.Transition(ctx, d.WorkspaceID, d.ID, []string{deployment.StatusQueued}, deployment.StatusFailed,
			map[string]any{"error": "The engine could not start. Try again in a moment.", "finished_at": time.Now().UnixMilli()})
		_ = projects.Unlock(ctx, p.WorkspaceID, p.ID, d.ID, nil)
		return apigateway.Error(err), nil
	}
	if updated, err := deployments.Transition(ctx, d.WorkspaceID, d.ID, []string{deployment.StatusQueued, deployment.StatusPlanning}, d.Status, map[string]any{"task_arn": task}); err == nil {
		d = updated
	}
	return apigateway.Success(http.StatusAccepted, d), nil
}

// lock takes the project, or takes it over from a deployment that finished
// without releasing it.
func lock(ctx context.Context, p *project.Project, id string) error {
	err := projects.Lock(ctx, p.WorkspaceID, p.ID, id, "")
	if err == nil || p.ActiveDeployment == "" || !isConflict(err) {
		return err
	}
	other, getErr := deployments.Get(ctx, p.WorkspaceID, p.ActiveDeployment)
	if getErr != nil && !isNotFound(getErr) {
		return getErr
	}
	if getErr == nil && !deployment.Finished(other.Status) {
		return apierrors.Conflict("another deployment of this project is in progress: finish or cancel it first")
	}
	return projects.Lock(ctx, p.WorkspaceID, p.ID, id, p.ActiveDeployment)
}

func isNotFound(err error) bool {
	var apiErr *apierrors.ApiError
	return errors.As(err, &apiErr) && apiErr.Code == apierrors.CodeNotFound
}

func isConflict(err error) bool {
	var apiErr *apierrors.ApiError
	return errors.As(err, &apiErr) && apiErr.Code == apierrors.CodeConflict
}

func main() {
	lambda.Start(handler)
}
