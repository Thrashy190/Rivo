package tfgen

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func generateFile(t *testing.T, name string) *Result {
	t.Helper()
	body, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	d, err := Parse(body)
	if err != nil {
		t.Fatal(err)
	}
	res, err := Generate(d, Options{ProjectName: "Demo Shop", Region: "us-east-1"})
	if err != nil {
		t.Fatal(err)
	}
	return res
}

func content(res *Result, path string) string {
	for _, f := range res.Files {
		if f.Path == path {
			return f.Content
		}
	}
	return ""
}

func all(res *Result) string {
	var sb strings.Builder
	for _, f := range res.Files {
		if strings.HasSuffix(f.Path, ".tf") {
			sb.WriteString(f.Content)
		}
	}
	return sb.String()
}

func mustContain(t *testing.T, text string, parts ...string) {
	t.Helper()
	for _, p := range parts {
		if !strings.Contains(text, p) {
			t.Errorf("missing %q in:\n%s", p, text)
		}
	}
}

func TestStaticSite(t *testing.T) {
	res := generateFile(t, "static-site.json")
	tf := all(res)
	mustContain(t, tf,
		`resource "aws_s3_bucket" "site"`,
		`resource "aws_cloudfront_origin_access_control" "cdn"`,
		`resource "aws_cloudfront_distribution" "cdn"`,
		`domain_name              = aws_s3_bucket.site.bucket_regional_domain_name`,
		`values   = [aws_cloudfront_distribution.cdn.arn]`,
		`resource "aws_s3_object" "site_site"`,
		`response_page_path = "/index.html"`,
		`output "cdn_url"`,
	)
	if content(res, "site/site/index.html") == "" {
		t.Error("the bucket has no placeholder page")
	}
	if len(res.Warnings) != 0 {
		t.Errorf("unexpected warnings: %+v", res.Warnings)
	}
}

func TestServerlessAPI(t *testing.T) {
	res := generateFile(t, "serverless-api.json")
	tf := all(res)
	mustContain(t, tf,
		`resource "aws_apigatewayv2_api" "items_api"`,
		`route_key = "GET /items"`,
		`route_key = "POST /items"`,
		`resource "aws_apigatewayv2_integration" "items_api_items"`,
		`resource "aws_lambda_permission" "items_api_items"`,
		`ITEMS_TABLE = aws_dynamodb_table.items_2.name`,
		`"dynamodb:PutItem"`,
		`resource "aws_dynamodb_table" "items_2"`,
		`architectures    = ["arm64"]`,
		`allow_origins = ["*"]`,
	)
	// One integration and one permission for both routes.
	if n := strings.Count(tf, `resource "aws_apigatewayv2_integration"`); n != 1 {
		t.Errorf("want 1 integration, got %d", n)
	}
	if !strings.Contains(content(res, "functions/items/index.js"), "ITEMS_TABLE") {
		t.Error("the function's code was not written")
	}
}

func TestEventDriven(t *testing.T) {
	res := generateFile(t, "event-driven.json")
	tf := all(res)
	mustContain(t, tf,
		`schedule_expression = "rate(1 minute)"`,
		`"shop.orders"`,
		`resource "aws_cloudwatch_event_target" "every_minute_worker"`,
		`resource "aws_lambda_permission" "orders_worker"`,
		`principal     = "events.amazonaws.com"`,
		`data "aws_cloudwatch_event_bus" "default"`,
		`EVENT_BUS_NAME = data.aws_cloudwatch_event_bus.default.name`,
		`"events:PutEvents"`,
	)
	// The publisher has no code, so it gets a placeholder and a warning.
	if content(res, "functions/publisher/index.js") == "" {
		t.Error("the placeholder was not written")
	}
	if len(res.Warnings) != 1 || !strings.Contains(res.Warnings[0].Message, "publisher has no code") {
		t.Errorf("warnings: %+v", res.Warnings)
	}
}

func TestDiagramTextCannotInjectHCL(t *testing.T) {
	d := &Diagram{Nodes: []Node{
		{ID: "a", Type: "lambda", Config: map[string]any{
			"name":        `x" } resource "null_resource" "pwn" { x = "`,
			"handler":     `index.handler"; evil`,
			"environment": map[string]any{"GOOD": "${file(\"/etc/passwd\")}", "bad key": "x"},
		}},
		{ID: "b", Type: "dynamodb", Config: map[string]any{"name": "t", "partitionKey": `id"} provisioner "local-exec" {`}},
	}}
	res, err := Generate(d, Options{ProjectName: "p", Region: "us-east-1"})
	if err != nil {
		t.Fatal(err)
	}
	tf := all(res)
	if strings.Contains(tf, `"null_resource"`) || strings.Contains(tf, `provisioner "local-exec"`) {
		t.Fatalf("diagram text became HCL:\n%s", tf)
	}
	mustContain(t, tf, `GOOD = "$${file(\"/etc/passwd\")}"`, `handler          = "index.handler"`)
}

