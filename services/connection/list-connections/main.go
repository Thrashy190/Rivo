package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	"github.com/Thrashy190/Rivo/services/shared/models/connection"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type Lister interface {
	List(ctx context.Context, workspaceID string) ([]connection.Connection, error)
}

var (
	users          authz.UserLoader
	members        authz.MembershipLoader
	connections    Lister
	trustedAccount = os.Getenv("RIVO_ACCOUNT_ID")
	trustedRoles   = strings.Split(os.Getenv("TRUSTED_ROLE_ARNS"), ",")
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
}

// Lists the workspace's AWS accounts. Everyone in the workspace sees them,
// because deploying means picking one.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermProjectsRead)
	if err != nil {
		return apigateway.Error(err), nil
	}
	list, err := connections.List(ctx, m.WorkspaceID)
	if err != nil {
		return apigateway.Error(err), nil
	}
	out := make([]connection.WithSetup, len(list))
	for i, c := range list {
		out[i] = connection.WithSetupFor(c, trustedAccount, trustedRoles)
	}
	return apigateway.Success(http.StatusOK, out), nil
}

func main() {
	lambda.Start(handler)
}
