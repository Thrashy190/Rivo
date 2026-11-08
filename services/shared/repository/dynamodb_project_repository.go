package repository

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
)

// DynamoDBProjectRepository keys every project by workspace, so a project ID
// from another workspace is simply not found.
type DynamoDBProjectRepository struct {
	client *dynamodb.Client
	table  string
}

func NewDynamoDBProjectRepository(client *dynamodb.Client, table string) *DynamoDBProjectRepository {
	return &DynamoDBProjectRepository{client: client, table: table}
}

func projectKey(workspaceID, id string) map[string]types.AttributeValue {
	return map[string]types.AttributeValue{
		"workspace_id": &types.AttributeValueMemberS{Value: workspaceID},
		"id":           &types.AttributeValueMemberS{Value: id},
	}
}

func nowMillis() string {
	return strconv.FormatInt(time.Now().UTC().UnixMilli(), 10)
}

func (r *DynamoDBProjectRepository) GetByID(ctx context.Context, workspaceID, id string) (*project.Project, error) {
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName:      aws.String(r.table),
		Key:            projectKey(workspaceID, id),
		ConsistentRead: aws.Bool(true),
	})
	if err != nil {
		return nil, apierrors.Internal(fmt.Errorf("dynamodb GetItem: %w", err))
	}
	if out.Item == nil {
		return nil, apierrors.NotFound("project")
	}

	var p project.Project
	if err := attributevalue.UnmarshalMap(out.Item, &p); err != nil {
		return nil, apierrors.Internal(fmt.Errorf("unmarshal project: %w", err))
	}
	return &p, nil
}

func (r *DynamoDBProjectRepository) Create(ctx context.Context, p *project.Project) error {
	item, err := attributevalue.MarshalMap(p)
	if err != nil {
		return apierrors.Internal(fmt.Errorf("marshal project: %w", err))
	}
	if _, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(r.table), Item: item}); err != nil {
		return apierrors.Internal(fmt.Errorf("dynamodb PutItem: %w", err))
	}
	return nil
}

// Update only writes the fields present in `in`, instead of reading, merging and
// rewriting the whole item.
func (r *DynamoDBProjectRepository) Update(ctx context.Context, workspaceID, id string, in project.UpdateProjectInput) (*project.Project, error) {
	sets := []string{"updated_at = :now"}
	names := map[string]string{}
	values := map[string]types.AttributeValue{
		":now": &types.AttributeValueMemberN{Value: nowMillis()},
	}

	if in.Name != nil {
		// "name" is a reserved word in DynamoDB.
		sets = append(sets, "#name = :name")
		names["#name"] = "name"
		values[":name"] = &types.AttributeValueMemberS{Value: *in.Name}
	}
	if in.Description != nil {
		sets = append(sets, "description = :description")
		values[":description"] = &types.AttributeValueMemberS{Value: *in.Description}
	}
	if in.FolderID != nil {
		sets = append(sets, "folder_id = :folder")
		values[":folder"] = &types.AttributeValueMemberS{Value: *in.FolderID}
	}
	if len(sets) == 1 {
		return nil, apierrors.Validation("no fields to update")
	}

	input := &dynamodb.UpdateItemInput{
		TableName:                 aws.String(r.table),
		Key:                       projectKey(workspaceID, id),
		UpdateExpression:          aws.String("SET " + strings.Join(sets, ", ")),
		ExpressionAttributeValues: values,
		ConditionExpression:       aws.String("attribute_exists(id)"),
		ReturnValues:              types.ReturnValueAllNew,
	}
	// DynamoDB rejects ExpressionAttributeNames when it is present but empty.
	if len(names) > 0 {
		input.ExpressionAttributeNames = names
	}

	return r.updateAndReturn(ctx, input)
}

// Touch records that the project's diagram changed.
func (r *DynamoDBProjectRepository) Touch(ctx context.Context, workspaceID, id string) error {
	_, err := r.updateAndReturn(ctx, &dynamodb.UpdateItemInput{
		TableName:        aws.String(r.table),
		Key:              projectKey(workspaceID, id),
		UpdateExpression: aws.String("SET updated_at = :now"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":now": &types.AttributeValueMemberN{Value: nowMillis()},
		},
		ConditionExpression: aws.String("attribute_exists(id)"),
		ReturnValues:        types.ReturnValueAllNew,
	})
	return err
}

