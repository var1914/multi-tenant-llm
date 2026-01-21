# AWS Setup Guide for TokenTrail Deployment

This guide walks you through setting up AWS credentials and deploying TokenTrail infrastructure using Terraform.

## Prerequisites

- AWS Account (sign up at https://aws.amazon.com)
- Terminal access
- Homebrew (for macOS)

---

## Part 1: Install AWS CLI

### Option A: Using Homebrew (Recommended for macOS)
```bash
brew install awscli
```

### Option B: Direct Download
```bash
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "/tmp/AWSCLIV2.pkg"
sudo installer -pkg /tmp/AWSCLIV2.pkg -target /
```

### Verify Installation
```bash
aws --version
# Should output: aws-cli/2.x.x ...
```

---

## Part 2: Create IAM User in AWS Console

### Step 2.1: Go to IAM Console
1. Open: https://console.aws.amazon.com/iam/
2. Click **Users** in left sidebar
3. Click **Add users** button

### Step 2.2: Configure User
1. **User name**: `tokentrail-deployer`
2. **Access type**: Select "Programmatic access" (Access key - Programmatic access)
3. Click **Next: Permissions**

### Step 2.3: Set Permissions

**Option A: Quick Setup (Attach Existing Policies)**
Attach these managed policies:
- ✅ `AmazonEC2FullAccess`
- ✅ `AmazonRDSFullAccess`
- ✅ `AmazonVPCFullAccess`
- ✅ `IAMFullAccess`

**Option B: Secure Setup (Custom Policy)**
1. Click **Create policy**
2. Go to JSON tab
3. Paste contents from `infrastructure/aws-iam-policy.json`
4. Name it: `TokenTrailDeploymentPolicy`
5. Attach this policy to the user

### Step 2.4: Review and Create
1. Click **Next: Tags** (skip tags)
2. Click **Next: Review**
3. Click **Create user**

### Step 2.5: Save Credentials ⚠️ IMPORTANT
You'll see a success screen with:
- **Access key ID**: `AKIA...` (like AKIAIOSFODNN7EXAMPLE)
- **Secret access key**: (hidden by default, click "Show" to reveal)

**⚠️ CRITICAL**: Download the CSV or copy these credentials NOW. You cannot retrieve the secret key later!

---

## Part 3: Configure AWS CLI

### Step 3.1: Run AWS Configure
```bash
aws configure
```

You'll be prompted for:

```
AWS Access Key ID [None]: AKIA................    # Paste your access key
AWS Secret Access Key [None]: ................  # Paste your secret key
Default region name [None]: us-east-1           # Choose your region
Default output format [None]: json              # Press Enter
```

### Step 3.2: Verify Configuration
```bash
# Test credentials
aws sts get-caller-identity

# Should output your user info:
# {
#     "UserId": "AIDA...",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/tokentrail-deployer"
# }
```

### Step 3.3: Check Config Files (Optional)
```bash
# View credentials (keep these secret!)
cat ~/.aws/credentials

# View config
cat ~/.aws/config
```

---

## Part 4: Create EC2 SSH Key Pair

You need an SSH key to access your EC2 instances.

### Step 4.1: Create Key Pair in AWS Console
1. Go to: https://console.aws.amazon.com/ec2/
2. Select your region (top-right corner): **us-east-1** (or your preferred region)
3. Click **Key Pairs** in left sidebar (under Network & Security)
4. Click **Create key pair**
5. Settings:
   - **Name**: `tokentrail-key`
   - **Key pair type**: RSA
   - **Private key file format**: `.pem` (for macOS/Linux)
6. Click **Create key pair**
7. The `.pem` file will download automatically

### Step 4.2: Secure the Key File
```bash
# Move to .ssh directory
mv ~/Downloads/tokentrail-key.pem ~/.ssh/

# Set correct permissions (required!)
chmod 400 ~/.ssh/tokentrail-key.pem
```

### Step 4.3: Test SSH Key (after deployment)
```bash
# After Terraform creates your EC2 instance, you can SSH:
ssh -i ~/.ssh/tokentrail-key.pem ubuntu@<EC2_PUBLIC_IP>
```

---

## Part 5: Get Your Public IP Address

For security, we'll restrict SSH access to only your IP address.

```bash
# Get your public IP
curl -s ifconfig.me

# Example output: 203.0.113.45
```

**Save this IP** - you'll need it in the next step.

---

## Part 6: Configure terraform.tfvars

### Step 6.1: Update terraform.tfvars
```bash
cd infrastructure/terraform
```

Edit `terraform.tfvars` and update these required fields:

```hcl
# REQUIRED: SSH key pair name (must match what you created in AWS)
ec2_key_name = "tokentrail-key"

# REQUIRED: Your public IP (add /32 at the end)
allowed_ssh_cidrs = ["YOUR_IP_HERE/32"]  # e.g., ["203.0.113.45/32"]

# OPTIONAL: Update project name
project_name = "tokentrail"
environment  = "production"

# OPTIONAL: Set domain (leave empty to use EC2 IP)
domain_name = "tokentrailapp.com"
```

### Step 6.2: Full Example
```hcl
# Required
ec2_key_name = "tokentrail-key"
allowed_ssh_cidrs = ["203.0.113.45/32"]  # Replace with your IP

# General
project_name = "tokentrail"
environment  = "production"
aws_region   = "us-east-1"

# Instance sizes (cost optimization)
ec2_instance_type = "t3.small"      # ~$15/mo
db_instance_class = "db.t3.micro"   # FREE (12 months)
enable_nat_gateway = false           # Save $32/mo

# Domain (optional)
domain_name = "tokentrailapp.com"

# Database
db_name     = "tokentrail"
db_username = "tokentrail"
```

---

## Part 7: Initialize Terraform

### Step 7.1: Install Terraform (if not installed)
```bash
# macOS
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Verify
terraform --version
```

### Step 7.2: Initialize Terraform
```bash
cd infrastructure/terraform

# Initialize (downloads providers)
terraform init
```

### Step 7.3: Validate Configuration
```bash
# Check syntax
terraform validate

# Preview what will be created
terraform plan
```

### Step 7.4: Review the Plan
Terraform will show you:
- ✅ VPC, subnets, internet gateway
- ✅ Security groups
- ✅ RDS PostgreSQL database
- ✅ EC2 instance
- ✅ Elastic IP

**Estimated cost**: ~$25-45/month (with RDS free tier)

---

## Part 8: Deploy Infrastructure

### Step 8.1: Apply Terraform Configuration
```bash
# Deploy everything
terraform apply

# Review the plan, then type: yes
```

This will take **5-10 minutes** to complete.

### Step 8.2: Save Outputs
After deployment, Terraform will output:

```
Outputs:

db_endpoint = "tokentrail-db.xxxxxxxx.us-east-1.rds.amazonaws.com:5432"
ec2_public_ip = "54.123.45.67"
ssh_command = "ssh -i ~/.ssh/tokentrail-key.pem ubuntu@54.123.45.67"
```

**Save these values** - you'll need them for application deployment.

---

## Part 9: Verify Deployment

### Step 9.1: SSH into EC2 Instance
```bash
ssh -i ~/.ssh/tokentrail-key.pem ubuntu@<EC2_PUBLIC_IP>
```

### Step 9.2: Test Database Connection
```bash
# From your local machine
PGPASSWORD=<db_password> psql -h <db_endpoint> -U tokentrail -d tokentrail

# Example:
# PGPASSWORD=yourpassword psql -h tokentrail-db.xxxxxxxx.us-east-1.rds.amazonaws.com -U tokentrail -d tokentrail
```

---

## Security Checklist ✅

Before going to production:

- [ ] AWS credentials stored securely (never commit to git!)
- [ ] SSH key has 400 permissions
- [ ] `allowed_ssh_cidrs` set to your IP only (not 0.0.0.0/0)
- [ ] Database password is strong and stored in environment variable
- [ ] RDS is in private subnet (no public access)
- [ ] Security groups are properly configured
- [ ] Enable MFA on AWS root account
- [ ] Enable CloudWatch logging
- [ ] Set up billing alerts in AWS Console

---

## Cost Optimization Tips 💰

### Current Setup (Validation/Startup)
- **t3.small EC2**: $15/mo
- **db.t3.micro RDS**: FREE (12 months), then $15/mo
- **Storage + EIP**: $10/mo
- **Total**: ~$25/mo (first year)

### After Free Tier Expires
- Consider Reserved Instances (up to 72% savings)
- Use Spot Instances for non-production
- Enable RDS autoscaling storage
- Set up AWS Budgets alerts

### Scaling Up (500+ users)
- Upgrade to **t3.medium EC2**: $30/mo
- Upgrade to **db.t3.small RDS**: $30/mo
- Enable Multi-AZ for high availability
- Add load balancer and auto-scaling

---

## Troubleshooting

### Issue: "aws: command not found"
**Solution**: Install AWS CLI (see Part 1)

### Issue: "InvalidKeyPair.NotFound"
**Solution**: Make sure `ec2_key_name` in terraform.tfvars matches the key pair name in AWS Console

### Issue: "UnauthorizedOperation"
**Solution**: IAM user doesn't have sufficient permissions. Attach required policies (see Part 2)

### Issue: "Error: Invalid CIDR block"
**Solution**: Make sure IP address in `allowed_ssh_cidrs` ends with `/32`
Example: `["203.0.113.45/32"]` not `["203.0.113.45"]`

### Issue: SSH connection refused
**Solution**:
1. Check security group allows your IP
2. Verify EC2 instance is running
3. Wait 2-3 minutes after instance launch

---

## Next Steps

After infrastructure is deployed:

1. **Deploy Application**: Use Docker to deploy backend and frontend
2. **Configure DNS**: Point tokentrailapp.com to EC2 Elastic IP
3. **Set up SSL**: Use Let's Encrypt/Certbot for HTTPS
4. **Configure Environment**: Set up .env files with database credentials
5. **Run Migrations**: Initialize database schema
6. **Deploy Docs**: Deploy VitePress docs to docs.tokentrailapp.com

---

## Quick Reference Commands

```bash
# AWS CLI
aws configure                           # Configure credentials
aws sts get-caller-identity            # Verify credentials
aws ec2 describe-instances             # List EC2 instances
aws rds describe-db-instances          # List RDS instances

# Terraform
terraform init                         # Initialize
terraform validate                     # Check syntax
terraform plan                         # Preview changes
terraform apply                        # Deploy
terraform destroy                      # Delete everything (careful!)
terraform output                       # Show outputs again

# SSH
ssh -i ~/.ssh/tokentrail-key.pem ubuntu@<IP>

# Database
PGPASSWORD=<password> psql -h <endpoint> -U tokentrail -d tokentrail
```

---

## Support

- Email: tokentrailapp@gmail.com
- GitHub: https://github.com/tokentrailapp/tokentrail
- Documentation: https://docs.tokentrailapp.com

---

**Created for TokenTrail** | Last updated: 2026-01-20
