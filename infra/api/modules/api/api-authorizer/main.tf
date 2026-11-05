// Cognito authorizer: validates the JWT signature and expiry before the Lambda
// runs, so no handler has to verify tokens. Claims arrive in
// requestContext.authorizer.claims.
resource "aws_api_gateway_authorizer" "this" {
  name          = "${var.environment}-cognito-authorizer"
  type          = "COGNITO_USER_POOLS"
  rest_api_id   = var.rest_api_id
  provider_arns = [var.user_pool_arn]
}
