package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/Thrashy190/Rivo/services/shared/authz"
	apierrors "github.com/Thrashy190/Rivo/services/shared/errors"
	"github.com/Thrashy190/Rivo/services/shared/models/project"
	"github.com/Thrashy190/Rivo/services/shared/models/workspace"
	"github.com/Thrashy190/Rivo/services/shared/repository"
	"github.com/Thrashy190/Rivo/services/shared/transport/apigateway"
)

const (
	maxRequestBody  = 1 << 20
	maxResponseBody = 1 << 20
	timeout         = 25 * time.Second
)

var (
	// Only API Gateway addresses that Rivo deployed: never anything a request names.
	apiHost   = regexp.MustCompile(`^[a-z0-9]{10}\.execute-api\.[a-z0-9-]+\.amazonaws\.com$`)
	pathRule  = regexp.MustCompile(`^/[A-Za-z0-9._~\-/%:@!$&'()*+,;=]*$`)
	headerKey = regexp.MustCompile(`^[A-Za-z0-9-]{1,100}$`)
	methods   = map[string]bool{"GET": true, "POST": true, "PUT": true, "PATCH": true, "DELETE": true, "HEAD": true, "OPTIONS": true}
	// Headers the client sets itself.
	reserved = map[string]bool{"host": true, "content-length": true, "connection": true, "transfer-encoding": true, "upgrade": true, "te": true, "trailer": true, "proxy-authorization": true}
)

type ProjectGetter interface {
	GetByID(ctx context.Context, workspaceID, id string) (*project.Project, error)
}

var (
	users    authz.UserLoader
	members  authz.MembershipLoader
	projects ProjectGetter
	client   = &http.Client{
		Timeout: timeout,
		// A redirect could point anywhere, so it is returned instead of followed.
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
)

func init() {
	if os.Getenv("AWS_LAMBDA_FUNCTION_NAME") == "" {
		return
	}
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("loading AWS config: %v", err))
	}
	db := dynamodb.NewFromConfig(cfg)
	users = repository.NewDynamoDBUserRepository(db, os.Getenv("USERS_TABLE_NAME"))
	members = repository.NewDynamoDBMembershipRepository(db, os.Getenv("MEMBERS_TABLE_NAME"))
	projects = repository.NewDynamoDBProjectRepository(db, os.Getenv("PROJECTS_TABLE_NAME"))
}

type testInput struct {
	NodeID  string            `json:"nodeId"`
	Method  string            `json:"method"`
	Path    string            `json:"path"`
	Query   map[string]string `json:"query"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

type testOutput struct {
	URL        string            `json:"url"`
	Status     int               `json:"status"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	Base64     bool              `json:"base64,omitempty"`
	Truncated  bool              `json:"truncated,omitempty"`
	DurationMS int64             `json:"durationMs"`
}

// Sends a request to an API the project deployed and returns the answer, like
// the console's test tab. Going through Rivo avoids CORS and works with any
// API settings. Requests can change data, so it needs the deploy permission.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_, m, err := authz.RequireWorkspace(ctx, users, members, req, workspace.PermDeploymentsRun)
	if err != nil {
		return apigateway.Error(err), nil
	}
	var in testInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return apigateway.Error(apierrors.Validation("send the request to make")), nil
	}
	p, err := projects.GetByID(ctx, m.WorkspaceID, req.PathParameters["projectId"])
	if err != nil {
		return apigateway.Error(err), nil
	}
	base := p.Endpoints[in.NodeID]["url"]
	if base == "" {
		return apigateway.Error(apierrors.Validation("this API is not deployed yet")), nil
	}
	target, err := buildURL(base, in.Path, in.Query)
	if err != nil {
		return apigateway.Error(apierrors.Validation(err.Error())), nil
	}
	method := strings.ToUpper(strings.TrimSpace(in.Method))
	if !methods[method] {
		return apigateway.Error(apierrors.Validation("method is GET, POST, PUT, PATCH, DELETE, HEAD or OPTIONS")), nil
	}
	if len(in.Body) > maxRequestBody {
		return apigateway.Error(apierrors.Validation("the body is over 1 MB")), nil
	}

	r, err := http.NewRequestWithContext(ctx, method, target, bodyReader(method, in.Body))
	if err != nil {
		return apigateway.Error(apierrors.Validation("the request could not be built")), nil
	}
	for k, v := range in.Headers {
		if !headerKey.MatchString(k) || reserved[strings.ToLower(k)] || strings.ContainsAny(v, "\r\n") {
			return apigateway.Error(apierrors.Validation(fmt.Sprintf("the header %q cannot be sent", k))), nil
		}
		r.Header.Set(k, v)
	}
	if r.Header.Get("User-Agent") == "" {
		r.Header.Set("User-Agent", "Rivo API test")
	}

	start := time.Now()
	res, err := client.Do(r)
	if err != nil {
		var timeoutErr interface{ Timeout() bool }
		if errors.As(err, &timeoutErr) && timeoutErr.Timeout() {
			return apigateway.Error(apierrors.Validation("the API did not answer within 25 seconds")), nil
		}
		return apigateway.Error(apierrors.Validation("the API could not be reached: " + err.Error())), nil
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(res.Body, maxResponseBody+1))
	out := testOutput{URL: target, Status: res.StatusCode, Headers: map[string]string{}, DurationMS: time.Since(start).Milliseconds()}
	if len(body) > maxResponseBody {
		body, out.Truncated = body[:maxResponseBody], true
	}
	keys := make([]string, 0, len(res.Header))
	for k := range res.Header {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		out.Headers[strings.ToLower(k)] = strings.Join(res.Header[k], ", ")
	}
	if utf8.Valid(body) {
		out.Body = string(body)
	} else {
		out.Body, out.Base64 = base64.StdEncoding.EncodeToString(body), true
	}
	return apigateway.Success(http.StatusOK, out), nil
}

// buildURL joins a deployed API's address with a path and query. The host
// always stays the API's.
func buildURL(base, path string, query map[string]string) (string, error) {
	u, err := url.Parse(base)
	if err != nil || u.Scheme != "https" || !apiHost.MatchString(u.Host) {
		return "", errors.New("the deployed API's address is not an API Gateway address")
	}
	if path == "" {
		path = "/"
	}
	if !pathRule.MatchString(path) || strings.Contains(path, "..") || strings.Contains(path, "//") {
		return "", errors.New("the path must start with / and have no '..', '//', '?' or '#'")
	}
	u.Path = strings.TrimSuffix(u.Path, "/") + path
	u.RawPath = ""
	q := url.Values{}
	for k, v := range query {
		if k != "" {
			q.Set(k, v)
		}
	}
	u.RawQuery = q.Encode()
	u.Fragment = ""
	return u.String(), nil
}

func bodyReader(method, body string) io.Reader {
	if body == "" || method == "GET" || method == "HEAD" {
		return nil
	}
	return bytes.NewReader([]byte(body))
}

func main() {
	lambda.Start(handler)
}
