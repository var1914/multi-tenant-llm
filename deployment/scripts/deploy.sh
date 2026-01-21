#!/bin/bash
# TokenTrail Deployment Script
# Run from repo root: ./deployment/scripts/deploy.sh

set -e

# Get the script's directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="/opt/tokentrail"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Install Node.js if not present
install_nodejs() {
    if ! command -v node &> /dev/null; then
        log_info "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
        log_info "Node.js installed: $(node --version)"
    else
        log_info "Node.js already installed: $(node --version)"
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    if [ ! -f "$DEPLOY_DIR/.env" ]; then
        log_error ".env file not found at $DEPLOY_DIR/.env"
        log_info "Terraform should have created this. Check /opt/tokentrail/.env"
        exit 1
    fi

    log_info "Prerequisites check passed"
}

# Copy deployment files to /opt/tokentrail
copy_files() {
    log_info "Copying deployment files to $DEPLOY_DIR..."

    sudo mkdir -p $DEPLOY_DIR
    sudo chown -R ubuntu:ubuntu $DEPLOY_DIR

    # Copy deployment configs
    cp "$REPO_ROOT/deployment/docker-compose.prod.yml" "$DEPLOY_DIR/"
    cp "$REPO_ROOT/deployment/docker-compose.logging.yml" "$DEPLOY_DIR/" 2>/dev/null || true
    cp "$REPO_ROOT/deployment/litellm_config.yaml" "$DEPLOY_DIR/"
    cp "$REPO_ROOT/deployment/tokentrail.service" "$DEPLOY_DIR/"
    cp "$REPO_ROOT/deployment/tokentrail-watchdog.service" "$DEPLOY_DIR/"

    # Copy nginx config
    mkdir -p "$DEPLOY_DIR/nginx/conf.d"
    cp "$REPO_ROOT/deployment/nginx/nginx.conf" "$DEPLOY_DIR/nginx/"
    cp "$REPO_ROOT/deployment/nginx/conf.d/default.conf" "$DEPLOY_DIR/nginx/conf.d/"

    # Copy scripts
    mkdir -p "$DEPLOY_DIR/scripts"
    cp "$REPO_ROOT/deployment/scripts/"*.sh "$DEPLOY_DIR/scripts/"
    chmod +x "$DEPLOY_DIR/scripts/"*.sh

    # Copy backend
    if [ -d "$REPO_ROOT/backend" ]; then
        log_info "Copying backend..."
        cp -r "$REPO_ROOT/backend" "$DEPLOY_DIR/"
    fi

    # Copy litellm callback
    if [ -d "$REPO_ROOT/litellm" ]; then
        log_info "Copying litellm callback..."
        cp -r "$REPO_ROOT/litellm" "$DEPLOY_DIR/"
    fi

    log_info "Files copied successfully"
}

