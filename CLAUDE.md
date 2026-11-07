# CLAUDE.md

Guidance for Claude Code when working in this repository.

The maintainer writes in Spanish: **reply to them in Spanish**, with complete code examples when explaining technical things. Everything in the repository (code, comments, docs, UI text, commit messages) is **English**.

## What this is

Rivo is a visual builder for AWS infrastructure: people draw diagrams on a canvas, and it will generate Terraform and deploy it to AWS accounts they connect. It is multi-tenant, and it can be self-hosted in a company's own AWS account. See `README.md` for users and `docs/architecture.md` for how it works.

The product name is **Rivo** on screen and `rivo` in identifiers.

## Commands

```bash
make install             # web dependencies
make check               # everything CI runs. Run it before finishing.
npm --prefix web run dev # web app, against RIVO_API_URL in web/.env.local
npm --prefix web run storybook
```

To include the storage tests, start DynamoDB Local and S3Mock, and set `RIVO_DYNAMODB_ENDPOINT` and `RIVO_S3_ENDPOINT` (see `CONTRIBUTING.md`).

## Rules that are easy to break

- **Commits are the release notes** (Conventional Commits): `fix:` gives a patch release, `feat:` a minor one, `docs:`/`ci:`/`test:`/`refactor:`/`chore:` none. CI releases with semantic-release (`.releaserc.json`): never tag by hand, except the first `v0.1.0`. One change per commit.
- **Secrets only in `.env` files**, never in code or Terraform variable files.
- **Stay within this architecture.** AWS only, with Lambdas for the API, DynamoDB for metadata, S3 for diagrams and Fargate for the deployment engine. The maintainer ruled out a cloud-neutral core, Postgres and a single server because of the added complexity. Do not propose them again unless asked.
- **Tenant isolation comes first.** Workspace routes use `authz.RequireWorkspace`, and every query is limited to the workspace in the path. Test it with a member of another workspace.
- **Two kinds of administrator.** Platform administrators (`users` table, role `admin`) run the installation, can read every workspace (each read is logged) but change only those they belong to, and are the only ones who can create other administrators and workspace owners. Workspace owners (`memberships` table, role `owner`) manage their workspace and can invite only editors, operators and viewers.
- **Look the project up in its workspace before touching S3.** S3 keys are built from IDs in the path, and `GetByID` is what proves they belong together.
- **A missing S3 object needs `s3:ListBucket`.** Without it S3 answers "access denied" instead of "not found". Check the error code too: the SDK does not model `NoSuchKey` on `CopyObject`.
- **Never run Terraform from a user or a repository.** The engine may only run what Rivo generates from its catalog: a `local-exec` in user HCL would run code with the engine's role.
- **No credentials to the deployment task.** It gets a deployment ID and assumes the target role, with an external ID per connection.
- **Every Lambda module passes `cors_allow_origin = var.web_origin`.** Without it the browser hides that Lambda's answers from the web app, including errors. Responses go through `apigateway.Success`, `apigateway.Error` or `apigateway.NoContent`, which add the header: never build an `events.APIGatewayProxyResponse` by hand.
- **`go build ./...` drops a binary in a Lambda folder.** Use `go vet ./...` to check, as `make lint` does.
- **Monaco is bundled, not loaded from a CDN** (`web/src/components/CodeEditor/monacoSetup.ts`). `@monaco-editor/react` defaults to a fixed CDN version that `npm audit` cannot see: it served a vulnerable 0.55.1 while `package.json` looked clean.
- **Check security `overrides` in `web/package.json` when updating.** Remove one when the packages that depend on it ship a safe version.
- **Use theme tokens** (`bg-page`, `text-ink`, `border-edge`), never raw colors like `text-white` or `bg-zinc-900`. Those hid the login button in light mode. White text is only for saturated fills.

## Layout

- `web/`: React 19, Vite, TypeScript and Tailwind v4, configured in `src/index.css`.
  - `src/services/`: one module per API area. `api.ts` adds the ID token, renews it with the refresh token once on a 401, and turns `{error: {code, message}}` into `ApiError`.
  - `src/features/workspace/`: `WorkspaceProvider` loads the workspace in the URL and its folders; `useWorkspace().can(...)` hides what the role cannot do. `services/workspaces.ts` mirrors the role table in `services/shared/models/workspace`: change both together.
  - `features/canvas/views/` and `features/projects/Global*View.tsx` are the simulated deploy history, kept unrouted as a starting point for the deployment dashboard.
  - `src/features/canvas/`: hand-written canvas with no graph library. `useCanvas.ts` holds live state; `types/infra.ts` is the saved format.
  - `aws-services.tsx` and `service-config-schemas.ts`: the static service catalog. `edgeKinds.ts` decides which connections have configuration.
- `services/`: Go Lambdas, one module per action, plus `shared/`. See `docs/services.md`.
- `infra/api/`: Terraform for the API. `infra/web/`: Terraform for S3 and CloudFront. They have separate state.
- `docs/`: architecture, configuration, deployment and working on Lambdas.

## Pending

In order:

1. Add project-level access, so a workspace can limit who sees each project. Add presigned uploads for Lambda packages, and save a Lambda's code and `.zip` with the project (the editor and upload keep nothing today).
2. Show and create versions in the app, add password reset (Cognito ForgotPassword), and a platform administration screen for accounts.
3. Generate Terraform from the diagram and let people download it.
4. Connect AWS accounts (role ARN plus external ID), run plan, approval and apply on Fargate, and show pipelines in a dashboard. Record task duration per workspace, because hosting may later bill by infrastructure and usage time.
5. Push the diagram and Terraform to a GitHub repository through a GitHub App.

The engine uses Terraform, and hosting is not charged for yet. Before charging, review Terraform's BUSL, which forbids paid hosted offerings that compete with IBM's paid versions.
