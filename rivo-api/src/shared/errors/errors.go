package errors

import (
	"net/http"
)

// Tabla de códigos de error: toda la API responde con uno de estos
// códigos en el body (ver apigateway.Error), así que es la única fuente
// de verdad tanto para los constructores de abajo como para quien
// consuma la API (frontend, docs, tests).
const (
	CodeNotFound     = "NOT_FOUND"
	CodeValidation   = "VALIDATION_ERROR"
	CodeInternal     = "INTERNAL"
	CodeUnauthorized = "UNAUTHORIZED"
	CodeForbidden    = "FORBIDDEN"
	CodeConflict     = "CONFLICT"
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

// Forbidden: el usuario está autenticado pero no tiene el permiso que
// la acción exige (a diferencia de Unauthorized, que es "no sé quién sos").
func Forbidden(msg string) *ApiError {
	return &ApiError{Code: CodeForbidden, Message: msg, StatusCode: http.StatusForbidden}
}

func Conflict(msg string) *ApiError {
	return &ApiError{Code: CodeConflict, Message: msg, StatusCode: http.StatusConflict}
}
