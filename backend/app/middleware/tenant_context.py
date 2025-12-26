from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from contextvars import ContextVar
from uuid import UUID
from typing import Optional

# Context variable for tenant ID
current_tenant_id: ContextVar[Optional[UUID]] = ContextVar("current_tenant_id", default=None)


class TenantContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Reset tenant context for each request
        token = current_tenant_id.set(None)
        try:
            response = await call_next(request)
            return response
        finally:
            current_tenant_id.reset(token)


def get_tenant_context() -> Optional[UUID]:
    return current_tenant_id.get()


def set_tenant_context(tenant_id: UUID) -> None:
    current_tenant_id.set(tenant_id)
