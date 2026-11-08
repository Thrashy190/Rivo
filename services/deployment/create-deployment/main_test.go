package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/aws/aws-lambda-go/events"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/connection"
	"github.com/Thrashy190/Rivo/services/shared/models/deployment"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/models/user"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
)

type fakeUsers map[string]*user.User

func (f fakeUsers) GetByID(_ context.Context, id string) (*user.User, error) {
	if u, ok := f[id]; ok {
		return u, nil
	}
	return nil, apierrors.NotFound("user")
}

type fakeMembers map[string]workspace.Role

func (f fakeMembers) Get(_ context.Context, ws, uid string) (*workspace.Membership, error) {
	if r, ok := f[ws+"/"+uid]; ok {
		return &workspace.Membership{WorkspaceID: ws, UserID: uid, Role: r}, nil
	}
	return nil, apierrors.NotFound("member")
}

type fakeProjects struct {
	items  map[string]*project.Project
	locked map[string]string
}

func (f *fakeProjects) GetByID(_ context.Context, ws, id string) (*project.Project, error) {
	if p, ok := f.items[ws+"/"+id]; ok {
		c := *p
		c.ActiveDeployment = f.locked[id]
		return &c, nil
	}
	return nil, apierrors.NotFound("project")
}

func (f *fakeProjects) Lock(_ context.Context, _, id, d, stale string) error {
	if f.locked[id] != stale {
		return apierrors.Conflict("held")
	}
	f.locked[id] = d
	return nil
}

func (f *fakeProjects) Unlock(_ context.Context, _, id, d string, _ *repository.DeploymentResult) error {
	if f.locked[id] == d {
		f.locked[id] = ""
	}
	return nil
}

type fakeDeployments map[string]*deployment.Deployment

func (f fakeDeployments) Create(_ context.Context, d *deployment.Deployment) error {
	f[d.WorkspaceID+"/"+d.ID] = d
	return nil
}

func (f fakeDeployments) Get(_ context.Context, ws, id string) (*deployment.Deployment, error) {
	if d, ok := f[ws+"/"+id]; ok {
		return d, nil
	}
	return nil, apierrors.NotFound("deployment")
}

func (f fakeDeployments) Transition(_ context.Context, ws, id string, _ []string, to string, _ map[string]any) (*deployment.Deployment, error) {
	d := f[ws+"/"+id]
	d.Status = to
	return d, nil
}

type fakeConnections map[string]*connection.Connection

func (f fakeConnections) Get(_ context.Context, ws, id string) (*connection.Connection, error) {
	if c, ok := f[ws+"/"+id]; ok {
		return c, nil
	}
	return nil, apierrors.NotFound("connection")
}

type fakeFiles map[string][]byte

func (f fakeFiles) Get(_ context.Context, key string) ([]byte, string, error) {
	if b, ok := f[key]; ok {
		return b, "", nil
	}
	return nil, "", apierrors.NotFound("object")
}

func (f fakeFiles) PutFile(_ context.Context, key string, body []byte, _ string) error {
	f[key] = body
	return nil
}

type fakeEngine struct{ started []string }

func (f *fakeEngine) Start(_ context.Context, _, id, phase string) (string, error) {
	f.started = append(f.started, id+"/"+phase)
	return "arn:aws:ecs:task/1", nil
}

const draft = `{"version":"canvas/1","nodes":[{"id":"b","type":"s3","config":{"name":"site"}}],"edges":[]}`

type world struct {
	projects *fakeProjects
	deps     fakeDeployments
	files    fakeFiles
	engine   *fakeEngine
}

func setup() *world {
	users = fakeUsers{
		"editor": {ID: "editor", Email: "e@acme.test", Status: user.StatusActive, Role: user.RoleMember},
		"viewer": {ID: "viewer", Status: user.StatusActive, Role: user.RoleMember},
		"rival":  {ID: "rival", Status: user.StatusActive, Role: user.RoleMember},
	}
	members = fakeMembers{"acme/editor": workspace.RoleEditor, "acme/viewer": workspace.RoleViewer, "globex/rival": workspace.RoleOwner}
	w := &world{
		projects: &fakeProjects{items: map[string]*project.Project{
			"acme/shop":  {WorkspaceID: "acme", ID: "shop", Name: "Shop", Region: "us-east-1"},
			"acme/blank": {WorkspaceID: "acme", ID: "blank", Name: "Blank", Region: "us-east-1"},
			"acme/moved": {WorkspaceID: "acme", ID: "moved", Name: "Moved", Region: "us-east-1", ConnectionID: "prod"},
		}, locked: map[string]string{}},
		deps:   fakeDeployments{},
		files:  fakeFiles{"workspaces/acme/projects/shop/draft.json": []byte(draft), "workspaces/acme/projects/moved/draft.json": []byte(draft)},
		engine: &fakeEngine{},
	}
	projects, deployments, files, runner = w.projects, w.deps, w.files, w.engine
	connections = fakeConnections{
		"acme/dev":      {WorkspaceID: "acme", ID: "dev", Name: "Dev", AccountID: "111111111111", Status: connection.StatusVerified},
		"acme/prod":     {WorkspaceID: "acme", ID: "prod", Name: "Prod", AccountID: "222222222222", Status: connection.StatusVerified},
		"acme/new":      {WorkspaceID: "acme", ID: "new", Name: "New", Status: connection.StatusPending},
		"globex/theirs": {WorkspaceID: "globex", ID: "theirs", Name: "Theirs", AccountID: "333333333333", Status: connection.StatusVerified},
	}
	return w
}

