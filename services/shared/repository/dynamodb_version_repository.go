package repository

import (
	"context"
	"fmt"
	"strconv"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
)

type DynamoDBVersionRepository struct {
	client *dynamodb.Client
	table  string
}

func NewDynamoDBVersionRepository(client *dynamodb.Client, table string) *DynamoDBVersionRepository {
	return &DynamoDBVersionRepository{client: client, table: table}
}

func (r *DynamoDBVersionRepository) Create(ctx context.Context, v *project.Version) error {
	item, err := attributevalue.MarshalMap(v)
	if err != nil {
		return apierrors.Internal(fmt.Errorf("marshal version: %w", err))
	}
	if _, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(r.table), Item: item}); err != nil {
		return apierrors.Internal(fmt.Errorf("dynamodb PutItem: %w", err))
	}
	return nil
}

func (r *DynamoDBVersionRepository) Get(ctx context.Context, projectID string, number int) (*project.Version, error) {
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.table),
		Key: map[string]types.AttributeValue{
			"project_id": &types.AttributeValueMemberS{Value: projectID},
			"number":     &types.AttributeValueMemberN{Value: strconv.Itoa(number)},
		},
	})
	if err != nil {
		return nil, apierrors.Internal(fmt.Errorf("dynamodb GetItem: %w", err))
	}
	if out.Item == nil {
		return nil, apierrors.NotFound("version")
	}

	var v project.Version
	if err := attributevalue.UnmarshalMap(out.Item, &v); err != nil {
		return nil, apierrors.Internal(fmt.Errorf("unmarshal version: %w", err))
	}
	return &v, nil
}

// List returns a project's versions, newest first.
func (r *DynamoDBVersionRepository) List(ctx context.Context, projectID string) ([]project.Version, error) {
	versions := []project.Version{}
	pages := dynamodb.NewQueryPaginator(r.client, &dynamodb.QueryInput{
		TableName:              aws.String(r.table),
		KeyConditionExpression: aws.String("project_id = :id"),
		ScanIndexForward:       aws.Bool(false),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":id": &types.AttributeValueMemberS{Value: projectID},
		},
	})
	for pages.HasMorePages() {
		page, err := pages.NextPage(ctx)
		if err != nil {
			return nil, apierrors.Internal(fmt.Errorf("dynamodb Query: %w", err))
		}
		var batch []project.Version
		if err := attributevalue.UnmarshalListOfMaps(page.Items, &batch); err != nil {
			return nil, apierrors.Internal(fmt.Errorf("unmarshal versions: %w", err))
		}
		versions = append(versions, batch...)
	}
	return versions, nil
}

func (r *DynamoDBVersionRepository) DeleteAll(ctx context.Context, projectID string) error {
	versions, err := r.List(ctx, projectID)
	if err != nil {
		return err
	}
	for _, v := range versions {
		_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
			TableName: aws.String(r.table),
			Key: map[string]types.AttributeValue{
				"project_id": &types.AttributeValueMemberS{Value: projectID},
				"number":     &types.AttributeValueMemberN{Value: strconv.Itoa(v.Number)},
			},
		})
		if err != nil {
			return apierrors.Internal(fmt.Errorf("dynamodb DeleteItem: %w", err))
		}
	}
	return nil
}
