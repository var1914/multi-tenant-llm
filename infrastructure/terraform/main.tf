# TokenTrail Infrastructure - Terraform Configuration
# Deploys: VPC, RDS (private), EC2 (public), Redis (ElastiCache optional)
# Target: Validation environment for 100-500 users

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Uncomment for remote state (recommended for team use)
  # backend "s3" {
  #   bucket         = "tokentrail-terraform-state"
  #   key            = "validation/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "TokenTrail"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Random suffix for unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

# Generate secure passwords (no special chars to avoid URL encoding issues)
resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "random_password" "internal_api_key" {
  length  = 32
  special = false
}

# =============================================================================
# VPC MODULE
# =============================================================================
module "vpc" {
  source = "./modules/vpc"

  project_name = var.project_name
  environment  = var.environment
  vpc_cidr     = var.vpc_cidr

  availability_zones = var.availability_zones

  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs

  # NAT Gateway is optional - saves ~$32/mo when disabled
  enable_nat_gateway = var.enable_nat_gateway
}

# =============================================================================
# SECURITY GROUPS MODULE
# =============================================================================
module "security" {
  source = "./modules/security"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.vpc.vpc_id
  vpc_cidr     = var.vpc_cidr

  allowed_ssh_cidrs = var.allowed_ssh_cidrs
}

# =============================================================================
# ECR MODULE (Container Registry)
# =============================================================================
module "ecr" {
  source = "./modules/ecr"

  project_name = var.project_name
  environment  = var.environment
}

# =============================================================================
# RDS MODULE (PostgreSQL in Private Subnet)
# =============================================================================
module "rds" {
  source = "./modules/rds"

  project_name = var.project_name
  environment  = var.environment

  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  security_group_id  = module.security.rds_security_group_id

  db_instance_class    = var.db_instance_class
  db_allocated_storage = var.db_allocated_storage
  db_name              = var.db_name
  db_username          = var.db_username
  db_password          = random_password.db_password.result

  multi_az               = var.db_multi_az
  backup_retention_days  = var.db_backup_retention_days
  skip_final_snapshot    = var.environment != "production"
}

# =============================================================================
# EC2 MODULE (Application Server in Public Subnet)
# =============================================================================
module "ec2" {
  source = "./modules/ec2"

  project_name = var.project_name
  environment  = var.environment

  vpc_id            = module.vpc.vpc_id
  public_subnet_id  = module.vpc.public_subnet_ids[0]
  security_group_id = module.security.ec2_security_group_id

  instance_type = var.ec2_instance_type
  key_name      = var.ec2_key_name

  # Database connection info (use db_address, not db_endpoint which includes port)
  db_host     = module.rds.db_address
  db_port     = module.rds.db_port
  db_name     = var.db_name
  db_username = var.db_username
  db_password = random_password.db_password.result

  # Application secrets
  jwt_secret       = random_password.jwt_secret.result
  internal_api_key = random_password.internal_api_key.result

  # Optional: Domain for SSL
  domain_name = var.domain_name

  # ECR access for pulling container images
  ecr_pull_policy_arn = module.ecr.ecr_pull_policy_arn
}

# =============================================================================
# AWS BUDGET ALERT ($5/month)
# =============================================================================
resource "aws_budgets_budget" "monthly" {
  name              = "${var.project_name}-${var.environment}-monthly-budget"
  budget_type       = "COST"
  limit_amount      = var.monthly_budget_limit
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2024-01-01_00:00"

  cost_filter {
    name = "TagKeyValue"
    values = [
      "user:Project$TokenTrail"
    ]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.budget_alert_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }
}

# =============================================================================
# OUTPUTS
# =============================================================================
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "ec2_public_ip" {
  description = "EC2 Public IP Address"
  value       = module.ec2.public_ip
}

output "ec2_public_dns" {
  description = "EC2 Public DNS"
  value       = module.ec2.public_dns
}

output "rds_endpoint" {
  description = "RDS Endpoint (private)"
  value       = module.rds.db_endpoint
  sensitive   = true
}

output "ssh_command" {
  description = "SSH command to connect to EC2"
  value       = "ssh -i ${var.ec2_key_name}.pem ubuntu@${module.ec2.public_ip}"
}

output "application_url" {
  description = "Application URL"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "http://${module.ec2.public_ip}"
}

output "db_password" {
  description = "Database password (store securely!)"
  value       = random_password.db_password.result
  sensitive   = true
}

output "jwt_secret" {
  description = "JWT Secret (store securely!)"
  value       = random_password.jwt_secret.result
  sensitive   = true
}

output "internal_api_key" {
  description = "Internal API Key (store securely!)"
  value       = random_password.internal_api_key.result
  sensitive   = true
}

# ECR Outputs
output "ecr_api_repository_url" {
  description = "ECR API repository URL"
  value       = module.ecr.api_repository_url
}

output "ecr_frontend_repository_url" {
  description = "ECR Frontend repository URL"
  value       = module.ecr.frontend_repository_url
}

output "ecr_registry_id" {
  description = "ECR registry ID (AWS account ID)"
  value       = module.ecr.registry_id
}
