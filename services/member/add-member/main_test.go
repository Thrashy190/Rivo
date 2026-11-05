package main

import (
	"context"
	"encoding/json"
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

type fakeMembers map[string]*workspace.Membership

func (f fakeMembers) Get(_ context.Context, workspaceID, userID string) (*workspace.Membership, error) {
	if m, ok := f[workspaceID+"/"+userID]; ok {
		return m, nil
	}
	return nil, apierrors.NotFound("member")
}

func (f fakeMembers) Create(_ context.Context, m *workspace.Membership) error {
	key := m.WorkspaceID + "/" + m.UserID
	if _, exists := f[key]; exists {
		return apierrors.Conflict("this user is already a member of the workspace")
	}
	f[key] = m
	return nil
}

type fakeDirectory struct{ invited []string }

func (f *fakeDirectory) EnsureUser(_ context.Context, email string) (string, error) {
	f.invited = append(f.invited, email)
	return "sub-" + email, nil
}

func setup() (fakeUsers, fakeMembers, *fakeDirectory) {
	u := fakeUsers{
		"owner":             {ID: "owner", Email: "owner@acme.test", Status: user.StatusActive, Role: user.RoleMember},
		"admin":             {ID: "admin", Email: "admin@acme.test", Status: user.StatusActive, Role: user.RoleMember},
		"viewer":            {ID: "viewer", Email: "viewer@acme.test", Status: user.StatusActive, Role: user.RoleMember},
		"sub-off@acme.test": {ID: "sub-off@acme.test", Status: user.StatusDisabled, Role: user.RoleMember},
	}
	m := fakeMembers{
		"acme/owner":  {WorkspaceID: "acme", UserID: "owner", Role: workspace.RoleOwner},
		"acme/viewer": {WorkspaceID: "acme", UserID: "viewer", Role: workspace.RoleViewer},
	}
	d := &fakeDirectory{}
	users, members, people = u, m, d
	return u, m, d
}

func invite(t *testing.T, sub, workspaceID, email string, role workspace.Role) events.APIGatewayProxyResponse {
	t.Helper()
	body, _ := json.Marshal(workspace.AddMemberInput{Email: email, Role: role})
	res, err := handler(context.Background(), events.APIGatewayProxyRequest{
		Body:           string(body),
		PathParameters: map[string]string{"workspaceId": workspaceID},
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{"claims": map[string]any{"sub": sub}},
		},
	})
	if err != nil {
		t.Fatalf("handler returned an error: %v", err)
	}
	return res
}

func TestNewPersonGetsAnAccountWithNoPlatformPermissions(t *testing.T) {
	u, m, d := setup()

	res := invite(t, "owner", "acme", " New@Acme.Test ", workspace.RoleEditor)
	if res.StatusCode != 201 {
		t.Fatalf("status = %d, body = %s", res.StatusCode, res.Body)
	}
	if len(d.invited) != 1 || d.invited[0] != "new@acme.test" {
		t.Fatalf("invited = %v", d.invited)
	}
	created := u["sub-new@acme.test"]
	if created == nil || created.Role != user.RoleMember || created.Has(user.PermWorkspacesCreate) || created.Has(user.PermProjectsRead) {
		t.Fatalf("invited user has platform access: %+v", created)
	}
	if m["acme/sub-new@acme.test"].Role != workspace.RoleEditor {
		t.Fatal("membership was not created with the requested role")
	}
}

func TestInvitationsAreRejected(t *testing.T) {
	cases := []struct {
		name   string
		caller string
		ws     string
		email  string
		role   workspace.Role
		status int
	}{
		{"viewer cannot invite", "viewer", "acme", "new@acme.test", workspace.RoleViewer, 403},
		{"an owner cannot create another owner", "owner", "acme", "new@acme.test", workspace.RoleOwner, 403},
		{"the old admin role no longer exists", "owner", "acme", "new@acme.test", workspace.Role("admin"), 400},
		{"nobody outside the workspace can invite", "owner", "globex", "new@acme.test", workspace.RoleViewer, 404},
		{"invalid role", "owner", "acme", "new@acme.test", workspace.Role("root"), 400},
		{"invalid email", "owner", "acme", "not-an-email", workspace.RoleViewer, 400},
		{"disabled account", "owner", "acme", "off@acme.test", workspace.RoleViewer, 409},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			setup()
			if res := invite(t, c.caller, c.ws, c.email, c.role); res.StatusCode != c.status {
				t.Fatalf("status = %d, want %d, body = %s", res.StatusCode, c.status, res.Body)
			}
		})
	}
}

func TestSamePersonCannotBeAddedTwice(t *testing.T) {
	setup()
	if res := invite(t, "owner", "acme", "new@acme.test", workspace.RoleViewer); res.StatusCode != 201 {
		t.Fatalf("first invitation: %d", res.StatusCode)
	}
	if res := invite(t, "owner", "acme", "new@acme.test", workspace.RoleViewer); res.StatusCode != 409 {
		t.Fatalf("second invitation: %d", res.StatusCode)
	}
}
