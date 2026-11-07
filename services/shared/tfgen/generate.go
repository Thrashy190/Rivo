package tfgen

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/Thrashy190/Rivo/services/shared/models/project"
)

// Options describe the project the configuration is for.
type Options struct {
	ProjectName string
	Region      string
}

// File is one generated file, with a path relative to the configuration.
type File struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// Package is a Lambda .zip the caller copies into the configuration at Path.
// Its ID was validated, so it can be part of a storage key.
type Package struct {
	Path      string `json:"path"`
	PackageID string `json:"packageId"`
}

// Warning is something in the diagram the configuration leaves out or changes.
type Warning struct {
	NodeID  string `json:"nodeId,omitempty"`
	EdgeID  string `json:"edgeId,omitempty"`
	Message string `json:"message"`
}

type Result struct {
	Files    []File    `json:"files"`
	Packages []Package `json:"packages"`
	Warnings []Warning `json:"warnings"`
}

// Supported is every node type that becomes Terraform.
var Supported = map[string]bool{
	"lambda": true, "api-gateway": true, "dynamodb": true, "s3": true, "cloudfront": true, "eventbridge": true,
}

// Containers group services on the canvas and generate nothing themselves.
var containers = map[string]bool{"region": true, "vpc": true, "subnet": true}

type gen struct {
	opts     Options
	nodes    map[string]*Node
	order    []*Node // supported nodes, in diagram order
	local    map[string]string
	names    namer
	warnings []Warning

	// Collected from the connections before writing resources.
	env       map[string]map[string]expr // function -> variables
	policies  map[string][]*block        // function -> policy statements
	routes    map[string][]route         // API -> routes
	origins   map[string][]string        // distribution -> buckets
	readers   map[string][]string        // bucket -> distributions
	targets   map[string][]string        // rule -> functions
	publishes bool                       // a function sends events to the default bus

	files    map[string]*file
	extra    []File
	packages []Package
	outputs  []*block
	archive  bool
}

type route struct {
	edgeID, method, path, function string
}

// Generate writes a Terraform configuration for the diagram.
func Generate(d *Diagram, opts Options) (*Result, error) {
	if !project.ValidRegion(opts.Region) {
		opts.Region = "us-east-1"
	}
	g := &gen{
		opts:     opts,
		nodes:    map[string]*Node{},
		local:    map[string]string{},
		names:    namer{},
		env:      map[string]map[string]expr{},
		policies: map[string][]*block{},
		routes:   map[string][]route{},
		origins:  map[string][]string{},
		readers:  map[string][]string{},
		targets:  map[string][]string{},
		files:    map[string]*file{},
	}

	for i := range d.Nodes {
		n := &d.Nodes[i]
		g.nodes[n.ID] = n
		switch {
		case Supported[n.Type]:
			g.order = append(g.order, n)
			g.local[n.ID] = g.names.take(localName(n.name()))
		case containers[n.Type]:
			if n.Type != "region" {
				g.warn(n.ID, "", fmt.Sprintf("%s %q is drawn for reference: Rivo does not generate networks yet, and the services inside it are generated without one.", label(n), n.name()))
			}
		default:
			g.warn(n.ID, "", fmt.Sprintf("%s %q is not generated yet, so it was left out.", label(n), n.name()))
		}
	}
	if len(g.order) == 0 {
		return nil, fmt.Errorf("the diagram has no services Rivo can generate yet")
	}

	for _, e := range d.Edges {
		g.connect(e)
	}
	// A distribution serves its first bucket, which then lets it read objects.
	for _, n := range g.order {
		if buckets := g.origins[n.ID]; len(buckets) > 0 {
			g.readers[buckets[0]] = append(g.readers[buckets[0]], n.ID)
		}
	}

	for _, n := range g.order {
		switch n.Type {
		case "lambda":
			g.lambda(n)
		case "api-gateway":
			g.api(n)
		case "dynamodb":
			g.table(n)
		case "s3":
			g.bucket(n)
		case "cloudfront":
			g.distribution(n)
		case "eventbridge":
			g.rule(n)
		}
	}

	return g.result(), nil
}

func label(n *Node) string {
	if n.Label != "" {
		return n.Label
	}
	return n.Type
}

func (g *gen) warn(nodeID, edgeID, msg string) {
	g.warnings = append(g.warnings, Warning{NodeID: nodeID, EdgeID: edgeID, Message: msg})
}

func (g *gen) file(name string) *file {
	f, ok := g.files[name]
	if !ok {
		f = &file{}
		g.files[name] = f
	}
	return f
}

// ── Connections ──────────────────────────────────────────────────────────────

