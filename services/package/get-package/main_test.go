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

const uploaded = "0b8c7f5e-2d3a-4b1c-9e8f-7a6b5c4d3e2f"

type fakeDownloads struct{ key, name string }

func (f *fakeDownloads) Size(_ context.Context, key string) (int64, error) {
	if key == "workspaces/acme/projects/ours/packages/"+uploaded+".zip" {
		return 2048, nil
	}
	return 0, apierrors.NotFound("file")
}

func (f *fakeDownloads) PresignDownload(_ context.Context, key, fileName string, _ time.Duration) (string, error) {
	f.key, f.name = key, fileName
	return "https://bucket.s3.amazonaws.com/signed", nil
}

func TestGetPackage(t *testing.T) {
	cases := []struct {
		name, caller, workspace, project, pkg, fileName string
		status                                          int
	}{
		{"viewer downloads", "viewer", "acme", "ours", uploaded, "function.zip", 200},
		{"bad file name falls back", "viewer", "acme", "ours", uploaded, "../../etc", 200},
		{"never uploaded", "viewer", "acme", "ours", "1b8c7f5e-2d3a-4b1c-9e8f-7a6b5c4d3e2f", "", 404},
		{"an ID that leaves the project", "viewer", "acme", "ours", "../draft", "", 404},
		{"someone outside the workspace", "rival", "acme", "ours", uploaded, "", 404},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			setup()
			dl := &fakeDownloads{}
			files = dl
			req := request(c.caller, c.workspace, c.project)
			req.PathParameters["packageId"] = c.pkg
			req.QueryStringParameters = map[string]string{"fileName": c.fileName}
			res, err := handler(context.Background(), req)
			if err != nil {
				t.Fatal(err)
			}
			if res.StatusCode != c.status {
				t.Fatalf("status = %d, want %d, body %s", res.StatusCode, c.status, res.Body)
			}
			if c.status != 200 {
				return
			}
			var out project.PackageDownload
			if err := json.Unmarshal([]byte(res.Body), &out); err != nil {
				t.Fatal(err)
			}
			if out.Size != 2048 || out.URL == "" {
				t.Fatalf("answer = %+v", out)
			}
			want := c.fileName
			if c.fileName == "../../etc" {
				want = "package.zip"
			}
			if dl.name != want {
				t.Fatalf("download named %q, want %q", dl.name, want)
			}
		})
	}
}
