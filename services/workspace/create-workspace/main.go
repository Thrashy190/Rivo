package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/google/uuid"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/user"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type WorkspaceCreator interface {
	CreateWithOwner(ctx context.Context, w *workspace.Workspace, owner *workspace.Membership) error
}

var (
	users      authz.UserLoader
	workspaces WorkspaceCreator
)

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	client := dynamodb.NewFromConfig(cfg)
	users = repository.NewDynamoDBUserRepository(client, os.Getenv("USERS_TABLE_NAME"))
	workspaces = repository.NewDynamoDBWorkspaceRepository(client, os.Getenv("WORKSPACES_TABLE_NAME"), os.Getenv("MEMBERS_TABLE_NAME"))
}

// Creating a workspace is a platform permission: whoever runs the installation
// decides who can open one. The creator becomes its first owner.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	u, err := authz.Require(ctx, users, req, user.PermWorkspacesCreate)
	if err != nil {
		return apigateway.Error(err), nil
	}

	var in workspace.CreateWorkspaceInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return apigateway.Error(apierrors.Validation("name is required")), nil
	}

	now := time.Now().UTC().UnixMilli()
	w := &workspace.Workspace{ID: uuid.NewString(), Name: name, CreatedBy: u.ID, CreatedAt: now, UpdatedAt: now}
	owner := &workspace.Membership{WorkspaceID: w.ID, UserID: u.ID, Email: u.Email, Role: workspace.RoleOwner, CreatedAt: now, UpdatedAt: now}
	if err := workspaces.CreateWithOwner(ctx, w, owner); err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusCreated, w), nil
}

func main() {
	lambda.Start(handler)
}
