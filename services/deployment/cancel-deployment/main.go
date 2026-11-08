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

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/deployment"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type Deployments interface {
	Get(ctx context.Context, workspaceID, id string) (*deployment.Deployment, error)
	Transition(ctx context.Context, workspaceID, id string, from []string, to string, fields map[string]any) (*deployment.Deployment, error)
}

type Projects interface {
	Unlock(ctx context.Context, workspaceID, id, deploymentID string, res *repository.DeploymentResult) error
}

var (
	users       authz.UserLoader
	members     authz.MembershipLoader
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
	users = repository.NewDynamoDBUserRepository(client, os.Getenv("USERS_TABLE_NAME"))
	members = repository.NewDynamoDBMembershipRepository(client, os.Getenv("MEMBERS_TABLE_NAME"))
	deployments = repository.NewDynamoDBDeploymentRepository(client, os.Getenv("DEPLOYMENTS_TABLE_NAME"), "")
	projects = repository.NewDynamoDBProjectRepository(client, os.Getenv("PROJECTS_TABLE_NAME"))
}

// Discards a plan nobody applied, which frees the project. A deployment the
// engine is applying cannot be stopped halfway.
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
	if d.Status != deployment.StatusPlanned && d.Status != deployment.StatusQueued {
		return apigateway.Error(apierrors.Conflict("only a deployment waiting for approval can be cancelled; this one is " + d.Status)), nil
	}
	d, err = deployments.Transition(ctx, d.WorkspaceID, d.ID, []string{deployment.StatusPlanned, deployment.StatusQueued}, deployment.StatusCancelled, map[string]any{
		"finished_at": time.Now().UnixMilli(), "approved_by": u.ID, "approved_email": u.Email,
	})
	if err != nil {
		return apigateway.Error(err), nil
	}
	if err := projects.Unlock(ctx, d.WorkspaceID, d.ProjectID, d.ID, nil); err != nil {
		return apigateway.Error(err), nil
	}
	return apigateway.Success(http.StatusOK, d), nil
}

func main() {
	lambda.Start(handler)
}
