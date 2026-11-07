package storage

import (
	"bytes"
	"context"
	"errors"
	"mime/multipart"
	"net/http"
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
func postForm(t *testing.T, upload *Upload, file []byte) int {
	t.Helper()
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	for k, v := range upload.Fields {
		_ = form.WriteField(k, v)
	}
	part, _ := form.CreateFormFile("file", "function.zip")
	_, _ = part.Write(file)
	_ = form.Close()
	res, err := http.Post(upload.URL, form.FormDataContentType(), &body)
	if err != nil {
		t.Fatalf("upload: %v", err)
	}
	defer res.Body.Close()
	return res.StatusCode
}

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

	// A package goes from the browser straight to S3 with a presigned form.
	pkg := PackageKey("acme", "p", "0b8c7f5e-2d3a-4b1c-9e8f-7a6b5c4d3e2f")
	upload, err := store.PresignUpload(ctx, pkg, 1024, time.Minute)
	if err != nil {
		t.Fatalf("presign upload: %v", err)
	}
	zip := []byte("PK\x03\x04 zip bytes")
	if status := postForm(t, upload, zip); status >= 300 {
		t.Fatalf("upload answered %d", status)
	}
	if size, err := store.Size(ctx, pkg); err != nil || size != int64(len(zip)) {
		t.Fatalf("size: %d, %v", size, err)
	}
	// S3 itself rejects a file over the limit. S3Mock does not check the
	// policy, so that part is only verified against AWS.
	link, err := store.PresignDownload(ctx, pkg, "function.zip", time.Minute)
	if err != nil {
		t.Fatalf("presign download: %v", err)
	}
	res, err := http.Get(link)
	if err != nil || res.StatusCode != http.StatusOK {
		t.Fatalf("download: %v %v", res, err)
	}
	res.Body.Close()

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
