#!/bin/bash
# UsageFlow Terraform Deployment Script
# Usage: ./deploy.sh [plan|apply|destroy]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"

cd "$TERRAFORM_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}UsageFlow Terraform Deployment${NC}"
echo "================================"

# Check prerequisites
check_prerequisites() {
    echo -e "\n${YELLOW}Checking prerequisites...${NC}"

    if ! command -v terraform &> /dev/null; then
        echo -e "${RED}Error: Terraform is not installed${NC}"
        echo "Install with: brew install terraform"
        exit 1
    fi

    if ! command -v aws &> /dev/null; then
        echo -e "${RED}Error: AWS CLI is not installed${NC}"
        echo "Install with: brew install awscli"
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}Error: AWS credentials not configured${NC}"
        echo "Run: aws configure"
        exit 1
    fi

    # Check terraform.tfvars exists
    if [ ! -f "terraform.tfvars" ]; then
        echo -e "${RED}Error: terraform.tfvars not found${NC}"
        echo "Copy terraform.tfvars.example to terraform.tfvars and configure"
        exit 1
    fi

    echo -e "${GREEN}✓ All prerequisites met${NC}"
}

# Initialize Terraform
init() {
    echo -e "\n${YELLOW}Initializing Terraform...${NC}"
    terraform init -upgrade
    echo -e "${GREEN}✓ Terraform initialized${NC}"
}

# Plan deployment
plan() {
    echo -e "\n${YELLOW}Planning infrastructure changes...${NC}"
    terraform plan -out=tfplan
    echo -e "${GREEN}✓ Plan saved to tfplan${NC}"
}

# Apply deployment
apply() {
    if [ -f "tfplan" ]; then
        echo -e "\n${YELLOW}Applying saved plan...${NC}"
        terraform apply tfplan
        rm tfplan
    else
        echo -e "\n${YELLOW}Applying changes...${NC}"
        terraform apply
    fi

    echo -e "\n${GREEN}✓ Deployment complete!${NC}"
    echo -e "\n${YELLOW}Connection Details:${NC}"
    echo "=================="
    terraform output
}

# Destroy infrastructure
destroy() {
    echo -e "\n${RED}WARNING: This will destroy all infrastructure!${NC}"
    read -p "Are you sure? (yes/no): " confirm

    if [ "$confirm" == "yes" ]; then
        echo -e "\n${YELLOW}Destroying infrastructure...${NC}"
        terraform destroy
        echo -e "${GREEN}✓ Infrastructure destroyed${NC}"
    else
        echo "Aborted"
        exit 0
    fi
}

# Show outputs
outputs() {
    echo -e "\n${YELLOW}Infrastructure Outputs:${NC}"
    terraform output
}

# SSH to EC2
ssh_connect() {
    EC2_IP=$(terraform output -raw ec2_public_ip 2>/dev/null)
    KEY_NAME=$(grep 'ec2_key_name' terraform.tfvars | cut -d'"' -f2)

    if [ -z "$EC2_IP" ]; then
        echo -e "${RED}Error: EC2 not deployed or IP not available${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Connecting to EC2...${NC}"
    echo "ssh -i ${KEY_NAME}.pem ubuntu@${EC2_IP}"
    ssh -i "${KEY_NAME}.pem" "ubuntu@${EC2_IP}"
}

# Main
case "${1:-}" in
    plan)
        check_prerequisites
        init
        plan
        ;;
    apply)
        check_prerequisites
        init
        plan
        apply
        ;;
    destroy)
        check_prerequisites
        destroy
        ;;
    outputs)
        outputs
        ;;
    ssh)
        ssh_connect
        ;;
    *)
        echo "Usage: $0 {plan|apply|destroy|outputs|ssh}"
        echo ""
        echo "Commands:"
        echo "  plan     - Preview infrastructure changes"
        echo "  apply    - Deploy infrastructure"
        echo "  destroy  - Remove all infrastructure"
        echo "  outputs  - Show deployment outputs"
        echo "  ssh      - Connect to EC2 instance"
        exit 1
        ;;
esac