func (g *gen) connect(e Edge) {
	a, b := g.nodes[e.SourceID], g.nodes[e.TargetID]
	if a == nil || b == nil || containers[a.Type] || containers[b.Type] {
		return
	}
	if !Supported[a.Type] || !Supported[b.Type] {
		return // the unsupported node already has a warning
	}
	pick := func(t string) (*Node, *Node) {
		if a.Type == t {
			return a, b
		}
		return b, a
	}

	switch pair(a.Type, b.Type) {
	case pair("api-gateway", "lambda"):
		api, fn := pick("api-gateway")
		for _, r := range edgeRoutes(e) {
			method := strings.ToUpper(r[0])
			path := r[1]
			if !validMethods[method] {
				g.warn("", e.ID, fmt.Sprintf("%q is not an HTTP method; the route uses ANY.", method))
				method = "ANY"
			}
			if !routePath.MatchString(path) {
				g.warn("", e.ID, fmt.Sprintf("The route path %q is not valid; it uses /{proxy+}.", path))
				path = "/{proxy+}"
			}
			g.routes[api.ID] = append(g.routes[api.ID], route{edgeID: e.ID, method: method, path: path, function: fn.ID})
		}

	case pair("dynamodb", "lambda"):
		table, fn := pick("dynamodb")
		t := g.local[table.ID]
		g.setEnv(fn.ID, envName(table.name(), "TABLE"), raw("aws_dynamodb_table."+t+".name"))
		g.allow(fn.ID, tableActions(e.str("access", "readwrite")),
			"aws_dynamodb_table."+t+".arn", `"${aws_dynamodb_table.`+t+`.arn}/index/*"`)

	case pair("lambda", "s3"):
		bucket, fn := pick("s3")
		b := g.local[bucket.ID]
		g.setEnv(fn.ID, envName(bucket.name(), "BUCKET"), raw("aws_s3_bucket."+b+".bucket"))
		access := e.str("access", "readwrite")
		g.allow(fn.ID, []string{"s3:ListBucket"}, "aws_s3_bucket."+b+".arn")
		g.allow(fn.ID, bucketActions(access), `"${aws_s3_bucket.`+b+`.arn}/*"`)

	case pair("cloudfront", "s3"):
		cdn, bucket := pick("cloudfront")
		g.origins[cdn.ID] = append(g.origins[cdn.ID], bucket.ID)

	case pair("eventbridge", "lambda"):
		if a.Type == "eventbridge" {
			g.targets[a.ID] = append(g.targets[a.ID], b.ID)
			return
		}
		// A function pointing at a rule sends events to the bus it listens on.
		g.publishes = true
		g.setEnv(a.ID, "EVENT_BUS_NAME", raw("data.aws_cloudwatch_event_bus.default.name"))
		g.allow(a.ID, []string{"events:PutEvents"}, "data.aws_cloudwatch_event_bus.default.arn")

	default:
		g.warn("", e.ID, fmt.Sprintf("Rivo does not generate a connection between %s and %s yet.", label(a), label(b)))
	}
}

// edgeRoutes reads a connection's routes: a list of {method, path}, or a
// single method and path in diagrams saved before lists existed.
func edgeRoutes(e Edge) [][2]string {
	var out [][2]string
	if list, ok := e.Config["routes"].([]any); ok {
		for _, item := range list {
			r, _ := item.(map[string]any)
			method, _ := r["method"].(string)
			path, _ := r["path"].(string)
			if strings.TrimSpace(method) == "" {
				method = "ANY"
			}
			if strings.TrimSpace(path) == "" {
				path = "/"
			}
			out = append(out, [2]string{strings.TrimSpace(method), strings.TrimSpace(path)})
		}
		if len(out) > 0 {
			return out
		}
	}
	return [][2]string{{e.str("method", "ANY"), e.str("path", "/")}}
}

func pair(a, b string) string {
	if a > b {
		a, b = b, a
	}
	return a + "+" + b
}

var (
	validMethods = map[string]bool{"GET": true, "POST": true, "PUT": true, "PATCH": true, "DELETE": true, "HEAD": true, "OPTIONS": true, "ANY": true}
	routePath    = regexp.MustCompile(`^/[A-Za-z0-9._~\-/{}+]*$`)
)

func tableActions(access string) []string {
	read := []string{"dynamodb:GetItem", "dynamodb:BatchGetItem", "dynamodb:Query", "dynamodb:Scan", "dynamodb:ConditionCheckItem"}
	write := []string{"dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:BatchWriteItem"}
	switch access {
	case "read":
		return read
	case "write":
		return write
	}
	return append(read, write...)
}

func bucketActions(access string) []string {
	switch access {
	case "read":
		return []string{"s3:GetObject"}
	case "write":
		return []string{"s3:PutObject", "s3:DeleteObject"}
	}
	return []string{"s3:GetObject", "s3:PutObject", "s3:DeleteObject"}
}

func (g *gen) setEnv(fn, key string, v expr) {
	if g.env[fn] == nil {
		g.env[fn] = map[string]expr{}
	}
	g.env[fn][key] = v
}

func (g *gen) allow(fn string, actions []string, resources ...string) {
	st := newBlock("statement")
	st.attr("actions", strList(actions...))
	rs := make([]expr, len(resources))
	for i, r := range resources {
		rs[i] = raw(r)
	}
	st.attr("resources", list(rs...))
	g.policies[fn] = append(g.policies[fn], st)
}

func (g *gen) output(name, description string, value expr) {
	o := newBlock("output", name)
	o.attr("description", str(description))
	o.attr("value", value)
	g.outputs = append(g.outputs, o)
}

// resourceName is the AWS name of a resource: the prefix, then its name.
func resourceName(n *Node) expr {
	return str("${var.name_prefix}-" + awsName(n.name())).withTemplate()
}

// withTemplate turns an escaped string back into a template. Only Rivo's own
// text uses it: names from the diagram went through awsName first.
func (e expr) withTemplate() expr {
	s := e.lines[0]
	s = strings.ReplaceAll(s, "$${", "${")
	return raw(s)
}

// ── Lambda ───────────────────────────────────────────────────────────────────

var (
	runtimes = map[string]string{
		"nodejs24.x": "nodejs", "nodejs22.x": "nodejs",
		"python3.13": "python", "python3.12": "python", "python3.11": "python",
		"ruby3.4": "ruby", "ruby3.3": "ruby",
		"java21": "java", "java17": "java",
		"provided.al2023": "provided",
	}
	// Runtimes AWS no longer lets you create functions with.
	retired = map[string]string{
		"nodejs20.x": "nodejs22.x", "nodejs18.x": "nodejs22.x", "nodejs16.x": "nodejs22.x",
		"python3.10": "python3.13", "python3.9": "python3.13",
		"go1.x": "provided.al2023", "java11": "java21", "java8": "java21",
	}
	extensions  = map[string]string{"nodejs": ".js", "python": ".py", "ruby": ".rb"}
	handlerRule = regexp.MustCompile(`^([A-Za-z0-9_\-]+/)*[A-Za-z0-9_\-]+\.[A-Za-z_][A-Za-z0-9_]*$`)
	esModule    = regexp.MustCompile(`(?m)^\s*export\s`)
	envKey      = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)
)

