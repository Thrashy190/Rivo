package main

import (
	"context"
	"testing"

	"github.com/aws/aws-lambda-go/events"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/user"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
)

type fakeUsers struct{}

func (fakeUsers) GetByID(_ context.Context, id string) (*user.User, error) {
	return &user.User{ID: id, Status: user.StatusActive, Role: user.RoleMember}, nil
}

type fakeMembers map[string]*workspace.Membership

func (f fakeMembers) Get(_ context.Context, workspaceID, userID string) (*workspace.Membership, error) {
	if m, ok := f[workspaceID+"/"+userID]; ok {
		return m, nil
	}
	return nil, apierrors.NotFound("member")
}

func (f fakeMembers) Delete(_ context.Context, workspaceID, userID string) error {
	delete(f, workspaceID+"/"+userID)
	return nil
}

func TestRemoveMember(t *testing.T) {
	seed := func() fakeMembers {
		return fakeMembers{
			"acme/owner":   {WorkspaceID: "acme", UserID: "owner", Role: workspace.RoleOwner},
			"acme/second":  {WorkspaceID: "acme", UserID: "second", Role: workspace.RoleOwner},
			"acme/editor":  {WorkspaceID: "acme", UserID: "editor", Role: workspace.RoleEditor},
			"globex/rival": {WorkspaceID: "globex", UserID: "rival", Role: workspace.RoleOwner},
		}
	}
	cases := []struct {
		name   string
		caller string
		ws     string
		target string
		status int
	}{
		{"owner removes an editor", "owner", "acme", "editor", 204},
		{"owner cannot remove another owner", "owner", "acme", "second", 403},
		{"owner cannot remove themselves", "owner", "acme", "owner", 403},
		{"editor cannot remove anyone", "editor", "acme", "owner", 403},
		{"owner of another workspace cannot touch this one", "rival", "acme", "editor", 404},
		{"a member of another workspace is not found here", "owner", "acme", "rival", 404},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			m := seed()
			users, members = fakeUsers{}, m
			res, err := handler(context.Background(), events.APIGatewayProxyRequest{
				PathParameters: map[string]string{"workspaceId": c.ws, "userId": c.target},
				RequestContext: events.APIGatewayProxyRequestContext{
					Authorizer: map[string]any{"claims": map[string]any{"sub": c.caller}},
				},
			})
			if err != nil {
				t.Fatal(err)
			}
			if res.StatusCode != c.status {
				t.Fatalf("status = %d, want %d, body = %s", res.StatusCode, c.status, res.Body)
			}
			if _, stillThere := m[c.ws+"/"+c.target]; c.status == 204 && stillThere {
				t.Fatal("member was not removed")
			}
		})
	}
}
