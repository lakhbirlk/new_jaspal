variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "name" {
  description = "Application name used to prefix resource names and tags."
  type        = string
  default     = "business-directory"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "demo"
}

variable "instance_type" {
  description = "EC2 instance type. t4g.small is 2 vCPU / 2 GiB on Graviton (ARM64)."
  type        = string
  default     = "t4g.small"
}

variable "git_repo_url" {
  description = "Public repository cloned and built on first boot."
  type        = string
  default     = "https://github.com/lakhbirlk/new_jaspal.git"
}

variable "git_branch" {
  description = "Branch to build from."
  type        = string
  default     = "main"
}

variable "root_volume_size" {
  description = "Root EBS size in GiB. The Maven + Expo build needs room for layers."
  type        = number
  default     = 30
}

variable "app_port" {
  description = "Port the application listens on."
  type        = number
  default     = 8080
}

variable "ssh_cidr" {
  description = "CIDR allowed to SSH. Leave empty to disable SSH entirely (use SSM Session Manager instead)."
  type        = string
  default     = ""
}

variable "db_user" {
  description = "MySQL user and database name."
  type        = string
  default     = "directory"
}

variable "admin_email" {
  description = "Email for the bootstrapped administrator."
  type        = string
  default     = "admin@example.com"
}

variable "admin_name" {
  description = "Display name for the bootstrapped administrator."
  type        = string
  default     = "Platform Administrator"
}

variable "seed_demo" {
  description = "Create the demo researcher, business and auditor accounts on startup."
  type        = bool
  default     = true
}

variable "https_domain" {
  description = "Hostname Caddy obtains a certificate for. Leave empty to use the Elastic IP's free <ip-with-dashes>.sslip.io name."
  type        = string
  default     = ""
}

variable "tls_email" {
  description = "Contact email registered with Let's Encrypt (optional but recommended)."
  type        = string
  default     = "admin@example.com"
}

variable "mysql_image" {
  description = "MySQL container image. Must match the backend's expected major version."
  type        = string
  default     = "mysql:8.4"
}
