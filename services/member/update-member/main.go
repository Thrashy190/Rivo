package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type MemberStore interface {
	authz.MembershipLoader
	UpdateRole(ctx context.Context, workspaceID, userID string, role workspace.Role) (*workspace.Membership, error)
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

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_, caller, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermMembersManage)
	if err != nil {
		return apigateway.Error(err), nil
	}

	var in workspace.UpdateMemberInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}
	if !workspace.ValidRole(in.Role) {
		return apigateway.Error(apierrors.Validation("invalid role")), nil
	}
	if !workspace.Invitable(in.Role) {
		return apigateway.Error(apierrors.Forbidden("only a platform administrator can add a workspace owner")), nil
	}

	target, err := members.Get(ctx, caller.WorkspaceID, req.PathParameters["userId"])
	if err != nil {
		return apigateway.Error(err), nil
	}
	if target.IsOwner() {
		return apigateway.Error(apierrors.Forbidden("only a platform administrator can change a workspace owner")), nil
	}

	updated, err := members.UpdateRole(ctx, caller.WorkspaceID, target.UserID, in.Role)
	if err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusOK, updated), nil
}

func main() {
	lambda.Start(handler)
}
