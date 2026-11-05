package main

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type WorkspaceGetter interface {
	GetByID(ctx context.Context, id string) (*workspace.Workspace, error)
}

var (
	users      authz.UserLoader
	members    authz.MembershipLoader
	workspaces WorkspaceGetter
)

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	client := dynamodb.NewFromConfig(cfg)
	users = repository.NewDynamoDBUserRepository(client, os.Getenv("USERS_TABLE_NAME"))
	members = repository.NewDynamoDBMembershipRepository(client, os.Getenv("MEMBERS_TABLE_NAME"))
	workspaces = repository.NewDynamoDBWorkspaceRepository(client, os.Getenv("WORKSPACES_TABLE_NAME"), os.Getenv("MEMBERS_TABLE_NAME"))
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermWorkspaceRead)
	if err != nil {
		return apigateway.Error(err), nil
	}

	w, err := workspaces.GetByID(ctx, m.WorkspaceID)
	if err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusOK, workspace.Summary{Workspace: *w, Role: m.Role}), nil
}

func main() {
	lambda.Start(handler)
}
