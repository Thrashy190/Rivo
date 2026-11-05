resource "aws_dynamodb_table" "this" {
  name         = "${var.environment}-${var.table_name}"
  billing_mode = var.billing_mode
  hash_key     = var.hash_key
  range_key    = var.range_key

  dynamic "attribute" {
    for_each = var.attributes
    content {
      name = attribute.value.name
      type = attribute.value.type
    }
  }

  point_in_time_recovery {
    enabled = var.point_in_time_recovery
  }

  tags = { Project = var.project_name, Environment = var.environment }
}
