# The deployment engine: a Fargate task that runs Terraform on what tfgen
# generates (services/engine). The API starts one per phase of a deployment
# with ecs:RunTask, passing only IDs. The task assumes the role of the
# connected account itself, with the external ID Rivo generated for it.

locals {
  engine_name  = "${lower(var.project_name)}-${var.environment}-engine"
  services_dir = "${path.root}/../../services"
  # Rivo's roles that may assume connected roles: the engine, and the Lambda
  # that verifies a connection. Their names are fixed, so they can be
  # written here without depending on the roles.
  engine_task_role_name = "${local.engine_name}-task"
  trusted_role_arns = [
    "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${local.engine_task_role_name}",
    "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${lower(var.project_name)}-${var.environment}-verify-connection-execution-role",
  ]

  # The image is rebuilt when the runner, shared code or the Dockerfile change.
  engine_sources = concat(
    [for f in fileset("${local.services_dir}/engine", "**") : "${local.services_dir}/engine/${f}"],
    [for f in fileset("${local.services_dir}/shared", "**/*.go") : "${local.services_dir}/shared/${f}" if !endswith(f, "_test.go")],
    ["${local.services_dir}/shared/go.mod", "${local.services_dir}/shared/go.sum"],
  )
  engine_tag = substr(sha1(join("", [for f in sort(local.engine_sources) : filemd5(f)])), 0, 16)
}

# -- Network --
# Public subnets and no NAT gateway, which would cost more than the engine.
# The task gets a public IP to reach AWS APIs; nothing can reach it.

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "engine" {
  cidr_block           = "10.42.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = local.engine_name, Project = var.project_name, Environment = var.environment }
}

# The default group allows traffic between members: take every rule away.
resource "aws_default_security_group" "engine" {
  vpc_id = aws_vpc.engine.id
  tags   = { Name = "${local.engine_name}-default", Project = var.project_name, Environment = var.environment }
}

resource "aws_internet_gateway" "engine" {
  vpc_id = aws_vpc.engine.id
  tags   = { Name = local.engine_name, Project = var.project_name, Environment = var.environment }
}

resource "aws_subnet" "engine" {
  count             = 2
  vpc_id            = aws_vpc.engine.id
  cidr_block        = cidrsubnet(aws_vpc.engine.cidr_block, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = { Name = "${local.engine_name}-${count.index}", Project = var.project_name, Environment = var.environment }
}

resource "aws_route_table" "engine" {
  vpc_id = aws_vpc.engine.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.engine.id
  }

  tags = { Name = local.engine_name, Project = var.project_name, Environment = var.environment }
}

resource "aws_route_table_association" "engine" {
  count          = 2
  subnet_id      = aws_subnet.engine[count.index].id
  route_table_id = aws_route_table.engine.id
}

resource "aws_security_group" "engine" {
  name        = local.engine_name
  description = "Deployment engine tasks: outbound HTTPS only"
  vpc_id      = aws_vpc.engine.id
  tags        = { Project = var.project_name, Environment = var.environment }
}

resource "aws_vpc_security_group_egress_rule" "engine_https" {
  security_group_id = aws_security_group.engine.id
  description       = "AWS APIs"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

# -- Image --

resource "aws_ecr_repository" "engine" {
  name                 = local.engine_name
  image_tag_mutability = "IMMUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Project = var.project_name, Environment = var.environment }
}

resource "aws_ecr_lifecycle_policy" "engine" {
  repository = aws_ecr_repository.engine.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 10 images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 10 }
      action       = { type = "expire" }
    }]
  })
}

