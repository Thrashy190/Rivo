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
	"github.com/Thrashy190/Rivo/services/shared/models/user"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type UserStore interface {
	GetByID(ctx context.Context, id string) (*user.User, error)
}

var users UserStore

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	users = repository.NewDynamoDBUserRepository(dynamodb.NewFromConfig(cfg), os.Getenv("USERS_TABLE_NAME"))
}

// Requires no specific permission: any active user can read their own
// profile. It returns resolved permissions so the frontend does not have to
// replicate the role table.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	me, err := authz.Caller(ctx, users, req)
	if err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusOK, user.NewProfile(me)), nil
}

func main() {
	lambda.Start(handler)
}
