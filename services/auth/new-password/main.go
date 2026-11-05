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

// Cierra el challenge NEW_PASSWORD_REQUIRED que devuelve POST /auth/login
// cuando el usuario entra por primera vez con la password temporal que le
// mandó Cognito. Es público porque todavía no hay tokens: lo que autentica
// el request es la session que vino del login.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var in auth.NewPasswordInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("invalid JSON body")), nil
	}
	if in.Email == "" || in.Session == "" || in.NewPassword == "" {
		return apigateway.Error(apierrors.Validation("email, session and newPassword are required")), nil
	}

	out, err := cognitoClient.RespondToAuthChallenge(ctx, &cognitoidentityprovider.RespondToAuthChallengeInput{
		ChallengeName: types.ChallengeNameTypeNewPasswordRequired,
		ClientId:      aws.String(clientID),
		Session:       aws.String(in.Session),
		ChallengeResponses: map[string]string{
			"USERNAME":     in.Email,
			"NEW_PASSWORD": in.NewPassword,
		},
	})
	if err != nil {
		return apigateway.Error(apierrors.FromCognitoChallengeError(err)), nil
	}

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
