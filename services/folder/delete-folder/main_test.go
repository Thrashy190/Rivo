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

type fakeMembers struct{}

func (fakeMembers) Get(_ context.Context, workspaceID, userID string) (*workspace.Membership, error) {
	if workspaceID == "acme" && userID == "alice" {
		return &workspace.Membership{WorkspaceID: "acme", UserID: "alice", Role: workspace.RoleEditor}, nil
	}
	return nil, apierrors.NotFound("member")
}

type fakeFolders struct{}

func (fakeFolders) List(context.Context, string) ([]folder.Folder, error) {
	return []folder.Folder{{ID: "parent"}, {ID: "child", ParentID: "parent"}, {ID: "with-project"}, {ID: "empty"}}, nil
}

func (fakeFolders) Delete(context.Context, string, string) error { return nil }

type fakeProjects struct{}

func (fakeProjects) List(context.Context, string) ([]project.Project, error) {
	return []project.Project{{ID: "p", FolderID: "with-project"}}, nil
}

func TestOnlyEmptyFoldersCanBeDeleted(t *testing.T) {
	users, members, folders, projects = fakeUsers{}, fakeMembers{}, fakeFolders{}, fakeProjects{}
	cases := map[string]int{"empty": 204, "parent": 409, "with-project": 409}
	for id, want := range cases {
		t.Run(id, func(t *testing.T) {
			res, err := handler(context.Background(), events.APIGatewayProxyRequest{
				PathParameters: map[string]string{"workspaceId": "acme", "folderId": id},
				RequestContext: events.APIGatewayProxyRequestContext{
					Authorizer: map[string]any{"claims": map[string]any{"sub": "alice"}},
				},
			})
			if err != nil {
				t.Fatal(err)
			}
			if res.StatusCode != want {
				t.Fatalf("status = %d, want %d", res.StatusCode, want)
			}
		})
	}
}
