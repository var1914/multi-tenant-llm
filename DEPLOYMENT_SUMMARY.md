# TokenTrail Deployment Summary

Complete guide for deploying TokenTrail to production.

## What We've Built

### Core Application
- ✅ **Backend** (FastAPI + PostgreSQL + Redis)
- ✅ **Frontend** (React + TypeScript + Vite)
- ✅ **LiteLLM Proxy** (with TokenTrail callback)
- ✅ **Database Migrations** (Alembic)
- ✅ **Infrastructure as Code** (Terraform for AWS)
- ✅ **Documentation Site** (VitePress)

### Key Features Implemented
1. **Budget Limits & Blocking** - Prevent runaway costs
2. **Smart Model Routing** - Save 40-60% automatically
3. **Per-Customer Tracking** - Know exactly who costs what
4. **Real-Time Analytics** - Dashboard with live metrics
5. **Complete Rebrand** - UsageFlow → TokenTrail

## Deployment Checklist

### 1. Documentation Site (`docs.tokentrailapp.com`)

**Build & Deploy:**
```bash
cd docs-site
npm install
npm run docs:build
```

**Deploy Options:**
- **Vercel** (Recommended): `vercel --prod`
- **Netlify**: Upload `.vitepress/dist` folder
- **GitHub Pages**: Use workflow in `docs-site/README.md`

**DNS Setup:**
```
Type: CNAME
Name: docs
Value: [your-deployment-url]
```

### 2. Main Application (`app.tokentrailapp.com`)

**Option A: Self-Hosted (Terraform + AWS)**

```bash
cd infrastructure/terraform

# Configure variables
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # Edit with your settings

# Deploy infrastructure
terraform init
terraform plan
terraform apply

# Note the EC2 public IP from output
# SSH into EC2 and deploy app
```

**Option B: Docker Compose (Simple)**

```bash
# Copy environment file
cp .env.example .env
nano .env  # Add your API keys

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

**Option C: Production Docker Compose**

```bash
# Use production compose file
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Database Setup

**Run migrations:**
```bash
# If using Docker
docker-compose exec api alembic upgrade head

# If running locally
cd backend
alembic upgrade head
```

**Migrations included:**
1. `001-006` - Core schema (users, tenants, usage events)
2. `007` - Prediction alerts
3. `008` - Agent workflows
4. `009` - Workflow budgets
5. `010` - Outcome pricing
6. `011` - Table partitioning (performance)
7. `012` - Performance indexes
8. `013` - Usage limit blocking

### 4. Environment Variables

**Required for Production:**

```bash
# Database
POSTGRES_USER=tokentrail
POSTGRES_PASSWORD=[strong-password]
POSTGRES_DB=tokentrail

# API
JWT_SECRET_KEY=[random-64-char-string]
TOKENTRAIL_INTERNAL_API_KEY=[random-32-char-string]

# LLM Providers (add your keys)
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# LiteLLM
LITELLM_MASTER_KEY=[random-string]
LITELLM_SALT_KEY=[random-string]

# Stripe (optional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**Generate secure keys:**
```bash
# JWT Secret
openssl rand -hex 32

# API Keys
openssl rand -base64 32
```

### 5. DNS Configuration

**Required DNS Records:**

```
# Main app
app.tokentrailapp.com     A      [EC2-Public-IP or Load-Balancer-IP]

# API (can be same server)
api.tokentrailapp.com     A      [EC2-Public-IP or Load-Balancer-IP]

# Docs
docs.tokentrailapp.com    CNAME  [vercel-or-netlify-url]

# Root domain
tokentrailapp.com         A      [EC2-Public-IP or Load-Balancer-IP]
www.tokentrailapp.com     CNAME  tokentrailapp.com
```

### 6. SSL Certificates

**Option A: Let's Encrypt (Free)**

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d tokentrailapp.com -d www.tokentrailapp.com -d app.tokentrailapp.com -d api.tokentrailapp.com

# Auto-renewal (already configured)
sudo certbot renew --dry-run
```

**Option B: AWS Certificate Manager**

- Request certificate in ACM
- Validate via DNS
- Attach to Load Balancer

### 7. Nginx Configuration

**Production nginx.conf:**

```nginx
server {
    listen 80;
    server_name tokentrailapp.com www.tokentrailapp.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tokentrailapp.com www.tokentrailapp.com;

    ssl_certificate /etc/letsencrypt/live/tokentrailapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tokentrailapp.com/privkey.pem;

    # Frontend
    location / {
        root /var/www/tokentrail/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 443 ssl http2;
    server_name api.tokentrailapp.com;

    ssl_certificate /etc/letsencrypt/live/tokentrailapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tokentrailapp.com/privkey.pem;

    # Backend API
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # LiteLLM Proxy
    location /v1/ {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Post-Deployment Tasks

### 1. Create Admin User

```bash
# SSH into server
ssh ubuntu@[EC2-IP]

