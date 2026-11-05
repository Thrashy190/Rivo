variable "rest_api_id" {
  type        = string
  description = "ID of the REST API"
}

variable "resource_id" {
  type        = string
  description = "ID of the resource (path) this method hangs from"
}

variable "http_method" {
  type        = string
  description = "GET, POST, DELETE, ANY, etc."
}

variable "route_path" {
  type        = string
  description = "Full path from the root, without a leading slash, such as \"projects/{id}\". Used for the permission source_arn."
}

variable "lambda_invoke_arn" {
  type        = string
  description = "invoke_arn of the target Lambda"
}

variable "lambda_function_name" {
  type        = string
  description = "Name of the target Lambda"
}

variable "api_execution_arn" {
  type        = string
  description = "execution_arn of the REST API"
}

variable "authorization" {
  type    = string
  default = "NONE"
}

variable "authorizer_id" {
  type    = string
  default = null
}