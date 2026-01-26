# UsageFlow Terraform Variables

# =============================================================================
# GENERAL
# =============================================================================
variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "usageflow"
}

variable "environment" {
  description = "Environment name (validation, staging, production)"
  type        = string
  default     = "validation"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# =============================================================================
# NETWORKING
# =============================================================================
variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDR blocks (for RDS)"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "allowed_ssh_cidrs" {
  description = "CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Restrict this in production!
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway (adds ~$32/mo). Not needed for validation since RDS doesn't require outbound internet."
  type        = bool
  default     = false  # Disabled by default to save costs
}

# =============================================================================
# EC2 (Application Server)
# =============================================================================
variable "ec2_instance_type" {
  description = "EC2 instance type. t3.small ($15/mo) works for validation, t3.medium ($30/mo) recommended for 100+ users."
  type        = string
  default     = "t3.small"  # 2 vCPU, 2GB RAM - minimum for validation
}

variable "ec2_key_name" {
  description = "SSH key pair name (must exist in AWS)"
  type        = string
}

variable "domain_name" {
  description = "Domain name for the application (optional)"
  type        = string
  default     = ""
}

# =============================================================================
# EMAIL SETTINGS (SES)
# =============================================================================
variable "ses_sender_email" {
  description = "Email address for sending notifications (must be verified in SES)"
  type        = string
  default     = "tokentrailapp@gmail.com"
}

variable "admin_email" {
  description = "Admin email for receiving notifications"
  type        = string
  default     = "tokentrailapp@gmail.com"
}

# =============================================================================
# RDS (PostgreSQL)
# =============================================================================
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"  # Free tier eligible, 2 vCPU, 1GB RAM
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20  # Free tier: up to 20GB
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "usageflow"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "usageflow"
}

variable "db_multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = false  # Set true for production
}

variable "db_backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 1  # Free tier limit
}

# =============================================================================
# BUDGET ALERTS
# =============================================================================
variable "monthly_budget_limit" {
  description = "Monthly AWS budget limit in USD"
  type        = string
  default     = "5"
}

variable "budget_alert_emails" {
  description = "Email addresses to receive budget alerts"
  type        = list(string)
  default     = []
}
