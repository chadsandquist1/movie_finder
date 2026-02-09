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
- **dynamodb.tf** - Movies table with `movie_id` (UUID) as sole primary key. Status and rank are regular mutable attributes.
- **s3.tf** - Public S3 bucket configured for static website hosting
- **config.tf** - Generates `config.json` for the frontend with Cognito IDs and Lambda function names (`movieqListFunctionName`, `movieqWriteFunctionName`)
- **locals.tf** - Naming convention: `{project_name}-{environment}-*` with common tags
- **outputs.tf** - Exports Cognito IDs, S3 endpoint, Lambda function names/ARNs, DynamoDB table name, region

### Lambda Functions (`lambdas/`)

- **movieq_list** (`lambdas/movieq_list/handler.py`) - Scans DynamoDB, returns `{"movies": [...]}`. Each movie has: `movie_id`, `rank`, `title`, `year`, `genre`, `rating`, `director`, `status`.
- **movieq_write** (`lambdas/movieq_write/handler.py`) - Creates or updates movies. If `movie_id` is provided, does an `update_item` on the specified fields. If omitted, creates a new movie with a generated UUID via `put_item`.

### Frontend (`frontend/`)

- React + Vite + Tailwind CSS
- `awsClients.js` - Cognito auth flow and `invokeLambda(config, credentials, functionName, payload?)` helper
- `App.jsx` - Login flow, calls `movieq_list` on login to fetch movies
- `MovieList.jsx` - Renders movies sorted by `rank` (lexicographic string sort), computes display order (1, 2, 3...) from sorted position. "Add Movie" form with status dropdown writes to `movieq_write` lambda.
- `MovieRow.jsx` - Renders a single movie row with `displayOrder` prop and inline status dropdown
- Movies use lexicographic `rank` strings (e.g. `"a0"`, `"a1"`) from the `fractional-indexing` pattern for O(1) reordering

### DynamoDB Schema

- **Table**: `{project_name}-{environment}-movies`
- **Partition key**: `movie_id` (S) — UUID, stable identity per movie
- **Attributes**: `status` (S), `rank` (S), `title` (S), `year` (N), `genre` (S), `rating` (N), `director` (S)
- Status and rank are regular attributes (not keys), so updates are simple `UpdateItem` calls

### Seed Script (`scripts/`)

- **seed_movies.py** — Populates DynamoDB with 366 movies across all three status lists. Uses `batch_writer` for efficient writes. Reads table name from `terraform output` or defaults to `movie-finder-dev-movies`.
  ```bash
  python scripts/seed_movies.py                       # auto-detect table name
  python scripts/seed_movies.py --table my-table      # explicit table name
  ```

### Resource Naming

All resources use the prefix `${var.project_name}-${var.environment}` (defaults: `movie-finder-dev`). Tags include Project, Environment, and ManagedBy=terraform.
