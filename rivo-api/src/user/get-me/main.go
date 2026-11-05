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
}

var users UserStore

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	users = repository.NewDynamoDBUserRepository(dynamodb.NewFromConfig(cfg), os.Getenv("USERS_TABLE_NAME"))
}

// No exige ningún permiso puntual: cualquier usuario activo puede leer su
// propio perfil. Devuelve los permisos ya resueltos para que el frontend
// no tenga que replicar la tabla de roles.
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
