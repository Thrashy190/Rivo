output "method_id" {
  value = aws_api_gateway_method.this.id
}

output "integration_id" {
  value = aws_api_gateway_integration.this.id
}