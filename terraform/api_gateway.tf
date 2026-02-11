# --- API Gateway (HTTP API) ---

resource "aws_apigatewayv2_api" "main" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 3600
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = var.environment
  auto_deploy = true

  tags = local.common_tags
}

# --- JWT Authorizer (Cognito User Pool) ---

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.main.id]
    issuer   = "https://${aws_cognito_user_pool.main.endpoint}"
  }
}

# --- Lambda Integrations ---

resource "aws_apigatewayv2_integration" "movieq_list" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.movieq_list.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "movieq_write" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.movieq_write.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "movieq_catalog" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.movieq_catalog.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "movieq_refresh" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.movieq_refresh.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# --- Routes ---

resource "aws_apigatewayv2_route" "get_queue" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users/{username}/queue"
  target             = "integrations/${aws_apigatewayv2_integration.movieq_list.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "post_queue" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /users/{username}/queue"
  target             = "integrations/${aws_apigatewayv2_integration.movieq_write.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "put_queue_movie" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /users/{username}/queue/{movie_id}"
  target             = "integrations/${aws_apigatewayv2_integration.movieq_write.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "delete_queue_movie" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /users/{username}/queue/{movie_id}"
  target             = "integrations/${aws_apigatewayv2_integration.movieq_write.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "post_queue_batch" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /users/{username}/queue/batch"
  target             = "integrations/${aws_apigatewayv2_integration.movieq_write.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "get_catalog" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /movies"
  target             = "integrations/${aws_apigatewayv2_integration.movieq_catalog.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "post_omdb_lookup" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /movies/omdb_lookup"
  target             = "integrations/${aws_apigatewayv2_integration.movieq_refresh.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# --- Lambda Permissions (allow API Gateway to invoke) ---

resource "aws_lambda_permission" "apigw_movieq_list" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.movieq_list.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "apigw_movieq_write" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.movieq_write.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "apigw_movieq_catalog" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.movieq_catalog.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "apigw_movieq_refresh" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.movieq_refresh.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
