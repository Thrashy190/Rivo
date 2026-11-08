package main

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/aws/aws-lambda-go/events"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/connection"
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

func (f fakeMembers) Get(_ context.Context, ws, uid string) (*workspace.Membership, error) {
	if r, ok := f[ws+"/"+uid]; ok {
		return &workspace.Membership{WorkspaceID: ws, UserID: uid, Role: r}, nil
	}
	return nil, apierrors.NotFound("member")
}

type fakeConnections map[string]*connection.Connection

func (f fakeConnections) Get(_ context.Context, ws, id string) (*connection.Connection, error) {
	if c, ok := f[ws+"/"+id]; ok {
		return c, nil
	}
	return nil, apierrors.NotFound("connection")
}

func (f fakeConnections) SetVerification(_ context.Context, ws, id, arn, account, status, problem string) (*connection.Connection, error) {
	c := f[ws+"/"+id]
	c.RoleARN, c.AccountID, c.Status, c.LastError = arn, account, status, problem
	return c, nil
}

// Roles answer by ARN: which external ID they need ("" for none, "*" for any)
// and the account they are in.
type fakeRoles map[string][2]string

func (f fakeRoles) Try(_ context.Context, arn, externalID string) (string, error) {
	r, ok := f[arn]
	if !ok || (r[0] != "*" && r[0] != externalID) {
		return "", errors.New("AccessDenied")
	}
	return r[1], nil
}

func setup() fakeConnections {
	users = fakeUsers{
		"owner":  {ID: "owner", Status: user.StatusActive, Role: user.RoleMember},
		"editor": {ID: "editor", Status: user.StatusActive, Role: user.RoleMember},
		"rival":  {ID: "rival", Status: user.StatusActive, Role: user.RoleMember},
	}
	members = fakeMembers{"acme/owner": workspace.RoleOwner, "acme/editor": workspace.RoleEditor, "globex/rival": workspace.RoleOwner}
	c := fakeConnections{"acme/c1": {WorkspaceID: "acme", ID: "c1", ExternalID: "rivo-secret", Status: connection.StatusPending}}
	connections = c
	roles = fakeRoles{
		"arn:aws:iam::111111111111:role/RivoDeploy": {"rivo-secret", "111111111111"},
		"arn:aws:iam::111111111111:role/Open":       {"*", "111111111111"},
		"arn:aws:iam::111111111111:role/Elsewhere":  {"rivo-secret", "999999999999"},
	}
	return c
}

func verify(caller, ws, arn string) events.APIGatewayProxyResponse {
	res, _ := handler(context.Background(), events.APIGatewayProxyRequest{
		PathParameters: map[string]string{"workspaceId": ws, "connectionId": "c1"},
		Body:           `{"roleArn":"` + arn + `"}`,
		RequestContext: events.APIGatewayProxyRequestContext{Authorizer: map[string]any{"claims": map[string]any{"sub": caller}}},
	})
	return res
}

func TestVerifiesARoleThatNeedsTheExternalID(t *testing.T) {
	c := setup()
	if res := verify("owner", "acme", "arn:aws:iam::111111111111:role/RivoDeploy"); res.StatusCode != http.StatusOK {
		t.Fatalf("status %d: %s", res.StatusCode, res.Body)
	}
	if got := c["acme/c1"]; got.Status != connection.StatusVerified || got.AccountID != "111111111111" {
		t.Errorf("connection: %+v", got)
	}
}

func TestRefusesRolesThatAreUnsafeOrWrong(t *testing.T) {
	for arn, want := range map[string]string{
		"arn:aws:iam::111111111111:role/Open":      "without the external ID",
		"arn:aws:iam::111111111111:role/Elsewhere": "answered from account 999999999999",
		"arn:aws:iam::111111111111:role/Missing":   "could not assume",
	} {
		c := setup()
		verify("owner", "acme", arn)
		if got := c["acme/c1"]; got.Status != connection.StatusFailed || !strings.Contains(got.LastError, want) {
			t.Errorf("%s: %+v", arn, got)
		}
	}
}

func TestOnlyOwnersOfTheWorkspaceVerify(t *testing.T) {
	setup()
	cases := map[string]int{"editor/acme": http.StatusForbidden, "rival/acme": http.StatusNotFound, "rival/globex": http.StatusNotFound}
	for who, want := range cases {
		parts := strings.Split(who, "/")
		if res := verify(parts[0], parts[1], "arn:aws:iam::111111111111:role/RivoDeploy"); res.StatusCode != want {
			t.Errorf("%s: got %d, want %d", who, res.StatusCode, want)
		}
	}
	if res := verify("owner", "acme", "arn:aws:iam::111111111111:user/me"); res.StatusCode != http.StatusBadRequest {
		t.Errorf("a user ARN got %d", res.StatusCode)
	}
}
