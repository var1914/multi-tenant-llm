#!/usr/bin/env python3
"""
Simplified seed script for UsageFlow demo data.
"""
import asyncio
import random
import uuid
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import asyncpg

DB_HOST = "usageflow-postgres"
DB_PORT = 5432
DB_NAME = "usageflow"
DB_USER = "usageflow"
DB_PASSWORD = "usageflow_dev"

MODELS = [
    ("gpt-4-turbo", "openai", 0.01, 0.03),
    ("gpt-4o", "openai", 0.005, 0.015),
    ("gpt-4o-mini", "openai", 0.00015, 0.0006),
    ("gpt-3.5-turbo", "openai", 0.0005, 0.0015),
    ("claude-3-5-sonnet", "anthropic", 0.003, 0.015),
    ("claude-3-opus", "anthropic", 0.015, 0.075),
    ("claude-3-haiku", "anthropic", 0.00025, 0.00125),
]

async def main():
    print("Connecting to database...")
    conn = await asyncpg.connect(
        host=DB_HOST, port=DB_PORT, database=DB_NAME,
        user=DB_USER, password=DB_PASSWORD
    )

    # Get tenant and customers
    tenant = await conn.fetchrow("SELECT id FROM tenants LIMIT 1")
    if not tenant:
        print("No tenant found!")
        return
    tenant_id = tenant['id']
    print(f"Tenant ID: {tenant_id}")

    customers = await conn.fetch("SELECT id, external_id, name FROM end_customers WHERE tenant_id = $1", tenant_id)
    print(f"Found {len(customers)} customers")

    # Seed usage events
    print("\nSeeding usage events...")
    now = datetime.now(timezone.utc)
    count = 0

    for days_ago in range(30, -1, -1):
        date = now - timedelta(days=days_ago)

        for customer in customers:
            num_events = random.randint(30, 150)

            for _ in range(num_events):
                model_name, provider, input_price, output_price = random.choice(MODELS)
                input_tokens = random.randint(100, 5000)
                output_tokens = random.randint(50, 3000)
                total_tokens = input_tokens + output_tokens
                cost = (input_tokens / 1000 * input_price) + (output_tokens / 1000 * output_price)

                event_time = date.replace(
                    hour=random.randint(6, 23),
                    minute=random.randint(0, 59),
                    second=random.randint(0, 59)
                )

                idempotency_key = f"{customer['external_id']}-{days_ago}-{count}-{uuid.uuid4().hex[:6]}"

                try:
                    await conn.execute("""
                        INSERT INTO usage_events (
                            id, tenant_id, end_customer_id, event_timestamp, event_type,
                            model, provider, quantity, cost_usd, idempotency_key, created_at, metadata
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    """,
                        uuid.uuid4(), tenant_id, customer['id'], event_time, 'llm_completion',
                        model_name, provider, total_tokens, Decimal(str(round(cost, 6))),
                        idempotency_key, now, json.dumps({"input_tokens": input_tokens, "output_tokens": output_tokens})
                    )
                    count += 1
                except Exception as e:
                    if count < 5:
                        print(f"Error: {e}")

        if days_ago % 5 == 0:
            print(f"  Day {30-days_ago}: {count} events")

    print(f"  Total: {count} usage events created")

    # Seed workflows
    print("\nSeeding agent workflows...")
    workflow_count = 0
    step_count = 0

    workflow_types = [
        ("Document Analysis", ["ExtractorAgent", "AnalysisAgent", "SummaryAgent"]),
        ("Code Review", ["CodeAgent", "ReviewerAgent", "TestAgent"]),
        ("Content Generation", ["PlannerAgent", "WriterAgent", "ReviewerAgent"]),
        ("Research Pipeline", ["ResearchAgent", "AnalysisAgent", "WriterAgent"]),
    ]

    for days_ago in range(14, -1, -1):
        date = now - timedelta(days=days_ago)

        for customer in customers:
            num_workflows = random.randint(2, 8)

            for _ in range(num_workflows):
                wf_name, agents = random.choice(workflow_types)
                workflow_id = uuid.uuid4()

                start_time = date.replace(hour=random.randint(8, 20), minute=random.randint(0, 59))
                status = random.choice(['completed', 'completed', 'completed', 'failed'])
                end_time = start_time + timedelta(minutes=random.randint(1, 20)) if status == 'completed' else None

                total_tokens = random.randint(5000, 40000)
                total_cost = Decimal(str(round(random.uniform(0.05, 0.50), 6)))

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
                        workflow_id, tenant_id, customer['id'], f"wf-{uuid.uuid4().hex[:8]}",
                        wf_name, 'sequential', status, start_time, end_time,
                        len(agents), len(agents) * 2, random.randint(0, 5),
                        total_tokens, total_cost, False, False, now, '{}'
                    )
                    workflow_count += 1

                    # Add steps
                    step_time = start_time
                    for i, agent in enumerate(agents):
                        step_tokens = total_tokens // len(agents)
                        step_cost = Decimal(str(float(total_cost) / len(agents)))
                        step_end = step_time + timedelta(seconds=random.randint(10, 120))

                        await conn.execute("""
                            INSERT INTO workflow_steps (
                                id, tenant_id, workflow_id, step_number, agent_name, agent_type,
                                started_at, completed_at, llm_calls, tool_calls, tokens_used, cost_usd,
                                status, output_summary, created_at, metadata
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                        """,
                            uuid.uuid4(), tenant_id, workflow_id, i + 1, agent, 'execution',
                            step_time, step_end, 2, 1, step_tokens, step_cost,
                            'completed', f"Step {i+1} completed successfully", now, '{}'
                        )
                        step_count += 1
                        step_time = step_end

                except Exception as e:
                    if workflow_count < 3:
                        print(f"Workflow error: {e}")

    print(f"  Total: {workflow_count} workflows, {step_count} steps")

    # Seed prediction alerts
    print("\nSeeding prediction alerts...")
    alert_count = 0

    for customer in customers:
        for _ in range(random.randint(1, 4)):
            utilization = random.uniform(60, 120)
            budget = random.randint(5000, 50000)
            current_spend = Decimal(str(round(budget * utilization / 100, 2)))
            alert_type = 'exceeded' if utilization > 100 else ('critical' if utilization > 90 else 'warning')

            try:
                await conn.execute("""
                    INSERT INTO prediction_alerts (
                        id, tenant_id, end_customer_id, alert_type,
                        current_spend, budget_limit, utilization_percent,
                        message, recommendations, confidence_score, status,
                        notification_sent, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
                """,
                    uuid.uuid4(), tenant_id, customer['id'], alert_type,
                    current_spend, Decimal(str(budget)), Decimal(str(round(utilization, 2))),
                    f"Budget at {utilization:.1f}% for {customer['name']}",
                    json.dumps([{"type": "optimize", "message": "Consider caching"}]),
                    Decimal(str(round(random.uniform(0.7, 0.95), 2))),
                    random.choice(['active', 'acknowledged']),
                    True, now
                )
                alert_count += 1
            except Exception as e:
                print(f"Alert error: {e}")

    print(f"  Total: {alert_count} alerts")

    # Seed agent efficiency
    print("\nSeeding agent efficiency...")
    efficiency_count = 0
    agents = ["PlannerAgent", "ResearchAgent", "WriterAgent", "CodeAgent", "TestAgent",
              "AnalysisAgent", "SummaryAgent", "ExtractorAgent", "ValidatorAgent"]

    today = datetime.now(timezone.utc).date()

    for agent in agents:
        for weeks_ago in range(4):
            period_end = today - timedelta(days=weeks_ago * 7)
            period_start = period_end - timedelta(days=6)

            invocations = random.randint(100, 3000)
            success_rate = Decimal(str(round(random.uniform(88, 99), 2)))
            total_tokens = random.randint(invocations * 1000, invocations * 4000)
            total_cost = Decimal(str(round(total_tokens * 0.000003, 6)))
            avg_cost = Decimal(str(round(float(total_cost) / invocations, 6)))
            efficiency_score = random.randint(65, 95)

            try:
                await conn.execute("""
                    INSERT INTO agent_efficiency (
                        id, tenant_id, agent_name, period_start, period_end,
                        total_invocations, successful_invocations, total_tokens, total_cost_usd,
                        avg_cost_per_call, success_rate, efficiency_score, recommendations, created_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    ON CONFLICT DO NOTHING
                """,
                    uuid.uuid4(), tenant_id, agent, period_start, period_end,
                    invocations, int(invocations * float(success_rate) / 100),
                    total_tokens, total_cost, avg_cost, success_rate, efficiency_score,
                    json.dumps([]), now
                )
                efficiency_count += 1
            except Exception as e:
                print(f"Efficiency error: {e}")

    print(f"  Total: {efficiency_count} efficiency records")

    await conn.close()
    print("\nDone!")

if __name__ == "__main__":
    asyncio.run(main())
