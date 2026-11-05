package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	cognitotypes "github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/rivo-api/shared/authz"
	apierrors "github.com/rivo-api/shared/errors"
	"github.com/rivo-api/shared/models/user"
	"github.com/rivo-api/shared/repository"
	"github.com/rivo-api/shared/transport/apigateway"
)

type UserStore interface {
	GetByID(ctx context.Context, id string) (*user.User, error)
	Create(ctx context.Context, u *user.User) error
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

// Única vía de alta de usuarios: el signup público está cerrado
// (allow_admin_create_user_only en el user pool), así que un usuario entra
// solo si alguien con users:manage lo crea acá. Cognito le manda la
// password temporal por mail y el primer login pasa por el challenge
// NEW_PASSWORD_REQUIRED.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	if _, err := authz.Require(ctx, users, req, user.PermUsersManage); err != nil {
		return apigateway.Error(err), nil
	}

	var in user.CreateUserInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}
	if in.Email == "" {
		return apigateway.Error(apierrors.Validation("email is required")), nil
	}
	if !user.ValidRole(in.Role) {
		return apigateway.Error(apierrors.Validation("invalid role")), nil
	}
	for _, p := range in.Permissions {
		if !user.ValidPermission(p) {
			return apigateway.Error(apierrors.Validation("invalid permission: " + p)), nil
		}
	}

	created, err := cognitoClient.AdminCreateUser(ctx, &cognitoidentityprovider.AdminCreateUserInput{
		UserPoolId:             aws.String(userPoolID),
		Username:               aws.String(in.Email),
		DesiredDeliveryMediums: []cognitotypes.DeliveryMediumType{cognitotypes.DeliveryMediumTypeEmail},
		UserAttributes: []cognitotypes.AttributeType{
			{Name: aws.String("email"), Value: aws.String(in.Email)},
			{Name: aws.String("email_verified"), Value: aws.String("true")},
		},
	})
	if err != nil {
		return apigateway.Error(apierrors.FromCognitoAdminError(err)), nil
	}

	sub := subOf(created.User)
	if sub == "" {
		return apigateway.Error(apierrors.Internal(fmt.Errorf("cognito AdminCreateUser: missing sub attribute"))), nil
	}

	now := time.Now().UTC().UnixMilli()
	u := &user.User{
		ID:          sub,
		Email:       in.Email,
		Role:        in.Role,
		Permissions: in.Permissions,
		Status:      user.StatusActive,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := users.Create(ctx, u); err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusCreated, u), nil
}

// El sub de Cognito es la clave con la que se guarda el usuario, porque es
// lo que después llega en los claims del token.
func subOf(created *cognitotypes.UserType) string {
	if created == nil {
		return ""
	}
	for _, attr := range created.Attributes {
		if aws.ToString(attr.Name) == "sub" {
			return aws.ToString(attr.Value)
		}
	}
	return ""
}

func main() {
	lambda.Start(handler)
}
