output "user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.main.id
}

output "identity_pool_id" {
  description = "Cognito Identity Pool ID"
  value       = aws_cognito_identity_pool.main.id
}

output "s3_bucket_name" {
  description = "S3 static site bucket name"
  value       = aws_s3_bucket.static_site.id
}

output "s3_website_endpoint" {
  description = "S3 static site website endpoint"
  value       = aws_s3_bucket_website_configuration.static_site.website_endpoint
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.hello_world.function_name
}

output "lambda_function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.hello_world.arn
}

output "dynamodb_table_name" {
  description = "DynamoDB movies table name"
  value       = aws_dynamodb_table.movies.name
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}
