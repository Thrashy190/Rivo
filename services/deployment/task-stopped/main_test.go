package main

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/aws/aws-lambda-go/events"

	"github.com/Thrashy190/Rivo/services/shared/models/deployment"
	"github.com/Thrashy190/Rivo/services/shared/repository"
)

type fakeDeployments struct{ d *deployment.Deployment }

func (f *fakeDeployments) Get(context.Context, string, string) (*deployment.Deployment, error) {
	c := *f.d
	return &c, nil
}

func (f *fakeDeployments) Transition(_ context.Context, _, _ string, from []string, to string, _ map[string]any) (*deployment.Deployment, error) {
	for _, s := range from {
		if s == f.d.Status {
			f.d.Status = to
			return f.d, nil
		}
	}
	return nil, context.Canceled
}

type fakeProjects struct{ unlocked int }

func (f *fakeProjects) Unlock(context.Context, string, string, string, *repository.DeploymentResult) error {
	f.unlocked++
	return nil
}

func stopped(phase string) events.CloudWatchEvent {
	detail, _ := json.Marshal(map[string]any{
		"lastStatus":    "STOPPED",
		"stoppedReason": "Essential container in task exited",
		"overrides": map[string]any{"containerOverrides": []any{map[string]any{"environment": []any{
			map[string]string{"name": "WORKSPACE_ID", "value": "ws"},
			map[string]string{"name": "DEPLOYMENT_ID", "value": "1794101447068-c48988b189"},
			map[string]string{"name": "PHASE", "value": phase},
		}}}},
	})
	return events.CloudWatchEvent{Detail: detail}
}

func TestThePlanTaskStoppingDoesNotFailTheApply(t *testing.T) {
	d := &fakeDeployments{d: &deployment.Deployment{WorkspaceID: "ws", ID: "1794101447068-c48988b189", Status: deployment.StatusApplying}}
	p := &fakeProjects{}
	deployments, projects = d, p
	if err := handler(context.Background(), stopped(deployment.PhasePlan)); err != nil {
		t.Fatal(err)
	}
	if d.d.Status != deployment.StatusApplying || p.unlocked != 0 {
		t.Errorf("status %s, unlocked %d", d.d.Status, p.unlocked)
	}
	// The apply task dying does fail it.
	if err := handler(context.Background(), stopped(deployment.PhaseApply)); err != nil {
		t.Fatal(err)
	}
	if d.d.Status != deployment.StatusFailed || p.unlocked != 1 {
		t.Errorf("status %s, unlocked %d", d.d.Status, p.unlocked)
	}
}

func TestADeadPlanTaskFailsItsPlan(t *testing.T) {
	d := &fakeDeployments{d: &deployment.Deployment{WorkspaceID: "ws", ID: "1794101447068-c48988b189", Status: deployment.StatusPlanning}}
	deployments, projects = d, &fakeProjects{}
	_ = handler(context.Background(), stopped(deployment.PhasePlan))
	if d.d.Status != deployment.StatusFailed {
		t.Errorf("status %s", d.d.Status)
	}
}
