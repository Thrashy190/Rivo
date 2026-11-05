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
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	"github.com/Thrashy190/Rivo/services/shared/directory"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/user"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type UserStore interface {
	authz.UserLoader
	Create(ctx context.Context, u *user.User) error
}

type MemberStore interface {
	authz.MembershipLoader
	Create(ctx context.Context, m *workspace.Membership) error
}

type Directory interface {
	EnsureUser(ctx context.Context, email string) (string, error)
}

var (
	users   UserStore
	members MemberStore
	people  Directory
)

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	client := dynamodb.NewFromConfig(cfg)
	users = repository.NewDynamoDBUserRepository(client, os.Getenv("USERS_TABLE_NAME"))
	members = repository.NewDynamoDBMembershipRepository(client, os.Getenv("MEMBERS_TABLE_NAME"))
	people = directory.NewCognito(cognitoidentityprovider.NewFromConfig(cfg), os.Getenv("USER_POOL_ID"))
}

// Invites someone to the workspace. Signup is closed, so this creates their
// account if they have none, with no platform-wide permissions: all their
// access comes from the workspaces they are invited to.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_, caller, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermMembersManage)
	if err != nil {
		return apigateway.Error(err), nil
	}

	var in workspace.AddMemberInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if !strings.Contains(email, "@") {
		return apigateway.Error(apierrors.Validation("a valid email is required")), nil
	}
	if !workspace.ValidRole(in.Role) {
		return apigateway.Error(apierrors.Validation("invalid role")), nil
	}
	if !workspace.Invitable(in.Role) {
		return apigateway.Error(apierrors.Forbidden("only a platform administrator can add a workspace owner")), nil
	}

	sub, err := people.EnsureUser(ctx, email)
	if err != nil {
		return apigateway.Error(err), nil
	}

	now := time.Now().UTC().UnixMilli()
	existing, err := users.GetByID(ctx, sub)
	switch {
	case err == nil:
		if !existing.IsActive() {
			return apigateway.Error(apierrors.Conflict("this user is disabled")), nil
		}
	case isNotFound(err):
		u := &user.User{ID: sub, Email: email, Role: user.RoleMember, Status: user.StatusActive, CreatedAt: now, UpdatedAt: now}
		if err := users.Create(ctx, u); err != nil {
			return apigateway.Error(err), nil
		}
	default:
		return apigateway.Error(err), nil
	}

	m := &workspace.Membership{WorkspaceID: caller.WorkspaceID, UserID: sub, Email: email, Role: in.Role, CreatedAt: now, UpdatedAt: now}
	if err := members.Create(ctx, m); err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusCreated, m), nil
}

func isNotFound(err error) bool {
	var apiErr *apierrors.ApiError
	return errors.As(err, &apiErr) && apiErr.Code == apierrors.CodeNotFound
}

func main() {
	lambda.Start(handler)
}
