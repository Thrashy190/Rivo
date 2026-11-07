package main

import (
	"context"
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

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/storage"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

const linkLifetime = 5 * time.Minute

type ProjectGetter interface {
	GetByID(ctx context.Context, workspaceID, id string) (*project.Project, error)
}

type Downloads interface {
	Size(ctx context.Context, key string) (int64, error)
	PresignDownload(ctx context.Context, key, fileName string, expires time.Duration) (string, error)
}

var (
	users    authz.UserLoader
	members  authz.MembershipLoader
	projects ProjectGetter
	files    Downloads
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

// Confirms that a package was uploaded and returns its size and a short-lived
// download link. ?fileName= names the downloaded file.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermProjectsRead)
	if err != nil {
		return apigateway.Error(err), nil
	}

	packageID := req.PathParameters["packageId"]
	if !project.ValidPackageID(packageID) {
		return apigateway.Error(apierrors.NotFound("package")), nil
	}
	fileName := strings.TrimSpace(req.QueryStringParameters["fileName"])
	if !project.ValidPackageName(fileName) {
		fileName = "package.zip"
	}

	p, err := projects.GetByID(ctx, m.WorkspaceID, req.PathParameters["projectId"])
	if err != nil {
		return apigateway.Error(err), nil
	}

	key := storage.PackageKey(p.WorkspaceID, p.ID, packageID)
	size, err := files.Size(ctx, key)
	if err != nil {
		return apigateway.Error(err), nil
	}
	url, err := files.PresignDownload(ctx, key, fileName, linkLifetime)
	if err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusOK, project.PackageDownload{PackageID: packageID, Size: size, URL: url}), nil
}

func main() {
	lambda.Start(handler)
}
