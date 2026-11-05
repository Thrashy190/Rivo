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

func (f fakeUsers) Create(_ context.Context, u *user.User) error {
	f[u.ID] = u
	return nil
}

type fakeWorkspaces struct{}

func (fakeWorkspaces) GetByID(_ context.Context, id string) (*workspace.Workspace, error) {
	if id == "acme" {
		return &workspace.Workspace{ID: "acme"}, nil
	}
	return nil, apierrors.NotFound("workspace")
}

type fakeMembers map[string]*workspace.Membership

func (f fakeMembers) Get(_ context.Context, workspaceID, userID string) (*workspace.Membership, error) {
	if m, ok := f[workspaceID+"/"+userID]; ok {
		return m, nil
	}
	return nil, apierrors.NotFound("member")
}

func (f fakeMembers) Create(_ context.Context, m *workspace.Membership) error {
	f[m.WorkspaceID+"/"+m.UserID] = m
	return nil
}

func (f fakeMembers) UpdateRole(_ context.Context, workspaceID, userID string, role workspace.Role) (*workspace.Membership, error) {
	m := f[workspaceID+"/"+userID]
	m.Role = role
	return m, nil
}

type fakeDirectory struct{}

func (fakeDirectory) EnsureUser(_ context.Context, email string) (string, error) {
	return "sub-" + email, nil
}

func call(t *testing.T, sub, workspaceID, body string) int {
	t.Helper()
	res, err := handler(context.Background(), events.APIGatewayProxyRequest{
		Body:           body,
		PathParameters: map[string]string{"workspaceId": workspaceID},
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{"claims": map[string]any{"sub": sub}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	return res.StatusCode
}

func setup() fakeMembers {
	m := fakeMembers{
		"acme/owner":                {WorkspaceID: "acme", UserID: "owner", Role: workspace.RoleOwner},
		"acme/sub-editor@acme.test": {WorkspaceID: "acme", UserID: "sub-editor@acme.test", Role: workspace.RoleEditor},
	}
	users = fakeUsers{
		"platform": {ID: "platform", Status: user.StatusActive, Role: user.RoleAdmin},
		"owner":    {ID: "owner", Status: user.StatusActive, Role: user.RoleMember},
	}
	workspaces, members, people = fakeWorkspaces{}, m, fakeDirectory{}
	return m
}

func TestOnlyPlatformAdminsCreateOwners(t *testing.T) {
	cases := []struct {
		name, caller, workspace string
		status                  int
	}{
		{"platform admin", "platform", "acme", 201},
		{"workspace owner cannot create another owner", "owner", "acme", 403},
		{"missing workspace", "platform", "globex", 404},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			setup()
			if got := call(t, c.caller, c.workspace, `{"email":"new@acme.test"}`); got != c.status {
				t.Fatalf("status = %d, want %d", got, c.status)
			}
		})
	}
}

func TestExistingMemberIsPromoted(t *testing.T) {
	m := setup()
	if got := call(t, "platform", "acme", `{"email":"editor@acme.test"}`); got != 201 {
		t.Fatalf("status = %d", got)
	}
	if m["acme/sub-editor@acme.test"].Role != workspace.RoleOwner {
		t.Fatal("the member was not promoted to owner")
	}
}
