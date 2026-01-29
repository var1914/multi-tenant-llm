"""
Real-Time Server-Sent Events (SSE) API.

Provides real-time updates for usage events, routing decisions, and alerts
via Server-Sent Events for live dashboard updates.
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import AsyncGenerator, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from pydantic import BaseModel

from app.database import get_db as get_async_session
from app.models.usage_event import UsageEvent
from app.models.routing_decision import RoutingDecision
from app.models.end_customer import EndCustomer
from app.models.tenant import Tenant
from app.dependencies import get_current_user_sse
from app.models.user import User

router = APIRouter()


class RealtimeStats(BaseModel):
    """Real-time statistics snapshot."""
    timestamp: str
    total_requests_today: int
    total_tokens_today: int
    total_cost_today: float
    active_customers_today: int
    requests_per_minute: float
    routing_rate: float
    estimated_savings_today: float


async def generate_stats_stream(
    tenant_id: UUID,
    db: AsyncSession,
    interval: int = 5,
) -> AsyncGenerator[str, None]:
    """
    Generate SSE stream of real-time statistics.

    Yields statistics every `interval` seconds.
    """
    while True:
        try:
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            last_minute = datetime.utcnow() - timedelta(minutes=1)

            # Get today's usage stats
            usage_result = await db.execute(
                select(
                    func.count(UsageEvent.id).label("count"),
                    func.coalesce(func.sum(UsageEvent.quantity), 0).label("tokens"),
                    func.coalesce(func.sum(UsageEvent.cost_usd), 0).label("cost"),
                )
                .where(UsageEvent.tenant_id == tenant_id)
                .where(UsageEvent.event_timestamp >= today_start)
            )
            usage_row = usage_result.fetchone()

            # Get active customers today
            customers_result = await db.execute(
                select(func.count(func.distinct(UsageEvent.end_customer_id)))
                .where(UsageEvent.tenant_id == tenant_id)
                .where(UsageEvent.event_timestamp >= today_start)
            )
            active_customers = customers_result.scalar() or 0

            # Get requests per minute (last minute)
            rpm_result = await db.execute(
                select(func.count(UsageEvent.id))
                .where(UsageEvent.tenant_id == tenant_id)
                .where(UsageEvent.event_timestamp >= last_minute)
            )
            rpm = rpm_result.scalar() or 0

            # Get routing stats for today
            routing_result = await db.execute(
                select(
                    func.count(RoutingDecision.id).label("total"),
                    func.count(RoutingDecision.id).filter(RoutingDecision.routing_applied == True).label("routed"),
                    func.coalesce(func.sum(RoutingDecision.estimated_savings_usd).filter(RoutingDecision.routing_applied == True), 0).label("savings"),
                )
                .where(RoutingDecision.tenant_id == tenant_id)
                .where(RoutingDecision.event_timestamp >= today_start)
            )
            routing_row = routing_result.fetchone()

            total_routing = routing_row[0] if routing_row else 0
            routed_count = routing_row[1] if routing_row else 0
            routing_rate = (routed_count / total_routing * 100) if total_routing > 0 else 0
            savings = float(routing_row[2]) if routing_row and routing_row[2] else 0

            stats = RealtimeStats(
                timestamp=datetime.utcnow().isoformat(),
                total_requests_today=usage_row[0] if usage_row else 0,
                total_tokens_today=int(usage_row[1]) if usage_row else 0,
                total_cost_today=float(usage_row[2]) if usage_row else 0,
                active_customers_today=active_customers,
                requests_per_minute=float(rpm),
                routing_rate=routing_rate,
                estimated_savings_today=savings,
            )

            # Format as SSE
            data = json.dumps(stats.model_dump())
            yield f"event: stats\ndata: {data}\n\n"

            await asyncio.sleep(interval)

        except Exception as e:
            error_data = json.dumps({"error": str(e)})
            yield f"event: error\ndata: {error_data}\n\n"
            await asyncio.sleep(interval)


async def generate_events_stream(
    tenant_id: UUID,
    db: AsyncSession,
    interval: int = 2,
) -> AsyncGenerator[str, None]:
    """
    Generate SSE stream of recent usage events.

    Yields new events as they occur.
    """
    last_event_time = datetime.utcnow() - timedelta(seconds=30)

    while True:
        try:
            # Get new events since last check
            result = await db.execute(
                select(UsageEvent, EndCustomer)
                .join(EndCustomer, UsageEvent.end_customer_id == EndCustomer.id, isouter=True)
                .where(UsageEvent.tenant_id == tenant_id)
                .where(UsageEvent.event_timestamp > last_event_time)
                .order_by(desc(UsageEvent.event_timestamp))
                .limit(20)
            )
            rows = result.fetchall()

            for row in rows:
                event = row[0]
                customer = row[1]

                event_data = {
                    "id": str(event.id),
                    "timestamp": event.event_timestamp.isoformat(),
                    "customer_id": customer.external_id if customer else "unknown",
                    "customer_name": customer.name if customer else None,
                    "model": event.model,
                    "provider": event.provider,
                    "tokens": event.quantity,
                    "cost_usd": float(event.cost_usd) if event.cost_usd else 0,
                    "event_type": event.event_type,
                }

                data = json.dumps(event_data)
                yield f"event: usage\ndata: {data}\n\n"

                if event.event_timestamp > last_event_time:
                    last_event_time = event.event_timestamp

            await asyncio.sleep(interval)

        except Exception as e:
            error_data = json.dumps({"error": str(e)})
            yield f"event: error\ndata: {error_data}\n\n"
            await asyncio.sleep(interval)


async def generate_routing_stream(
    tenant_id: UUID,
    db: AsyncSession,
    interval: int = 2,
) -> AsyncGenerator[str, None]:
    """
    Generate SSE stream of routing decisions.
    """
    last_decision_time = datetime.utcnow() - timedelta(seconds=30)

    while True:
        try:
            result = await db.execute(
                select(RoutingDecision)
                .where(RoutingDecision.tenant_id == tenant_id)
                .where(RoutingDecision.event_timestamp > last_decision_time)
                .order_by(desc(RoutingDecision.event_timestamp))
                .limit(20)
            )
            decisions = result.scalars().all()

            for decision in decisions:
                decision_data = {
                    "id": str(decision.id),
                    "timestamp": decision.event_timestamp.isoformat(),
                    "original_model": decision.original_model,
                    "routed_model": decision.routed_model,
                    "routing_applied": decision.routing_applied,
                    "complexity_score": float(decision.complexity_score) if decision.complexity_score else None,
                    "routing_reason": decision.routing_reason,
                    "estimated_savings_usd": float(decision.estimated_savings_usd) if decision.estimated_savings_usd else 0,
                }

                data = json.dumps(decision_data)
                yield f"event: routing\ndata: {data}\n\n"

                if decision.event_timestamp > last_decision_time:
                    last_decision_time = decision.event_timestamp

            await asyncio.sleep(interval)

        except Exception as e:
            error_data = json.dumps({"error": str(e)})
            yield f"event: error\ndata: {error_data}\n\n"
            await asyncio.sleep(interval)


@router.get("/stats")
async def stream_stats(
    request: Request,
    interval: int = Query(5, ge=1, le=60),
    current_user: User = Depends(get_current_user_sse),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Stream real-time statistics via Server-Sent Events.

    Connect to this endpoint to receive live dashboard statistics.

    Example JavaScript client:
    ```javascript
    const eventSource = new EventSource('/api/v1/realtime/stats?interval=5');
    eventSource.addEventListener('stats', (e) => {
        const stats = JSON.parse(e.data);
        console.log('Stats update:', stats);
    });
    ```
    """
    async def event_generator():
        async for event in generate_stats_stream(current_user.tenant_id, db, interval):
            # Check if client disconnected
            if await request.is_disconnected():
                break
            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/events")
