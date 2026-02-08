resource "aws_s3_object" "frontend_config" {
  bucket       = aws_s3_bucket.static_site.id
  key          = "config.json"
  content_type = "application/json"

  content = jsonencode({
    region             = var.aws_region
    userPoolId         = aws_cognito_user_pool.main.id
    clientId           = aws_cognito_user_pool_client.main.id
    identityPoolId     = aws_cognito_identity_pool.main.id
    lambdaFunctionName = aws_lambda_function.hello_world.function_name
  })

  tags = local.common_tags
}
