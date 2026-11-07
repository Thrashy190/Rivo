package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

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
	NextVersion(ctx context.Context, workspaceID, id string) (int, error)
}

type VersionCreator interface {
	Create(ctx context.Context, v *project.Version) error
}

type DiagramCopier interface {
	Copy(ctx context.Context, from, to string) error
}

var (
	users    authz.UserLoader
	members  authz.MembershipLoader
	projects ProjectStore
	versions VersionCreator
	diagrams DiagramCopier
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

// Saves the working diagram as a new numbered version, which never changes.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	u, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermProjectsUpdate)
	if err != nil {
		return apigateway.Error(err), nil
	}

	var in project.CreateVersionInput
	if req.Body != "" {
		if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
			return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
		}
	}

	p, err := projects.GetByID(ctx, m.WorkspaceID, req.PathParameters["projectId"])
	if err != nil {
		return apigateway.Error(err), nil
	}

	number, err := projects.NextVersion(ctx, p.WorkspaceID, p.ID)
	if err != nil {
		return apigateway.Error(err), nil
	}

	err = diagrams.Copy(ctx, storage.DraftKey(p.WorkspaceID, p.ID), storage.VersionKey(p.WorkspaceID, p.ID, number))
	if err != nil {
		var apiErr *apierrors.ApiError
		if errors.As(err, &apiErr) && apiErr.Code == apierrors.CodeNotFound {
			return apigateway.Error(apierrors.Conflict("save the diagram before creating a version")), nil
		}
		return apigateway.Error(err), nil
	}

	v := &project.Version{ProjectID: p.ID, Number: number, Note: in.Note, CreatedBy: u.ID, CreatedAt: time.Now().UTC().UnixMilli()}
	if err := versions.Create(ctx, v); err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusCreated, v), nil
}

func main() {
	lambda.Start(handler)
}
