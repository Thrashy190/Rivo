package main

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/storage"
	"github.com/Thrashy190/Rivo/services/shared/tfgen"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

const (
	linkLifetime = 5 * time.Minute
	// The files are returned for the preview only while the response stays
	// well under the 6 MB a Lambda can answer with. The .zip always has them.
	maxPreviewBytes = 3 * 1024 * 1024
)

type ProjectGetter interface {
	GetByID(ctx context.Context, workspaceID, id string) (*project.Project, error)
}

type Files interface {
	Get(ctx context.Context, key string) ([]byte, string, error)
	PutFile(ctx context.Context, key string, body []byte, contentType string) error
	PresignDownload(ctx context.Context, key, fileName string, expires time.Duration) (string, error)
}

var (
	users    authz.UserLoader
	members  authz.MembershipLoader
	projects ProjectGetter
	files    Files
)

func init() {
	if os.Getenv("AWS_LAMBDA_FUNCTION_NAME") == "" {
		return
	}
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	client := dynamodb.NewFromConfig(cfg)
	users = repository.NewDynamoDBUserRepository(client, os.Getenv("USERS_TABLE_NAME"))
	members = repository.NewDynamoDBMembershipRepository(client, os.Getenv("MEMBERS_TABLE_NAME"))
	projects = repository.NewDynamoDBProjectRepository(client, os.Getenv("PROJECTS_TABLE_NAME"))
	files = storage.NewS3(s3.NewFromConfig(cfg), os.Getenv("DIAGRAMS_BUCKET"))
}

type exportInput struct {
	// A saved version to generate from. Without it, the draft is used.
	Version int `json:"version"`
}

type exportOutput struct {
	Files    []tfgen.File    `json:"files"`
	Packages []tfgen.Package `json:"packages"`
	Warnings []tfgen.Warning `json:"warnings"`
	// False when the files were too large to preview; the .zip has them all.
	Preview  bool   `json:"preview"`
	URL      string `json:"url"`
	FileName string `json:"fileName"`
}

// Generates Terraform from the project's diagram, stores it as a .zip with the
// Lambda packages it uses, and returns the files and a short-lived download
// link. Reading a project is enough: nothing in AWS changes.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermProjectsRead)
	if err != nil {
		return apigateway.Error(err), nil
	}

	var in exportInput
	if strings.TrimSpace(req.Body) != "" {
		if err := json.Unmarshal([]byte(req.Body), &in); err != nil || in.Version < 0 {
			return apigateway.Error(apierrors.Validation("send a version number, or nothing for the draft")), nil
		}
	}

	p, err := projects.GetByID(ctx, m.WorkspaceID, req.PathParameters["projectId"])
	if err != nil {
		return apigateway.Error(err), nil
	}

	key := storage.DraftKey(p.WorkspaceID, p.ID)
	if in.Version > 0 {
		key = storage.VersionKey(p.WorkspaceID, p.ID, in.Version)
	}
	body, _, err := files.Get(ctx, key)
	if err != nil {
		if isNotFound(err) {
			return apigateway.Error(apierrors.Validation("save the diagram before generating Terraform")), nil
		}
		return apigateway.Error(err), nil
	}

	diagram, err := tfgen.Parse(body)
	if err != nil {
		return apigateway.Error(apierrors.Validation("the diagram could not be read")), nil
	}
	res, err := tfgen.Generate(diagram, tfgen.Options{ProjectName: p.Name, Region: p.Region})
	if err != nil {
		return apigateway.Error(apierrors.Validation(err.Error())), nil
	}

	folder := tfgen.NamePrefix(p.Name) + "-terraform"
	archive, warnings, err := buildZip(ctx, p, folder, res)
	if err != nil {
		return apigateway.Error(err), nil
	}
	res.Warnings = append(res.Warnings, warnings...)

	exportKey := storage.ExportKey(p.WorkspaceID, p.ID)
	if err := files.PutFile(ctx, exportKey, archive, "application/zip"); err != nil {
		return apigateway.Error(err), nil
	}
	url, err := files.PresignDownload(ctx, exportKey, folder+".zip", linkLifetime)
	if err != nil {
		return apigateway.Error(err), nil
	}

	out := exportOutput{Files: res.Files, Packages: res.Packages, Warnings: res.Warnings, Preview: true, URL: url, FileName: folder + ".zip"}
	size := 0
	for _, f := range res.Files {
		size += len(f.Content)
	}
	if size > maxPreviewBytes {
		out.Preview = false
		for i := range out.Files {
			out.Files[i].Content = ""
		}
	}
	return apigateway.Success(http.StatusOK, out), nil
}

// buildZip puts the files and the packages they use under one folder. A
// package that is missing becomes a warning: the rest still works.
func buildZip(ctx context.Context, p *project.Project, folder string, res *tfgen.Result) ([]byte, []tfgen.Warning, error) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	var warnings []tfgen.Warning
	now := time.Now()

	add := func(path string, body []byte) error {
		w, err := zw.CreateHeader(&zip.FileHeader{Name: folder + "/" + path, Method: zip.Deflate, Modified: now})
		if err != nil {
			return err
		}
		_, err = w.Write(body)
		return err
	}
	for _, f := range res.Files {
		if err := add(f.Path, []byte(f.Content)); err != nil {
			return nil, nil, apierrors.Internal(fmt.Errorf("writing %s: %w", f.Path, err))
		}
	}
	for _, pkg := range res.Packages {
		body, _, err := files.Get(ctx, storage.PackageKey(p.WorkspaceID, p.ID, pkg.PackageID))
		if err != nil {
			if isNotFound(err) {
				warnings = append(warnings, tfgen.Warning{Message: fmt.Sprintf("The package for %s was not found. Upload it again, or add it before applying.", pkg.Path)})
				continue
			}
			return nil, nil, err
		}
		if err := add(pkg.Path, body); err != nil {
			return nil, nil, apierrors.Internal(fmt.Errorf("writing %s: %w", pkg.Path, err))
		}
	}
	if err := zw.Close(); err != nil {
		return nil, nil, apierrors.Internal(fmt.Errorf("closing the zip: %w", err))
	}
	return buf.Bytes(), warnings, nil
}

func isNotFound(err error) bool {
	var apiErr *apierrors.ApiError
	return errors.As(err, &apiErr) && apiErr.Code == apierrors.CodeNotFound
}

func main() {
	lambda.Start(handler)
}
