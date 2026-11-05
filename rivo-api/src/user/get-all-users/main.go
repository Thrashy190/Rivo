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
	"github.com/rivo-api/shared/models/user"
	"github.com/rivo-api/shared/repository"
	"github.com/rivo-api/shared/transport/apigateway"
)

type UserStore interface {
	GetByID(ctx context.Context, id string) (*user.User, error)
	List(ctx context.Context) ([]user.User, error)
}

var users UserStore

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	users = repository.NewDynamoDBUserRepository(dynamodb.NewFromConfig(cfg), os.Getenv("USERS_TABLE_NAME"))
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	if _, err := authz.Require(ctx, users, req, user.PermUsersRead); err != nil {
		return apigateway.Error(err), nil
	}

	list, err := users.List(ctx)
	if err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusOK, list), nil
}

func main() {
	lambda.Start(handler)
}
