# --- movieq_list ---

data "archive_file" "movieq_list" {
  type        = "zip"
  source_file = "${path.module}/../lambdas/movieq_list/handler.py"
  output_path = "${path.module}/.build/movieq_list.zip"
}

resource "aws_lambda_function" "movieq_list" {
  function_name    = "${local.name_prefix}-movieq-list"
  filename         = data.archive_file.movieq_list.output_path
  source_code_hash = data.archive_file.movieq_list.output_base64sha256
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  role             = aws_iam_role.lambda_execution.arn

  environment {
    variables = {
      TABLE_NAME       = aws_dynamodb_table.movies.name
      QUEUE_TABLE_NAME = aws_dynamodb_table.queue.name
    }
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "movieq_list" {
  name              = "/aws/lambda/${aws_lambda_function.movieq_list.function_name}"
  retention_in_days = 14

  tags = local.common_tags
}

# --- movieq_write ---

data "archive_file" "movieq_write" {
  type        = "zip"
  source_file = "${path.module}/../lambdas/movieq_write/handler.py"
  output_path = "${path.module}/.build/movieq_write.zip"
}

resource "aws_lambda_function" "movieq_write" {
  function_name    = "${local.name_prefix}-movieq-write"
  filename         = data.archive_file.movieq_write.output_path
  source_code_hash = data.archive_file.movieq_write.output_base64sha256
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  role             = aws_iam_role.lambda_execution.arn

  environment {
    variables = {
      TABLE_NAME       = aws_dynamodb_table.movies.name
      QUEUE_TABLE_NAME = aws_dynamodb_table.queue.name
    }
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "movieq_write" {
  name              = "/aws/lambda/${aws_lambda_function.movieq_write.function_name}"
  retention_in_days = 14

  tags = local.common_tags
}

# --- movieq_refresh ---

data "archive_file" "movieq_refresh" {
  type        = "zip"
  source_file = "${path.module}/../lambdas/movieq_refresh/handler.py"
  output_path = "${path.module}/.build/movieq_refresh.zip"
}

resource "aws_lambda_function" "movieq_refresh" {
  function_name    = "${local.name_prefix}-movieq-refresh"
  filename         = data.archive_file.movieq_refresh.output_path
  source_code_hash = data.archive_file.movieq_refresh.output_base64sha256
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  role             = aws_iam_role.lambda_execution.arn
  timeout          = 30

  environment {
    variables = {
      OMDB_API_KEY = var.omdb_api_key
    }
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "movieq_refresh" {
  name              = "/aws/lambda/${aws_lambda_function.movieq_refresh.function_name}"
  retention_in_days = 14

  tags = local.common_tags
}

# --- movieq_catalog ---

data "archive_file" "movieq_catalog" {
  type        = "zip"
  source_file = "${path.module}/../lambdas/movieq_catalog/handler.py"
  output_path = "${path.module}/.build/movieq_catalog.zip"
}

resource "aws_lambda_function" "movieq_catalog" {
  function_name    = "${local.name_prefix}-movieq-catalog"
  filename         = data.archive_file.movieq_catalog.output_path
  source_code_hash = data.archive_file.movieq_catalog.output_base64sha256
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  role             = aws_iam_role.lambda_execution.arn

  environment {
    variables = {
      TABLE_NAME       = aws_dynamodb_table.movies.name
      QUEUE_TABLE_NAME = aws_dynamodb_table.queue.name
    }
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "movieq_catalog" {
  name              = "/aws/lambda/${aws_lambda_function.movieq_catalog.function_name}"
  retention_in_days = 14

  tags = local.common_tags
}
