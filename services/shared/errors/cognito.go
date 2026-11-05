package errors

import (
	"errors"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
)

// FromCognitoSignUpError traduce las excepciones que puede devolver
// SignUp a un ApiError; cualquier otra cosa cae en Internal en vez de
// filtrar el mensaje propio de Cognito al cliente.
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

// FromCognitoAdminError traduce las excepciones de las operaciones admin
// del user pool (AdminCreateUser, AdminDeleteUser), que son las que usan
// los endpoints de gestión de usuarios.
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

// FromCognitoChallengeError traduce las excepciones de
// RespondToAuthChallenge (el primer login de un usuario creado por el
// admin, que llega con password temporal).
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

// FromCognitoAuthError traduce las excepciones que puede devolver
// InitiateAuth; NotAuthorized y UserNotFound se reportan igual para no
// revelar si un email está registrado.
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
