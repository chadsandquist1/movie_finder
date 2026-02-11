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

output "movieq_list_function_name" {
  description = "movieq_list Lambda function name"
  value       = aws_lambda_function.movieq_list.function_name
}

output "movieq_list_function_arn" {
  description = "movieq_list Lambda function ARN"
  value       = aws_lambda_function.movieq_list.arn
}

output "movieq_write_function_name" {
  description = "movieq_write Lambda function name"
  value       = aws_lambda_function.movieq_write.function_name
}

output "movieq_write_function_arn" {
  description = "movieq_write Lambda function ARN"
  value       = aws_lambda_function.movieq_write.arn
}

output "movieq_refresh_function_name" {
  description = "movieq_refresh Lambda function name"
  value       = aws_lambda_function.movieq_refresh.function_name
}

output "movieq_refresh_function_arn" {
  description = "movieq_refresh Lambda function ARN"
  value       = aws_lambda_function.movieq_refresh.arn
}

output "dynamodb_table_name" {
  description = "DynamoDB movies table name"
  value       = aws_dynamodb_table.movies.name
}

output "queue_table_name" {
  description = "DynamoDB queue table name"
  value       = aws_dynamodb_table.queue.name
}

output "movieq_catalog_function_name" {
  description = "movieq_catalog Lambda function name"
  value       = aws_lambda_function.movieq_catalog.function_name
}

output "movieq_catalog_function_arn" {
  description = "movieq_catalog Lambda function ARN"
  value       = aws_lambda_function.movieq_catalog.arn
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}
