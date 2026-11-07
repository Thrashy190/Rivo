variable "rest_api_id" {
  type        = string
  description = "ID of the existing REST API"
}

variable "api_execution_arn" {
  type        = string
  description = "execution_arn of the REST API"
}

variable "routes" {
  description = "Routes to connect: resource_id, http_method, route_path and target Lambda details. public = true leaves the route without an authorizer (only the auth routes, which run before a valid token exists)"

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
  description = "ID of the Cognito authorizer protecting non-public routes"
}

variable "environment" {
  type        = string
  description = "Environment"
}

variable "project_name" {
  type        = string
  description = "Project name for tagging"
}

variable "web_origin" {
  type        = string
  description = "Origin of the hosted web app for CORS. Empty creates no CORS resources."
  default     = ""
}
