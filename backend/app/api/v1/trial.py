"""Trial request API endpoints."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.models.trial_request import TrialRequest, TrialRequestStatus
from app.services.email_service import email_service

router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class TrialRequestCreate(BaseModel):
    """Schema for submitting a trial request."""
    email: EmailStr
    full_name: str
    company_name: Optional[str] = None
    use_case: str


class TrialRequestResponse(BaseModel):
    """Schema for trial request response."""
    id: UUID
    email: str
    full_name: str
    company_name: Optional[str]
    use_case: str
    status: TrialRequestStatus
    admin_notes: Optional[str]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class TrialRequestAction(BaseModel):
    """Schema for admin action on trial request."""
    action: str  # "approve" or "reject"
    admin_notes: Optional[str] = None


# ============================================================================
# Public Endpoints (No Auth Required)
# ============================================================================

@router.post("/request", response_model=dict, status_code=status.HTTP_201_CREATED)
async def submit_trial_request(
    data: TrialRequestCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Submit a request for $5 trial credits.
    No authentication required - this is a public endpoint.
    """
    # Check if email already has a pending or approved request
    existing = await db.execute(
        select(TrialRequest).where(
            TrialRequest.email == data.email,
            TrialRequest.status.in_([TrialRequestStatus.PENDING, TrialRequestStatus.APPROVED])
        )
    )
    existing_request = existing.scalars().first()

    if existing_request:
        if existing_request.status == TrialRequestStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A trial request for this email is already pending review."
            )
        elif existing_request.status == TrialRequestStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your trial has already been approved! Please register to access your credits."
            )

    # Create the trial request
    trial_request = TrialRequest(
        email=data.email,
        full_name=data.full_name,
        company_name=data.company_name,
        use_case=data.use_case,
        status=TrialRequestStatus.PENDING
    )

    db.add(trial_request)
    await db.commit()
    await db.refresh(trial_request)

    # Send notification to admin in background
    background_tasks.add_task(
        email_service.send_trial_request_notification,
        str(trial_request.id),
        data.email,
        data.full_name,
        data.company_name,
        data.use_case
    )

    return {
        "message": "Trial request submitted successfully! We'll review your request and get back to you soon.",
        "request_id": str(trial_request.id)
    }


@router.get("/status/{email}")
async def check_trial_status(
    email: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Check the status of a trial request by email.
    No authentication required.
    """
    result = await db.execute(
        select(TrialRequest)
        .where(TrialRequest.email == email)
        .order_by(TrialRequest.created_at.desc())
    )
    request = result.scalars().first()

    if not request:
        return {"status": "not_found", "message": "No trial request found for this email."}

    if request.status == TrialRequestStatus.PENDING:
        return {"status": "pending", "message": "Your request is being reviewed."}
    elif request.status == TrialRequestStatus.APPROVED:
        return {"status": "approved", "message": "Your trial has been approved! Please register to access your credits."}
    else:
        return {"status": "rejected", "message": "Unfortunately, your request was not approved at this time."}


# ============================================================================
# Admin Endpoints (Auth Required)
# ============================================================================

@router.get("/admin/requests")
async def get_trial_requests(
    status_filter: Optional[TrialRequestStatus] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Get all trial requests with optional filtering. Admin only.
    """
    query = select(TrialRequest).order_by(TrialRequest.created_at.desc())

    if status_filter:
        query = query.where(TrialRequest.status == status_filter)

    # Get total count
    count_query = select(func.count()).select_from(TrialRequest)
    if status_filter:
        count_query = count_query.where(TrialRequest.status == status_filter)
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get paginated results
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    requests = result.scalars().all()

    return {
        "requests": [
            {
                "id": str(r.id),
                "email": r.email,
                "full_name": r.full_name,
                "company_name": r.company_name,
                "use_case": r.use_case,
                "status": r.status.value,
                "admin_notes": r.admin_notes,
                "created_at": r.created_at.isoformat(),
                "updated_at": r.updated_at.isoformat()
            }
            for r in requests
        ],
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/admin/stats")
async def get_trial_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Get trial request statistics. Admin only.
    """
    # Count by status
    pending_result = await db.execute(
        select(func.count()).select_from(TrialRequest).where(
            TrialRequest.status == TrialRequestStatus.PENDING
        )
    )
    pending = pending_result.scalar()

    approved_result = await db.execute(
        select(func.count()).select_from(TrialRequest).where(
            TrialRequest.status == TrialRequestStatus.APPROVED
        )
    )
    approved = approved_result.scalar()

    rejected_result = await db.execute(
        select(func.count()).select_from(TrialRequest).where(
            TrialRequest.status == TrialRequestStatus.REJECTED
        )
    )
    rejected = rejected_result.scalar()

    total_result = await db.execute(
        select(func.count()).select_from(TrialRequest)
    )
    total = total_result.scalar()

    return {
        "total": total,
        "pending": pending,
        "approved": approved,
        "rejected": rejected
    }


@router.post("/admin/requests/{request_id}/action")
async def process_trial_request(
    request_id: UUID,
    data: TrialRequestAction,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Approve or reject a trial request. Admin only.
    """
    if data.action not in ["approve", "reject"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action must be 'approve' or 'reject'"
        )

    result = await db.execute(
        select(TrialRequest).where(TrialRequest.id == request_id)
    )
    trial_request = result.scalars().first()

    if not trial_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trial request not found"
        )

    if trial_request.status != TrialRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Request has already been {trial_request.status.value}"
        )

    # Update status
    if data.action == "approve":
        trial_request.status = TrialRequestStatus.APPROVED
        # Send approval email in background
        background_tasks.add_task(
            email_service.send_trial_approved_notification,
            trial_request.email,
            trial_request.full_name
        )
    else:
        trial_request.status = TrialRequestStatus.REJECTED

    trial_request.admin_notes = data.admin_notes

    await db.commit()
    await db.refresh(trial_request)

    return {
        "message": f"Trial request {data.action}d successfully",
        "request": {
            "id": str(trial_request.id),
            "email": trial_request.email,
            "full_name": trial_request.full_name,
            "status": trial_request.status.value
        }
    }
