package main

import (
	"context"
	"strings"
	"testing"

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

type fakeProjects struct{ touched int }

func (f *fakeProjects) GetByID(_ context.Context, workspaceID, id string) (*project.Project, error) {
	if workspaceID == "acme" && id == "ours" {
		return &project.Project{WorkspaceID: "acme", ID: "ours"}, nil
	}
	return nil, apierrors.NotFound("project")
}

func (f *fakeProjects) Touch(context.Context, string, string) error {
	f.touched++
	return nil
}

type fakeDiagrams struct {
	key, ifMatch string
	ifAbsent     bool
	saves        int
}

func (f *fakeDiagrams) Put(_ context.Context, key string, _ []byte, ifMatch string, ifAbsent bool) (string, error) {
	f.key, f.ifMatch, f.ifAbsent = key, ifMatch, ifAbsent
	if ifMatch == "stale" {
		return "", apierrors.Conflict("the diagram changed since you opened it")
	}
	f.saves++
	return "new-etag", nil
}

const validDiagram = `{"version":"canvas/1","nodes":[],"edges":[]}`

func TestSaveDraft(t *testing.T) {
	cases := []struct {
		name, caller, ws, project, body string
		headers                         map[string]string
		status, saves                   int
	}{
		{"editor saves", "editor", "acme", "ours", validDiagram, nil, 200, 1},
		{"viewer cannot save", "viewer", "acme", "ours", validDiagram, nil, 403, 0},
		{"platform admin can only read", "platform", "acme", "ours", validDiagram, nil, 403, 0},
		{"member of another workspace cannot see it", "rival", "acme", "ours", validDiagram, nil, 404, 0},
		{"a project from another workspace is not found", "rival", "globex", "ours", validDiagram, nil, 404, 0},
		{"invalid diagram", "editor", "acme", "ours", `{"nodes":[]}`, nil, 400, 0},
		{"too large", "editor", "acme", "ours", strings.Repeat("x", project.MaxDiagramBytes+1), nil, 400, 0},
		{"stale copy", "editor", "acme", "ours", validDiagram, map[string]string{"if-match": `"stale"`}, 409, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			users = fakeUsers{
				"editor":   {ID: "editor", Status: user.StatusActive, Role: user.RoleMember},
				"viewer":   {ID: "viewer", Status: user.StatusActive, Role: user.RoleMember},
				"rival":    {ID: "rival", Status: user.StatusActive, Role: user.RoleMember},
				"platform": {ID: "platform", Status: user.StatusActive, Role: user.RoleAdmin},
			}
			members = fakeMembers{"acme/editor": workspace.RoleEditor, "acme/viewer": workspace.RoleViewer, "globex/rival": workspace.RoleOwner}
			p, d := &fakeProjects{}, &fakeDiagrams{}
			projects, diagrams = p, d
			res, err := handler(context.Background(), events.APIGatewayProxyRequest{
				Body:           c.body,
				Headers:        c.headers,
				PathParameters: map[string]string{"workspaceId": c.ws, "projectId": c.project},
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
			if d.saves != c.saves {
				t.Fatalf("saves = %d, want %d", d.saves, c.saves)
			}
			if c.saves == 1 && (p.touched != 1 || d.key != "workspaces/acme/projects/ours/draft.json") {
				t.Fatalf("touched = %d, key = %s", p.touched, d.key)
			}
		})
	}
}

func TestConditionHeadersReachStorage(t *testing.T) {
	users = fakeUsers{"editor": {ID: "editor", Status: user.StatusActive, Role: user.RoleMember}}
	members = fakeMembers{"acme/editor": workspace.RoleEditor}
	d := &fakeDiagrams{}
	projects, diagrams = &fakeProjects{}, d
	request := func(headers map[string]string) {
		t.Helper()
		if _, err := handler(context.Background(), events.APIGatewayProxyRequest{
			Body:           validDiagram,
			Headers:        headers,
			PathParameters: map[string]string{"workspaceId": "acme", "projectId": "ours"},
			RequestContext: events.APIGatewayProxyRequestContext{
				Authorizer: map[string]any{"claims": map[string]any{"sub": "editor"}},
			},
		}); err != nil {
			t.Fatal(err)
		}
	}

	request(map[string]string{"If-Match": `"abc"`})
	if d.ifMatch != "abc" || d.ifAbsent {
		t.Fatalf("If-Match: %q, %v", d.ifMatch, d.ifAbsent)
	}
	request(map[string]string{"if-none-match": "*"})
	if d.ifMatch != "" || !d.ifAbsent {
		t.Fatalf("If-None-Match: %q, %v", d.ifMatch, d.ifAbsent)
	}
}
