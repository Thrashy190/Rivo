// Package authz resuelve quién llama y si puede hacer la acción pedida.
//
// El authorizer de Cognito en API Gateway ya validó la firma del JWT antes
// de que el lambda corra, así que acá no se verifica ningún token: solo se
// leen los claims y se busca al usuario en la tabla users, que es la fuente
// de verdad de los permisos (así un cambio del admin aplica al instante,
// sin esperar a que el token se renueve).
package authz

import (
	"context"
	"errors"

	"github.com/aws/aws-lambda-go/events"

	apierrors "github.com/rivo-api/shared/errors"
	"github.com/rivo-api/shared/models/user"
)

type UserLoader interface {
	GetByID(ctx context.Context, id string) (*user.User, error)
}

type Identity struct {
	Sub   string
	Email string
}

func IdentityFrom(req events.APIGatewayProxyRequest) (Identity, error) {
	claims, ok := req.RequestContext.Authorizer["claims"].(map[string]any)
	if !ok {
		return Identity{}, apierrors.Unauthorized("missing authentication claims")
	}

	sub, _ := claims["sub"].(string)
	if sub == "" {
		return Identity{}, apierrors.Unauthorized("missing subject claim")
	}

	email, _ := claims["email"].(string)
	return Identity{Sub: sub, Email: email}, nil
}

// Caller devuelve el usuario que hace el request, ya validado como activo,
// sin exigirle ningún permiso puntual (lo que necesita GET /users/me).
func Caller(ctx context.Context, loader UserLoader, req events.APIGatewayProxyRequest) (*user.User, error) {
	id, err := IdentityFrom(req)
	if err != nil {
		return nil, err
	}

	u, err := loader.GetByID(ctx, id.Sub)
	if err != nil {
		// Token válido pero sin fila en la tabla = existe en Cognito y
		// todavía no tiene accesos asignados: es 403, no 404.
		if apiErr, ok := errors.AsType[*apierrors.ApiError](err); ok && apiErr.Code == apierrors.CodeNotFound {
			return nil, apierrors.Forbidden("user has no access assigned")
		}
		return nil, err
	}

	if !u.IsActive() {
		return nil, apierrors.Forbidden("user is disabled")
	}

	return u, nil
}

// Require es el guard que usa cada handler protegido: devuelve el usuario
// o un ApiError listo para responder (401 si no hay identidad, 403 si le
// falta el permiso).
func Require(ctx context.Context, loader UserLoader, req events.APIGatewayProxyRequest, perm string) (*user.User, error) {
	u, err := Caller(ctx, loader, req)
	if err != nil {
		return nil, err
	}

	if !u.Has(perm) {
		return nil, apierrors.Forbidden("missing permission: " + perm)
	}

	return u, nil
}
