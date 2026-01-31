#!/usr/bin/env python3
"""
Seed script to populate UsageFlow with realistic demo data for a big organization.
Run from backend directory: python -m scripts.seed_demo_data
"""
import asyncio
import json
import random
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

import asyncpg

# Database connection settings (using Docker internal network)
DB_HOST = "usageflow-postgres"  # Docker service name
DB_PORT = 5432
DB_NAME = "usageflow"
DB_USER = "usageflow"
DB_PASSWORD = "usageflow_dev"

# LLM Models and their pricing (per 1K tokens)
MODELS = {
    "gpt-4-turbo": {"provider": "openai", "input_price": 0.01, "output_price": 0.03},
    "gpt-4o": {"provider": "openai", "input_price": 0.005, "output_price": 0.015},
    "gpt-4o-mini": {"provider": "openai", "input_price": 0.00015, "output_price": 0.0006},
    "gpt-3.5-turbo": {"provider": "openai", "input_price": 0.0005, "output_price": 0.0015},
    "claude-3-5-sonnet": {"provider": "anthropic", "input_price": 0.003, "output_price": 0.015},
    "claude-3-opus": {"provider": "anthropic", "input_price": 0.015, "output_price": 0.075},
    "claude-3-haiku": {"provider": "anthropic", "input_price": 0.00025, "output_price": 0.00125},
    "gemini-1.5-pro": {"provider": "google", "input_price": 0.00125, "output_price": 0.005},
    "gemini-1.5-flash": {"provider": "google", "input_price": 0.000075, "output_price": 0.0003},
    "llama-3.1-70b": {"provider": "groq", "input_price": 0.00059, "output_price": 0.00079},
}

# Customer personas for a big AI company
CUSTOMERS = [
    {"name": "TechCorp Enterprise", "external_id": "techcorp-001", "email": "api@techcorp.io", "tier": "enterprise", "budget": 50000},
    {"name": "AI Startup Labs", "external_id": "ailabs-002", "email": "dev@ailabs.co", "tier": "growth", "budget": 15000},
    {"name": "DataFlow Inc", "external_id": "dataflow-003", "email": "team@dataflow.com", "tier": "enterprise", "budget": 75000},
    {"name": "SmartChat Solutions", "external_id": "smartchat-004", "email": "ops@smartchat.ai", "tier": "professional", "budget": 8000},
    {"name": "AutoML Systems", "external_id": "automl-005", "email": "api@automl.io", "tier": "growth", "budget": 12000},
    {"name": "NLP Wizards", "external_id": "nlpwiz-006", "email": "dev@nlpwizards.com", "tier": "starter", "budget": 2500},
    {"name": "CodeAssist Pro", "external_id": "codeassist-007", "email": "api@codeassist.dev", "tier": "enterprise", "budget": 100000},
    {"name": "ContentGen AI", "external_id": "contentgen-008", "email": "ops@contentgen.ai", "tier": "professional", "budget": 6000},
    {"name": "VoiceBot Corp", "external_id": "voicebot-009", "email": "team@voicebot.io", "tier": "growth", "budget": 20000},
    {"name": "ResearchAI Labs", "external_id": "researchai-010", "email": "api@researchai.org", "tier": "enterprise", "budget": 45000},
    {"name": "EduTech AI", "external_id": "edutech-011", "email": "dev@edutechai.com", "tier": "professional", "budget": 5000},
    {"name": "HealthAI Solutions", "external_id": "healthai-012", "email": "api@healthai.med", "tier": "enterprise", "budget": 80000},
    {"name": "FinanceBot Ltd", "external_id": "financebot-013", "email": "ops@financebot.fin", "tier": "enterprise", "budget": 60000},
    {"name": "LegalDoc AI", "external_id": "legaldoc-014", "email": "api@legaldocai.law", "tier": "growth", "budget": 18000},
    {"name": "RetailGenius", "external_id": "retailgen-015", "email": "team@retailgenius.shop", "tier": "professional", "budget": 7500},
]

# Agent names for workflows
AGENTS = [
    "PlannerAgent", "ResearchAgent", "WriterAgent", "ReviewerAgent",
    "CodeAgent", "TestAgent", "DebugAgent", "DeployAgent",
    "AnalysisAgent", "SummaryAgent", "ExtractorAgent", "ValidatorAgent",
    "TranslatorAgent", "FormatterAgent", "OptimizerAgent"
]

