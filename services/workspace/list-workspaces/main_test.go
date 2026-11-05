package main

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/aws/aws-lambda-go/events"

	"github.com/Thrashy190/Rivo/services/shared/models/user"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
)

type fakeUsers map[string]*user.User

func (f fakeUsers) GetByID(_ context.Context, id string) (*user.User, error) {
	return f[id], nil
}

type fakeMembers []workspace.Membership

func (f fakeMembers) ListByUser(_ context.Context, userID string) ([]workspace.Membership, error) {
	list := []workspace.Membership{}
	for _, m := range f {
		if m.UserID == userID {
			list = append(list, m)
		}
	}
	return list, nil
}

type fakeWorkspaces []workspace.Workspace

func (f fakeWorkspaces) GetMany(_ context.Context, ids []string) ([]workspace.Workspace, error) {
	list := []workspace.Workspace{}
	for _, w := range f {
		for _, id := range ids {
			if w.ID == id {
				list = append(list, w)
			}
		}
	}
	return list, nil
}

func (f fakeWorkspaces) List(context.Context) ([]workspace.Workspace, error) { return f, nil }

func TestWhoSeesWhichWorkspaces(t *testing.T) {
	users = fakeUsers{
		"platform": {ID: "platform", Status: user.StatusActive, Role: user.RoleAdmin},
		"alice":    {ID: "alice", Status: user.StatusActive, Role: user.RoleMember},
	}
	members = fakeMembers{
		{WorkspaceID: "acme", UserID: "alice", Role: workspace.RoleOwner},
		{WorkspaceID: "globex", UserID: "platform", Role: workspace.RoleOwner},
	}
	workspaces = fakeWorkspaces{{ID: "acme"}, {ID: "globex"}}

	cases := []struct {
		caller string
		want   map[string]workspace.Role
	}{
		{"alice", map[string]workspace.Role{"acme": workspace.RoleOwner}},
		{"platform", map[string]workspace.Role{"acme": workspace.RoleViewer, "globex": workspace.RoleOwner}},
	}
	for _, c := range cases {
		t.Run(c.caller, func(t *testing.T) {
			res, err := handler(context.Background(), events.APIGatewayProxyRequest{
				RequestContext: events.APIGatewayProxyRequestContext{
					Authorizer: map[string]any{"claims": map[string]any{"sub": c.caller}},
				},
			})
			if err != nil {
				t.Fatal(err)
			}
			var got []workspace.Summary
			if err := json.Unmarshal([]byte(res.Body), &got); err != nil {
				t.Fatal(err)
			}
			if len(got) != len(c.want) {
				t.Fatalf("got %+v", got)
			}
			for _, s := range got {
				if c.want[s.ID] != s.Role {
					t.Errorf("%s: role %s, want %s", s.ID, s.Role, c.want[s.ID])
				}
			}
		})
	}
}
