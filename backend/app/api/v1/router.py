from fastapi import APIRouter
from app.api.v1 import auth, tenants, customers, usage, api_keys, alerts, billing, internal, routing, realtime, predictions, workflows, outcome_billing, admin, trial

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(trial.router, prefix="/trial", tags=["Trial Requests"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["Tenants"])
api_router.include_router(customers.router, prefix="/customers", tags=["Customers"])
api_router.include_router(usage.router, prefix="/usage", tags=["Usage"])
api_router.include_router(api_keys.router, prefix="/api-keys", tags=["API Keys"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
api_router.include_router(billing.router, prefix="/billing", tags=["Billing"])
api_router.include_router(internal.router, prefix="/internal", tags=["Internal"])
api_router.include_router(routing.router, prefix="/routing", tags=["Smart Routing"])
api_router.include_router(realtime.router, prefix="/realtime", tags=["Real-Time"])
api_router.include_router(predictions.router, prefix="/predictions", tags=["Predictions"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["Agent Workflows"])
api_router.include_router(outcome_billing.router, prefix="/agentic", tags=["Agentic AI Billing"])
