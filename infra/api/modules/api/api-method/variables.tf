variable "rest_api_id" {
  type        = string
  description = "ID de la REST API"
}

variable "resource_id" {
  type        = string
  description = "ID del resource (path) al que se cuelga este método"
}

variable "http_method" {
  type        = string
  description = "GET, POST, DELETE, ANY, etc."
}

variable "route_path" {
  type        = string
  description = "Path completo desde la raíz, sin slash inicial, ej. \"projects/{id}\". Se usa para el source_arn del permission."
}

variable "lambda_invoke_arn" {
  type        = string
  description = "invoke_arn de la Lambda destino"
}

variable "lambda_function_name" {
  type        = string
  description = "Nombre de la Lambda destino"
}

variable "api_execution_arn" {
  type        = string
  description = "execution_arn de la REST API"
}

variable "authorization" {
  type    = string
  default = "NONE"
}

variable "authorizer_id" {
  type    = string
  default = null
}