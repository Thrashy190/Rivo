# Projects inside workspaces. DynamoDB holds what a project is, and S3 holds its
# diagrams. s3:ListBucket is what makes a missing diagram answer "not found"
# instead of "access denied".

# -- Storage --

module "projects_table" {
  source       = "./modules/dynamodb"
  table_name   = "projects"
  project_name = var.project_name
  environment  = var.environment
  hash_key     = "workspace_id"
  range_key    = "id"
  attributes = [
    { name = "workspace_id", type = "S" },
    { name = "id", type = "S" },
  ]
}

module "versions_table" {
  source       = "./modules/dynamodb"
  table_name   = "project-versions"
  project_name = var.project_name
  environment  = var.environment
  hash_key     = "project_id"
  range_key    = "number"
  attributes = [
    { name = "project_id", type = "S" },
    { name = "number", type = "N" },
  ]
}

module "diagrams_bucket" {
  source       = "./modules/s3-private"
  bucket_name  = "${lower(var.project_name)}-${var.environment}-diagrams-${data.aws_caller_identity.current.account_id}"
  project_name = var.project_name
  environment  = var.environment
}

data "aws_caller_identity" "current" {}

# -- Lambdas --

module "lambda_create_project" {
  source              = "./modules/lambda/golang"
  function_name       = "create-project"
  path_directory_file = "project/create-project/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME    = module.users_table.name
    MEMBERS_TABLE_NAME  = module.memberships_table.name
    PROJECTS_TABLE_NAME = module.projects_table.name
    FOLDERS_TABLE_NAME  = module.folders_table.name
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
      Resource = module.projects_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:Query"]
      Resource = module.folders_table.arn
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
      Action   = ["dynamodb:Query"]
      Resource = module.projects_table.arn
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
    USERS_TABLE_NAME    = module.users_table.name
    MEMBERS_TABLE_NAME  = module.memberships_table.name
    PROJECTS_TABLE_NAME = module.projects_table.name
    FOLDERS_TABLE_NAME  = module.folders_table.name
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
      Action   = ["dynamodb:Query"]
      Resource = module.folders_table.arn
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
    USERS_TABLE_NAME    = module.users_table.name
    MEMBERS_TABLE_NAME  = module.memberships_table.name
    PROJECTS_TABLE_NAME = module.projects_table.name
    VERSIONS_TABLE_NAME = module.versions_table.name
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
      Action   = ["dynamodb:GetItem", "dynamodb:DeleteItem"]
      Resource = module.projects_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:Query", "dynamodb:DeleteItem"]
      Resource = module.versions_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["s3:ListBucket"]
      Resource = module.diagrams_bucket.arn
    },
    {
      Effect   = "Allow"
      Action   = ["s3:DeleteObject"]
      Resource = "${module.diagrams_bucket.arn}/workspaces/*"
    }
  ]
}

module "lambda_get_draft" {
  source              = "./modules/lambda/golang"
  function_name       = "get-draft"
  path_directory_file = "project/get-draft/main.go"
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
      Resource = "${module.diagrams_bucket.arn}/workspaces/*"
    }
  ]
}

module "lambda_save_draft" {
  source              = "./modules/lambda/golang"
  function_name       = "save-draft"
  path_directory_file = "project/save-draft/main.go"
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
      Action   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
      Resource = module.projects_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["s3:ListBucket"]
      Resource = module.diagrams_bucket.arn
    },
    {
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject"]
      Resource = "${module.diagrams_bucket.arn}/workspaces/*"
    }
  ]
}

module "lambda_create_version" {
  source              = "./modules/lambda/golang"
  function_name       = "create-version"
  path_directory_file = "version/create-version/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME    = module.users_table.name
    MEMBERS_TABLE_NAME  = module.memberships_table.name
    PROJECTS_TABLE_NAME = module.projects_table.name
    VERSIONS_TABLE_NAME = module.versions_table.name
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
      Action   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
      Resource = module.projects_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:PutItem"]
      Resource = module.versions_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["s3:ListBucket"]
      Resource = module.diagrams_bucket.arn
    },
    {
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject"]
      Resource = "${module.diagrams_bucket.arn}/workspaces/*"
    }
  ]
}

