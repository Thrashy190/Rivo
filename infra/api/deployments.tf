# Deployments: plan, approval and apply by the engine (engine.tf). Each one
# is a record in DynamoDB, with its diagram, plan and logs in S3 next to the
# project's state.

module "deployments_table" {
  source       = "./modules/dynamodb"
  table_name   = "deployments"
  project_name = var.project_name
  environment  = var.environment
  hash_key     = "workspace_id"
  range_key    = "id"
  attributes = [
    { name = "workspace_id", type = "S" },
    { name = "id", type = "S" },
    { name = "project_id", type = "S" },
  ]
  global_secondary_indexes = [
    { name = "project-index", hash_key = "project_id", range_key = "id" },
  ]
}

# Engine time per workspace and month, which hosting may bill by.
module "usage_table" {
  source       = "./modules/dynamodb"
  table_name   = "usage"
  project_name = var.project_name
  environment  = var.environment
  hash_key     = "workspace_id"
  range_key    = "month"
  attributes = [
    { name = "workspace_id", type = "S" },
    { name = "month", type = "S" },
  ]
}

module "lambda_create_deployment" {
  source              = "./modules/lambda/golang"
  cors_allow_origin   = var.web_origin
  function_name       = "create-deployment"
  path_directory_file = "deployment/create-deployment/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME       = module.users_table.name
    MEMBERS_TABLE_NAME     = module.memberships_table.name
    PROJECTS_TABLE_NAME    = module.projects_table.name
    DEPLOYMENTS_TABLE_NAME = module.deployments_table.name
    CONNECTIONS_TABLE_NAME = module.connections_table.name
    DIAGRAMS_BUCKET        = module.diagrams_bucket.name
    ENGINE_CLUSTER         = local.engine_environment.ENGINE_CLUSTER
    ENGINE_TASK_DEFINITION = local.engine_environment.ENGINE_TASK_DEFINITION
    ENGINE_SUBNETS         = local.engine_environment.ENGINE_SUBNETS
    ENGINE_SECURITY_GROUP  = local.engine_environment.ENGINE_SECURITY_GROUP
  }

  statement = concat([
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
      Resource = module.projects_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem"]
      Resource = module.deployments_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.connections_table.arn
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
      Action   = ["s3:PutObject"]
      Resource = "${module.diagrams_bucket.arn}/workspaces/*/projects/*/deployments/*"
    },
  ], local.engine_statements)
}

module "lambda_list_deployments" {
  source              = "./modules/lambda/golang"
  cors_allow_origin   = var.web_origin
  function_name       = "list-deployments"
  path_directory_file = "deployment/list-deployments/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME       = module.users_table.name
    MEMBERS_TABLE_NAME     = module.memberships_table.name
    PROJECTS_TABLE_NAME    = module.projects_table.name
    DEPLOYMENTS_TABLE_NAME = module.deployments_table.name
    USAGE_TABLE_NAME       = module.usage_table.name
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
      Action   = ["dynamodb:Query"]
      Resource = module.deployments_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:Query"]
      Resource = "${module.deployments_table.arn}/index/project-index"
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.usage_table.arn
    },
  ]
}

module "lambda_get_deployment" {
  source              = "./modules/lambda/golang"
  cors_allow_origin   = var.web_origin
  function_name       = "get-deployment"
  path_directory_file = "deployment/get-deployment/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME       = module.users_table.name
    MEMBERS_TABLE_NAME     = module.memberships_table.name
    DEPLOYMENTS_TABLE_NAME = module.deployments_table.name
    DIAGRAMS_BUCKET        = module.diagrams_bucket.name
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
      Resource = module.deployments_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["s3:ListBucket"]
      Resource = module.diagrams_bucket.arn
    },
    {
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "${module.diagrams_bucket.arn}/workspaces/*/projects/*/deployments/*"
    },
  ]
}

module "lambda_approve_deployment" {
  source              = "./modules/lambda/golang"
  cors_allow_origin   = var.web_origin
  function_name       = "approve-deployment"
  path_directory_file = "deployment/approve-deployment/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME       = module.users_table.name
    MEMBERS_TABLE_NAME     = module.memberships_table.name
    PROJECTS_TABLE_NAME    = module.projects_table.name
    DEPLOYMENTS_TABLE_NAME = module.deployments_table.name
    ENGINE_CLUSTER         = local.engine_environment.ENGINE_CLUSTER
    ENGINE_TASK_DEFINITION = local.engine_environment.ENGINE_TASK_DEFINITION
    ENGINE_SUBNETS         = local.engine_environment.ENGINE_SUBNETS
    ENGINE_SECURITY_GROUP  = local.engine_environment.ENGINE_SECURITY_GROUP
  }

  statement = concat([
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
      Action   = ["dynamodb:UpdateItem"]
      Resource = module.projects_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
      Resource = module.deployments_table.arn
    },
  ], local.engine_statements)
}

