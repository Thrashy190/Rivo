# Workspaces, members and folders: the tenant layer. Every Lambda here reads the
# memberships table because that is where the permission it requires lives (see
# shared/authz).

# -- DynamoDB --

module "workspaces_table" {
  source       = "./modules/dynamodb"
  table_name   = "workspaces"
  project_name = var.project_name
  environment  = var.environment
  hash_key     = "id"
  attributes = [
    { name = "id", type = "S" },
  ]
}

module "memberships_table" {
  source       = "./modules/dynamodb"
  table_name   = "memberships"
  project_name = var.project_name
  environment  = var.environment
  hash_key     = "workspace_id"
  range_key    = "user_id"
  attributes = [
    { name = "workspace_id", type = "S" },
    { name = "user_id", type = "S" },
  ]
  global_secondary_indexes = [
    { name = "user_id-index", hash_key = "user_id", range_key = "workspace_id" },
  ]
}

module "folders_table" {
  source       = "./modules/dynamodb"
  table_name   = "folders"
  project_name = var.project_name
  environment  = var.environment
  hash_key     = "workspace_id"
  range_key    = "id"
  attributes = [
    { name = "workspace_id", type = "S" },
    { name = "id", type = "S" },
  ]
}

# -- Lambdas --

module "lambda_create_workspace" {
  source              = "./modules/lambda/golang"
  function_name       = "create-workspace"
  path_directory_file = "workspace/create-workspace/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME      = module.users_table.name
    WORKSPACES_TABLE_NAME = module.workspaces_table.name
    MEMBERS_TABLE_NAME    = module.memberships_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.users_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:PutItem"]
      Resource = module.workspaces_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:PutItem"]
      Resource = module.memberships_table.arn
    }
  ]
}

module "lambda_list_workspaces" {
  source              = "./modules/lambda/golang"
  function_name       = "list-workspaces"
  path_directory_file = "workspace/list-workspaces/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME      = module.users_table.name
    WORKSPACES_TABLE_NAME = module.workspaces_table.name
    MEMBERS_TABLE_NAME    = module.memberships_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.users_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:Query"]
      Resource = "${module.memberships_table.arn}/index/*"
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:Scan"]
      Resource = module.workspaces_table.arn
    }
  ]
}

module "lambda_get_workspace" {
  source              = "./modules/lambda/golang"
  function_name       = "get-workspace"
  path_directory_file = "workspace/get-workspace/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME      = module.users_table.name
    WORKSPACES_TABLE_NAME = module.workspaces_table.name
    MEMBERS_TABLE_NAME    = module.memberships_table.name
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
      Resource = module.workspaces_table.arn
    }
  ]
}

module "lambda_list_members" {
  source              = "./modules/lambda/golang"
  function_name       = "list-members"
  path_directory_file = "member/list-members/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME   = module.users_table.name
    MEMBERS_TABLE_NAME = module.memberships_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.users_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:Query"]
      Resource = module.memberships_table.arn
    }
  ]
}

module "lambda_add_member" {
  source              = "./modules/lambda/golang"
  function_name       = "add-member"
  path_directory_file = "member/add-member/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME   = module.users_table.name
    MEMBERS_TABLE_NAME = module.memberships_table.name
    USER_POOL_ID       = module.cognito.user_pool_id
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:PutItem"]
      Resource = module.users_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:PutItem"]
      Resource = module.memberships_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["cognito-idp:AdminCreateUser", "cognito-idp:AdminGetUser"]
      Resource = module.cognito.user_pool_arn
    }
  ]
}

module "lambda_update_member" {
  source              = "./modules/lambda/golang"
  function_name       = "update-member"
  path_directory_file = "member/update-member/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME   = module.users_table.name
    MEMBERS_TABLE_NAME = module.memberships_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.users_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:UpdateItem"]
      Resource = module.memberships_table.arn
    }
  ]
}

module "lambda_remove_member" {
  source              = "./modules/lambda/golang"
  function_name       = "remove-member"
  path_directory_file = "member/remove-member/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME   = module.users_table.name
    MEMBERS_TABLE_NAME = module.memberships_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.users_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:DeleteItem"]
      Resource = module.memberships_table.arn
    }
  ]
}

module "lambda_create_folder" {
  source              = "./modules/lambda/golang"
  function_name       = "create-folder"
  path_directory_file = "folder/create-folder/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME   = module.users_table.name
    MEMBERS_TABLE_NAME = module.memberships_table.name
    FOLDERS_TABLE_NAME = module.folders_table.name
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
      Action   = ["dynamodb:PutItem", "dynamodb:Query"]
      Resource = module.folders_table.arn
    }
  ]
}

module "lambda_list_folders" {
  source              = "./modules/lambda/golang"
  function_name       = "list-folders"
  path_directory_file = "folder/list-folders/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME   = module.users_table.name
    MEMBERS_TABLE_NAME = module.memberships_table.name
    FOLDERS_TABLE_NAME = module.folders_table.name
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
      Resource = module.folders_table.arn
    }
  ]
}

module "lambda_delete_folder" {
  source              = "./modules/lambda/golang"
  function_name       = "delete-folder"
  path_directory_file = "folder/delete-folder/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME    = module.users_table.name
    MEMBERS_TABLE_NAME  = module.memberships_table.name
    FOLDERS_TABLE_NAME  = module.folders_table.name
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
      Action   = ["dynamodb:DeleteItem", "dynamodb:Query"]
      Resource = module.folders_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:Query"]
      Resource = module.projects_table.arn
    }
  ]
}

