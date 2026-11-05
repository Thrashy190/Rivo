resource "aws_cognito_user_pool" "this" {
  name = "rivo-users-${var.environment}"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }

  # Sin signup público: un usuario entra solo si alguien con users:manage
  # lo crea vía POST /users (AdminCreateUser), que es lo que hace que el
  # admin sea el que reparte accesos.
  admin_create_user_config {
    allow_admin_create_user_only = true
  }
}

resource "aws_cognito_user_pool_client" "app" {
  name         = "rivo-app-client"
  user_pool_id = aws_cognito_user_pool.this.id

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  generate_secret        = false
  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # Que el login no delate si un email existe o no.
  prevent_user_existence_errors = "ENABLED"
}

# Admin inicial del deploy: como el signup está cerrado, sin este usuario
# no habría forma de entrar al sistema recién instalado. Cognito le manda
# la password temporal por mail y su primer login pasa por el challenge
# NEW_PASSWORD_REQUIRED (POST /auth/new-password).
resource "aws_cognito_user" "admin" {
  user_pool_id = aws_cognito_user_pool.this.id
  username     = var.admin_email

  desired_delivery_mediums = ["EMAIL"]

  attributes = {
    email          = var.admin_email
    email_verified = "true"
  }
}
