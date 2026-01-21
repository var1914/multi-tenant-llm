# EC2 Module Outputs

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.main.id
}

output "public_ip" {
  description = "EC2 public IP (dynamic - may change on restart)"
  value       = aws_instance.main.public_ip
}

output "public_dns" {
  description = "EC2 public DNS"
  value       = aws_instance.main.public_dns
}

output "private_ip" {
  description = "EC2 private IP"
  value       = aws_instance.main.private_ip
}

output "availability_zone" {
  description = "EC2 availability zone"
  value       = aws_instance.main.availability_zone
}

output "iam_role_arn" {
  description = "EC2 IAM role ARN"
  value       = aws_iam_role.ec2.arn
}
