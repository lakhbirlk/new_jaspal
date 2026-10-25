locals {
  service_name = "${var.name}-${var.environment}"
  ssm_prefix   = "/${var.name}/${var.environment}"

  scheme         = var.acm_certificate_arn == "" ? "http" : "https"
  alb_url        = "${local.scheme}://${aws_lb.app.dns_name}"
  cloudfront_url = "https://${aws_cloudfront_distribution.app.domain_name}"

  # Browsers reach the app through CloudFront, so email links use it and both
  # origins may call the API: a page loaded from the ALB still sends the ALB
  # origin, and CloudFront-tunnelled requests send the CloudFront origin.
  frontend_url = var.frontend_url != "" ? var.frontend_url : local.cloudfront_url
  cors_origins = var.cors_origins != "" ? var.cors_origins : "${local.cloudfront_url},${local.alb_url}"
}

data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

# ---------------------------------------------------------------------------
# Network: two public subnets, no NAT gateway (the largest avoidable cost).
# Fargate tasks get public IPs to pull images; RDS stays unreachable from the
# internet because its security group only accepts traffic from the tasks.
# ---------------------------------------------------------------------------
resource "aws_vpc" "app" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = local.service_name }
}

resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.app.id
  cidr_block              = cidrsubnet(aws_vpc.app.cidr_block, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${local.service_name}-public-${count.index + 1}" }
}

resource "aws_internet_gateway" "app" {
  vpc_id = aws_vpc.app.id

  tags = { Name = local.service_name }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.app.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.app.id
  }

  tags = { Name = "${local.service_name}-public" }
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ---------------------------------------------------------------------------
# Security groups
# ---------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name_prefix = "${local.service_name}-alb-"
  description = "Public HTTP(S) access to the load balancer"
  vpc_id      = aws_vpc.app.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  dynamic "ingress" {
    for_each = var.acm_certificate_arn == "" ? [] : [1]
    content {
      description = "HTTPS"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${local.service_name}-alb" }
}

resource "aws_security_group" "app" {
  name_prefix = "${local.service_name}-app-"
  description = "Application tasks"
  vpc_id      = aws_vpc.app.id

  egress {
    description = "ECR, CloudWatch, SMTP and RDS"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${local.service_name}-app" }
}

resource "aws_security_group" "db" {
  name_prefix = "${local.service_name}-db-"
  description = "PostgreSQL, reachable only from the application tasks"
  vpc_id      = aws_vpc.app.id

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${local.service_name}-db" }
}

# Cross-group rules are separate resources so the security groups themselves do
# not reference each other in a cycle.
resource "aws_vpc_security_group_egress_rule" "alb_to_app" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward to the application tasks"
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.app.id
}

resource "aws_vpc_security_group_ingress_rule" "app_from_alb" {
  security_group_id            = aws_security_group.app.id
  description                  = "HTTP from the load balancer"
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL from application tasks"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.app.id
}

# ---------------------------------------------------------------------------
# Load balancer
# ---------------------------------------------------------------------------
resource "aws_lb" "app" {
  name               = substr("${local.service_name}-alb", 0, 32)
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  idle_timeout               = 60
  enable_deletion_protection = false

  tags = { Name = local.service_name }
}

resource "aws_lb_target_group" "app" {
  name        = substr("${local.service_name}-tg", 0, 32)
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.app.id
  target_type = "ip"

  deregistration_delay = 15

  health_check {
    enabled = true
    # A public endpoint that queries the database, so a task with a broken
    # database connection is reported unhealthy instead of only serving the SPA.
    path                = "/api/v1/public/plans"
    port                = "traffic-port"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = { Name = local.service_name }
}

resource "aws_lb_listener" "http_forward" {
  count = var.acm_certificate_arn == "" ? 1 : 0

  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  tags = { Name = "${local.service_name}-http" }
}

resource "aws_lb_listener" "http_redirect" {
  count = var.acm_certificate_arn == "" ? 0 : 1

  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = { Name = "${local.service_name}-http-redirect" }
}

resource "aws_lb_listener" "https" {
  count = var.acm_certificate_arn == "" ? 0 : 1

  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  tags = { Name = "${local.service_name}-https" }
}

# ---------------------------------------------------------------------------
# PostgreSQL (single-AZ, smallest Graviton instance, encrypted)
# ---------------------------------------------------------------------------
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "app" {
  name       = local.service_name
  subnet_ids = aws_subnet.public[*].id

  tags = { Name = local.service_name }
}

resource "aws_db_instance" "app" {
  identifier = substr("${local.service_name}-db", 0, 63)

  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  max_allocated_storage = 0

  db_name  = var.db_name
  username = var.db_user
  password = random_password.db.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.app.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = var.db_backup_retention_days
  backup_window           = "03:00-04:00"

  auto_minor_version_upgrade = true
  apply_immediately          = false

  performance_insights_enabled = false
  deletion_protection          = var.db_deletion_protection
  skip_final_snapshot          = var.db_skip_final_snapshot
  final_snapshot_identifier    = var.db_skip_final_snapshot ? null : "${local.service_name}-db-final"

  tags = { Name = local.service_name }
}

# ---------------------------------------------------------------------------
# Secrets. SSM SecureString standard parameters are free; the ECS execution
# role reads them at task start, so no secret is stored in the task definition.
# ---------------------------------------------------------------------------
resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "random_password" "crypto" {
  length  = 32
  special = false
}

resource "aws_ssm_parameter" "db_password" {
  name  = "${local.ssm_prefix}/db-password"
  type  = "SecureString"
  value = random_password.db.result
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "${local.ssm_prefix}/jwt-secret"
  type  = "SecureString"
  value = random_password.jwt.result
}

resource "aws_ssm_parameter" "crypto_key" {
  name  = "${local.ssm_prefix}/crypto-key"
  type  = "SecureString"
  value = base64encode(random_password.crypto.result)
}

resource "aws_ssm_parameter" "admin_password" {
  name  = "${local.ssm_prefix}/admin-password"
  type  = "SecureString"
  value = var.admin_password
}

resource "aws_ssm_parameter" "smtp_password" {
  count = var.smtp_password == "" ? 0 : 1

  name  = "${local.ssm_prefix}/smtp-password"
  type  = "SecureString"
  value = var.smtp_password
}

resource "aws_ssm_parameter" "payment_webhook_secret" {
  count = var.payment_webhook_secret == "" ? 0 : 1

  name  = "${local.ssm_prefix}/payment-webhook-secret"
  type  = "SecureString"
  value = var.payment_webhook_secret
}
