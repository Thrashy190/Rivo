output "user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "app_client_id" {
  value = aws_cognito_user_pool_client.app.id
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.this.arn
}

# The admin's sub is the key used to seed their row in the users table
# (it is what arrives in the token claims).
output "admin_sub" {
  value = aws_cognito_user.admin.sub
}
