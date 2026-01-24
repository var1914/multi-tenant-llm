# =============================================================================
# ECR Module Outputs
# =============================================================================

output "api_repository_url" {
  description = "URL of the API ECR repository"
  value       = aws_ecr_repository.api.repository_url
}

output "frontend_repository_url" {
  description = "URL of the Frontend ECR repository"
  value       = aws_ecr_repository.frontend.repository_url
}

output "api_repository_name" {
  description = "Name of the API ECR repository"
  value       = aws_ecr_repository.api.name
}

output "frontend_repository_name" {
  description = "Name of the Frontend ECR repository"
  value       = aws_ecr_repository.frontend.name
}

output "ecr_pull_policy_arn" {
  description = "ARN of the IAM policy for pulling from ECR"
  value       = aws_iam_policy.ecr_pull.arn
}

output "registry_id" {
  description = "The registry ID where the repositories are created"
  value       = aws_ecr_repository.api.registry_id
}