func (g *gen) lambda(n *Node) {
	l := g.local[n.ID]
	f := g.file("lambda.tf")

	runtime := n.str("runtime", "python3.13")
	if next, ok := retired[runtime]; ok {
		g.warn(n.ID, "", fmt.Sprintf("%s: AWS retired %s, so the function uses %s.", n.name(), runtime, next))
		runtime = next
	} else if runtimes[runtime] == "" {
		g.warn(n.ID, "", fmt.Sprintf("%s: %q is not a Lambda runtime Rivo knows; the function uses python3.13.", n.name(), runtime))
		runtime = "python3.13"
	}
	family := runtimes[runtime]

	handler := n.str("handler", "app.handler")
	if family == "provided" {
		handler = "bootstrap"
	} else if !handlerRule.MatchString(handler) || strings.Contains(handler, "..") {
		g.warn(n.ID, "", fmt.Sprintf("%s: the handler %q is not valid; it uses app.handler.", n.name(), handler))
		handler = "app.handler"
	}

	// The code: written in the diagram, uploaded as a .zip, or a placeholder.
	var filename, hash expr
	source := n.str("source", "")
	pkg, _ := n.Config["package"].(map[string]any)
	pkgID, _ := pkg["id"].(string)
	ext, interpreted := extensions[family]

	switch {
	case source == "package" && project.ValidPackageID(pkgID):
		path := "packages/" + l + ".zip"
		g.packages = append(g.packages, Package{Path: path, PackageID: pkgID})
		filename = raw(`"${path.module}/` + path + `"`)
		hash = raw(`filebase64sha256("${path.module}/` + path + `")`)
	case interpreted:
		code := n.raw("code")
		if source != "inline" || strings.TrimSpace(code) == "" {
			code = placeholderCode(family)
			g.warn(n.ID, "", fmt.Sprintf("%s has no code yet, so it gets a placeholder that answers \"Hello from Lambda\".", n.name()))
		}
		module := handler[:strings.LastIndex(handler, ".")]
		if family == "nodejs" && esModule.MatchString(code) {
			ext = ".mjs"
		}
		main := module + ext
		g.extra = append(g.extra, File{Path: "functions/" + l + "/" + main, Content: code})
		g.functionFiles(n, l, main, len(code))
		g.archive = true
		arch := f.add(newBlock("data", "archive_file", l))
		arch.attr("type", str("zip"))
		arch.attr("source_dir", raw(`"${path.module}/functions/`+l+`"`))
		arch.attr("output_path", raw(`"${path.module}/.build/`+l+`.zip"`))
		filename = raw("data.archive_file." + l + ".output_path")
		hash = raw("data.archive_file." + l + ".output_base64sha256")
	default:
		path := "packages/" + l + ".zip"
		g.warn(n.ID, "", fmt.Sprintf("%s runs %s, which needs a compiled .zip: upload one in Rivo, or add %s before applying.", n.name(), runtime, path))
		filename = raw(`"${path.module}/` + path + `"`)
		hash = raw(`filebase64sha256("${path.module}/` + path + `")`)
	}

	role := f.add(newBlock("resource", "aws_iam_role", l))
	role.attr("name", resourceName(n))
	role.attr("assume_role_policy", raw("data.aws_iam_policy_document.lambda_assume.json"))

	logs := f.add(newBlock("resource", "aws_iam_role_policy_attachment", l+"_logs"))
	logs.attr("role", raw("aws_iam_role."+l+".name"))
	logs.attr("policy_arn", str("arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"))

	if statements := g.policies[n.ID]; len(statements) > 0 {
		doc := f.add(newBlock("data", "aws_iam_policy_document", l))
		for _, st := range statements {
			doc.items = append(doc.items, item{block: st})
		}
		pol := f.add(newBlock("resource", "aws_iam_role_policy", l))
		pol.attr("name", str("access"))
		pol.attr("role", raw("aws_iam_role."+l+".id"))
		pol.attr("policy", raw("data.aws_iam_policy_document."+l+".json"))
	}

	lg := f.add(newBlock("resource", "aws_cloudwatch_log_group", l))
	lg.attr("name", str("/aws/lambda/${var.name_prefix}-"+awsName(n.name())).withTemplate())
	lg.attr("retention_in_days", num(14))

	fn := f.add(newBlock("resource", "aws_lambda_function", l))
	fn.attr("function_name", resourceName(n))
	fn.attr("role", raw("aws_iam_role."+l+".arn"))
	fn.attr("runtime", str(runtime))
	fn.attr("handler", str(handler))
	fn.attr("memory_size", num(n.int("memory", 128, 128, 10240)))
	fn.attr("timeout", num(n.int("timeout", 30, 1, 900)))
	fn.attr("architectures", strList(oneOf(n.str("architecture", "x86_64"), "x86_64", "arm64")))
	fn.attr("filename", filename)
	fn.attr("source_code_hash", hash)
	if rc := n.int("reservedConcurrency", 0, 0, 100000); rc > 0 {
		fn.attr("reserved_concurrent_executions", num(rc))
	}
	if size := n.int("ephemeralStorage", 512, 512, 10240); size != 512 {
		fn.blank().child("ephemeral_storage").attr("size", num(size))
	}

	vars := map[string]expr{}
	if custom, ok := n.Config["environment"].(map[string]any); ok {
		for k, v := range custom {
			s, isStr := v.(string)
			if !envKey.MatchString(k) || !isStr {
				g.warn(n.ID, "", fmt.Sprintf("%s: the environment variable %q was left out, because its name is not valid.", n.name(), k))
				continue
			}
			vars[k] = str(s)
		}
	}
	for k, v := range g.env[n.ID] {
		vars[k] = v
	}
	if len(vars) > 0 {
		fn.blank().child("environment").attr("variables", object(vars))
	}

	fn.blank().attr("depends_on", list(raw("aws_iam_role_policy_attachment."+l+"_logs"), raw("aws_cloudwatch_log_group."+l)))

	g.output(l+"_function_name", "Name of the "+n.name()+" function", raw("aws_lambda_function."+l+".function_name"))
}

// Limits of the files written next to a function's handler. They live in the
// diagram, so they share its size limit.
const (
	maxFunctionFiles = 50
	maxFunctionBytes = 256 * 1024
)

