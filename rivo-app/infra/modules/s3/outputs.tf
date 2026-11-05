output "bucket_id" {
  value       = aws_s3_bucket.this.id
  description = "Bucket name (used for uploads and bucket policy)"
}

output "bucket_arn" {
  value       = aws_s3_bucket.this.arn
  description = "Bucket ARN"
}

output "bucket_regional_domain_name" {
  value       = aws_s3_bucket.this.bucket_regional_domain_name
  description = "Regional domain (used as CloudFront S3 origin)"
}
