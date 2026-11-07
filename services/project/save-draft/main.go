package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"strings"

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
	Touch(ctx context.Context, workspaceID, id string) error
}

type DiagramWriter interface {
	Put(ctx context.Context, key string, body []byte, ifMatch string, ifAbsent bool) (string, error)
}

var (
	users    authz.UserLoader
	members  authz.MembershipLoader
	projects ProjectStore
	diagrams DiagramWriter
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
	diagrams = storage.NewS3(s3.NewFromConfig(cfg), os.Getenv("DIAGRAMS_BUCKET"))
}

// Saves the project's working diagram. Send the ETag from the last read as
// If-Match, or If-None-Match: * for a first save, so two people editing at once
// get a conflict instead of overwriting each other.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermProjectsUpdate)
	if err != nil {
		return apigateway.Error(err), nil
	}

	p, err := projects.GetByID(ctx, m.WorkspaceID, req.PathParameters["projectId"])
	if err != nil {
		return apigateway.Error(err), nil
	}

	body := []byte(req.Body)
	if req.IsBase64Encoded {
		body, err = base64.StdEncoding.DecodeString(req.Body)
		if err != nil {
			return apigateway.Error(apierrors.Validation("invalid body encoding")), nil
		}
	}
	if len(body) > project.MaxDiagramBytes {
		return apigateway.Error(apierrors.Validation("the diagram is larger than 5 MB")), nil
	}
	if !project.ValidDiagram(body) {
		return apigateway.Error(apierrors.Validation("the body is not a valid diagram")), nil
	}

	ifMatch := strings.Trim(header(req, "If-Match"), `"`)
	ifAbsent := header(req, "If-None-Match") == "*"
	etag, err := diagrams.Put(ctx, storage.DraftKey(p.WorkspaceID, p.ID), body, ifMatch, ifAbsent)
	if err != nil {
		return apigateway.Error(err), nil
	}

	if err := projects.Touch(ctx, p.WorkspaceID, p.ID); err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusOK, map[string]string{"etag": etag}), nil
}

// API Gateway keeps header names as the client sent them.
func header(req events.APIGatewayProxyRequest, name string) string {
	for k, v := range req.Headers {
		if strings.EqualFold(k, name) {
			return v
		}
	}
	return ""
}

func main() {
	lambda.Start(handler)
}
