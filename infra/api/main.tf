# -- DynamoDB --

module "projects_table" {
  source       = "./modules/dynamodb"
  table_name   = "projects"
  project_name = var.project_name
  environment  = var.environment
  hash_key     = "id"
  attributes = [
    { name = "id", type = "S" },
  ]
}

module "users_table" {
  source       = "./modules/dynamodb"
  table_name   = "users"
  project_name = var.project_name
  environment  = var.environment
  hash_key     = "id"
  attributes = [
    { name = "id", type = "S" },
  ]
}

# -- Cognito --

module "cognito" {
  source       = "./modules/cognito"
  project_name = var.project_name
  environment  = var.environment
  admin_email  = var.admin_email
}

# Seed the initial admin in the users table: Cognito says who they are, but
# permissions come from this table, so without this row the admin would get
# no access. The admin role already implies every permission ("*").
# ignore_changes keeps Terraform from overwriting later changes made through
# the API itself (for example, if the admin's role changes or they are disabled).
resource "aws_dynamodb_table_item" "admin_user" {
  table_name = module.users_table.name
  hash_key   = "id"

  item = jsonencode({
    id     = { S = module.cognito.admin_sub }
    email  = { S = var.admin_email }
    role   = { S = "admin" }
    status = { S = "active" }
  })

  lifecycle {
    ignore_changes = [item]
  }
}

# -- Lambdas --

module "lambda_ping" {
  source              = "./modules/lambda/golang"
  function_name       = "ping"
  path_directory_file = "ping/main.go"
  project_name        = var.project_name
  environment         = var.environment
}

# -- Lambdas: auth --

module "lambda_login" {
  source              = "./modules/lambda/golang"
  function_name       = "login"
  path_directory_file = "auth/login/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USER_POOL_CLIENT_ID = module.cognito.app_client_id
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["cognito-idp:InitiateAuth"]
      Resource = module.cognito.user_pool_arn
    }
  ]
}

module "lambda_new_password" {
  source              = "./modules/lambda/golang"
  function_name       = "new-password"
  path_directory_file = "auth/new-password/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USER_POOL_CLIENT_ID = module.cognito.app_client_id
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["cognito-idp:RespondToAuthChallenge"]
      Resource = module.cognito.user_pool_arn
    }
  ]
}

# -- Lambdas: users --
#
# All of them read the users table because it holds the permission the handler
# requires (see shared/authz), not only because they operate on users.

module "lambda_create_user" {
  source              = "./modules/lambda/golang"
  function_name       = "create-user"
  path_directory_file = "user/create-user/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME = module.users_table.name
    USER_POOL_ID     = module.cognito.user_pool_id
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:PutItem"]
      Resource = module.users_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["cognito-idp:AdminCreateUser"]
      Resource = module.cognito.user_pool_arn
    }
  ]
}

module "lambda_get_all_users" {
  source              = "./modules/lambda/golang"
  function_name       = "get-all-users"
  path_directory_file = "user/get-all-users/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME = module.users_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:Scan"]
      Resource = module.users_table.arn
    }
  ]
}

module "lambda_get_me" {
  source              = "./modules/lambda/golang"
  function_name       = "get-me"
  path_directory_file = "user/get-me/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME = module.users_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.users_table.arn
    }
  ]
}

module "lambda_update_user" {
  source              = "./modules/lambda/golang"
  function_name       = "update-user"
  path_directory_file = "user/update-user/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME = module.users_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
      Resource = module.users_table.arn
    }
  ]
}

module "lambda_delete_user" {
  source              = "./modules/lambda/golang"
  function_name       = "delete-user"
  path_directory_file = "user/delete-user/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME = module.users_table.name
    USER_POOL_ID     = module.cognito.user_pool_id
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:DeleteItem"]
      Resource = module.users_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["cognito-idp:AdminDeleteUser"]
      Resource = module.cognito.user_pool_arn
    }
  ]
}

# -- Lambdas: projects --

module "lambda_create_project" {
  source              = "./modules/lambda/golang"
  function_name       = "create-project"
  path_directory_file = "project/create-project/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    TABLE_NAME       = module.projects_table.name
    USERS_TABLE_NAME = module.users_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:PutItem"]
      Resource = module.projects_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.users_table.arn
    }
  ]
}

module "lambda_get_project" {
  source              = "./modules/lambda/golang"
  function_name       = "get-project"
  path_directory_file = "project/get-project/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    TABLE_NAME       = module.projects_table.name
    USERS_TABLE_NAME = module.users_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.projects_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.users_table.arn
    }
  ]
}

