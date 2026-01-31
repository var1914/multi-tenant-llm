#!/bin/bash
set -e

exec > >(tee /var/log/user-data.log) 2>&1
echo "Starting TokenTrail setup at $(date)"

# Variables from Terraform
PROJECT_NAME="${project_name}"
DB_HOST="${db_host}"
DB_PORT="${db_port}"
DB_NAME="${db_name}"
DB_USERNAME="${db_username}"
DB_PASSWORD="${db_password}"
JWT_SECRET="${jwt_secret}"
INTERNAL_API_KEY="${internal_api_key}"
DOMAIN_NAME="${domain_name}"
AWS_REGION="${aws_region}"
SES_SENDER_EMAIL="${ses_sender_email}"
ADMIN_EMAIL="${admin_email}"

# System updates
apt-get update -y && apt-get upgrade -y

# Install Docker
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release git htop jq
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl start docker && systemctl enable docker
usermod -aG docker ubuntu

# Docker Compose standalone
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create app directory
mkdir -p /opt/tokentrail
cd /opt/tokentrail

# Create .env file
cat > /opt/tokentrail/.env <<EOF
DATABASE_URL=postgresql+asyncpg://$DB_USERNAME:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME
SYNC_DATABASE_URL=postgresql://$DB_USERNAME:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME

# CRITICAL: LiteLLM MUST use a separate database.
# Prisma generates DROP TABLE for tables it doesn't own — sharing a DB causes data loss.
LITELLM_DATABASE_URL=postgresql://$DB_USERNAME:$DB_PASSWORD@$DB_HOST:$DB_PORT/$${DB_NAME}_litellm

JWT_SECRET_KEY=$JWT_SECRET
USAGEFLOW_INTERNAL_API_KEY=$INTERNAL_API_KEY
DOMAIN_NAME=$DOMAIN_NAME
LITELLM_MASTER_KEY=sk-change-me
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Email settings
FRONTEND_URL=https://$DOMAIN_NAME
AWS_REGION=$AWS_REGION
SES_SENDER_EMAIL=$SES_SENDER_EMAIL
ADMIN_EMAIL=$ADMIN_EMAIL
EOF
chmod 600 /opt/tokentrail/.env

# Configure swap
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Set permissions
chown -R ubuntu:ubuntu /opt/tokentrail

echo "TokenTrail setup complete at $(date)"
echo "SSH in and deploy your application to /opt/tokentrail"
