package main

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
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
	if workspaceID == "acme" && (id == "ours" || id == "empty") {
		return &project.Project{WorkspaceID: "acme", ID: id, Name: "Demo Shop", Region: "eu-west-1"}, nil
	}
	return nil, apierrors.NotFound("project")
}

const pkgID = "0b8c7f5e-2d3a-4b1c-9e8f-7a6b5c4d3e2f"

const draft = `{"version":"canvas/1","nodes":[
 {"id":"a","type":"api-gateway","config":{"name":"api"}},
 {"id":"b","type":"lambda","config":{"name":"fn","runtime":"nodejs22.x","source":"package","package":{"id":"` + pkgID + `","name":"fn.zip"}}}
],"edges":[{"id":"e","sourceId":"a","targetId":"b","config":{"method":"GET","path":"/"}}]}`

type fakeFiles struct {
	objects map[string][]byte
	put     map[string][]byte
	name    string
}

func (f *fakeFiles) Get(_ context.Context, key string) ([]byte, string, error) {
	if b, ok := f.objects[key]; ok {
		return b, "etag", nil
	}
	return nil, "", apierrors.NotFound("diagram")
}

func (f *fakeFiles) PutFile(_ context.Context, key string, body []byte, _ string) error {
	f.put[key] = body
	return nil
}

func (f *fakeFiles) PresignDownload(_ context.Context, _, fileName string, _ time.Duration) (string, error) {
	f.name = fileName
	return "https://bucket.s3.amazonaws.com/signed", nil
}

func setup() *fakeFiles {
	users = fakeUsers{
		"viewer": {ID: "viewer", Status: user.StatusActive, Role: user.RoleMember},
		"rival":  {ID: "rival", Status: user.StatusActive, Role: user.RoleMember},
	}
	members = fakeMembers{"acme/viewer": workspace.RoleViewer, "globex/rival": workspace.RoleOwner}
	projects = fakeProjects{}
	f := &fakeFiles{
		objects: map[string][]byte{
			"workspaces/acme/projects/ours/draft.json":                 []byte(draft),
			"workspaces/acme/projects/ours/packages/" + pkgID + ".zip": []byte("PK-fake"),
		},
		put: map[string][]byte{},
	}
	files = f
	return f
}

func request(caller, workspaceID, projectID string) events.APIGatewayProxyRequest {
	return events.APIGatewayProxyRequest{
		PathParameters: map[string]string{"workspaceId": workspaceID, "projectId": projectID},
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{"claims": map[string]any{"sub": caller}},
		},
	}
}

func TestViewerExportsTheDraft(t *testing.T) {
	f := setup()
	res, _ := handler(context.Background(), request("viewer", "acme", "ours"))
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status %d: %s", res.StatusCode, res.Body)
	}
	var out exportOutput
	if err := json.Unmarshal([]byte(res.Body), &out); err != nil {
		t.Fatal(err)
	}
	if out.FileName != "demo-shop-terraform.zip" || f.name != out.FileName || !out.Preview {
		t.Errorf("unexpected output: %+v", out)
	}

	archive := f.put["workspaces/acme/projects/ours/exports/terraform.zip"]
	zr, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]string{}
	for _, zf := range zr.File {
		r, _ := zf.Open()
		b, _ := io.ReadAll(r)
		got[zf.Name] = string(b)
	}
	if got["demo-shop-terraform/packages/fn.zip"] != "PK-fake" {
		t.Errorf("the package is not in the zip: %v", keys(got))
	}
	if !strings.Contains(got["demo-shop-terraform/variables.tf"], `default     = "eu-west-1"`) {
		t.Errorf("the project's region is not the default:\n%s", got["demo-shop-terraform/variables.tf"])
	}
}

func TestOtherWorkspacesCannotExport(t *testing.T) {
	setup()
	res, _ := handler(context.Background(), request("rival", "acme", "ours"))
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("a member of another workspace got %d", res.StatusCode)
	}
	// Their own workspace does not have the project either.
	res, _ = handler(context.Background(), request("rival", "globex", "ours"))
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("got %d for a project of another workspace", res.StatusCode)
	}
}

func TestUnsavedProject(t *testing.T) {
	setup()
	res, _ := handler(context.Background(), request("viewer", "acme", "empty"))
	if res.StatusCode != http.StatusBadRequest || !strings.Contains(res.Body, "save the diagram") {
		t.Fatalf("got %d: %s", res.StatusCode, res.Body)
	}
}

func TestMissingPackageIsAWarning(t *testing.T) {
	f := setup()
	delete(f.objects, "workspaces/acme/projects/ours/packages/"+pkgID+".zip")
	res, _ := handler(context.Background(), request("viewer", "acme", "ours"))
	if res.StatusCode != http.StatusOK || !strings.Contains(res.Body, "was not found") {
		t.Fatalf("got %d: %s", res.StatusCode, res.Body)
	}
}

func keys(m map[string]string) []string {
	var out []string
	for k := range m {
		out = append(out, k)
	}
	return out
}
