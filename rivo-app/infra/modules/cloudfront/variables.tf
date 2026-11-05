variable "environment" {
  type = string
}

variable "s3_bucket_id" {
  type        = string
  description = "S3 bucket ID (bucket name)"
}

variable "s3_bucket_arn" {
  type        = string
  description = "S3 bucket ARN"
}

variable "s3_bucket_regional_domain_name" {
  type        = string
  description = "S3 regional domain name — used as CloudFront origin"
}

variable "price_class" {
  type    = string
  default = "PriceClass_100"
}

variable "aliases" {
  type    = list(string)
  default = []
}

variable "acm_certificate_arn" {
  type    = string
  default = null
}
