// Package engine starts the deployment engine: a Fargate task that runs
// Terraform on what tfgen generates. The task only gets IDs; it reads the
// rest itself and assumes the connected account's role.
package engine

import (
	"context"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ecs"
	"github.com/aws/aws-sdk-go-v2/service/ecs/types"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
)

// Container is the name of the runner's container in the task definition.
const Container = "runner"

// Config is where tasks run. Subnets is a comma-separated list.
type Config struct {
	Cluster        string
	TaskDefinition string
	Subnets        string
	SecurityGroup  string
}

type Launcher struct {
	client *ecs.Client
	cfg    Config
}

func NewLauncher(client *ecs.Client, cfg Config) *Launcher {
	return &Launcher{client: client, cfg: cfg}
}

// Start runs one phase (plan or apply) of a deployment and returns the task's ARN.
func (l *Launcher) Start(ctx context.Context, workspaceID, deploymentID, phase string) (string, error) {
	out, err := l.client.RunTask(ctx, &ecs.RunTaskInput{
		Cluster:        aws.String(l.cfg.Cluster),
		TaskDefinition: aws.String(l.cfg.TaskDefinition),
		LaunchType:     types.LaunchTypeFargate,
		Count:          aws.Int32(1),
		StartedBy:      aws.String("rivo"),
		// Public subnets without a NAT gateway: the task needs a public IP to
		// reach AWS, and nothing can reach it.
		NetworkConfiguration: &types.NetworkConfiguration{
			AwsvpcConfiguration: &types.AwsVpcConfiguration{
				Subnets:        strings.Split(l.cfg.Subnets, ","),
				SecurityGroups: []string{l.cfg.SecurityGroup},
				AssignPublicIp: types.AssignPublicIpEnabled,
			},
		},
		Overrides: &types.TaskOverride{
			ContainerOverrides: []types.ContainerOverride{{
				Name: aws.String(Container),
				Environment: []types.KeyValuePair{
					{Name: aws.String("WORKSPACE_ID"), Value: aws.String(workspaceID)},
					{Name: aws.String("DEPLOYMENT_ID"), Value: aws.String(deploymentID)},
					{Name: aws.String("PHASE"), Value: aws.String(phase)},
				},
			}},
		},
		Tags: []types.Tag{
			{Key: aws.String("rivo-workspace"), Value: aws.String(workspaceID)},
			{Key: aws.String("rivo-deployment"), Value: aws.String(deploymentID)},
		},
	})
	if err != nil {
		return "", apierrors.Internal(fmt.Errorf("ecs RunTask: %w", err))
	}
	if len(out.Tasks) == 0 {
		reason := "no capacity"
		if len(out.Failures) > 0 && out.Failures[0].Reason != nil {
			reason = *out.Failures[0].Reason
		}
		return "", apierrors.Internal(fmt.Errorf("ecs RunTask started nothing: %s", reason))
	}
	return aws.ToString(out.Tasks[0].TaskArn), nil
}
