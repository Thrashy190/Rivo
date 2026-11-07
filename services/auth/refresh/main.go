package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"

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

type Authenticator interface {
	InitiateAuth(ctx context.Context, in *cognitoidentityprovider.InitiateAuthInput, opts ...func(*cognitoidentityprovider.Options)) (*cognitoidentityprovider.InitiateAuthOutput, error)
}

var (
	cognitoClient Authenticator
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

// Exchanges the refresh token from POST /auth/login for new ID and access
// tokens, so the web app keeps a session past the one-hour token lifetime. It
// is public because the expired ID token can no longer pass the authorizer.
// Cognito does not rotate the refresh token, so the response omits it.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var in auth.RefreshInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}
	if in.RefreshToken == "" {
		return apigateway.Error(apierrors.Validation("refreshToken is required")), nil
	}

	out, err := cognitoClient.InitiateAuth(ctx, &cognitoidentityprovider.InitiateAuthInput{
		AuthFlow:       types.AuthFlowTypeRefreshTokenAuth,
		ClientId:       aws.String(clientID),
		AuthParameters: map[string]string{"REFRESH_TOKEN": in.RefreshToken},
	})
	if _, revoked := errors.AsType[*types.NotAuthorizedException](err); revoked {
		return apigateway.Error(apierrors.Unauthorized("your session expired, sign in again")), nil
	}
	if err != nil {
		return apigateway.Error(apierrors.FromCognitoAuthError(err)), nil
	}
	if out.AuthenticationResult == nil {
		return apigateway.Error(apierrors.Unauthorized("your session expired, sign in again")), nil
	}

	result := out.AuthenticationResult
	return apigateway.Success(http.StatusOK, auth.LoginOutput{
		IDToken:     aws.ToString(result.IdToken),
		AccessToken: aws.ToString(result.AccessToken),
		ExpiresIn:   result.ExpiresIn,
	}), nil
}

func main() {
	lambda.Start(handler)
}
