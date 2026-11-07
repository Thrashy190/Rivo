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
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/storage"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

// uploadWindow is how long the browser has to start sending the file.
const uploadWindow = 15 * time.Minute

type ProjectGetter interface {
	GetByID(ctx context.Context, workspaceID, id string) (*project.Project, error)
}

type Uploads interface {
	PresignUpload(ctx context.Context, key string, maxBytes int64, expires time.Duration) (*storage.Upload, error)
}

var (
	users    authz.UserLoader
	members  authz.MembershipLoader
	projects ProjectGetter
	files    Uploads
	newID    = uuid.NewString
	now      = time.Now
)

func init() {
	if os.Getenv("AWS_LAMBDA_FUNCTION_NAME") == "" {
		return
	}
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	client := dynamodb.NewFromConfig(cfg)
	users = repository.NewDynamoDBUserRepository(client, os.Getenv("USERS_TABLE_NAME"))
	members = repository.NewDynamoDBMembershipRepository(client, os.Getenv("MEMBERS_TABLE_NAME"))
	projects = repository.NewDynamoDBProjectRepository(client, os.Getenv("PROJECTS_TABLE_NAME"))
	files = storage.NewS3(s3.NewFromConfig(cfg), os.Getenv("DIAGRAMS_BUCKET"))
}

// Prepares the upload of a Lambda's .zip. The browser sends the file straight
// to S3 with the returned form, which also enforces the size limit, so large
// files never pass through a Lambda. The diagram then refers to the package ID.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermProjectsUpdate)
	if err != nil {
		return apigateway.Error(err), nil
	}

	var in project.CreatePackageInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}
	if !project.ValidPackageName(strings.TrimSpace(in.FileName)) {
		return apigateway.Error(apierrors.Validation("choose a .zip file")), nil
	}
	if in.Size <= 0 || in.Size > project.MaxPackageBytes {
		return apigateway.Error(apierrors.Validation(fmt.Sprintf("a package must be at most %d MB", project.MaxPackageBytes/1024/1024))), nil
	}

	// Look the project up in this workspace before building its S3 key.
	p, err := projects.GetByID(ctx, m.WorkspaceID, req.PathParameters["projectId"])
	if err != nil {
		return apigateway.Error(err), nil
	}

	id := newID()
	upload, err := files.PresignUpload(ctx, storage.PackageKey(p.WorkspaceID, p.ID, id), project.MaxPackageBytes, uploadWindow)
	if err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusCreated, project.PackageUpload{
		PackageID: id,
		URL:       upload.URL,
		Fields:    upload.Fields,
		ExpiresAt: now().Add(uploadWindow).UnixMilli(),
	}), nil
}

func main() {
	lambda.Start(handler)
}
