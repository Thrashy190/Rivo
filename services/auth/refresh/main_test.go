package main

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"

	"github.com/Thrashy190/Rivo/services/shared/models/auth"
)

type fakeCognito struct {
	token string
	err   error
}

func (f *fakeCognito) InitiateAuth(_ context.Context, in *cognitoidentityprovider.InitiateAuthInput, _ ...func(*cognitoidentityprovider.Options)) (*cognitoidentityprovider.InitiateAuthOutput, error) {
	f.token = in.AuthParameters["REFRESH_TOKEN"]
	if f.err != nil {
		return nil, f.err
	}
	return &cognitoidentityprovider.InitiateAuthOutput{AuthenticationResult: &types.AuthenticationResultType{
		IdToken:     aws.String("new-id"),
		AccessToken: aws.String("new-access"),
		ExpiresIn:   3600,
	}}, nil
}

func call(t *testing.T, body string) events.APIGatewayProxyResponse {
	t.Helper()
	res, err := handler(context.Background(), events.APIGatewayProxyRequest{Body: body})
	if err != nil {
		t.Fatal(err)
	}
	return res
}

func TestRefreshReturnsNewTokens(t *testing.T) {
	fake := &fakeCognito{}
	cognitoClient = fake

	res := call(t, `{"refreshToken":"r-1"}`)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, body %s", res.StatusCode, res.Body)
	}
	var out auth.LoginOutput
	if err := json.Unmarshal([]byte(res.Body), &out); err != nil {
		t.Fatal(err)
	}
	if fake.token != "r-1" || out.IDToken != "new-id" || out.RefreshToken != "" {
		t.Fatalf("sent %q, got %+v", fake.token, out)
	}
}

func TestRefreshWithARevokedTokenAsksToSignInAgain(t *testing.T) {
	cognitoClient = &fakeCognito{err: &types.NotAuthorizedException{Message: aws.String("Refresh Token has been revoked")}}

	if res := call(t, `{"refreshToken":"revoked"}`); res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", res.StatusCode)
	}
}

func TestRefreshNeedsAToken(t *testing.T) {
	cognitoClient = &fakeCognito{}
	if res := call(t, `{}`); res.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", res.StatusCode)
	}
}
