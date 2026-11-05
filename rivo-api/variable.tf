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

# Sin signup público, el admin inicial es la única puerta de entrada al
# sistema recién instalado, así que esto es obligatorio y tiene que ser un
# mail real: ahí llega la password temporal.
variable "admin_email" {
  type        = string
  description = "Email del usuario admin inicial"

  validation {
    condition     = can(regex("^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$", var.admin_email)) && var.admin_email != "CHANGE_ME@example.com"
    error_message = "admin_email tiene que ser un email real (editá environments/<env>/<env>.tfvars): ahí llega la password temporal del admin inicial."
  }
}