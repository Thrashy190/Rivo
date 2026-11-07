# Working on the Lambdas

Each Lambda is its own Go module under `services/<area>/<action>/`. `services/shared` is another module that they use through a `replace` line, so a clean clone builds without publishing anything.

## Local editor setup

`services/go.work` is git-ignored and optional. It lets your editor treat every module as one workspace. Builds and CI do not use it, so anything a build needs must be in the Lambda's own `go.mod`.

```bash
cd services
go work init
find . -name go.mod -exec dirname {} \; | xargs go work use
```

## What lives in `shared`

| Package | What it holds |
|---|---|
| `models/` | Domain types with their DynamoDB and JSON tags |
| `authz/` | `Caller`, `Require` for platform permissions, `RequireWorkspace` for workspace permissions |
| `errors/` | `ApiError`, its constructors and Cognito error mapping. Knows nothing about API Gateway |
| `transport/apigateway/` | Turns results and `ApiError`s into API Gateway responses |
| `repository/` | DynamoDB access |
| `storage/` | Diagrams in S3 |
| `directory/` | Finds or invites people in Cognito |

Interfaces are declared in each Lambda and list only the methods it uses, so a test can pass a small fake.

## How a Lambda gets built

On `plan` and `apply`, `infra/api/modules/lambda/golang` runs this inside the Lambda's folder, then zips `bootstrap` into `services/build/`:

```bash
go mod tidy
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="-s -w" -o bootstrap .
```

The architecture in `aws_lambda_function` must match `GOARCH`.

## Add a Lambda

1. Create `services/<area>/<action>/main.go`. `services/folder/list-folders` is a small example of a route inside a workspace.
2. Create its module, with `shared` as a local dependency:

   ```bash
   cd services/<area>/<action>
   go mod init <action>
   go mod edit -replace github.com/Thrashy190/Rivo/services/shared=../../shared
   go mod edit -require github.com/Thrashy190/Rivo/services/shared@v0.0.0-00010101000000-000000000000
   go mod tidy
   ```

3. Register it in Terraform with only the IAM actions it needs, pass `cors_allow_origin = var.web_origin` so the web app can read its answers, and add its route. API Gateway answers the browser's `OPTIONS` request for the new path by itself. See `infra/api/projects.tf`.
4. Add a test that covers its permissions, including someone from another workspace.
5. Run `make check` from the repository root.
