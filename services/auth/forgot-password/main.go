package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/auth"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type PasswordResetter interface {
	ForgotPassword(ctx context.Context, in *cognitoidentityprovider.ForgotPasswordInput, opts ...func(*cognitoidentityprovider.Options)) (*cognitoidentityprovider.ForgotPasswordOutput, error)
}

var (
	cognitoClient PasswordResetter
	clientID      string
)

func init() {
	if os.Getenv("AWS_LAMBDA_FUNCTION_NAME") == "" {
		return
	}
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	cognitoClient = cognitoidentityprovider.NewFromConfig(cfg)
	clientID = os.Getenv("USER_POOL_CLIENT_ID")
}

// The answer is the same whether or not the address has an account, so this
// route cannot be used to find out who uses Rivo.
const sent = "If that address has a Rivo account, a code is on its way. If you have never signed in, use the temporary password from your invitation instead."

// Emails a code to reset a forgotten password. It is public because the person
// cannot sign in. POST /auth/reset-password uses the code.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var in auth.ForgotPasswordInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}
	email := strings.TrimSpace(in.Email)
	if email == "" {
		return apigateway.Error(apierrors.Validation("email is required")), nil
	}

	_, err := cognitoClient.ForgotPassword(ctx, &cognitoidentityprovider.ForgotPasswordInput{
		ClientId: aws.String(clientID),
		Username: aws.String(email),
	})
	if _, ok := errors.AsType[*types.LimitExceededException](err); ok {
		return apigateway.Error(apierrors.TooMany("too many attempts, wait a few minutes and try again")), nil
	}
	if err != nil {
		// Not found, never signed in (still on the temporary password) or no
		// verified email: all answer like a success, and the log keeps why.
		log.Printf("forgot password not sent: %v", err)
	}
	return apigateway.Success(http.StatusOK, map[string]string{"message": sent}), nil
}

func main() {
	lambda.Start(handler)
}
