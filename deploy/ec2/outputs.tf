output "public_ip" {
  description = "Elastic IP of the host."
  value       = aws_eip.app.public_ip
}

output "app_url" {
  description = "Public HTTPS URL served by Caddy. Not live until the first-boot build and certificate issuance finish."
  value       = local.https_url
}

output "https_hostname" {
  description = "Hostname the certificate is issued for."
  value       = local.https_host
}

output "direct_url" {
  description = "Direct HTTP access on the app port, bypassing Caddy."
  value       = "http://${aws_eip.app.public_ip}:${var.app_port}"
}

output "admin_email" {
  description = "Bootstrapped administrator email."
  value       = var.admin_email
}

output "admin_password" {
  description = "Generated administrator password."
  value       = random_password.admin.result
  sensitive   = true
}

output "ssm_session" {
  description = "Shell access without SSH."
  value       = "aws ssm start-session --target ${aws_instance.app.id} --region ${var.aws_region}"
}

output "instance_id" {
  description = "EC2 instance id."
  value       = aws_instance.app.id
}
