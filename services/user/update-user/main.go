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

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/user"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type UserStore interface {
	GetByID(ctx context.Context, id string) (*user.User, error)
	Update(ctx context.Context, id string, in user.UpdateUserInput) (*user.User, error)
}

var users UserStore

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	users = repository.NewDynamoDBUserRepository(dynamodb.NewFromConfig(cfg), os.Getenv("USERS_TABLE_NAME"))
}

// Acá es donde el admin reparte accesos: cambia el rol, pisa permisos
// puntuales (ej. editor que no puede crear proyectos) o deshabilita a
// alguien.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	caller, err := authz.Require(ctx, users, req, user.PermUsersManage)
	if err != nil {
		return apigateway.Error(err), nil
	}

	id := req.PathParameters["id"]
	if id == "" {
		return apigateway.Error(apierrors.Validation("id is required")), nil
	}
	// Evita que el único admin se quede sin acceso a la gestión de usuarios.
	if id == caller.ID {
		return apigateway.Error(apierrors.Validation("cannot modify your own access")), nil
	}

	var in user.UpdateUserInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}
	if in.Role != nil && !user.ValidRole(*in.Role) {
		return apigateway.Error(apierrors.Validation("invalid role")), nil
	}
	if in.Status != nil && !user.ValidStatus(*in.Status) {
		return apigateway.Error(apierrors.Validation("invalid status")), nil
	}
	if in.Permissions != nil {
		for _, p := range *in.Permissions {
			if !user.ValidPermission(p) {
				return apigateway.Error(apierrors.Validation("invalid permission: " + p)), nil
			}
		}
	}

	updated, err := users.Update(ctx, id, in)
	if err != nil {
		return apigateway.Error(err), nil
	}

	return apigateway.Success(http.StatusOK, updated), nil
}

func main() {
	lambda.Start(handler)
}
