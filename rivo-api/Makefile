ENV ?= local

TFVARS := environments/$(ENV)/$(ENV).tfvars

GREEN  := $(shell tput setaf 2)
BLUE   := $(shell tput setaf 4)
YELLOW := $(shell tput setaf 3)
RED    := $(shell tput setaf 1)
RESET  := $(shell tput sgr0)

.PHONY: fmt fmt-go validate plan deploy init destroy apply

apply: deploy 

init:
	@echo "Start init"
	terraform init

plan: validate fmt fmt-go init
	@echo "Planning $(ENV)..."
	terraform plan  -var "environment=$(ENV)" -var-file="$(TFVARS)" -out="tf-$(ENV)-plan.out"

deploy: init
	@echo "Applying $(ENV)..."
	@plan=$$(find . -maxdepth 1 -type f -name "tf-$(ENV)-plan.out" -print -quit); \
	if [ -n "$$plan" ]; then \
		echo "Using plan: $$plan"; \
		terraform apply -var "environment=$(ENV)" -var-file="$(TFVARS)" -auto-approve "$$plan"; \
	else \
		echo "Plan file not found. Running deploy without plan file"; \
		terraform apply -var "environment=$(ENV)" -var-file="$(TFVARS)" -auto-approve; \
	fi

validate:
	@echo "$(GREEN)Validating Terraform...$(RESET)"
	terraform validate

destroy:
	@echo "$(RED)Destroying environment: $(ENV)$(RESET)"
	terraform destroy -var "environment=$(ENV)" -var-file="$(TFVARS)"

fmt:
	@echo "$(GREEN)Start formatting$(RESET)"
	@formatted=$$(terraform fmt -recursive); \
	if [ -n "$$formatted" ]; then \
		echo "$$formatted"; \
		count=$$(echo "$$formatted" | wc -l); \
	else \
		count=0; \
	fi; \
	echo "$(BLUE)Formatted files: $$count$(RESET)"

fmt-go:
	@echo "$(GREEN)Start formatting Go code$(RESET)"
	@files=$$(find src -name "*.go" -not -path "*/vendor/*"); \
	formatted=$$(gofmt -l -w $$files); \
	if [ -n "$$formatted" ]; then \
		echo "$$formatted"; \
		count=$$(echo "$$formatted" | wc -l); \
	else \
		count=0; \
	fi; \
	echo "$(BLUE)Formatted files: $$count$(RESET)"