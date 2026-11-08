module refresh

go 1.27.1

replace github.com/Thrashy190/Rivo/services/shared => ../../shared

require (
	github.com/Thrashy190/Rivo/services/shared v0.0.0-00010101000000-000000000000
	github.com/aws/aws-lambda-go v1.55.1
	github.com/aws/aws-sdk-go-v2 v1.47.8
	github.com/aws/aws-sdk-go-v2/config v1.33.9
	github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider v1.75.3
)

require (
	github.com/aws/aws-sdk-go-v2/credentials v1.20.14 // indirect
	github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.20.6 // indirect
	github.com/aws/aws-sdk-go-v2/internal/configsources v1.5.11 // indirect
	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.8.11 // indirect
	github.com/aws/aws-sdk-go-v2/internal/v4a v1.5.11 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.24 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.14.11 // indirect
	github.com/aws/aws-sdk-go-v2/service/signin v1.12.2 // indirect
	github.com/aws/aws-sdk-go-v2/service/sso v1.39.2 // indirect
	github.com/aws/aws-sdk-go-v2/service/ssooidc v1.44.2 // indirect
	github.com/aws/aws-sdk-go-v2/service/sts v1.51.7 // indirect
	github.com/aws/smithy-go v1.28.8 // indirect
)
