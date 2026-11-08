package main

import (
	"context"
	"fmt"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/connection"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type Connections interface {
	Get(ctx context.Context, workspaceID, id string) (*connection.Connection, error)
	Delete(ctx context.Context, workspaceID, id string) error
}

type ProjectLister interface {
	List(ctx context.Context, workspaceID string) ([]project.Project, error)
}

var (
	users       authz.UserLoader
	members     authz.MembershipLoader
	connections Connections
	projects    ProjectLister
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
	connections = repository.NewDynamoDBConnectionRepository(client, os.Getenv("CONNECTIONS_TABLE_NAME"))
	projects = repository.NewDynamoDBProjectRepository(client, os.Getenv("PROJECTS_TABLE_NAME"))
}

// Removes an AWS account from the workspace. Projects with infrastructure in
// it keep the account until they are destroyed: without it, Rivo could no
// longer change or remove what it created there.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermConnectionsManage)
	if err != nil {
		return apigateway.Error(err), nil
	}
	c, err := connections.Get(ctx, m.WorkspaceID, req.PathParameters["connectionId"])
	if err != nil {
		return apigateway.Error(err), nil
	}
	list, err := projects.List(ctx, m.WorkspaceID)
	if err != nil {
		return apigateway.Error(err), nil
	}
	for _, p := range list {
		if p.ConnectionID == c.ID {
			return apigateway.Error(apierrors.Conflict(fmt.Sprintf("%s has infrastructure in this account: destroy it first", p.Name))), nil
		}
	}
	if err := connections.Delete(ctx, m.WorkspaceID, c.ID); err != nil {
		return apigateway.Error(err), nil
	}
	return apigateway.NoContent(), nil
}

func main() {
	lambda.Start(handler)
}
