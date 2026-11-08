package main

import (
	"context"
	"fmt"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/storage"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type ProjectStore interface {
	GetByID(ctx context.Context, workspaceID, id string) (*project.Project, error)
	Delete(ctx context.Context, workspaceID, id string) error
}

type VersionDeleter interface {
	DeleteAll(ctx context.Context, projectID string) error
}

type DiagramDeleter interface {
	DeletePrefix(ctx context.Context, prefix string) error
}

var (
	users    authz.UserLoader
	members  authz.MembershipLoader
	projects ProjectStore
	versions VersionDeleter
	diagrams DiagramDeleter
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
	versions = repository.NewDynamoDBVersionRepository(client, os.Getenv("VERSIONS_TABLE_NAME"))
	diagrams = storage.NewS3(s3.NewFromConfig(cfg), os.Getenv("DIAGRAMS_BUCKET"))
}

// Deletes the diagrams and versions first: if a step fails, the project still
// exists and the deletion can be repeated.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermProjectsDelete)
	if err != nil {
		return apigateway.Error(err), nil
	}

	p, err := projects.GetByID(ctx, m.WorkspaceID, req.PathParameters["projectId"])
	if err != nil {
		return apigateway.Error(err), nil
	}

	// Its state is under the same prefix: deleting it would leave whatever the
	// project created in AWS with nothing that can remove it.
	if p.ActiveDeployment != "" {
		return apigateway.Error(apierrors.Conflict("a deployment of this project is in progress: finish or cancel it first")), nil
	}
	if p.ConnectionID != "" {
		return apigateway.Error(apierrors.Conflict("the project has infrastructure in AWS: destroy it before deleting the project")), nil
	}

	if err := diagrams.DeletePrefix(ctx, storage.ProjectPrefix(p.WorkspaceID, p.ID)); err != nil {
		return apigateway.Error(err), nil
	}
	if err := versions.DeleteAll(ctx, p.ID); err != nil {
		return apigateway.Error(err), nil
	}
	if err := projects.Delete(ctx, p.WorkspaceID, p.ID); err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.NoContent(), nil
}

func main() {
	lambda.Start(handler)
}
