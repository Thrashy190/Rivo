package main

import (
	"context"
	"testing"

	"github.com/aws/aws-lambda-go/events"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/user"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
)

type fakeUsers map[string]*user.User

func (f fakeUsers) GetByID(_ context.Context, id string) (*user.User, error) {
	if u, ok := f[id]; ok {
		return u, nil
	}
	return nil, apierrors.NotFound("user")
}

type fakeMembers map[string]*workspace.Membership

func (f fakeMembers) Get(_ context.Context, workspaceID, userID string) (*workspace.Membership, error) {
	if m, ok := f[workspaceID+"/"+userID]; ok {
		return m, nil
	}
	return nil, apierrors.NotFound("member")
}

func (f fakeMembers) ListByWorkspace(_ context.Context, workspaceID string) ([]workspace.Membership, error) {
	list := []workspace.Membership{}
	for _, m := range f {
		if m.WorkspaceID == workspaceID {
			list = append(list, *m)
		}
	}
	return list, nil
}

func (f fakeMembers) Delete(_ context.Context, workspaceID, userID string) error {
	delete(f, workspaceID+"/"+userID)
	return nil
}

func TestRemoveOwner(t *testing.T) {
	cases := []struct {
		name, caller, target string
		extraOwner           bool
		status               int
	}{
		{"platform admin removes one of two owners", "platform", "owner", true, 204},
		{"the last owner cannot be removed", "platform", "owner", false, 409},
		{"a non-owner is not handled here", "platform", "editor", true, 409},
		{"a workspace owner cannot remove an owner", "owner", "second", true, 403},
		{"unknown member", "platform", "nobody", true, 404},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			m := fakeMembers{
				"acme/owner":  {WorkspaceID: "acme", UserID: "owner", Role: workspace.RoleOwner},
				"acme/editor": {WorkspaceID: "acme", UserID: "editor", Role: workspace.RoleEditor},
			}
			if c.extraOwner {
				m["acme/second"] = &workspace.Membership{WorkspaceID: "acme", UserID: "second", Role: workspace.RoleOwner}
			}
			users = fakeUsers{
				"platform": {ID: "platform", Status: user.StatusActive, Role: user.RoleAdmin},
				"owner":    {ID: "owner", Status: user.StatusActive, Role: user.RoleMember},
			}
			members = m
			res, err := handler(context.Background(), events.APIGatewayProxyRequest{
				PathParameters: map[string]string{"workspaceId": "acme", "userId": c.target},
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
		})
	}
}
