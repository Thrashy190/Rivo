package main

import (
	"context"
	"errors"
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

type recorder struct {
	steps     []string
	failFiles bool
}

func (r *recorder) GetByID(_ context.Context, workspaceID, id string) (*project.Project, error) {
	if workspaceID == "acme" && id == "ours" {
		return &project.Project{WorkspaceID: workspaceID, ID: id}, nil
	}
	return nil, apierrors.NotFound("project")
}

func (r *recorder) Delete(context.Context, string, string) error {
	r.steps = append(r.steps, "project")
	return nil
}

func (r *recorder) DeleteAll(context.Context, string) error {
	r.steps = append(r.steps, "versions")
	return nil
}

func (r *recorder) DeletePrefix(_ context.Context, prefix string) error {
	if r.failFiles {
		return apierrors.Internal(errors.New("s3 is down"))
	}
	r.steps = append(r.steps, prefix)
	return nil
}

func call(t *testing.T, r *recorder, caller, projectID string) int {
	t.Helper()
	users, projects, versions, diagrams = fakeUsers{}, r, r, r
	members = fakeMembers{"acme/owner": workspace.RoleOwner, "acme/operator": workspace.RoleOperator}
	res, err := handler(context.Background(), events.APIGatewayProxyRequest{
		PathParameters: map[string]string{"workspaceId": "acme", "projectId": projectID},
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{"claims": map[string]any{"sub": caller}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	return res.StatusCode
}

func TestDeleteRemovesTheProjectLast(t *testing.T) {
	r := &recorder{}
	if got := call(t, r, "owner", "ours"); got != 204 {
		t.Fatalf("status = %d", got)
	}
	want := []string{"workspaces/acme/projects/ours/", "versions", "project"}
	if len(r.steps) != 3 || r.steps[0] != want[0] || r.steps[1] != want[1] || r.steps[2] != want[2] {
		t.Fatalf("steps = %v", r.steps)
	}
}

func TestFailedDeleteKeepsTheProjectToRetry(t *testing.T) {
	r := &recorder{failFiles: true}
	if got := call(t, r, "owner", "ours"); got != 500 {
		t.Fatalf("status = %d", got)
	}
	if len(r.steps) != 0 {
		t.Fatalf("nothing else may be deleted: %v", r.steps)
	}
}

func TestDeleteIsRejected(t *testing.T) {
	cases := []struct {
		name, caller, project string
		status                int
	}{
		{"operator cannot delete", "operator", "ours", 403},
		{"someone outside the workspace", "rival", "ours", 404},
		{"unknown project", "owner", "theirs", 404},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := &recorder{}
			if got := call(t, r, c.caller, c.project); got != c.status {
				t.Fatalf("status = %d, want %d", got, c.status)
			}
			if len(r.steps) != 0 {
				t.Fatalf("nothing may be deleted: %v", r.steps)
			}
		})
	}
}
