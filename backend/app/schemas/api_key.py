from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class ApiKeyCreate(BaseModel):
    name: Optional[str] = None
    environment: str = "production"


class ApiKeyResponse(BaseModel):
    id: UUID
    key_prefix: str
    name: Optional[str]
    environment: str
    is_active: bool
    last_used_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ApiKeyCreated(ApiKeyResponse):
    key: str  # Full key only returned on creation
