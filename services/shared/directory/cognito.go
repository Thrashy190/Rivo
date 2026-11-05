// Package directory finds or invites people in the Cognito user pool.
package directory

import (
	"context"
	"errors"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
)

type Cognito struct {
	client     *cognitoidentityprovider.Client
	userPoolID string
}

func NewCognito(client *cognitoidentityprovider.Client, userPoolID string) *Cognito {
	return &Cognito{client: client, userPoolID: userPoolID}
}

// EnsureUser returns the sub of the person with that email. If they have no
// account yet, Cognito creates one and emails them a temporary password.
func (c *Cognito) EnsureUser(ctx context.Context, email string) (string, error) {
	created, err := c.client.AdminCreateUser(ctx, &cognitoidentityprovider.AdminCreateUserInput{
		UserPoolId:             aws.String(c.userPoolID),
		Username:               aws.String(email),
		DesiredDeliveryMediums: []types.DeliveryMediumType{types.DeliveryMediumTypeEmail},
		UserAttributes: []types.AttributeType{
			{Name: aws.String("email"), Value: aws.String(email)},
			{Name: aws.String("email_verified"), Value: aws.String("true")},
		},
	})
	if err == nil {
		return subOf(created.User.Attributes)
	}

	var exists *types.UsernameExistsException
	if !errors.As(err, &exists) {
		return "", apierrors.FromCognitoAdminError(err)
	}

	found, err := c.client.AdminGetUser(ctx, &cognitoidentityprovider.AdminGetUserInput{
		UserPoolId: aws.String(c.userPoolID),
		Username:   aws.String(email),
	})
	if err != nil {
		return "", apierrors.FromCognitoAdminError(err)
	}
	return subOf(found.UserAttributes)
}

func subOf(attrs []types.AttributeType) (string, error) {
	for _, attr := range attrs {
		if aws.ToString(attr.Name) == "sub" {
			return aws.ToString(attr.Value), nil
		}
	}
	return "", apierrors.Internal(fmt.Errorf("cognito: missing sub attribute"))
}
