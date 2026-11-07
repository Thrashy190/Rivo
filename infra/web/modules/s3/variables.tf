variable "environment" {
  type        = string
  description = "Deployment environment"
}

variable "bucket_name" {
  type        = string
  description = "Bucket name suffix. The bucket is named rivo-<environment>-<suffix>."
}
