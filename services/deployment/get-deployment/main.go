package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/deployment"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/storage"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

// Each log is cut to its end, to keep the answer under a Lambda's 6 MB.
const maxLogBytes = 512 * 1024

type DeploymentGetter interface {
	Get(ctx context.Context, workspaceID, id string) (*deployment.Deployment, error)
}

type Files interface {
	Get(ctx context.Context, key string) ([]byte, string, error)
}

var (
	users       authz.UserLoader
	members     authz.MembershipLoader
	deployments DeploymentGetter
	files       Files
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
	files = storage.NewS3(s3.NewFromConfig(cfg), os.Getenv("DIAGRAMS_BUCKET"))
}

// Returns a deployment with its plan and the engine's log so far. The app
// asks again every few seconds while it runs.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermProjectsRead)
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
	out := deployment.Detail{Deployment: *d}

	key := func(name string) string { return storage.DeploymentKey(d.WorkspaceID, d.ProjectID, d.ID, name) }
	if body, err := read(ctx, key("plan.json")); err != nil {
		return apigateway.Error(err), nil
	} else if body != nil {
		var plan deployment.Plan
		if json.Unmarshal(body, &plan) == nil {
			out.Plan = &plan
		}
	}
	for _, name := range []string{"plan.log", "apply.log"} {
		body, err := read(ctx, key(name))
		if err != nil {
			return apigateway.Error(err), nil
		}
		if len(body) > maxLogBytes {
			body = append([]byte("[…]\n"), body[len(body)-maxLogBytes:]...)
		}
		out.Log += string(body)
	}
	return apigateway.Success(http.StatusOK, out), nil
}

// read returns nil for a file the engine has not written yet.
func read(ctx context.Context, key string) ([]byte, error) {
	body, _, err := files.Get(ctx, key)
	var apiErr *apierrors.ApiError
	if errors.As(err, &apiErr) && apiErr.Code == apierrors.CodeNotFound {
		return nil, nil
	}
	return body, err
}

func main() {
	lambda.Start(handler)
}
