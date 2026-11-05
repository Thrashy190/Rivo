package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	apierrors "github.com/rivo-api/shared/errors"
	"github.com/rivo-api/shared/models/user"
)

type DynamoDBUserRepository struct {
	client *dynamodb.Client
	table  string
}

func NewDynamoDBUserRepository(client *dynamodb.Client, table string) *DynamoDBUserRepository {
	return &DynamoDBUserRepository{client: client, table: table}
}

// GetByID satisface authz.UserLoader, así que lo llama cada handler
// protegido una vez por request.
func (r *DynamoDBUserRepository) GetByID(ctx context.Context, id string) (*user.User, error) {
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.table),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberS{Value: id},
		},
	})
	if err != nil {
		return nil, apierrors.Internal(fmt.Errorf("dynamodb GetItem: %w", err))
	}
	if out.Item == nil {
		return nil, apierrors.NotFound("user")
	}

	var u user.User
	if err := attributevalue.UnmarshalMap(out.Item, &u); err != nil {
		return nil, apierrors.Internal(fmt.Errorf("unmarshal user: %w", err))
	}
	return &u, nil
}

func (r *DynamoDBUserRepository) Create(ctx context.Context, u *user.User) error {
	item, err := attributevalue.MarshalMap(u)
	if err != nil {
		return apierrors.Internal(fmt.Errorf("marshal user: %w", err))
	}

	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName:           aws.String(r.table),
		Item:                item,
		ConditionExpression: aws.String("attribute_not_exists(id)"),
	})
	if err != nil {
		var condErr *types.ConditionalCheckFailedException
		if errors.As(err, &condErr) {
			return apierrors.Conflict("user already exists")
		}
		return apierrors.Internal(fmt.Errorf("dynamodb PutItem: %w", err))
	}

	return nil
}

func (r *DynamoDBUserRepository) Update(ctx context.Context, id string, in user.UpdateUserInput) (*user.User, error) {
	// "role" y "status" son palabras reservadas en DynamoDB, necesitan alias.
	sets := []string{"updated_at = :updated_at"}
	exprNames := map[string]string{}
	exprValues := map[string]types.AttributeValue{
		":updated_at": &types.AttributeValueMemberN{Value: fmt.Sprint(time.Now().UTC().UnixMilli())},
	}

	if in.Role != nil {
		sets = append(sets, "#role = :role")
		exprNames["#role"] = "role"
		exprValues[":role"] = &types.AttributeValueMemberS{Value: string(*in.Role)}
	}
	if in.Status != nil {
		sets = append(sets, "#status = :status")
		exprNames["#status"] = "status"
		exprValues[":status"] = &types.AttributeValueMemberS{Value: *in.Status}
	}
	if in.Permissions != nil {
		perms, err := attributevalue.Marshal(*in.Permissions)
		if err != nil {
			return nil, apierrors.Internal(fmt.Errorf("marshal permissions: %w", err))
		}
		sets = append(sets, "permissions = :permissions")
		exprValues[":permissions"] = perms
	}
	if len(sets) == 1 {
		return nil, apierrors.Validation("no fields to update")
	}

	input := &dynamodb.UpdateItemInput{
		TableName: aws.String(r.table),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberS{Value: id},
		},
		UpdateExpression:          aws.String("SET " + strings.Join(sets, ", ")),
		ExpressionAttributeValues: exprValues,
		ConditionExpression:       aws.String("attribute_exists(id)"),
		ReturnValues:              types.ReturnValueAllNew,
	}
	if len(exprNames) > 0 {
		input.ExpressionAttributeNames = exprNames
	}

	out, err := r.client.UpdateItem(ctx, input)
	if err != nil {
		var condErr *types.ConditionalCheckFailedException
		if errors.As(err, &condErr) {
			return nil, apierrors.NotFound("user")
		}
		return nil, apierrors.Internal(fmt.Errorf("dynamodb UpdateItem: %w", err))
	}

	var u user.User
	if err := attributevalue.UnmarshalMap(out.Attributes, &u); err != nil {
		return nil, apierrors.Internal(fmt.Errorf("unmarshal user: %w", err))
	}
	return &u, nil
}

func (r *DynamoDBUserRepository) Delete(ctx context.Context, id string) error {
	_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.table),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberS{Value: id},
		},
		ConditionExpression: aws.String("attribute_exists(id)"),
	})
	if err != nil {
		var condErr *types.ConditionalCheckFailedException
		if errors.As(err, &condErr) {
			return apierrors.NotFound("user")
		}
		return apierrors.Internal(fmt.Errorf("dynamodb DeleteItem: %w", err))
	}
	return nil
}

func (r *DynamoDBUserRepository) List(ctx context.Context) ([]user.User, error) {
	out, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName: aws.String(r.table),
	})
	if err != nil {
		return nil, apierrors.Internal(fmt.Errorf("dynamodb Scan: %w", err))
	}

	users := make([]user.User, 0, len(out.Items))
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &users); err != nil {
		return nil, apierrors.Internal(fmt.Errorf("unmarshal users: %w", err))
	}
	return users, nil
}