var filePath = regexp.MustCompile(`^[A-Za-z0-9_][A-Za-z0-9_.-]*(/[A-Za-z0-9_][A-Za-z0-9_.-]*){0,4}$`)

// functionFiles writes the other files of a function written in the diagram,
// such as modules its handler imports.
func (g *gen) functionFiles(n *Node, l, main string, size int) {
	files, _ := n.Config["files"].(map[string]any)
	paths := make([]string, 0, len(files))
	for p := range files {
		paths = append(paths, p)
	}
	sort.Strings(paths)
	count := 0
	for _, p := range paths {
		content, ok := files[p].(string)
		switch {
		case !ok:
			continue
		case !filePath.MatchString(p) || strings.Contains(p, ".."):
			g.warn(n.ID, "", fmt.Sprintf("%s: the file name %q is not valid, so it was left out.", n.name(), p))
			continue
		case p == main:
			g.warn(n.ID, "", fmt.Sprintf("%s: %s is the handler's file, so the copy in the other files was left out.", n.name(), p))
			continue
		case count == maxFunctionFiles:
			g.warn(n.ID, "", fmt.Sprintf("%s has more than %d files; %s was left out.", n.name(), maxFunctionFiles, p))
			continue
		case size+len(content) > maxFunctionBytes:
			g.warn(n.ID, "", fmt.Sprintf("%s: its files go over %d KB, so %s was left out. Upload a .zip instead.", n.name(), maxFunctionBytes/1024, p))
			continue
		}
		count++
		size += len(content)
		g.extra = append(g.extra, File{Path: "functions/" + l + "/" + p, Content: content})
	}
}

func oneOf(v string, allowed ...string) string {
	for _, a := range allowed {
		if v == a {
			return v
		}
	}
	return allowed[0]
}

func placeholderCode(family string) string {
	switch family {
	case "python":
		return "import json\n\n\ndef handler(event, context):\n    return {\"statusCode\": 200, \"body\": json.dumps({\"message\": \"Hello from Lambda\"})}\n"
	case "ruby":
		return "require 'json'\n\ndef handler(event:, context:)\n  { statusCode: 200, body: { message: 'Hello from Lambda' }.to_json }\nend\n"
	}
	return "exports.handler = async () => ({\n  statusCode: 200,\n  body: JSON.stringify({ message: \"Hello from Lambda\" }),\n});\n"
}

// ── API Gateway ──────────────────────────────────────────────────────────────

func (g *gen) api(n *Node) {
	l := g.local[n.ID]
	f := g.file("apigateway.tf")

	switch kind := n.str("apiType", n.str("type", "HTTP")); kind {
	case "HTTP":
	case "WebSocket":
		g.warn(n.ID, "", fmt.Sprintf("%s is a WebSocket API, which Rivo does not generate yet. It is generated as an HTTP API.", n.name()))
	default:
		g.warn(n.ID, "", fmt.Sprintf("%s: Rivo generates HTTP APIs, which cost less than REST APIs and cover Lambda routes.", n.name()))
	}
	if auth := n.str("authorizationType", "NONE"); auth != "NONE" {
		g.warn(n.ID, "", fmt.Sprintf("%s: %s authorization is not generated yet, so every route is public.", n.name(), auth))
	}

	api := f.add(newBlock("resource", "aws_apigatewayv2_api", l))
	api.attr("name", resourceName(n))
	api.attr("protocol_type", str("HTTP"))
	if n.bool("cors", false) {
		cors := api.blank().child("cors_configuration")
		cors.attr("allow_origins", strList("*"))
		cors.attr("allow_methods", strList("*"))
		cors.attr("allow_headers", strList("*"))
	}

	stageName := n.str("stage", "$default")
	if stageName != "$default" && !regexp.MustCompile(`^[A-Za-z0-9_\-]{1,128}$`).MatchString(stageName) {
		stageName = "$default"
	}
	stage := f.add(newBlock("resource", "aws_apigatewayv2_stage", l))
	stage.attr("api_id", raw("aws_apigatewayv2_api."+l+".id"))
	stage.attr("name", str(stageName))
	stage.attr("auto_deploy", boolean(true))
	burst, rate := n.int("throttlingBurstLimit", 0, 0, 1000000), n.int("throttlingRateLimit", 0, 0, 1000000)
	if burst > 0 || rate > 0 {
		rs := stage.blank().child("default_route_settings")
		if burst > 0 {
			rs.attr("throttling_burst_limit", num(burst))
		}
		if rate > 0 {
			rs.attr("throttling_rate_limit", num(rate))
		}
	}

	routes := g.routes[n.ID]
	if len(routes) == 0 {
		g.warn(n.ID, "", fmt.Sprintf("%s has no routes: connect it to a Lambda function.", n.name()))
	}
	integrated := map[string]bool{}
	seen := map[string]bool{}
	rn := namer{}
	for _, r := range routes {
		fn := g.local[r.function]
		integration := l + "_" + fn
		if !integrated[fn] {
			integrated[fn] = true
			in := f.add(newBlock("resource", "aws_apigatewayv2_integration", integration))
			in.attr("api_id", raw("aws_apigatewayv2_api."+l+".id"))
			in.attr("integration_type", str("AWS_PROXY"))
			in.attr("integration_uri", raw("aws_lambda_function."+fn+".invoke_arn"))
			in.attr("payload_format_version", str("2.0"))

			perm := f.add(newBlock("resource", "aws_lambda_permission", integration))
			perm.attr("statement_id", str("AllowApiGateway-"+awsName(n.name())))
			perm.attr("action", str("lambda:InvokeFunction"))
			perm.attr("function_name", raw("aws_lambda_function."+fn+".function_name"))
			perm.attr("principal", str("apigateway.amazonaws.com"))
			perm.attr("source_arn", raw(`"${aws_apigatewayv2_api.`+l+`.execution_arn}/*/*"`))
		}

		key := r.method + " " + r.path
		if seen[key] {
			g.warn("", r.edgeID, fmt.Sprintf("%s already has the route %s, so this one was left out.", n.name(), key))
			continue
		}
		seen[key] = true
		name := rn.take(l + "_" + localName(strings.ToLower(r.method)+"_"+r.path))
		rt := f.add(newBlock("resource", "aws_apigatewayv2_route", name))
		rt.attr("api_id", raw("aws_apigatewayv2_api."+l+".id"))
		rt.attr("route_key", str(key))
		rt.attr("target", raw(`"integrations/${aws_apigatewayv2_integration.`+integration+`.id}"`))
	}

	g.output(l+"_url", "Base URL of the "+n.name()+" API", raw("aws_apigatewayv2_stage."+l+".invoke_url"))
}

