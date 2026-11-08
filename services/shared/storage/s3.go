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
	"time"

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

// PackageKey is where a Lambda's .zip lives. Packages stay until the project is
// deleted, because saved versions may still point at them.
func PackageKey(workspaceID, projectID, packageID string) string {
	return fmt.Sprintf("%spackages/%s.zip", ProjectPrefix(workspaceID, projectID), packageID)
}

// ExportKey is where the last Terraform generated for a project waits to be
// downloaded. Each export replaces the previous one.
func ExportKey(workspaceID, projectID string) string {
	return ProjectPrefix(workspaceID, projectID) + "exports/terraform.zip"
}

// DeploymentKey is a file of one deployment: the diagram it deploys
// (diagram.json), the readable plan (plan.json), the working directory with
// the saved plan (workdir.tar.gz) and the engine's logs (plan.log, apply.log).
func DeploymentKey(workspaceID, projectID, deploymentID, name string) string {
	return fmt.Sprintf("%sdeployments/%s/%s", ProjectPrefix(workspaceID, projectID), deploymentID, name)
}

// StateKey is the Terraform state of the project's infrastructure. The bucket
// keeps old versions of it, and Terraform locks it with a .tflock next to it.
func StateKey(workspaceID, projectID string) string {
	return ProjectPrefix(workspaceID, projectID) + "state/terraform.tfstate"
}

// Upload is a presigned form POST: send Fields, then the file, to URL.
type Upload struct {
	URL    string
	Fields map[string]string
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

// PutFile stores a file that is not a diagram, such as an export.
func (s *S3) PutFile(ctx context.Context, key string, body []byte, contentType string) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(body),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return apierrors.Internal(fmt.Errorf("s3 PutObject: %w", err))
	}
	return nil
}

// Exists reports whether an object is there, without reading it.
func (s *S3) Exists(ctx context.Context, key string) (bool, error) {
	_, err := s.Size(ctx, key)
	if err != nil {
		var apiErr *apierrors.ApiError
		if errors.As(err, &apiErr) && apiErr.Code == apierrors.CodeNotFound {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// Size returns an object's size in bytes, or a not found error.
func (s *S3) Size(ctx context.Context, key string) (int64, error) {
	out, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	if err != nil {
		if isMissing(err) {
			return 0, apierrors.NotFound("file")
		}
		return 0, apierrors.Internal(fmt.Errorf("s3 HeadObject: %w", err))
	}
	return aws.ToInt64(out.ContentLength), nil
}

// PresignUpload lets a browser POST one object of up to maxBytes to key, for
// the given time, without passing through a Lambda. S3 rejects a larger file.
func (s *S3) PresignUpload(ctx context.Context, key string, maxBytes int64, expires time.Duration) (*Upload, error) {
	out, err := s3.NewPresignClient(s.client).PresignPostObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, func(o *s3.PresignPostOptions) {
		o.Expires = expires
		o.Conditions = []any{[]any{"content-length-range", 1, maxBytes}}
	})
	if err != nil {
		return nil, apierrors.Internal(fmt.Errorf("s3 presign POST: %w", err))
	}
	return &Upload{URL: out.URL, Fields: out.Values}, nil
}

// PresignDownload returns a link that downloads key as fileName, for the given time.
func (s *S3) PresignDownload(ctx context.Context, key, fileName string, expires time.Duration) (string, error) {
	out, err := s3.NewPresignClient(s.client).PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket:                     aws.String(s.bucket),
		Key:                        aws.String(key),
		ResponseContentDisposition: aws.String(fmt.Sprintf("attachment; filename=%q", fileName)),
	}, s3.WithPresignExpires(expires))
	if err != nil {
		return "", apierrors.Internal(fmt.Errorf("s3 presign GET: %w", err))
	}
	return out.URL, nil
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
// operations: on CopyObject it arrives as a generic API error, and HeadObject,
// which has no body, answers NotFound.
func isMissing(err error) bool {
	var apiErr smithy.APIError
	return errors.As(err, &apiErr) && (apiErr.ErrorCode() == "NoSuchKey" || apiErr.ErrorCode() == "NotFound")
}

func cleanETag(etag string) string {
	return strings.Trim(etag, `"`)
}
