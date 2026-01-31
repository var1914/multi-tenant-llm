"""Admin service for platform-wide statistics and management."""
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.tenant import Tenant
from app.models.end_customer import EndCustomer
from app.models.api_key import ApiKey
from app.models.usage_event import UsageEvent
from app.models.page_view import PageView


class AdminService:
    """Service for admin dashboard statistics."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_platform_stats(self) -> dict:
        """Get overall platform statistics."""
        # Total users
        total_users = await self.db.scalar(
            select(func.count(User.id))
        )

        # Active users (logged in within last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        active_users_30d = await self.db.scalar(
            select(func.count(User.id)).where(
                User.last_login_at >= thirty_days_ago
            )
        )

        # Active users (last 7 days)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        active_users_7d = await self.db.scalar(
            select(func.count(User.id)).where(
                User.last_login_at >= seven_days_ago
            )
        )

        # Total tenants
        total_tenants = await self.db.scalar(
            select(func.count(Tenant.id))
        )

        # Total end customers (across all tenants)
        total_customers = await self.db.scalar(
            select(func.count(EndCustomer.id))
        )

        # Total API keys
        total_api_keys = await self.db.scalar(
            select(func.count(ApiKey.id))
        )

        active_api_keys = await self.db.scalar(
            select(func.count(ApiKey.id)).where(ApiKey.is_active == True)
        )

        # Total usage events
        total_events = await self.db.scalar(
            select(func.count(UsageEvent.id))
        )

        # Total tokens processed
        total_tokens = await self.db.scalar(
            select(func.coalesce(func.sum(UsageEvent.quantity), 0))
        )

        # Total cost (platform revenue from API usage)
        total_cost = await self.db.scalar(
            select(func.coalesce(func.sum(UsageEvent.cost_usd), 0))
        )

        return {
            "users": {
                "total": total_users or 0,
                "active_7d": active_users_7d or 0,
                "active_30d": active_users_30d or 0,
            },
            "tenants": {
                "total": total_tenants or 0,
            },
            "customers": {
                "total": total_customers or 0,
            },
            "api_keys": {
                "total": total_api_keys or 0,
                "active": active_api_keys or 0,
            },
            "usage": {
                "total_events": total_events or 0,
                "total_tokens": int(total_tokens or 0),
                "total_cost_usd": float(total_cost or 0),
            },
        }

    async def get_signups_over_time(self, days: int = 30) -> list[dict]:
        """Get daily signup counts for the last N days."""
        start_date = datetime.utcnow() - timedelta(days=days)

        result = await self.db.execute(
            select(
                func.date(User.created_at).label('date'),
                func.count(User.id).label('count')
            )
            .where(User.created_at >= start_date)
            .group_by(func.date(User.created_at))
            .order_by(func.date(User.created_at))
        )

        rows = result.all()
        return [{"date": str(row.date), "signups": row.count} for row in rows]

    async def get_usage_over_time(self, days: int = 30) -> list[dict]:
        """Get daily usage stats for the last N days."""
        start_date = datetime.utcnow() - timedelta(days=days)

        result = await self.db.execute(
            select(
                func.date(UsageEvent.timestamp).label('date'),
                func.count(UsageEvent.id).label('events'),
                func.coalesce(func.sum(UsageEvent.quantity), 0).label('tokens'),
                func.coalesce(func.sum(UsageEvent.cost_usd), 0).label('cost')
            )
            .where(UsageEvent.timestamp >= start_date)
            .group_by(func.date(UsageEvent.timestamp))
            .order_by(func.date(UsageEvent.timestamp))
        )

        rows = result.all()
        return [
            {
                "date": str(row.date),
                "events": row.events,
                "tokens": int(row.tokens),
                "cost": float(row.cost)
            }
            for row in rows
        ]

    async def get_recent_users(self, limit: int = 20) -> list[dict]:
        """Get recently registered users."""
        result = await self.db.execute(
            select(User, Tenant)
            .join(Tenant, User.tenant_id == Tenant.id)
            .order_by(User.created_at.desc())
            .limit(limit)
        )

        rows = result.all()
        return [
            {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "tenant_name": tenant.company_name,
                "role": user.role,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            }
            for user, tenant in rows
        ]

    async def get_top_tenants_by_usage(self, limit: int = 10) -> list[dict]:
        """Get top tenants by API usage."""
        result = await self.db.execute(
            select(
                Tenant.id,
                Tenant.company_name,
                func.count(UsageEvent.id).label('event_count'),
                func.coalesce(func.sum(UsageEvent.quantity), 0).label('total_tokens'),
                func.coalesce(func.sum(UsageEvent.cost_usd), 0).label('total_cost')
            )
            .join(UsageEvent, UsageEvent.tenant_id == Tenant.id, isouter=True)
            .group_by(Tenant.id, Tenant.company_name)
            .order_by(func.coalesce(func.sum(UsageEvent.cost_usd), 0).desc())
            .limit(limit)
        )

        rows = result.all()
        return [
            {
                "id": str(row.id),
                "company_name": row.company_name,
                "event_count": row.event_count,
                "total_tokens": int(row.total_tokens),
                "total_cost_usd": float(row.total_cost),
            }
            for row in rows
        ]

    async def get_model_usage_breakdown(self) -> list[dict]:
        """Get usage breakdown by model."""
        result = await self.db.execute(
            select(
                UsageEvent.model,
                func.count(UsageEvent.id).label('event_count'),
                func.coalesce(func.sum(UsageEvent.quantity), 0).label('total_tokens'),
                func.coalesce(func.sum(UsageEvent.cost_usd), 0).label('total_cost')
            )
            .group_by(UsageEvent.model)
            .order_by(func.coalesce(func.sum(UsageEvent.cost_usd), 0).desc())
            .limit(20)
        )

        rows = result.all()
        return [
            {
                "model": row.model or "unknown",
                "event_count": row.event_count,
                "total_tokens": int(row.total_tokens),
                "total_cost_usd": float(row.total_cost),
            }
            for row in rows
        ]

    async def get_all_users(
        self,
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None
    ) -> tuple[list[dict], int]:
        """Get all users with pagination and search."""
        query = select(User, Tenant).join(Tenant, User.tenant_id == Tenant.id)
        count_query = select(func.count(User.id))

        if search:
            search_filter = User.email.ilike(f"%{search}%")
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)

        # Get total count
        total = await self.db.scalar(count_query)

        # Get paginated results
        result = await self.db.execute(
            query
            .order_by(User.created_at.desc())
            .offset(skip)
            .limit(limit)
        )

        rows = result.all()
        users = [
            {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "tenant_id": str(user.tenant_id),
                "tenant_name": tenant.company_name,
                "role": user.role,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            }
            for user, tenant in rows
        ]

        return users, total or 0

    async def update_user_status(
        self,
        user_id: UUID,
        is_active: Optional[bool] = None,
        role: Optional[str] = None
    ) -> Optional[dict]:
        """Update a user's status or role."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            return None

        if is_active is not None:
            user.is_active = is_active
        if role is not None:
            user.role = role

        await self.db.commit()
        await self.db.refresh(user)

        return {
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
        }

    async def get_page_view_stats(self) -> dict:
        """Get page view summary stats."""
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        total_views = await self.db.scalar(
            select(func.count(PageView.id))
        )
        total_unique = await self.db.scalar(
            select(func.count(func.distinct(PageView.visitor_id)))
        )
        today_views = await self.db.scalar(
            select(func.count(PageView.id)).where(PageView.created_at >= today_start)
        )
        today_unique = await self.db.scalar(
            select(func.count(func.distinct(PageView.visitor_id)))
            .where(PageView.created_at >= today_start)
        )

        # Top referrers (excluding empty/null)
        referrer_result = await self.db.execute(
            select(
                PageView.referrer,
                func.count(PageView.id).label('count')
            )
            .where(PageView.referrer.isnot(None))
            .where(PageView.referrer != '')
            .group_by(PageView.referrer)
            .order_by(func.count(PageView.id).desc())
            .limit(10)
        )
        top_referrers = [
            {"referrer": row.referrer, "count": row.count}
            for row in referrer_result.all()
        ]

        # Top UTM sources
        utm_result = await self.db.execute(
            select(
                PageView.utm_source,
                func.count(PageView.id).label('count')
            )
            .where(PageView.utm_source.isnot(None))
            .group_by(PageView.utm_source)
            .order_by(func.count(PageView.id).desc())
            .limit(10)
        )
        top_sources = [
            {"source": row.utm_source, "count": row.count}
            for row in utm_result.all()
        ]

        return {
            "total_views": total_views or 0,
            "total_unique": total_unique or 0,
            "today_views": today_views or 0,
            "today_unique": today_unique or 0,
            "top_referrers": top_referrers,
            "top_sources": top_sources,
        }

    async def get_page_views_over_time(self, days: int = 30) -> list[dict]:
        """Get daily page view + unique visitor counts."""
        start_date = datetime.utcnow() - timedelta(days=days)

        result = await self.db.execute(
            select(
                func.date(PageView.created_at).label('date'),
                func.count(PageView.id).label('views'),
                func.count(func.distinct(PageView.visitor_id)).label('unique_visitors'),
            )
            .where(PageView.created_at >= start_date)
            .group_by(func.date(PageView.created_at))
            .order_by(func.date(PageView.created_at))
        )

        return [
            {
                "date": str(row.date),
                "views": row.views,
                "unique_visitors": row.unique_visitors,
            }
            for row in result.all()
        ]