# Workflow types
WORKFLOW_TYPES = [
    {"name": "Document Analysis", "agents": ["ExtractorAgent", "AnalysisAgent", "SummaryAgent"], "avg_cost": 0.15},
    {"name": "Code Review", "agents": ["CodeAgent", "ReviewerAgent", "TestAgent"], "avg_cost": 0.25},
    {"name": "Content Generation", "agents": ["PlannerAgent", "WriterAgent", "ReviewerAgent"], "avg_cost": 0.35},
    {"name": "Research Pipeline", "agents": ["ResearchAgent", "AnalysisAgent", "WriterAgent", "ValidatorAgent"], "avg_cost": 0.50},
    {"name": "Bug Fix Workflow", "agents": ["DebugAgent", "CodeAgent", "TestAgent", "ReviewerAgent"], "avg_cost": 0.40},
    {"name": "Translation Pipeline", "agents": ["ExtractorAgent", "TranslatorAgent", "ValidatorAgent"], "avg_cost": 0.20},
    {"name": "Data Processing", "agents": ["ExtractorAgent", "FormatterAgent", "ValidatorAgent"], "avg_cost": 0.18},
    {"name": "Full Dev Cycle", "agents": ["PlannerAgent", "CodeAgent", "TestAgent", "ReviewerAgent", "DeployAgent"], "avg_cost": 0.75},
]


async def get_connection():
    return await asyncpg.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


async def get_tenant_id(conn):
    """Get the first tenant or create one"""
    row = await conn.fetchrow("SELECT id FROM tenants LIMIT 1")
    if row:
        return row['id']

    # Create a tenant if none exists
    tenant_id = uuid.uuid4()
    now = datetime.utcnow()
    await conn.execute("""
        INSERT INTO tenants (id, company_name, slug, subscription_plan, smart_routing_enabled, prediction_alerts_enabled, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
    """, tenant_id, "UsageFlow Demo Corp", "usageflow-demo", "enterprise", True, True, now)
    return tenant_id


async def seed_customers(conn, tenant_id):
    """Create end customers"""
    print("Seeding customers...")
    customer_ids = {}

    for customer in CUSTOMERS:
        customer_id = uuid.uuid4()
        customer_ids[customer['external_id']] = customer_id

        await conn.execute("""
            INSERT INTO end_customers (
                id, tenant_id, external_id, name, email,
                budget_limit_usd, budget_alert_threshold, budget_alert_enabled,
                workflow_budget_usd, workflow_budget_action, prediction_enabled,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
            ON CONFLICT (tenant_id, external_id) DO UPDATE SET
                name = EXCLUDED.name,
                budget_limit_usd = EXCLUDED.budget_limit_usd
        """,
            customer_id, tenant_id, customer['external_id'], customer['name'], customer['email'],
            Decimal(str(customer['budget'])), Decimal('80'), True,
            Decimal(str(customer['budget'] / 100)),  # Per-workflow budget
            'pause' if customer['tier'] == 'enterprise' else 'alert',
            True,
            datetime.utcnow()
        )

    print(f"  Created {len(customer_ids)} customers")
    return customer_ids


async def seed_usage_events(conn, tenant_id, customer_ids):
    """Generate usage events for the past 30 days"""
    print("Seeding usage events...")
    event_count = 0

    # Generate events for past 30 days
    for days_ago in range(30, -1, -1):
        date = datetime.utcnow() - timedelta(days=days_ago)

        # More events on weekdays
        is_weekend = date.weekday() >= 5
        base_events = 50 if is_weekend else 150

        for customer_ext_id, customer_id in customer_ids.items():
            customer = next(c for c in CUSTOMERS if c['external_id'] == customer_ext_id)

            # Enterprise customers have more usage
            multiplier = {"enterprise": 3, "growth": 2, "professional": 1.5, "starter": 1}[customer['tier']]
            num_events = int(base_events * multiplier * random.uniform(0.7, 1.3))

            for _ in range(num_events):
                model_name = random.choice(list(MODELS.keys()))
                model = MODELS[model_name]

                # Vary token counts
                input_tokens = random.randint(100, 8000)
                output_tokens = random.randint(50, 4000)
                total_tokens = input_tokens + output_tokens

                # Calculate cost
                cost = (input_tokens / 1000 * model['input_price']) + (output_tokens / 1000 * model['output_price'])

                # Random time during the day
                event_time = date.replace(
                    hour=random.randint(6, 23),
                    minute=random.randint(0, 59),
                    second=random.randint(0, 59)
                )

                event_id = uuid.uuid4()
                idempotency_key = f"{customer_ext_id}-{event_time.isoformat()}-{uuid.uuid4().hex[:8]}"

                try:
                    await conn.execute("""
                        INSERT INTO usage_events (
                            id, tenant_id, end_customer_id, event_timestamp, event_type,
                            model, provider, quantity, cost_usd, idempotency_key, created_at, metadata
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    """,
                        event_id, tenant_id, customer_id, event_time, 'llm_completion',
                        model_name, model['provider'], total_tokens, Decimal(str(round(cost, 6))),
                        idempotency_key, datetime.utcnow(),
                        json.dumps({"input_tokens": input_tokens, "output_tokens": output_tokens})
                    )
                    event_count += 1
                except Exception as e:
                    # Log errors for debugging (most will be duplicate key violations)
                    if event_count == 0:  # Only print first error
                        print(f"    Warning: {type(e).__name__}: {e}")

    print(f"  Created {event_count} usage events")