// NextVersion reserves the next version number atomically, so two people saving
// a version at once never get the same one.
func (r *DynamoDBProjectRepository) NextVersion(ctx context.Context, workspaceID, id string) (int, error) {
	p, err := r.updateAndReturn(ctx, &dynamodb.UpdateItemInput{
		TableName:        aws.String(r.table),
		Key:              projectKey(workspaceID, id),
		UpdateExpression: aws.String("SET latest_version = latest_version + :one, updated_at = :now"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":one": &types.AttributeValueMemberN{Value: "1"},
			":now": &types.AttributeValueMemberN{Value: nowMillis()},
		},
		ConditionExpression: aws.String("attribute_exists(id)"),
		ReturnValues:        types.ReturnValueAllNew,
	})
	if err != nil {
		return 0, err
	}
	return p.LatestVersion, nil
}

func (r *DynamoDBProjectRepository) updateAndReturn(ctx context.Context, input *dynamodb.UpdateItemInput) (*project.Project, error) {
	out, err := r.client.UpdateItem(ctx, input)
	if err != nil {
		var missing *types.ConditionalCheckFailedException
		if errors.As(err, &missing) {
			return nil, apierrors.NotFound("project")
		}
		return nil, apierrors.Internal(fmt.Errorf("dynamodb UpdateItem: %w", err))
	}

	var p project.Project
	if err := attributevalue.UnmarshalMap(out.Attributes, &p); err != nil {
		return nil, apierrors.Internal(fmt.Errorf("unmarshal project: %w", err))
	}
	return &p, nil
}

func (r *DynamoDBProjectRepository) Delete(ctx context.Context, workspaceID, id string) error {
	_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName:           aws.String(r.table),
		Key:                 projectKey(workspaceID, id),
		ConditionExpression: aws.String("attribute_exists(id)"),
	})
	if err != nil {
		var missing *types.ConditionalCheckFailedException
		if errors.As(err, &missing) {
			return apierrors.NotFound("project")
		}
		return apierrors.Internal(fmt.Errorf("dynamodb DeleteItem: %w", err))
	}
	return nil
}

// List only reads one workspace's partition, so projects never cross tenants.
func (r *DynamoDBProjectRepository) List(ctx context.Context, workspaceID string) ([]project.Project, error) {
	projects := []project.Project{}
	pages := dynamodb.NewQueryPaginator(r.client, &dynamodb.QueryInput{
		TableName:              aws.String(r.table),
		KeyConditionExpression: aws.String("workspace_id = :id"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":id": &types.AttributeValueMemberS{Value: workspaceID},
		},
	})
	for pages.HasMorePages() {
		page, err := pages.NextPage(ctx)
		if err != nil {
			return nil, apierrors.Internal(fmt.Errorf("dynamodb Query: %w", err))
		}
		var batch []project.Project
		if err := attributevalue.UnmarshalListOfMaps(page.Items, &batch); err != nil {
			return nil, apierrors.Internal(fmt.Errorf("unmarshal projects: %w", err))
		}
		projects = append(projects, batch...)
	}
	return projects, nil
}

// Lock gives the project to a deployment, so only one works on it at a time.
// A lock held by a deployment that already finished (stale) is taken over.
func (r *DynamoDBProjectRepository) Lock(ctx context.Context, workspaceID, id, deploymentID, stale string) error {
	cond := "attribute_exists(id) AND (attribute_not_exists(active_deployment) OR active_deployment = :empty)"
	values := map[string]types.AttributeValue{
		":d":     &types.AttributeValueMemberS{Value: deploymentID},
		":empty": &types.AttributeValueMemberS{Value: ""},
		":now":   &types.AttributeValueMemberN{Value: nowMillis()},
	}
	if stale != "" {
		cond = "attribute_exists(id) AND active_deployment = :stale"
		delete(values, ":empty")
		values[":stale"] = &types.AttributeValueMemberS{Value: stale}
	}
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                 aws.String(r.table),
		Key:                       projectKey(workspaceID, id),
		UpdateExpression:          aws.String("SET active_deployment = :d, last_deployment = :d, updated_at = :now"),
		ConditionExpression:       aws.String(cond),
		ExpressionAttributeValues: values,
	})
	if err != nil {
		var held *types.ConditionalCheckFailedException
		if errors.As(err, &held) {
			return apierrors.Conflict("another deployment of this project is in progress")
		}
		return apierrors.Internal(fmt.Errorf("dynamodb UpdateItem: %w", err))
	}
	return nil
}

