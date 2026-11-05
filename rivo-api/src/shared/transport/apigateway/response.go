package apigateway

import (
	"encoding/json"
	"errors"
	"log"

	"github.com/aws/aws-lambda-go/events"

	apierrors "github.com/rivo-api/shared/errors"
)

func Error(err error) events.APIGatewayProxyResponse {
	var appErr *apierrors.ApiError
	if errors.As(err, &appErr) {
		if appErr.Err != nil {
			log.Printf("error: %s: %v", appErr.Code, appErr.Err)
		}
		body, _ := json.Marshal(map[string]any{"error": map[string]string{"code": appErr.Code, "message": appErr.Message}})
		return events.APIGatewayProxyResponse{StatusCode: appErr.StatusCode, Body: string(body)}
	}
	log.Printf("unhandled error: %v", err)
	body, _ := json.Marshal(map[string]any{"error": map[string]string{"code": "INTERNAL", "message": "Internal Error"}})
	return events.APIGatewayProxyResponse{StatusCode: 500, Body: string(body)}
}

func Success(statusCode int, body any) events.APIGatewayProxyResponse {
	b, err := json.Marshal(body)
	if err != nil {
		return Error(apierrors.Internal(err))
	}
	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers:    map[string]string{"Content-Type": "application/json"},
		Body:       string(b),
	}
}
