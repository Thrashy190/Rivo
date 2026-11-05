// Authorizer de Cognito: valida la firma y la expiración del JWT antes de
// que la lambda corra, así ningún handler tiene que verificar tokens. Los
// claims llegan en requestContext.authorizer.claims.
resource "aws_api_gateway_authorizer" "this" {
  name          = "${var.environment}-cognito-authorizer"
  type          = "COGNITO_USER_POOLS"
  rest_api_id   = var.rest_api_id
  provider_arns = [var.user_pool_arn]
}
