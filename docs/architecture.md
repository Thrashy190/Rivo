# Architecture

Rivo has a React web app and a serverless API in Go, both deployed to AWS with Terraform. The app signs in with Cognito through the API and reads and writes everything through it. The API generates Terraform from a diagram, and the deployment engine, a Fargate task, plans and applies it in AWS accounts that workspaces connect.

## Code map

| Path | What it does |
|---|---|
| `web/` | React app: sign-in, workspaces, members, projects and the canvas |
| `web/src/services/` | Calls to the API, one module per area. `api.ts` adds the token and renews it |
| `web/src/features/workspace/` | The workspace in the URL, its folders and your role in it |
| `web/src/features/canvas/` | The hand-written canvas, its service catalog and configuration panels |
| `web/src/features/deploy/` | The Deploy panel, the engine's log and the API test console |
| `services/shared/` | Go code shared by the Lambdas: models, permissions, repositories and responses |
| `services/shared/tfgen/` | Turns a diagram into Terraform, for the export and the engine |
| `services/engine/` | The deployment engine: the runner, its Dockerfile and the providers it may use |
| `services/<area>/<action>/` | One Lambda per action, each with its own Go module |
| `infra/api/` | Terraform for the API: Lambdas, API Gateway, DynamoDB and Cognito, and the engine (`engine.tf`) |
| `infra/web/` | Terraform for hosting the web app: S3 and CloudFront |

`infra/api` and `infra/web` are separate Terraform configurations, each with its own state.

## Accounts and tenants

Rivo has two kinds of administrator.

| | Platform administrator | Workspace owner |
|---|---|---|
| Who | The people who run this installation of Rivo | Someone from a customer team, who owns the resources created in the workspace |
| Stored in | `users` table, role `admin` | `memberships` table, role `owner` |
| Created by | Another platform administrator | A platform administrator |
| Can do | Manage accounts, decide who can open workspaces, add and remove workspace owners, read every workspace | Everything inside their workspace, including inviting their team with a restricted role |
| Cannot do | Change what is inside a workspace without a membership | Create platform administrators or other owners, see other workspaces |

A platform administrator who is not a member of a workspace acts as a viewer of it. Each of those reads, and each new owner, writes an audit line to the Lambda's log. People who use an installation should be told that its administrators can read their workspaces.

### Workspace roles

| Permission | Owner | Editor | Operator | Viewer |
|---|---|---|---|---|
| Read the workspace, members and projects | ✓ | ✓ | ✓ | ✓ |
| Run deployments | ✓ | ✓ | ✓ | |
| Create, change and delete projects and folders | ✓ | ✓ | | |
| Invite members and connect accounts | ✓ | | | |

Owners can change or remove members with a restricted role, but not other owners. Deployment permissions already exist in the role table, and they will take effect when deployments are built.

### How a request is authorized

1. API Gateway's Cognito authorizer validates the token.
2. `authz.RequireWorkspace` loads the user and their membership in the workspace named in the path.
3. A person outside the workspace gets a 404, so they cannot learn that it exists, unless they are a platform administrator, who can read it. Anyone without the permission gets a 403.
4. Queries read only that workspace's partition in DynamoDB.

### Inviting someone

Public signup is closed in Cognito. `POST /workspaces/{workspaceId}/members` creates an account if the person has none, and Cognito emails them a temporary password. New accounts get the `member` platform role, which has no platform permissions. This route can grant only the editor, operator and viewer roles.

## API routes for tenants

