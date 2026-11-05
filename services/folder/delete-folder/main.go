package main

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/folder"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type FolderStore interface {
	List(ctx context.Context, workspaceID string) ([]folder.Folder, error)
	Delete(ctx context.Context, workspaceID, id string) error
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
	_, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermFoldersManage)
	if err != nil {
		return apigateway.Error(err), nil
	}

	id := req.PathParameters["folderId"]
	list, err := folders.List(ctx, m.WorkspaceID)
	if err != nil {
		return apigateway.Error(err), nil
	}
	for _, f := range list {
		if f.ParentID == id {
			return apigateway.Error(apierrors.Conflict("the folder is not empty")), nil
		}
	}

	if err := folders.Delete(ctx, m.WorkspaceID, id); err != nil {
		return apigateway.Error(err), nil
	}

	return events.APIGatewayProxyResponse{StatusCode: http.StatusNoContent}, nil
}

func main() {
	lambda.Start(handler)
}
