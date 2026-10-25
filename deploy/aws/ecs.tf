# ---------------------------------------------------------------------------
# Container registry and logs
# ---------------------------------------------------------------------------
resource "aws_ecr_repository" "app" {
  name                 = local.service_name
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = local.service_name }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last five images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.service_name}"
  retention_in_days = 7

  tags = { Name = local.service_name }
}

# ---------------------------------------------------------------------------
# Permissions: pull the image, write logs and read the SSM SecureStrings
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = substr("${local.service_name}-execution", 0, 64)
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json

  tags = { Name = local.service_name }
}

resource "aws_iam_role_policy_attachment" "execution_base" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    sid     = "ReadApplicationParameters"
    actions = ["ssm:GetParameter", "ssm:GetParameters"]

    resources = concat(
      [
        aws_ssm_parameter.db_password.arn,
        aws_ssm_parameter.jwt_secret.arn,
        aws_ssm_parameter.crypto_key.arn,
        aws_ssm_parameter.admin_password.arn,
      ],
      aws_ssm_parameter.smtp_password[*].arn,
      aws_ssm_parameter.payment_webhook_secret[*].arn,
    )
  }

  statement {
    sid     = "DecryptParameters"
    actions = ["kms:Decrypt"]

    # The SSM-managed key for this account and region, without needing to look
    # up the alias (which may not exist before the first SecureString).
    resources = ["arn:aws:kms:${var.aws_region}:${data.aws_caller_identity.current.account_id}:key/*"]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.aws_region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "read-ssm-parameters"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

# ---------------------------------------------------------------------------
# ECS cluster, task definition and service
# ---------------------------------------------------------------------------
resource "aws_ecs_cluster" "app" {
  name = local.service_name

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = { Name = local.service_name }
}

resource "aws_ecs_cluster_capacity_providers" "app" {
  cluster_name       = aws_ecs_cluster.app.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
}

resource "aws_ecs_task_definition" "app" {
  family                   = local.service_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(var.task_cpu)
  memory                   = tostring(var.task_memory)
  execution_role_arn       = aws_iam_role.execution.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.cpu_architecture
  }

  container_definitions = jsonencode([
    {
      name      = "app"
      image     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
      essential = true

      portMappings = [{
        containerPort = 8080
        hostPort      = 8080
        protocol      = "tcp"
      }]

      environment = [
        { name = "PORT", value = "8080" },
        { name = "SEED_DEMO", value = "true" },
        { name = "DB_URL", value = "jdbc:postgresql://${aws_db_instance.app.address}:${aws_db_instance.app.port}/${var.db_name}" },
        { name = "DB_USER", value = var.db_user },
        { name = "ADMIN_EMAIL", value = var.admin_email },
        { name = "ADMIN_NAME", value = var.admin_name },
        { name = "FRONTEND_URL", value = local.frontend_url },
        { name = "CORS_ORIGINS", value = local.cors_origins },
        { name = "MAIL_FROM", value = var.mail_from },
        { name = "SMTP_HOST", value = var.smtp_host },
        { name = "SMTP_PORT", value = tostring(var.smtp_port) },
        { name = "SMTP_USER", value = var.smtp_user },
      ]

      secrets = concat(
        [
          { name = "DB_PASSWORD", valueFrom = aws_ssm_parameter.db_password.arn },
          { name = "JWT_SECRET", valueFrom = aws_ssm_parameter.jwt_secret.arn },
          { name = "APP_CRYPTO_KEY", valueFrom = aws_ssm_parameter.crypto_key.arn },
          { name = "ADMIN_PASSWORD", valueFrom = aws_ssm_parameter.admin_password.arn },
        ],
        var.smtp_password == "" ? [] : [
          { name = "SMTP_PASSWORD", valueFrom = aws_ssm_parameter.smtp_password[0].arn },
        ],
        var.payment_webhook_secret == "" ? [] : [
          { name = "PAYMENT_WEBHOOK_SECRET", valueFrom = aws_ssm_parameter.payment_webhook_secret[0].arn },
        ],
      )

      linuxParameters = { initProcessEnabled = true }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.app.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "app"
        }
      }

      stopTimeout = 30
    }
  ])

  tags = { Name = local.service_name }
}

resource "aws_ecs_service" "app" {
  name            = local.service_name
  cluster         = aws_ecs_cluster.app.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count

  launch_type = var.use_fargate_spot ? null : "FARGATE"

  dynamic "capacity_provider_strategy" {
    for_each = var.use_fargate_spot ? [1] : []
    content {
      capacity_provider = "FARGATE_SPOT"
      weight            = 1
    }
  }

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 8080
  }

  # Spring Boot start plus Flyway migrations on a cold Spot task; the ALB needs
  # two 30-second passes after that before the task counts as healthy.
  health_check_grace_period_seconds = 180

  # Replace the task before adding the next one, so a deployment never runs two
  # 4 GB tasks at once (the default 200% would double compute for several minutes).
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_execute_command = false

  depends_on = [
    aws_ecs_cluster_capacity_providers.app,
    aws_iam_role_policy.execution_secrets,
    aws_lb_listener.http_forward,
    aws_lb_listener.http_redirect,
    aws_lb_listener.https,
    aws_db_instance.app,
  ]

  tags = { Name = local.service_name }
}
