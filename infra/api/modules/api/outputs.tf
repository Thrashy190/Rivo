output "stage_name" {
  value = aws_api_gateway_stage.this.stage_name
}

output "deployment_id" {
  value = aws_api_gateway_deployment.this.id
}