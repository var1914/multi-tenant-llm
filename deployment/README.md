# TokenTrail Production Deployment

This directory contains all files needed to deploy TokenTrail on AWS EC2 with RDS PostgreSQL.

## Directory Structure

```
deployment/
├── docker-compose.prod.yml     # Main production compose file
├── docker-compose.logging.yml  # CloudWatch logging extension
├── tokentrail.service          # Systemd service for auto-start
├── tokentrail-watchdog.service # Watchdog service for monitoring
├── litellm_config.yaml         # LiteLLM proxy configuration
├── .env.example                # Environment variables template
├── nginx/
│   ├── nginx.conf              # Main nginx config
│   └── conf.d/
│       └── default.conf        # Server configuration
└── scripts/
    ├── deploy.sh               # Main deployment script
    ├── watchdog.sh             # Container health monitor
    ├── ec2-setup.sh            # Initial EC2 setup
    ├── ssl-setup.sh            # Let's Encrypt SSL setup
    └── health-monitor.sh       # Health monitoring (Docker)
```

## Quick Start

### 1. SSH into EC2

```bash
ssh -i ~/.ssh/tokentrail-key.pem ubuntu@YOUR_EC2_IP
```

### 2. Initial Setup

```bash
cd /opt/tokentrail
./scripts/ec2-setup.sh
```

### 3. Configure Environment

Edit the `.env` file with your RDS credentials:

```bash
nano .env
```

Required variables (get from Terraform outputs):
```bash
# On your local machine
cd infrastructure/terraform
terraform output db_password
terraform output jwt_secret
terraform output internal_api_key
terraform output rds_endpoint
```

### 4. Deploy

```bash
./scripts/deploy.sh
```

### 5. Setup SSL (after DNS is configured)

```bash
./scripts/ssl-setup.sh tokentrailapp.com tokentrailapp@gmail.com
```

## Commands Reference

### Service Management

```bash
# Start TokenTrail
sudo systemctl start tokentrail

# Stop TokenTrail
sudo systemctl stop tokentrail

# Restart TokenTrail
sudo systemctl restart tokentrail

# Check status
sudo systemctl status tokentrail

# View logs
journalctl -u tokentrail -f
```

### Docker Compose Commands

```bash
cd /opt/tokentrail

# View running containers
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker-compose -f docker-compose.prod.yml logs -f api

# Restart a specific service
docker-compose -f docker-compose.prod.yml restart api

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build
```

### Database Migrations

```bash
docker-compose -f docker-compose.prod.yml run --rm api alembic upgrade head
```

### Health Checks

```bash
# API health
curl http://localhost:8000/health

# LiteLLM health
curl http://localhost:4000/health

# All containers health
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## Monitoring & Alerts

### Slack Alerts

Set `SLACK_WEBHOOK_URL` in your `.env` file to receive alerts:
- Container crashes
- Health check failures
- Recovery notifications

### CloudWatch Logging

To enable CloudWatch logging:

```bash
docker-compose -f docker-compose.prod.yml -f docker-compose.logging.yml up -d
```

View logs in AWS Console: CloudWatch → Log groups → /tokentrail/*

### Watchdog Service

The watchdog service monitors containers and auto-restarts them:

```bash
# Check watchdog status
sudo systemctl status tokentrail-watchdog

# View watchdog logs
journalctl -u tokentrail-watchdog -f

# Restart watchdog
sudo systemctl restart tokentrail-watchdog
```

## Troubleshooting

### Container won't start

```bash
# Check container logs
docker-compose -f docker-compose.prod.yml logs api

# Check if .env is correct
cat .env

# Verify database connectivity
docker-compose -f docker-compose.prod.yml run --rm api python -c "
from app.core.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    print(conn.execute(text('SELECT 1')).scalar())
"
```

### Database connection issues

```bash
# Test RDS connectivity from EC2
PGPASSWORD=YOUR_PASSWORD psql -h RDS_ENDPOINT -U tokentrail -d tokentrail -c "SELECT 1"

# Check security groups allow traffic from EC2 to RDS
```

### Out of memory

```bash
# Check memory usage
free -h
docker stats

# Increase swap (if needed)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Nginx 502 Bad Gateway

```bash
# Check if API is running
docker-compose -f docker-compose.prod.yml ps api

# Check API logs
docker-compose -f docker-compose.prod.yml logs api

# Restart API
docker-compose -f docker-compose.prod.yml restart api
```

## Security Checklist

- [ ] `.env` file has restricted permissions (`chmod 600`)
- [ ] RDS is not publicly accessible
- [ ] Security groups restrict access appropriately
- [ ] SSL certificates are configured
- [ ] Secrets are not committed to git
- [ ] CloudWatch or external logging is enabled

## Estimated Costs

| Resource | Monthly Cost |
|----------|-------------|
| EC2 t3.small | ~$15 |
| RDS db.t3.micro | FREE (12 months) |
| Elastic IP | ~$4 |
| Storage (30GB) | ~$3 |
| Data Transfer | ~$5 |
| **Total** | **~$27/month** |

## Support

- Documentation: https://docs.tokentrailapp.com
- Email: tokentrailapp@gmail.com
- GitHub: https://github.com/tokentrailapp/tokentrail
