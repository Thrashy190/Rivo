package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/folder"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type ProjectUpdater interface {
	Update(ctx context.Context, workspaceID, id string, in project.UpdateProjectInput) (*project.Project, error)
}

type FolderLister interface {
	List(ctx context.Context, workspaceID string) ([]folder.Folder, error)
}

var (
	users    authz.UserLoader
	members  authz.MembershipLoader
	projects ProjectUpdater
	folders  FolderLister
)

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	client := dynamodb.NewFromConfig(cfg)
	users = repository.NewDynamoDBUserRepository(client, os.Getenv("USERS_TABLE_NAME"))
	members = repository.NewDynamoDBMembershipRepository(client, os.Getenv("MEMBERS_TABLE_NAME"))
	projects = repository.NewDynamoDBProjectRepository(client, os.Getenv("PROJECTS_TABLE_NAME"))
	folders = repository.NewDynamoDBFolderRepository(client, os.Getenv("FOLDERS_TABLE_NAME"))
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermProjectsUpdate)
	if err != nil {
		return apigateway.Error(err), nil
	}

	var in project.UpdateProjectInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}
	if in.Name != nil && strings.TrimSpace(*in.Name) == "" {
		return apigateway.Error(apierrors.Validation("name cannot be empty")), nil
	}

	// The folder is looked up inside this workspace, so a project can never move
	// into another tenant's folder.
	if in.FolderID != nil && *in.FolderID != "" {
		existing, err := folders.List(ctx, m.WorkspaceID)
		if err != nil {
			return apigateway.Error(err), nil
		}
		found := false
		for _, f := range existing {
			found = found || f.ID == *in.FolderID
		}
		if !found {
			return apigateway.Error(apierrors.Validation("folder not found")), nil
		}
	}

	updated, err := projects.Update(ctx, m.WorkspaceID, req.PathParameters["projectId"], in)
	if err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusOK, updated), nil
}

func main() {
	lambda.Start(handler)
}
