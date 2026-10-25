output "alb_url" {
  description = "Public URL of the application."
  value       = local.alb_url
}

output "alb_dns_name" {
  description = "ALB DNS name to use in a Route 53 alias record."
  value       = aws_lb.app.dns_name
}

output "ecr_repository_url" {
  description = "Push the image here before the full apply."
  value       = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.app.name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = aws_ecs_service.app.name
}

output "db_endpoint" {
  description = "PostgreSQL endpoint (reachable only from the application tasks)."
  value       = aws_db_instance.app.endpoint
}

output "ssm_parameter_prefix" {
  description = "SSM prefix holding the generated secrets."
  value       = local.ssm_prefix
}

output "log_group_name" {
  description = "CloudWatch log group."
  value       = aws_cloudwatch_log_group.app.name
}
