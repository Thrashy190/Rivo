package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	apierrors "github.com/rivo-api/shared/errors"
	"github.com/rivo-api/shared/models/project"
)

type DynamoDBProjectRepository struct {
	client *dynamodb.Client
	table  string
}

func NewDynamoDBProjectRepository(client *dynamodb.Client, table string) *DynamoDBProjectRepository {
	return &DynamoDBProjectRepository{client: client, table: table}
}

func (r *DynamoDBProjectRepository) GetByID(ctx context.Context, id string) (*project.Project, error) {
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
		return nil, apierrors.NotFound("project")
	}

	var p project.Project
	if err := attributevalue.UnmarshalMap(out.Item, &p); err != nil {
		return nil, apierrors.Internal(fmt.Errorf("unmarshal project: %w", err))
	}
	return &p, nil
}

// Create satisfies the ProjectCreator port declared by create-project.
func (r *DynamoDBProjectRepository) Create(ctx context.Context, p *project.Project) error {
	item, err := attributevalue.MarshalMap(p)
	if err != nil {
		return apierrors.Internal(fmt.Errorf("marshal project: %w", err))
	}

	if _, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.table),
		Item:      item,
	}); err != nil {
		return apierrors.Internal(fmt.Errorf("dynamodb PutItem: %w", err))
	}

	return nil
}

// Update satisfies the ProjectUpdater port declared by update-project.
// It only writes the fields present in `in` (partial PATCH) via
// UpdateExpression, instead of reading + merging + rewriting the whole
// item.
func (r *DynamoDBProjectRepository) Update(ctx context.Context, id string, in project.UpdateProjectInput) (*project.Project, error) {
	var sets []string
	exprNames := map[string]string{}
	exprValues := map[string]types.AttributeValue{}

	if in.Name != nil {
		// "name" is a reserved word in DynamoDB, needs an alias (#name).
		sets = append(sets, "#name = :name")
		exprNames["#name"] = "name"
		exprValues[":name"] = &types.AttributeValueMemberS{Value: *in.Name}
	}
	if in.Description != nil {
		sets = append(sets, "description = :description")
		exprValues[":description"] = &types.AttributeValueMemberS{Value: *in.Description}
	}
	if len(sets) == 0 {
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
	// DynamoDB rejects ExpressionAttributeNames if it's present but
	// empty (happens when the PATCH only brings "description", which
	// needs no alias) — only send it if it actually has something.
	if len(exprNames) > 0 {
		input.ExpressionAttributeNames = exprNames
	}

	out, err := r.client.UpdateItem(ctx, input)
	if err != nil {
		var condErr *types.ConditionalCheckFailedException
		if errors.As(err, &condErr) {
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

// Delete satisfies the ProjectDeleter port declared by delete-project.
// ConditionExpression avoids DynamoDB's default behavior (DeleteItem
// on a non-existent id "succeeds" silently) — so the handler can
// return a real 404.
func (r *DynamoDBProjectRepository) Delete(ctx context.Context, id string) error {
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
			return apierrors.NotFound("project")
		}
		return apierrors.Internal(fmt.Errorf("dynamodb DeleteItem: %w", err))
	}
	return nil
}

// List satisfies the ProjectLister port declared by get-all-projects.
func (r *DynamoDBProjectRepository) List(ctx context.Context) ([]project.Project, error) {
	out, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName: aws.String(r.table),
	})
	if err != nil {
		return nil, apierrors.Internal(fmt.Errorf("dynamodb Scan: %w", err))
	}

	projects := make([]project.Project, 0, len(out.Items))
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &projects); err != nil {
		return nil, apierrors.Internal(fmt.Errorf("unmarshal projects: %w", err))
	}
	return projects, nil
}
