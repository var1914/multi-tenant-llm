-- PostgreSQL Initialization Script for UsageFlow
-- Run once on database creation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- Create application user with limited privileges (optional, for security)
-- DO $$
-- BEGIN
--     IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'usageflow_app') THEN
--         CREATE ROLE usageflow_app WITH LOGIN PASSWORD 'app_password_here';
--     END IF;
-- END
-- $$;

-- Grant permissions
-- GRANT CONNECT ON DATABASE usageflow TO usageflow_app;
-- GRANT USAGE ON SCHEMA public TO usageflow_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO usageflow_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO usageflow_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO usageflow_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO usageflow_app;

-- Notify when initialization is complete
DO $$
BEGIN
    RAISE NOTICE 'UsageFlow database initialized successfully';
END
$$;
