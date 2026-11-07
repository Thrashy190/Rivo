variable "bucket_name" {
  type        = string
  description = "Globally unique name of the bucket"
}

variable "project_name" {
  type        = string
  description = "Project name for tagging"
}

variable "environment" {
  type        = string
  description = "Environment"
}

variable "noncurrent_days" {
  type        = number
  default     = 30
  description = "Days to keep overwritten and deleted copies of an object"
}
