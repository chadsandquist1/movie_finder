# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All Terraform commands must be run from the `terraform/` directory.

```bash
cd terraform
terraform init          # Initialize providers (required after clone or provider changes)
terraform validate      # Check syntax before planning
terraform plan          # Preview changes
terraform apply         # Apply infrastructure changes
```

## Architecture

This is an AWS serverless project managed with Terraform. The system provides Cognito-authenticated users the ability to invoke Lambda functions, with a static site hosted on S3.

**Key flow:** Cognito User Pool authenticates users → Cognito Identity Pool federates credentials → Authenticated IAM role grants `lambda:InvokeFunction` permission → Lambda executes.

### Infrastructure (`terraform/`)

- **cognito.tf** - User Pool (password auth), Identity Pool (federated credentials), and role attachment for authenticated users
- **lambda.tf** - Python 3.12 Lambda function, auto-zipped from `lambdas/` source via `archive_file` data source; builds to `.build/` directory
- **iam.tf** - Lambda execution role (basic execution policy) and Cognito authenticated role (scoped to invoke specific Lambda)
- **s3.tf** - Public S3 bucket configured for static website hosting
- **locals.tf** - Naming convention: `{project_name}-{environment}-*` with common tags

### Lambda Functions (`lambdas/`)

- Python handlers located at `lambdas/{function_name}/handler.py`
- Terraform auto-packages each handler into a zip for deployment

### Resource Naming

All resources use the prefix `${var.project_name}-${var.environment}` (defaults: `movie-finder-dev`). Tags include Project, Environment, and ManagedBy=terraform.
