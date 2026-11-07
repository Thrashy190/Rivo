# Lambda packages: a .zip goes from the browser straight to the diagrams
# bucket with a presigned form, under its project's prefix, and the diagram
# refers to it by ID. Packages stay until the project is deleted, because saved
# versions may still point at them.

module "lambda_create_package" {
  source              = "./modules/lambda/golang"
  cors_allow_origin   = var.web_origin
  function_name       = "create-package"
  path_directory_file = "package/create-package/main.go"
  project_name        = var.project_name
  environment         = var.environment

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
    # The presigned form uploads with this role's permission, so it is limited
    # to package keys.
    {
      Effect   = "Allow"
      Action   = ["s3:PutObject"]
      Resource = "${module.diagrams_bucket.arn}/workspaces/*/projects/*/packages/*"
    }
  ]
}

module "lambda_get_package" {
  source              = "./modules/lambda/golang"
  cors_allow_origin   = var.web_origin
  function_name       = "get-package"
  path_directory_file = "package/get-package/main.go"
  project_name        = var.project_name
  environment         = var.environment

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
      Resource = "${module.diagrams_bucket.arn}/workspaces/*/projects/*/packages/*"
    }
  ]
}

module "packages_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.project_id_resource.id
  path_part   = "packages"
}

module "package_id_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.packages_resource.id
  path_part   = "{packageId}"
}

locals {
  package_routes = {
    create_package = {
      resource_id = module.packages_resource.id
      http_method = "POST"
      route_path  = "workspaces/{workspaceId}/projects/{projectId}/packages"
      lambda = {
        invoke_arn    = module.lambda_create_package.invoke_arn
        function_name = module.lambda_create_package.function_name
      }
    }
    get_package = {
      resource_id = module.package_id_resource.id
      http_method = "GET"
      route_path  = "workspaces/{workspaceId}/projects/{projectId}/packages/{packageId}"
      lambda = {
        invoke_arn    = module.lambda_get_package.invoke_arn
        function_name = module.lambda_get_package.function_name
      }
    }
  }
}
