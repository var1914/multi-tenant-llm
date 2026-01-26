from sqlalchemy import Column, String, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class TrialRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class TrialRequest(Base, UUIDMixin, TimestampMixin):
    """
    Model for storing MVP trial credit requests.
    Users request $5 trial credits, admin reviews and approves/rejects.
    """
    __tablename__ = "trial_requests"

    email = Column(String(255), nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=True)
    use_case = Column(Text, nullable=False)  # "What are you building?"
    status = Column(
        SQLEnum(TrialRequestStatus),
        default=TrialRequestStatus.PENDING,
        nullable=False,
        index=True
    )
    admin_notes = Column(Text, nullable=True)  # Notes from admin on approval/rejection
    tenant_id = Column(UUID(as_uuid=True), nullable=True)  # Set when user registers after approval
