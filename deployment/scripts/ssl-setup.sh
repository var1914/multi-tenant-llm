#!/bin/bash
# TokenTrail SSL Setup Script
# Sets up Let's Encrypt SSL certificates using Certbot
#
# Usage: ./ssl-setup.sh <domain> <email>
# Example: ./ssl-setup.sh tokentrailapp.com admin@tokentrailapp.com

set -e

DOMAIN="${1:-}"
EMAIL="${2:-}"
DEPLOY_DIR="/opt/tokentrail"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Validate inputs
if [ -z "$DOMAIN" ]; then
    log_error "Domain is required"
    echo "Usage: $0 <domain> <email>"
    echo "Example: $0 tokentrailapp.com admin@tokentrailapp.com"
    exit 1
fi

if [ -z "$EMAIL" ]; then
    log_error "Email is required"
    echo "Usage: $0 <domain> <email>"
    exit 1
fi

log_info "Setting up SSL for domain: $DOMAIN"
log_info "Using email: $EMAIL"

# Install Certbot if not present
if ! command -v certbot &> /dev/null; then
    log_info "Installing Certbot..."
    sudo snap install --classic certbot
    sudo ln -sf /snap/bin/certbot /usr/bin/certbot
fi

# Stop nginx temporarily for standalone verification
log_info "Stopping nginx for certificate generation..."
docker stop tokentrail-nginx 2>/dev/null || true

# Generate certificate (single domain for now, can add subdomains later)
log_info "Generating SSL certificate for $DOMAIN..."
if ! sudo certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN"; then
    log_error "Certbot failed to generate certificate!"
    log_error "Common causes:"
    log_error "  1. DNS not pointing to this server - run: dig $DOMAIN +short"
    log_error "  2. Port 80 blocked - check security group"
    log_error "  3. Rate limit hit - wait and retry"
    log_info "Restarting nginx..."
    docker start tokentrail-nginx 2>/dev/null || true
    exit 1
fi

# Verify certificate was created
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    log_error "Certificate directory not found at /etc/letsencrypt/live/$DOMAIN"
    log_error "Certbot may have failed silently. Check: sudo certbot certificates"
    docker start tokentrail-nginx 2>/dev/null || true
    exit 1
fi

# Copy certificates to deployment directory
log_info "Copying certificates..."
sudo mkdir -p "$DEPLOY_DIR/certbot/conf/live/$DOMAIN"
sudo mkdir -p "$DEPLOY_DIR/certbot/conf/archive/$DOMAIN"
sudo cp -rL /etc/letsencrypt/live/$DOMAIN/* "$DEPLOY_DIR/certbot/conf/live/$DOMAIN/"
sudo cp -rL /etc/letsencrypt/archive/$DOMAIN/* "$DEPLOY_DIR/certbot/conf/archive/$DOMAIN/"
sudo chown -R ubuntu:ubuntu "$DEPLOY_DIR/certbot"

# Update nginx config to use SSL
log_info "Updating nginx configuration for SSL..."
cat > "$DEPLOY_DIR/nginx/conf.d/default.conf" <<NGINX_EOF
# TokenTrail Nginx Configuration with SSL
# Domain: $DOMAIN

upstream api_backend {
    server api:8000;
    keepalive 32;
}

upstream litellm_backend {
    server litellm:4000;
    keepalive 16;
}

# HTTP - Redirect to HTTPS
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Health check
    location /health {
        proxy_pass http://api_backend/health;
        proxy_http_version 1.1;
        access_log off;
    }

    # Frontend
    location / {
        root /usr/share/nginx/html;
        try_files \$uri \$uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API
    location /api/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 120s;
    }

    # LiteLLM OpenAI-compatible endpoint
    location /v1/ {
        proxy_pass http://litellm_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header Connection "";
        proxy_read_timeout 300s;
        proxy_buffering off;
    }

    # API Docs
    location /docs {
        proxy_pass http://api_backend/docs;
        proxy_http_version 1.1;
    }

    location /redoc {
        proxy_pass http://api_backend/redoc;
        proxy_http_version 1.1;
    }

    location /openapi.json {
        proxy_pass http://api_backend/openapi.json;
        proxy_http_version 1.1;
    }
}
NGINX_EOF

# Restart nginx
log_info "Restarting nginx..."
docker start tokentrail-nginx

# Setup auto-renewal
log_info "Setting up certificate auto-renewal..."
cat > /tmp/certbot-renew <<CRON_EOF
0 0,12 * * * root certbot renew --quiet --deploy-hook "docker restart tokentrail-nginx"
CRON_EOF
sudo mv /tmp/certbot-renew /etc/cron.d/certbot-renew
sudo chmod 644 /etc/cron.d/certbot-renew

echo ""
log_info "SSL setup complete!"
echo ""
echo "Your site is now accessible at:"
echo "  - https://$DOMAIN"
echo ""
echo "Certificates will auto-renew every 12 hours if needed."
echo ""
