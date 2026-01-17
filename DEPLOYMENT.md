# UsageFlow Production Deployment Guide

This guide covers deploying UsageFlow to handle **1000+ concurrent users** on a medium AWS instance.

## Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS EC2 Instance                        │
│                    (t3.xlarge or m5.large)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────┐      ┌─────────┐      ┌─────────────────────┐    │
│   │  Nginx  │─────▶│   API   │─────▶│     PgBouncer       │    │
│   │  :80    │      │  :8000  │      │       :6432         │    │
│   │  :443   │      │(4 workers)     │  (connection pool)  │    │
│   └─────────┘      └─────────┘      └──────────┬──────────┘    │
│        │                                        │               │
│        │           ┌─────────┐      ┌──────────▼──────────┐    │
│        └──────────▶│ LiteLLM │      │    PostgreSQL       │    │
│                    │  :4000  │      │      :5432          │    │
│                    └─────────┘      │  (partitioned DB)   │    │
│                         │           └─────────────────────┘    │
│                         │                                       │
│                    ┌────▼────┐                                  │
│                    │  Redis  │                                  │
│                    │  :6379  │                                  │
│                    └─────────┘                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Recommended Instance Sizes

| Users | Instance Type | vCPU | RAM | Cost/mo |
|-------|--------------|------|-----|---------|
| 500 | t3.large | 2 | 8GB | ~$60 |
| 1000 | t3.xlarge | 4 | 16GB | ~$120 |
| 2500 | m5.xlarge | 4 | 16GB | ~$140 |
| 5000 | m5.2xlarge | 8 | 32GB | ~$280 |

## Quick Start Deployment

### 1. Clone and Configure

```bash
# Clone repository
git clone https://github.com/your-org/usageflow.git
cd usageflow

# Create production environment file
cp .env.production.example .env.production

# Edit with your values
nano .env.production
```

### 2. Build and Deploy

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 3. Run Database Migrations

```bash
# Enter API container
docker-compose -f docker-compose.prod.yml exec api bash

# Run migrations
alembic upgrade head

# Exit container
exit
```

### 4. Build Frontend

```bash
# Build production frontend
cd frontend
npm install
npm run build

# Copy dist to nginx volume (or use S3/CloudFront)
cp -r dist/* ../infrastructure/nginx/html/
```

## Key Configuration Files

### PostgreSQL (postgresql.conf)

Located at: `infrastructure/postgres/postgresql.conf`

Key settings for 16GB RAM instance:
```
shared_buffers = 2GB          # 25% of RAM
effective_cache_size = 6GB    # 75% of RAM
work_mem = 64MB               # Per-operation memory
maintenance_work_mem = 512MB  # For VACUUM/INDEX
max_connections = 200         # PgBouncer handles client pooling
```

### PgBouncer

Configured in `docker-compose.prod.yml`:
```yaml
MAX_CLIENT_CONN: 1000    # Max client connections
DEFAULT_POOL_SIZE: 50    # Connections per database
POOL_MODE: transaction   # Best for web apps
```

### Nginx

Located at: `infrastructure/nginx/conf.d/default.conf`

Rate limits:
- API: 100 req/sec per IP
- Auth: 10 req/sec per IP
- Connection limit: 20 per IP

## Database Scalability Features

### Table Partitioning

`usage_events` table is partitioned by month:
```sql
-- Partitions are auto-created for 12 months ahead
usage_events_y2025m01
usage_events_y2025m02
...

-- Query only scans relevant partitions
SELECT * FROM usage_events
WHERE event_timestamp BETWEEN '2025-01-01' AND '2025-01-31';
```

### Performance Indexes

Migration `012_add_performance_indexes.py` adds:
- Composite indexes for common query patterns
- Partial indexes for filtered queries
- GIN indexes for text search

### Maintenance Commands

