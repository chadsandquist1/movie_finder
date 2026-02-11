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
npm run dev             # Start local dev server (port 8080)
npm run build           # Production build
npx playwright test     # Run Playwright tests (requires npm install first)
```

**Important:** Always run `npx playwright test` from `frontend/` after making frontend changes. All 32 tests must pass before considering work complete.

## Architecture

This is an AWS serverless project managed with Terraform. The system provides Cognito-authenticated users the ability to invoke Lambda functions backed by DynamoDB, with a static site hosted on S3.

**Key flow:** Cognito User Pool authenticates users → Cognito Identity Pool federates credentials → Authenticated IAM role grants `lambda:InvokeFunction` permission → Lambda reads/writes DynamoDB (movies table for catalog, queue table for per-user lists). Username from login is passed in every Lambda payload.

### Infrastructure (`terraform/`)

- **cognito.tf** - User Pool (password auth), Identity Pool (federated credentials), and role attachment for authenticated users
- **lambda.tf** - Four Python 3.12 Lambda functions (`movieq_list`, `movieq_write`, `movieq_refresh`, `movieq_catalog`), auto-zipped from `lambdas/` source via `archive_file` data source; builds to `.build/` directory. `movieq_list`, `movieq_write`, and `movieq_catalog` receive `TABLE_NAME` and `QUEUE_TABLE_NAME` environment variables; `movieq_refresh` receives only `OMDB_API_KEY` (no DynamoDB access).
- **iam.tf** - Lambda execution role (basic execution + DynamoDB access to both movies and queue tables) and Cognito authenticated role (scoped to invoke all four Lambdas)
- **dynamodb.tf** - Movies table (shared catalog, PK=`movie_id`) and Queue table (per-user queues, PK=`username`, SK=`sk` where sk=`status#rank`). Status and rank live in the queue table, not the movies table.
- **s3.tf** - Public S3 bucket configured for static website hosting
- **config.tf** - Generates `config.json` for the frontend with Cognito IDs and Lambda function names (`movieqListFunctionName`, `movieqWriteFunctionName`, `movieqRefreshFunctionName`, `movieqCatalogFunctionName`)
- **locals.tf** - Naming convention: `{project_name}-{environment}-*` with common tags
- **outputs.tf** - Exports Cognito IDs, S3 endpoint, Lambda function names/ARNs, DynamoDB table names (movies + queue), region

### Lambda Functions (`lambdas/`)

- **movieq_list** (`lambdas/movieq_list/handler.py`) - Accepts `{username}`, queries the queue table for that user's entries, batch-gets movie details from the movies table, merges status/rank from queue with movie data, and returns `{"movies": [...]}`. Each movie has: `movie_id`, `rank`, `title`, `year`, `genre`, `rating`, `director`, `status`, `importedDate`, `importedFrom`.
- **movieq_write** (`lambdas/movieq_write/handler.py`) - All payloads require `username`. Creates or updates movies across both tables. If `movie_id` is provided, updates movie fields in the movies table and manages queue entries (delete old via `old_sk`, put new with `status#rank`). If omitted, creates a new movie in the movies table and a queue entry. Only `title`, `year`, `status`, and `rank` are required; `genre`, `rating`, and `director` are optional. **Batch mode:** if the payload contains a `movies` array, batch-writes to both tables. Returns `{"message": "Created N movies", "movie_ids": [...]}`.
- **movieq_refresh** (`lambdas/movieq_refresh/handler.py`) - Fetch-only OMDb proxy. Accepts `{"imdb_ids": ["tt3896198", ...]}`, fetches each from the OMDb API, and returns `{"movies": [{imdb_id, title, year, genre, rating, director}, ...], "errors": [...]}`. No DynamoDB reads or writes — the frontend handles duplicate detection and batch import via `movieq_write`.
- **movieq_catalog** (`lambdas/movieq_catalog/handler.py`) - Scans the full movies table catalog and queries the user's queue to build a queued status map. Accepts `{username}`, returns `{"movies": [...], "queued": {"movie_id": "status", ...}}`. Used by the "All Movies" catalog view.

### Frontend (`frontend/`)

