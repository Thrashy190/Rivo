package repository

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/deployment"
)

// DynamoDBDeploymentRepository keys deployments by workspace. IDs sort by
// time, so listing in reverse gives the newest first. The project-index GSI
// lists one project's deployments.
type DynamoDBDeploymentRepository struct {
	client *dynamodb.Client
	table  string
	usage  string
}

func NewDynamoDBDeploymentRepository(client *dynamodb.Client, table, usageTable string) *DynamoDBDeploymentRepository {
	return &DynamoDBDeploymentRepository{client: client, table: table, usage: usageTable}
}

const projectIndex = "project-index"

func (r *DynamoDBDeploymentRepository) Create(ctx context.Context, d *deployment.Deployment) error {
	item, err := attributevalue.MarshalMap(d)
	if err != nil {
		return apierrors.Internal(fmt.Errorf("marshal deployment: %w", err))
	}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName:           aws.String(r.table),
		Item:                item,
		ConditionExpression: aws.String("attribute_not_exists(id)"),
	})
	if err != nil {
		return apierrors.Internal(fmt.Errorf("dynamodb PutItem: %w", err))
	}
	return nil
}

func (r *DynamoDBDeploymentRepository) Get(ctx context.Context, workspaceID, id string) (*deployment.Deployment, error) {
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName:      aws.String(r.table),
		Key:            wsKey(workspaceID, id),
		ConsistentRead: aws.Bool(true),
	})
	if err != nil {
		return nil, apierrors.Internal(fmt.Errorf("dynamodb GetItem: %w", err))
	}
	if out.Item == nil {
		return nil, apierrors.NotFound("deployment")
	}
	var d deployment.Deployment
	if err := attributevalue.UnmarshalMap(out.Item, &d); err != nil {
		return nil, apierrors.Internal(fmt.Errorf("unmarshal deployment: %w", err))
	}
	return &d, nil
}

// Page is one page of deployments, newest first, with the cursor of the next.
type Page struct {
	Items      []deployment.Deployment `json:"items"`
	NextCursor string                  `json:"nextCursor,omitempty"`
}

// List returns a workspace's deployments, or one project's when projectID is
// set, newest first.
func (r *DynamoDBDeploymentRepository) List(ctx context.Context, workspaceID, projectID string, limit int, cursor string) (*Page, error) {
	in := &dynamodb.QueryInput{
		TableName:              aws.String(r.table),
		KeyConditionExpression: aws.String("workspace_id = :ws"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":ws": &types.AttributeValueMemberS{Value: workspaceID},
		},
		ScanIndexForward: aws.Bool(false),
		Limit:            aws.Int32(int32(limit)),
	}
	if projectID != "" {
		// The index is keyed by project, so the workspace is checked as well:
		// project IDs are unique, but the filter keeps tenants apart anyway.
		in.IndexName = aws.String(projectIndex)
		in.KeyConditionExpression = aws.String("project_id = :p")
		in.FilterExpression = aws.String("workspace_id = :ws")
		in.ExpressionAttributeValues[":p"] = &types.AttributeValueMemberS{Value: projectID}
	}
	if cursor != "" {
		start, err := decodeCursor(cursor)
		if err != nil {
			return nil, apierrors.Validation("cursor is not one this API returned")
		}
		in.ExclusiveStartKey = start
	}
	out, err := r.client.Query(ctx, in)
	if err != nil {
		return nil, apierrors.Internal(fmt.Errorf("dynamodb Query: %w", err))
	}
	page := &Page{Items: []deployment.Deployment{}}
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &page.Items); err != nil {
		return nil, apierrors.Internal(fmt.Errorf("unmarshal deployments: %w", err))
	}
	if len(out.LastEvaluatedKey) > 0 {
		page.NextCursor = encodeCursor(out.LastEvaluatedKey)
	}
	return page, nil
}

// Keys in a cursor are all strings: workspace_id, id and project_id.
func encodeCursor(key map[string]types.AttributeValue) string {
	flat := map[string]string{}
	for k, v := range key {
		if s, ok := v.(*types.AttributeValueMemberS); ok {
			flat[k] = s.Value
		}
	}
	b, _ := json.Marshal(flat)
	return base64.RawURLEncoding.EncodeToString(b)
}

