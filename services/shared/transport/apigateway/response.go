package apigateway

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"

	"github.com/aws/aws-lambda-go/events"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
)

// corsOrigin is the web app's origin, set by Terraform from web_origin. When it
// is empty the API sends no CORS headers, and only same-origin callers (such as
// the Vite dev proxy) or tools like curl can use it.
var corsOrigin = os.Getenv("CORS_ALLOW_ORIGIN")

func headers(contentType string) map[string]string {
	h := map[string]string{"Content-Type": contentType}
	if corsOrigin != "" {
		h["Access-Control-Allow-Origin"] = corsOrigin
		h["Vary"] = "Origin"
	}
	return h
}

func Error(err error) events.APIGatewayProxyResponse {
	var appErr *apierrors.ApiError
	if errors.As(err, &appErr) {
		if appErr.Err != nil {
			log.Printf("error: %s: %v", appErr.Code, appErr.Err)
		}
		body, _ := json.Marshal(map[string]any{"error": map[string]string{"code": appErr.Code, "message": appErr.Message}})
		return events.APIGatewayProxyResponse{StatusCode: appErr.StatusCode, Headers: headers("application/json"), Body: string(body)}
	}
	log.Printf("unhandled error: %v", err)
	body, _ := json.Marshal(map[string]any{"error": map[string]string{"code": "INTERNAL", "message": "Internal Error"}})
	return events.APIGatewayProxyResponse{StatusCode: 500, Headers: headers("application/json"), Body: string(body)}
}

func Success(statusCode int, body any) events.APIGatewayProxyResponse {
	b, err := json.Marshal(body)
	if err != nil {
		return Error(apierrors.Internal(err))
	}
	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers:    headers("application/json"),
		Body:       string(b),
	}
}

// NoContent answers a successful delete. It still carries the CORS headers:
// without them the browser reports the delete as failed.
func NoContent() events.APIGatewayProxyResponse {
	h := headers("")
	delete(h, "Content-Type")
	return events.APIGatewayProxyResponse{StatusCode: http.StatusNoContent, Headers: h}
}
