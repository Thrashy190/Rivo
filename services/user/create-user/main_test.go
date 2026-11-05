package main

import (
	"context"
	"testing"

	"github.com/aws/aws-lambda-go/events"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/user"
)

type fakeUsers map[string]*user.User

func (f fakeUsers) GetByID(_ context.Context, id string) (*user.User, error) {
	if u, ok := f[id]; ok {
		return u, nil
	}
	return nil, apierrors.NotFound("user")
}

func (f fakeUsers) Create(context.Context, *user.User) error { return nil }

// The check runs before Cognito, so a rejected request never creates an account.
func TestUserManagerCannotCreateAdmins(t *testing.T) {
	users = fakeUsers{
		"manager": {ID: "manager", Status: user.StatusActive, Role: user.RoleMember, Permissions: []string{user.PermUsersManage}},
	}
	for _, body := range []string{
		`{"email":"new@rivo.test","role":"admin"}`,
		`{"email":"new@rivo.test","role":"member","permissions":["*"]}`,
		`{"email":"new@rivo.test","role":"member","permissions":["workspaces:create"]}`,
	} {
		res, err := handler(context.Background(), events.APIGatewayProxyRequest{
			Body: body,
			RequestContext: events.APIGatewayProxyRequestContext{
				Authorizer: map[string]any{"claims": map[string]any{"sub": "manager"}},
			},
		})
		if err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != 403 {
			t.Errorf("%s: status = %d, want 403", body, res.StatusCode)
		}
	}
}
