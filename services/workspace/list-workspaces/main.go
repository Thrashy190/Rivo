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

type MembershipLister interface {
	ListByUser(ctx context.Context, userID string) ([]workspace.Membership, error)
}

type WorkspaceReader interface {
	GetMany(ctx context.Context, ids []string) ([]workspace.Workspace, error)
	List(ctx context.Context) ([]workspace.Workspace, error)
}

var (
	users      authz.UserLoader
	members    MembershipLister
	workspaces WorkspaceReader
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

// Lists the workspaces the caller belongs to. Platform administrators get every
// workspace in the installation, as viewers of those they are not members of.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	u, err := authz.Caller(ctx, users, req)
	if err != nil {
		return apigateway.Error(err), nil
	}

	memberships, err := members.ListByUser(ctx, u.ID)
	if err != nil {
		return apigateway.Error(err), nil
	}

	ids := make([]string, 0, len(memberships))
	roles := make(map[string]workspace.Role, len(memberships))
	for _, m := range memberships {
		ids = append(ids, m.WorkspaceID)
		roles[m.WorkspaceID] = m.Role
	}

	var found []workspace.Workspace
	if u.IsPlatformAdmin() {
		found, err = workspaces.List(ctx)
	} else {
		found, err = workspaces.GetMany(ctx, ids)
	}
	if err != nil {
		return apigateway.Error(err), nil
	}

	summaries := make([]workspace.Summary, 0, len(found))
	for _, w := range found {
		role, isMember := roles[w.ID]
		if !isMember {
			role = workspace.RoleViewer
		}
		summaries = append(summaries, workspace.Summary{Workspace: w, Role: role})
	}

	return apigateway.Success(http.StatusOK, summaries), nil
}

func main() {
	lambda.Start(handler)
}
