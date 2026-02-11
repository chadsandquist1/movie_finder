variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "movie-finder"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "omdb_api_key" {
  description = "OMDb API key for movie data lookups"
  type        = string
  default     = "88d87cf4"
}
