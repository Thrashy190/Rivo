// The deployment engine. ECS runs it as a Fargate task for one phase of one
// deployment: "plan" generates Terraform from the deployment's diagram with
// tfgen and plans it; "apply" applies that saved plan once someone approved
// it. It never runs Terraform written by a person: only what tfgen generates.
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/Thrashy190/Rivo/services/shared/models/deployment"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/storage"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 55*time.Minute)
	defer cancel()

	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		log.Fatalf("loading AWS config: %v", err)
	}
	db := dynamodb.NewFromConfig(cfg)
	r := &runner{
		workspaceID:  os.Getenv("WORKSPACE_ID"),
		deploymentID: os.Getenv("DEPLOYMENT_ID"),
		phase:        os.Getenv("PHASE"),
		bucket:       os.Getenv("DIAGRAMS_BUCKET"),
		stateRegion:  cfg.Region,
		terraform:    envOr("TERRAFORM_BIN", "/usr/local/bin/terraform"),
		pluginDir:    envOr("TERRAFORM_PLUGIN_DIR", "/opt/terraform/plugins"),
		workDir:      envOr("WORK_DIR", "/tmp/rivo"),
		deployments:  repository.NewDynamoDBDeploymentRepository(db, os.Getenv("DEPLOYMENTS_TABLE_NAME"), os.Getenv("USAGE_TABLE_NAME")),
		projects:     repository.NewDynamoDBProjectRepository(db, os.Getenv("PROJECTS_TABLE_NAME")),
		connections:  repository.NewDynamoDBConnectionRepository(db, os.Getenv("CONNECTIONS_TABLE_NAME")),
		files:        storage.NewS3(s3.NewFromConfig(cfg), os.Getenv("DIAGRAMS_BUCKET")),
	}
	if !deployment.ValidID(r.deploymentID) || r.workspaceID == "" || (r.phase != deployment.PhasePlan && r.phase != deployment.PhaseApply) {
		log.Fatalf("bad task input: workspace %q, deployment %q, phase %q", r.workspaceID, r.deploymentID, r.phase)
	}
	if err := r.run(ctx); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
