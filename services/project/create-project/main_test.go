package main

import (
	"context"
	"testing"

	"github.com/aws/aws-lambda-go/events"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/folder"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/models/user"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
)

type fakeUsers struct{}

func (fakeUsers) GetByID(_ context.Context, id string) (*user.User, error) {
	return &user.User{ID: id, Status: user.StatusActive, Role: user.RoleMember}, nil
}

type fakeMembers map[string]workspace.Role

func (f fakeMembers) Get(_ context.Context, workspaceID, userID string) (*workspace.Membership, error) {
	if role, ok := f[workspaceID+"/"+userID]; ok {
		return &workspace.Membership{WorkspaceID: workspaceID, UserID: userID, Role: role}, nil
	}
	return nil, apierrors.NotFound("member")
}

type fakeProjects struct{ created []*project.Project }

func (f *fakeProjects) Create(_ context.Context, p *project.Project) error {
	f.created = append(f.created, p)
	return nil
}

type fakeFolders struct{}

func (fakeFolders) List(_ context.Context, workspaceID string) ([]folder.Folder, error) {
	if workspaceID == "acme" {
		return []folder.Folder{{WorkspaceID: "acme", ID: "ours"}}, nil
	}
	return []folder.Folder{{WorkspaceID: workspaceID, ID: "theirs"}}, nil
}

func TestCreateProject(t *testing.T) {
	cases := []struct {
		name, caller, body string
		status             int
	}{
		{"editor creates", "editor", `{"name":"API","region":"us-east-1"}`, 201},
		{"in a folder of this workspace", "editor", `{"name":"API","region":"us-east-1","folderId":"ours"}`, 201},
		{"in a folder of another workspace", "editor", `{"name":"API","region":"us-east-1","folderId":"theirs"}`, 400},
		{"blank name", "editor", `{"name":" ","region":"us-east-1"}`, 400},
		{"invalid region", "editor", `{"name":"API","region":"mars"}`, 400},
		{"operator cannot create", "operator", `{"name":"API","region":"us-east-1"}`, 403},
		{"someone outside the workspace", "rival", `{"name":"API","region":"us-east-1"}`, 404},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			p := &fakeProjects{}
			users, projects, folders = fakeUsers{}, p, fakeFolders{}
			members = fakeMembers{"acme/editor": workspace.RoleEditor, "acme/operator": workspace.RoleOperator}
			res, err := handler(context.Background(), events.APIGatewayProxyRequest{
				Body:           c.body,
				PathParameters: map[string]string{"workspaceId": "acme"},
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
			if c.status == 201 {
				got := p.created[0]
				if got.WorkspaceID != "acme" || got.CreatedBy != "editor" || got.Status != project.StatusDraft || got.Environment != project.DefaultEnvironment {
					t.Fatalf("project = %+v", got)
				}
			}
		})
	}
}
