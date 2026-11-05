package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/user"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type MemberStore interface {
	authz.MembershipLoader
	ListByWorkspace(ctx context.Context, workspaceID string) ([]workspace.Membership, error)
	Delete(ctx context.Context, workspaceID, userID string) error
}

var (
	users   authz.UserLoader
	members MemberStore
)

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	client := dynamodb.NewFromConfig(cfg)
	users = repository.NewDynamoDBUserRepository(client, os.Getenv("USERS_TABLE_NAME"))
	members = repository.NewDynamoDBMembershipRepository(client, os.Getenv("MEMBERS_TABLE_NAME"))
}

// Platform route: removes a workspace owner. A workspace always keeps at least
// one owner, so add the new owner before removing the old one.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	caller, err := authz.Require(ctx, users, req, user.PermWorkspacesManage)
	if err != nil {
		return apigateway.Error(err), nil
	}

	workspaceID := req.PathParameters["workspaceId"]
	target, err := members.Get(ctx, workspaceID, req.PathParameters["userId"])
	if err != nil {
		return apigateway.Error(err), nil
	}
	if !target.IsOwner() {
		return apigateway.Error(apierrors.Conflict("this member is not an owner")), nil
	}

	list, err := members.ListByWorkspace(ctx, workspaceID)
	if err != nil {
		return apigateway.Error(err), nil
	}
	if workspace.LosesLastOwner(list, target) {
		return apigateway.Error(apierrors.Conflict("a workspace needs at least one owner")), nil
	}

	if err := members.Delete(ctx, workspaceID, target.UserID); err != nil {
		return apigateway.Error(err), nil
	}

	log.Printf("audit: user %s removed owner %s from workspace %s", caller.ID, target.UserID, workspaceID)
	return events.APIGatewayProxyResponse{StatusCode: http.StatusNoContent}, nil
}

func main() {
	lambda.Start(handler)
}
