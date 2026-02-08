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

Frontend commands must be run from the `frontend/` directory.

```bash
cd frontend
npm install             # Install dependencies
npm run dev             # Start local dev server
npm run build           # Production build
```

## Architecture

This is an AWS serverless project managed with Terraform. The system provides Cognito-authenticated users the ability to invoke Lambda functions backed by DynamoDB, with a static site hosted on S3.

**Key flow:** Cognito User Pool authenticates users → Cognito Identity Pool federates credentials → Authenticated IAM role grants `lambda:InvokeFunction` permission → Lambda reads/writes DynamoDB.

### Infrastructure (`terraform/`)

- **cognito.tf** - User Pool (password auth), Identity Pool (federated credentials), and role attachment for authenticated users
- **lambda.tf** - Two Python 3.12 Lambda functions (`movieq_list`, `movieq_write`), auto-zipped from `lambdas/` source via `archive_file` data source; builds to `.build/` directory. Both receive `TABLE_NAME` environment variable.
- **iam.tf** - Lambda execution role (basic execution + DynamoDB access) and Cognito authenticated role (scoped to invoke both Lambdas)
- **dynamodb.tf** - Movies table with composite key: `status` (partition key) + `rank` (sort key). Seed data for 10 movies managed via `aws_dynamodb_table_item` resources.
- **s3.tf** - Public S3 bucket configured for static website hosting
- **config.tf** - Generates `config.json` for the frontend with Cognito IDs and Lambda function names (`movieqListFunctionName`, `movieqWriteFunctionName`)
- **locals.tf** - Naming convention: `{project_name}-{environment}-*` with common tags
- **outputs.tf** - Exports Cognito IDs, S3 endpoint, Lambda function names/ARNs, DynamoDB table name, region

### Lambda Functions (`lambdas/`)

- **movieq_list** (`lambdas/movieq_list/handler.py`) - Scans DynamoDB, returns `{"movies": [...]}`. Each movie has: `rank`, `title`, `year`, `genre`, `rating`, `director`, `status`.
- **movieq_write** (`lambdas/movieq_write/handler.py`) - Accepts a single movie JSON object with fields `{rank, title, year, genre, rating, director, status}`, writes (upsert) to DynamoDB via `put_item`.

### Frontend (`frontend/`)

- React + Vite + Tailwind CSS
- `awsClients.js` - Cognito auth flow and `invokeLambda(config, credentials, functionName, payload?)` helper
- `App.jsx` - Login flow, calls `movieq_list` on login to fetch movies
- `MovieList.jsx` - Renders movies sorted by `rank` (lexicographic string sort), computes display order (1, 2, 3...) from sorted position
- `MovieRow.jsx` - Renders a single movie row with `displayOrder` prop
- Movies use lexicographic `rank` strings (e.g. `"a0"`, `"a1"`) from the `fractional-indexing` pattern for O(1) reordering

### DynamoDB Schema

- **Table**: `{project_name}-{environment}-movies`
- **Partition key**: `status` (S) — values: `active`, `recentlyWatched`, `notInterested`
- **Sort key**: `rank` (S) — lexicographic string for ordering
- **Attributes**: `title` (S), `year` (N), `genre` (S), `rating` (N), `director` (S)

### Resource Naming

All resources use the prefix `${var.project_name}-${var.environment}` (defaults: `movie-finder-dev`). Tags include Project, Environment, and ManagedBy=terraform.