```sql
-- Create future partitions (run monthly via cron)
SELECT create_future_usage_partitions(6);

-- Archive old data (keep 12 months)
SELECT drop_old_usage_partitions(12);

-- View partition stats
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename))
FROM pg_tables
WHERE tablename LIKE 'usage_events_y%'
ORDER BY tablename;
```

## Monitoring

### Database Metrics

```bash
# Connect to pgbouncer stats
docker-compose -f docker-compose.prod.yml exec pgbouncer psql -U usageflow pgbouncer
SHOW POOLS;
SHOW STATS;
```

### PostgreSQL Slow Queries

```sql
-- Enable pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT
    calls,
    round(total_exec_time::numeric, 2) AS total_ms,
    round(mean_exec_time::numeric, 2) AS mean_ms,
    query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

### API Health Check

```bash
curl http://localhost:8000/health
```

## Scaling Beyond 1000 Users

### Horizontal Scaling Options

1. **Read Replicas** (5000+ users)
   - Add PostgreSQL read replica
   - Route read queries to replica
   - Keep writes on primary

2. **Multiple API Instances** (10000+ users)
   - Run multiple API containers
   - Use AWS ALB for load balancing
   - Share session state via Redis

3. **Separate Database Server** (25000+ users)
   - Use AWS RDS PostgreSQL
   - Dedicated database instance
   - Multi-AZ for high availability

4. **Time-Series Database** (100M+ events/month)
   - Migrate `usage_events` to TimescaleDB or ClickHouse
   - Keep relational data in PostgreSQL

### Database Scaling Checklist

- [ ] Enable pg_stat_statements for query analysis
- [ ] Set up connection pooling (PgBouncer) ✓
- [ ] Implement table partitioning ✓
- [ ] Add performance indexes ✓
- [ ] Configure autovacuum for high-write tables ✓
- [ ] Set up monitoring (CloudWatch/DataDog)
- [ ] Plan read replica strategy
- [ ] Design data archival policy

## Backup Strategy

```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR=/backups
DATE=$(date +%Y%m%d_%H%M%S)

# Backup PostgreSQL
docker-compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U usageflow usageflow | gzip > $BACKUP_DIR/usageflow_$DATE.sql.gz

# Backup Redis
docker-compose -f docker-compose.prod.yml exec -T redis \
    redis-cli BGSAVE

# Upload to S3
aws s3 cp $BACKUP_DIR/usageflow_$DATE.sql.gz s3://your-bucket/backups/

# Keep last 30 days locally
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

## SSL/TLS Setup

```bash
# Install certbot
apt-get install certbot

# Get Let's Encrypt certificate
certbot certonly --webroot -w /var/www/certbot \
    -d your-domain.com -d www.your-domain.com

# Certificates stored at:
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem

# Auto-renewal (add to crontab)
0 0 * * * certbot renew --quiet && docker-compose -f docker-compose.prod.yml restart nginx
```

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | Database password | Required |
| `JWT_SECRET_KEY` | JWT signing key | Required |
| `API_WORKERS` | Gunicorn workers | 4 |
| `USE_PGBOUNCER` | Enable PgBouncer mode | true |
| `DB_POOL_SIZE` | SQLAlchemy pool size | 5 |
| `DB_MAX_OVERFLOW` | Max extra connections | 10 |

## Troubleshooting

### Connection Pool Exhausted

```bash
# Check PgBouncer stats
docker-compose -f docker-compose.prod.yml exec pgbouncer psql -U usageflow pgbouncer -c "SHOW POOLS;"

# Solution: Increase DEFAULT_POOL_SIZE in docker-compose.prod.yml
```

### Slow Queries

```sql
-- Find slow queries
SELECT * FROM pg_stat_activity WHERE state = 'active' AND wait_event IS NOT NULL;

-- Kill long-running query
SELECT pg_terminate_backend(pid);
```

### High Memory Usage

```bash
# Check PostgreSQL memory
docker stats usageflow-postgres

# Reduce shared_buffers or work_mem in postgresql.conf
```
