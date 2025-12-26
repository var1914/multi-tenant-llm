from fastapi import Depends, HTTPException, status, Security
from fastapi.security import APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import Optional

from app.database import get_db
from app.models.api_key import ApiKey
from app.models.tenant import Tenant
from app.utils.security import verify_api_key

api_key_header = APIKeyHeader(name="Authorization", auto_error=False)


async def get_tenant_from_api_key(
    api_key_header_value: Optional[str] = Security(api_key_header),
    db: AsyncSession = Depends(get_db)
) -> Tenant:
    if not api_key_header_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required",
        )

    # Remove "Bearer " prefix if present
    api_key = api_key_header_value.replace("Bearer ", "")

    # Validate API key format
    if not api_key.startswith(("uf_live_", "uf_test_")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key format",
        )

    # Find all active API keys and verify
    result = await db.execute(
        select(ApiKey).where(ApiKey.is_active == True)
    )
    api_keys = result.scalars().all()

    for key in api_keys:
        if verify_api_key(api_key, key.key_hash):
            # Update last used
            key.last_used_at = datetime.utcnow()
            await db.commit()

            # Get tenant
            tenant_result = await db.execute(
                select(Tenant).where(Tenant.id == key.tenant_id)
            )
            tenant = tenant_result.scalar_one_or_none()

            if tenant:
                return tenant

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid API key",
    )
