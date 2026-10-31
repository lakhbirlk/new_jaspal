variable "aws_region" {
  description = "AWS region for every resource."
  type        = string
  default     = "us-east-1"
}

variable "name" {
  description = "Short application name used to prefix resources. Lowercase letters, digits and hyphens, at most 20 characters."
  type        = string
  default     = "business-directory"

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]{0,18}[a-z0-9])?$", var.name))
    error_message = "Use lowercase letters, digits and hyphens, at most 20 characters."
  }
}

variable "environment" {
  description = "Deployment environment suffix, for example prod or staging."
  type        = string
  default     = "prod"

  validation {
    condition     = can(regex("^[a-z0-9-]{1,10}$", var.environment))
    error_message = "Use lowercase letters, digits and hyphens, at most 10 characters."
  }
}

variable "image_tag" {
  description = "Image tag to deploy from the ECR repository. Use an immutable tag (git SHA) in production."
  type        = string
  default     = "latest"
}

variable "task_cpu" {
  description = "Fargate CPU units. 1024 = 1 vCPU, 2048 = 2 vCPU."
  type        = number
  default     = 2048
}

variable "task_memory" {
  description = "Fargate task memory in MiB. 4096 is 4 GB; 2048 is the cheapest workable size."
  type        = number
  default     = 4096

  validation {
    condition     = var.task_memory >= 512 && var.task_memory <= 122880
    error_message = "Fargate memory must be between 512 and 122880 MiB."
  }
}

variable "cpu_architecture" {
  description = "Task CPU architecture. ARM64 is about 20% cheaper on Fargate but the pushed image must be built for linux/arm64."
  type        = string
  default     = "X86_64"

  validation {
    condition     = contains(["X86_64", "ARM64"], var.cpu_architecture)
    error_message = "Use X86_64 or ARM64."
  }
}

variable "use_fargate_spot" {
  description = "Run on Fargate Spot for the lowest compute cost. Spot tasks can be reclaimed and are rescheduled automatically."
  type        = bool
  default     = true
}

variable "desired_count" {
  description = "Number of running tasks. Keep 1 for minimum cost; use 2 for availability during Spot reclamation or deployments."
  type        = number
  default     = 1

  validation {
    condition     = var.desired_count >= 0 && var.desired_count <= 10
    error_message = "Use a count between 0 and 10."
  }
}

variable "db_name" {
  description = "MySQL database name."
  type        = string
  default     = "directory"
}

variable "db_user" {
  description = "MySQL master user name."
  type        = string
  default     = "directory"
}

variable "db_instance_class" {
  description = "RDS instance class. db.t4g.micro is the cheapest Graviton option."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "RDS storage in GiB (gp3). 20 GiB is the minimum."
  type        = number
  default     = 20
}

variable "db_backup_retention_days" {
  description = "Automated backup retention in days. 0 disables backups."
  type        = number
  default     = 7

  validation {
    condition     = var.db_backup_retention_days >= 0 && var.db_backup_retention_days <= 35
    error_message = "Use a retention between 0 and 35 days."
  }
}

variable "db_deletion_protection" {
  description = "Protect the database from accidental deletion. Enable for production."
  type        = bool
  default     = false
}

variable "db_skip_final_snapshot" {
  description = "Skip the final RDS snapshot on destroy. true keeps teardown cheap but deletes all data."
  type        = bool
  default     = true
}

variable "admin_email" {
  description = "Email address of the bootstrap administrator created on first start."
  type        = string
  default     = "admin@example.com"
}

variable "admin_name" {
  description = "Display name of the bootstrap administrator."
  type        = string
  default     = "Platform Administrator"
}

variable "admin_password" {
  description = "Password for the bootstrap administrator. Only used when the database has no admin account."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.admin_password) >= 10
    error_message = "Use at least 10 characters."
  }
}

variable "acm_certificate_arn" {
  description = "Optional ACM certificate ARN (same region) to enable HTTPS. Leave empty for HTTP only."
  type        = string
  default     = ""
}

variable "frontend_url" {
  description = "Public base URL used in email links. Defaults to the load balancer URL."
  type        = string
  default     = ""

  validation {
    condition     = var.acm_certificate_arn == "" || can(regex("^https://", var.frontend_url))
    error_message = "When acm_certificate_arn is set, frontend_url must be the https:// domain covered by that certificate."
  }
}

variable "cors_origins" {
  description = "Comma-separated browser origins allowed to call the API. Defaults to the frontend URL."
  type        = string
  default     = ""
}

variable "mail_from" {
  description = "From address for outbound email."
  type        = string
  default     = "no-reply@example.com"
}

variable "smtp_host" {
  description = "SMTP host. Leave empty to skip outbound email."
  type        = string
  default     = ""
}

variable "smtp_port" {
  description = "SMTP port."
  type        = number
  default     = 587
}

variable "smtp_user" {
  description = "SMTP user name."
  type        = string
  default     = ""
}

variable "smtp_password" {
  description = "SMTP password. Stored as an SSM SecureString when non-empty."
  type        = string
  sensitive   = true
  default     = ""
}

variable "payment_webhook_secret" {
  description = "Payment provider webhook signing secret. Stored as an SSM SecureString when non-empty."
  type        = string
  sensitive   = true
  default     = ""
}
