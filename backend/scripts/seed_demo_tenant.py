#!/usr/bin/env python3
"""
Seed script to create a demo tenant with realistic data for the "Try Demo" feature.
This creates:
- Demo tenant (is_demo=True)
- Demo user (demo@tokentrail.com / demo123)
- 10 end customers with realistic data
- 30 days of usage events, workflows, routing decisions

Run from backend directory: python -m scripts.seed_demo_tenant
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import AsyncSessionLocal
from app.models.tenant import Tenant
from app.models.user import User
from app.models.end_customer import EndCustomer
from app.utils.auth import get_password_hash

# Import seed functions from existing script
import asyncpg
from scripts.seed_demo_data import (
    CUSTOMERS, MODELS,
    seed_customers, seed_usage_events, seed_routing_decisions,
    seed_workflows, seed_prediction_alerts, seed_agent_efficiency,
    seed_api_keys,
)


async def get_asyncpg_connection():
    """Get asyncpg connection for bulk seeding operations."""
    from app.config import settings

    # Parse DATABASE_URL
    db_url = str(settings.DATABASE_URL)
    # Format: postgresql+asyncpg://user:pass@host:port/dbname
    parts = db_url.replace("postgresql+asyncpg://", "").split("@")
    auth = parts[0].split(":")
    host_parts = parts[1].split("/")
    host_port = host_parts[0].split(":")

    return await asyncpg.connect(
        host=host_port[0],
        port=int(host_port[1]) if len(host_port) > 1 else 5432,
        database=host_parts[1],
        user=auth[0],
        password=auth[1],
    )


async def create_demo_tenant_and_user(db: AsyncSession):
    """Create or update the demo tenant and user."""
    print("Creating demo tenant and user...")

    # Check if demo tenant exists
    result = await db.execute(
        select(Tenant).where(Tenant.slug == "tokentrail-demo")
    )
    tenant = result.scalar_one_or_none()

    if tenant:
        print(f"  Demo tenant exists: {tenant.id}")
        # Update to ensure is_demo is True
        tenant.is_demo = True
        tenant.trial_credits_usd = Decimal("100.00")
        tenant.smart_routing_enabled = True
        tenant.routellm_enabled = True
        tenant.prediction_alerts_enabled = True
    else:
        # Create new demo tenant
        tenant = Tenant(
            company_name="TokenTrail Demo",
            slug="tokentrail-demo",
            is_demo=True,
            trial_credits_usd=Decimal("100.00"),
            smart_routing_enabled=True,
            routellm_enabled=True,
            cascade_routing_enabled=True,
            prediction_alerts_enabled=True,
            subscription_plan="enterprise",
        )
        db.add(tenant)
        await db.flush()
        print(f"  Created demo tenant: {tenant.id}")

    # Check if demo user exists
    result = await db.execute(
        select(User).where(User.email == "demo@tokentrail.com")
    )
    user = result.scalar_one_or_none()

    if user:
        print(f"  Demo user exists: {user.id}")
        # Update user to be associated with demo tenant
        user.tenant_id = tenant.id
        user.hashed_password = get_password_hash("demo123")
        user.is_active = True
    else:
        # Create demo user
        user = User(
            tenant_id=tenant.id,
            email="demo@tokentrail.com",
            hashed_password=get_password_hash("demo123"),
            full_name="Demo User",
            role="user",  # Not admin - demo users shouldn't access admin panel
            is_active=True,
        )
        db.add(user)
        print(f"  Created demo user: demo@tokentrail.com / demo123")

    await db.commit()
    await db.refresh(tenant)

    return tenant


async def clean_demo_data(conn, tenant_id):
    """Clean existing demo data (for reset)."""
    print("Cleaning existing demo data...")

    tables = [
        'agent_efficiency',
        'prediction_alerts',
        'workflow_steps',
        'agent_workflows',
        'routing_decisions',
        'usage_events',
        'api_keys',
        'end_customers',
    ]

    for table in tables:
        try:
            await conn.execute(f"DELETE FROM {table} WHERE tenant_id = $1", tenant_id)
        except Exception as e:
            print(f"  Warning: Could not clean {table}: {e}")

    print("  Cleaned demo data")


async def main():
    print("=" * 60)
    print("TokenTrail Demo Tenant Seeder")
    print("=" * 60)
    print()

    # Create tenant and user using SQLAlchemy
    async with AsyncSessionLocal() as db:
        tenant = await create_demo_tenant_and_user(db)
        tenant_id = tenant.id
        print(f"Demo tenant ID: {tenant_id}")
        print()

    # Use asyncpg for bulk seeding (faster)
    conn = await get_asyncpg_connection()

    try:
        # Clean existing data
        await clean_demo_data(conn, tenant_id)

        # Seed demo data (reduced set for demo - top 10 customers)
        demo_customers = CUSTOMERS[:10]  # Use first 10 customers

        # Temporarily replace CUSTOMERS list
        original_customers = CUSTOMERS.copy()
        CUSTOMERS.clear()
        CUSTOMERS.extend(demo_customers)

        # Seed all data
        customer_ids = await seed_customers(conn, tenant_id)
        await seed_api_keys(conn, tenant_id, customer_ids)
        await seed_usage_events(conn, tenant_id, customer_ids)
        await seed_routing_decisions(conn, tenant_id, customer_ids)
        await seed_workflows(conn, tenant_id, customer_ids)
        await seed_prediction_alerts(conn, tenant_id, customer_ids)
        await seed_agent_efficiency(conn, tenant_id)

        # Restore original CUSTOMERS
        CUSTOMERS.clear()
        CUSTOMERS.extend(original_customers)

        print()
        print("=" * 60)
        print("Demo tenant seeding complete!")
        print("=" * 60)
        print()
        print("Demo Credentials:")
        print("  Email:    demo@tokentrail.com")
        print("  Password: demo123")
        print("  URL:      /demo (auto-login)")
        print()

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
