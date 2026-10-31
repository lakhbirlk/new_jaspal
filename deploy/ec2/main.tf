locals {
  service_name = "${var.name}-${var.environment}"

  # sslip.io resolves <ip-with-dashes>.sslip.io to that IP, so Caddy can get a
  # publicly trusted certificate without owning a domain. Override with
  # https_domain to use your own name instead.
  sslip_host = "${replace(aws_eip.app.public_ip, ".", "-")}.sslip.io"
  https_host = var.https_domain != "" ? var.https_domain : local.sslip_host
  https_url  = "https://${local.https_host}"
}

data "aws_availability_zones" "available" {
  state = "available"
}

# ---------------------------------------------------------------------------
# Network: one public subnet with an internet gateway. No NAT, no ALB.
# ---------------------------------------------------------------------------
resource "aws_vpc" "app" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = local.service_name }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.app.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = { Name = "${local.service_name}-public" }
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
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "app" {
  name_prefix = "${local.service_name}-"
  description = "Application host: HTTP/HTTPS and the app port"
  vpc_id      = aws_vpc.app.id

  ingress {
    description = "Application port"
    from_port   = var.app_port
    to_port     = var.app_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP (reverse proxy)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS (reverse proxy)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  dynamic "ingress" {
    for_each = var.ssh_cidr == "" ? [] : [1]
    content {
      description = "SSH"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = [var.ssh_cidr]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = local.service_name }

  lifecycle {
    create_before_destroy = true
  }
}

# ---------------------------------------------------------------------------
# Instance profile: SSM Session Manager replaces inbound SSH.
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = substr("${local.service_name}-ec2", 0, 64)
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json

  tags = { Name = local.service_name }
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "app" {
  name = substr("${local.service_name}-ec2", 0, 64)
  role = aws_iam_role.app.name
}

# ---------------------------------------------------------------------------
# Secrets. Generated per deployment; injected into the boot script.
# Note: user_data is readable from the instance metadata and the EC2 console.
# ---------------------------------------------------------------------------
resource "random_password" "db" {
  length  = 24
  special = false
}

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "random_bytes" "crypto" {
  length = 32
}

resource "random_password" "admin" {
  length  = 20
  special = false
}

# ---------------------------------------------------------------------------
# Elastic IP — allocated before the instance so the boot script can bake the
# public URL into FRONTEND_URL/CORS_ORIGINS. The association is a separate
# resource to avoid a dependency cycle with user_data.
# ---------------------------------------------------------------------------
resource "aws_eip" "app" {
  domain = "vpc"

  tags = { Name = local.service_name }
}

resource "aws_eip_association" "app" {
  allocation_id = aws_eip.app.id
  instance_id   = aws_instance.app.id
}

# ---------------------------------------------------------------------------
# The host
# ---------------------------------------------------------------------------
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-arm64"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name

  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    app_port     = var.app_port
    app_url      = local.https_url
    direct_url   = "http://${aws_eip.app.public_ip}:${var.app_port}"
    https_host   = local.https_host
    tls_email    = var.tls_email
    git_repo_url = var.git_repo_url
    git_branch   = var.git_branch

    db_name     = var.db_user
    db_user     = var.db_user
    db_password = random_password.db.result

    jwt_secret  = random_password.jwt.result
    crypto_key  = random_bytes.crypto.base64
    admin_email = var.admin_email
    admin_name  = var.admin_name
    admin_pass  = random_password.admin.result

    seed_demo    = var.seed_demo
    mysql_image  = var.mysql_image
  })

  root_block_device {
    volume_size = var.root_volume_size
    volume_type = "gp3"
    encrypted   = true
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  tags = { Name = local.service_name }

  # The boot script builds the image on ARM; Terraform returns as soon as the
  # instance is running, so the URL is not live yet. user_data changes must
  # replace the instance, because the script only runs on first boot.
  user_data_replace_on_change = true

  lifecycle {
    ignore_changes = [ami]
  }
}