- React + Vite + Tailwind CSS
- `awsClients.js` - Cognito auth flow (returns `username` from login), and `invokeLambda(config, credentials, functionName, payload?)` helper
- `App.jsx` - Login flow, calls `movieq_list` on login to fetch movies
- `MovieList.jsx` - Main orchestrator: state management, all handlers (add, edit, status change, drag-and-drop, move, search), composes child components. Uses `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop reordering
- `MovieListHeader.jsx` - Header bar: list dropdown selector, search input, Import button, Add Movie/Cancel toggle, Logout button. Hides Import/Add Movie buttons when catalog view is active
- `CatalogRow.jsx` - Catalog row component for "All Movies" view: shows movie details, colored badge if already queued, and "Add to..." dropdown to add movies to user's queue
- `ImportModal.jsx` - OMDb import modal with three-step flow (input IMDb IDs → preview with duplicate detection → batch import). Uses `titleSimilarity` for client-side duplicate detection (>=90% + same year). Computes ranks via `generateKeyBetween` and batch-writes via `movieq_write`. Paginated preview (30/page) with select/deselect all
- `MovieForm.jsx` - Add/Edit movie form with validation (only `title` + `year` required; `genre`, `rating`, `director` optional). Includes client-side duplicate detection (>=90% title similarity + same year) before save
- `SearchResults.jsx` - Search results view, groups matched movies by list category
- `titleSimilarity.js` - Shared utility: LCS-based title similarity ratio (mirrors Python's `difflib.SequenceMatcher`). Used by `MovieForm` for duplicate detection
- `MovieRow.jsx` - Two exports: `MovieRowContent` (presentational, used by both sortable rows and DragOverlay) and `SortableMovieRow` (default, wraps `useSortable` hook). Drag handle (6-dot grip), kebab menu (Move to Top/Bottom, Edit), status dropdown
- `Diagnostic.jsx` - Debug page at `/diagnostic/` with Login, Invoke Lambda, Get Movies buttons and SDK log
- Movies use lexicographic `rank` strings (e.g. `"a0"`, `"a1"`) from the `fractional-indexing` pattern for O(1) reordering
- Drag-and-drop reorder computes new rank via `generateKeyBetween(before, after)` based on new neighbors
- All pages use the `cinema-background-heavy.jpg` background image

### Playwright Tests (`frontend/tests/`)

- Tests run against local Vite dev server (port 8080) with **all AWS calls mocked** (Cognito, Lambda)
- Mock setup in `tests/helpers.js` — intercepts `/config.json`, Cognito auth, and Lambda invoke routes
- Test files: `login.spec.js`, `movie-list.spec.js`, `search.spec.js`, `add-edit-movie.spec.js`, `kebab-menu.spec.js`, `reorder.spec.js`, `import-modal.spec.js`, `catalog.spec.js`
- Run: `cd frontend && npx playwright test`
- First-time setup: `npx playwright install chromium`

### DynamoDB Schema

**Movies table** (shared catalog): `{project_name}-{environment}-movies`
- **Partition key**: `movie_id` (S) — UUID, stable identity per movie
- **Attributes**: `title` (S), `year` (N), `genre` (S), `rating` (N), `director` (S), `importedDate` (S, ISO 8601 UTC), `importedFrom` (S, one of `"add"`, `"omdb"`, `"bulkload"`)
- No `status` or `rank` — those live in the queue table

**Queue table** (per-user queues): `{project_name}-{environment}-queue`
- **Partition key**: `username` (S) — Cognito username
- **Sort key**: `sk` (S) — format `status#rank` (e.g. `active#a01`, `recentlyWatched#a03`)
- **Attributes**: `movie_id` (S) — foreign key to movies table
- **Query pattern**: `username = :u AND begins_with(sk, :status)` gets all movies in a list, sorted by rank
- Status changes require delete + put (can't update a sort key in DynamoDB)

### Seed Script (`scripts/`)

- **seed_movies.py** — Populates both DynamoDB tables (movies catalog + queue) with 366 movies across all three status lists. Uses `batch_writer` for efficient writes. Reads table names from `terraform output` or uses defaults.
  ```bash
  python scripts/seed_movies.py                       # auto-detect table names, default user: chad
  python scripts/seed_movies.py --username chad       # explicit username
  python scripts/seed_movies.py --table my-table      # explicit movies table name
  python scripts/seed_movies.py --queue-table my-q    # explicit queue table name
  ```

### Resource Naming

All resources use the prefix `${var.project_name}-${var.environment}` (defaults: `movie-finder-dev`). Tags include Project, Environment, and ManagedBy=terraform.
