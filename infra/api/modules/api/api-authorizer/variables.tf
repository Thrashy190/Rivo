variable "rest_api_id" {
  type        = string
  description = "ID of the REST API the authorizer attaches to"
}

variable "user_pool_arn" {
  type        = string
  description = "ARN of the Cognito user pool that validates tokens"
}

variable "environment" {
  type        = string
  description = "Environment"
}
