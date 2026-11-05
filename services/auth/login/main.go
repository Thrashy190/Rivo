package main

import (
	"context"
	"encoding/json"
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

var cognitoClient *cognitoidentityprovider.Client
var clientID string

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	cognitoClient = cognitoidentityprovider.NewFromConfig(cfg)
	clientID = os.Getenv("USER_POOL_CLIENT_ID")
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var in auth.LoginInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}
	if in.Email == "" || in.Password == "" {
		return apigateway.Error(apierrors.Validation("email and password are required")), nil
	}

	out, err := cognitoClient.InitiateAuth(ctx, &cognitoidentityprovider.InitiateAuthInput{
		AuthFlow: types.AuthFlowTypeUserPasswordAuth,
		ClientId: aws.String(clientID),
		AuthParameters: map[string]string{
			"USERNAME": in.Email,
			"PASSWORD": in.Password,
		},
	})
	if err != nil {
		return apigateway.Error(apierrors.FromCognitoAuthError(err)), nil
	}

	// Without AuthenticationResult, Cognito is asking for a challenge instead of
	// returning tokens: the normal case is NEW_PASSWORD_REQUIRED on the first login
	// of a user the admin created with a temporary password.
	if out.AuthenticationResult == nil {
		return apigateway.Success(http.StatusOK, auth.LoginOutput{
			Challenge: string(out.ChallengeName),
			Session:   aws.ToString(out.Session),
		}), nil
	}

	result := out.AuthenticationResult
	return apigateway.Success(http.StatusOK, auth.LoginOutput{
		IDToken:      aws.ToString(result.IdToken),
		AccessToken:  aws.ToString(result.AccessToken),
		RefreshToken: aws.ToString(result.RefreshToken),
		ExpiresIn:    result.ExpiresIn,
	}), nil
}

func main() {
	lambda.Start(handler)
}
