# Architecture

Rivo has a React web app and a serverless API in Go, both deployed to AWS with Terraform. The app signs in with Cognito through the API and reads and writes everything through it. Generating Terraform from a diagram and deploying it are not built yet.

## Code map

| Path | What it does |
|---|---|
| `web/` | React app: sign-in, workspaces, members, projects and the canvas |
| `web/src/services/` | Calls to the API, one module per area. `api.ts` adds the token and renews it |
| `web/src/features/workspace/` | The workspace in the URL, its folders and your role in it |
| `web/src/features/canvas/` | The hand-written canvas, its service catalog and configuration panels |
| `services/shared/` | Go code shared by the Lambdas: models, permissions, repositories and responses |
| `services/<area>/<action>/` | One Lambda per action, each with its own Go module |
| `infra/api/` | Terraform for the API: Lambdas, API Gateway, DynamoDB and Cognito |
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

## How diagrams are stored

DynamoDB holds what a project is and S3 holds its diagrams, under one prefix per workspace and project:

```text
workspaces/{workspaceId}/projects/{projectId}/
├── draft.json            # the diagram people are editing
└── versions/{number}.json   # saved copies that never change
```

1. `GET .../draft` returns the diagram and its ETag. A new project returns an empty diagram and no ETag.
2. `PUT .../draft` saves it. Send the ETag as `If-Match`, or `If-None-Match: *` on a first save. If someone else saved in between, the answer is a 409 instead of overwriting their work.
3. `POST .../versions` copies the draft to the next version number, reserved atomically in DynamoDB.

Every route looks the project up inside the workspace in the path before it touches S3. Deleting a project removes its diagrams and versions first, so a failed deletion can be repeated. The bucket keeps overwritten and deleted copies for 30 days.

## How the web app talks to the API

- **Sign-in.** `POST /auth/login` returns Cognito's tokens, or a `NEW_PASSWORD_REQUIRED` challenge the first time, which the app answers with `POST /auth/new-password`. The ID token lasts an hour, and the app gets a new one from `POST /auth/refresh` with the refresh token, which lasts 30 days. Both are kept in the browser's local storage.
- **Roles.** The app hides what your role cannot do, using the same table as the API. The API still checks every request.
- **CORS.** Lambdas add `Access-Control-Allow-Origin` from `web_origin`, and API Gateway answers the browser's `OPTIONS` requests and its own errors, such as an expired token, with the same header. Locally, Vite forwards `/api` to the API, so the browser sees one site and CORS does not apply.

| Route | Who can call it |
|---|---|
| `POST /auth/login` | Anyone |
| `POST /auth/new-password` | Anyone with the session from a login |
| `POST /auth/refresh` | Anyone with a refresh token |
| `GET /users/me` | Signed in |

## Known limits

- **Access is per workspace, not per project.** Everyone in a workspace can see all its projects.
- **One web origin.** `web_origin` allows a single address. Serving the app from two domains needs another approach, such as the API behind the same CloudFront distribution.
- **Two concurrent changes could remove the last owner.** The check reads the member list and then writes, without a transaction.

## Decisions

- **One Lambda per action.** Each has narrow IAM permissions, at the cost of more Terraform and Go modules.
- **DynamoDB, keyed by workspace.** It needs no VPC or connection pooling and costs nothing when idle. Partitioning by `workspace_id` keeps queries inside one tenant.
- **Diagrams live in S3.** DynamoDB holds at most 400 KB per item, and diagrams need drafts and versions.
- **Diagrams go through the API, not presigned URLs.** The Lambda can validate each diagram, enforce the 5 MB limit and detect conflicts, and the bucket needs no CORS rules. Large binaries, such as Lambda packages, will need presigned URLs.
- **AWS only, for now.** Rivo runs on AWS and designs for AWS.
- **Terraform in the deployment engine.** Rivo is not sold as a hosted service today. Terraform's license (BUSL) restricts paid hosted offerings that compete with IBM's paid versions, so this must be reviewed before charging for hosting.
