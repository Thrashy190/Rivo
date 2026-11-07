# Contributing

Thanks for helping. A few things make it quick.

## Set up

```bash
git clone https://github.com/Thrashy190/Rivo.git
cd Rivo
make install
make check      # everything CI runs
```

You need Node.js 22+, Go 1.27+, Python 3 and Terraform (tested with 1.14). `make check` needs no AWS account, but running the web app does: it talks to an API you deploy, as in the [Quick start](README.md#quick-start). For components alone, use Storybook (`npm --prefix web run storybook`).

The storage tests also run against local copies of DynamoDB and S3 when you ask for them. Without them, they skip themselves:

```bash
docker run -d --rm --name rivo-dynamodb -p 8000:8000 amazon/dynamodb-local
docker run -d --rm --name rivo-s3 -p 9090:9090 adobe/s3mock
RIVO_DYNAMODB_ENDPOINT=http://localhost:8000 RIVO_S3_ENDPOINT=http://localhost:9090 make test
docker stop rivo-dynamodb rivo-s3
```

## Guidelines

- **Code, comments, commit messages and docs are in English.**
- **Tests must pass offline.** Never call a real AWS service from a test.
- **Do not commit secrets or personal data.** `.env` files and Terraform state are git-ignored.
- **A bug fix comes with a test** that names the real case it came from.
- **Update the docs in the same change** as the behaviour they describe.
- Keep changes small and say *why* in the description, not only what.
- **Tenant isolation is the first rule.** Every route inside a workspace goes through `authz.RequireWorkspace` and reads the workspace ID from the path, and every query is limited to that workspace. A change here needs a test proving that another workspace's member gets a 404. Platform administrators are the one exception, with read-only access.

## Commit messages and releases

Releases are automatic. When a push to `main` passes CI, [semantic-release](https://semantic-release.gitbook.io) reads the commit messages since the last tag, decides the version, tags it and publishes a GitHub release with the notes. So the first word of a commit message matters:

| Commit message | Means | `v1.2.3` becomes |
|---|---|---|
| `fix: keep folders when a member leaves` | a bug fixed | `v1.2.4` |
| `feat: invite members to a workspace` | something new | `v1.3.0` |
| a footer `BREAKING CHANGE: ...`, or `feat!:` | people must change something when updating | `v2.0.0` |
| `docs:`, `test:`, `refactor:`, `ci:`, `chore:` | nothing changes for people | no release |

Write what changes for the person using Rivo: the message becomes the release notes. One change per commit.

## Where things are

See [docs/architecture.md](docs/architecture.md) for the code map and [docs/services.md](docs/services.md) to add a Lambda.

## Reporting a security problem

Please do not open a public issue. See [SECURITY.md](SECURITY.md).
