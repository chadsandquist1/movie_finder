# Terraform Project Notes

- Never check in `.tfstate` files or sensitive values (e.g., `.tfvars` with secrets).
- Run `terraform init` after cloning or modifying providers.
- Run `terraform validate` before `terraform plan` to catch syntax errors early.
- DynamoDB table uses `movie_id` (UUID) as sole partition key. Status and rank are regular attributes. Seed data is managed via `scripts/seed_movies.py`.
- Both lambdas (`movieq_list`, `movieq_write`) receive `TABLE_NAME` env var pointing to the DynamoDB table.
