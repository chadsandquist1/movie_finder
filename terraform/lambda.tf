data "archive_file" "hello_world" {
  type        = "zip"
  source_file = "${path.module}/../lambdas/hello_world/handler.py"
  output_path = "${path.module}/.build/hello_world.zip"
}

resource "aws_lambda_function" "hello_world" {
  function_name    = "${local.name_prefix}-hello-world"
  filename         = data.archive_file.hello_world.output_path
  source_code_hash = data.archive_file.hello_world.output_base64sha256
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  role             = aws_iam_role.lambda_execution.arn

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "hello_world" {
  name              = "/aws/lambda/${aws_lambda_function.hello_world.function_name}"
  retention_in_days = 14

  tags = local.common_tags
}
