package apigateway

import (
	"net/http"
	"testing"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
)

func TestResponsesAllowTheWebAppOrigin(t *testing.T) {
	corsOrigin = "https://rivo.example.com"
	t.Cleanup(func() { corsOrigin = "" })

	// The web app must be able to read errors too, such as the 409 that tells
	// it someone else saved the diagram first.
	for name, res := range map[string]map[string]string{
		"success":    Success(http.StatusOK, map[string]string{"ok": "yes"}).Headers,
		"error":      Error(apierrors.Conflict("the diagram changed since you opened it")).Headers,
		"unexpected": Error(http.ErrAbortHandler).Headers,
		// Found on AWS: deletes answered 204 without the header, so the web
		// app reported every delete as failed.
		"no content": NoContent().Headers,
	} {
		if got := res["Access-Control-Allow-Origin"]; got != "https://rivo.example.com" {
			t.Errorf("%s: Access-Control-Allow-Origin = %q", name, got)
		}
	}
}

func TestResponsesSendNoCORSHeadersWithoutAnOrigin(t *testing.T) {
	corsOrigin = ""
	if _, ok := Success(http.StatusOK, nil).Headers["Access-Control-Allow-Origin"]; ok {
		t.Fatal("sent a CORS header with no origin configured")
	}
}
