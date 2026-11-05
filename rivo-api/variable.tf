data "aws_region" "current" {}

locals {
  api_base_url = "https://${module.rest_api.id}.execute-api.${data.aws_region.current.region}.amazonaws.com/${var.environment}"
}

output "api_base_url" {
  description = "URL base de la API, sin path"
  value       = local.api_base_url
}

output "endpoints" {
  description = "Método y URL completa de cada endpoint registrado"
  value = {
    for key, route in local.routes :
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