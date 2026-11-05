variable "environment" {
  type        = string
  description = "Deployment environment"
}

variable "bucket_name" {
  type        = string
  description = "Bucket name suffix (environment prefix is prepended automatically)"
}
