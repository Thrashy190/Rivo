package main

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/aws/aws-lambda-go/events"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/models/user"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/storage"
)

type fakeUsers map[string]*user.User

func (f fakeUsers) GetByID(_ context.Context, id string) (*user.User, error) {
	if u, ok := f[id]; ok {
		return u, nil
	}
	return nil, apierrors.NotFound("user")
}

type fakeMembers map[string]workspace.Role

func (f fakeMembers) Get(_ context.Context, workspaceID, userID string) (*workspace.Membership, error) {
	if role, ok := f[workspaceID+"/"+userID]; ok {
		return &workspace.Membership{WorkspaceID: workspaceID, UserID: userID, Role: role}, nil
	}
	return nil, apierrors.NotFound("member")
}

type fakeProjects struct{}

func (fakeProjects) GetByID(_ context.Context, workspaceID, id string) (*project.Project, error) {
	if workspaceID == "acme" && id == "ours" {
		return &project.Project{WorkspaceID: "acme", ID: "ours"}, nil
	}
	return nil, apierrors.NotFound("project")
}

func setup() {
	users = fakeUsers{
		"editor": {ID: "editor", Status: user.StatusActive, Role: user.RoleMember},
		"viewer": {ID: "viewer", Status: user.StatusActive, Role: user.RoleMember},
		"rival":  {ID: "rival", Status: user.StatusActive, Role: user.RoleMember},
	}
	members = fakeMembers{"acme/editor": workspace.RoleEditor, "acme/viewer": workspace.RoleViewer, "globex/rival": workspace.RoleOwner}
	projects = fakeProjects{}
}

func request(caller, workspaceID, projectID string) events.APIGatewayProxyRequest {
	return events.APIGatewayProxyRequest{
		PathParameters: map[string]string{"workspaceId": workspaceID, "projectId": projectID},
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{"claims": map[string]any{"sub": caller}},
		},
	}
}

type fakeUploads struct {
	key      string
	maxBytes int64
}

func (f *fakeUploads) PresignUpload(_ context.Context, key string, maxBytes int64, _ time.Duration) (*storage.Upload, error) {
	f.key, f.maxBytes = key, maxBytes
	return &storage.Upload{URL: "https://bucket.s3.amazonaws.com", Fields: map[string]string{"key": key}}, nil
}

func TestCreatePackage(t *testing.T) {
	cases := []struct {
		name, caller, workspace, project, body string
		status                                 int
	}{
		{"editor uploads a zip", "editor", "acme", "ours", `{"fileName":"function.zip","size":1024}`, 201},
		{"not a zip", "editor", "acme", "ours", `{"fileName":"function.tar.gz","size":1024}`, 400},
		{"too big", "editor", "acme", "ours", `{"fileName":"function.zip","size":52428801}`, 400},
		{"empty", "editor", "acme", "ours", `{"fileName":"function.zip","size":0}`, 400},
		{"viewer cannot", "viewer", "acme", "ours", `{"fileName":"function.zip","size":1024}`, 403},
		{"unknown project", "editor", "acme", "theirs", `{"fileName":"function.zip","size":1024}`, 404},
		{"someone outside the workspace", "rival", "acme", "ours", `{"fileName":"function.zip","size":1024}`, 404},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			setup()
			up := &fakeUploads{}
			files = up
			newID = func() string { return "0b8c7f5e-2d3a-4b1c-9e8f-7a6b5c4d3e2f" }
			req := request(c.caller, c.workspace, c.project)
			req.Body = c.body
			res, err := handler(context.Background(), req)
			if err != nil {
				t.Fatal(err)
			}
			if res.StatusCode != c.status {
				t.Fatalf("status = %d, want %d, body %s", res.StatusCode, c.status, res.Body)
			}
			if c.status != 201 {
				if up.key != "" {
					t.Fatalf("presigned %s for a refused request", up.key)
				}
				return
			}
			var out project.PackageUpload
			if err := json.Unmarshal([]byte(res.Body), &out); err != nil {
				t.Fatal(err)
			}
			if up.key != "workspaces/acme/projects/ours/packages/0b8c7f5e-2d3a-4b1c-9e8f-7a6b5c4d3e2f.zip" || up.maxBytes != project.MaxPackageBytes {
				t.Fatalf("presigned %s up to %d bytes", up.key, up.maxBytes)
			}
			if out.PackageID == "" || out.URL == "" || out.Fields["key"] != up.key {
				t.Fatalf("answer = %+v", out)
			}
		})
	}
}
