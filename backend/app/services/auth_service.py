from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import re

from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.auth import UserRegister, UserLogin
from app.utils.auth import get_password_hash, verify_password, create_access_token


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _generate_slug(self, company_name: str) -> str:
        """Generate a URL-safe slug from company name."""
        slug = company_name.lower()
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'[\s_]+', '-', slug)
        slug = re.sub(r'-+', '-', slug)
        return slug.strip('-')

    async def register(self, data: UserRegister) -> tuple[User, Tenant, str]:
        # Check if email exists
        result = await self.db.execute(select(User).where(User.email == data.email))
        if result.scalar_one_or_none():
            raise ValueError("Email already registered")

        # Generate slug and ensure uniqueness
        base_slug = self._generate_slug(data.company_name)
        slug = base_slug
        counter = 1

        while True:
            result = await self.db.execute(select(Tenant).where(Tenant.slug == slug))
            if not result.scalar_one_or_none():
                break
            slug = f"{base_slug}-{counter}"
            counter += 1

        # Create tenant
        tenant = Tenant(
            company_name=data.company_name,
            slug=slug,
        )
        self.db.add(tenant)
        await self.db.flush()

        # Create user
        user = User(
            tenant_id=tenant.id,
            email=data.email,
            hashed_password=get_password_hash(data.password),
            full_name=data.full_name,
            role="admin",  # First user is admin
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        await self.db.refresh(tenant)

        # Generate token
        token = create_access_token(
            user_id=user.id,
            tenant_id=tenant.id,
            email=user.email,
            role=user.role,
        )

        return user, tenant, token

    async def login(self, data: UserLogin) -> tuple[User, str]:
        result = await self.db.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()

        if not user or not verify_password(data.password, user.hashed_password):
            raise ValueError("Invalid email or password")

        if not user.is_active:
            raise ValueError("Account is inactive")

        # Update last login
        user.last_login_at = datetime.utcnow()
        await self.db.commit()

        # Generate token
        token = create_access_token(
            user_id=user.id,
            tenant_id=user.tenant_id,
            email=user.email,
            role=user.role,
        )

        return user, token