module "lambda_list_versions" {
  source              = "./modules/lambda/golang"
  function_name       = "list-versions"
  path_directory_file = "version/list-versions/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    USERS_TABLE_NAME    = module.users_table.name
    MEMBERS_TABLE_NAME  = module.memberships_table.name
    PROJECTS_TABLE_NAME = module.projects_table.name
    VERSIONS_TABLE_NAME = module.versions_table.name
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
      Resource = module.versions_table.arn
    }
  ]
}

module "lambda_get_version" {
  source              = "./modules/lambda/golang"
  function_name       = "get-version"
  path_directory_file = "version/get-version/main.go"
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
      Resource = "${module.diagrams_bucket.arn}/workspaces/*"
    }
  ]
}

# -- API resources --

module "projects_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.workspace_id_resource.id
  path_part   = "projects"
}

module "project_id_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.projects_resource.id
  path_part   = "{projectId}"
}

module "draft_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.project_id_resource.id
  path_part   = "draft"
}

module "versions_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.project_id_resource.id
  path_part   = "versions"
}

module "version_number_resource" {
  source      = "./modules/api/api-resource"
  rest_api_id = module.rest_api.id
  parent_id   = module.versions_resource.id
  path_part   = "{number}"
}

locals {
  project_routes = {
    create_project = {
      resource_id = module.projects_resource.id
      http_method = "POST"
      route_path  = "workspaces/{workspaceId}/projects"
      lambda = {
        invoke_arn    = module.lambda_create_project.invoke_arn
        function_name = module.lambda_create_project.function_name
      }
    }
    get_all_projects = {
      resource_id = module.projects_resource.id
      http_method = "GET"
      route_path  = "workspaces/{workspaceId}/projects"
      lambda = {
        invoke_arn    = module.lambda_get_all_projects.invoke_arn
        function_name = module.lambda_get_all_projects.function_name
      }
    }
    get_project = {
      resource_id = module.project_id_resource.id
      http_method = "GET"
      route_path  = "workspaces/{workspaceId}/projects/{projectId}"
      lambda = {
        invoke_arn    = module.lambda_get_project.invoke_arn
        function_name = module.lambda_get_project.function_name
      }
    }
    update_project = {
      resource_id = module.project_id_resource.id
      http_method = "PATCH"
      route_path  = "workspaces/{workspaceId}/projects/{projectId}"
      lambda = {
        invoke_arn    = module.lambda_update_project.invoke_arn
        function_name = module.lambda_update_project.function_name
      }
    }
    delete_project = {
      resource_id = module.project_id_resource.id
      http_method = "DELETE"
      route_path  = "workspaces/{workspaceId}/projects/{projectId}"
      lambda = {
        invoke_arn    = module.lambda_delete_project.invoke_arn
        function_name = module.lambda_delete_project.function_name
      }
    }
    get_draft = {
      resource_id = module.draft_resource.id
      http_method = "GET"
      route_path  = "workspaces/{workspaceId}/projects/{projectId}/draft"
      lambda = {
        invoke_arn    = module.lambda_get_draft.invoke_arn
        function_name = module.lambda_get_draft.function_name
      }
    }
    save_draft = {
      resource_id = module.draft_resource.id
      http_method = "PUT"
      route_path  = "workspaces/{workspaceId}/projects/{projectId}/draft"
      lambda = {
        invoke_arn    = module.lambda_save_draft.invoke_arn
        function_name = module.lambda_save_draft.function_name
      }
    }
    create_version = {
      resource_id = module.versions_resource.id
      http_method = "POST"
      route_path  = "workspaces/{workspaceId}/projects/{projectId}/versions"
      lambda = {
        invoke_arn    = module.lambda_create_version.invoke_arn
        function_name = module.lambda_create_version.function_name
      }
    }
    list_versions = {
      resource_id = module.versions_resource.id
      http_method = "GET"
      route_path  = "workspaces/{workspaceId}/projects/{projectId}/versions"
      lambda = {
        invoke_arn    = module.lambda_list_versions.invoke_arn
        function_name = module.lambda_list_versions.function_name
      }
    }
    get_version = {
      resource_id = module.version_number_resource.id
      http_method = "GET"
      route_path  = "workspaces/{workspaceId}/projects/{projectId}/versions/{number}"
      lambda = {
        invoke_arn    = module.lambda_get_version.invoke_arn
        function_name = module.lambda_get_version.function_name
      }
    }
  }
}