| Route | Permission |
|---|---|
| `POST /workspaces` | `workspaces:create` (platform) |
| `GET /workspaces` | Signed in; lists your workspaces, or all of them for a platform administrator |
| `GET /workspaces/{workspaceId}` | `workspace:read` |
| `POST /workspaces/{workspaceId}/owners` | `workspaces:manage` (platform) |
| `DELETE /workspaces/{workspaceId}/owners/{userId}` | `workspaces:manage` (platform) |
| `GET /workspaces/{workspaceId}/members` | `members:read` |
| `POST /workspaces/{workspaceId}/members` | `members:manage` |
| `PATCH /workspaces/{workspaceId}/members/{userId}` | `members:manage` |
| `DELETE /workspaces/{workspaceId}/members/{userId}` | `members:manage` |
| `GET /workspaces/{workspaceId}/folders` | `projects:read` |
| `POST /workspaces/{workspaceId}/folders` | `folders:manage` |
| `DELETE /workspaces/{workspaceId}/folders/{folderId}` | `folders:manage` |
| `GET /workspaces/{workspaceId}/projects` | `projects:read` |
| `POST /workspaces/{workspaceId}/projects` | `projects:create` |
| `GET /workspaces/{workspaceId}/projects/{projectId}` | `projects:read` |
| `PATCH /workspaces/{workspaceId}/projects/{projectId}` | `projects:update` |
| `DELETE /workspaces/{workspaceId}/projects/{projectId}` | `projects:delete` |
| `GET /workspaces/{workspaceId}/projects/{projectId}/draft` | `projects:read` |
| `PUT /workspaces/{workspaceId}/projects/{projectId}/draft` | `projects:update` |
| `GET /workspaces/{workspaceId}/projects/{projectId}/versions` | `projects:read` |
| `POST /workspaces/{workspaceId}/projects/{projectId}/versions` | `projects:update` |
| `GET /workspaces/{workspaceId}/projects/{projectId}/versions/{number}` | `projects:read` |
| `POST /workspaces/{workspaceId}/projects/{projectId}/packages` | `projects:update` |
| `GET /workspaces/{workspaceId}/projects/{projectId}/packages/{packageId}` | `projects:read` |
| `POST /workspaces/{workspaceId}/projects/{projectId}/terraform` | `projects:read` |
| `GET /workspaces/{workspaceId}/connections` | `projects:read` |
| `POST /workspaces/{workspaceId}/connections` | `connections:manage` |
| `POST /workspaces/{workspaceId}/connections/{connectionId}/verify` | `connections:manage` |
| `DELETE /workspaces/{workspaceId}/connections/{connectionId}` | `connections:manage` |
| `GET /workspaces/{workspaceId}/deployments` | `projects:read` |
| `GET /workspaces/{workspaceId}/deployments/{deploymentId}` | `projects:read` |
| `POST /workspaces/{workspaceId}/deployments/{deploymentId}/approve` | `deployments:run` |
| `POST /workspaces/{workspaceId}/deployments/{deploymentId}/cancel` | `deployments:run` |
| `GET /workspaces/{workspaceId}/projects/{projectId}/deployments` | `projects:read` |
| `POST /workspaces/{workspaceId}/projects/{projectId}/deployments` | `deployments:run` |
| `POST /workspaces/{workspaceId}/projects/{projectId}/test-request` | `deployments:run` |

## How diagrams are stored

DynamoDB holds what a project is and S3 holds its diagrams, under one prefix per workspace and project:

```text
workspaces/{workspaceId}/projects/{projectId}/
├── draft.json            # the diagram people are editing
├── versions/{number}.json   # saved copies that never change
├── packages/{packageId}.zip # Lambda code uploaded as a .zip
├── exports/terraform.zip    # the last Terraform generated, replaced by the next
├── deployments/{id}/        # diagram.json, plan.json, workdir.tar.gz, plan.log, apply.log
└── state/terraform.tfstate  # the state of what the project created, and its .tflock
```

1. `GET .../draft` returns the diagram and its ETag. A new project returns an empty diagram and no ETag.
2. `PUT .../draft` saves it. Send the ETag as `If-Match`, or `If-None-Match: *` on a first save. If someone else saved in between, the answer is a 409 instead of overwriting their work.
3. `POST .../versions` copies the draft to the next version number, reserved atomically in DynamoDB.

