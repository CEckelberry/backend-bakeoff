# GitHub Actions CI Pipeline

This directory contains the automated validation workflows for Backend Bake-off Phase 0.

## Workflows

### ci.yml - Phase 0 Foundation

Runs on every push to `main` or `phase-0-foundation` branch, and on all pull requests.

#### Jobs

1. **lint-openapi**
   - Validates `api/openapi.yaml` against OpenAPI 3.1 spec
   - Uses `@redocly/cli` for linting
   - Fails if spec is invalid or has breaking changes

2. **validate-schema**
   - Checks that all required files exist
   - Validates only `/checkout` and `/health` endpoints are present
   - Checks for TODO/FIXME comments in source code

3. **test-docker-compose**
   - Validates `docker-compose.yml` structure
   - Ensures exactly 9 services are defined
   - Checks for any TODO/FIXME comments

## Local Testing

You can run these checks locally before pushing:

```bash
# Lint OpenAPI
npx @redocly/cli lint api/openapi.yaml

# Check for TODOs
grep -r "TODO\|FIXME" packages/ api/

# Validate docker-compose
docker compose config --services | wc -l
```

## CI Status

CI must pass before:
- Pushing to `main`
- Merging a pull request to `main`
- Deploying Phase 0 changes

## Future Workflows

As phases progress, additional workflows will be added:
- Phase 1: Backend contract tests
- Phase 2: Infrastructure validation
- Phase 3+: Runtime-specific build and deploy workflows
