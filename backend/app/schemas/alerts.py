from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from enum import Enum


class AlertType(str, Enum):
    BUDGET_WARNING = "budget_warning"  # Approaching threshold
    BUDGET_EXCEEDED = "budget_exceeded"  # Over budget


class AlertStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


class AlertCreate(BaseModel):
    customer_id: str
    alert_type: AlertType
    message: str
    threshold_percentage: float
    current_spend_usd: Decimal
    budget_limit_usd: Decimal


class AlertResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    customer_id: str
    alert_type: AlertType
    message: str
    threshold_percentage: float
    current_spend_usd: Decimal
    budget_limit_usd: Decimal
    status: AlertStatus
    created_at: datetime

    class Config:
        from_attributes = True


class BudgetAlertCheck(BaseModel):
    """Result of checking all customer budgets for alerts."""
    customers_checked: int
    alerts_triggered: int
    alerts: List[AlertResponse]
