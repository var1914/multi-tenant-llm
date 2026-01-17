# UsageFlow Terraform Infrastructure

Deploy UsageFlow to AWS with a single command. This creates:

- **VPC** with public and private subnets
- **RDS PostgreSQL** in private subnet (not publicly accessible)
- **EC2** with Docker in public subnet
- **Security Groups** with proper access controls

## Architecture

```
                                    ┌─────────────────────────────────────┐
                                    │              AWS VPC                │
                                    │           10.0.0.0/16               │
┌──────────┐                        │                                     │
│  Users   │                        │  ┌─────────────────────────────┐   │
│          │─────────80/443────────▶│  │     Public Subnet           │   │
└──────────┘                        │  │       10.0.1.0/24           │   │
                                    │  │                             │   │
┌──────────┐                        │  │  ┌─────────────────────┐   │   │
│   You    │─────────SSH:22────────▶│  │  │   EC2 (t3.medium)   │   │   │
│  (Dev)   │                        │  │  │   - Docker          │   │   │
└──────────┘                        │  │  │   - Nginx           │   │   │
                                    │  │  │   - FastAPI         │   │   │
                                    │  │  │   - Redis           │   │   │
                                    │  │  │   - LiteLLM         │   │   │
                                    │  │  └──────────┬──────────┘   │   │
                                    │  └─────────────│───────────────┘   │
                                    │                │                    │
                                    │                │ Port 5432          │
                                    │                ▼                    │
                                    │  ┌─────────────────────────────┐   │
                                    │  │     Private Subnet          │   │
                                    │  │       10.0.10.0/24          │   │
                                    │  │                             │   │
                                    │  │  ┌─────────────────────┐   │   │
                                    │  │  │  RDS PostgreSQL     │   │   │
                                    │  │  │  (db.t3.micro)      │   │   │
                                    │  │  │  - Not public       │   │   │
                                    │  │  │  - Encrypted        │   │   │
                                    │  │  └─────────────────────┘   │   │
                                    │  └─────────────────────────────┘   │
                                    │                                     │
                                    └─────────────────────────────────────┘
```

## Cost Estimate (Validation)

| Resource | Size | Monthly Cost |
|----------|------|--------------|
| EC2 | t3.medium | ~$30 |
| RDS | db.t3.micro | ~$15 |
| NAT Gateway | - | ~$32 |
| Elastic IP | - | ~$4 |
| Storage | 50GB total | ~$5 |
| **Total** | | **~$86/mo** |

> 💡 **Tip**: For dev/testing, you can remove the NAT Gateway (~$32/mo) if RDS doesn't need outbound internet.

## Prerequisites

1. **AWS CLI** configured with credentials
   ```bash
   aws configure
   ```

2. **Terraform** >= 1.0.0
   ```bash
   brew install terraform  # macOS
   ```

3. **SSH Key Pair** created in AWS
   ```bash
   aws ec2 create-key-pair --key-name usageflow-key --query 'KeyMaterial' --output text > usageflow-key.pem
   chmod 400 usageflow-key.pem
   ```

## Quick Start

### 1. Configure Variables

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Required changes:**
```hcl
ec2_key_name = "usageflow-key"  # Your SSH key name
allowed_ssh_cidrs = ["YOUR_IP/32"]  # Your IP for SSH access
```

### 2. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Deploy (takes ~10-15 minutes)
terraform apply
```

### 3. Get Connection Details

```bash
# View all outputs
terraform output

# Get specific values
terraform output ec2_public_ip
terraform output -raw db_password
terraform output ssh_command
```

### 4. Connect to EC2

```bash
# SSH into the instance
ssh -i usageflow-key.pem ubuntu@$(terraform output -raw ec2_public_ip)

# Check setup logs
sudo tail -f /var/log/user-data.log
```

### 5. Deploy Application

On the EC2 instance:

```bash
cd /opt/usageflow

# Clone your repository
git clone https://github.com/your-org/usageflow.git .

# Update environment file with API keys
nano .env

# Deploy
./deploy.sh
```

### 6. Setup SSL (Optional)

```bash
# On EC2 instance
sudo certbot --nginx -d your-domain.com
```

## File Structure

```
infrastructure/terraform/
├── main.tf                 # Main configuration
├── variables.tf            # Variable definitions
├── terraform.tfvars        # Your values (git-ignored)
├── terraform.tfvars.example
├── README.md
└── modules/
    ├── vpc/                # VPC, subnets, NAT
    ├── security/           # Security groups
    ├── rds/                # PostgreSQL database
    └── ec2/                # Application server
        └── user_data.sh    # Bootstrap script
```

## Common Operations

### Scale Up EC2

```hcl
# In terraform.tfvars
ec2_instance_type = "t3.large"  # 2 vCPU, 8GB RAM
```

```bash
terraform apply
```

### Scale Up RDS

```hcl
# In terraform.tfvars
db_instance_class = "db.t3.small"  # 2 vCPU, 2GB RAM
```

```bash
terraform apply
```

### Enable Multi-AZ for RDS

```hcl
# In terraform.tfvars
db_multi_az = true
```

### View RDS Connection String

```bash
# From your local machine
terraform output -raw rds_endpoint

# Connection string format
postgresql://usageflow:PASSWORD@ENDPOINT:5432/usageflow
```

### Connect to RDS via SSH Tunnel

```bash
# Create tunnel through EC2
ssh -i usageflow-key.pem -L 5432:RDS_ENDPOINT:5432 ubuntu@EC2_IP

# Then connect locally
psql -h localhost -U usageflow -d usageflow
```

## Destroy Infrastructure

```bash
# Remove all resources
terraform destroy

# Force destroy (skip confirmation)
terraform destroy -auto-approve
```

## Troubleshooting

### EC2 not starting containers

```bash
# Check Docker
sudo systemctl status docker

# Check user-data script
sudo cat /var/log/user-data.log

# Manual start
cd /opt/usageflow
sudo docker-compose up -d
```

### Can't connect to RDS

```bash
# Check security groups allow EC2 → RDS
# Test from EC2
nc -zv RDS_ENDPOINT 5432

# Check RDS status in AWS Console
```

### Application errors

```bash
# View container logs
cd /opt/usageflow
docker-compose logs -f api

# View all containers
docker-compose ps
```

## Security Notes

1. **SSH Access**: Restrict `allowed_ssh_cidrs` to your IP only
2. **RDS**: Not publicly accessible, only EC2 can connect
3. **Secrets**: Generated by Terraform, stored in state file
4. **State File**: Consider using S3 backend for team use

## Next Steps

- [ ] Set up CI/CD pipeline
- [ ] Configure CloudWatch monitoring
- [ ] Set up automated backups
- [ ] Add CloudFront CDN for frontend
- [ ] Configure Route53 for custom domain
