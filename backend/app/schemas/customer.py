from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal


class CustomerCreate(BaseModel):
    external_id: str
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    metadata: Optional[Dict[str, Any]] = {}
    budget_limit_usd: Optional[Decimal] = None
    budget_alert_threshold: Optional[Decimal] = 80
    budget_alert_enabled: Optional[bool] = True


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    metadata: Optional[Dict[str, Any]] = None
    budget_limit_usd: Optional[Decimal] = None
    budget_alert_threshold: Optional[Decimal] = None
    budget_alert_enabled: Optional[bool] = None


class CustomerResponse(BaseModel):
    id: UUID
    external_id: str
    name: Optional[str]
    email: Optional[str]
    customer_metadata: Dict[str, Any]
    budget_limit_usd: Optional[Decimal]
    budget_alert_threshold: Optional[Decimal]
    budget_alert_enabled: Optional[bool]
    created_at: datetime

    class Config:
        from_attributes = True

    @property
    def metadata(self) -> Dict[str, Any]:
        return self.customer_metadata


class CustomerBudgetStatus(BaseModel):
    customer_id: str
    customer_name: Optional[str]
    budget_limit_usd: Optional[Decimal]
    current_spend_usd: Decimal
    percentage_used: float
    is_over_budget: bool
    is_near_threshold: bool
