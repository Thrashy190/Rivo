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
  description = "Email del usuario admin inicial. Cognito le manda la password temporal a esta dirección."
}
