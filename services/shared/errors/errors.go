package errors

import (
	"net/http"
)

// Error code table: the whole API answers with one of these codes in the body
// (see apigateway.Error), so this is the single source of truth for the
// constructors below and for anyone consuming the API (frontend, docs, tests).
const (
	CodeNotFound     = "NOT_FOUND"
	CodeValidation   = "VALIDATION_ERROR"
	CodeInternal     = "INTERNAL"
	CodeUnauthorized = "UNAUTHORIZED"
	CodeForbidden    = "FORBIDDEN"
	CodeConflict     = "CONFLICT"
	CodeTooMany      = "TOO_MANY_REQUESTS"
)

type ApiError struct {
	Code       string
	Message    string
	StatusCode int
	Err        error
}

func (e *ApiError) Error() string { return e.Message }
func (e *ApiError) Unwrap() error { return e.Err }

// Related use Cases

func NotFound(resource string) *ApiError {
	return &ApiError{Code: CodeNotFound, Message: resource + " not found", StatusCode: http.StatusNotFound}
}

func Validation(msg string) *ApiError {
	return &ApiError{Code: CodeValidation, Message: msg, StatusCode: http.StatusBadRequest}
}

func Internal(err error) *ApiError {
	return &ApiError{Code: CodeInternal, Message: "Internal error", StatusCode: http.StatusInternalServerError, Err: err}
}

func Unauthorized(msg string) *ApiError {
	return &ApiError{Code: CodeUnauthorized, Message: msg, StatusCode: http.StatusUnauthorized}
}

// Forbidden: the user is authenticated but lacks the permission the action
// requires (unlike Unauthorized, which means "I do not know who you are").
func Forbidden(msg string) *ApiError {
	return &ApiError{Code: CodeForbidden, Message: msg, StatusCode: http.StatusForbidden}
}

func Conflict(msg string) *ApiError {
	return &ApiError{Code: CodeConflict, Message: msg, StatusCode: http.StatusConflict}
}

// TooMany: the caller must wait before trying again, such as after too many
// password reset attempts.
func TooMany(msg string) *ApiError {
	return &ApiError{Code: CodeTooMany, Message: msg, StatusCode: http.StatusTooManyRequests}
}