# Run admin creation script
docker-compose exec api python -m scripts.create_admin \
  --email admin@tokentrailapp.com \
  --password [secure-password]
```

### 2. Test the Application

**Frontend:**
- Visit https://tokentrailapp.com
- Register new account
- Check dashboard loads

**API:**
```bash
curl https://api.tokentrailapp.com/health
# Should return: {"status": "healthy"}
```

**LiteLLM Proxy:**
```bash
curl https://api.tokentrailapp.com/v1/models \
  -H "Authorization: Bearer tt_live_..."
```

### 3. Configure Monitoring

**Set up Sentry (Error Tracking):**

```bash
# Frontend
VITE_SENTRY_DSN=https://...@sentry.io/...

# Backend
SENTRY_DSN=https://...@sentry.io/...
```

**Set up Uptime Monitoring:**
- UptimeRobot (free)
- Pingdom
- AWS CloudWatch

**Monitor these endpoints:**
- https://tokentrailapp.com (frontend)
- https://api.tokentrailapp.com/health (backend)
- https://docs.tokentrailapp.com (docs)

### 4. Set Up Backups

**Database Backups:**

```bash
# Daily backup cron job
0 2 * * * docker-compose exec -T postgres pg_dump -U tokentrail tokentrail | gzip > /backups/tokentrail_$(date +\%Y\%m\%d).sql.gz

# Retention: keep last 30 days
find /backups -name "tokentrail_*.sql.gz" -mtime +30 -delete
```

**Configuration Backups:**
- Backup `.env` file (encrypted)
- Backup nginx configs
- Keep Terraform state in S3

### 5. Security Hardening

**Firewall:**
```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

**Security Headers (nginx):**
```nginx
add_header X-Frame-Options "SAMEORIGIN";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000";
```

**Rate Limiting:**
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api/ {
    limit_req zone=api burst=20 nodelay;
}
```

## Cost Estimates

### AWS Infrastructure (Terraform Deployment)

**Minimum Setup:**
- EC2 t3.small: ~$15/month
- RDS db.t3.micro: ~$15/month
- Data transfer: ~$5/month
- **Total: ~$35/month**

**Recommended Setup:**
- EC2 t3.medium: ~$30/month
- RDS db.t3.small: ~$30/month
- Load Balancer: ~$16/month
- Data transfer: ~$10/month
- **Total: ~$86/month**

**Additional Costs:**
- Domain: ~$12/year
- SSL Certificate: Free (Let's Encrypt)
- Vercel (docs): Free
- Monitoring (basic): Free

### Scaling Considerations

**When to scale up:**

| Metric | Threshold | Action |
|--------|-----------|--------|
| API requests | >100K/day | Add second API server |
| DB connections | >80% | Increase RDS instance size |
| Response time | >500ms p95 | Add Redis caching |
| Disk usage | >80% | Increase storage |

## Maintenance

### Regular Tasks

**Daily:**
- Monitor error rates (Sentry)
- Check uptime (monitoring service)
- Review top customers (dashboard)

**Weekly:**
- Review cost trends
- Check for failed migrations
- Update dependencies (security patches)

**Monthly:**
- Database optimization (VACUUM, ANALYZE)
- Review and archive old logs
- Update documentation
- Security audit

### Updates

**Deploy Backend Update:**
```bash
git pull origin main
docker-compose -f docker-compose.prod.yml build api
docker-compose -f docker-compose.prod.yml up -d api
```

**Deploy Frontend Update:**
```bash
git pull origin main
cd frontend
npm run build
# Upload dist/ to server or CDN
```

**Run New Migrations:**
```bash
docker-compose exec api alembic upgrade head
```

## Rollback Plan

**If deployment fails:**

1. **Rollback code:**
```bash
git revert HEAD
docker-compose up -d
```

2. **Rollback database:**
```bash
# Restore from backup
gunzip < /backups/tokentrail_YYYYMMDD.sql.gz | docker-compose exec -T postgres psql -U tokentrail tokentrail
```

3. **Notify users:**
- Status page update
- Email to affected customers

## Support & Resources

- **Documentation**: https://docs.tokentrailapp.com
- **Tech Stack**: See [TECH_STACK.md](./TECH_STACK.md)
- **GitHub Issues**: Report bugs and feature requests
- **Email**: support@tokentrailapp.com

## Next Steps After Deployment

1. ✅ Set up monitoring and alerts
2. ✅ Configure database backups
3. ✅ Enable SSL/HTTPS
4. ✅ Create first admin user
5. ✅ Test all major features
6. → Add demo video to landing page
7. → Set up email notifications (SendGrid/Mailgun)
8. → Configure Stripe for billing
9. → Launch marketing site
10. → Start accepting beta users

---

**Ready to Deploy?** Start with the Docker Compose option for quickest setup, then migrate to AWS infrastructure when scaling.

Good luck! 🚀
