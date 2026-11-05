package errors

import (
	"net/http"
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
	return &ApiError{Code: "NOT_FOUND", Message: resource + " not found", StatusCode: http.StatusNotFound}
}

func Validation(msg string) *ApiError {
	return &ApiError{Code: "VALIDATION_ERROR", Message: msg, StatusCode: http.StatusBadRequest}
}

func Internal(err error) *ApiError {
	return &ApiError{Code: "INTERNAL", Message: "Internal error", StatusCode: http.StatusInternalServerError, Err: err}
}
