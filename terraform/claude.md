# Terraform Project Notes

- Never check in `.tfstate` files or sensitive values (e.g., `.tfvars` with secrets).
- Run `terraform init` after cloning or modifying providers.
- Run `terraform validate` before `terraform plan` to catch syntax errors early.
- Two DynamoDB tables: movies (shared catalog, PK=`movie_id`) and queue (per-user, PK=`username`, SK=`sk` as `status#rank`). Status and rank live in the queue table. Seed data is managed via `scripts/seed_movies.py`.
- Three lambdas (`movieq_list`, `movieq_write`, `movieq_catalog`) receive `TABLE_NAME` and `QUEUE_TABLE_NAME` env vars pointing to the DynamoDB tables.
