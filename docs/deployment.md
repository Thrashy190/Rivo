# Deployment

Rivo deploys into your own AWS account with Terraform, in two parts: the API, then the web app that calls it.

These steps have not yet been run from a clean AWS account in this repository layout, so expect rough edges and please report them. Deploying creates resources that AWS can bill you for.

Terraform state is stored locally by default, in `infra/api/terraform-state/` and `infra/web/`. Keep it safe, and move it to a remote backend if more than one person deploys.

## Deploy the API

You need AWS credentials in your shell, Go and Terraform.

1. Edit `infra/api/environments/dev/dev.tfvars` and set `admin_email` to a real address. See [configuration.md](configuration.md).
2. Plan and apply:

   ```bash
   cd infra/api
   make plan ENV=dev
   make deploy ENV=dev
   ```

3. Cognito emails the administrator a temporary password. The base URL is in `terraform output api_base_url`.

## Sign in for the first time

In the web app, sign in with `admin_email` and the temporary password, and choose your own. To try the API before the app is hosted, run it locally against this API: see the [Quick start](../README.md#quick-start).

Without the app, the first login returns a `NEW_PASSWORD_REQUIRED` challenge, which is answered with the session it returned:

```bash
API=$(terraform output -raw api_base_url)

curl -X POST "$API/auth/login" \
  -d '{"email":"you@example.com","password":"TEMPORARY_PASSWORD"}'

curl -X POST "$API/auth/new-password" \
  -d '{"email":"you@example.com","session":"SESSION_FROM_LOGIN","newPassword":"NEW_PASSWORD"}'
```

The response includes `idToken`, which protected routes expect in the `Authorization` header, and a `refreshToken`. `POST /auth/refresh` with `{"refreshToken": "..."}` returns a new `idToken` when the old one expires after an hour.

## Give someone access

Only people you invite get an account. The administrator from `admin_email` is a platform administrator, who runs this installation. To add someone else from your team:

```bash
TOKEN=YOUR_ID_TOKEN

curl -X POST "$API/users" -H "Authorization: $TOKEN" \
  -d '{"email":"teammate@example.com","role":"admin"}'
```

A customer's administrator is a workspace owner. Give them an account that can open workspaces:

```bash
curl -X POST "$API/users" -H "Authorization: $TOKEN" \
  -d '{"email":"customer@example.com","role":"member","permissions":["workspaces:create"]}'
```

That person signs in to the app, creates a workspace, becomes its owner and invites their team from **Members** with the editor, operator or viewer role. With the API it looks like this:

```bash
curl -X POST "$API/workspaces" -H "Authorization: $CUSTOMER_TOKEN" -d '{"name":"Acme"}'

curl -X POST "$API/workspaces/WORKSPACE_ID/members" -H "Authorization: $CUSTOMER_TOKEN" \
  -d '{"email":"teammate@acme.example","role":"editor"}'
```

Only a platform administrator can add or remove a workspace owner, for example when the person responsible at a customer changes. In the app, open the workspace's **Members** and invite them with the **Owner** role. A workspace always keeps at least one owner, so add the new one first. With the API:

```bash
curl -X POST "$API/workspaces/WORKSPACE_ID/owners" -H "Authorization: $TOKEN" \
  -d '{"email":"new-owner@acme.example"}'

curl -X DELETE "$API/workspaces/WORKSPACE_ID/owners/OLD_OWNER_USER_ID" -H "Authorization: $TOKEN"
```

Platform administrators can read every workspace but can only change those they belong to. Tell the people who use your installation about this access.

## Deploy the web app

1. Create the hosting and note its address:

   ```bash
   cd infra/web
   make dev-init
   make dev-plan
   make dev-apply
   terraform output cloudfront_domain
   ```

2. Allow that address to call the API. In `infra/api/environments/dev/dev.tfvars`, set `web_origin` with `https://` and no trailing slash, then apply again:

   ```hcl
   web_origin = "https://d1234abcd.cloudfront.net"
   ```

   ```bash
   cd ../api
   make plan ENV=dev
   make deploy ENV=dev
   ```

3. Build the app with the API's address and upload it:

   ```bash
   cd ../..
   VITE_API_URL=$(terraform -chdir=infra/api output -raw api_base_url) npm --prefix web run build
   make -C infra/web deploy
   ```

Open the CloudFront address and sign in. For production, use the `prod-*` targets and `environments/prod.tfvars`, and a `web_origin` for that address.

The app keeps the session tokens in the browser's local storage, so treat any script you add to the page as able to read them.

## Remove everything

`make destroy ENV=dev` in `infra/api` deletes the API and its tables, including all their data. Terraform will not delete a bucket that has objects in it, so empty the diagrams bucket first, including old versions. In `infra/web`, use `make dev-destroy`.
