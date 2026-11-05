module "routes" {
  source   = "./api-method"
  for_each = var.routes

  rest_api_id          = var.rest_api_id
  resource_id          = each.value.resource_id
  http_method          = each.value.http_method
  route_path           = each.value.route_path
  lambda_invoke_arn    = each.value.lambda.invoke_arn
  lambda_function_name = each.value.lambda.function_name
  api_execution_arn    = var.api_execution_arn
}

resource "aws_api_gateway_deployment" "this" {
  rest_api_id = var.rest_api_id

  triggers = {
    redeployment = sha1(jsonencode({
      routes  = var.routes
      methods = [for r in module.routes : r.method_id]
    }))
  }

  depends_on = [module.routes]

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "this" {
  rest_api_id   = var.rest_api_id
  deployment_id = aws_api_gateway_deployment.this.id
  stage_name    = var.environment
}