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

	"github.com/rivo-api/shared/authz"
	"github.com/rivo-api/shared/models/project"
	"github.com/rivo-api/shared/models/user"
	"github.com/rivo-api/shared/repository"
	"github.com/rivo-api/shared/transport/apigateway"
)

type ProjectLister interface {
	List(ctx context.Context) ([]project.Project, error)
}

type UserLoader interface {
	GetByID(ctx context.Context, id string) (*user.User, error)
}

type listProjectsResponse struct {
	Projects []project.Project `json:"projects"`
}

var (
	repo  ProjectLister
	users UserLoader
)

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	client := dynamodb.NewFromConfig(cfg)
	repo = repository.NewDynamoDBProjectRepository(client, os.Getenv("TABLE_NAME"))
	users = repository.NewDynamoDBUserRepository(client, os.Getenv("USERS_TABLE_NAME"))
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	if _, err := authz.Require(ctx, users, req, user.PermProjectsRead); err != nil {
		return apigateway.Error(err), nil
	}

	projects, err := repo.List(ctx)
	if err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusOK, listProjectsResponse{Projects: projects}), nil
}

func main() {
	lambda.Start(handler)
}
