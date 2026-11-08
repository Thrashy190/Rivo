package repository

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/connection"
)

// DynamoDBConnectionRepository keys connections by workspace, so an ID from
// another workspace is not found.
type DynamoDBConnectionRepository struct {
	client *dynamodb.Client
	table  string
}

func NewDynamoDBConnectionRepository(client *dynamodb.Client, table string) *DynamoDBConnectionRepository {
	return &DynamoDBConnectionRepository{client: client, table: table}
}

func wsKey(workspaceID, id string) map[string]types.AttributeValue {
	return map[string]types.AttributeValue{
		"workspace_id": &types.AttributeValueMemberS{Value: workspaceID},
		"id":           &types.AttributeValueMemberS{Value: id},
	}
}

func (r *DynamoDBConnectionRepository) Create(ctx context.Context, c *connection.Connection) error {
	item, err := attributevalue.MarshalMap(c)
	if err != nil {
		return apierrors.Internal(fmt.Errorf("marshal connection: %w", err))
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

func (r *DynamoDBConnectionRepository) Get(ctx context.Context, workspaceID, id string) (*connection.Connection, error) {
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName:      aws.String(r.table),
		Key:            wsKey(workspaceID, id),
		ConsistentRead: aws.Bool(true),
	})
	if err != nil {
		return nil, apierrors.Internal(fmt.Errorf("dynamodb GetItem: %w", err))
	}
	if out.Item == nil {
		return nil, apierrors.NotFound("connection")
	}
	var c connection.Connection
	if err := attributevalue.UnmarshalMap(out.Item, &c); err != nil {
		return nil, apierrors.Internal(fmt.Errorf("unmarshal connection: %w", err))
	}
	return &c, nil
}

func (r *DynamoDBConnectionRepository) List(ctx context.Context, workspaceID string) ([]connection.Connection, error) {
	out := []connection.Connection{}
	p := dynamodb.NewQueryPaginator(r.client, &dynamodb.QueryInput{
		TableName:              aws.String(r.table),
		KeyConditionExpression: aws.String("workspace_id = :ws"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":ws": &types.AttributeValueMemberS{Value: workspaceID},
		},
	})
	for p.HasMorePages() {
		page, err := p.NextPage(ctx)
		if err != nil {
			return nil, apierrors.Internal(fmt.Errorf("dynamodb Query: %w", err))
		}
		var items []connection.Connection
		if err := attributevalue.UnmarshalListOfMaps(page.Items, &items); err != nil {
			return nil, apierrors.Internal(fmt.Errorf("unmarshal connections: %w", err))
		}
		out = append(out, items...)
	}
	return out, nil
}

// SetVerification records the result of trying the role. A failed attempt
// keeps the role it tried, so the app can show what went wrong.
func (r *DynamoDBConnectionRepository) SetVerification(ctx context.Context, workspaceID, id, roleARN, accountID, status, lastError string) (*connection.Connection, error) {
	now := strconv.FormatInt(time.Now().UnixMilli(), 10)
	expr := "SET role_arn = :arn, account_id = :account, #status = :status, last_error = :err, updated_at = :now"
	values := map[string]types.AttributeValue{
		":arn":     &types.AttributeValueMemberS{Value: roleARN},
		":account": &types.AttributeValueMemberS{Value: accountID},
		":status":  &types.AttributeValueMemberS{Value: status},
		":err":     &types.AttributeValueMemberS{Value: lastError},
		":now":     &types.AttributeValueMemberN{Value: now},
	}
	if status == connection.StatusVerified {
		expr += ", verified_at = :now"
	}
	out, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                 aws.String(r.table),
		Key:                       wsKey(workspaceID, id),
		UpdateExpression:          aws.String(expr),
		ConditionExpression:       aws.String("attribute_exists(id)"),
		ExpressionAttributeNames:  map[string]string{"#status": "status"},
		ExpressionAttributeValues: values,
		ReturnValues:              types.ReturnValueAllNew,
	})
	if err != nil {
		var missing *types.ConditionalCheckFailedException
		if errors.As(err, &missing) {
			return nil, apierrors.NotFound("connection")
		}
		return nil, apierrors.Internal(fmt.Errorf("dynamodb UpdateItem: %w", err))
	}
	var c connection.Connection
	if err := attributevalue.UnmarshalMap(out.Attributes, &c); err != nil {
		return nil, apierrors.Internal(fmt.Errorf("unmarshal connection: %w", err))
	}
	return &c, nil
}

func (r *DynamoDBConnectionRepository) Delete(ctx context.Context, workspaceID, id string) error {
	_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName:           aws.String(r.table),
		Key:                 wsKey(workspaceID, id),
		ConditionExpression: aws.String("attribute_exists(id)"),
	})
	if err != nil {
		var missing *types.ConditionalCheckFailedException
		if errors.As(err, &missing) {
			return apierrors.NotFound("connection")
		}
		return apierrors.Internal(fmt.Errorf("dynamodb DeleteItem: %w", err))
	}
	return nil
}
