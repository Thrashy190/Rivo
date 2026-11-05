# Architecture

Rivo has a React web app and a serverless API in Go, both deployed to AWS with Terraform. Today the web app runs on sample data in the browser and is not connected to the API. Generating Terraform from a diagram and deploying it are not built yet.

## Code map

| Path | What it does |
|---|---|
| `web/` | React app: canvas, projects and sign-in |
| `web/src/services/` | Data access for the app. Backed by `mockStore.ts` until it is connected to the API |
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
| Can do | Manage accounts, decide who can open workspaces, add and remove workspace owners | Everything inside their workspace, including inviting their team with a restricted role |
| Cannot do | See what is inside a workspace without a membership | Create platform administrators or other owners |

A platform role grants nothing inside a workspace. Adding an owner is the one way a platform administrator can open a door into a workspace, so `add-owner` writes an audit line to its log.

### Workspace roles

| Permission | Owner | Editor | Operator | Viewer |
|---|---|---|---|---|
| Read the workspace, members and projects | ✓ | ✓ | ✓ | ✓ |
| Run deployments | ✓ | ✓ | ✓ | |
| Create, change and delete projects and folders | ✓ | ✓ | | |
| Invite members and connect accounts | ✓ | | | |

Owners can change or remove members with a restricted role, but not other owners. Project and deployment permissions already exist in the role table, and they will take effect when those routes move inside workspaces.

### How a request is authorized

1. API Gateway's Cognito authorizer validates the token.
2. `authz.RequireWorkspace` loads the user and their membership in the workspace named in the path.
3. A person outside the workspace gets a 404, so they cannot learn that it exists. A member without the permission gets a 403.
4. Queries read only that workspace's partition in DynamoDB.

### Inviting someone

Public signup is closed in Cognito. `POST /workspaces/{workspaceId}/members` creates an account if the person has none, and Cognito emails them a temporary password. New accounts get the `member` platform role, which has no platform permissions. This route can grant only the editor, operator and viewer roles.

## API routes for tenants

| Route | Permission |
|---|---|
| `POST /workspaces` | `workspaces:create` (platform) |
| `GET /workspaces` | Signed in; lists only your workspaces |
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

## Known limits

- **Project routes are not tenant-aware yet.** `/projects` is global and stores only a name and description. It must move inside workspaces before more than one company uses an installation.
- **The API sends no CORS headers,** which the web app will need once it is connected.
- **Two concurrent changes could remove the last owner.** The check reads the member list and then writes, without a transaction.

## Decisions

- **One Lambda per action.** Each has narrow IAM permissions, at the cost of more Terraform and Go modules.
- **DynamoDB, keyed by workspace.** It needs no VPC or connection pooling and costs nothing when idle. Partitioning by `workspace_id` keeps queries inside one tenant.
- **Diagrams will live in S3.** DynamoDB holds at most 400 KB per item, and diagrams need drafts and versions.
- **AWS only, for now.** Rivo runs on AWS and designs for AWS.
- **Terraform in the deployment engine.** Rivo is not sold as a hosted service today. Terraform's license (BUSL) restricts paid hosted offerings that compete with IBM's paid versions, so this must be reviewed before charging for hosting.
