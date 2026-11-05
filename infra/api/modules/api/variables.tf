variable "rest_api_id" {
  type        = string
  description = "ID de la REST API ya creada"
}

variable "api_execution_arn" {
  type        = string
  description = "execution_arn de la REST API"
}

variable "routes" {
  description = "Mapa de rutas a conectar: resource_id, http_method, route_path y datos de la lambda destino. public = true deja la ruta sin authorizer (solo login y new-password, que corren antes de que exista un token)"

  type = map(object({
    resource_id = string
    http_method = string
    route_path  = string
    public      = optional(bool, false)
    lambda = object({
      invoke_arn    = string
      function_name = string
    })
  }))
}

variable "authorizer_id" {
  type        = string
  description = "ID del authorizer de Cognito que protege las rutas no públicas"
}

variable "environment" {
  type        = string
  description = "Environment"
}

variable "project_name" {
  type        = string
  description = "Project name for tagging"
}
