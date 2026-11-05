variable "environment" {
  type        = string
  description = "Deployment environment (dev | prod)"
}

variable "domain_aliases" {
  type        = list(string)
  default     = []
  description = "Custom domain aliases for CloudFront (e.g. [\"rivo.example.com\"]). Leave empty to use the default *.cloudfront.net domain."
}

variable "acm_certificate_arn" {
  type        = string
  default     = null
  description = "ARN of an ACM certificate in us-east-1 for custom domains. Required only when domain_aliases is non-empty."
}

variable "price_class" {
  type        = string
  default     = "PriceClass_100"
  description = "CloudFront price class. PriceClass_100 = US + Europe (cheapest), PriceClass_200 = + Asia/ME/Africa, PriceClass_All = all edge locations."
}
