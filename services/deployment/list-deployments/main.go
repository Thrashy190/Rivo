package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/deployment"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type Deployments interface {
	List(ctx context.Context, workspaceID, projectID string, limit int, cursor string) (*repository.Page, error)
	Usage(ctx context.Context, workspaceID, month string) (*deployment.Usage, error)
}

type ProjectGetter interface {
	GetByID(ctx context.Context, workspaceID, id string) (*project.Project, error)
}

var (
	users       authz.UserLoader
	members     authz.MembershipLoader
	deployments Deployments
	projects    ProjectGetter
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
	deployments = repository.NewDynamoDBDeploymentRepository(client, os.Getenv("DEPLOYMENTS_TABLE_NAME"), os.Getenv("USAGE_TABLE_NAME"))
	projects = repository.NewDynamoDBProjectRepository(client, os.Getenv("PROJECTS_TABLE_NAME"))
}

type listOutput struct {
	repository.Page
	// Engine time this month, for the whole workspace.
	Usage *deployment.Usage `json:"usage,omitempty"`
}

// Lists deployments, newest first: a project's, under its path, or the whole
// workspace's with this month's engine time.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermProjectsRead)
	if err != nil {
		return apigateway.Error(err), nil
	}
	limit := 25
	if s := req.QueryStringParameters["limit"]; s != "" {
		if limit, err = strconv.Atoi(s); err != nil || limit < 1 || limit > 100 {
			return apigateway.Error(apierrors.Validation("limit is a number from 1 to 100")), nil
		}
	}
	projectID := req.PathParameters["projectId"]
	if projectID != "" {
		if _, err := projects.GetByID(ctx, m.WorkspaceID, projectID); err != nil {
			return apigateway.Error(err), nil
		}
	}
	page, err := deployments.List(ctx, m.WorkspaceID, projectID, limit, req.QueryStringParameters["cursor"])
	if err != nil {
		return apigateway.Error(err), nil
	}
	out := listOutput{Page: *page}
	if projectID == "" {
		if out.Usage, err = deployments.Usage(ctx, m.WorkspaceID, time.Now().UTC().Format("2006-01")); err != nil {
			return apigateway.Error(err), nil
		}
	}
	return apigateway.Success(http.StatusOK, out), nil
}

func main() {
	lambda.Start(handler)
}
