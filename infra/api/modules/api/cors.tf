# CORS for the hosted web app. Lambdas add Access-Control-Allow-Origin to their
# own answers (see services/shared/transport/apigateway); this file covers what
# API Gateway answers without a Lambda: the preflight OPTIONS request the
# browser sends first, and errors such as the authorizer's 401 for an expired
# token. Nothing here exists while web_origin is empty.

locals {
  cors_enabled = var.web_origin != ""

  # One preflight per path, allowing the methods its routes define.
  cors_paths = local.cors_enabled ? {
    for path, routes in { for route in values(var.routes) : route.route_path => route... } :
    path => {
      resource_id = routes[0].resource_id
      methods     = join(",", distinct(concat([for route in routes : route.http_method], ["OPTIONS"])))
    }
  } : {}

  cors_allow_headers = "Authorization,Content-Type,If-Match,If-None-Match"
}

resource "aws_api_gateway_method" "preflight" {
  for_each = local.cors_paths

  rest_api_id   = var.rest_api_id
  resource_id   = each.value.resource_id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "preflight" {
  for_each = local.cors_paths

  rest_api_id       = var.rest_api_id
  resource_id       = each.value.resource_id
  http_method       = aws_api_gateway_method.preflight[each.key].http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "preflight" {
  for_each = local.cors_paths

  rest_api_id = var.rest_api_id
  resource_id = each.value.resource_id
  http_method = aws_api_gateway_method.preflight[each.key].http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Max-Age"       = true
  }
}

resource "aws_api_gateway_integration_response" "preflight" {
  for_each = local.cors_paths

  rest_api_id = var.rest_api_id
  resource_id = each.value.resource_id
  http_method = aws_api_gateway_method.preflight[each.key].http_method
  status_code = aws_api_gateway_method_response.preflight[each.key].status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'${var.web_origin}'"
    "method.response.header.Access-Control-Allow-Methods" = "'${each.value.methods}'"
    "method.response.header.Access-Control-Allow-Headers" = "'${local.cors_allow_headers}'"
    "method.response.header.Access-Control-Max-Age"       = "'600'"
  }

  depends_on = [aws_api_gateway_integration.preflight]
}

# Without these the browser hides API Gateway's own errors, so the web app could
# not tell an expired token (401) from a network failure.
resource "aws_api_gateway_gateway_response" "cors" {
  for_each = local.cors_enabled ? toset(["DEFAULT_4XX", "DEFAULT_5XX"]) : toset([])

  rest_api_id   = var.rest_api_id
  response_type = each.key

  response_parameters = {
    "gatewayresponse.header.Access-Control-Allow-Origin" = "'${var.web_origin}'"
  }
}
