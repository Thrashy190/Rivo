// Package deployment holds runs of the engine: a plan of what changes in a
// connected account, approved by a person, and then applied.
package deployment

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
)

const (
	ActionDeploy  = "deploy"
	ActionDestroy = "destroy"

	PhasePlan  = "plan"
	PhaseApply = "apply"

	// Waiting for the engine to plan.
	StatusQueued   = "queued"
	StatusPlanning = "planning"
	// Planned and waiting for someone to approve or cancel it.
	StatusPlanned = "planned"
	// Approved: the engine is applying the plan.
	StatusApplying  = "applying"
	StatusSucceeded = "succeeded"
	StatusFailed    = "failed"
	StatusCancelled = "cancelled"
)

// Finished reports whether the deployment no longer holds its project.
func Finished(status string) bool {
	return status == StatusSucceeded || status == StatusFailed || status == StatusCancelled
}

// Running reports whether an engine task is working on it.
func Running(status string) bool {
	return status == StatusQueued || status == StatusPlanning || status == StatusApplying
}

// Summary counts what the plan changes.
type Summary struct {
	Add     int `dynamodbav:"add" json:"add"`
	Change  int `dynamodbav:"change" json:"change"`
	Destroy int `dynamodbav:"destroy" json:"destroy"`
}

type Deployment struct {
	WorkspaceID    string `dynamodbav:"workspace_id" json:"workspaceId"`
	ID             string `dynamodbav:"id" json:"deploymentId"`
	ProjectID      string `dynamodbav:"project_id" json:"projectId"`
	ProjectName    string `dynamodbav:"project_name" json:"projectName"`
	ConnectionID   string `dynamodbav:"connection_id" json:"connectionId"`
	ConnectionName string `dynamodbav:"connection_name" json:"connectionName"`
	AccountID      string `dynamodbav:"account_id" json:"accountId"`
	Region         string `dynamodbav:"region" json:"region"`
	Action         string `dynamodbav:"action" json:"action"`
	Status         string `dynamodbav:"status" json:"status"`
	// What the plan changes, once planned.
	Summary *Summary `dynamodbav:"summary,omitempty" json:"summary,omitempty"`
	Error   string   `dynamodbav:"error,omitempty" json:"error,omitempty"`
	// What the deployed services are reachable at, once applied.
	Endpoints Endpoints `dynamodbav:"endpoints,omitempty" json:"endpoints,omitempty"`

	CreatedBy      string `dynamodbav:"created_by" json:"createdBy"`
	CreatedByEmail string `dynamodbav:"created_by_email,omitempty" json:"createdByEmail,omitempty"`
	ApprovedBy     string `dynamodbav:"approved_by,omitempty" json:"approvedBy,omitempty"`
	ApprovedEmail  string `dynamodbav:"approved_email,omitempty" json:"approvedByEmail,omitempty"`

	CreatedAt  int64 `dynamodbav:"created_at" json:"createdAt"`
	StartedAt  int64 `dynamodbav:"started_at,omitempty" json:"startedAt,omitempty"`
	PlannedAt  int64 `dynamodbav:"planned_at,omitempty" json:"plannedAt,omitempty"`
	ApprovedAt int64 `dynamodbav:"approved_at,omitempty" json:"approvedAt,omitempty"`
	FinishedAt int64 `dynamodbav:"finished_at,omitempty" json:"finishedAt,omitempty"`
	UpdatedAt  int64 `dynamodbav:"updated_at" json:"updatedAt"`
	// Seconds the engine ran for each phase, which hosting may bill by.
	PlanSeconds  int64  `dynamodbav:"plan_seconds,omitempty" json:"planSeconds,omitempty"`
	ApplySeconds int64  `dynamodbav:"apply_seconds,omitempty" json:"applySeconds,omitempty"`
	TaskARN      string `dynamodbav:"task_arn,omitempty" json:"-"`
}

type CreateInput struct {
	ConnectionID string `json:"connectionId"`
	// deploy (the default) or destroy.
	Action string `json:"action"`
}

// Change is one resource the plan touches.
type Change struct {
	Address string   `json:"address"`
	Type    string   `json:"type"`
	Actions []string `json:"actions"`
}

// OutputRef says which node and kind of address a Terraform output is.
type OutputRef struct {
	Name   string `json:"name"`
	NodeID string `json:"nodeId"`
	Kind   string `json:"kind"`
}

// Warning is something the generator left out or changed, by node.
type Warning struct {
	NodeID  string `json:"nodeId,omitempty"`
	Message string `json:"message"`
}

// Plan is the readable part of a plan, stored next to it.
type Plan struct {
	Summary  Summary     `json:"summary"`
	Changes  []Change    `json:"changes"`
	Outputs  []OutputRef `json:"outputs"`
	Warnings []Warning   `json:"warnings"`
}

// Endpoints are what each deployed node is reachable at, from the outputs:
// node ID, then kind (url, function_name, table_name, bucket), then value.
type Endpoints map[string]map[string]string

// Detail is a deployment with its plan and log, as the app shows it.
type Detail struct {
	Deployment
	Plan *Plan  `json:"plan,omitempty"`
	Log  string `json:"log"`
}

// NewID returns an ID that sorts by creation time, so the newest come first
// when listing in reverse.
func NewID(now time.Time) string {
	b := make([]byte, 5)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return fmt.Sprintf("%013d-%s", now.UnixMilli(), hex.EncodeToString(b))
}

func ValidID(id string) bool {
	if len(id) != 24 || id[13] != '-' {
		return false
	}
	for i, c := range id {
		if i == 13 {
			continue
		}
		if (c < '0' || c > '9') && (c < 'a' || c > 'f' || i < 13) {
			return false
		}
	}
	return true
}

// Usage is the engine time of a workspace in one month.
type Usage struct {
	WorkspaceID string `dynamodbav:"workspace_id" json:"workspaceId"`
	Month       string `dynamodbav:"month" json:"month"`
	TaskSeconds int64  `dynamodbav:"task_seconds" json:"taskSeconds"`
	Runs        int64  `dynamodbav:"runs" json:"runs"`
}
