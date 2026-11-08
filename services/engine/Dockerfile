# The deployment engine: the runner, Terraform and the providers it may use.
# Build from services/ so the runner can use shared/:
#   docker buildx build --platform linux/arm64 -f engine/Dockerfile .
# Every stage but the last runs on the build machine, so building for arm64
# on x86 needs no emulation.

ARG TERRAFORM_VERSION=1.14.4

FROM --platform=$BUILDPLATFORM golang:1.27-bookworm AS runner
ARG TARGETOS TARGETARCH
WORKDIR /src
COPY shared/ shared/
COPY engine/runner/ engine/runner/
WORKDIR /src/engine/runner
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH GOWORK=off go build -trimpath -ldflags="-s -w" -o /out/runner .

FROM --platform=$BUILDPLATFORM debian:bookworm-slim AS terraform
ARG TERRAFORM_VERSION TARGETOS TARGETARCH BUILDOS BUILDARCH
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip && rm -rf /var/lib/apt/lists/*
WORKDIR /tf
# Checked against HashiCorp's published SHA-256 sums.
RUN set -eu; \
    base="https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}"; \
    curl -fsSLO "$base/terraform_${TERRAFORM_VERSION}_SHA256SUMS"; \
    for p in "${BUILDOS}_${BUILDARCH}" "${TARGETOS}_${TARGETARCH}"; do \
      f="terraform_${TERRAFORM_VERSION}_${p}.zip"; \
      [ -f "$f" ] || curl -fsSLO "$base/$f"; \
      grep " $f\$" "terraform_${TERRAFORM_VERSION}_SHA256SUMS" | sha256sum -c -; \
    done; \
    mkdir build target; \
    unzip -q "terraform_${TERRAFORM_VERSION}_${BUILDOS}_${BUILDARCH}.zip" -d build; \
    unzip -q "terraform_${TERRAFORM_VERSION}_${TARGETOS}_${TARGETARCH}.zip" -d target
COPY engine/providers.tf /mirror/providers.tf
# terraform providers mirror checks each provider against the registry's signed sums.
RUN /tf/build/terraform -chdir=/mirror providers mirror -platform="${TARGETOS}_${TARGETARCH}" /out/plugins

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=terraform /tf/target/terraform /usr/local/bin/terraform
COPY --from=terraform /out/plugins /opt/terraform/plugins
COPY --from=runner /out/runner /usr/local/bin/runner
ENV TERRAFORM_BIN=/usr/local/bin/terraform \
    TERRAFORM_PLUGIN_DIR=/opt/terraform/plugins \
    WORK_DIR=/tmp/rivo
USER nonroot
ENTRYPOINT ["/usr/local/bin/runner"]