func TestUnsupportedServicesAreWarned(t *testing.T) {
	d := &Diagram{
		Nodes: []Node{
			{ID: "a", Type: "lambda", Config: map[string]any{"name": "fn", "runtime": "go1.x"}},
			{ID: "b", Type: "ec2", Label: "EC2 Instance", Config: map[string]any{"name": "box"}},
			{ID: "c", Type: "sqs", Label: "SQS Queue", Config: map[string]any{"name": "q"}},
		},
		Edges: []Edge{{ID: "e", SourceID: "a", TargetID: "b"}},
	}
	res, err := Generate(d, Options{ProjectName: "p", Region: "us-east-1"})
	if err != nil {
		t.Fatal(err)
	}
	var msgs []string
	for _, w := range res.Warnings {
		msgs = append(msgs, w.Message)
	}
	joined := strings.Join(msgs, "\n")
	mustContain(t, joined, `EC2 Instance "box" is not generated yet`, `SQS Queue "q"`, "retired go1.x", "compiled .zip")
	mustContain(t, all(res), `runtime          = "provided.al2023"`, `handler          = "bootstrap"`)
}

func TestRoutesSavedAsMethodAndPath(t *testing.T) {
	d := &Diagram{
		Nodes: []Node{{ID: "a", Type: "api-gateway", Config: map[string]any{"name": "api"}}, {ID: "b", Type: "lambda", Config: map[string]any{"name": "fn"}}},
		Edges: []Edge{
			{ID: "e1", SourceID: "b", TargetID: "a", Config: map[string]any{"method": "delete", "path": "/items/{id}"}},
			{ID: "e2", SourceID: "a", TargetID: "b", Config: map[string]any{"routes": []any{map[string]any{"method": "GET", "path": "/items/{id}"}, map[string]any{"method": "DELETE", "path": "/items/{id}"}}}},
		},
	}
	res, err := Generate(d, Options{ProjectName: "p", Region: "us-east-1"})
	if err != nil {
		t.Fatal(err)
	}
	tf := all(res)
	mustContain(t, tf, `route_key = "DELETE /items/{id}"`, `route_key = "GET /items/{id}"`)
	if strings.Count(tf, `"DELETE /items/{id}"`) != 1 || len(res.Warnings) != 2 {
		// The duplicate route is left out with a warning, plus the placeholder code.
		t.Errorf("want the duplicate left out once; warnings: %+v", res.Warnings)
	}
}

func TestEmptyDiagram(t *testing.T) {
	if _, err := Generate(&Diagram{}, Options{}); err == nil {
		t.Fatal("want an error for a diagram with nothing to generate")
	}
}

// With RIVO_TERRAFORM_CHECK=1, the examples go through terraform fmt and
// validate. It downloads the AWS provider, so it is off by default.
func TestExamplesWithTerraform(t *testing.T) {
	if os.Getenv("RIVO_TERRAFORM_CHECK") != "1" {
		t.Skip("set RIVO_TERRAFORM_CHECK=1 to run terraform fmt and validate")
	}
	cache := os.Getenv("TF_PLUGIN_CACHE_DIR")
	for _, name := range []string{"static-site.json", "serverless-api.json", "event-driven.json"} {
		t.Run(name, func(t *testing.T) {
			dir := t.TempDir()
			if out := os.Getenv("RIVO_TERRAFORM_OUT"); out != "" {
				dir = filepath.Join(out, strings.TrimSuffix(name, ".json"))
				os.RemoveAll(dir)
			}
			res := generateFile(t, name)
			for _, f := range res.Files {
				p := filepath.Join(dir, f.Path)
				if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(p, []byte(f.Content), 0o644); err != nil {
					t.Fatal(err)
				}
			}
			run := func(args ...string) {
				cmd := exec.Command("terraform", args...)
				cmd.Dir = dir
				if cache != "" {
					cmd.Env = append(os.Environ(), "TF_PLUGIN_CACHE_DIR="+cache)
				}
				if out, err := cmd.CombinedOutput(); err != nil {
					t.Fatalf("terraform %s: %v\n%s", strings.Join(args, " "), err, out)
				}
			}
			run("fmt", "-check", "-diff", "-recursive")
			run("init", "-backend=false", "-input=false")
			run("validate")
		})
	}
}