module "lambda_get_all_projects" {
  source              = "./modules/lambda/golang"
  function_name       = "get-all-projects"
  path_directory_file = "project/get-all-projects/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    TABLE_NAME       = module.projects_table.name
    USERS_TABLE_NAME = module.users_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:Scan"]
      Resource = module.projects_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.users_table.arn
    }
  ]
}

module "lambda_update_project" {
  source              = "./modules/lambda/golang"
  function_name       = "update-project"
  path_directory_file = "project/update-project/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    TABLE_NAME       = module.projects_table.name
    USERS_TABLE_NAME = module.users_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:UpdateItem"]
      Resource = module.projects_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.users_table.arn
    }
  ]
}

module "lambda_delete_project" {
  source              = "./modules/lambda/golang"
  function_name       = "delete-project"
  path_directory_file = "project/delete-project/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    TABLE_NAME       = module.projects_table.name
    USERS_TABLE_NAME = module.users_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:DeleteItem"]
      Resource = module.projects_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.users_table.arn
    }
  ]
}

# -- API --

module "rest_api" {
  source       = "./modules/api/api-rest"
  project_name = var.project_name
  environment  = var.environment
}

module "api_authorizer" {
  source        = "./modules/api/api-authorizer"
  rest_api_id   = module.rest_api.id
  user_pool_arn = module.cognito.user_pool_arn
  environment   = var.environment
}

module "ping_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.rest_api.root_resource_id
  path_part   = "ping"
}

module "projects_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.rest_api.root_resource_id
  path_part   = "projects"
}

module "project_id_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.projects_resource.id
  path_part   = "{id}"
}

module "auth_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.rest_api.root_resource_id
  path_part   = "auth"
}

module "auth_login_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.auth_resource.id
  path_part   = "login"
}

module "auth_new_password_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.auth_resource.id
  path_part   = "new-password"
}

module "users_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.rest_api.root_resource_id
  path_part   = "users"
}

# /users/me has to be its own literal resource and not fall into
# /users/{id}: API Gateway resolves the literal segment first.
module "users_me_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.users_resource.id
  path_part   = "me"
}

module "user_id_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.users_resource.id
  path_part   = "{id}"
}

locals {
  routes = {
    ping = {
      resource_id = module.ping_resource.id
      http_method = "GET"
      route_path  = "ping"
      public      = true
      lambda = {
        invoke_arn    = module.lambda_ping.invoke_arn
        function_name = module.lambda_ping.function_name
      }
    }

    # Public by necessity: they run before the user has a token.
    login = {
      resource_id = module.auth_login_resource.id
      http_method = "POST"
      route_path  = "auth/login"
      public      = true
      lambda = {
        invoke_arn    = module.lambda_login.invoke_arn
        function_name = module.lambda_login.function_name
      }
    }
    new_password = {
      resource_id = module.auth_new_password_resource.id
      http_method = "POST"
      route_path  = "auth/new-password"
      public      = true
      lambda = {
        invoke_arn    = module.lambda_new_password.invoke_arn
        function_name = module.lambda_new_password.function_name
      }
    }

    create_user = {
      resource_id = module.users_resource.id
      http_method = "POST"
      route_path  = "users"
      lambda = {
        invoke_arn    = module.lambda_create_user.invoke_arn
        function_name = module.lambda_create_user.function_name
      }
    }
    get_all_users = {
      resource_id = module.users_resource.id
      http_method = "GET"
      route_path  = "users"
      lambda = {
        invoke_arn    = module.lambda_get_all_users.invoke_arn
        function_name = module.lambda_get_all_users.function_name
      }
    }
    get_me = {
      resource_id = module.users_me_resource.id
      http_method = "GET"
      route_path  = "users/me"
      lambda = {
        invoke_arn    = module.lambda_get_me.invoke_arn
        function_name = module.lambda_get_me.function_name
      }
    }
    update_user = {
      resource_id = module.user_id_resource.id
      http_method = "PATCH"
      route_path  = "users/{id}"
      lambda = {
        invoke_arn    = module.lambda_update_user.invoke_arn
        function_name = module.lambda_update_user.function_name
      }
    }
    delete_user = {
      resource_id = module.user_id_resource.id
      http_method = "DELETE"
      route_path  = "users/{id}"
      lambda = {
        invoke_arn    = module.lambda_delete_user.invoke_arn
        function_name = module.lambda_delete_user.function_name
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

# --- Bridge to modules/api ---

module "api" {
  source            = "./modules/api"
  project_name      = var.project_name
  rest_api_id       = module.rest_api.id
  api_execution_arn = module.rest_api.execution_arn
  authorizer_id     = module.api_authorizer.id
  environment       = var.environment
  routes            = merge(local.routes, local.workspace_routes)
}
