output "user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "app_client_id" {
  value = aws_cognito_user_pool_client.app.id
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.this.arn
}

# El sub del admin es la clave con la que se siembra su fila en la tabla
# users (es lo que llega en los claims del token).
output "admin_sub" {
  value = aws_cognito_user.admin.sub
}
