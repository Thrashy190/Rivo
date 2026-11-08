package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials/stscreds"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/sts"
	"github.com/aws/smithy-go"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/connection"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

type Connections interface {
	Get(ctx context.Context, workspaceID, id string) (*connection.Connection, error)
	SetVerification(ctx context.Context, workspaceID, id, roleARN, accountID, status, lastError string) (*connection.Connection, error)
}

// Roles tries a role: whether it can be assumed with an external ID (empty
// for none), and the account the session ends up in.
type Roles interface {
	Try(ctx context.Context, roleARN, externalID string) (account string, err error)
}

var (
	users          authz.UserLoader
	members        authz.MembershipLoader
	connections    Connections
	roles          Roles
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
	roles = stsRoles{cfg: cfg}
}

type stsRoles struct{ cfg aws.Config }

func (s stsRoles) Try(ctx context.Context, roleARN, externalID string) (string, error) {
	provider := stscreds.NewAssumeRoleProvider(sts.NewFromConfig(s.cfg), roleARN, func(o *stscreds.AssumeRoleOptions) {
		o.RoleSessionName = "rivo-verify"
		if externalID != "" {
			o.ExternalID = aws.String(externalID)
		}
	})
	cfg := s.cfg.Copy()
	cfg.Credentials = aws.NewCredentialsCache(provider)
	out, err := sts.NewFromConfig(cfg).GetCallerIdentity(ctx, &sts.GetCallerIdentityInput{})
	if err != nil {
		return "", err
	}
	return aws.ToString(out.Account), nil
}

// Checks that Rivo can assume the role with the connection's external ID, and
// only with it: a role anyone can assume without it could be used by another
// workspace that learned its ARN.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermConnectionsManage)
	if err != nil {
		return apigateway.Error(err), nil
	}
	var in connection.VerifyInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("send the role's ARN")), nil
	}
	roleARN := strings.TrimSpace(in.RoleARN)
	account := connection.AccountOf(roleARN)
	if account == "" {
		return apigateway.Error(apierrors.Validation("that is not a role ARN, such as arn:aws:iam::123456789012:role/RivoDeploy")), nil
	}
	c, err := connections.Get(ctx, m.WorkspaceID, req.PathParameters["connectionId"])
	if err != nil {
		return apigateway.Error(err), nil
	}

	status, problem := connection.StatusVerified, ""
	got, err := roles.Try(ctx, roleARN, c.ExternalID)
	switch {
	case err != nil:
		status, problem = connection.StatusFailed, explain(err)
	case got != account:
		status, problem = connection.StatusFailed, fmt.Sprintf("the role answered from account %s, not %s", got, account)
	default:
		if _, err := roles.Try(ctx, roleARN, ""); err == nil {
			status, problem = connection.StatusFailed, "the role can be assumed without the external ID: use the template, which requires it"
		}
	}

	updated, err := connections.SetVerification(ctx, m.WorkspaceID, c.ID, roleARN, account, status, problem)
	if err != nil {
		return apigateway.Error(err), nil
	}
	return apigateway.Success(http.StatusOK, connection.WithSetupFor(*updated, trustedAccount, trustedRoles)), nil
}

func explain(err error) string {
	var api smithy.APIError
	if errors.As(err, &api) && api.ErrorCode() == "AccessDenied" {
		return "Rivo could not assume the role. Check that it was created with this connection's template (the external ID must match) and that the ARN is right."
	}
	return "Rivo could not assume the role: " + err.Error()
}

func main() {
	lambda.Start(handler)
}
