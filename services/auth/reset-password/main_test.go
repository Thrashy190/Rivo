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
	err error
	got *cognitoidentityprovider.ConfirmForgotPasswordInput
}

func (f *fakeCognito) ConfirmForgotPassword(_ context.Context, in *cognitoidentityprovider.ConfirmForgotPasswordInput, _ ...func(*cognitoidentityprovider.Options)) (*cognitoidentityprovider.ConfirmForgotPasswordOutput, error) {
	f.got = in
	return &cognitoidentityprovider.ConfirmForgotPasswordOutput{}, f.err
}

func TestResetPassword(t *testing.T) {
	cases := []struct {
		name   string
		body   string
		err    error
		status int
	}{
		{"right code", `{"email":"a@acme.test","code":" 123456 ","newPassword":"Newpass123"}`, nil, http.StatusOK},
		{"wrong code", `{"email":"a@acme.test","code":"000000","newPassword":"Newpass123"}`, &types.CodeMismatchException{}, http.StatusBadRequest},
		{"expired code", `{"email":"a@acme.test","code":"123456","newPassword":"Newpass123"}`, &types.ExpiredCodeException{}, http.StatusBadRequest},
		{"weak password", `{"email":"a@acme.test","code":"123456","newPassword":"weak"}`, &types.InvalidPasswordException{}, http.StatusBadRequest},
		{"too many tries", `{"email":"a@acme.test","code":"123456","newPassword":"Newpass123"}`, &types.LimitExceededException{}, http.StatusTooManyRequests},
		{"missing code", `{"email":"a@acme.test","newPassword":"Newpass123"}`, nil, http.StatusBadRequest},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			fake := &fakeCognito{err: c.err}
			cognitoClient = fake
			res, err := handler(context.Background(), events.APIGatewayProxyRequest{Body: c.body})
			if err != nil {
				t.Fatal(err)
			}
			if res.StatusCode != c.status {
				t.Fatalf("status = %d, want %d, body %s", res.StatusCode, c.status, res.Body)
			}
			if c.status == http.StatusOK && aws.ToString(fake.got.ConfirmationCode) != "123456" {
				t.Fatalf("sent code %q", aws.ToString(fake.got.ConfirmationCode))
			}
		})
	}
}