async def seed_routing_decisions(conn, tenant_id, customer_ids):
    """Generate smart routing decisions"""
    print("Seeding routing decisions...")
    routing_count = 0

    # Routing pairs (expensive -> cheaper)
    routing_pairs = [
        ("gpt-4-turbo", "gpt-4o-mini", 0.85),
        ("claude-3-opus", "claude-3-haiku", 0.90),
        ("gpt-4o", "gpt-3.5-turbo", 0.80),
        ("gemini-1.5-pro", "gemini-1.5-flash", 0.88),
        ("claude-3-5-sonnet", "claude-3-haiku", 0.75),
    ]

    for days_ago in range(14, -1, -1):
        date = datetime.utcnow() - timedelta(days=days_ago)

        for customer_ext_id, customer_id in customer_ids.items():
            num_decisions = random.randint(20, 100)

            for _ in range(num_decisions):
                original, routed, route_rate = random.choice(routing_pairs)
                routing_applied = random.random() < route_rate

                complexity_score = random.uniform(0.1, 0.9) if routing_applied else random.uniform(0.7, 1.0)
                savings = random.uniform(0.001, 0.05) if routing_applied else 0

                event_time = date.replace(
                    hour=random.randint(6, 23),
                    minute=random.randint(0, 59)
                )

                try:
                    await conn.execute("""
                        INSERT INTO routing_decisions (
                            id, tenant_id, end_customer_id, event_timestamp,
                            original_model, routed_model, routing_applied, routing_reason,
                            complexity_score, estimated_savings_usd, created_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    """,
                        uuid.uuid4(), tenant_id, customer_id, event_time,
                        original, routed if routing_applied else original, routing_applied,
                        "Low complexity query detected" if routing_applied else "High complexity - using original",
                        Decimal(str(round(complexity_score, 2))),
                        Decimal(str(round(savings, 6))),
                        datetime.utcnow()
                    )
                    routing_count += 1
                except Exception:
                    pass

    print(f"  Created {routing_count} routing decisions")


