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
# ELASTIC IP (Static public IP)
# =============================================================================
resource "aws_eip" "main" {
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-${var.environment}-eip"
  }
}

resource "aws_eip_association" "main" {
  instance_id   = aws_instance.main.id
  allocation_id = aws_eip.main.id
}

# =============================================================================
# EC2 INSTANCE
# =============================================================================
resource "aws_instance" "main" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  subnet_id              = var.public_subnet_id
  vpc_security_group_ids = [var.security_group_id]

  # Root volume
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 30  # GB
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
    ignore_changes = [ami, user_data]  # Don't recreate on AMI updates
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

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project_name}-${var.environment}-ec2-profile"
  role = aws_iam_role.ec2.name
}
