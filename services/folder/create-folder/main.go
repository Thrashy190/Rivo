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
	"github.com/Thrashy190/Rivo/services/shared/models/folder"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type FolderStore interface {
	Create(ctx context.Context, f *folder.Folder) error
	List(ctx context.Context, workspaceID string) ([]folder.Folder, error)
}

var (
	users   authz.UserLoader
	members authz.MembershipLoader
	folders FolderStore
)

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	client := dynamodb.NewFromConfig(cfg)
	users = repository.NewDynamoDBUserRepository(client, os.Getenv("USERS_TABLE_NAME"))
	members = repository.NewDynamoDBMembershipRepository(client, os.Getenv("MEMBERS_TABLE_NAME"))
	folders = repository.NewDynamoDBFolderRepository(client, os.Getenv("FOLDERS_TABLE_NAME"))
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	u, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermFoldersManage)
	if err != nil {
		return apigateway.Error(err), nil
	}

	var in folder.CreateFolderInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return apigateway.Error(apierrors.Validation("name is required")), nil
	}

	// The parent is looked up inside this workspace, so a folder can never hang
	// from another tenant's folder.
	if in.ParentID != "" {
		existing, err := folders.List(ctx, m.WorkspaceID)
		if err != nil {
			return apigateway.Error(err), nil
		}
		if !contains(existing, in.ParentID) {
			return apigateway.Error(apierrors.Validation("parent folder not found")), nil
		}
	}

	f := &folder.Folder{
		WorkspaceID: m.WorkspaceID,
		ID:          uuid.NewString(),
		ParentID:    in.ParentID,
		Name:        name,
		CreatedBy:   u.ID,
		CreatedAt:   time.Now().UTC().UnixMilli(),
	}
	if err := folders.Create(ctx, f); err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusCreated, f), nil
}

func contains(list []folder.Folder, id string) bool {
	for _, f := range list {
		if f.ID == id {
			return true
		}
	}
	return false
}

func main() {
	lambda.Start(handler)
}
