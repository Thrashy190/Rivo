# ── S3 bucket (private) ───────────────────────────────────────────────────────

data "aws_caller_identity" "current" {}

module "s3_frontend" {
  source      = "./modules/s3"
  environment = var.environment
  # Bucket names are global, so the account ID keeps them unique.
  bucket_name = "frontend-${data.aws_caller_identity.current.account_id}"
}

# ── CloudFront distribution ───────────────────────────────────────────────────

module "cloudfront_frontend" {
  source = "./modules/cloudfront"

  environment                    = var.environment
  s3_bucket_id                   = module.s3_frontend.bucket_id
  s3_bucket_arn                  = module.s3_frontend.bucket_arn
  s3_bucket_regional_domain_name = module.s3_frontend.bucket_regional_domain_name

  price_class         = var.price_class
  aliases             = var.domain_aliases
  acm_certificate_arn = var.acm_certificate_arn
}