// ── DynamoDB ─────────────────────────────────────────────────────────────────

func (g *gen) table(n *Node) {
	l := g.local[n.ID]
	f := g.file("dynamodb.tf")

	attrType := func(key string) string {
		return keyType(n.str(key, "S"))
	}
	pk := n.str("partitionKey", "id")
	sk := n.str("sortKey", "")
	if strings.Contains(sk, "(optional)") {
		sk = ""
	}
	// Every attribute a key uses is declared once, with the type it was
	// first given.
	attrs := []string{pk}
	types := map[string]string{pk: attrType("partitionKeyType")}
	// fits reports whether a key can use the attribute; declare adds it.
	fits := func(name, t, index string) bool {
		if have, ok := types[name]; ok && have != t {
			g.warn(n.ID, "", fmt.Sprintf("%s: the index %s uses %s as %s, but the table already uses it as %s, so the index was left out.", n.name(), index, name, t, have))
			return false
		}
		return true
	}
	declare := func(name, t string) {
		if _, ok := types[name]; !ok {
			types[name] = t
			attrs = append(attrs, name)
		}
	}
	if sk != "" {
		declare(sk, attrType("sortKeyType"))
	}
	indexes := g.indexes(n, fits, declare)

	t := f.add(newBlock("resource", "aws_dynamodb_table", l))
	t.attr("name", resourceName(n))
	billing := oneOf(n.str("billingMode", "PAY_PER_REQUEST"), "PAY_PER_REQUEST", "PROVISIONED")
	t.attr("billing_mode", str(billing))
	if billing == "PROVISIONED" {
		t.attr("read_capacity", num(n.int("readCapacity", 5, 1, 40000)))
		t.attr("write_capacity", num(n.int("writeCapacity", 5, 1, 40000)))
	}
	t.attr("hash_key", str(pk))
	if sk != "" {
		t.attr("range_key", str(sk))
	}
	if n.bool("streamEnabled", false) {
		t.attr("stream_enabled", boolean(true))
		t.attr("stream_view_type", str("NEW_AND_OLD_IMAGES"))
	}
	if n.bool("deletionProtection", false) {
		t.attr("deletion_protection_enabled", boolean(true))
	}

	for _, name := range attrs {
		a := t.blank().child("attribute")
		a.attr("name", str(name))
		a.attr("type", str(types[name]))
	}
	for _, ix := range indexes {
		gsi := t.blank().child("global_secondary_index")
		gsi.attr("name", str(ix.name))
		gsi.attr("projection_type", str(ix.projection))
		if billing == "PROVISIONED" {
			gsi.attr("read_capacity", num(n.int("readCapacity", 5, 1, 40000)))
			gsi.attr("write_capacity", num(n.int("writeCapacity", 5, 1, 40000)))
		}
		hash := gsi.blank().child("key_schema")
		hash.attr("attribute_name", str(ix.pk))
		hash.attr("key_type", str("HASH"))
		if ix.sk != "" {
			rng := gsi.blank().child("key_schema")
			rng.attr("attribute_name", str(ix.sk))
			rng.attr("key_type", str("RANGE"))
		}
	}
	if n.bool("pointInTimeRecovery", false) {
		t.blank().child("point_in_time_recovery").attr("enabled", boolean(true))
	}
	if n.bool("serverSideEncryption", false) {
		t.blank().child("server_side_encryption").attr("enabled", boolean(true))
	}
	if n.bool("ttlEnabled", false) {
		ttl := t.blank().child("ttl")
		ttl.attr("attribute_name", str(n.str("ttlAttribute", "expiresAt")))
		ttl.attr("enabled", boolean(true))
	}

	g.output(l+"_table_name", "Name of the "+n.name()+" table", raw("aws_dynamodb_table."+l+".name"))
}

type index struct {
	name, pk, sk, projection string
}

var indexName = regexp.MustCompile(`^[A-Za-z0-9_.-]{3,255}$`)

// keyType reads S, N or B, also from labels such as "N — Number".
func keyType(t string) string {
	t = strings.TrimSpace(t)
	if t == "" {
		return "S"
	}
	return oneOf(strings.ToUpper(t[:1]), "S", "N", "B")
}

// indexes reads a table's global secondary indexes. fits checks that a key's
// type agrees with the table, and declare registers the attribute.
func (g *gen) indexes(n *Node, fits func(name, t, index string) bool, declare func(name, t string)) []index {
	list, _ := n.Config["indexes"].([]any)
	var out []index
	seen := map[string]bool{}
	for _, item := range list {
		m, _ := item.(map[string]any)
		get := func(k string) string {
			v, _ := m[k].(string)
			return strings.TrimSpace(v)
		}
		ix := index{name: get("name"), pk: get("partitionKey"), sk: get("sortKey"), projection: oneOf(get("projection"), "ALL", "KEYS_ONLY")}
		switch {
		case !indexName.MatchString(ix.name):
			g.warn(n.ID, "", fmt.Sprintf("%s: the index name %q is not valid (3 to 255 letters, digits, '_', '-' or '.'), so it was left out.", n.name(), ix.name))
			continue
		case seen[ix.name]:
			g.warn(n.ID, "", fmt.Sprintf("%s already has an index called %s, so the second one was left out.", n.name(), ix.name))
			continue
		case ix.pk == "":
			g.warn(n.ID, "", fmt.Sprintf("%s: the index %s has no partition key, so it was left out.", n.name(), ix.name))
			continue
		case len(out) == 20:
			g.warn(n.ID, "", fmt.Sprintf("%s: a table takes up to 20 global secondary indexes, so %s was left out.", n.name(), ix.name))
			continue
		}
		pkType, skType := keyType(get("partitionKeyType")), keyType(get("sortKeyType"))
		if ix.sk == ix.pk {
			ix.sk = ""
		}
		if !fits(ix.pk, pkType, ix.name) || (ix.sk != "" && !fits(ix.sk, skType, ix.name)) {
			continue
		}
		declare(ix.pk, pkType)
		if ix.sk != "" {
			declare(ix.sk, skType)
		}
		seen[ix.name] = true
		out = append(out, ix)
	}
	return out
}