A Lambda's code is part of its node in the diagram: written in the editor, it is stored in the node itself, up to 256 KB. A `.zip` is uploaded straight from the browser to S3 with a form that `POST .../packages` signs for 15 minutes, which S3 limits to 50 MB, and the node keeps its package ID. Packages stay until the project is deleted, because versions may still use them.

Every route looks the project up inside the workspace in the path before it touches S3. Deleting a project removes its diagrams and versions first, so a failed deletion can be repeated. The bucket keeps overwritten and deleted copies for 30 days.

## How a diagram becomes Terraform

`POST .../terraform` reads the saved draft, or a version with `{"version": n}`, and `services/shared/tfgen` writes a Terraform configuration from it. The Lambda stores it as a `.zip` with the Lambda packages it uses, and answers with the files, the warnings and a link to the `.zip` that lasts five minutes. Reading a project is enough: nothing in AWS changes.

| In the diagram | Becomes |
|---|---|
| Lambda | A function with its own role and log group. Code from the editor goes in `functions/`, an uploaded `.zip` in `packages/`, and a function with neither gets a placeholder that answers "Hello from Lambda". |
| API Gateway → Lambda | An HTTP API, an integration per function and a route per method and path on the connection |
| Lambda ↔ DynamoDB or S3 | Read, write or both on the table or bucket, and its name in `ITEMS_TABLE` or `SITE_BUCKET` |
| CloudFront → S3 | A distribution that reads a private bucket through origin access control, and the files in `site/<bucket>/` |
| EventBridge → Lambda | A rule, on a schedule or an event pattern, that runs the function |
| Lambda → EventBridge | Permission to send events to the default bus, named in `EVENT_BUS_NAME` |

Other services and connections are left out, and each one becomes a warning. Every name starts with the `name_prefix` variable, and the region defaults to the project's.

Only Rivo writes the HCL. Values from the diagram, such as names, handlers and paths, go in as quoted strings with `${` escaped, or are checked against a pattern first, so a diagram cannot add a resource or a provisioner. That is what will let the engine run the result with its own role (see "Never run Terraform from a user" in `CLAUDE.md`). Package IDs are validated before they become S3 keys.

`go test ./tfgen/` checks the output for the three blueprints. With `RIVO_TERRAFORM_CHECK=1` it also runs `terraform fmt -check` and `terraform validate` on them, which downloads the AWS provider.

## How a deployment runs

A workspace connects an AWS account by creating a role there from a CloudFormation template Rivo generates. The role trusts Rivo's account, only for the engine's task role and the Lambda that verifies connections, and only with an external ID Rivo picked for that connection. Verifying assumes the role, checks the account, and refuses a role that can also be assumed without the external ID. Rivo stores no keys.

1. `POST .../projects/{projectId}/deployments` copies the saved draft to `deployments/{id}/diagram.json`, takes the project's lock (`active_deployment` on its item; one deployment at a time) and starts an engine task with `ecs:RunTask`, passing only the workspace, the deployment ID and the phase.
2. The task (`services/engine/runner`) runs `tfgen` on that diagram with a deploy target: an S3 backend for the project's state with `use_lockfile`, and an AWS provider that assumes the connection's role with its external ID and refuses any other account. It runs `terraform init` with `-plugin-dir`, so only the providers in the image exist, then `terraform plan -out`. It stores the readable plan, and the working directory with the saved plan, and waits.
3. Someone with `deployments:run` approves (`.../approve`) or discards (`.../cancel`) it. Approving starts a second task that applies exactly that plan, then reads `terraform output` into the deployment and the project as endpoints per node.
4. A destroy plans with only the providers and the backend, so it removes everything in the state even if the diagram changed.

The runner uploads its log every two seconds, and the app polls `GET .../deployments/{id}`. If a task dies before recording its result, an EventBridge rule on ECS task changes runs `task-stopped`, which marks the deployment failed and frees the project. Each phase adds its seconds to the workspace's month in the `usage` table.

