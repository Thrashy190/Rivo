resource "aws_s3_bucket" "this" {
  bucket = "${var.environment}-${var.bucket_name}"
}

# Block all public access — CloudFront reads objects via OAC (IAM), not public URLs.
resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = false # Must be false so CloudFront OAC bucket policy can be applied
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket versioning disabled — frontend builds are replaced, not versioned.
resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration { status = "Disabled" }
}