// ── S3 ───────────────────────────────────────────────────────────────────────

func (g *gen) bucket(n *Node) {
	l := g.local[n.ID]
	f := g.file("s3.tf")

	b := f.add(newBlock("resource", "aws_s3_bucket", l))
	// Bucket names are global, so AWS adds a unique suffix to the prefix.
	b.attr("bucket_prefix", str("${var.name_prefix}-"+truncate(awsName(n.name()), 14, '-')+"-").withTemplate())
	b.attr("force_destroy", boolean(n.bool("forceDestroy", false)))

	block := true
	if v, ok := n.Config["blockPublicAccess"].(bool); ok {
		block = v
	}
	if !block {
		g.warn(n.ID, "", fmt.Sprintf("%s: Rivo keeps buckets private. Serve public files through CloudFront instead.", n.name()))
	}
	pab := f.add(newBlock("resource", "aws_s3_bucket_public_access_block", l))
	pab.attr("bucket", raw("aws_s3_bucket."+l+".id"))
	pab.attr("block_public_acls", boolean(true))
	pab.attr("block_public_policy", boolean(true))
	pab.attr("ignore_public_acls", boolean(true))
	pab.attr("restrict_public_buckets", boolean(true))

	if n.bool("versioning", false) {
		v := f.add(newBlock("resource", "aws_s3_bucket_versioning", l))
		v.attr("bucket", raw("aws_s3_bucket."+l+".id"))
		v.blank().child("versioning_configuration").attr("status", str("Enabled"))
	}
	if n.str("encryption", "AES256") == "aws:kms" {
		enc := f.add(newBlock("resource", "aws_s3_bucket_server_side_encryption_configuration", l))
		enc.attr("bucket", raw("aws_s3_bucket."+l+".id"))
		rule := enc.blank().child("rule")
		rule.child("apply_server_side_encryption_by_default").attr("sse_algorithm", str("aws:kms"))
	}

	if dists := g.readers[n.ID]; len(dists) > 0 {
		g.site(n, l, dists)
	}

	g.output(l+"_bucket", "Name of the "+n.name()+" bucket", raw("aws_s3_bucket."+l+".bucket"))
}

// site uploads the files in site/<bucket>/ and lets the distributions read them.
func (g *gen) site(n *Node, l string, dists []string) {
	f := g.file("s3.tf")
	g.extra = append(g.extra, File{Path: "site/" + l + "/index.html", Content: placeholderSite(g.opts.ProjectName, n.name())})

	doc := f.add(newBlock("data", "aws_iam_policy_document", l+"_cdn"))
	st := doc.child("statement")
	st.attr("sid", str("AllowCloudFront"))
	st.attr("actions", strList("s3:GetObject"))
	st.attr("resources", list(raw(`"${aws_s3_bucket.`+l+`.arn}/*"`)))
	p := st.blank().child("principals")
	p.attr("type", str("Service"))
	p.attr("identifiers", strList("cloudfront.amazonaws.com"))
	c := st.blank().child("condition")
	c.attr("test", str("StringEquals"))
	c.attr("variable", str("AWS:SourceArn"))
	arns := make([]expr, len(dists))
	for i, d := range dists {
		arns[i] = raw("aws_cloudfront_distribution." + g.local[d] + ".arn")
	}
	c.attr("values", list(arns...))

	pol := f.add(newBlock("resource", "aws_s3_bucket_policy", l))
	pol.attr("bucket", raw("aws_s3_bucket."+l+".id"))
	pol.attr("policy", raw("data.aws_iam_policy_document."+l+"_cdn.json"))
	pol.blank().attr("depends_on", list(raw("aws_s3_bucket_public_access_block."+l)))

	obj := f.add(newBlock("resource", "aws_s3_object", l+"_site"))
	obj.comment("Every file in site/" + l + "/. Replace the placeholder with your site's build.")
	obj.attr("for_each", raw(`fileset("${path.module}/site/`+l+`", "**")`))
	obj.blank()
	obj.attr("bucket", raw("aws_s3_bucket."+l+".id"))
	obj.attr("key", raw("each.value"))
	obj.attr("source", raw(`"${path.module}/site/`+l+`/${each.value}"`))
	obj.attr("etag", raw(`filemd5("${path.module}/site/`+l+`/${each.value}")`))
	obj.attr("content_type", raw(`lookup(local.content_types, try(regex("\\.[^.]+$", lower(each.value)), ""), "application/octet-stream")`))

	if g.files["locals.tf"] == nil {
		loc := g.file("locals.tf").add(newBlock("locals"))
		loc.attr("content_types", object(map[string]expr{
			".html": str("text/html; charset=utf-8"), ".css": str("text/css"), ".js": str("text/javascript"),
			".mjs": str("text/javascript"), ".json": str("application/json"), ".svg": str("image/svg+xml"),
			".png": str("image/png"), ".jpg": str("image/jpeg"), ".jpeg": str("image/jpeg"), ".gif": str("image/gif"),
			".webp": str("image/webp"), ".ico": str("image/x-icon"), ".txt": str("text/plain; charset=utf-8"),
			".xml": str("application/xml"), ".woff": str("font/woff"), ".woff2": str("font/woff2"),
			".map": str("application/json"), ".webmanifest": str("application/manifest+json"),
		}))
	}
}