func call(caller, ws, projectID, body string) events.APIGatewayProxyResponse {
	res, _ := handler(context.Background(), events.APIGatewayProxyRequest{
		PathParameters: map[string]string{"workspaceId": ws, "projectId": projectID},
		Body:           body,
		RequestContext: events.APIGatewayProxyRequestContext{Authorizer: map[string]any{"claims": map[string]any{"sub": caller}}},
	})
	return res
}

func TestPlansTheSavedDiagram(t *testing.T) {
	w := setup()
	res := call("editor", "acme", "shop", `{"connectionId":"dev"}`)
	if res.StatusCode != http.StatusAccepted {
		t.Fatalf("status %d: %s", res.StatusCode, res.Body)
	}
	var d deployment.Deployment
	json.Unmarshal([]byte(res.Body), &d)
	if d.AccountID != "111111111111" || d.Action != deployment.ActionDeploy || d.CreatedByEmail != "e@acme.test" {
		t.Errorf("deployment: %+v", d)
	}
	if string(w.files["workspaces/acme/projects/shop/deployments/"+d.ID+"/diagram.json"]) != draft {
		t.Error("the diagram was not copied")
	}
	if w.projects.locked["shop"] != d.ID || len(w.engine.started) != 1 || w.engine.started[0] != d.ID+"/plan" {
		t.Errorf("lock %q, tasks %v", w.projects.locked["shop"], w.engine.started)
	}

	// A second one waits for the first.
	if res := call("editor", "acme", "shop", `{"connectionId":"dev"}`); res.StatusCode != http.StatusConflict {
		t.Errorf("a second deployment got %d", res.StatusCode)
	}
	// Unless the first one finished without releasing the project.
	w.deps["acme/"+d.ID].Status = deployment.StatusFailed
	if res := call("editor", "acme", "shop", `{"connectionId":"dev"}`); res.StatusCode != http.StatusAccepted {
		t.Errorf("taking over a stale lock got %d: %s", res.StatusCode, res.Body)
	}
}

func TestDeployingNeedsPermissionAndStaysInTheWorkspace(t *testing.T) {
	setup()
	cases := []struct {
		caller, ws, project, body string
		want                      int
	}{
		{"viewer", "acme", "shop", `{"connectionId":"dev"}`, http.StatusForbidden},
		{"rival", "acme", "shop", `{"connectionId":"dev"}`, http.StatusNotFound},
		{"rival", "globex", "shop", `{"connectionId":"theirs"}`, http.StatusNotFound},
		{"editor", "acme", "shop", `{"connectionId":"theirs"}`, http.StatusNotFound},
		{"editor", "acme", "shop", `{"connectionId":"new"}`, http.StatusBadRequest},
		{"editor", "acme", "blank", `{"connectionId":"dev"}`, http.StatusBadRequest},
		{"editor", "acme", "shop", `{"connectionId":"dev","action":"nuke"}`, http.StatusBadRequest},
		{"editor", "acme", "moved", `{"connectionId":"dev"}`, http.StatusConflict},
		{"editor", "acme", "shop", `{"action":"destroy"}`, http.StatusBadRequest},
	}
	for _, c := range cases {
		if res := call(c.caller, c.ws, c.project, c.body); res.StatusCode != c.want {
			t.Errorf("%s on %s/%s with %s: got %d, want %d (%s)", c.caller, c.ws, c.project, c.body, res.StatusCode, c.want, res.Body)
		}
	}
}

func TestDestroyUsesTheProjectsAccount(t *testing.T) {
	w := setup()
	res := call("editor", "acme", "moved", `{"action":"destroy"}`)
	if res.StatusCode != http.StatusAccepted || !strings.Contains(res.Body, `"accountId":"222222222222"`) {
		t.Fatalf("status %d: %s", res.StatusCode, res.Body)
	}
	for k := range w.files {
		if strings.Contains(k, "/deployments/") {
			t.Errorf("a destroy copied the diagram: %s", k)
		}
	}
}