module "lambda_cancel_deployment" {
  source              = "./modules/lambda/golang"
  cors_allow_origin   = var.web_origin
  function_name       = "cancel-deployment"
  path_directory_file = "deployment/cancel-deployment/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME       = module.users_table.name
    MEMBERS_TABLE_NAME     = module.memberships_table.name
    PROJECTS_TABLE_NAME    = module.projects_table.name
    DEPLOYMENTS_TABLE_NAME = module.deployments_table.name
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
      Action   = ["dynamodb:UpdateItem"]
      Resource = module.projects_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
      Resource = module.deployments_table.arn
    },
  ]
}

module "lambda_test_api" {
  source              = "./modules/lambda/golang"
  cors_allow_origin   = var.web_origin
  function_name       = "test-api"
  path_directory_file = "project/test-api/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME    = module.users_table.name
    MEMBERS_TABLE_NAME  = module.memberships_table.name
    PROJECTS_TABLE_NAME = module.projects_table.name
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
  ]
}

module "deployments_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.workspace_id_resource.id
  path_part   = "deployments"
}

module "deployment_id_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.deployments_resource.id
  path_part   = "{deploymentId}"
}

module "deployment_approve_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.deployment_id_resource.id
  path_part   = "approve"
}

module "deployment_cancel_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.deployment_id_resource.id
  path_part   = "cancel"
}

module "project_deployments_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.project_id_resource.id
  path_part   = "deployments"
}

module "test_request_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.project_id_resource.id
  path_part   = "test-request"
}

locals {
  deployment_routes = {
    list_deployments = {
      resource_id = module.deployments_resource.id
      http_method = "GET"
      route_path  = "workspaces/{workspaceId}/deployments"
      lambda = {
        invoke_arn    = module.lambda_list_deployments.invoke_arn
        function_name = module.lambda_list_deployments.function_name
      }
    }
    get_deployment = {
      resource_id = module.deployment_id_resource.id
      http_method = "GET"
      route_path  = "workspaces/{workspaceId}/deployments/{deploymentId}"
      lambda = {
        invoke_arn    = module.lambda_get_deployment.invoke_arn
        function_name = module.lambda_get_deployment.function_name
      }
    }
    approve_deployment = {
      resource_id = module.deployment_approve_resource.id
      http_method = "POST"
      route_path  = "workspaces/{workspaceId}/deployments/{deploymentId}/approve"
      lambda = {
        invoke_arn    = module.lambda_approve_deployment.invoke_arn
        function_name = module.lambda_approve_deployment.function_name
      }
    }
    cancel_deployment = {
      resource_id = module.deployment_cancel_resource.id
      http_method = "POST"
      route_path  = "workspaces/{workspaceId}/deployments/{deploymentId}/cancel"
      lambda = {
        invoke_arn    = module.lambda_cancel_deployment.invoke_arn
        function_name = module.lambda_cancel_deployment.function_name
      }
    }
    create_deployment = {
      resource_id = module.project_deployments_resource.id
      http_method = "POST"
      route_path  = "workspaces/{workspaceId}/projects/{projectId}/deployments"
      lambda = {
        invoke_arn    = module.lambda_create_deployment.invoke_arn
        function_name = module.lambda_create_deployment.function_name
      }
    }
    list_project_deployments = {
      resource_id = module.project_deployments_resource.id
      http_method = "GET"
      route_path  = "workspaces/{workspaceId}/projects/{projectId}/deployments"
      lambda = {
        invoke_arn    = module.lambda_list_deployments.invoke_arn
        function_name = module.lambda_list_deployments.function_name
      }
    }
    test_request = {
      resource_id = module.test_request_resource.id
      http_method = "POST"
      route_path  = "workspaces/{workspaceId}/projects/{projectId}/test-request"
      lambda = {
        invoke_arn    = module.lambda_test_api.invoke_arn
        function_name = module.lambda_test_api.function_name
      }
    }
  }
}