func placeholderSite(projectName, bucket string) string {
	title := htmlEscape(projectName)
	if title == "" {
		title = "Rivo"
	}
	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>` + title + `</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: #0b0b0f; color: #f4f4f5; }
    main { text-align: center; padding: 24px; }
    p { color: #a1a1aa; }
    code { background: #1c1c22; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>` + title + ` is live</h1>
    <p>Served from the ` + htmlEscape(bucket) + ` bucket through CloudFront.</p>
    <p>Replace the files in <code>site/</code> and run <code>terraform apply</code> again.</p>
  </main>
</body>
</html>
`
}

func htmlEscape(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;").Replace(s)
}

// ── CloudFront ───────────────────────────────────────────────────────────────

func (g *gen) distribution(n *Node) {
	l := g.local[n.ID]
	f := g.file("cloudfront.tf")

	buckets := g.origins[n.ID]
	if len(buckets) == 0 {
		g.warn(n.ID, "", fmt.Sprintf("%s has no origin: connect it to an S3 bucket. It was left out.", n.name()))
		return
	}
	if len(buckets) > 1 {
		g.warn(n.ID, "", fmt.Sprintf("%s is connected to %d buckets; it serves the first one.", n.name(), len(buckets)))
	}
	b := g.local[buckets[0]]

	oac := f.add(newBlock("resource", "aws_cloudfront_origin_access_control", l))
	oac.attr("name", resourceName(n))
	oac.attr("origin_access_control_origin_type", str("s3"))
	oac.attr("signing_behavior", str("always"))
	oac.attr("signing_protocol", str("sigv4"))

	root := n.str("defaultRootObject", "index.html")
	if strings.ContainsAny(root, "/\\ ") {
		root = "index.html"
	}
	d := f.add(newBlock("resource", "aws_cloudfront_distribution", l))
	d.attr("enabled", boolean(true))
	d.attr("comment", str(n.name()))
	d.attr("default_root_object", str(root))
	d.attr("price_class", str(oneOf(n.str("priceClass", "PriceClass_100"), "PriceClass_100", "PriceClass_200", "PriceClass_All")))
	d.attr("http_version", str(oneOf(n.str("httpVersion", "http2"), "http2", "http1.1", "http2and3", "http3")))
	d.attr("is_ipv6_enabled", boolean(true))
	d.attr("wait_for_deployment", boolean(false))

	o := d.blank().child("origin")
	o.attr("origin_id", str("s3-"+b))
	o.attr("domain_name", raw("aws_s3_bucket."+b+".bucket_regional_domain_name"))
	o.attr("origin_access_control_id", raw("aws_cloudfront_origin_access_control."+l+".id"))

	cb := d.blank().child("default_cache_behavior")
	cb.attr("target_origin_id", str("s3-"+b))
	cb.attr("viewer_protocol_policy", str("redirect-to-https"))
	cb.attr("allowed_methods", strList("GET", "HEAD", "OPTIONS"))
	cb.attr("cached_methods", strList("GET", "HEAD"))
	cb.attr("compress", boolean(n.bool("compress", true)))
	cb.comment("AWS managed policy CachingOptimized.")
	cb.attr("cache_policy_id", str("658327ea-f89d-4fab-a63d-7e88639e58f6"))

	if n.bool("spa", false) {
		// A missing key answers 403 without s3:ListBucket, so both go to the app.
		for _, code := range []int{403, 404} {
			e := d.blank().child("custom_error_response")
			e.attr("error_code", num(code))
			e.attr("response_code", num(200))
			e.attr("response_page_path", str("/"+root))
		}
	}

	d.blank().child("restrictions").child("geo_restriction").attr("restriction_type", str("none"))
	d.blank().child("viewer_certificate").attr("cloudfront_default_certificate", boolean(true))

	g.output(l+"_url", "Address of the "+n.name()+" distribution", raw(`"https://${aws_cloudfront_distribution.`+l+`.domain_name}"`))
}

// ── EventBridge ──────────────────────────────────────────────────────────────

var schedule = regexp.MustCompile(`^(rate\(\d+ (minute|minutes|hour|hours|day|days)\)|cron\([^()]+\))$`)

func (g *gen) rule(n *Node) {
	l := g.local[n.ID]
	f := g.file("eventbridge.tf")

	r := f.add(newBlock("resource", "aws_cloudwatch_event_rule", l))
	r.attr("name", resourceName(n))
	if desc := n.str("description", ""); desc != "" {
		r.attr("description", str(desc))
	}
	r.attr("state", str(map[bool]string{true: "ENABLED", false: "DISABLED"}[n.bool("enabled", true)]))

	if n.str("trigger", "schedule") == "schedule" {
		expr := n.str("schedule", "rate(5 minutes)")
		if !schedule.MatchString(expr) {
			g.warn(n.ID, "", fmt.Sprintf("%s: %q is not a schedule expression; it runs every 5 minutes.", n.name(), expr))
			expr = "rate(5 minutes)"
		}
		r.attr("schedule_expression", str(expr))
	} else {
		pattern := n.str("eventPattern", `{"source": ["`+awsName(g.opts.ProjectName)+`"]}`)
		var v map[string]any
		if err := json.Unmarshal([]byte(pattern), &v); err != nil || len(v) == 0 {
			g.warn(n.ID, "", fmt.Sprintf("%s: the event pattern is not a JSON object, so it matches events from the source %q.", n.name(), awsName(g.opts.ProjectName)))
			v = map[string]any{"source": []string{awsName(g.opts.ProjectName)}}
		}
		pretty, _ := json.MarshalIndent(v, "", "  ")
		text := strings.NewReplacer("${", "$${", "%{", "%%{").Replace(string(pretty))
		r.blank().attr("event_pattern", heredoc(text))
	}

	targets := g.targets[n.ID]
	if len(targets) == 0 {
		g.warn(n.ID, "", fmt.Sprintf("%s has no target: connect it to a Lambda function.", n.name()))
	}
	for _, id := range targets {
		fn := g.local[id]
		name := l + "_" + fn
		t := f.add(newBlock("resource", "aws_cloudwatch_event_target", name))
		t.attr("rule", raw("aws_cloudwatch_event_rule."+l+".name"))
		t.attr("target_id", str(truncate(awsName(g.nodes[id].name()), 64, '-')))
		t.attr("arn", raw("aws_lambda_function."+fn+".arn"))

		p := f.add(newBlock("resource", "aws_lambda_permission", name))
		p.attr("statement_id", str("AllowEventBridge-"+awsName(n.name())))
		p.attr("action", str("lambda:InvokeFunction"))
		p.attr("function_name", raw("aws_lambda_function."+fn+".function_name"))
		p.attr("principal", str("events.amazonaws.com"))
		p.attr("source_arn", raw("aws_cloudwatch_event_rule."+l+".arn"))
	}
}

// ── Output ───────────────────────────────────────────────────────────────────

func (g *gen) result() *Result {
	providers := &file{header: "Generated by Rivo from the project's diagram. Changes here are\noverwritten the next time it is generated."}
	tf := providers.add(newBlock("terraform"))
	tf.attr("required_version", str(">= 1.6"))
	req := tf.blank().child("required_providers")
	req.attr("aws", object(map[string]expr{"source": str("hashicorp/aws"), "version": str("~> 6.40")}))
	if g.archive {
		req.attr("archive", object(map[string]expr{"source": str("hashicorp/archive"), "version": str("~> 2.7")}))
	}
	p := providers.add(newBlock("provider", "aws"))
	p.attr("region", raw("var.region"))
	p.blank().child("default_tags").attr("tags", object(map[string]expr{
		"managed-by":   str("rivo"),
		"rivo-project": str(g.opts.ProjectName),
	}))

	if len(g.files["lambda.tf"].blocksOrNil()) > 0 {
		lf := g.files["lambda.tf"]
		doc := newBlock("data", "aws_iam_policy_document", "lambda_assume")
		st := doc.child("statement")
		st.attr("actions", strList("sts:AssumeRole"))
		pr := st.blank().child("principals")
		pr.attr("type", str("Service"))
		pr.attr("identifiers", strList("lambda.amazonaws.com"))
		lf.blocks = append([]*block{doc}, lf.blocks...)
	}
	if g.publishes {
		bus := newBlock("data", "aws_cloudwatch_event_bus", "default")
		bus.attr("name", str("default"))
		ef := g.file("eventbridge.tf")
		ef.blocks = append([]*block{bus}, ef.blocks...)
	}

	vars := &file{}
	region := vars.add(newBlock("variable", "region"))
	region.attr("description", str("AWS Region to create everything in"))
	region.attr("type", raw("string"))
	region.attr("default", str(g.opts.Region))
	prefix := vars.add(newBlock("variable", "name_prefix"))
	prefix.attr("description", str("Starts the name of every resource, so several copies can share an account"))
	prefix.attr("type", raw("string"))
	prefix.attr("default", str(NamePrefix(g.opts.ProjectName)))
	v := prefix.blank().child("validation")
	v.attr("condition", raw(`can(regex("^[a-z][a-z0-9-]{0,19}$", var.name_prefix))`))
	v.attr("error_message", str("Use up to 20 lower case letters, digits and hyphens, starting with a letter."))

	outputs := &file{blocks: g.outputs}

	out := &Result{Packages: g.packages, Warnings: g.warnings}
	if out.Packages == nil {
		out.Packages = []Package{}
	}
	if out.Warnings == nil {
		out.Warnings = []Warning{}
	}
	add := func(path string, f *file) {
		if f != nil && len(f.blocks) > 0 {
			out.Files = append(out.Files, File{Path: path, Content: f.String()})
		}
	}
	add("providers.tf", providers)
	add("variables.tf", vars)
	names := make([]string, 0, len(g.files))
	for name := range g.files {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		add(name, g.files[name])
	}
	add("outputs.tf", outputs)
	out.Files = append(out.Files, File{Path: "README.md", Content: g.readme()})
	out.Files = append(out.Files, g.extra...)
	out.Files = append(out.Files, File{Path: ".gitignore", Content: ".terraform/\n.build/\n*.tfstate\n*.tfstate.*\n"})
	return out
}

func (f *file) blocksOrNil() []*block {
	if f == nil {
		return nil
	}
	return f.blocks
}

func (g *gen) readme() string {
	var sb strings.Builder
	name := g.opts.ProjectName
	if name == "" {
		name = "Rivo project"
	}
	fmt.Fprintf(&sb, "# %s\n\nTerraform generated by Rivo from the project's diagram.\n\n", name)
	sb.WriteString("## Apply it\n\nYou need Terraform 1.6 or later and AWS credentials for the account to create the resources in.\n\n")
	sb.WriteString("```bash\nterraform init\nterraform plan\nterraform apply\n```\n\n")
	sb.WriteString("`terraform output` prints the addresses of what was created. `terraform destroy` removes everything again.\n\n")
	sb.WriteString("Set `name_prefix` to create a second copy, such as a staging environment, in the same account:\n\n")
	sb.WriteString("```bash\nterraform apply -var name_prefix=staging\n```\n")
	if len(g.extra) > 0 || len(g.packages) > 0 {
		sb.WriteString("\n## Files\n\n")
		if len(g.extra) > 0 {
			sb.WriteString("- `functions/`: the code of each Lambda function written in the diagram.\n")
		}
		if len(g.packages) > 0 {
			sb.WriteString("- `packages/`: the .zip packages uploaded to Rivo.\n")
		}
		for _, f := range g.extra {
			if strings.HasPrefix(f.Path, "site/") {
				sb.WriteString("- `site/`: the files each bucket serves through CloudFront. Replace the placeholder with your site's build and apply again.\n")
				break
			}
		}
	}
	if len(g.warnings) > 0 {
		sb.WriteString("\n## Left out or changed\n\n")
		for _, w := range g.warnings {
			sb.WriteString("- " + w.Message + "\n")
		}
	}
	return sb.String()
}