func decodeCursor(cursor string) (map[string]types.AttributeValue, error) {
	b, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return nil, err
	}
	var flat map[string]string
	if err := json.Unmarshal(b, &flat); err != nil {
		return nil, err
	}
	key := map[string]types.AttributeValue{}
	for k, v := range flat {
		if k != "workspace_id" && k != "id" && k != "project_id" {
			return nil, errors.New("unknown key")
		}
		key[k] = &types.AttributeValueMemberS{Value: v}
	}
	return key, nil
}

// Transition changes a deployment's status and fields, only if its status is
// still one of from. Anything else answers Conflict, so two requests cannot
// both approve or cancel it.
func (r *DynamoDBDeploymentRepository) Transition(ctx context.Context, workspaceID, id string, from []string, to string, fields map[string]any) (*deployment.Deployment, error) {
	sets := []string{"#status = :to", "updated_at = :now"}
	names := map[string]string{"#status": "status"}
	values := map[string]types.AttributeValue{
		":to":  &types.AttributeValueMemberS{Value: to},
		":now": &types.AttributeValueMemberN{Value: strconv.FormatInt(time.Now().UnixMilli(), 10)},
	}
	keys := make([]string, 0, len(fields))
	for k := range fields {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for i, k := range keys {
		av, err := attributevalue.Marshal(fields[k])
		if err != nil {
			return nil, apierrors.Internal(fmt.Errorf("marshal %s: %w", k, err))
		}
		n, v := fmt.Sprintf("#f%d", i), fmt.Sprintf(":f%d", i)
		names[n] = k
		values[v] = av
		sets = append(sets, n+" = "+v)
	}
	allowed := make([]string, len(from))
	for i, s := range from {
		allowed[i] = fmt.Sprintf(":from%d", i)
		values[allowed[i]] = &types.AttributeValueMemberS{Value: s}
	}
	out, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                 aws.String(r.table),
		Key:                       wsKey(workspaceID, id),
		UpdateExpression:          aws.String("SET " + strings.Join(sets, ", ")),
		ConditionExpression:       aws.String("attribute_exists(id) AND #status IN (" + strings.Join(allowed, ", ") + ")"),
		ExpressionAttributeNames:  names,
		ExpressionAttributeValues: values,
		ReturnValues:              types.ReturnValueAllNew,
	})
	if err != nil {
		var failed *types.ConditionalCheckFailedException
		if errors.As(err, &failed) {
			return nil, apierrors.Conflict("the deployment changed in the meantime: reload it")
		}
		return nil, apierrors.Internal(fmt.Errorf("dynamodb UpdateItem: %w", err))
	}
	var d deployment.Deployment
	if err := attributevalue.UnmarshalMap(out.Attributes, &d); err != nil {
		return nil, apierrors.Internal(fmt.Errorf("unmarshal deployment: %w", err))
	}
	return &d, nil
}

// AddUsage adds engine time to the workspace's month.
func (r *DynamoDBDeploymentRepository) AddUsage(ctx context.Context, workspaceID string, at time.Time, seconds int64) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.usage),
		Key: map[string]types.AttributeValue{
			"workspace_id": &types.AttributeValueMemberS{Value: workspaceID},
			"month":        &types.AttributeValueMemberS{Value: at.UTC().Format("2006-01")},
		},
		UpdateExpression: aws.String("ADD task_seconds :s, runs :one"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":s":   &types.AttributeValueMemberN{Value: strconv.FormatInt(seconds, 10)},
			":one": &types.AttributeValueMemberN{Value: "1"},
		},
	})
	if err != nil {
		return apierrors.Internal(fmt.Errorf("dynamodb UpdateItem usage: %w", err))
	}
	return nil
}

// Usage returns the workspace's engine time in a month, such as "2026-11".
func (r *DynamoDBDeploymentRepository) Usage(ctx context.Context, workspaceID, month string) (*deployment.Usage, error) {
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.usage),
		Key: map[string]types.AttributeValue{
			"workspace_id": &types.AttributeValueMemberS{Value: workspaceID},
			"month":        &types.AttributeValueMemberS{Value: month},
		},
	})
	if err != nil {
		return nil, apierrors.Internal(fmt.Errorf("dynamodb GetItem usage: %w", err))
	}
	u := &deployment.Usage{WorkspaceID: workspaceID, Month: month}
	if out.Item != nil {
		if err := attributevalue.UnmarshalMap(out.Item, u); err != nil {
			return nil, apierrors.Internal(fmt.Errorf("unmarshal usage: %w", err))
		}
	}
	return u, nil
}
