#!/bin/bash
# TokenTrail Deployment Script
# Run from repo root: ./deployment/scripts/deploy.sh
#
# Supports two modes:
#   1. Local build: ./deployment/scripts/deploy.sh deploy
#   2. ECR pull:    ./deployment/scripts/deploy.sh ecr-deploy [version]
#
# ECR versioning:
#   - Default: reads from .version file (set by push-to-ecr.sh)
#   - Or specify: ./deployment/scripts/deploy.sh ecr-deploy v1.2.0

set -e

# Get the script's directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="/opt/tokentrail"
VERSION_FILE="$DEPLOY_DIR/.version"

# ECR Configuration
AWS_REGION="${AWS_REGION:-eu-central-1}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

    if ! command -v docker compose &> /dev/null; then
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

    # Copy backend (for Docker build context)
    if [ -d "$REPO_ROOT/backend" ]; then
        log_info "Copying backend..."
        cp -r "$REPO_ROOT/backend" "$DEPLOY_DIR/"
    fi

    # Copy frontend (for Docker build context)
    if [ -d "$REPO_ROOT/frontend" ]; then
        log_info "Copying frontend..."
        cp -r "$REPO_ROOT/frontend" "$DEPLOY_DIR/"
    fi

    # Copy litellm callback
    if [ -d "$REPO_ROOT/litellm" ]; then
        log_info "Copying litellm callback..."
        cp -r "$REPO_ROOT/litellm" "$DEPLOY_DIR/"
    fi

    # Create certbot directories
    mkdir -p "$DEPLOY_DIR/certbot/conf" "$DEPLOY_DIR/certbot/www"

    log_info "Files copied successfully"
}

# Build Docker images (includes frontend build inside container)
build_images() {
    log_info "Building Docker images..."
    cd "$DEPLOY_DIR"

    docker compose -f docker-compose.prod.yml build
    log_info "Docker images built successfully (frontend built inside container)"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    cd "$DEPLOY_DIR"

    docker compose -f docker-compose.prod.yml run --rm api alembic upgrade head
    log_info "Migrations completed"
}

# Deploy services
deploy_services() {
    log_info "Deploying services..."
    cd "$DEPLOY_DIR"

    # Stop existing services
    docker compose -f docker-compose.prod.yml down --remove-orphans || true

    # Start services
    docker compose -f docker-compose.prod.yml up -d

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
        docker compose -f docker-compose.prod.yml logs --tail=50 api
        exit 1
    fi

    log_info "Container status:"
    docker compose -f docker-compose.prod.yml ps
}

# ECR Login
ecr_login() {
    log_info "Logging in to ECR..."

    if [ -z "$AWS_ACCOUNT_ID" ]; then
        AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
        if [ -z "$AWS_ACCOUNT_ID" ]; then
            log_error "Failed to get AWS account ID. Make sure AWS CLI is configured or IAM role is attached."
            exit 1
        fi
    fi

    ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    aws ecr get-login-password --region "${AWS_REGION}" | \
        docker login --username AWS --password-stdin "${ECR_REGISTRY}"

    log_info "ECR login successful"
}

# Pull images from ECR
ecr_pull() {
    local version="${1:-}"

    # Determine version to deploy
    if [ -z "$version" ]; then
        if [ -f "$VERSION_FILE" ]; then
            version=$(cat "$VERSION_FILE")
            log_info "Using version from .version file: ${version}"
        else
            version="latest"
            log_warn "No version specified and .version file not found. Using 'latest'"
        fi
    fi

    export IMAGE_TAG="$version"
    export ECR_REGISTRY
    export ENVIRONMENT

    log_info "Pulling images (version: ${IMAGE_TAG})..."
    cd "$DEPLOY_DIR"
    docker compose -f docker-compose.prod.yml pull

    # Save deployed version
    echo "${IMAGE_TAG}" > "$VERSION_FILE"
    log_info "Version ${IMAGE_TAG} saved to .version"
}

# ECR Deploy (pull from ECR instead of building locally)
ecr_deploy() {
    local version="${1:-}"

    log_info "Starting ECR deployment..."
    log_info "Deploy dir: $DEPLOY_DIR"

    ecr_login
    ecr_pull "$version"
    deploy_services
    health_check
    print_summary

    log_info "ECR deployment completed successfully!"
}

# Print deployment summary
print_summary() {
    local public_ip=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_IP")

    echo ""
    echo "=========================================="
    echo "  TokenTrail Deployment Complete!"
    echo "=========================================="
    echo ""
    echo "Services running:"
    cd "$DEPLOY_DIR"
    docker compose -f docker-compose.prod.yml ps
    echo ""
    echo "Access your application:"
    echo "  - Frontend: http://$public_ip"
    echo "  - API: http://$public_ip:8000"
    echo "  - API Docs: http://$public_ip:8000/docs"
    echo "  - LiteLLM: http://$public_ip:4000"
    echo ""
    echo "Useful commands:"
    echo "  - View logs: cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml logs -f"
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
    copy_files
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
    ecr-deploy)
        ecr_deploy "${2:-}"
        ;;
    ecr-pull)
        ecr_login
        ecr_pull "${2:-}"
        ;;
    copy)
        copy_files
        ;;
    build)
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
        docker compose -f docker-compose.prod.yml ps
        docker compose -f docker-compose.prod.yml logs --tail=20
        ;;
    logs)
        cd "$DEPLOY_DIR"
        docker compose -f docker-compose.prod.yml logs -f "${2:-}"
        ;;
    version)
        if [ -f "$VERSION_FILE" ]; then
            echo "Deployed version: $(cat $VERSION_FILE)"
        else
            echo "No version file found"
        fi
        ;;
    *)
        echo "Usage: $0 {deploy|ecr-deploy|copy|build|migrate|restart|status|logs|version}"
        echo ""
        echo "Commands:"
        echo "  deploy           - Full local deployment (copy, build, migrate, start)"
        echo "  ecr-deploy [ver] - Deploy from ECR (pull, start) - uses .version or 'latest'"
        echo "  ecr-pull [ver]   - Pull images from ECR without deploying"
        echo "  copy             - Copy files to $DEPLOY_DIR"
        echo "  build            - Build Docker images locally"
        echo "  migrate          - Run database migrations"
        echo "  restart          - Restart all services"
        echo "  status           - Show service status and recent logs"
        echo "  logs [service]   - Follow logs (optionally specify service)"
        echo "  version          - Show currently deployed version"
        echo ""
        echo "ECR Examples:"
        echo "  $0 ecr-deploy              # Deploy from .version file"
        echo "  $0 ecr-deploy 3d3c86f      # Deploy specific git commit"
        echo "  $0 ecr-deploy v1.0.0       # Deploy semantic version"
        exit 1
        ;;
esac
