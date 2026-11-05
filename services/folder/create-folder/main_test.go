package main

import (
	"context"
	"testing"

	"github.com/aws/aws-lambda-go/events"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/folder"
	"github.com/Thrashy190/Rivo/services/shared/models/user"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
)

type fakeUsers struct{}

func (fakeUsers) GetByID(_ context.Context, id string) (*user.User, error) {
	return &user.User{ID: id, Status: user.StatusActive, Role: user.RoleMember}, nil
}

type fakeMembers struct{}

func (fakeMembers) Get(_ context.Context, workspaceID, userID string) (*workspace.Membership, error) {
	if workspaceID == "acme" && userID == "alice" {
		return &workspace.Membership{WorkspaceID: "acme", UserID: "alice", Role: workspace.RoleEditor}, nil
	}
	return nil, apierrors.NotFound("member")
}

type fakeFolders []folder.Folder

func (f fakeFolders) Create(context.Context, *folder.Folder) error { return nil }

func (f fakeFolders) List(_ context.Context, workspaceID string) ([]folder.Folder, error) {
	list := []folder.Folder{}
	for _, item := range f {
		if item.WorkspaceID == workspaceID {
			list = append(list, item)
		}
	}
	return list, nil
}

func TestParentMustBelongToTheSameWorkspace(t *testing.T) {
	users, members = fakeUsers{}, fakeMembers{}
	folders = fakeFolders{
		{WorkspaceID: "acme", ID: "ours"},
		{WorkspaceID: "globex", ID: "theirs"},
	}
	cases := []struct {
		name   string
		body   string
		status int
	}{
		{"no parent", `{"name":"Networking"}`, 201},
		{"parent in this workspace", `{"name":"Networking","parentId":"ours"}`, 201},
		{"parent in another workspace", `{"name":"Networking","parentId":"theirs"}`, 400},
		{"blank name", `{"name":"   "}`, 400},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			res, err := handler(context.Background(), events.APIGatewayProxyRequest{
				Body:           c.body,
				PathParameters: map[string]string{"workspaceId": "acme"},
				RequestContext: events.APIGatewayProxyRequestContext{
					Authorizer: map[string]any{"claims": map[string]any{"sub": "alice"}},
				},
			})
			if err != nil {
				t.Fatal(err)
			}
			if res.StatusCode != c.status {
				t.Fatalf("status = %d, want %d, body = %s", res.StatusCode, c.status, res.Body)
			}
		})
	}
}