# Built for arm64 with Docker on the machine that applies, like the Lambdas
# are built with Go. Tags never change, so a tag that exists is not pushed again.
resource "terraform_data" "engine_image" {
  triggers_replace = [local.engine_tag, aws_ecr_repository.engine.repository_url]

  provisioner "local-exec" {
    working_dir = local.services_dir
    command     = <<-EOT
      set -e
      if aws ecr describe-images --region ${data.aws_region.current.region} --repository-name ${aws_ecr_repository.engine.name} --image-ids imageTag=${local.engine_tag} >/dev/null 2>&1; then
        echo "Engine image ${local.engine_tag} is already pushed"
        exit 0
      fi
      aws ecr get-login-password --region ${data.aws_region.current.region} | docker login --username AWS --password-stdin ${split("/", aws_ecr_repository.engine.repository_url)[0]}
      docker buildx build --platform linux/arm64 --provenance=false -f engine/Dockerfile -t ${aws_ecr_repository.engine.repository_url}:${local.engine_tag} --push .
    EOT
  }
}

# -- ECS --

resource "aws_ecs_cluster" "engine" {
  name = local.engine_name
  tags = { Project = var.project_name, Environment = var.environment }
}

resource "aws_cloudwatch_log_group" "engine" {
  name              = "/${lower(var.project_name)}/${var.environment}/engine"
  retention_in_days = 30
  tags              = { Project = var.project_name, Environment = var.environment }
}

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

# Pulls the image and writes logs. It never sees the deployment.
resource "aws_iam_role" "engine_execution" {
  name               = "${local.engine_name}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
  tags               = { Project = var.project_name, Environment = var.environment }
}

