terraform {
  # 1.9 is needed for the cross-variable validation on frontend_url.
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Application = var.name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
