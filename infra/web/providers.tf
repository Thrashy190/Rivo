terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.71"
    }
  }
}

# CloudFront is a global service but ACM certificates used with it
# must be created in us-east-1 — so we pin the provider there.
provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "rivo-frontend"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
