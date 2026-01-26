# EC2 Module - Application Server with Docker

# =============================================================================
# DATA SOURCES
# =============================================================================

# Get latest Ubuntu 22.04 AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]  # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# =============================================================================
# EC2 INSTANCE (uses dynamic public IP - update Route 53 DNS when IP changes)
# Removed Elastic IP to save ~$4/mo
# =============================================================================
resource "aws_instance" "main" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  key_name                    = var.key_name
  subnet_id                   = var.public_subnet_id
  vpc_security_group_ids      = [var.security_group_id]
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.ec2.name

  # Root volume
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 50  # GB - increased for Docker images with ML libraries
    delete_on_termination = true
    encrypted             = true

    tags = {
      Name = "${var.project_name}-${var.environment}-root"
    }
  }

  # User data script to install Docker and configure the server
  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    project_name     = var.project_name
    environment      = var.environment
    db_host          = var.db_host
    db_port          = var.db_port
    db_name          = var.db_name
    db_username      = var.db_username
    db_password      = var.db_password
    jwt_secret       = var.jwt_secret
    internal_api_key = var.internal_api_key
    domain_name      = var.domain_name
  }))

  # Enable detailed monitoring (optional - costs extra)
  monitoring = false

  # Metadata options (IMDSv2 for security)
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-app"
  }

  lifecycle {
    # Don't recreate on AMI updates or when stopped (public IP gets released)
    ignore_changes = [ami, user_data, associate_public_ip_address]
  }
}

# =============================================================================
# IAM ROLE FOR EC2 (Optional - for AWS service access)
# =============================================================================
resource "aws_iam_role" "ec2" {
  name = "${var.project_name}-${var.environment}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-ec2-role"
  }
}

# Allow EC2 to write to CloudWatch Logs
resource "aws_iam_role_policy" "cloudwatch_logs" {
  name = "cloudwatch-logs"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Allow EC2 to access SSM (for Session Manager - optional)
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Allow EC2 to send emails via SES
resource "aws_iam_role_policy" "ses_send" {
  name = "ses-send-emails"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project_name}-${var.environment}-ec2-profile"
  role = aws_iam_role.ec2.name
}

# Allow EC2 to pull from ECR (if policy ARN is provided)
resource "aws_iam_role_policy_attachment" "ecr_pull" {
  count      = var.ecr_pull_policy_arn != "" ? 1 : 0
  role       = aws_iam_role.ec2.name
  policy_arn = var.ecr_pull_policy_arn
}

# =============================================================================
# AUTO-STOP SCHEDULER (Stop EC2 at 12:00 AM IST / 6:30 PM UTC daily)
# =============================================================================

# IAM role for EventBridge to stop EC2 instances
resource "aws_iam_role" "scheduler" {
  name = "${var.project_name}-${var.environment}-ec2-scheduler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-ec2-scheduler"
  }
}

# Policy to allow stopping the EC2 instance
resource "aws_iam_role_policy" "scheduler_ec2_stop" {
  name = "ec2-stop-policy"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "ec2:StopInstances"
        Resource = aws_instance.main.arn
      }
    ]
  })
}

# EventBridge Scheduler to stop EC2 at 12:00 AM IST (6:30 PM UTC) daily
resource "aws_scheduler_schedule" "stop_ec2" {
  name        = "${var.project_name}-${var.environment}-stop-ec2-midnight-ist"
  description = "Stop EC2 instance at 12:00 AM IST daily to save costs"

  flexible_time_window {
    mode = "OFF"
  }

  # 12:00 AM IST daily
  schedule_expression          = "cron(0 0 * * ? *)"
  schedule_expression_timezone = "Asia/Kolkata"

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:ec2:stopInstances"
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      InstanceIds = [aws_instance.main.id]
    })

    # Retry on transient failures, don't fail if already stopped
    retry_policy {
      maximum_event_age_in_seconds = 300
      maximum_retry_attempts       = 3
    }
  }
}
