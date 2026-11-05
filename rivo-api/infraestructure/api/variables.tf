variable "rest_api_id" {
  type        = string
  description = "ID de la REST API ya creada"
}

variable "api_execution_arn" {
  type        = string
  description = "execution_arn de la REST API"
}

variable "routes" {
  description = "Mapa de rutas a conectar: resource_id, http_method, route_path y datos de la lambda destino"

  type = map(object({
    resource_id = string
    http_method = string
    route_path  = string
    lambda = object({
      invoke_arn    = string
      function_name = string
    })
  }))
}

variable "environment" {
  type        = string
  description = "Environment"
}

variable "project_name" {
  type        = string
  description = "Project name for tagging"
}