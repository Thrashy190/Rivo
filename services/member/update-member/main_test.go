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

func (f fakeMembers) UpdateRole(_ context.Context, workspaceID, userID string, role workspace.Role) (*workspace.Membership, error) {
	m := f[workspaceID+"/"+userID]
	m.Role = role
	return m, nil
}

func TestUpdateMember(t *testing.T) {
	cases := []struct {
		name, caller, target, body string
		status                     int
	}{
		{"owner changes an editor to viewer", "owner", "editor", `{"role":"viewer"}`, 200},
		{"owner cannot promote anyone to owner", "owner", "editor", `{"role":"owner"}`, 403},
		{"owner cannot demote another owner", "owner", "second", `{"role":"viewer"}`, 403},
		{"editor cannot change roles", "editor", "viewer", `{"role":"editor"}`, 403},
		{"the old admin role no longer exists", "owner", "editor", `{"role":"admin"}`, 400},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			users = fakeUsers{}
			members = fakeMembers{
				"acme/owner":  {WorkspaceID: "acme", UserID: "owner", Role: workspace.RoleOwner},
				"acme/second": {WorkspaceID: "acme", UserID: "second", Role: workspace.RoleOwner},
				"acme/editor": {WorkspaceID: "acme", UserID: "editor", Role: workspace.RoleEditor},
				"acme/viewer": {WorkspaceID: "acme", UserID: "viewer", Role: workspace.RoleViewer},
			}
			res, err := handler(context.Background(), events.APIGatewayProxyRequest{
				Body:           c.body,
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
