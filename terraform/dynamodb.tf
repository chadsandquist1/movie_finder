resource "aws_dynamodb_table" "movies" {
  name         = "${local.name_prefix}-movies"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "movie_id"

  attribute {
    name = "movie_id"
    type = "S"
  }

  tags = local.common_tags
}
