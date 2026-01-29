from pydantic import BaseModel, EmailStr
from typing import Optional
from decimal import Decimal
from uuid import UUID


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    company_name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenData(BaseModel):
    user_id: UUID
    tenant_id: UUID
    email: str
    role: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    role: str
    tenant_id: UUID
    trial_credits_usd: Optional[Decimal] = None
    company_name: Optional[str] = None

    class Config:
        from_attributes = True
