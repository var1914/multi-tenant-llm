from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List

from app.database import get_db
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerBudgetStatus
from app.services.customer_service import CustomerService
from app.dependencies import get_current_tenant_id

router = APIRouter()


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    data: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Create a new end customer."""
    service = CustomerService(db)
    try:
        customer = await service.create(tenant_id, data)
        return customer
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[CustomerResponse])
async def list_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """List all end customers for the current tenant."""
    service = CustomerService(db)
    return await service.list_all(tenant_id, skip, limit)


@router.get("/budgets/all", response_model=List[CustomerBudgetStatus])
async def get_all_budget_statuses(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Get budget status for all customers with budgets configured."""
    service = CustomerService(db)
    return await service.get_all_budget_statuses(tenant_id)


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Get a specific customer by ID."""
    service = CustomerService(db)
    customer = await service.get_by_id(tenant_id, customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer


@router.patch("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: UUID,
    data: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Update a customer."""
    service = CustomerService(db)
    customer = await service.update(tenant_id, customer_id, data)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Delete a customer."""
    service = CustomerService(db)
    deleted = await service.delete(tenant_id, customer_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")


@router.get("/{customer_id}/budget", response_model=CustomerBudgetStatus)
async def get_customer_budget_status(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Get the current month's budget status for a customer."""
    service = CustomerService(db)
    budget_status = await service.get_budget_status(tenant_id, customer_id)
    if not budget_status:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return budget_status
