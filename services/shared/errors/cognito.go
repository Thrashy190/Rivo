package errors

import (
	"errors"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
)

// FromCognitoSignUpError maps the exceptions SignUp can return to an ApiError;
// anything else becomes Internal instead of leaking Cognito's own message to
// the client.
func FromCognitoSignUpError(err error) *ApiError {
	if _, ok := errors.AsType[*types.UsernameExistsException](err); ok {
		return Conflict("an account with that email already exists")
	}
	if _, ok := errors.AsType[*types.InvalidPasswordException](err); ok {
		return Validation("password does not meet the required policy")
	}
	if _, ok := errors.AsType[*types.InvalidParameterException](err); ok {
		return Validation("invalid email or password")
	}
	return Internal(fmt.Errorf("cognito SignUp: %w", err))
}

// FromCognitoAdminError maps the exceptions from the user pool's admin
// operations (AdminCreateUser, AdminDeleteUser), which the user management
// endpoints use.
func FromCognitoAdminError(err error) *ApiError {
	if _, ok := errors.AsType[*types.UsernameExistsException](err); ok {
		return Conflict("an account with that email already exists")
	}
	if _, ok := errors.AsType[*types.UserNotFoundException](err); ok {
		return NotFound("user")
	}
	if _, ok := errors.AsType[*types.InvalidParameterException](err); ok {
		return Validation("invalid email")
	}
	return Internal(fmt.Errorf("cognito admin operation: %w", err))
}

// FromCognitoChallengeError maps the exceptions from
// RespondToAuthChallenge (the first login of an admin-created user, who arrives
// with a temporary password).
func FromCognitoChallengeError(err error) *ApiError {
	if _, ok := errors.AsType[*types.InvalidPasswordException](err); ok {
		return Validation("password does not meet the required policy")
	}
	if _, ok := errors.AsType[*types.NotAuthorizedException](err); ok {
		return Unauthorized("invalid or expired session")
	}
	if _, ok := errors.AsType[*types.CodeMismatchException](err); ok {
		return Validation("invalid challenge response")
	}
	return Internal(fmt.Errorf("cognito RespondToAuthChallenge: %w", err))
}

// FromCognitoAuthError maps the exceptions InitiateAuth can return;
// NotAuthorized and UserNotFound are reported the same way so they do not
// reveal whether an email is registered.
func FromCognitoAuthError(err error) *ApiError {
	if _, ok := errors.AsType[*types.NotAuthorizedException](err); ok {
		return Unauthorized("invalid email or password")
	}
	if _, ok := errors.AsType[*types.UserNotFoundException](err); ok {
		return Unauthorized("invalid email or password")
	}
	if _, ok := errors.AsType[*types.UserNotConfirmedException](err); ok {
		return Validation("account not confirmed yet")
	}
	return Internal(fmt.Errorf("cognito InitiateAuth: %w", err))
}
