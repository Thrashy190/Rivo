package repository

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/folder"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
)

// These tests need DynamoDB Local (see CONTRIBUTING.md) and skip themselves
// when RIVO_DYNAMODB_ENDPOINT is not set.
func localClient(t *testing.T) *dynamodb.Client {
	t.Helper()
	endpoint := os.Getenv("RIVO_DYNAMODB_ENDPOINT")
	if endpoint == "" {
		t.Skip("RIVO_DYNAMODB_ENDPOINT is not set")
	}
	return dynamodb.New(dynamodb.Options{
		BaseEndpoint: aws.String(endpoint),
		Region:       "us-east-1",
		Credentials:  credentials.NewStaticCredentialsProvider("local", "local", ""),
	})
}

func attr(name string) types.AttributeDefinition {
	return types.AttributeDefinition{AttributeName: aws.String(name), AttributeType: types.ScalarAttributeTypeS}
}

func key(name string, kind types.KeyType) types.KeySchemaElement {
	return types.KeySchemaElement{AttributeName: aws.String(name), KeyType: kind}
}

func createTable(t *testing.T, client *dynamodb.Client, in *dynamodb.CreateTableInput) string {
	t.Helper()
	name := fmt.Sprintf("test-%d", time.Now().UnixNano())
	in.TableName = aws.String(name)
	in.BillingMode = types.BillingModePayPerRequest
	if _, err := client.CreateTable(context.Background(), in); err != nil {
		t.Fatalf("create table: %v", err)
	}
	t.Cleanup(func() {
		_, _ = client.DeleteTable(context.Background(), &dynamodb.DeleteTableInput{TableName: aws.String(name)})
	})
	return name
}

func membershipsTable(t *testing.T, client *dynamodb.Client) string {
	return createTable(t, client, &dynamodb.CreateTableInput{
		AttributeDefinitions: []types.AttributeDefinition{attr("workspace_id"), attr("user_id")},
		KeySchema:            []types.KeySchemaElement{key("workspace_id", types.KeyTypeHash), key("user_id", types.KeyTypeRange)},
		GlobalSecondaryIndexes: []types.GlobalSecondaryIndex{{
			IndexName:  aws.String(membersByUserIndex),
			KeySchema:  []types.KeySchemaElement{key("user_id", types.KeyTypeHash), key("workspace_id", types.KeyTypeRange)},
			Projection: &types.Projection{ProjectionType: types.ProjectionTypeAll},
		}},
	})
}

func workspacesTable(t *testing.T, client *dynamodb.Client) string {
	return createTable(t, client, &dynamodb.CreateTableInput{
		AttributeDefinitions: []types.AttributeDefinition{attr("id")},
		KeySchema:            []types.KeySchemaElement{key("id", types.KeyTypeHash)},
	})
}

