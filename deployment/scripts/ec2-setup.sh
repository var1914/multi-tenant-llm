#!/bin/bash
# TokenTrail EC2 Initial Setup Script
# Run this once after SSHing into the EC2 instance

set -e

DEPLOY_DIR="/opt/tokentrail"
REPO_URL="${REPO_URL:-}"  # Set this or clone manually

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as ubuntu user
if [ "$(whoami)" != "ubuntu" ]; then
    log_error "Please run this script as the ubuntu user"
    exit 1
fi

log_info "Starting TokenTrail EC2 setup..."

# Create directory structure
log_info "Creating directory structure..."
sudo mkdir -p $DEPLOY_DIR
sudo chown -R ubuntu:ubuntu $DEPLOY_DIR
cd $DEPLOY_DIR

mkdir -p scripts nginx/conf.d frontend/dist certbot/conf certbot/www logs

# Copy deployment files from repo (or download them)
log_info "Setting up deployment files..."

# If you want to clone from git
if [ -n "$REPO_URL" ]; then
    log_info "Cloning repository..."
    git clone "$REPO_URL" repo
    cp -r repo/deployment/* .
    cp -r repo/backend .
    rm -rf repo
fi

# Make scripts executable
chmod +x scripts/*.sh 2>/dev/null || true

# Create placeholder frontend if not exists
if [ ! -f "frontend/dist/index.html" ]; then
    log_info "Creating placeholder frontend..."
    cat > frontend/dist/index.html <<'HTML_EOF'
<!DOCTYPE html>
<html>
<head>
    <title>TokenTrail</title>
    <style>
        body { font-family: -apple-system, sans-serif; background: #0a0a0b; color: white;
               display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .container { text-align: center; }
        h1 { font-size: 3em; background: linear-gradient(to right, #22c55e, #eab308, #ef4444);
             -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        p { color: #9ca3af; }
    </style>
</head>
<body>
    <div class="container">
        <h1>TokenTrail</h1>
        <p>Application is being deployed...</p>
    </div>
</body>
</html>
HTML_EOF
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    log_warn ".env file not found!"
    log_info "The .env file should have been created by Terraform at /opt/tokentrail/.env"

    if [ -f "/opt/tokentrail/.env" ]; then
        log_info "Found .env at expected location"
    else
        log_error "Please create .env file from .env.example"
        log_info "Required variables: DATABASE_URL, JWT_SECRET_KEY, etc."
    fi
fi

# Install systemd services
log_info "Installing systemd services..."
if [ -f "tokentrail.service" ]; then
    sudo cp tokentrail.service /etc/systemd/system/
    sudo cp tokentrail-watchdog.service /etc/systemd/system/ 2>/dev/null || true
    sudo systemctl daemon-reload
    sudo systemctl enable tokentrail.service
    sudo systemctl enable tokentrail-watchdog.service 2>/dev/null || true
fi

# Create log directory
sudo mkdir -p /var/log/tokentrail
sudo chown ubuntu:ubuntu /var/log/tokentrail

# Print status and next steps
echo ""
echo "=========================================="
echo "  TokenTrail EC2 Setup Complete!"
echo "=========================================="
echo ""
echo "Directory structure:"
ls -la $DEPLOY_DIR
echo ""
echo "Next steps:"
echo "1. Copy your backend code to $DEPLOY_DIR/backend/"
echo "2. Review and update $DEPLOY_DIR/.env"
echo "3. Build the frontend and copy to $DEPLOY_DIR/frontend/dist/"
echo "4. Run: ./scripts/deploy.sh"
echo ""
echo "Or deploy directly:"
echo "  cd $DEPLOY_DIR"
echo "  docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "View logs:"
echo "  docker-compose -f docker-compose.prod.yml logs -f"
echo ""
