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
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type ProjectCreator interface {
	Create(ctx context.Context, p *project.Project) error
}

type FolderLister interface {
	List(ctx context.Context, workspaceID string) ([]folder.Folder, error)
}

var (
	users    authz.UserLoader
	members  authz.MembershipLoader
	projects ProjectCreator
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
	u, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermProjectsCreate)
	if err != nil {
		return apigateway.Error(err), nil
	}

	var in project.CreateProjectInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return apigateway.Error(apierrors.Validation("name is required")), nil
	}
	if !project.ValidRegion(in.Region) {
		return apigateway.Error(apierrors.Validation("a valid AWS region is required")), nil
	}
	environment := strings.TrimSpace(in.Environment)
	if environment == "" {
		environment = project.DefaultEnvironment
	}

	// The folder is looked up inside this workspace, so a project can never land
	// in another tenant's folder.
	if in.FolderID != "" {
		existing, err := folders.List(ctx, m.WorkspaceID)
		if err != nil {
			return apigateway.Error(err), nil
		}
		if !hasFolder(existing, in.FolderID) {
			return apigateway.Error(apierrors.Validation("folder not found")), nil
		}
	}

	now := time.Now().UTC().UnixMilli()
	p := &project.Project{
		WorkspaceID: m.WorkspaceID,
		ID:          uuid.NewString(),
		FolderID:    in.FolderID,
		Name:        name,
		Description: in.Description,
		Region:      in.Region,
		Environment: environment,
		Status:      project.StatusDraft,
		CreatedBy:   u.ID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := projects.Create(ctx, p); err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusCreated, p), nil
}

func hasFolder(list []folder.Folder, id string) bool {
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
