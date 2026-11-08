.PHONY: dev-init dev-plan dev-apply dev-destroy \
        prod-init prod-plan prod-apply prod-destroy \
        build upload invalidate deploy output fmt validate show-plan

PLANS_DIR = .plans
DIST      = ../../web/dist

ENV_DEV  = -var-file=environments/dev.tfvars
ENV_PROD = -var-file=environments/prod.tfvars

$(PLANS_DIR):
	mkdir -p $(PLANS_DIR)

# ── Dev ───────────────────────────────────────────────────────────────────────

dev-init:
	terraform init

dev-plan: $(PLANS_DIR)
	terraform plan $(ENV_DEV) -out=$(PLANS_DIR)/dev.tfplan

dev-apply: $(PLANS_DIR)/dev.tfplan
	terraform apply -auto-approve $(PLANS_DIR)/dev.tfplan

dev-destroy:
	terraform destroy -auto-approve $(ENV_DEV)

# ── Prod ──────────────────────────────────────────────────────────────────────

prod-init:
	terraform init

prod-plan: $(PLANS_DIR)
	terraform plan $(ENV_PROD) -out=$(PLANS_DIR)/prod.tfplan

prod-apply: $(PLANS_DIR)/prod.tfplan
	terraform apply -auto-approve $(PLANS_DIR)/prod.tfplan

# prod-destroy is not automated: run `terraform destroy -var-file=environments/prod.tfvars` by hand.

# ── S3 + CloudFront ───────────────────────────────────────────────────────────

## Build the web app for the hosted API. Without VITE_API_URL the app calls
## /api, which only exists under `npm run dev`: hosted, CloudFront answers it
## with index.html and every page fails with "Unexpected token '<'".
## It defaults to the api_base_url output of infra/api.
VITE_API_URL ?= $(shell terraform -chdir=../api output -raw api_base_url 2>/dev/null)

build:
	@test -n "$(VITE_API_URL)" || { echo "Set VITE_API_URL to the API's base URL (terraform -chdir=../api output api_base_url)."; exit 1; }
	@echo "Building the web app for $(VITE_API_URL)"
	VITE_API_URL=$(VITE_API_URL) npm --prefix ../../web run build

## Upload the Vite build output (dist/) to S3
upload:
	@BUCKET=$$(terraform output -raw bucket_name) && \
	echo "Uploading $(DIST)/ → s3://$$BUCKET" && \
	aws s3 sync $(DIST)/ s3://$$BUCKET --delete \
	  --cache-control "public, max-age=31536000, immutable" \
	  --exclude "index.html" && \
	aws s3 cp $(DIST)/index.html s3://$$BUCKET/index.html \
	  --cache-control "no-cache, no-store, must-revalidate" && \
	echo "Upload complete."

## Invalidate CloudFront cache so the new build is served immediately
invalidate:
	@DIST_ID=$$(terraform output -raw cloudfront_distribution_id) && \
	echo "Invalidating CloudFront distribution $$DIST_ID..." && \
	aws cloudfront create-invalidation \
	  --distribution-id $$DIST_ID \
	  --paths "/*" && \
	echo "Invalidation created."

## Full deploy: build → upload → invalidate
deploy: build upload invalidate
	@echo "Deploy complete."

# ── Utils ─────────────────────────────────────────────────────────────────────

output:
	terraform output

fmt:
	terraform fmt -recursive

validate:
	terraform validate

show-plan:
	@read -p "Env (dev/prod): " env; \
	terraform show $(PLANS_DIR)/$$env.tfplan
