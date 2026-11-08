# AWS accounts a workspace connects for deploying. Rivo stores no
# credentials: each connection is a role in the account that trusts Rivo's
# engine and verify Lambda, with an external ID Rivo generated.

module "connections_table" {
  source       = "./modules/dynamodb"
  table_name   = "connections"
  project_name = var.project_name
  environment  = var.environment
  hash_key     = "workspace_id"
  range_key    = "id"
  attributes = [
    { name = "workspace_id", type = "S" },
    { name = "id", type = "S" },
  ]
}

module "lambda_create_connection" {
  source              = "./modules/lambda/golang"
  cors_allow_origin   = var.web_origin
  function_name       = "create-connection"
  path_directory_file = "connection/create-connection/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME       = module.users_table.name
    MEMBERS_TABLE_NAME     = module.memberships_table.name
    CONNECTIONS_TABLE_NAME = module.connections_table.name
    RIVO_ACCOUNT_ID        = data.aws_caller_identity.current.account_id
    TRUSTED_ROLE_ARNS      = join(",", local.trusted_role_arns)
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
      Action   = ["dynamodb:PutItem"]
      Resource = module.connections_table.arn
    },
  ]
}

module "lambda_list_connections" {
  source              = "./modules/lambda/golang"
  cors_allow_origin   = var.web_origin
  function_name       = "list-connections"
  path_directory_file = "connection/list-connections/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME       = module.users_table.name
    MEMBERS_TABLE_NAME     = module.memberships_table.name
    CONNECTIONS_TABLE_NAME = module.connections_table.name
    RIVO_ACCOUNT_ID        = data.aws_caller_identity.current.account_id
    TRUSTED_ROLE_ARNS      = join(",", local.trusted_role_arns)
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
      Action   = ["dynamodb:Query"]
      Resource = module.connections_table.arn
    },
  ]
}

module "lambda_verify_connection" {
  source              = "./modules/lambda/golang"
  cors_allow_origin   = var.web_origin
  function_name       = "verify-connection"
  path_directory_file = "connection/verify-connection/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME       = module.users_table.name
    MEMBERS_TABLE_NAME     = module.memberships_table.name
    CONNECTIONS_TABLE_NAME = module.connections_table.name
    RIVO_ACCOUNT_ID        = data.aws_caller_identity.current.account_id
    TRUSTED_ROLE_ARNS      = join(",", local.trusted_role_arns)
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
      Action   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
      Resource = module.connections_table.arn
    },
    # Trying the role without the external ID too is how it checks that the
    # role requires one, so this has no external ID condition.
    {
      Effect   = "Allow"
      Action   = ["sts:AssumeRole"]
      Resource = "arn:aws:iam::*:role/*"
    },
  ]
}

module "lambda_delete_connection" {
  source              = "./modules/lambda/golang"
  cors_allow_origin   = var.web_origin
  function_name       = "delete-connection"
  path_directory_file = "connection/delete-connection/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME       = module.users_table.name
    MEMBERS_TABLE_NAME     = module.memberships_table.name
    CONNECTIONS_TABLE_NAME = module.connections_table.name
    PROJECTS_TABLE_NAME    = module.projects_table.name
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
      Action   = ["dynamodb:GetItem", "dynamodb:DeleteItem"]
      Resource = module.connections_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:Query"]
      Resource = module.projects_table.arn
    },
  ]
}

module "connections_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.workspace_id_resource.id
  path_part   = "connections"
}

module "connection_id_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.connections_resource.id
  path_part   = "{connectionId}"
}

module "connection_verify_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.connection_id_resource.id
  path_part   = "verify"
}

locals {
  connection_routes = {
    list_connections = {
      resource_id = module.connections_resource.id
      http_method = "GET"
      route_path  = "workspaces/{workspaceId}/connections"
      lambda = {
        invoke_arn    = module.lambda_list_connections.invoke_arn
        function_name = module.lambda_list_connections.function_name
      }
    }
    create_connection = {
      resource_id = module.connections_resource.id
      http_method = "POST"
      route_path  = "workspaces/{workspaceId}/connections"
      lambda = {
        invoke_arn    = module.lambda_create_connection.invoke_arn
        function_name = module.lambda_create_connection.function_name
      }
    }
    delete_connection = {
      resource_id = module.connection_id_resource.id
      http_method = "DELETE"
      route_path  = "workspaces/{workspaceId}/connections/{connectionId}"
      lambda = {
        invoke_arn    = module.lambda_delete_connection.invoke_arn
        function_name = module.lambda_delete_connection.function_name
      }
    }
    verify_connection = {
      resource_id = module.connection_verify_resource.id
      http_method = "POST"
      route_path  = "workspaces/{workspaceId}/connections/{connectionId}/verify"
      lambda = {
        invoke_arn    = module.lambda_verify_connection.invoke_arn
        function_name = module.lambda_verify_connection.function_name
      }
    }
  }
}