A project with infrastructure keeps its account (`connection_id`) until it is destroyed: it cannot be deleted, deployed to another account, or have that account removed before then.

`POST .../test-request` sends a request to an API the project deployed, from a Lambda, and returns the answer. It only reaches the `execute-api` address in the project's endpoints, and does not follow redirects.

The engine runs in public subnets of its own VPC, with only outbound HTTPS and no NAT gateway. Its image is built with Docker by `terraform apply`, like the Lambdas are built with Go, and tagged by a hash of its sources.

## How the web app talks to the API

- **Sign-in.** `POST /auth/login` returns Cognito's tokens, or a `NEW_PASSWORD_REQUIRED` challenge the first time, which the app answers with `POST /auth/new-password`. The ID token lasts an hour, and the app gets a new one from `POST /auth/refresh` with the refresh token, which lasts 30 days. Both are kept in the browser's local storage.
- **Roles.** The app hides what your role cannot do, using the same table as the API. The API still checks every request.
- **CORS.** Lambdas add `Access-Control-Allow-Origin` from `web_origin`, and API Gateway answers the browser's `OPTIONS` requests and its own errors, such as an expired token, with the same header. Locally, Vite forwards `/api` to the API, so the browser sees one site and CORS does not apply.

| Route | Who can call it |
|---|---|
| `POST /auth/login` | Anyone |
| `POST /auth/new-password` | Anyone with the session from a login |
| `POST /auth/refresh` | Anyone with a refresh token |
| `POST /auth/forgot-password` | Anyone. Emails a code, and answers the same whether or not the address has an account |
| `POST /auth/reset-password` | Anyone with that code |
| `GET /users/me` | Signed in |

## Known limits

- **Access is per workspace, not per project.** Everyone in a workspace can see all its projects.
- **Lambda dependencies need a .zip.** The engine never installs packages: Python functions written in the editor have boto3, and Node.js ones the AWS SDK.
- **One web origin.** `web_origin` allows a single address. Serving the app from two domains needs another approach, such as the API behind the same CloudFront distribution.
- **Two concurrent changes could remove the last owner.** The check reads the member list and then writes, without a transaction.

## Decisions

- **One Lambda per action.** Each has narrow IAM permissions, at the cost of more Terraform and Go modules.
- **DynamoDB, keyed by workspace.** It needs no VPC or connection pooling and costs nothing when idle. Partitioning by `workspace_id` keeps queries inside one tenant.
- **Diagrams live in S3.** DynamoDB holds at most 400 KB per item, and diagrams need drafts and versions.
- **Diagrams go through the API, packages do not.** A Lambda can validate each diagram, enforce the 5 MB limit and detect conflicts. A `.zip` is too large for a Lambda's 6 MB request limit, so it goes to S3 with a presigned form, and the bucket allows uploads from `web_origin` and `dev_web_origin`.
- **AWS only, for now.** Rivo runs on AWS and designs for AWS.
- **Terraform is generated in Go, in the API.** The export and the engine share one generator, and the browser never sends HCL. Diagrams name what to create; Rivo decides how.
- **Plans are approved before they are applied.** The engine stores the saved plan and applies only that one, so what changes in AWS is what someone read.
- **The engine assumes roles; it gets no credentials.** A task only receives IDs. The role and its external ID come from DynamoDB, and the task role can only assume roles with a Rivo-style external ID.
- **HTTP APIs, not REST APIs.** They cost less and cover Lambda routes, CORS and throttling. REST APIs in a diagram are generated as HTTP APIs, with a warning.
- **Terraform in the deployment engine.** Rivo is not sold as a hosted service today. Terraform's license (BUSL) restricts paid hosted offerings that compete with IBM's paid versions, so this must be reviewed before charging for hosting.
