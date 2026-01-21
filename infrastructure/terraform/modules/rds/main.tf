# RDS Module - PostgreSQL in Private Subnet

# =============================================================================
# DB SUBNET GROUP (Required for RDS in VPC)
# =============================================================================
resource "aws_db_subnet_group" "main" {
  name        = "${var.project_name}-${var.environment}-db-subnet"
  description = "Database subnet group for ${var.project_name}"
  subnet_ids  = var.private_subnet_ids

  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  }
}

# =============================================================================
# RDS PARAMETER GROUP (PostgreSQL tuning)
# =============================================================================
resource "aws_db_parameter_group" "main" {
  family = "postgres15"
  name   = "${var.project_name}-${var.environment}-pg-params"

  # Static parameters (require reboot)
  parameter {
    name         = "shared_buffers"
    value        = "{DBInstanceClassMemory/4096}"  # 25% of RAM in 8KB pages
    apply_method = "pending-reboot"
  }

  # Dynamic parameters
  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceClassMemory*3/4096}"  # 75% of RAM
  }

  parameter {
    name  = "work_mem"
    value = "16384"  # 16MB per operation
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "131072"  # 128MB for maintenance
  }

  parameter {
    name  = "random_page_cost"
    value = "1.1"  # SSD-optimized
  }

  parameter {
    name  = "effective_io_concurrency"
    value = "200"  # SSD-optimized
  }

  # Logging
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"  # Log queries > 1 second
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  # Connection settings
  parameter {
    name  = "idle_in_transaction_session_timeout"
    value = "30000"  # 30 seconds
  }

  parameter {
    name  = "statement_timeout"
    value = "60000"  # 60 seconds
  }

  # Autovacuum tuning for high-write workloads
  parameter {
    name  = "autovacuum_vacuum_scale_factor"
    value = "0.05"
  }

  parameter {
    name  = "autovacuum_analyze_scale_factor"
    value = "0.02"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-pg-params"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# =============================================================================
# RDS INSTANCE
# =============================================================================
resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-${var.environment}-db"

  # Engine
  engine               = "postgres"
  engine_version       = "15.15"
  instance_class       = var.db_instance_class
  parameter_group_name = aws_db_parameter_group.main.name

  # Storage
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 2  # Auto-scale up to 2x
  storage_type          = "gp3"
  storage_encrypted     = true

  # Database
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  # Network
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.security_group_id]
  publicly_accessible    = false
  port                   = 5432

  # Availability
  multi_az = var.multi_az

  # Backup
  backup_retention_period = var.backup_retention_days
  backup_window           = "03:00-04:00"  # UTC
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Deletion protection
  deletion_protection       = var.environment == "production"
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.project_name}-${var.environment}-final-snapshot"

  # Performance Insights (free for 7 days retention)
  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  # Enhanced monitoring (optional - costs extra)
  # monitoring_interval = 60
  # monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  # Copy tags to snapshots
  copy_tags_to_snapshot = true

  tags = {
    Name = "${var.project_name}-${var.environment}-db"
  }
}
