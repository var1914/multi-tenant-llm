from pydantic import BaseModel
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal


class UsageEventCreate(BaseModel):
    customer_id: str  # external_id of the customer
    event_type: str
    model: Optional[str] = None
    provider: Optional[str] = None
    quantity: int
    cost_usd: Optional[Decimal] = None
    metadata: Optional[Dict[str, Any]] = {}
    idempotency_key: str
    timestamp: Optional[datetime] = None


class UsageEventResponse(BaseModel):
    success: bool
    event_id: UUID
    customer_id: str
    quantity: int
    cost_usd: Optional[Decimal]
    timestamp: datetime


class UsageSummary(BaseModel):
    customer_id: str
    total_quantity: int
    total_cost_usd: Decimal
    event_count: int
    start_date: datetime
    end_date: datetime


class ModelUsageBreakdown(BaseModel):
    model: str
    provider: str
    total_quantity: int
    total_cost_usd: Decimal
    event_count: int


class CustomerUsageBreakdown(BaseModel):
    customer_id: str
    customer_name: Optional[str]
    total_quantity: int
    total_cost_usd: Decimal
    event_count: int


class DailyUsage(BaseModel):
    date: str
    total_quantity: int
    total_cost_usd: Decimal
    event_count: int


class FeatureUsageBreakdown(BaseModel):
    event_type: str
    total_quantity: int
    total_cost_usd: Decimal
    event_count: int


class AnalyticsSummary(BaseModel):
    by_model: list[ModelUsageBreakdown]
    by_customer: list[CustomerUsageBreakdown]
    by_feature: list[FeatureUsageBreakdown]
    daily_usage: list[DailyUsage]
