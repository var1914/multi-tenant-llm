#!/bin/bash
# TokenTrail Deployment Script
# Run this script to deploy the application to EC2

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_DIR="/opt/tokentrail"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

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

    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        log_error ".env file not found at $PROJECT_ROOT/.env"
        exit 1
    fi

    log_info "Prerequisites check passed"
}

# Build frontend
build_frontend() {
    log_info "Building frontend..."

    if [ -d "$PROJECT_ROOT/../frontend" ]; then
        cd "$PROJECT_ROOT/../frontend"

        if [ -f "package.json" ]; then
            npm ci --silent
            npm run build

            # Copy built files
            mkdir -p "$PROJECT_ROOT/frontend"
            cp -r dist/* "$PROJECT_ROOT/frontend/" 2>/dev/null || mkdir -p "$PROJECT_ROOT/frontend/dist"

            log_info "Frontend built successfully"
        else
            log_warn "No package.json found, skipping frontend build"
        fi
    else
        log_warn "Frontend directory not found, skipping"
    fi
}

# Pull/Build Docker images
build_images() {
    log_info "Building Docker images..."
    cd "$PROJECT_ROOT"

    docker-compose -f docker-compose.prod.yml build --no-cache
    log_info "Docker images built successfully"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    cd "$PROJECT_ROOT"

    docker-compose -f docker-compose.prod.yml run --rm api alembic upgrade head
    log_info "Migrations completed"
}

# Deploy services
deploy_services() {
    log_info "Deploying services..."
    cd "$PROJECT_ROOT"

    # Stop existing services
    docker-compose -f docker-compose.prod.yml down --remove-orphans || true

    # Start services
    docker-compose -f docker-compose.prod.yml up -d

    log_info "Services deployed"
}

# Setup systemd services
setup_systemd() {
    log_info "Setting up systemd services..."

    sudo cp "$PROJECT_ROOT/tokentrail.service" /etc/systemd/system/
    sudo cp "$PROJECT_ROOT/tokentrail-watchdog.service" /etc/systemd/system/

    sudo systemctl daemon-reload
    sudo systemctl enable tokentrail.service
    sudo systemctl enable tokentrail-watchdog.service

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
        docker-compose -f docker-compose.prod.yml logs api
        exit 1
    fi

    # Check all containers
    log_info "Container status:"
    docker-compose -f docker-compose.prod.yml ps
}

# Print deployment summary
print_summary() {
    echo ""
    echo "=========================================="
    echo "  TokenTrail Deployment Complete! 🚀"
    echo "=========================================="
    echo ""
    echo "Services running:"
    docker-compose -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "Access your application:"
    echo "  - API: http://$(curl -s ifconfig.me):8000"
    echo "  - LiteLLM: http://$(curl -s ifconfig.me):4000"
    echo "  - Frontend: http://$(curl -s ifconfig.me)"
    echo ""
    echo "Useful commands:"
    echo "  - View logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo "  - Restart: sudo systemctl restart tokentrail"
    echo "  - Status: sudo systemctl status tokentrail"
    echo ""
}

# Main deployment flow
main() {
    log_info "Starting TokenTrail deployment..."

    check_prerequisites
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
    build)
        check_prerequisites
        build_frontend
        build_images
        ;;
    migrate)
        run_migrations
        ;;
    restart)
        deploy_services
        health_check
        ;;
    status)
        docker-compose -f docker-compose.prod.yml ps
        docker-compose -f docker-compose.prod.yml logs --tail=50
        ;;
    logs)
        docker-compose -f docker-compose.prod.yml logs -f "${2:-}"
        ;;
    *)
        echo "Usage: $0 {deploy|build|migrate|restart|status|logs [service]}"
        exit 1
        ;;
esac