resource "aws_iam_role_policy_attachment" "engine_execution" {
  role       = aws_iam_role.engine_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# What the runner itself can do: read and record its deployment, keep the
# projects' state, and assume connected roles, only with a Rivo external ID.
resource "aws_iam_role" "engine_task" {
  name               = local.engine_task_role_name
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
  tags               = { Project = var.project_name, Environment = var.environment }
}

data "aws_iam_policy_document" "engine_task" {
  statement {
    sid       = "Deployments"
    actions   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
    resources = [module.deployments_table.arn, module.projects_table.arn]
  }

  statement {
    sid       = "Usage"
    actions   = ["dynamodb:UpdateItem"]
    resources = [module.usage_table.arn]
  }

  statement {
    sid       = "Connections"
    actions   = ["dynamodb:GetItem"]
    resources = [module.connections_table.arn]
  }

  statement {
    sid       = "List"
    actions   = ["s3:ListBucket"]
    resources = [module.diagrams_bucket.arn]
  }

  statement {
    sid     = "DeploymentFiles"
    actions = ["s3:GetObject", "s3:PutObject"]
    resources = [
      "${module.diagrams_bucket.arn}/workspaces/*/projects/*/deployments/*",
    ]
  }

  statement {
    sid       = "Packages"
    actions   = ["s3:GetObject"]
    resources = ["${module.diagrams_bucket.arn}/workspaces/*/projects/*/packages/*"]
  }

  # The state and its lock file (use_lockfile), next to each other.
  statement {
    sid       = "State"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${module.diagrams_bucket.arn}/workspaces/*/projects/*/state/*"]
  }

  statement {
    sid       = "ConnectedAccounts"
    actions   = ["sts:AssumeRole"]
    resources = ["arn:aws:iam::*:role/*"]

    condition {
      test     = "StringLike"
      variable = "sts:ExternalId"
      values   = ["rivo-*"]
    }
  }
}

resource "aws_iam_role_policy" "engine_task" {
  name   = "engine"
  role   = aws_iam_role.engine_task.id
  policy = data.aws_iam_policy_document.engine_task.json
}

resource "aws_ecs_task_definition" "engine" {
  family                   = local.engine_name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 1024
  memory                   = 2048
  execution_role_arn       = aws_iam_role.engine_execution.arn
  task_role_arn            = aws_iam_role.engine_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  # The image is read-only; Terraform works in this scratch volume.
  volume {
    name = "work"
  }

  container_definitions = jsonencode([{
    name                   = "runner"
    image                  = "${aws_ecr_repository.engine.repository_url}:${local.engine_tag}"
    essential              = true
    readonlyRootFilesystem = true
    stopTimeout            = 120
    mountPoints            = [{ sourceVolume = "work", containerPath = "/tmp" }]
    environment = [
      { name = "AWS_REGION", value = data.aws_region.current.region },
      { name = "DEPLOYMENTS_TABLE_NAME", value = module.deployments_table.name },
      { name = "USAGE_TABLE_NAME", value = module.usage_table.name },
      { name = "PROJECTS_TABLE_NAME", value = module.projects_table.name },
      { name = "CONNECTIONS_TABLE_NAME", value = module.connections_table.name },
      { name = "DIAGRAMS_BUCKET", value = module.diagrams_bucket.name },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.engine.name
        awslogs-region        = data.aws_region.current.region
        awslogs-stream-prefix = "runner"
      }
    }
  }])

  tags       = { Project = var.project_name, Environment = var.environment }
  depends_on = [terraform_data.engine_image]
}

locals {
  # Given to the Lambdas that start engine tasks.
  engine_environment = {
    ENGINE_CLUSTER         = aws_ecs_cluster.engine.arn
    ENGINE_TASK_DEFINITION = aws_ecs_task_definition.engine.arn_without_revision
    ENGINE_SUBNETS         = join(",", aws_subnet.engine[*].id)
    ENGINE_SECURITY_GROUP  = aws_security_group.engine.id
  }
  engine_statements = [
    {
      Effect    = "Allow"
      Action    = ["ecs:RunTask"]
      Resource  = "${aws_ecs_task_definition.engine.arn_without_revision}:*"
      Condition = { ArnEquals = { "ecs:cluster" = [aws_ecs_cluster.engine.arn] } }
    },
    {
      Effect   = "Allow"
      Action   = ["ecs:TagResource"]
      Resource = "arn:aws:ecs:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:task/${aws_ecs_cluster.engine.name}/*"
    },
    {
      Effect   = "Allow"
      Action   = ["iam:PassRole"]
      Resource = aws_iam_role.engine_task.arn
    },
    {
      Effect   = "Allow"
      Action   = ["iam:PassRole"]
      Resource = aws_iam_role.engine_execution.arn
    },
  ]
}

# -- Tasks that die --
# The runner records its own result. When a task stops before it could (out
# of memory, stopped by hand), this marks the deployment failed and frees
# its project.

module "lambda_task_stopped" {
  source              = "./modules/lambda/golang"
  function_name       = "task-stopped"
  path_directory_file = "deployment/task-stopped/main.go"
  project_name        = var.project_name
  environment         = var.environment

  environment_variables = {
    DEPLOYMENTS_TABLE_NAME = module.deployments_table.name
    PROJECTS_TABLE_NAME    = module.projects_table.name
  }

  statement = [
    {
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
      Resource = module.deployments_table.arn
    },
    {
      Effect   = "Allow"
      Action   = ["dynamodb:UpdateItem"]
      Resource = module.projects_table.arn
    },
  ]
}

resource "aws_cloudwatch_event_rule" "engine_task_stopped" {
  name        = "${local.engine_name}-task-stopped"
  description = "An engine task stopped"
  event_pattern = jsonencode({
    source      = ["aws.ecs"]
    detail-type = ["ECS Task State Change"]
    detail = {
      clusterArn = [aws_ecs_cluster.engine.arn]
      lastStatus = ["STOPPED"]
    }
  })
  tags = { Project = var.project_name, Environment = var.environment }
}

resource "aws_cloudwatch_event_target" "engine_task_stopped" {
  rule = aws_cloudwatch_event_rule.engine_task_stopped.name
  arn  = module.lambda_task_stopped.arn
}

resource "aws_lambda_permission" "engine_task_stopped" {
  statement_id  = "AllowEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_task_stopped.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.engine_task_stopped.arn
}

output "engine_image" {
  description = "Image the deployment engine runs"
  value       = "${aws_ecr_repository.engine.repository_url}:${local.engine_tag}"
}
