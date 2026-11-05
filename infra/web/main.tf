# ── S3 bucket (private) ───────────────────────────────────────────────────────

module "s3_frontend" {
  source      = "./modules/s3"
  environment = var.environment
  bucket_name = "rivo-frontend"
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
