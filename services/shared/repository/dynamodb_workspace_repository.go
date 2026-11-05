package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
)

// membersByUserIndex is the GSI that lists the workspaces of one user.
const membersByUserIndex = "user_id-index"

type DynamoDBWorkspaceRepository struct {
	client  *dynamodb.Client
	table   string
	members string
}

func NewDynamoDBWorkspaceRepository(client *dynamodb.Client, table, membersTable string) *DynamoDBWorkspaceRepository {
	return &DynamoDBWorkspaceRepository{client: client, table: table, members: membersTable}
}

// CreateWithOwner writes the workspace and its first owner together, so a
// workspace can never exist without someone able to manage it.
func (r *DynamoDBWorkspaceRepository) CreateWithOwner(ctx context.Context, w *workspace.Workspace, owner *workspace.Membership) error {
	wItem, err := attributevalue.MarshalMap(w)
	if err != nil {
		return apierrors.Internal(fmt.Errorf("marshal workspace: %w", err))
	}
	mItem, err := attributevalue.MarshalMap(owner)
	if err != nil {
		return apierrors.Internal(fmt.Errorf("marshal membership: %w", err))
	}

	_, err = r.client.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{
		TransactItems: []types.TransactWriteItem{
			{Put: &types.Put{TableName: aws.String(r.table), Item: wItem, ConditionExpression: aws.String("attribute_not_exists(id)")}},
			{Put: &types.Put{TableName: aws.String(r.members), Item: mItem, ConditionExpression: aws.String("attribute_not_exists(user_id)")}},
		},
	})
	if err != nil {
		return apierrors.Internal(fmt.Errorf("dynamodb TransactWriteItems: %w", err))
	}
	return nil
}

func (r *DynamoDBWorkspaceRepository) GetByID(ctx context.Context, id string) (*workspace.Workspace, error) {
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.table),
		Key:       map[string]types.AttributeValue{"id": &types.AttributeValueMemberS{Value: id}},
	})
	if err != nil {
		return nil, apierrors.Internal(fmt.Errorf("dynamodb GetItem: %w", err))
	}
	if out.Item == nil {
		return nil, apierrors.NotFound("workspace")
	}

	var w workspace.Workspace
	if err := attributevalue.UnmarshalMap(out.Item, &w); err != nil {
		return nil, apierrors.Internal(fmt.Errorf("unmarshal workspace: %w", err))
	}
	return &w, nil
}

// GetMany reads each workspace individually: a user belongs to few of them, and
// this avoids handling the partial results of BatchGetItem.
func (r *DynamoDBWorkspaceRepository) GetMany(ctx context.Context, ids []string) ([]workspace.Workspace, error) {
	result := make([]workspace.Workspace, 0, len(ids))
	for _, id := range ids {
		w, err := r.GetByID(ctx, id)
		if err != nil {
			var apiErr *apierrors.ApiError
			if errors.As(err, &apiErr) && apiErr.Code == apierrors.CodeNotFound {
				continue
			}
			return nil, err
		}
		result = append(result, *w)
	}
	return result, nil
}

type DynamoDBMembershipRepository struct {
	client *dynamodb.Client
	table  string
}

func NewDynamoDBMembershipRepository(client *dynamodb.Client, table string) *DynamoDBMembershipRepository {
	return &DynamoDBMembershipRepository{client: client, table: table}
}

func membershipKey(workspaceID, userID string) map[string]types.AttributeValue {
	return map[string]types.AttributeValue{
		"workspace_id": &types.AttributeValueMemberS{Value: workspaceID},
		"user_id":      &types.AttributeValueMemberS{Value: userID},
	}
}

// Get satisfies authz.MembershipLoader, so every workspace route calls it.
func (r *DynamoDBMembershipRepository) Get(ctx context.Context, workspaceID, userID string) (*workspace.Membership, error) {
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName:      aws.String(r.table),
		Key:            membershipKey(workspaceID, userID),
		ConsistentRead: aws.Bool(true),
	})
	if err != nil {
		return nil, apierrors.Internal(fmt.Errorf("dynamodb GetItem: %w", err))
	}
	if out.Item == nil {
		return nil, apierrors.NotFound("member")
	}

	var m workspace.Membership
	if err := attributevalue.UnmarshalMap(out.Item, &m); err != nil {
		return nil, apierrors.Internal(fmt.Errorf("unmarshal membership: %w", err))
	}
	return &m, nil
}

