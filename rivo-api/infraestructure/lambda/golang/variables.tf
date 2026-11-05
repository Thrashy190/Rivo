variable "statement" {
  type = list(object({
    Effect   = string
    Action   = list(string)
    Resource = string
  }))
  description = "Additional IAM policy statements for the Lambda"
  default     = []
}

variable "project_name" {
  type        = string
  description = "Project name for tagging"
}

variable "function_name" {
  type        = string
  description = "Name of the Lambda function (environment prefix will be added)"
}

variable "path_directory_file" {
  type        = string
  description = "Path to the Lambda source file"
}

variable "memory_size" {
  type        = number
  default     = 128
  description = "Memory in MB"
}

variable "timeout" {
  type        = number
  default     = 30
  description = "Timeout in seconds"
}

variable "environment" {
  type        = string
  description = "Environment"
}

variable "environment_variables" {
  description = "Variables de entorno a inyectar en la Lambda"
  type        = map(string)
  default     = {}
}