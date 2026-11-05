package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/folder"
)

type DynamoDBFolderRepository struct {
	client *dynamodb.Client
	table  string
}

func NewDynamoDBFolderRepository(client *dynamodb.Client, table string) *DynamoDBFolderRepository {
	return &DynamoDBFolderRepository{client: client, table: table}
}

func (r *DynamoDBFolderRepository) Create(ctx context.Context, f *folder.Folder) error {
	item, err := attributevalue.MarshalMap(f)
	if err != nil {
		return apierrors.Internal(fmt.Errorf("marshal folder: %w", err))
	}
	if _, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(r.table), Item: item}); err != nil {
		return apierrors.Internal(fmt.Errorf("dynamodb PutItem: %w", err))
	}
	return nil
}

// List only reads one workspace's partition, so folders never cross tenants.
func (r *DynamoDBFolderRepository) List(ctx context.Context, workspaceID string) ([]folder.Folder, error) {
	folders := []folder.Folder{}
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
		var batch []folder.Folder
		if err := attributevalue.UnmarshalListOfMaps(page.Items, &batch); err != nil {
			return nil, apierrors.Internal(fmt.Errorf("unmarshal folders: %w", err))
		}
		folders = append(folders, batch...)
	}
	return folders, nil
}

func (r *DynamoDBFolderRepository) Delete(ctx context.Context, workspaceID, id string) error {
	_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.table),
		Key: map[string]types.AttributeValue{
			"workspace_id": &types.AttributeValueMemberS{Value: workspaceID},
			"id":           &types.AttributeValueMemberS{Value: id},
		},
		ConditionExpression: aws.String("attribute_exists(id)"),
	})
	if err != nil {
		var missing *types.ConditionalCheckFailedException
		if errors.As(err, &missing) {
			return apierrors.NotFound("folder")
		}
		return apierrors.Internal(fmt.Errorf("dynamodb DeleteItem: %w", err))
	}
	return nil
}