func (r *DynamoDBMembershipRepository) Create(ctx context.Context, m *workspace.Membership) error {
	item, err := attributevalue.MarshalMap(m)
	if err != nil {
		return apierrors.Internal(fmt.Errorf("marshal membership: %w", err))
	}

	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName:           aws.String(r.table),
		Item:                item,
		ConditionExpression: aws.String("attribute_not_exists(user_id)"),
	})
	if err != nil {
		var exists *types.ConditionalCheckFailedException
		if errors.As(err, &exists) {
			return apierrors.Conflict("this user is already a member of the workspace")
		}
		return apierrors.Internal(fmt.Errorf("dynamodb PutItem: %w", err))
	}
	return nil
}

func (r *DynamoDBMembershipRepository) UpdateRole(ctx context.Context, workspaceID, userID string, role workspace.Role) (*workspace.Membership, error) {
	out, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:           aws.String(r.table),
		Key:                 membershipKey(workspaceID, userID),
		UpdateExpression:    aws.String("SET #role = :role, updated_at = :now"),
		ConditionExpression: aws.String("attribute_exists(user_id)"),
		ExpressionAttributeNames: map[string]string{
			"#role": "role",
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":role": &types.AttributeValueMemberS{Value: string(role)},
			":now":  &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", time.Now().UTC().UnixMilli())},
		},
		ReturnValues: types.ReturnValueAllNew,
	})
	if err != nil {
		var missing *types.ConditionalCheckFailedException
		if errors.As(err, &missing) {
			return nil, apierrors.NotFound("member")
		}
		return nil, apierrors.Internal(fmt.Errorf("dynamodb UpdateItem: %w", err))
	}

	var m workspace.Membership
	if err := attributevalue.UnmarshalMap(out.Attributes, &m); err != nil {
		return nil, apierrors.Internal(fmt.Errorf("unmarshal membership: %w", err))
	}
	return &m, nil
}

func (r *DynamoDBMembershipRepository) Delete(ctx context.Context, workspaceID, userID string) error {
	_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.table),
		Key:       membershipKey(workspaceID, userID),
	})
	if err != nil {
		return apierrors.Internal(fmt.Errorf("dynamodb DeleteItem: %w", err))
	}
	return nil
}

func (r *DynamoDBMembershipRepository) ListByWorkspace(ctx context.Context, workspaceID string) ([]workspace.Membership, error) {
	return r.query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(r.table),
		KeyConditionExpression: aws.String("workspace_id = :id"),
		ConsistentRead:         aws.Bool(true),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":id": &types.AttributeValueMemberS{Value: workspaceID},
		},
	})
}

func (r *DynamoDBMembershipRepository) ListByUser(ctx context.Context, userID string) ([]workspace.Membership, error) {
	return r.query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(r.table),
		IndexName:              aws.String(membersByUserIndex),
		KeyConditionExpression: aws.String("user_id = :id"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":id": &types.AttributeValueMemberS{Value: userID},
		},
	})
}

func (r *DynamoDBMembershipRepository) query(ctx context.Context, in *dynamodb.QueryInput) ([]workspace.Membership, error) {
	members := []workspace.Membership{}
	pages := dynamodb.NewQueryPaginator(r.client, in)
	for pages.HasMorePages() {
		page, err := pages.NextPage(ctx)
		if err != nil {
			return nil, apierrors.Internal(fmt.Errorf("dynamodb Query: %w", err))
		}
		var batch []workspace.Membership
		if err := attributevalue.UnmarshalListOfMaps(page.Items, &batch); err != nil {
			return nil, apierrors.Internal(fmt.Errorf("unmarshal memberships: %w", err))
		}
		members = append(members, batch...)
	}
	return members, nil
}
