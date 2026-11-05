# -- DynamoDB --

module "projects_table" {
  source       = "./infraestructure/dynamoDB"
  table_name   = "projects"
  project_name = var.project_name
  environment  = var.environment
  hash_key     = "id"
  attributes = [
    { name = "id", type = "S" },
  ]
}

# -- Lambdas --

module "lambda_ping" {
  source              = "./infraestructure/lambda/golang"
  function_name       = "ping"
  path_directory_file = "ping/main.go"
  project_name        = var.project_name
  environment         = var.environment
}

module "lambda_create_project" {
  source              = "./infraestructure/lambda/golang"
  function_name       = "create-project"
  path_directory_file = "project/create-project/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    TABLE_NAME = module.projects_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:PutItem"]
      Resource = module.projects_table.arn
    }
  ]
}

module "lambda_get_project" {
  source              = "./infraestructure/lambda/golang"
  function_name       = "get-project"
  path_directory_file = "project/get-project/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    TABLE_NAME = module.projects_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.projects_table.arn
    }
  ]
}

module "lambda_get_all_projects" {
  source              = "./infraestructure/lambda/golang"
  function_name       = "get-all-projects"
  path_directory_file = "project/get-all-projects/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    TABLE_NAME = module.projects_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:Scan"]
      Resource = module.projects_table.arn
    }
  ]
}

module "lambda_update_project" {
  source              = "./infraestructure/lambda/golang"
  function_name       = "update-project"
  path_directory_file = "project/update-project/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    TABLE_NAME = module.projects_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:UpdateItem"]
      Resource = module.projects_table.arn
    }
  ]
}

module "lambda_delete_project" {
  source              = "./infraestructure/lambda/golang"
  function_name       = "delete-project"
  path_directory_file = "project/delete-project/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    TABLE_NAME = module.projects_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:DeleteItem"]
      Resource = module.projects_table.arn
    }
  ]
}

# -- API --

module "rest_api" {
  source       = "./infraestructure/api/api-rest"
  project_name = var.project_name
  environment  = var.environment
}

module "ping_resource" {
  source      = "./infraestructure/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.rest_api.root_resource_id
  path_part   = "ping"
}

module "projects_resource" {
  source      = "./infraestructure/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.rest_api.root_resource_id
  path_part   = "projects"
}

module "project_id_resource" {
  source      = "./infraestructure/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.projects_resource.id
  path_part   = "{id}"
}

locals {
  routes = {
    ping = {
      resource_id = module.ping_resource.id
      http_method = "GET"
      route_path  = "ping"
      lambda = {
        invoke_arn    = module.lambda_ping.invoke_arn
        function_name = module.lambda_ping.function_name
      }
    }
    create_project = {
      resource_id = module.projects_resource.id
      http_method = "POST"
      route_path  = "projects"
      lambda = {
        invoke_arn    = module.lambda_create_project.invoke_arn
        function_name = module.lambda_create_project.function_name
      }
    }
    get_project = {
      resource_id = module.project_id_resource.id
      http_method = "GET"
      route_path  = "projects/{id}"
      lambda = {
        invoke_arn    = module.lambda_get_project.invoke_arn
        function_name = module.lambda_get_project.function_name
      }
    }
    get_all_project = {
      resource_id = module.projects_resource.id
      http_method = "GET"
      route_path  = "projects"
      lambda = {
        invoke_arn    = module.lambda_get_all_projects.invoke_arn
        function_name = module.lambda_get_all_projects.function_name
      }
    }
    update_project = {
      resource_id = module.project_id_resource.id
      http_method = "PATCH"
      route_path  = "projects/{id}"
      lambda = {
        invoke_arn    = module.lambda_update_project.invoke_arn
        function_name = module.lambda_update_project.function_name
      }
    }
    delete_project = {
      resource_id = module.project_id_resource.id
      http_method = "DELETE"
      route_path  = "projects/{id}"
      lambda = {
        invoke_arn    = module.lambda_delete_project.invoke_arn
        function_name = module.lambda_delete_project.function_name
      }
    }
  }
}

# --- Puente hacia infraestructure/api ---

module "api" {
  source            = "./infraestructure/api"
  project_name      = var.project_name
  rest_api_id       = module.rest_api.id
  api_execution_arn = module.rest_api.execution_arn
  environment       = var.environment
  routes            = local.routes
}