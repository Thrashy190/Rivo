package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/google/uuid"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/connection"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type Creator interface {
	Create(ctx context.Context, c *connection.Connection) error
}

var (
	users       authz.UserLoader
	members     authz.MembershipLoader
	connections Creator
	// Rivo's account and the roles in it that assume connected roles.
	trustedAccount = os.Getenv("RIVO_ACCOUNT_ID")
	trustedRoles   = strings.Split(os.Getenv("TRUSTED_ROLE_ARNS"), ",")
)

func init() {
	if os.Getenv("AWS_LAMBDA_FUNCTION_NAME") == "" {
		return
	}
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	client := dynamodb.NewFromConfig(cfg)
	users = repository.NewDynamoDBUserRepository(client, os.Getenv("USERS_TABLE_NAME"))
	members = repository.NewDynamoDBMembershipRepository(client, os.Getenv("MEMBERS_TABLE_NAME"))
	connections = repository.NewDynamoDBConnectionRepository(client, os.Getenv("CONNECTIONS_TABLE_NAME"))
}

// Starts connecting an AWS account: Rivo picks the external ID, and the answer
// has the template that creates a role trusting Rivo with it.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	u, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermConnectionsManage)
	if err != nil {
		return apigateway.Error(err), nil
	}
	var in connection.CreateInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil || !connection.ValidName(in.Name) {
		return apigateway.Error(apierrors.Validation("name the account in up to 80 characters")), nil
	}
	now := time.Now().UnixMilli()
	c := &connection.Connection{
		WorkspaceID: m.WorkspaceID,
		ID:          uuid.NewString(),
		Name:        strings.TrimSpace(in.Name),
		ExternalID:  connection.NewExternalID(),
		Status:      connection.StatusPending,
		CreatedBy:   u.ID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := connections.Create(ctx, c); err != nil {
		return apigateway.Error(err), nil
	}
	return apigateway.Success(http.StatusCreated, connection.WithSetupFor(*c, trustedAccount, trustedRoles)), nil
}

func main() {
	lambda.Start(handler)
}
