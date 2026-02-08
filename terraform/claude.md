# Terraform Project Notes

- Never check in `.tfstate` files or sensitive values (e.g., `.tfvars` with secrets).
- Run `terraform init` after cloning or modifying providers.
- Run `terraform validate` before `terraform plan` to catch syntax errors early.
- DynamoDB table uses composite key: `status` (partition) + `rank` (sort). Seed data is managed via `aws_dynamodb_table_item` resources in `dynamodb.tf`.
- Both lambdas (`movieq_list`, `movieq_write`) receive `TABLE_NAME` env var pointing to the DynamoDB table.
