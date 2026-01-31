"""Public tracking endpoints for page view analytics."""
import hashlib
from typing import Optional

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.page_view import PageView

router = APIRouter()


class PageViewEvent(BaseModel):
    page_path: str
    referrer: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None


def _compute_visitor_id(request: Request) -> str:
    """SHA-256 hash of client IP + User-Agent. No PII stored."""
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    raw = f"{ip}:{ua}"
    return hashlib.sha256(raw.encode()).hexdigest()


@router.post("/pageview", status_code=204)
async def track_pageview(
    event: PageViewEvent,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Record a page view. No authentication required."""
    visitor_id = _compute_visitor_id(request)

    page_view = PageView(
        page_path=event.page_path[:500],
        referrer=(event.referrer or "")[:1000] or None,
        utm_source=(event.utm_source or "")[:255] or None,
        utm_medium=(event.utm_medium or "")[:255] or None,
        visitor_id=visitor_id,
    )
    db.add(page_view)
    await db.commit()

    return Response(status_code=204)
