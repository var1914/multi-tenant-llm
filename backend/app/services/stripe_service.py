import stripe
import logging
from typing import Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models.tenant import Tenant
from app.models.pricing_plan import PricingPlan

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


class StripeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_customer(self, tenant: Tenant) -> str:
        """
        Get existing Stripe customer or create a new one for the tenant.
        Returns the Stripe customer ID.
        """
        if tenant.stripe_customer_id:
            return tenant.stripe_customer_id

        # Get the owner user's email
        from app.models.user import User
        result = await self.db.execute(
            select(User).where(
                User.tenant_id == tenant.id,
                User.role == "owner"
            )
        )
        owner = result.scalar_one_or_none()

        # Create Stripe customer
        customer = stripe.Customer.create(
            name=tenant.company_name,
            email=owner.email if owner else None,
            metadata={
                "tenant_id": str(tenant.id),
                "tenant_slug": tenant.slug,
            }
        )

        # Update tenant with Stripe customer ID
        tenant.stripe_customer_id = customer.id
        await self.db.commit()

        logger.info(f"Created Stripe customer {customer.id} for tenant {tenant.id}")
        return customer.id

    async def create_checkout_session(
        self,
        tenant: Tenant,
        plan_slug: str,
        billing_interval: str = "monthly"
    ) -> dict:
        """
        Create a Stripe Checkout session for subscribing to a plan.
        Returns checkout session URL and ID.
        """
        # Get the pricing plan
        result = await self.db.execute(
            select(PricingPlan).where(
                PricingPlan.slug == plan_slug,
                PricingPlan.is_active == True
            )
        )
        plan = result.scalar_one_or_none()
        if not plan:
            raise ValueError(f"Plan '{plan_slug}' not found or inactive")

        # Get or create Stripe customer
        customer_id = await self.get_or_create_customer(tenant)

        # Get the appropriate price ID
        price_id = (
            plan.stripe_price_id_yearly if billing_interval == "yearly"
            else plan.stripe_price_id_monthly
        )

        if not price_id:
            raise ValueError(f"Stripe price not configured for {plan_slug} ({billing_interval})")

        # Create checkout session
        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            line_items=[
                {
                    "price": price_id,
                    "quantity": 1,
                }
            ],
            success_url=f"{settings.FRONTEND_URL}/billing?success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.FRONTEND_URL}/billing?canceled=true",
            metadata={
                "tenant_id": str(tenant.id),
                "plan_slug": plan_slug,
                "billing_interval": billing_interval,
            },
            subscription_data={
                "metadata": {
                    "tenant_id": str(tenant.id),
                    "plan_id": str(plan.id),
                }
            }
        )

        logger.info(f"Created checkout session {session.id} for tenant {tenant.id}")
        return {
            "checkout_url": session.url,
            "session_id": session.id,
        }

    async def create_billing_portal_session(self, tenant: Tenant) -> str:
        """
        Create a Stripe Billing Portal session for managing subscription.
        Returns the portal URL.
        """
        if not tenant.stripe_customer_id:
            raise ValueError("Tenant has no Stripe customer")

        session = stripe.billing_portal.Session.create(
            customer=tenant.stripe_customer_id,
            return_url=f"{settings.FRONTEND_URL}/billing",
        )

        return session.url

    async def cancel_subscription(
        self,
        tenant: Tenant,
        cancel_at_period_end: bool = True,
        reason: Optional[str] = None
    ) -> dict:
        """
        Cancel a subscription.
        By default, cancels at the end of the current billing period.
        """
        if not tenant.stripe_subscription_id:
            raise ValueError("Tenant has no active subscription")

        if cancel_at_period_end:
            # Cancel at end of period
            subscription = stripe.Subscription.modify(
                tenant.stripe_subscription_id,
                cancel_at_period_end=True,
                metadata={"cancellation_reason": reason} if reason else {}
            )
        else:
            # Cancel immediately
            subscription = stripe.Subscription.cancel(
                tenant.stripe_subscription_id
            )

        # Update tenant status
        tenant.subscription_status = subscription.status
        await self.db.commit()

        logger.info(f"Cancelled subscription for tenant {tenant.id}, cancel_at_period_end={cancel_at_period_end}")

        return {
            "status": subscription.status,
            "cancel_at_period_end": subscription.cancel_at_period_end,
            "current_period_end": datetime.fromtimestamp(subscription.current_period_end),
        }

    async def handle_webhook_event(self, payload: bytes, sig_header: str) -> dict:
        """
        Handle incoming Stripe webhook events.
        Returns event type and any relevant data.
        """
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except ValueError as e:
            logger.error(f"Invalid webhook payload: {e}")
            raise ValueError("Invalid payload")
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid webhook signature: {e}")
            raise ValueError("Invalid signature")

        event_type = event["type"]
        data = event["data"]["object"]

        logger.info(f"Processing webhook event: {event_type}")

        # Handle different event types
        if event_type == "checkout.session.completed":
            await self._handle_checkout_completed(data)
        elif event_type == "customer.subscription.created":
            await self._handle_subscription_created(data)
        elif event_type == "customer.subscription.updated":
            await self._handle_subscription_updated(data)
        elif event_type == "customer.subscription.deleted":
            await self._handle_subscription_deleted(data)
        elif event_type == "invoice.paid":
            await self._handle_invoice_paid(data)
        elif event_type == "invoice.payment_failed":
            await self._handle_invoice_payment_failed(data)

        return {"event_type": event_type, "processed": True}

    async def _handle_checkout_completed(self, session: dict):
        """Handle successful checkout session completion."""
        tenant_id = session.get("metadata", {}).get("tenant_id")
        if not tenant_id:
            logger.warning("Checkout completed without tenant_id in metadata")
            return

        # Get tenant
        result = await self.db.execute(
            select(Tenant).where(Tenant.id == UUID(tenant_id))
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            logger.error(f"Tenant {tenant_id} not found for checkout session")
            return

        # Update tenant with subscription info
        subscription_id = session.get("subscription")
        if subscription_id:
            tenant.stripe_subscription_id = subscription_id
            tenant.subscription_status = "active"

            # Get the plan from metadata
            plan_slug = session.get("metadata", {}).get("plan_slug")
            if plan_slug:
                plan_result = await self.db.execute(
                    select(PricingPlan).where(PricingPlan.slug == plan_slug)
                )
                plan = plan_result.scalar_one_or_none()
                if plan:
                    tenant.current_plan_id = plan.id
                    tenant.subscription_plan = plan_slug

            await self.db.commit()
            logger.info(f"Updated tenant {tenant_id} with subscription {subscription_id}")

    async def _handle_subscription_created(self, subscription: dict):
        """Handle new subscription creation."""
        tenant_id = subscription.get("metadata", {}).get("tenant_id")
        if not tenant_id:
            return

        result = await self.db.execute(
            select(Tenant).where(Tenant.id == UUID(tenant_id))
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            return

        tenant.stripe_subscription_id = subscription["id"]
        tenant.subscription_status = subscription["status"]
        tenant.subscription_period_end = datetime.fromtimestamp(
            subscription["current_period_end"]
        )

        plan_id = subscription.get("metadata", {}).get("plan_id")
        if plan_id:
            tenant.current_plan_id = UUID(plan_id)

        await self.db.commit()
        logger.info(f"Subscription created for tenant {tenant_id}")

    async def _handle_subscription_updated(self, subscription: dict):
        """Handle subscription updates (plan changes, status changes, etc.)."""
        customer_id = subscription.get("customer")
        if not customer_id:
            return

        result = await self.db.execute(
            select(Tenant).where(Tenant.stripe_customer_id == customer_id)
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            return

        tenant.subscription_status = subscription["status"]
        tenant.subscription_period_end = datetime.fromtimestamp(
            subscription["current_period_end"]
        )

        # Check for plan changes in the subscription items
        items = subscription.get("items", {}).get("data", [])
        if items:
            price_id = items[0].get("price", {}).get("id")
            if price_id:
                # Find the plan by Stripe price ID
                plan_result = await self.db.execute(
                    select(PricingPlan).where(
                        (PricingPlan.stripe_price_id_monthly == price_id) |
                        (PricingPlan.stripe_price_id_yearly == price_id)
                    )
                )
                plan = plan_result.scalar_one_or_none()
                if plan:
                    tenant.current_plan_id = plan.id
                    tenant.subscription_plan = plan.slug

        await self.db.commit()
        logger.info(f"Subscription updated for tenant {tenant.id}")

    async def _handle_subscription_deleted(self, subscription: dict):
        """Handle subscription cancellation/deletion."""
        customer_id = subscription.get("customer")
        if not customer_id:
            return

        result = await self.db.execute(
            select(Tenant).where(Tenant.stripe_customer_id == customer_id)
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            return

        tenant.subscription_status = "canceled"
        tenant.stripe_subscription_id = None
        # Keep current_plan_id for reference

        await self.db.commit()
        logger.info(f"Subscription canceled for tenant {tenant.id}")

    async def _handle_invoice_paid(self, invoice: dict):
        """Handle successful invoice payment."""
        customer_id = invoice.get("customer")
        subscription_id = invoice.get("subscription")

        if not customer_id:
            return

        result = await self.db.execute(
            select(Tenant).where(Tenant.stripe_customer_id == customer_id)
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            return

        # Could create a billing period record here
        logger.info(f"Invoice paid for tenant {tenant.id}: {invoice.get('id')}")

    async def _handle_invoice_payment_failed(self, invoice: dict):
        """Handle failed invoice payment."""
        customer_id = invoice.get("customer")

        if not customer_id:
            return

        result = await self.db.execute(
            select(Tenant).where(Tenant.stripe_customer_id == customer_id)
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            return

        tenant.subscription_status = "past_due"
        await self.db.commit()

        logger.warning(f"Invoice payment failed for tenant {tenant.id}: {invoice.get('id')}")

    async def get_subscription_details(self, tenant: Tenant) -> Optional[dict]:
        """Get current subscription details from Stripe."""
        if not tenant.stripe_subscription_id:
            return None

        try:
            subscription = stripe.Subscription.retrieve(tenant.stripe_subscription_id)
            return {
                "status": subscription.status,
                "current_period_start": datetime.fromtimestamp(subscription.current_period_start),
                "current_period_end": datetime.fromtimestamp(subscription.current_period_end),
                "cancel_at_period_end": subscription.cancel_at_period_end,
            }
        except stripe.error.InvalidRequestError:
            return None
