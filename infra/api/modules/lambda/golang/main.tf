data "aws_iam_policy_document" "name" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "lambda_execution_role" {
  name               = "${local.name}-execution-role"
  assume_role_policy = data.aws_iam_policy_document.name.json
  tags               = { Project = var.project_name }
}


resource "aws_iam_role_policy" "lambda_execution_role" {
  name = "${local.name}-execution-policy"
  role = aws_iam_role.lambda_execution_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Effect = "Allow"
          Action = [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ]
          Resource = "*"
        }
      ],
      # IAM rejects "Condition": null, so it is only added when set.
      [for st in var.statement : merge(
        { Effect = st.Effect, Action = st.Action, Resource = st.Resource },
        st.Condition == null ? {} : { Condition = st.Condition },
      )]
    )
  })
}

locals {
  services_dir = "${path.root}/../../services"

  # rivo-<environment>-<function>, so installations and environments can share
  # an account without clashing.
  name = "${lower(var.project_name)}-${var.environment}-${var.function_name}"

  environment_variables = merge(
    var.environment_variables,
    var.cors_allow_origin == "" ? {} : { CORS_ALLOW_ORIGIN = var.cors_allow_origin },
  )
}

resource "null_resource" "go_lambda_build" {
  triggers = {
    source_code = sha1(join("", concat(
      [for f in fileset("${local.services_dir}/${dirname(var.path_directory_file)}", "**/*.go") :
      filemd5("${local.services_dir}/${dirname(var.path_directory_file)}/${f}")],
      [for f in fileset("${local.services_dir}/shared", "**/*.go") :
      filemd5("${local.services_dir}/shared/${f}")]
    )))
  }

  provisioner "local-exec" {
    command = <<EOT
      cd ${local.services_dir}/${dirname(var.path_directory_file)}

      if [ ! -f go.mod ]; then
        go mod init ${var.function_name}
      fi

      go mod tidy

      GOOS=linux \
      GOARCH=arm64 \
      CGO_ENABLED=0 \
      go build -ldflags="-s -w" -o bootstrap .
    EOT
  }
}

data "archive_file" "build_lambda" {
  type        = "zip"
  source_file = "${local.services_dir}/${dirname(var.path_directory_file)}/bootstrap"
  output_path = "${local.services_dir}/build/${var.function_name}.zip"
  depends_on = [
    null_resource.go_lambda_build
  ]
}

resource "aws_lambda_function" "this" {
  function_name    = local.name
  role             = aws_iam_role.lambda_execution_role.arn
  runtime          = "provided.al2023"
  architectures    = ["arm64"]
  handler          = "bootstrap"
  memory_size      = var.memory_size
  timeout          = var.timeout
  filename         = data.archive_file.build_lambda.output_path
  source_code_hash = data.archive_file.build_lambda.output_base64sha256

  dynamic "environment" {
    for_each = length(local.environment_variables) > 0 ? [1] : []
    content {
      variables = local.environment_variables
    }
  }

  tags = { Project = var.project_name, Environment = var.environment }
}