#!/bin/bash
# =============================================================================
# Deploy TokenTrail from ECR with versioning
# =============================================================================
#
# Usage: ./scripts/deploy.sh [version]
#
# Options:
#   version    Image tag to deploy (default: reads from .version file or 'latest')
#
# Environment variables:
#   AWS_REGION       - AWS region (default: eu-central-1)
#   AWS_ACCOUNT_ID   - AWS account ID (auto-detected if not set)
#   ENVIRONMENT      - Environment name (default: production)
#
# Examples:
#   ./scripts/deploy.sh              # Deploy version from .version file
#   ./scripts/deploy.sh abc1234      # Deploy specific git commit
#   ./scripts/deploy.sh v1.2.0       # Deploy semantic version
#   ./scripts/deploy.sh latest       # Deploy latest
#
# =============================================================================

set -e

# Configuration
AWS_REGION="${AWS_REGION:-eu-central-1}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_DIR="${PROJECT_ROOT}/deployment"
VERSION_FILE="${DEPLOYMENT_DIR}/.version"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Determine version to deploy
if [ -n "$1" ]; then
    IMAGE_TAG="$1"
elif [ -f "$VERSION_FILE" ]; then
    IMAGE_TAG=$(cat "$VERSION_FILE")
    log_info "Using version from .version file: ${IMAGE_TAG}"
else
    IMAGE_TAG="latest"
    log_warn "No version specified and .version file not found. Using 'latest'"
fi

# Get AWS account ID if not set
if [ -z "$AWS_ACCOUNT_ID" ]; then
    log_info "Detecting AWS account ID..."
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
    if [ -z "$AWS_ACCOUNT_ID" ]; then
        log_error "Failed to get AWS account ID. Make sure AWS CLI is configured."
        exit 1
    fi
fi

ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  TokenTrail Deployment${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Environment:   ${ENVIRONMENT}"
echo "  Version:       ${IMAGE_TAG}"
echo "  ECR Registry:  ${ECR_REGISTRY}"
echo ""

# Login to ECR
log_info "Logging in to ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | \
    docker login --username AWS --password-stdin "${ECR_REGISTRY}"

# Export environment variables for docker-compose
export ECR_REGISTRY
export ENVIRONMENT
export IMAGE_TAG

cd "$DEPLOYMENT_DIR"

# Pull new images
log_info "Pulling images (version: ${IMAGE_TAG})..."
docker compose -f docker-compose.prod.yml pull

# Deploy
log_info "Deploying..."
docker compose -f docker-compose.prod.yml up -d

# Show status
echo ""
log_info "Deployment complete!"
echo ""
docker compose -f docker-compose.prod.yml ps

# Save deployed version
echo "${IMAGE_TAG}" > "${VERSION_FILE}"
log_info "Deployed version ${IMAGE_TAG} saved to .version"
