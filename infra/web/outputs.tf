output "bucket_name" {
  value       = module.s3_frontend.bucket_id
  description = "S3 bucket — upload dist/ here after every build"
}

output "cloudfront_domain" {
  value       = module.cloudfront_frontend.domain_name
  description = "Public URL of the rivo-app frontend (e.g. d1234abcd.cloudfront.net)"
}

output "cloudfront_distribution_id" {
  value       = module.cloudfront_frontend.distribution_id
  description = "Distribution ID — pass to `make invalidate` after each deploy to clear the CDN cache"
}
