project_name = "Rivo"

# Initial admin: Cognito emails the temporary password to this address.
# Change it to your real email before the first apply.
admin_email = "CHANGE_ME@example.com"

# Origin of the hosted web app, so the browser can read the API's answers.
# Set it once infra/web is deployed (terraform -chdir=../web output cloudfront_domain).
# web_origin = "https://d1234abcd.cloudfront.net"
