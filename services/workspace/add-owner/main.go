package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
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

type WorkspaceGetter interface {
	GetByID(ctx context.Context, id string) (*workspace.Workspace, error)
}

type MemberStore interface {
	authz.MembershipLoader
	Create(ctx context.Context, m *workspace.Membership) error
	UpdateRole(ctx context.Context, workspaceID, userID string, role workspace.Role) (*workspace.Membership, error)
}

type Directory interface {
	EnsureUser(ctx context.Context, email string) (string, error)
}

var (
	users      UserStore
	workspaces WorkspaceGetter
	members    MemberStore
	people     Directory
)

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	client := dynamodb.NewFromConfig(cfg)
	users = repository.NewDynamoDBUserRepository(client, os.Getenv("USERS_TABLE_NAME"))
	workspaces = repository.NewDynamoDBWorkspaceRepository(client, os.Getenv("WORKSPACES_TABLE_NAME"), os.Getenv("MEMBERS_TABLE_NAME"))
	members = repository.NewDynamoDBMembershipRepository(client, os.Getenv("MEMBERS_TABLE_NAME"))
	people = directory.NewCognito(cognitoidentityprovider.NewFromConfig(cfg), os.Getenv("USER_POOL_ID"))
}

// Makes someone a workspace owner, the customer-side administrator. This is a
// platform route: owners cannot create other owners. It is logged because it
// is the one way a platform administrator can open a door into a workspace.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	caller, err := authz.Require(ctx, users, req, user.PermWorkspacesManage)
	if err != nil {
		return apigateway.Error(err), nil
	}

	w, err := workspaces.GetByID(ctx, req.PathParameters["workspaceId"])
	if err != nil {
		return apigateway.Error(err), nil
	}

	var in workspace.AddOwnerInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if !strings.Contains(email, "@") {
		return apigateway.Error(apierrors.Validation("a valid email is required")), nil
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

	owner, err := promote(ctx, w.ID, sub, email, now)
	if err != nil {
		return apigateway.Error(err), nil
	}

	log.Printf("audit: user %s made %s an owner of workspace %s", caller.ID, sub, w.ID)
	return apigateway.Success(http.StatusCreated, owner), nil
}

func promote(ctx context.Context, workspaceID, userID, email string, now int64) (*workspace.Membership, error) {
	_, err := members.Get(ctx, workspaceID, userID)
	if err == nil {
		return members.UpdateRole(ctx, workspaceID, userID, workspace.RoleOwner)
	}
	if !isNotFound(err) {
		return nil, err
	}
	m := &workspace.Membership{WorkspaceID: workspaceID, UserID: userID, Email: email, Role: workspace.RoleOwner, CreatedAt: now, UpdatedAt: now}
	if err := members.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func isNotFound(err error) bool {
	var apiErr *apierrors.ApiError
	return errors.As(err, &apiErr) && apiErr.Code == apierrors.CodeNotFound
}

func main() {
	lambda.Start(handler)
}
