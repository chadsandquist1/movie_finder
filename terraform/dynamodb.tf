resource "aws_dynamodb_table" "movies" {
  name         = "${local.name_prefix}-movies"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "status"
  range_key    = "rank"

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "rank"
    type = "S"
  }

  tags = local.common_tags
}

# --- Seed Data ---

resource "aws_dynamodb_table_item" "movie_1" {
  table_name = aws_dynamodb_table.movies.name
  hash_key   = aws_dynamodb_table.movies.hash_key
  range_key  = aws_dynamodb_table.movies.range_key

  item = jsonencode({
    status   = { S = "active" }
    rank     = { S = "a0" }
    title    = { S = "Sinners" }
    year     = { N = "2025" }
    genre    = { S = "Horror" }
    rating   = { N = "7.8" }
    director = { S = "Ryan Coogler" }
  })
}

resource "aws_dynamodb_table_item" "movie_2" {
  table_name = aws_dynamodb_table.movies.name
  hash_key   = aws_dynamodb_table.movies.hash_key
  range_key  = aws_dynamodb_table.movies.range_key

  item = jsonencode({
    status   = { S = "active" }
    rank     = { S = "a1" }
    title    = { S = "Thunderbolts*" }
    year     = { N = "2025" }
    genre    = { S = "Action" }
    rating   = { N = "7.2" }
    director = { S = "Jake Schreier" }
  })
}

resource "aws_dynamodb_table_item" "movie_3" {
  table_name = aws_dynamodb_table.movies.name
  hash_key   = aws_dynamodb_table.movies.hash_key
  range_key  = aws_dynamodb_table.movies.range_key

  item = jsonencode({
    status   = { S = "active" }
    rank     = { S = "a2" }
    title    = { S = "Mission: Impossible - The Final Reckoning" }
    year     = { N = "2025" }
    genre    = { S = "Action" }
    rating   = { N = "8.1" }
    director = { S = "Christopher McQuarrie" }
  })
}

resource "aws_dynamodb_table_item" "movie_4" {
  table_name = aws_dynamodb_table.movies.name
  hash_key   = aws_dynamodb_table.movies.hash_key
  range_key  = aws_dynamodb_table.movies.range_key

  item = jsonencode({
    status   = { S = "active" }
    rank     = { S = "a3" }
    title    = { S = "The Amateur" }
    year     = { N = "2025" }
    genre    = { S = "Thriller" }
    rating   = { N = "6.9" }
    director = { S = "James Hawes" }
  })
}

resource "aws_dynamodb_table_item" "movie_5" {
  table_name = aws_dynamodb_table.movies.name
  hash_key   = aws_dynamodb_table.movies.hash_key
  range_key  = aws_dynamodb_table.movies.range_key

  item = jsonencode({
    status   = { S = "active" }
    rank     = { S = "a4" }
    title    = { S = "Ballerina" }
    year     = { N = "2025" }
    genre    = { S = "Action" }
    rating   = { N = "7.0" }
    director = { S = "Len Wiseman" }
  })
}

resource "aws_dynamodb_table_item" "movie_6" {
  table_name = aws_dynamodb_table.movies.name
  hash_key   = aws_dynamodb_table.movies.hash_key
  range_key  = aws_dynamodb_table.movies.range_key

  item = jsonencode({
    status   = { S = "recentlyWatched" }
    rank     = { S = "a5" }
    title    = { S = "Elio" }
    year     = { N = "2025" }
    genre    = { S = "Animation" }
    rating   = { N = "7.5" }
    director = { S = "Adrian Molina" }
  })
}

resource "aws_dynamodb_table_item" "movie_7" {
  table_name = aws_dynamodb_table.movies.name
  hash_key   = aws_dynamodb_table.movies.hash_key
  range_key  = aws_dynamodb_table.movies.range_key

  item = jsonencode({
    status   = { S = "recentlyWatched" }
    rank     = { S = "a6" }
    title    = { S = "The Fantastic Four: First Steps" }
    year     = { N = "2025" }
    genre    = { S = "Sci-Fi" }
    rating   = { N = "7.3" }
    director = { S = "Matt Shakman" }
  })
}

resource "aws_dynamodb_table_item" "movie_8" {
  table_name = aws_dynamodb_table.movies.name
  hash_key   = aws_dynamodb_table.movies.hash_key
  range_key  = aws_dynamodb_table.movies.range_key

  item = jsonencode({
    status   = { S = "recentlyWatched" }
    rank     = { S = "a7" }
    title    = { S = "Superman" }
    year     = { N = "2025" }
    genre    = { S = "Action" }
    rating   = { N = "8.0" }
    director = { S = "James Gunn" }
  })
}

resource "aws_dynamodb_table_item" "movie_9" {
  table_name = aws_dynamodb_table.movies.name
  hash_key   = aws_dynamodb_table.movies.hash_key
  range_key  = aws_dynamodb_table.movies.range_key

  item = jsonencode({
    status   = { S = "notInterested" }
    rank     = { S = "a8" }
    title    = { S = "Lilo & Stitch" }
    year     = { N = "2025" }
    genre    = { S = "Family" }
    rating   = { N = "7.4" }
    director = { S = "Dean Fleischer Camp" }
  })
}

resource "aws_dynamodb_table_item" "movie_10" {
  table_name = aws_dynamodb_table.movies.name
  hash_key   = aws_dynamodb_table.movies.hash_key
  range_key  = aws_dynamodb_table.movies.range_key

  item = jsonencode({
    status   = { S = "notInterested" }
    rank     = { S = "a9" }
    title    = { S = "How to Train Your Dragon" }
    year     = { N = "2025" }
    genre    = { S = "Fantasy" }
    rating   = { N = "7.6" }
    director = { S = "Dean DeBlois" }
  })
}
