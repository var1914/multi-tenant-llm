#!/bin/bash
# =============================================================================
# Push Docker images to ECR with versioning
# =============================================================================
#
# Usage: ./scripts/push-to-ecr.sh [options]
#
# Options:
#   -t, --tag TAG     Use specific tag (default: git short hash)
#   -l, --latest      Use 'latest' tag instead of git hash
#   --no-latest       Don't also tag as 'latest'
#   -h, --help        Show this help
#
# Environment variables:
#   AWS_REGION       - AWS region (default: eu-central-1)
#   AWS_ACCOUNT_ID   - AWS account ID (auto-detected if not set)
#   ENVIRONMENT      - Environment name (default: production)
#
# Examples:
#   ./scripts/push-to-ecr.sh              # Uses git commit hash (e.g., abc1234)
#   ./scripts/push-to-ecr.sh -t v1.2.0    # Uses semantic version
#   ./scripts/push-to-ecr.sh -l           # Uses 'latest'
#
# =============================================================================

set -e

# Configuration
AWS_REGION="${AWS_REGION:-eu-central-1}"
ENVIRONMENT="${ENVIRONMENT:-production}"
ALSO_TAG_LATEST=true
USE_GIT_HASH=true

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--tag)
            IMAGE_TAG="$2"
            USE_GIT_HASH=false
            shift 2
            ;;
        -l|--latest)
            IMAGE_TAG="latest"
            USE_GIT_HASH=false
            ALSO_TAG_LATEST=false
            shift
            ;;
        --no-latest)
            ALSO_TAG_LATEST=false
            shift
            ;;
        -h|--help)
            head -30 "$0" | tail -25
            exit 0
            ;;
        *)
            IMAGE_TAG="$1"
            USE_GIT_HASH=false
            shift
            ;;
    esac
done

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Auto-generate tag from git commit if not specified
if [ "$USE_GIT_HASH" = true ]; then
    cd "$PROJECT_ROOT"
    GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    GIT_DIRTY=""
    if ! git diff --quiet 2>/dev/null; then
        GIT_DIRTY="-dirty"
    fi
    IMAGE_TAG="${GIT_HASH}${GIT_DIRTY}"
fi

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

# Also tag as latest
if [ "$ALSO_TAG_LATEST" = true ] && [ "$IMAGE_TAG" != "latest" ]; then
    log_info "Also tagging API as latest..."
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

# Also tag as latest
if [ "$ALSO_TAG_LATEST" = true ] && [ "$IMAGE_TAG" != "latest" ]; then
    log_info "Also tagging Frontend as latest..."
    docker tag "${FRONTEND_REPO}:${IMAGE_TAG}" "${ECR_REGISTRY}/${FRONTEND_REPO}:latest"
    docker push "${ECR_REGISTRY}/${FRONTEND_REPO}:latest"
fi

# Save version to file for deployment
VERSION_FILE="${PROJECT_ROOT}/deployment/.version"
echo "${IMAGE_TAG}" > "${VERSION_FILE}"
log_info "Version saved to ${VERSION_FILE}"

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
echo "  export IMAGE_TAG=${IMAGE_TAG}"
echo "  aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}"
echo "  docker compose -f docker-compose.prod.yml pull"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo ""
log_info "Or use the deploy script:"
echo "  ./scripts/deploy.sh ${IMAGE_TAG}"
