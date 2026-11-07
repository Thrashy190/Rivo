package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/auth"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type PasswordConfirmer interface {
	ConfirmForgotPassword(ctx context.Context, in *cognitoidentityprovider.ConfirmForgotPasswordInput, opts ...func(*cognitoidentityprovider.Options)) (*cognitoidentityprovider.ConfirmForgotPasswordOutput, error)
}

var (
	cognitoClient PasswordConfirmer
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

// Sets a new password with the code from POST /auth/forgot-password. The
// person then signs in with it as usual.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var in auth.ResetPasswordInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}
	email, code := strings.TrimSpace(in.Email), strings.TrimSpace(in.Code)
	if email == "" || code == "" || in.NewPassword == "" {
		return apigateway.Error(apierrors.Validation("email, code and newPassword are required")), nil
	}

	_, err := cognitoClient.ConfirmForgotPassword(ctx, &cognitoidentityprovider.ConfirmForgotPasswordInput{
		ClientId:         aws.String(clientID),
		Username:         aws.String(email),
		ConfirmationCode: aws.String(code),
		Password:         aws.String(in.NewPassword),
	})
	if err != nil {
		return apigateway.Error(apierrors.FromCognitoResetError(err)), nil
	}
	return apigateway.Success(http.StatusOK, map[string]string{"message": "Password changed. Sign in with the new one."}), nil
}

func main() {
	lambda.Start(handler)
}
