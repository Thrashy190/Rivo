package storage

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
)

func TestKeysKeepWorkspacesApart(t *testing.T) {
	if got, want := DraftKey("w", "p"), "workspaces/w/projects/p/draft.json"; got != want {
		t.Errorf("draft key = %s", got)
	}
	if got, want := VersionKey("w", "p", 3), "workspaces/w/projects/p/versions/3.json"; got != want {
		t.Errorf("version key = %s", got)
	}
}

func code(err error) string {
	var apiErr *apierrors.ApiError
	if errors.As(err, &apiErr) {
		return apiErr.Code
	}
	return ""
}

// This test needs an S3-compatible server such as S3Mock (see CONTRIBUTING.md)
// and skips itself when RIVO_S3_ENDPOINT is not set.
//
// Real case: copying a missing draft looked like a server error, because the SDK
// does not model NoSuchKey on CopyObject.
func TestDiagramLifecycle(t *testing.T) {
	endpoint := os.Getenv("RIVO_S3_ENDPOINT")
	if endpoint == "" {
		t.Skip("RIVO_S3_ENDPOINT is not set")
	}
	ctx := context.Background()
	client := s3.New(s3.Options{
		BaseEndpoint: aws.String(endpoint),
		Region:       "us-east-1",
		UsePathStyle: true,
		Credentials:  credentials.NewStaticCredentialsProvider("local", "local", ""),
	})
	bucket := "test-" + time.Now().Format("20060102150405") + "-diagrams"
	if _, err := client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(bucket)}); err != nil {
		t.Fatalf("create bucket: %v", err)
	}
	store := NewS3(client, bucket)
	draft := DraftKey("acme", "p")

	if _, _, err := store.Get(ctx, draft); code(err) != apierrors.CodeNotFound {
		t.Fatalf("a missing draft must be not found: %v", err)
	}

	if ok, err := store.Exists(ctx, draft); ok || err != nil {
		t.Fatalf("a missing draft must not exist: %v, %v", ok, err)
	}

	first, err := store.Put(ctx, draft, []byte(`{"v":1}`), "", true)
	if err != nil || first == "" {
		t.Fatalf("first save: %q, %v", first, err)
	}
	if ok, err := store.Exists(ctx, draft); !ok || err != nil {
		t.Fatalf("a saved draft must exist: %v, %v", ok, err)
	}
	if _, err := store.Put(ctx, draft, []byte(`{"v":"rival"}`), "", true); code(err) != apierrors.CodeConflict {
		t.Fatalf("a second first save must conflict: %v", err)
	}

	second, err := store.Put(ctx, draft, []byte(`{"v":2}`), first, false)
	if err != nil || second == first {
		t.Fatalf("second save: %q, %v", second, err)
	}
	if _, err := store.Put(ctx, draft, []byte(`{"v":"stale"}`), first, false); code(err) != apierrors.CodeConflict {
		t.Fatalf("saving over a stale copy must conflict: %v", err)
	}

	body, etag, err := store.Get(ctx, draft)
	if err != nil || string(body) != `{"v":2}` || etag != second {
		t.Fatalf("get: %s, %q, %v", body, etag, err)
	}

	version := VersionKey("acme", "p", 1)
	if err := store.Copy(ctx, draft, version); err != nil {
		t.Fatalf("copy: %v", err)
	}
	if err := store.Copy(ctx, DraftKey("acme", "missing"), VersionKey("acme", "missing", 1)); code(err) != apierrors.CodeNotFound {
		t.Fatalf("copying a missing draft must be not found: %v", err)
	}
	if _, err := store.Put(ctx, draft, []byte(`{"v":3}`), "", false); err != nil {
		t.Fatal(err)
	}
	if body, _, _ := store.Get(ctx, version); string(body) != `{"v":2}` {
		t.Fatalf("a version must not change with the draft: %s", body)
	}

	other := DraftKey("globex", "p")
	if _, err := store.Put(ctx, other, []byte(`{}`), "", false); err != nil {
		t.Fatal(err)
	}
	if err := store.DeletePrefix(ctx, ProjectPrefix("acme", "p")); err != nil {
		t.Fatal(err)
	}
	if _, _, err := store.Get(ctx, version); code(err) != apierrors.CodeNotFound {
		t.Fatalf("the version must be deleted: %v", err)
	}
	if _, _, err := store.Get(ctx, other); err != nil {
		t.Fatalf("another workspace's diagram must survive: %v", err)
	}
	_ = store.DeletePrefix(ctx, ProjectPrefix("globex", "p"))
	_, _ = client.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: aws.String(bucket)})
}
