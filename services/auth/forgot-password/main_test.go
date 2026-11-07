package main

import (
	"context"
	"net/http"
	"testing"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
)

type fakeCognito struct {
	err  error
	sent string
}

func (f *fakeCognito) ForgotPassword(_ context.Context, in *cognitoidentityprovider.ForgotPasswordInput, _ ...func(*cognitoidentityprovider.Options)) (*cognitoidentityprovider.ForgotPasswordOutput, error) {
	f.sent = aws.ToString(in.Username)
	return &cognitoidentityprovider.ForgotPasswordOutput{}, f.err
}

func call(t *testing.T, body string) events.APIGatewayProxyResponse {
	t.Helper()
	res, err := handler(context.Background(), events.APIGatewayProxyRequest{Body: body})
	if err != nil {
		t.Fatal(err)
	}
	return res
}

func TestForgotPasswordAnswersTheSameForEveryAddress(t *testing.T) {
	cases := map[string]error{
		"an account":                      nil,
		"no account":                      &types.UserNotFoundException{},
		"still on the temporary password": &types.NotAuthorizedException{Message: aws.String("User password cannot be reset in the current state.")},
		"no verified email":               &types.InvalidParameterException{},
	}
	var first string
	for name, cognitoErr := range cases {
		t.Run(name, func(t *testing.T) {
			fake := &fakeCognito{err: cognitoErr}
			cognitoClient = fake
			res := call(t, `{"email":" someone@acme.test "}`)
			if res.StatusCode != http.StatusOK {
				t.Fatalf("status = %d, body %s", res.StatusCode, res.Body)
			}
			if fake.sent != "someone@acme.test" {
				t.Fatalf("asked Cognito for %q", fake.sent)
			}
			if first == "" {
				first = res.Body
			} else if res.Body != first {
				t.Fatalf("answer differs, which reveals who has an account: %s vs %s", res.Body, first)
			}
		})
	}
}

func TestForgotPasswordAsksToWaitAfterTooManyTries(t *testing.T) {
	cognitoClient = &fakeCognito{err: &types.LimitExceededException{}}
	if res := call(t, `{"email":"someone@acme.test"}`); res.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", res.StatusCode)
	}
}

func TestForgotPasswordNeedsAnEmail(t *testing.T) {
	cognitoClient = &fakeCognito{}
	if res := call(t, `{"email":"  "}`); res.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", res.StatusCode)
	}
}
