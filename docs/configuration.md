# Configuration

Rivo is configured when you deploy it, through Terraform variable files.

## API

Set these in `infra/api/environments/<env>/<env>.tfvars`.

| Variable | Needed? | What it is |
|---|---|---|
| `project_name` | Yes | Used to tag the AWS resources. |
| `admin_email` | Yes | Email of the first administrator. |
| `environment` | Set by the Makefile from `ENV` | Prefix for the DynamoDB table names, and the API stage. |

### admin_email

Signup is closed, so this account is the only way into a new installation. Cognito sends the temporary password to this address, so it must be a real inbox you can read. Terraform rejects the placeholder value.

## Web hosting

Set these in `infra/web/environments/<env>.tfvars`.

| Variable | Needed? | What it is |
|---|---|---|
| `environment` | Yes | `dev` or `prod`. Used to name the resources. |
| `price_class` | No | CloudFront price class. |
| `domain_aliases` | No | Custom domains for the distribution. |
| `acm_certificate_arn` | With `domain_aliases` | Certificate for those domains. It must be in `us-east-1`. |

## Web app

Set this in `web/.env`, based on `web/.env.example`.

| Variable | Needed? | What it is |
|---|---|---|
| `VITE_API_URL` | Not yet | Base URL of the API. It has no effect until the web app is connected to the API. |
