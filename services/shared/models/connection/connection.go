// Package connection holds AWS accounts a workspace connects for deploying.
// Rivo never stores credentials: the engine assumes a role in the account,
// which trusts Rivo only with the external ID it generated for the connection.
package connection

import (
	"crypto/rand"
	"encoding/hex"
	"regexp"
	"strings"
)

const (
	StatusPending  = "pending"
	StatusVerified = "verified"
	StatusFailed   = "failed"

	// SuggestedRoleName is the role the setup template creates.
	SuggestedRoleName = "RivoDeploy"
)

var (
	roleARN   = regexp.MustCompile(`^arn:aws:iam::(\d{12}):role/[\w+=,.@/-]{1,512}$`)
	accountID = regexp.MustCompile(`^\d{12}$`)
)

type Connection struct {
	WorkspaceID string `dynamodbav:"workspace_id" json:"workspaceId"`
	ID          string `dynamodbav:"id" json:"connectionId"`
	Name        string `dynamodbav:"name" json:"name"`
	AccountID   string `dynamodbav:"account_id,omitempty" json:"accountId,omitempty"`
	RoleARN     string `dynamodbav:"role_arn,omitempty" json:"roleArn,omitempty"`
	ExternalID  string `dynamodbav:"external_id" json:"externalId"`
	Status      string `dynamodbav:"status" json:"status"`
	LastError   string `dynamodbav:"last_error,omitempty" json:"lastError,omitempty"`
	VerifiedAt  int64  `dynamodbav:"verified_at,omitempty" json:"verifiedAt,omitempty"`
	CreatedBy   string `dynamodbav:"created_by" json:"createdBy"`
	CreatedAt   int64  `dynamodbav:"created_at" json:"createdAt"`
	UpdatedAt   int64  `dynamodbav:"updated_at" json:"updatedAt"`
}

type CreateInput struct {
	Name string `json:"name"`
}

type VerifyInput struct {
	RoleARN string `json:"roleArn"`
}

// Setup is what someone needs to create the role in their account.
type Setup struct {
	// Rivo's account and the roles in it that may assume the role.
	TrustedAccount string   `json:"trustedAccount"`
	TrustedRoles   []string `json:"trustedRoles"`
	RoleName       string   `json:"roleName"`
	CloudFormation string   `json:"cloudFormation"`
}

// WithSetup is a connection as returned to the app.
type WithSetup struct {
	Connection
	Setup Setup `json:"setup"`
}

func ValidName(name string) bool {
	n := strings.TrimSpace(name)
	return n != "" && len(n) <= 80
}

// AccountOf returns the account in a role ARN, or "" when it is not one.
func AccountOf(arn string) string {
	m := roleARN.FindStringSubmatch(strings.TrimSpace(arn))
	if m == nil {
		return ""
	}
	return m[1]
}

func ValidAccountID(id string) bool {
	return accountID.MatchString(id)
}

// NewExternalID returns a random external ID. It is not a secret, but nobody
// else can choose it, which stops other Rivo workspaces from using the role.
func NewExternalID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return "rivo-" + hex.EncodeToString(b)
}

// WithSetupFor adds the setup to a connection.
func WithSetupFor(c Connection, trustedAccount string, trustedRoles []string) WithSetup {
	return WithSetup{Connection: c, Setup: Setup{
		TrustedAccount: trustedAccount,
		TrustedRoles:   trustedRoles,
		RoleName:       SuggestedRoleName,
		CloudFormation: Template(trustedAccount, trustedRoles, c.ExternalID),
	}}
}

// Template is a CloudFormation template that creates the role. The role can
// manage the services Rivo generates; IAM is limited to the roles and
// policies those need.
func Template(trustedAccount string, trustedRoles []string, externalID string) string {
	principals := ""
	for _, r := range trustedRoles {
		principals += "\n                  - " + r
	}
	return `AWSTemplateFormatVersion: "2010-09-09"
Description: Lets Rivo deploy the infrastructure of your projects to this account.

Parameters:
  RoleName:
    Type: String
    Default: ` + SuggestedRoleName + `

Resources:
  RivoDeployRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Ref RoleName
      MaxSessionDuration: 7200
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              AWS: arn:aws:iam::` + trustedAccount + `:root
            Action: sts:AssumeRole
            Condition:
              StringEquals:
                sts:ExternalId: ` + externalID + `
              ArnEquals:
                aws:PrincipalArn:` + principals + `
      Policies:
        - PolicyName: rivo-deploy
          PolicyDocument:
            Version: "2012-10-17"
            Statement:
              - Sid: Services
                Effect: Allow
                Action:
                  - lambda:*
                  - apigateway:*
                  - dynamodb:*
                  - s3:*
                  - cloudfront:*
                  - events:*
                  - logs:*
                  - sts:GetCallerIdentity
                Resource: "*"
              - Sid: FunctionRoles
                Effect: Allow
                Action:
                  - iam:CreateRole
                  - iam:DeleteRole
                  - iam:GetRole
                  - iam:TagRole
                  - iam:UntagRole
                  - iam:UpdateAssumeRolePolicy
                  - iam:PutRolePolicy
                  - iam:GetRolePolicy
                  - iam:DeleteRolePolicy
                  - iam:ListRolePolicies
                  - iam:ListAttachedRolePolicies
                  - iam:ListInstanceProfilesForRole
                  - iam:AttachRolePolicy
                  - iam:DetachRolePolicy
                  - iam:PassRole
                Resource: "*"

Outputs:
  RoleArn:
    Description: Paste this in Rivo.
    Value: !GetAtt RivoDeployRole.Arn
`
}