func TestWorkspaceLifecycle(t *testing.T) {
	ctx := context.Background()
	client := localClient(t)
	membersName := membershipsTable(t, client)
	workspaces := NewDynamoDBWorkspaceRepository(client, workspacesTable(t, client), membersName)
	members := NewDynamoDBMembershipRepository(client, membersName)

	acme := &workspace.Workspace{ID: "acme", Name: "Acme", CreatedBy: "alice"}
	owner := &workspace.Membership{WorkspaceID: "acme", UserID: "alice", Email: "alice@acme.test", Role: workspace.RoleOwner}
	if err := workspaces.CreateWithOwner(ctx, acme, owner); err != nil {
		t.Fatalf("create workspace: %v", err)
	}
	globex := &workspace.Workspace{ID: "globex", Name: "Globex", CreatedBy: "bob"}
	rival := &workspace.Membership{WorkspaceID: "globex", UserID: "bob", Role: workspace.RoleOwner}
	if err := workspaces.CreateWithOwner(ctx, globex, rival); err != nil {
		t.Fatalf("create second workspace: %v", err)
	}

	got, err := members.Get(ctx, "acme", "alice")
	if err != nil || got.Role != workspace.RoleOwner {
		t.Fatalf("get owner: %+v, %v", got, err)
	}
	if _, err := members.Get(ctx, "acme", "bob"); !isCode(err, apierrors.CodeNotFound) {
		t.Fatalf("bob must not be a member of acme: %v", err)
	}

	editor := &workspace.Membership{WorkspaceID: "acme", UserID: "carol", Email: "carol@acme.test", Role: workspace.RoleEditor}
	if err := members.Create(ctx, editor); err != nil {
		t.Fatalf("add member: %v", err)
	}
	if err := members.Create(ctx, editor); !isCode(err, apierrors.CodeConflict) {
		t.Fatalf("adding twice must conflict: %v", err)
	}

	list, err := members.ListByWorkspace(ctx, "acme")
	if err != nil || len(list) != 2 {
		t.Fatalf("list members: %+v, %v", list, err)
	}
	for _, m := range list {
		if m.WorkspaceID != "acme" {
			t.Fatalf("member of another workspace leaked: %+v", m)
		}
	}

	byUser, err := members.ListByUser(ctx, "carol")
	if err != nil || len(byUser) != 1 || byUser[0].WorkspaceID != "acme" {
		t.Fatalf("list by user: %+v, %v", byUser, err)
	}

	updated, err := members.UpdateRole(ctx, "acme", "carol", workspace.RoleViewer)
	if err != nil || updated.Role != workspace.RoleViewer || updated.Email != "carol@acme.test" {
		t.Fatalf("update role: %+v, %v", updated, err)
	}
	if _, err := members.UpdateRole(ctx, "acme", "nobody", workspace.RoleViewer); !isCode(err, apierrors.CodeNotFound) {
		t.Fatalf("updating a missing member must be not found: %v", err)
	}

	if err := members.Delete(ctx, "acme", "carol"); err != nil {
		t.Fatalf("delete member: %v", err)
	}

	many, err := workspaces.GetMany(ctx, []string{"acme", "gone", "globex"})
	if err != nil || len(many) != 2 {
		t.Fatalf("get many: %+v, %v", many, err)
	}
}

func TestFoldersStayInsideTheirWorkspace(t *testing.T) {
	ctx := context.Background()
	client := localClient(t)
	folders := NewDynamoDBFolderRepository(client, createTable(t, client, &dynamodb.CreateTableInput{
		AttributeDefinitions: []types.AttributeDefinition{attr("workspace_id"), attr("id")},
		KeySchema:            []types.KeySchemaElement{key("workspace_id", types.KeyTypeHash), key("id", types.KeyTypeRange)},
	}))

	if err := folders.Create(ctx, &folder.Folder{WorkspaceID: "acme", ID: "a", Name: "Ours"}); err != nil {
		t.Fatal(err)
	}
	if err := folders.Create(ctx, &folder.Folder{WorkspaceID: "globex", ID: "b", Name: "Theirs"}); err != nil {
		t.Fatal(err)
	}

	list, err := folders.List(ctx, "acme")
	if err != nil || len(list) != 1 || list[0].ID != "a" {
		t.Fatalf("list: %+v, %v", list, err)
	}
	if err := folders.Delete(ctx, "acme", "b"); !isCode(err, apierrors.CodeNotFound) {
		t.Fatalf("deleting another workspace's folder must be not found: %v", err)
	}
	if list, _ := folders.List(ctx, "globex"); len(list) != 1 {
		t.Fatal("the other workspace's folder must survive")
	}
}

// Real case: the first version of List read a single Scan page, so projects past
// 1 MB silently disappeared from the list.
func TestListReadsEveryPage(t *testing.T) {
	ctx := context.Background()
	client := localClient(t)
	projects := NewDynamoDBProjectRepository(client, workspacesTable(t, client))

	padding := make([]byte, 100*1024)
	for i := range padding {
		padding[i] = 'x'
	}
	const total = 30
	for i := 0; i < total; i++ {
		p := &project.Project{ID: fmt.Sprintf("p%02d", i), Name: "Demo", Description: string(padding)}
		if err := projects.Create(ctx, p); err != nil {
			t.Fatal(err)
		}
	}

	list, err := projects.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != total {
		t.Fatalf("got %d of %d projects", len(list), total)
	}
}

func isCode(err error, code string) bool {
	var apiErr *apierrors.ApiError
	return errors.As(err, &apiErr) && apiErr.Code == code
}