module "lambda_add_owner" {
  source              = "./modules/lambda/golang"
  function_name       = "add-owner"
  path_directory_file = "workspace/add-owner/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME      = module.users_table.name
    WORKSPACES_TABLE_NAME = module.workspaces_table.name
    MEMBERS_TABLE_NAME    = module.memberships_table.name
    USER_POOL_ID          = module.cognito.user_pool_id
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:PutItem"]
      Resource = module.users_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.workspaces_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"]
      Resource = module.memberships_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["cognito-idp:AdminCreateUser", "cognito-idp:AdminGetUser"]
      Resource = module.cognito.user_pool_arn
    }
  ]
}

module "lambda_remove_owner" {
  source              = "./modules/lambda/golang"
  function_name       = "remove-owner"
  path_directory_file = "workspace/remove-owner/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME   = module.users_table.name
    MEMBERS_TABLE_NAME = module.memberships_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = module.users_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:DeleteItem"]
      Resource = module.memberships_table.arn
    }
  ]
}

# -- API resources --

module "workspaces_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.rest_api.root_resource_id
  path_part   = "workspaces"
}

module "workspace_id_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.workspaces_resource.id
  path_part   = "{workspaceId}"
}

module "members_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.workspace_id_resource.id
  path_part   = "members"
}

module "member_id_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.members_resource.id
  path_part   = "{userId}"
}

module "folders_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.workspace_id_resource.id
  path_part   = "folders"
}

module "folder_id_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.folders_resource.id
  path_part   = "{folderId}"
}

module "owners_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.workspace_id_resource.id
  path_part   = "owners"
}

module "owner_id_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.owners_resource.id
  path_part   = "{userId}"
}

locals {
  workspace_routes = {
    add_owner = {
      resource_id = module.owners_resource.id
      http_method = "POST"
      route_path  = "workspaces/{workspaceId}/owners"
      lambda = {
        invoke_arn    = module.lambda_add_owner.invoke_arn
        function_name = module.lambda_add_owner.function_name
      }
    }
    remove_owner = {
      resource_id = module.owner_id_resource.id
      http_method = "DELETE"
      route_path  = "workspaces/{workspaceId}/owners/{userId}"
      lambda = {
        invoke_arn    = module.lambda_remove_owner.invoke_arn
        function_name = module.lambda_remove_owner.function_name
      }
    }
    create_workspace = {
      resource_id = module.workspaces_resource.id
      http_method = "POST"
      route_path  = "workspaces"
      lambda = {
        invoke_arn    = module.lambda_create_workspace.invoke_arn
        function_name = module.lambda_create_workspace.function_name
      }
    }
    list_workspaces = {
      resource_id = module.workspaces_resource.id
      http_method = "GET"
      route_path  = "workspaces"
      lambda = {
        invoke_arn    = module.lambda_list_workspaces.invoke_arn
        function_name = module.lambda_list_workspaces.function_name
      }
    }
    get_workspace = {
      resource_id = module.workspace_id_resource.id
      http_method = "GET"
      route_path  = "workspaces/{workspaceId}"
      lambda = {
        invoke_arn    = module.lambda_get_workspace.invoke_arn
        function_name = module.lambda_get_workspace.function_name
      }
    }
    list_members = {
      resource_id = module.members_resource.id
      http_method = "GET"
      route_path  = "workspaces/{workspaceId}/members"
      lambda = {
        invoke_arn    = module.lambda_list_members.invoke_arn
        function_name = module.lambda_list_members.function_name
      }
    }
    add_member = {
      resource_id = module.members_resource.id
      http_method = "POST"
      route_path  = "workspaces/{workspaceId}/members"
      lambda = {
        invoke_arn    = module.lambda_add_member.invoke_arn
        function_name = module.lambda_add_member.function_name
      }
    }
    update_member = {
      resource_id = module.member_id_resource.id
      http_method = "PATCH"
      route_path  = "workspaces/{workspaceId}/members/{userId}"
      lambda = {
        invoke_arn    = module.lambda_update_member.invoke_arn
        function_name = module.lambda_update_member.function_name
      }
    }
    remove_member = {
      resource_id = module.member_id_resource.id
      http_method = "DELETE"
      route_path  = "workspaces/{workspaceId}/members/{userId}"
      lambda = {
        invoke_arn    = module.lambda_remove_member.invoke_arn
        function_name = module.lambda_remove_member.function_name
      }
    }
    create_folder = {
      resource_id = module.folders_resource.id
      http_method = "POST"
      route_path  = "workspaces/{workspaceId}/folders"
      lambda = {
        invoke_arn    = module.lambda_create_folder.invoke_arn
        function_name = module.lambda_create_folder.function_name
      }
    }
    list_folders = {
      resource_id = module.folders_resource.id
      http_method = "GET"
      route_path  = "workspaces/{workspaceId}/folders"
      lambda = {
        invoke_arn    = module.lambda_list_folders.invoke_arn
        function_name = module.lambda_list_folders.function_name
      }
    }
    delete_folder = {
      resource_id = module.folder_id_resource.id
      http_method = "DELETE"
      route_path  = "workspaces/{workspaceId}/folders/{folderId}"
      lambda = {
        invoke_arn    = module.lambda_delete_folder.invoke_arn
        function_name = module.lambda_delete_folder.function_name
      }
    }
  }
}
