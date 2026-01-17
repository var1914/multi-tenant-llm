"""Add usage_events table partitioning by month

Revision ID: 011
Revises: 010
Create Date: 2025-01-16

This migration converts usage_events to a partitioned table for better
performance at scale. Partitioning by month allows:
- Faster queries on time-range data
- Efficient data archival/deletion of old months
- Better vacuum and index maintenance per partition
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime, timedelta


# revision identifiers, used by Alembic.
revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Create the new partitioned table structure
    op.execute("""
        -- Create new partitioned table
        CREATE TABLE usage_events_partitioned (
            id UUID NOT NULL,
            tenant_id UUID NOT NULL,
            end_customer_id UUID NOT NULL,
            event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
            event_type VARCHAR(50) NOT NULL,
            model VARCHAR(100),
            provider VARCHAR(50),
            quantity BIGINT NOT NULL,
            cost_usd NUMERIC(10, 6),
            metadata JSONB DEFAULT '{}',
            idempotency_key VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            PRIMARY KEY (id, event_timestamp)
        ) PARTITION BY RANGE (event_timestamp);

        -- Create index on tenant_id + event_timestamp (most common query pattern)
        CREATE INDEX idx_usage_events_part_tenant_timestamp
        ON usage_events_partitioned (tenant_id, event_timestamp DESC);

        -- Create index on end_customer_id + event_timestamp
        CREATE INDEX idx_usage_events_part_customer_timestamp
        ON usage_events_partitioned (end_customer_id, event_timestamp DESC);

        -- Create unique index on idempotency_key (for deduplication)
        CREATE UNIQUE INDEX idx_usage_events_part_idempotency
        ON usage_events_partitioned (idempotency_key, event_timestamp);

        -- Create index for provider/model analytics
        CREATE INDEX idx_usage_events_part_provider_model
        ON usage_events_partitioned (tenant_id, provider, model, event_timestamp DESC);
    """)

    # Step 2: Create partitions for current and next 12 months
    today = datetime.utcnow()
    for i in range(-1, 13):  # -1 month to +12 months
        partition_date = today.replace(day=1) + timedelta(days=32 * i)
        partition_date = partition_date.replace(day=1)

        year = partition_date.year
        month = partition_date.month

        # Calculate next month for upper bound
        if month == 12:
            next_year = year + 1
            next_month = 1
        else:
            next_year = year
            next_month = month + 1

        partition_name = f"usage_events_y{year}m{month:02d}"

        op.execute(f"""
            CREATE TABLE IF NOT EXISTS {partition_name} PARTITION OF usage_events_partitioned
            FOR VALUES FROM ('{year}-{month:02d}-01') TO ('{next_year}-{next_month:02d}-01');
        """)

    # Step 3: Create default partition for any data outside defined ranges
    op.execute("""
        CREATE TABLE IF NOT EXISTS usage_events_default
        PARTITION OF usage_events_partitioned DEFAULT;
    """)

    # Step 4: Migrate existing data (if any)
    op.execute("""
        INSERT INTO usage_events_partitioned (
            id, tenant_id, end_customer_id, event_timestamp, event_type,
            model, provider, quantity, cost_usd, metadata, idempotency_key, created_at
        )
        SELECT
            id, tenant_id, end_customer_id, event_timestamp, event_type,
            model, provider, quantity, cost_usd, metadata, idempotency_key, created_at
        FROM usage_events
        ON CONFLICT DO NOTHING;
    """)

    # Step 5: Rename tables (swap)
    op.execute("""
        ALTER TABLE usage_events RENAME TO usage_events_old;
        ALTER TABLE usage_events_partitioned RENAME TO usage_events;
    """)

    # Step 6: Add foreign key constraints (note: partitioned tables handle this differently)
    # We'll add triggers instead for referential integrity
    op.execute("""
        -- Create function to auto-create partitions
        CREATE OR REPLACE FUNCTION create_usage_events_partition()
        RETURNS TRIGGER AS $$
        DECLARE
            partition_name TEXT;
            start_date DATE;
            end_date DATE;
        BEGIN
            partition_name := 'usage_events_y' || to_char(NEW.event_timestamp, 'YYYY') ||
                             'm' || to_char(NEW.event_timestamp, 'MM');
            start_date := date_trunc('month', NEW.event_timestamp);
            end_date := start_date + interval '1 month';

            -- Try to create the partition if it doesn't exist
            BEGIN
                EXECUTE format(
                    'CREATE TABLE IF NOT EXISTS %I PARTITION OF usage_events
                     FOR VALUES FROM (%L) TO (%L)',
                    partition_name, start_date, end_date
                );
            EXCEPTION WHEN duplicate_table THEN
                -- Partition already exists, continue
                NULL;
            END;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Create trigger for auto-partition creation
        DROP TRIGGER IF EXISTS auto_create_partition ON usage_events;
        CREATE TRIGGER auto_create_partition
            BEFORE INSERT ON usage_events
            FOR EACH ROW
            EXECUTE FUNCTION create_usage_events_partition();
    """)

    # Step 7: Create function to manage partition maintenance
    op.execute("""
        -- Function to create future partitions (run monthly via cron)
        CREATE OR REPLACE FUNCTION create_future_usage_partitions(months_ahead INTEGER DEFAULT 3)
        RETURNS void AS $$
        DECLARE
            partition_date DATE;
            partition_name TEXT;
            start_date DATE;
            end_date DATE;
        BEGIN
            FOR i IN 0..months_ahead LOOP
                partition_date := date_trunc('month', CURRENT_DATE) + (i || ' months')::interval;
                partition_name := 'usage_events_y' || to_char(partition_date, 'YYYY') ||
                                 'm' || to_char(partition_date, 'MM');
                start_date := partition_date;
                end_date := partition_date + interval '1 month';

                BEGIN
                    EXECUTE format(
                        'CREATE TABLE IF NOT EXISTS %I PARTITION OF usage_events
                         FOR VALUES FROM (%L) TO (%L)',
                        partition_name, start_date, end_date
                    );
                    RAISE NOTICE 'Created partition: %', partition_name;
                EXCEPTION WHEN duplicate_table THEN
                    RAISE NOTICE 'Partition already exists: %', partition_name;
                END;
            END LOOP;
        END;
        $$ LANGUAGE plpgsql;

        -- Function to drop old partitions (for data retention)
        CREATE OR REPLACE FUNCTION drop_old_usage_partitions(months_to_keep INTEGER DEFAULT 12)
        RETURNS void AS $$
        DECLARE
            partition_record RECORD;
            cutoff_date DATE;
        BEGIN
            cutoff_date := date_trunc('month', CURRENT_DATE) - (months_to_keep || ' months')::interval;

            FOR partition_record IN
                SELECT inhrelid::regclass::text AS partition_name
                FROM pg_inherits
                WHERE inhparent = 'usage_events'::regclass
                AND inhrelid::regclass::text ~ 'usage_events_y[0-9]{4}m[0-9]{2}'
            LOOP
                -- Extract date from partition name and check if older than cutoff
                IF partition_record.partition_name < 'usage_events_y' || to_char(cutoff_date, 'YYYY') || 'm' || to_char(cutoff_date, 'MM') THEN
                    EXECUTE format('DROP TABLE IF EXISTS %I', partition_record.partition_name);
                    RAISE NOTICE 'Dropped old partition: %', partition_record.partition_name;
                END IF;
            END LOOP;
        END;
        $$ LANGUAGE plpgsql;
    """)


def downgrade() -> None:
    # Revert to non-partitioned table
    op.execute("""
        -- Drop triggers and functions
        DROP TRIGGER IF EXISTS auto_create_partition ON usage_events;
        DROP FUNCTION IF EXISTS create_usage_events_partition();
        DROP FUNCTION IF EXISTS create_future_usage_partitions(INTEGER);
        DROP FUNCTION IF EXISTS drop_old_usage_partitions(INTEGER);

        -- Create non-partitioned table
        CREATE TABLE usage_events_flat (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            end_customer_id UUID NOT NULL REFERENCES end_customers(id) ON DELETE CASCADE,
            event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            event_type VARCHAR(50) NOT NULL,
            model VARCHAR(100),
            provider VARCHAR(50),
            quantity BIGINT NOT NULL,
            cost_usd NUMERIC(10, 6),
            metadata JSONB DEFAULT '{}',
            idempotency_key VARCHAR(255) NOT NULL UNIQUE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );

        -- Copy data back
        INSERT INTO usage_events_flat
        SELECT * FROM usage_events;

        -- Swap tables
        DROP TABLE usage_events CASCADE;
        ALTER TABLE usage_events_flat RENAME TO usage_events;

        -- Recreate indexes
        CREATE INDEX idx_usage_events_tenant_id ON usage_events(tenant_id);
        CREATE INDEX idx_usage_events_customer_id ON usage_events(end_customer_id);
        CREATE INDEX idx_usage_events_timestamp ON usage_events(event_timestamp);

        -- Drop old table if exists
        DROP TABLE IF EXISTS usage_events_old;
    """)