async def seed_workflows(conn, tenant_id, customer_ids):
    """Generate agent workflows with steps"""
    print("Seeding agent workflows...")
    workflow_count = 0
    step_count = 0

    for days_ago in range(14, -1, -1):
        date = datetime.utcnow() - timedelta(days=days_ago)

        for customer_ext_id, customer_id in customer_ids.items():
            customer = next(c for c in CUSTOMERS if c['external_id'] == customer_ext_id)

            # Enterprise customers run more workflows
            multiplier = {"enterprise": 8, "growth": 5, "professional": 3, "starter": 1}[customer['tier']]
            num_workflows = int(multiplier * random.uniform(0.5, 1.5))

            for _ in range(num_workflows):
                workflow_type = random.choice(WORKFLOW_TYPES)
                workflow_id = uuid.uuid4()

                start_time = date.replace(
                    hour=random.randint(8, 20),
                    minute=random.randint(0, 59)
                )

                # 95% success rate
                is_successful = random.random() < 0.95
                status = random.choice(['completed', 'completed', 'completed', 'failed', 'paused_over_budget']) if is_successful else 'failed'

                total_steps = len(workflow_type['agents'])
                total_tokens = random.randint(5000, 50000)
                total_cost = Decimal(str(round(workflow_type['avg_cost'] * random.uniform(0.5, 2.0), 6)))

                duration_minutes = random.randint(1, 30)
                end_time = start_time + timedelta(minutes=duration_minutes) if status == 'completed' else None

                budget_exceeded = status == 'paused_over_budget'

                try:
                    await conn.execute("""
                        INSERT INTO agent_workflows (
                            id, tenant_id, end_customer_id, workflow_id, workflow_name, workflow_type,
                            status, started_at, completed_at, total_steps, total_llm_calls, total_tool_calls,
                            total_tokens, total_cost_usd, budget_exceeded, budget_alert_sent,
                            created_at, updated_at, metadata
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17, $18)
                    """,
                        workflow_id, tenant_id, customer_id, f"wf-{uuid.uuid4().hex[:8]}",
                        workflow_type['name'], 'sequential',
                        status, start_time, end_time, total_steps,
                        total_steps * random.randint(1, 3),  # LLM calls
                        random.randint(0, total_steps * 2),  # Tool calls
                        total_tokens, total_cost, budget_exceeded, budget_exceeded,
                        datetime.utcnow(),
                        json.dumps({"trigger": "api", "version": "1.0"})
                    )
                    workflow_count += 1

                    # Create steps for this workflow
                    step_time = start_time
                    tokens_remaining = total_tokens
                    cost_remaining = float(total_cost)

                    for i, agent_name in enumerate(workflow_type['agents']):
                        step_id = uuid.uuid4()

                        # Distribute tokens and cost across steps
                        if i == len(workflow_type['agents']) - 1:
                            step_tokens = tokens_remaining
                            step_cost = Decimal(str(round(cost_remaining, 6)))
                        else:
                            step_tokens = random.randint(1000, tokens_remaining // 2)
                            step_cost = Decimal(str(round(cost_remaining * random.uniform(0.2, 0.4), 6)))

                        tokens_remaining -= step_tokens
                        cost_remaining -= float(step_cost)

                        step_duration = random.randint(5, 180)  # seconds
                        step_end = step_time + timedelta(seconds=step_duration)

                        step_status = 'completed' if status == 'completed' or i < len(workflow_type['agents']) - 1 else 'failed'

                        await conn.execute("""
                            INSERT INTO workflow_steps (
                                id, tenant_id, workflow_id, step_number, agent_name, agent_type,
                                started_at, completed_at, llm_calls, tool_calls, tokens_used, cost_usd,
                                status, output_summary, created_at, metadata
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                        """,
                            step_id, tenant_id, workflow_id, i + 1, agent_name,
                            'planning' if 'Planner' in agent_name else ('verification' if 'Validator' in agent_name or 'Review' in agent_name else 'execution'),
                            step_time, step_end if step_status == 'completed' else None,
                            random.randint(1, 5), random.randint(0, 3),
                            step_tokens, step_cost, step_status,
                            f"Successfully processed request with {agent_name}" if step_status == 'completed' else "Step failed due to timeout",
                            datetime.utcnow(),
                            json.dumps({"model": random.choice(list(MODELS.keys()))})
                        )
                        step_count += 1
                        step_time = step_end

                except Exception as e:
                    pass

    print(f"  Created {workflow_count} workflows with {step_count} steps")


async def seed_prediction_alerts(conn, tenant_id, customer_ids):
    """Generate prediction alerts"""
    print("Seeding prediction alerts...")
    alert_count = 0

    alert_types = ['warning', 'critical', 'exceeded']

    for customer_ext_id, customer_id in customer_ids.items():
        customer = next(c for c in CUSTOMERS if c['external_id'] == customer_ext_id)

        # Generate 1-5 alerts per customer
        num_alerts = random.randint(1, 5)

        for _ in range(num_alerts):
            budget = customer['budget']
            utilization = random.uniform(60, 120)
            current_spend = Decimal(str(round(budget * utilization / 100, 2)))

            alert_type = 'exceeded' if utilization > 100 else ('critical' if utilization > 90 else 'warning')

            forecast_days = random.randint(1, 14) if alert_type != 'exceeded' else 0
            forecast_date = datetime.utcnow() + timedelta(days=forecast_days) if forecast_days > 0 else None

            status = random.choice(['active', 'active', 'acknowledged', 'resolved'])

            try:
                await conn.execute("""
                    INSERT INTO prediction_alerts (
                        id, tenant_id, end_customer_id, alert_type,
                        current_spend, budget_limit, utilization_percent, forecasted_exceed_date,
                        message, recommendations, confidence_score, status,
                        notification_sent, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
                """,
                    uuid.uuid4(), tenant_id, customer_id, alert_type,
                    current_spend, Decimal(str(budget)), Decimal(str(round(utilization, 2))), forecast_date,
                    f"Budget utilization at {utilization:.1f}% for {customer['name']}",
                    [
                        {"type": "reduce_usage", "message": "Consider implementing caching for repeated queries"},
                        {"type": "upgrade_plan", "message": "Upgrade to enterprise for higher limits"},
                    ],
                    Decimal(str(round(random.uniform(0.7, 0.95), 2))), status,
                    True, datetime.utcnow()
                )
                alert_count += 1
            except Exception:
                pass

    print(f"  Created {alert_count} prediction alerts")


async def seed_agent_efficiency(conn, tenant_id):
    """Generate agent efficiency metrics"""
    print("Seeding agent efficiency metrics...")
    efficiency_count = 0

    today = datetime.utcnow().date()

    for agent_name in AGENTS:
        # Weekly metrics for past 4 weeks
        for weeks_ago in range(4):
            period_end = today - timedelta(days=weeks_ago * 7)
            period_start = period_end - timedelta(days=6)

            invocations = random.randint(100, 5000)
            success_rate = Decimal(str(round(random.uniform(85, 99), 2)))
            successful = int(invocations * float(success_rate) / 100)

            total_tokens = random.randint(invocations * 1000, invocations * 5000)
            total_cost = Decimal(str(round(total_tokens * 0.000005 * random.uniform(0.5, 2), 6)))
            avg_cost = Decimal(str(round(float(total_cost) / invocations, 6)))

            efficiency_score = random.randint(60, 98)

            recommendations = []
            if efficiency_score < 70:
                recommendations.append({"type": "optimize", "message": "Consider prompt optimization", "impact": "high"})
            if float(avg_cost) > 0.01:
                recommendations.append({"type": "cost", "message": "Use cheaper model for simple tasks", "impact": "medium"})

            try:
                await conn.execute("""
                    INSERT INTO agent_efficiency (
                        id, tenant_id, agent_name, period_start, period_end,
                        total_invocations, successful_invocations, total_tokens, total_cost_usd,
                        avg_cost_per_call, success_rate, efficiency_score, recommendations, created_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    ON CONFLICT (tenant_id, agent_name, period_start) DO UPDATE SET
                        total_invocations = EXCLUDED.total_invocations,
                        efficiency_score = EXCLUDED.efficiency_score
                """,
                    uuid.uuid4(), tenant_id, agent_name, period_start, period_end,
                    invocations, successful, total_tokens, total_cost,
                    avg_cost, success_rate, efficiency_score, recommendations, datetime.utcnow()
                )
                efficiency_count += 1
            except Exception:
                pass

    print(f"  Created {efficiency_count} agent efficiency records")


async def seed_api_keys(conn, tenant_id, customer_ids):
    """Create API keys for customers"""
    print("Seeding API keys...")
    key_count = 0

    for customer_ext_id, customer_id in customer_ids.items():
        customer = next(c for c in CUSTOMERS if c['external_id'] == customer_ext_id)

        # Create 1-3 API keys per customer
        num_keys = random.randint(1, 3)

        for i in range(num_keys):
            key_id = uuid.uuid4()
            prefix = "uf_live_" if i == 0 else "uf_test_"

            try:
                await conn.execute("""
                    INSERT INTO api_keys (
                        id, tenant_id, name, key_prefix, key_hash, is_active,
                        last_used_at, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
                    ON CONFLICT DO NOTHING
                """,
                    key_id, tenant_id,
                    f"{customer['name']} - {'Production' if i == 0 else 'Development'} Key",
                    prefix + uuid.uuid4().hex[:8],
                    "hashed_" + uuid.uuid4().hex,  # Fake hash
                    True,
                    datetime.utcnow() - timedelta(hours=random.randint(1, 72)),
                    datetime.utcnow()
                )
                key_count += 1
            except Exception:
                pass

    print(f"  Created {key_count} API keys")


async def main():
    print("=" * 60)
    print("UsageFlow Demo Data Seeder")
    print("=" * 60)
    print()

    conn = await get_connection()

    try:
        # Get or create tenant
        tenant_id = await get_tenant_id(conn)
        print(f"Using tenant: {tenant_id}")
        print()

        # Seed all data
        customer_ids = await seed_customers(conn, tenant_id)
        await seed_api_keys(conn, tenant_id, customer_ids)
        await seed_usage_events(conn, tenant_id, customer_ids)
        await seed_routing_decisions(conn, tenant_id, customer_ids)
        await seed_workflows(conn, tenant_id, customer_ids)
        await seed_prediction_alerts(conn, tenant_id, customer_ids)
        await seed_agent_efficiency(conn, tenant_id)

        print()
        print("=" * 60)
        print("Seeding complete!")
        print("=" * 60)

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