// DeploymentResult records how a deployment left the project.
type DeploymentResult struct {
	Status string
	// Set while the project has infrastructure in this account; cleared after
	// a destroy.
	ConnectionID string
	Endpoints    map[string]map[string]string
	// The plan was applied, so the endpoints are current.
	Applied bool
}

// Unlock releases the project, if this deployment still holds it, and
// records the result when there is one.
func (r *DynamoDBProjectRepository) Unlock(ctx context.Context, workspaceID, id, deploymentID string, res *DeploymentResult) error {
	sets := []string{"active_deployment = :empty", "updated_at = :now"}
	removes := []string{}
	values := map[string]types.AttributeValue{
		":d":     &types.AttributeValueMemberS{Value: deploymentID},
		":empty": &types.AttributeValueMemberS{Value: ""},
		":now":   &types.AttributeValueMemberN{Value: nowMillis()},
	}
	names := map[string]string{}
	if res != nil {
		names["#status"] = "status"
		sets = append(sets, "#status = :status")
		values[":status"] = &types.AttributeValueMemberS{Value: res.Status}
		if res.ConnectionID != "" {
			sets = append(sets, "connection_id = :conn")
			values[":conn"] = &types.AttributeValueMemberS{Value: res.ConnectionID}
		} else if res.Applied {
			removes = append(removes, "connection_id", "endpoints", "deployed_at")
		}
		if res.Applied && res.ConnectionID != "" {
			ep, err := attributevalue.Marshal(res.Endpoints)
			if err != nil {
				return apierrors.Internal(fmt.Errorf("marshal endpoints: %w", err))
			}
			sets = append(sets, "endpoints = :ep", "deployed_at = :now")
			values[":ep"] = ep
		}
	}
	expr := "SET " + strings.Join(sets, ", ")
	if len(removes) > 0 {
		expr += " REMOVE " + strings.Join(removes, ", ")
	}
	in := &dynamodb.UpdateItemInput{
		TableName:                 aws.String(r.table),
		Key:                       projectKey(workspaceID, id),
		UpdateExpression:          aws.String(expr),
		ConditionExpression:       aws.String("attribute_exists(id) AND active_deployment = :d"),
		ExpressionAttributeValues: values,
	}
	if len(names) > 0 {
		in.ExpressionAttributeNames = names
	}
	_, err := r.client.UpdateItem(ctx, in)
	if err != nil {
		var gone *types.ConditionalCheckFailedException
		if errors.As(err, &gone) {
			return nil // already released, or the project was deleted
		}
		return apierrors.Internal(fmt.Errorf("dynamodb UpdateItem: %w", err))
	}
	return nil
}

// MarkConnection records the account a deployment is about to change, before
// it applies, so a failed apply still leaves the project known to have
// infrastructure there.
func (r *DynamoDBProjectRepository) MarkConnection(ctx context.Context, workspaceID, id, connectionID string) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:        aws.String(r.table),
		Key:              projectKey(workspaceID, id),
		UpdateExpression: aws.String("SET connection_id = :c, #status = :s, updated_at = :now"),
		ExpressionAttributeNames: map[string]string{
			"#status": "status",
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":c":   &types.AttributeValueMemberS{Value: connectionID},
			":s":   &types.AttributeValueMemberS{Value: "deploying"},
			":now": &types.AttributeValueMemberN{Value: nowMillis()},
		},
		ConditionExpression: aws.String("attribute_exists(id)"),
	})
	if err != nil {
		return apierrors.Internal(fmt.Errorf("dynamodb UpdateItem: %w", err))
	}
	return nil
}
