resource "aws_api_gateway_rest_api" "this" {
  name        = "${var.environment}-rivo-api"
  description = "Rivo control plane API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = { Project = var.project_name, Environment = var.environment }
}