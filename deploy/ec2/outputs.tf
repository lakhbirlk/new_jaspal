output "public_ip" {
  description = "Elastic IP of the host."
  value       = aws_eip.app.public_ip
}

output "app_url" {
  description = "Application URL. Not live until the first-boot build finishes (15-25 min)."
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
