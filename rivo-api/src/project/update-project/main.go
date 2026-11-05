package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	apierrors "github.com/rivo-api/shared/errors"
	"github.com/rivo-api/shared/models/project"
	"github.com/rivo-api/shared/repository"
	"github.com/rivo-api/shared/transport/apigateway"
)

type ProjectUpdater interface {
	Update(ctx context.Context, id string, in project.UpdateProjectInput) (*project.Project, error)
}

var repo ProjectUpdater

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

	var in project.UpdateProjectInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}

	p, err := repo.Update(ctx, id, in)
	if err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusOK, p), nil
}

func main() {
	lambda.Start(handler)
}
