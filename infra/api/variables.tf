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
    for key, route in merge(local.routes, local.workspace_routes, local.project_routes, local.package_routes, local.export_routes, local.connection_routes, local.deployment_routes) :
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
# The browser only lets the web app read the API's answers when they name its
# origin. Leave it empty until the web app is hosted: local development goes
# through the Vite proxy, which needs no CORS.
variable "web_origin" {
  type        = string
  description = "Origin of the hosted web app, such as https://d1234abcd.cloudfront.net, with no path or trailing slash"
  default     = ""

  validation {
    condition     = var.web_origin == "" || can(regex("^https?://[^/[:space:]]+$", var.web_origin))
    error_message = "web_origin must look like https://d1234abcd.cloudfront.net, with no path or trailing slash, or be empty."
  }
}

# npm run dev sends API calls through the Vite proxy, but Lambda packages go
# from the browser straight to S3, which must allow this origin too.
variable "dev_web_origin" {
  type        = string
  description = "Origin of the local development server, allowed to upload Lambda packages. Set it to an empty string to allow only web_origin."
  default     = "http://localhost:5173"

  validation {
    condition     = var.dev_web_origin == "" || can(regex("^https?://[^/[:space:]]+$", var.dev_web_origin))
    error_message = "dev_web_origin must look like http://localhost:5173, with no path or trailing slash, or be empty."
  }
}
