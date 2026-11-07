// Package storage keeps project diagrams in S3, under one prefix per workspace
// and project.
package storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
)

func ProjectPrefix(workspaceID, projectID string) string {
	return fmt.Sprintf("workspaces/%s/projects/%s/", workspaceID, projectID)
}

func DraftKey(workspaceID, projectID string) string {
	return ProjectPrefix(workspaceID, projectID) + "draft.json"
}

func VersionKey(workspaceID, projectID string, number int) string {
	return fmt.Sprintf("%sversions/%d.json", ProjectPrefix(workspaceID, projectID), number)
}

type S3 struct {
	client *s3.Client
	bucket string
}

func NewS3(client *s3.Client, bucket string) *S3 {
	return &S3{client: client, bucket: bucket}
}

// Get returns an object and its ETag, or a not found error.
func (s *S3) Get(ctx context.Context, key string) ([]byte, string, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	if err != nil {
		if isMissing(err) {
			return nil, "", apierrors.NotFound("diagram")
		}
		return nil, "", apierrors.Internal(fmt.Errorf("s3 GetObject: %w", err))
	}
	defer out.Body.Close()

	body, err := io.ReadAll(out.Body)
	if err != nil {
		return nil, "", apierrors.Internal(fmt.Errorf("s3 read object: %w", err))
	}
	return body, cleanETag(aws.ToString(out.ETag)), nil
}

// Put stores an object and returns its new ETag. With ifMatch set, it fails with
// a conflict if the object changed. With ifAbsent, it fails if one already
// exists, which covers two people saving a new project's first diagram.
func (s *S3) Put(ctx context.Context, key string, body []byte, ifMatch string, ifAbsent bool) (string, error) {
	in := &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(body),
		ContentType: aws.String("application/json"),
	}
	if ifMatch != "" {
		in.IfMatch = aws.String(ifMatch)
	}
	if ifAbsent {
		in.IfNoneMatch = aws.String("*")
	}

	out, err := s.client.PutObject(ctx, in)
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && (apiErr.ErrorCode() == "PreconditionFailed" || apiErr.ErrorCode() == "ConditionalRequestConflict") {
			return "", apierrors.Conflict("the diagram changed since you opened it")
		}
		return "", apierrors.Internal(fmt.Errorf("s3 PutObject: %w", err))
	}
	return cleanETag(aws.ToString(out.ETag)), nil
}

// Copy duplicates an object inside the bucket.
func (s *S3) Copy(ctx context.Context, from, to string) error {
	_, err := s.client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:     aws.String(s.bucket),
		CopySource: aws.String(s.bucket + "/" + from),
		Key:        aws.String(to),
	})
	if err != nil {
		if isMissing(err) {
			return apierrors.NotFound("diagram")
		}
		return apierrors.Internal(fmt.Errorf("s3 CopyObject: %w", err))
	}
	return nil
}

// DeletePrefix removes every object under a prefix.
func (s *S3) DeletePrefix(ctx context.Context, prefix string) error {
	pages := s3.NewListObjectsV2Paginator(s.client, &s3.ListObjectsV2Input{
		Bucket: aws.String(s.bucket),
		Prefix: aws.String(prefix),
	})
	for pages.HasMorePages() {
		page, err := pages.NextPage(ctx)
		if err != nil {
			return apierrors.Internal(fmt.Errorf("s3 ListObjectsV2: %w", err))
		}
		for _, obj := range page.Contents {
			if _, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(s.bucket), Key: obj.Key}); err != nil {
				return apierrors.Internal(fmt.Errorf("s3 DeleteObject: %w", err))
			}
		}
	}
	return nil
}

// isMissing checks the error code because the SDK only models NoSuchKey on some
// operations: on CopyObject it arrives as a generic API error.
func isMissing(err error) bool {
	var apiErr smithy.APIError
	return errors.As(err, &apiErr) && apiErr.ErrorCode() == "NoSuchKey"
}

func cleanETag(etag string) string {
	return strings.Trim(etag, `"`)
}
