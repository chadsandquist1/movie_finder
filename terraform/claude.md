# Terraform Project Notes

- Never check in `.tfstate` files or sensitive values (e.g., `.tfvars` with secrets).
- Run `terraform init` after cloning or modifying providers.
- Run `terraform validate` before `terraform plan` to catch syntax errors early.
