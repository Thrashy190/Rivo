package authz

import (
	"context"
	"errors"
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

func request(sub, workspaceID string) events.APIGatewayProxyRequest {
	return events.APIGatewayProxyRequest{
		PathParameters: map[string]string{"workspaceId": workspaceID},
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{"claims": map[string]any{"sub": sub}},
		},
	}
}

func statusOf(t *testing.T, err error) int {
	t.Helper()
	var apiErr *apierrors.ApiError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected an ApiError, got %v", err)
	}
	return apiErr.StatusCode
}

func TestRequireWorkspace(t *testing.T) {
	users := fakeUsers{
		"alice":    {ID: "alice", Status: user.StatusActive, Role: user.RoleMember},
		"bob":      {ID: "bob", Status: user.StatusActive, Role: user.RoleMember},
		"operator": {ID: "operator", Status: user.StatusActive, Role: user.RoleAdmin},
		"disabled": {ID: "disabled", Status: user.StatusDisabled, Role: user.RoleMember},
	}
	members := fakeMembers{
		"acme/alice":    {WorkspaceID: "acme", UserID: "alice", Role: workspace.RoleEditor},
		"globex/bob":    {WorkspaceID: "globex", UserID: "bob", Role: workspace.RoleViewer},
		"acme/disabled": {WorkspaceID: "acme", UserID: "disabled", Role: workspace.RoleOwner},
	}

	cases := []struct {
		name      string
		sub       string
		workspace string
		perm      string
		status    int
	}{
		{"member with the permission", "alice", "acme", workspace.PermProjectsRead, 0},
		{"member without the permission", "alice", "acme", workspace.PermMembersManage, 403},
		{"member of another workspace cannot see this one", "bob", "acme", workspace.PermProjectsRead, 404},
		{"platform admin can read any workspace", "operator", "acme", workspace.PermProjectsRead, 0},
		{"platform admin cannot change a workspace without a membership", "operator", "acme", workspace.PermProjectsUpdate, 403},
		{"platform admin cannot manage its team without a membership", "operator", "acme", workspace.PermMembersManage, 403},
		{"disabled user keeps no access", "disabled", "acme", workspace.PermProjectsRead, 403},
		{"token with no user row", "ghost", "acme", workspace.PermProjectsRead, 403},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, m, err := RequireWorkspace(context.Background(), users, members, request(c.sub, c.workspace), c.perm)
			if c.status == 0 {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if m.WorkspaceID != c.workspace {
					t.Fatalf("got membership of %q", m.WorkspaceID)
				}
				return
			}
			if got := statusOf(t, err); got != c.status {
				t.Fatalf("status = %d, want %d", got, c.status)
			}
		})
	}
}
