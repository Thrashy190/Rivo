// Package authz resolves who is calling and whether they can do what they asked.
//
// The Cognito authorizer in API Gateway already validated the JWT signature
// before the Lambda runs, so no token is verified here: it only reads the claims
// and looks up the user in the users table, the source of truth for permissions
// (an admin's change applies immediately, without waiting for a token refresh).
package authz

import (
	"context"
	"errors"

	"github.com/aws/aws-lambda-go/events"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/user"
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

// Caller returns the user making the request, already checked as active,
// without requiring any specific permission (what GET /users/me needs).
func Caller(ctx context.Context, loader UserLoader, req events.APIGatewayProxyRequest) (*user.User, error) {
	id, err := IdentityFrom(req)
	if err != nil {
		return nil, err
	}

	u, err := loader.GetByID(ctx, id.Sub)
	if err != nil {
		// Valid token but no row in the table: the user exists in Cognito and
		// has no access assigned yet. That is a 403, not a 404.
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

// Require is the guard every protected handler uses: it returns the user
// or an ApiError ready to send (401 with no identity, 403 if the permission
// is missing).
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
