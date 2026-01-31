from datetime import datetime

from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import UUIDMixin
from app.database import Base


class PageView(Base, UUIDMixin):
    __tablename__ = "page_views"

    page_path = Column(String(500), nullable=False)
    referrer = Column(String(1000), nullable=True)
    utm_source = Column(String(255), nullable=True)
    utm_medium = Column(String(255), nullable=True)
    visitor_id = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
