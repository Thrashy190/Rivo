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

	apierrors "github.com/rivo-api/shared/errors"
	"github.com/rivo-api/shared/repository"
	"github.com/rivo-api/shared/transport/apigateway"
)

type ProjectDeleter interface {
	Delete(ctx context.Context, id string) error
}

var repo ProjectDeleter

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	client := dynamodb.NewFromConfig(cfg)
	repo = repository.NewDynamoDBProjectRepository(client, os.Getenv("TABLE_NAME"))
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	id := req.PathParameters["id"]
	if id == "" {
		return apigateway.Error(apierrors.Validation("id is required")), nil
	}

	if err := repo.Delete(ctx, id); err != nil {
		return apigateway.Error(err), nil
	}

	// 204: no body on purpose, there's nothing to return from a delete.
	return events.APIGatewayProxyResponse{StatusCode: http.StatusNoContent}, nil
}

func main() {
	lambda.Start(handler)
}
