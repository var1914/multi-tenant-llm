#!/bin/bash
# =============================================================================
# Push Docker images to ECR
# =============================================================================
#
# Usage: ./scripts/push-to-ecr.sh [tag]
#
# Environment variables required:
#   AWS_REGION       - AWS region (default: us-east-1)
#   AWS_ACCOUNT_ID   - AWS account ID (auto-detected if not set)
#   ENVIRONMENT      - Environment name (default: production)
#
# Prerequisites:
#   - AWS CLI configured with proper credentials
#   - Docker installed and running
#
# =============================================================================

set -e

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-production}"
IMAGE_TAG="${1:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get AWS account ID if not set
if [ -z "$AWS_ACCOUNT_ID" ]; then
    log_info "Detecting AWS account ID..."
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    if [ -z "$AWS_ACCOUNT_ID" ]; then
        log_error "Failed to get AWS account ID. Make sure AWS CLI is configured."
        exit 1
    fi
fi

ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
API_REPO="tokentrail-${ENVIRONMENT}-api"
FRONTEND_REPO="tokentrail-${ENVIRONMENT}-frontend"

log_info "Configuration:"
echo "  AWS Region:    ${AWS_REGION}"
echo "  AWS Account:   ${AWS_ACCOUNT_ID}"
echo "  Environment:   ${ENVIRONMENT}"
echo "  ECR Registry:  ${ECR_REGISTRY}"
echo "  Image Tag:     ${IMAGE_TAG}"
echo ""

# Login to ECR
log_info "Logging in to ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | \
    docker login --username AWS --password-stdin "${ECR_REGISTRY}"

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Build API image
log_info "Building API image..."
docker build \
    --platform linux/amd64 \
    -t "${API_REPO}:${IMAGE_TAG}" \
    -f "${PROJECT_ROOT}/backend/Dockerfile" \
    "${PROJECT_ROOT}/backend"

# Tag and push API image
log_info "Pushing API image to ECR..."
docker tag "${API_REPO}:${IMAGE_TAG}" "${ECR_REGISTRY}/${API_REPO}:${IMAGE_TAG}"
docker push "${ECR_REGISTRY}/${API_REPO}:${IMAGE_TAG}"

# Also tag as latest if not already
if [ "$IMAGE_TAG" != "latest" ]; then
    docker tag "${API_REPO}:${IMAGE_TAG}" "${ECR_REGISTRY}/${API_REPO}:latest"
    docker push "${ECR_REGISTRY}/${API_REPO}:latest"
fi

# Build Frontend image
log_info "Building Frontend image..."
docker build \
    --platform linux/amd64 \
    --build-arg VITE_API_URL=https://tokentrailapp.com \
    -t "${FRONTEND_REPO}:${IMAGE_TAG}" \
    -f "${PROJECT_ROOT}/frontend/Dockerfile" \
    "${PROJECT_ROOT}/frontend"

# Tag and push Frontend image
log_info "Pushing Frontend image to ECR..."
docker tag "${FRONTEND_REPO}:${IMAGE_TAG}" "${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}"
docker push "${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}"

# Also tag as latest if not already
if [ "$IMAGE_TAG" != "latest" ]; then
    docker tag "${FRONTEND_REPO}:${IMAGE_TAG}" "${ECR_REGISTRY}/${FRONTEND_REPO}:latest"
    docker push "${ECR_REGISTRY}/${FRONTEND_REPO}:latest"
fi

log_info "Done! Images pushed to ECR:"
echo ""
echo "  API:      ${ECR_REGISTRY}/${API_REPO}:${IMAGE_TAG}"
echo "  Frontend: ${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}"
echo ""
log_info "To deploy on EC2, run:"
echo ""
echo "  # On EC2 instance:"
echo "  export ECR_REGISTRY=${ECR_REGISTRY}"
echo "  export ENVIRONMENT=${ENVIRONMENT}"
echo "  aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}"
echo "  docker compose -f docker-compose.prod.yml pull"
echo "  docker compose -f docker-compose.prod.yml up -d"
