package main

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/user"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type UserStore interface {
	GetByID(ctx context.Context, id string) (*user.User, error)
	Delete(ctx context.Context, id string) error
}

var (
	users         UserStore
	cognitoClient *cognitoidentityprovider.Client
	userPoolID    string
)

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	users = repository.NewDynamoDBUserRepository(dynamodb.NewFromConfig(cfg), os.Getenv("USERS_TABLE_NAME"))
	cognitoClient = cognitoidentityprovider.NewFromConfig(cfg)
	userPoolID = os.Getenv("USER_POOL_ID")
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	caller, err := authz.Require(ctx, users, req, user.PermUsersManage)
	if err != nil {
		return apigateway.Error(err), nil
	}

	id := req.PathParameters["id"]
	if id == "" {
		return apigateway.Error(apierrors.Validation("id is required")), nil
	}
	if id == caller.ID {
		return apigateway.Error(apierrors.Validation("cannot delete your own user")), nil
	}

	target, err := users.GetByID(ctx, id)
	if err != nil {
		return apigateway.Error(err), nil
	}

	// Cognito primero: si falla, la fila queda y el borrado se puede
	// reintentar. Al revés quedaría un usuario capaz de autenticarse pero
	// sin permisos, que es un estado más confuso de diagnosticar.
	_, err = cognitoClient.AdminDeleteUser(ctx, &cognitoidentityprovider.AdminDeleteUserInput{
		UserPoolId: aws.String(userPoolID),
		Username:   aws.String(target.Email),
	})
	if err != nil {
		return apigateway.Error(apierrors.FromCognitoAdminError(err)), nil
	}

	if err := users.Delete(ctx, id); err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusOK, map[string]string{"message": "User deleted"}), nil
}

func main() {
	lambda.Start(handler)
}
