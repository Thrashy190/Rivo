// Package project holds projects, which belong to one workspace, and their
// saved diagrams. DynamoDB stores the project and S3 stores the diagrams.
package project

import (
	"encoding/json"
	"regexp"
)

const (
	StatusDraft     = "draft"
	StatusDeploying = "deploying"
	StatusDeployed  = "deployed"
	StatusFailed    = "failed"

	DefaultEnvironment = "development"

	// MaxDiagramBytes keeps a diagram under the 6 MB limit of a Lambda response,
	// leaving room for the fields around it.
	MaxDiagramBytes = 5 * 1024 * 1024
)

var regionPattern = regexp.MustCompile(`^[a-z]{2}(-[a-z]+)+-[0-9]+$`)

type Project struct {
	WorkspaceID   string `dynamodbav:"workspace_id" json:"workspaceId"`
	ID            string `dynamodbav:"id" json:"projectId"`
	FolderID      string `dynamodbav:"folder_id,omitempty" json:"folderId,omitempty"`
	Name          string `dynamodbav:"name" json:"name"`
	Description   string `dynamodbav:"description" json:"description"`
	Region        string `dynamodbav:"region" json:"region"`
	Environment   string `dynamodbav:"environment" json:"environment"`
	Status        string `dynamodbav:"status" json:"status"`
	LatestVersion int    `dynamodbav:"latest_version" json:"latestVersion"`
	CreatedBy     string `dynamodbav:"created_by" json:"createdBy"`
	CreatedAt     int64  `dynamodbav:"created_at" json:"createdAt"`
	UpdatedAt     int64  `dynamodbav:"updated_at" json:"updatedAt"`
}

type CreateProjectInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	FolderID    string `json:"folderId"`
	Region      string `json:"region"`
	Environment string `json:"environment"`
}

// UpdateProjectInput uses pointers to tell "not sent" (nil) from "sent empty",
// so a PATCH only changes the fields it includes. An empty FolderID moves the
// project out of its folder.
type UpdateProjectInput struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	FolderID    *string `json:"folderId"`
}

// Version is a saved, unchangeable copy of a project's diagram.
type Version struct {
	ProjectID string `dynamodbav:"project_id" json:"projectId"`
	Number    int    `dynamodbav:"number" json:"number"`
	Note      string `dynamodbav:"note,omitempty" json:"note,omitempty"`
	CreatedBy string `dynamodbav:"created_by" json:"createdBy"`
	CreatedAt int64  `dynamodbav:"created_at" json:"createdAt"`
}

type CreateVersionInput struct {
	Note string `json:"note"`
}

// DiagramResponse carries a diagram with the ETag to send when saving it, so two
// people editing at once cannot silently overwrite each other.
type DiagramResponse struct {
	ETag  string          `json:"etag,omitempty"`
	Model json.RawMessage `json:"model"`
}

// EmptyDiagram is what a project shows before its first save.
var EmptyDiagram = json.RawMessage(`{"version":"canvas/1","nodes":[],"edges":[]}`)

func ValidRegion(region string) bool {
	return regionPattern.MatchString(region)
}

// ValidDiagram checks the shape of a diagram before it is stored: the
// deployment engine reads these files later.
func ValidDiagram(body []byte) bool {
	var d struct {
		Version string             `json:"version"`
		Nodes   *[]json.RawMessage `json:"nodes"`
		Edges   *[]json.RawMessage `json:"edges"`
	}
	if err := json.Unmarshal(body, &d); err != nil {
		return false
	}
	return d.Version != "" && d.Nodes != nil && d.Edges != nil
}
