# The only providers the engine has. Terraform runs with -plugin-dir, so a
# configuration cannot use any other provider or version. tfgen's version
# constraints must accept these.
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.72.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "2.8.1"
    }
  }
}