async def stream_events(
    request: Request,
    interval: int = Query(2, ge=1, le=30),
    current_user: User = Depends(get_current_user_sse),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Stream real-time usage events via Server-Sent Events.

    Connect to this endpoint to receive live usage event updates.
    """
    async def event_generator():
        async for event in generate_events_stream(current_user.tenant_id, db, interval):
            if await request.is_disconnected():
                break
            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/routing")
async def stream_routing(
    request: Request,
    interval: int = Query(2, ge=1, le=30),
    current_user: User = Depends(get_current_user_sse),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Stream real-time routing decisions via Server-Sent Events.

    Connect to this endpoint to receive live smart routing updates.
    """
    async def event_generator():
        async for event in generate_routing_stream(current_user.tenant_id, db, interval):
            if await request.is_disconnected():
                break
            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/combined")
async def stream_combined(
    request: Request,
    stats_interval: int = Query(5, ge=1, le=60),
    events_interval: int = Query(2, ge=1, le=30),
    current_user: User = Depends(get_current_user_sse),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Stream combined real-time updates (stats, events, and routing).

    This is a convenience endpoint that combines all streams.
    Events are tagged with their type: 'stats', 'usage', 'routing'.
    """
    async def combined_generator():
        last_stats_time = datetime.utcnow() - timedelta(seconds=stats_interval)
        last_events_time = datetime.utcnow() - timedelta(seconds=30)
        last_routing_time = datetime.utcnow() - timedelta(seconds=30)

        while True:
            if await request.is_disconnected():
                break

            now = datetime.utcnow()

            # Check if we should send stats
            if (now - last_stats_time).total_seconds() >= stats_interval:
                async for event in generate_stats_stream(current_user.tenant_id, db, 0):
                    yield event
                    break  # Just one stats event
                last_stats_time = now

            # Check for new usage events
            result = await db.execute(
                select(UsageEvent, EndCustomer)
                .join(EndCustomer, UsageEvent.end_customer_id == EndCustomer.id, isouter=True)
                .where(UsageEvent.tenant_id == current_user.tenant_id)
                .where(UsageEvent.event_timestamp > last_events_time)
                .order_by(desc(UsageEvent.event_timestamp))
                .limit(10)
            )
            for row in result.fetchall():
                event = row[0]
                customer = row[1]
                event_data = {
                    "id": str(event.id),
                    "timestamp": event.event_timestamp.isoformat(),
                    "customer_id": customer.external_id if customer else "unknown",
                    "model": event.model,
                    "tokens": event.quantity,
                    "cost_usd": float(event.cost_usd) if event.cost_usd else 0,
                }
                yield f"event: usage\ndata: {json.dumps(event_data)}\n\n"
                if event.event_timestamp > last_events_time:
                    last_events_time = event.event_timestamp

            # Check for new routing decisions
            routing_result = await db.execute(
                select(RoutingDecision)
                .where(RoutingDecision.tenant_id == current_user.tenant_id)
                .where(RoutingDecision.event_timestamp > last_routing_time)
                .order_by(desc(RoutingDecision.event_timestamp))
                .limit(10)
            )
            for decision in routing_result.scalars().all():
                decision_data = {
                    "id": str(decision.id),
                    "timestamp": decision.event_timestamp.isoformat(),
                    "original_model": decision.original_model,
                    "routed_model": decision.routed_model,
                    "routing_applied": decision.routing_applied,
                    "estimated_savings_usd": float(decision.estimated_savings_usd) if decision.estimated_savings_usd else 0,
                }
                yield f"event: routing\ndata: {json.dumps(decision_data)}\n\n"
                if decision.event_timestamp > last_routing_time:
                    last_routing_time = decision.event_timestamp

            await asyncio.sleep(events_interval)

    return StreamingResponse(
        combined_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
