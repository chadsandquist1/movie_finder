resource "aws_dynamodb_table" "movies" {
  name         = "${local.name_prefix}-movies"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "movie_id"

  attribute {
    name = "movie_id"
    type = "S"
  }

  # Additional attributes stored per item (not defined here since DynamoDB is schemaless):
  # movie_name, year, has_watched, tomatometer_score, category, rating, director, user_grade

  tags = local.common_tags
}
