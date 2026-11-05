# Rivo: common tasks. `make help` lists them.
.PHONY: help install lint test build check

GO_MODULES := $(shell find services -name go.mod -exec dirname {} \;)
TF_ROOTS   := infra/api infra/web

help: ## Show this help
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-8s %s\n", $$1, $$2}'

install: ## Install the web dependencies
	npm --prefix web ci --no-audit --no-fund

lint: ## Check formatting and static analysis in every part of the repo
	@unformatted="$$(gofmt -l services)"; \
	if [ -n "$$unformatted" ]; then echo "gofmt needed:"; echo "$$unformatted"; exit 1; fi
	@for dir in $(GO_MODULES); do \
		(cd $$dir && GOWORK=off go vet ./...) || exit 1; \
	done
	terraform fmt -check -recursive infra
	@for dir in $(TF_ROOTS); do \
		terraform -chdir=$$dir init -backend=false -input=false -lockfile=readonly >/dev/null && \
		terraform -chdir=$$dir validate || exit 1; \
	done
	npm --prefix web run lint

test: ## Run the tests
	@for dir in $(GO_MODULES); do \
		(cd $$dir && GOWORK=off go test ./...) || exit 1; \
	done

build: ## Build the web app
	npm --prefix web run build

check: lint test build ## Everything CI runs
