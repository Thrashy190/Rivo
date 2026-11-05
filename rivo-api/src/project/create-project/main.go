package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	apierrors "github.com/rivo-api/shared/errors"
	"github.com/rivo-api/shared/models/project"
	"github.com/rivo-api/shared/repository"
	"github.com/rivo-api/shared/transport/apigateway"
)

type ProjectCreator interface {
	Create(ctx context.Context, p *project.Project) error
}

var repo ProjectCreator

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	client := dynamodb.NewFromConfig(cfg)
	repo = repository.NewDynamoDBProjectRepository(client, os.Getenv("TABLE_NAME"))
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var in project.CreateProjectInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}
	if in.Name == "" {
		return apigateway.Error(apierrors.Validation("name is required")), nil
	}

	p := &project.Project{
		ID:          uuid.NewString(),
		Name:        in.Name,
		Description: in.Description,
		CreatedAt:   time.Now().UTC().UnixMilli(),
	}

	err := repo.Create(ctx, p)
	if err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusCreated, p), nil
}

func main() {
	lambda.Start(handler)
}