# Build frontend
build_frontend() {
    log_info "Building frontend..."
    log_info "Looking for frontend at: $REPO_ROOT/frontend"

    if [ -d "$REPO_ROOT/frontend" ] && [ -f "$REPO_ROOT/frontend/package.json" ]; then
        log_info "Found frontend, installing dependencies..."
        cd "$REPO_ROOT/frontend"

        npm ci

        log_info "Building frontend..."
        npm run build

        log_info "Copying built files to $DEPLOY_DIR/frontend/dist/"
        mkdir -p "$DEPLOY_DIR/frontend/dist"
        cp -r dist/* "$DEPLOY_DIR/frontend/dist/"

        cd "$REPO_ROOT"
        log_info "Frontend built successfully"
    else
        log_warn "Frontend not found at $REPO_ROOT/frontend"
        log_warn "Creating placeholder..."
        mkdir -p "$DEPLOY_DIR/frontend/dist"
        cat > "$DEPLOY_DIR/frontend/dist/index.html" <<'HTML'
<!DOCTYPE html>
<html>
<head><title>TokenTrail</title>
<style>body{font-family:sans-serif;background:#0a0a0b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
h1{background:linear-gradient(to right,#22c55e,#eab308);-webkit-background-clip:text;-webkit-text-fill-color:transparent}</style>
</head>
<body><div><h1>TokenTrail</h1><p>Frontend deploying...</p></div></body>
</html>
HTML
    fi
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."
    cd "$DEPLOY_DIR"

    docker-compose -f docker-compose.prod.yml build
    log_info "Docker images built successfully"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    cd "$DEPLOY_DIR"

    docker-compose -f docker-compose.prod.yml run --rm api alembic upgrade head
    log_info "Migrations completed"
}

# Deploy services
deploy_services() {
    log_info "Deploying services..."
    cd "$DEPLOY_DIR"

    # Stop existing services
    docker-compose -f docker-compose.prod.yml down --remove-orphans || true

    # Start services
    docker-compose -f docker-compose.prod.yml up -d

    log_info "Services deployed"
}

# Setup systemd services
setup_systemd() {
    log_info "Setting up systemd services..."

    sudo cp "$DEPLOY_DIR/tokentrail.service" /etc/systemd/system/
    sudo cp "$DEPLOY_DIR/tokentrail-watchdog.service" /etc/systemd/system/ 2>/dev/null || true

    sudo systemctl daemon-reload
    sudo systemctl enable tokentrail.service
    sudo systemctl enable tokentrail-watchdog.service 2>/dev/null || true

    log_info "Systemd services configured"
}

# Health check
health_check() {
    log_info "Running health checks..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
            log_info "API is healthy!"
            break
        fi

        log_warn "Waiting for API to be ready... (attempt $attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_error "API health check failed after $max_attempts attempts"
        docker-compose -f docker-compose.prod.yml logs --tail=50 api
        exit 1
    fi

    log_info "Container status:"
    docker-compose -f docker-compose.prod.yml ps
}

# Print deployment summary
print_summary() {
    local public_ip=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_IP")

    echo ""
    echo "=========================================="
    echo "  TokenTrail Deployment Complete! 🚀"
    echo "=========================================="
    echo ""
    echo "Services running:"
    cd "$DEPLOY_DIR"
    docker-compose -f docker-compose.prod.yml ps
    echo ""
    echo "Access your application:"
    echo "  - Frontend: http://$public_ip"
    echo "  - API: http://$public_ip:8000"
    echo "  - API Docs: http://$public_ip:8000/docs"
    echo "  - LiteLLM: http://$public_ip:4000"
    echo ""
    echo "Useful commands:"
    echo "  - View logs: cd $DEPLOY_DIR && docker-compose -f docker-compose.prod.yml logs -f"
    echo "  - Restart: sudo systemctl restart tokentrail"
    echo "  - Status: sudo systemctl status tokentrail"
    echo ""
}

# Main deployment flow
main() {
    log_info "Starting TokenTrail deployment..."
    log_info "Repo root: $REPO_ROOT"
    log_info "Deploy dir: $DEPLOY_DIR"

    check_prerequisites
    install_nodejs
    copy_files
    build_frontend
    build_images
    run_migrations
    deploy_services
    setup_systemd
    health_check
    print_summary

    log_info "Deployment completed successfully!"
}

# Parse arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    copy)
        copy_files
        ;;
    build)
        build_frontend
        cd "$DEPLOY_DIR" && build_images
        ;;
    migrate)
        cd "$DEPLOY_DIR" && run_migrations
        ;;
    restart)
        cd "$DEPLOY_DIR" && deploy_services
        health_check
        ;;
    status)
        cd "$DEPLOY_DIR"
        docker-compose -f docker-compose.prod.yml ps
        docker-compose -f docker-compose.prod.yml logs --tail=20
        ;;
    logs)
        cd "$DEPLOY_DIR"
        docker-compose -f docker-compose.prod.yml logs -f "${2:-}"
        ;;
    *)
        echo "Usage: $0 {deploy|copy|build|migrate|restart|status|logs [service]}"
        echo ""
        echo "Commands:"
        echo "  deploy  - Full deployment (copy, build, migrate, start)"
        echo "  copy    - Copy files to $DEPLOY_DIR"
        echo "  build   - Build frontend and Docker images"
        echo "  migrate - Run database migrations"
        echo "  restart - Restart all services"
        echo "  status  - Show service status and recent logs"
        echo "  logs    - Follow logs (optionally specify service)"
        exit 1
        ;;
esac
