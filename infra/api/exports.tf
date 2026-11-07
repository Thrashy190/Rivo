# Terraform generated from a project's diagram. The Lambda writes a .zip with
# the files and the packages they use under the project's prefix, and returns a
# short-lived link to it. Each export replaces the previous one.

module "lambda_export_terraform" {
  source              = "./modules/lambda/golang"
  cors_allow_origin   = var.web_origin
  function_name       = "export-terraform"
  path_directory_file = "project/export-terraform/main.go"
  project_name        = var.project_name
  environment         = var.environment
  # Packages of up to 50 MB are copied into the .zip in memory.
  memory_size = 1024
  timeout     = 30

  environment_variables = {
    USERS_TABLE_NAME    = module.users_table.name
    MEMBERS_TABLE_NAME  = module.memberships_table.name
    PROJECTS_TABLE_NAME = module.projects_table.name
    DIAGRAMS_BUCKET     = module.diagrams_bucket.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.users_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.memberships_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.projects_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["s3:ListBucket"]
      Resource = module.diagrams_bucket.arn
    },
    {
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "${module.diagrams_bucket.arn}/workspaces/*/projects/*/draft.json"
    },
    {
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "${module.diagrams_bucket.arn}/workspaces/*/projects/*/versions/*"
    },
    {
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "${module.diagrams_bucket.arn}/workspaces/*/projects/*/packages/*"
    },
    # The download link is signed with this role, so it needs to read exports.
    {
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject"]
      Resource = "${module.diagrams_bucket.arn}/workspaces/*/projects/*/exports/*"
    }
  ]
}

module "terraform_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.project_id_resource.id
  path_part   = "terraform"
}

locals {
  export_routes = {
    export_terraform = {
      resource_id = module.terraform_resource.id
      http_method = "POST"
      route_path  = "workspaces/{workspaceId}/projects/{projectId}/terraform"
      lambda = {
        invoke_arn    = module.lambda_export_terraform.invoke_arn
        function_name = module.lambda_export_terraform.function_name
      }
    }
  }
}
