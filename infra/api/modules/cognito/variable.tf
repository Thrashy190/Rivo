variable "project_name" {
  type        = string
  description = "Project name for tagging"
}

variable "environment" {
  type        = string
  description = "Environment"
}

variable "admin_email" {
  type        = string
  description = "Email of the initial admin user. Cognito sends the temporary password to this address."
}
