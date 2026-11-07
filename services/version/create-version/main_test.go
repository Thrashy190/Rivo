package main

import (
	"context"
	"testing"

	"github.com/aws/aws-lambda-go/events"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
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

type fakeProjects struct{ reserved *int }

func (fakeProjects) GetByID(_ context.Context, workspaceID, id string) (*project.Project, error) {
	if workspaceID == "acme" && (id == "saved" || id == "new") {
		return &project.Project{WorkspaceID: workspaceID, ID: id}, nil
	}
	return nil, apierrors.NotFound("project")
}

func (f fakeProjects) NextVersion(context.Context, string, string) (int, error) {
	*f.reserved++
	return 4, nil
}

type fakeVersions struct{ created []*project.Version }

func (f *fakeVersions) Create(_ context.Context, v *project.Version) error {
	f.created = append(f.created, v)
	return nil
}

type fakeDiagrams struct{ from, to string }

func (f *fakeDiagrams) Exists(_ context.Context, key string) (bool, error) {
	return key != "workspaces/acme/projects/new/draft.json", nil
}

func (f *fakeDiagrams) Copy(_ context.Context, from, to string) error {
	if from == "workspaces/acme/projects/new/draft.json" {
		return apierrors.NotFound("diagram")
	}
	f.from, f.to = from, to
	return nil
}

func TestCreateVersion(t *testing.T) {
	cases := []struct {
		name, caller, project string
		status, created       int
	}{
		{"editor saves a version", "editor", "saved", 201, 1},
		{"nothing saved yet", "editor", "new", 409, 0},
		{"viewer cannot", "viewer", "saved", 403, 0},
		{"unknown project", "editor", "theirs", 404, 0},
		{"someone outside the workspace", "rival", "saved", 404, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			v, d, reserved := &fakeVersions{}, &fakeDiagrams{}, 0
			users, projects, versions, diagrams = fakeUsers{}, fakeProjects{&reserved}, v, d
			members = fakeMembers{"acme/editor": workspace.RoleEditor, "acme/viewer": workspace.RoleViewer}
			res, err := handler(context.Background(), events.APIGatewayProxyRequest{
				Body:           `{"note":"before the migration"}`,
				PathParameters: map[string]string{"workspaceId": "acme", "projectId": c.project},
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
			if len(v.created) != c.created {
				t.Fatalf("created = %d, want %d", len(v.created), c.created)
			}
			// Found on AWS: a version tried before the first save used up
			// number 1, so the first real version was number 2.
			if reserved != c.created {
				t.Fatalf("reserved %d version numbers, want %d", reserved, c.created)
			}
			if c.created == 1 {
				if got := v.created[0]; got.Number != 4 || got.Note != "before the migration" || got.CreatedBy != "editor" {
					t.Fatalf("version = %+v", got)
				}
				if d.to != "workspaces/acme/projects/saved/versions/4.json" {
					t.Fatalf("copied to %s", d.to)
				}
			}
		})
	}
}
