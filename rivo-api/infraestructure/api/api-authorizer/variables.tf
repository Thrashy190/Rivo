variable "rest_api_id" {
  type        = string
  description = "ID de la REST API a la que se engancha el authorizer"
}

variable "user_pool_arn" {
  type        = string
  description = "ARN del user pool de Cognito que valida los tokens"
}

variable "environment" {
  type        = string
  description = "Environment"
}
