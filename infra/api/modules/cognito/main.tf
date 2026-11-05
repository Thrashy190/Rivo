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

  # No public signup: a user only gets in if someone with users:manage
  # creates them through POST /users (AdminCreateUser), which is what makes the
  # admin the one who hands out access.
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

# Initial admin of the deployment: signup is closed, so without this user
# there would be no way into a fresh installation. Cognito emails them the
# temporary password, and their first login goes through the
# NEW_PASSWORD_REQUIRED challenge (POST /auth/new-password).
resource "aws_cognito_user" "admin" {
  user_pool_id = aws_cognito_user_pool.this.id
  username     = var.admin_email

  desired_delivery_mediums = ["EMAIL"]

  attributes = {
    email          = var.admin_email
    email_verified = "true"
  }
}
