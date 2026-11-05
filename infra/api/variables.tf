data "aws_region" "current" {}

locals {
  api_base_url = "https://${module.rest_api.id}.execute-api.${data.aws_region.current.region}.amazonaws.com/${var.environment}"
}

output "api_base_url" {
  description = "Base URL of the API, without a path"
  value       = local.api_base_url
}

output "endpoints" {
  description = "Method and full URL of every registered endpoint"
  value = {
    for key, route in merge(local.routes, local.workspace_routes) :
    key => "${route.http_method} ${local.api_base_url}/${route.route_path}"
  }
}

variable "project_name" {
  type        = string
  description = "Project name"
}

variable "environment" {
  type        = string
  description = "Environment"
}

# With no public signup, the initial admin is the only way into a fresh
# installation, so this is required and must be a real email address: the
# temporary password is sent there.
variable "admin_email" {
  type        = string
  description = "Email of the initial admin user"

  validation {
    condition     = can(regex("^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$", var.admin_email)) && var.admin_email != "CHANGE_ME@example.com"
    error_message = "admin_email must be a real email address (edit environments/<env>/<env>.tfvars): the temporary password for the initial admin is sent there."
  }
}