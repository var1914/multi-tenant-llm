import boto3
from botocore.exceptions import ClientError
import logging
from app.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """
    Email service using AWS SES for sending notifications.
    Used for trial request notifications and admin alerts.
    """

    def __init__(self):
        self.client = boto3.client('ses', region_name=settings.AWS_REGION)
        self.sender = settings.SES_SENDER_EMAIL
        self.admin_email = settings.ADMIN_EMAIL

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: str | None = None
    ) -> bool:
        """
        Send an email via AWS SES.
        Returns True if sent successfully, False otherwise.
        """
        try:
            body = {"Html": {"Charset": "UTF-8", "Data": body_html}}
            if body_text:
                body["Text"] = {"Charset": "UTF-8", "Data": body_text}

            response = self.client.send_email(
                Source=self.sender,
                Destination={"ToAddresses": [to_email]},
                Message={
                    "Subject": {"Charset": "UTF-8", "Data": subject},
                    "Body": body
                }
            )
            logger.info(f"Email sent to {to_email}, MessageId: {response['MessageId']}")
            return True
        except ClientError as e:
            logger.error(f"Failed to send email to {to_email}: {e.response['Error']['Message']}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending email to {to_email}: {str(e)}")
            return False

    async def send_trial_request_notification(
        self,
        request_id: str,
        email: str,
        full_name: str,
        company_name: str | None,
        use_case: str
    ) -> bool:
        """
        Send notification to admin when a new trial request is submitted.
        """
        subject = f"[TokenTrail] New Trial Request from {full_name}"

        body_html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #22c55e 0%, #eab308 50%, #ef4444 100%); padding: 20px; border-radius: 8px 8px 0 0; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .content {{ background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }}
                .field {{ margin-bottom: 15px; }}
                .label {{ font-weight: bold; color: #555; }}
                .value {{ margin-top: 5px; padding: 10px; background: white; border-radius: 4px; border-left: 3px solid #22c55e; }}
                .use-case {{ white-space: pre-wrap; }}
                .footer {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>New Trial Request</h1>
                </div>
                <div class="content">
                    <div class="field">
                        <div class="label">Name:</div>
                        <div class="value">{full_name}</div>
                    </div>
                    <div class="field">
                        <div class="label">Email:</div>
                        <div class="value">{email}</div>
                    </div>
                    <div class="field">
                        <div class="label">Company:</div>
                        <div class="value">{company_name or 'Not provided'}</div>
                    </div>
                    <div class="field">
                        <div class="label">What they're building:</div>
                        <div class="value use-case">{use_case}</div>
                    </div>
                    <div class="footer">
                        <p>Request ID: {request_id}</p>
                        <p>To approve this request, log in to the <a href="{settings.FRONTEND_URL}/app/admin">Admin Panel</a>.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

        body_text = f"""
New Trial Request for TokenTrail

Name: {full_name}
Email: {email}
Company: {company_name or 'Not provided'}
What they're building:
{use_case}

---
Request ID: {request_id}
Approve at: {settings.FRONTEND_URL}/app/admin
        """

        return await self.send_email(
            to_email=self.admin_email,
            subject=subject,
            body_html=body_html,
            body_text=body_text
        )

    async def send_trial_approved_notification(
        self,
        email: str,
        full_name: str
    ) -> bool:
        """
        Send notification to user when their trial is approved.
        """
        subject = "Your TokenTrail Trial Has Been Approved!"

        body_html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #22c55e 0%, #eab308 50%, #ef4444 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 28px; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
                .highlight {{ background: #22c55e; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }}
                .highlight h2 {{ margin: 0; font-size: 24px; }}
                .cta {{ text-align: center; margin: 30px 0; }}
                .cta a {{ background: #22c55e; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; }}
                .footer {{ margin-top: 20px; text-align: center; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to TokenTrail!</h1>
                </div>
                <div class="content">
                    <p>Hi {full_name},</p>
                    <p>Great news! Your trial request has been approved.</p>
                    <div class="highlight">
                        <h2>$5 Trial Credits Waiting</h2>
                    </div>
                    <p>Create your account to unlock $5 in trial credits and explore all TokenTrail features:</p>
                    <ul>
                        <li>Multi-tenant LLM usage tracking</li>
                        <li>Smart model routing for cost optimization</li>
                        <li>Real-time dashboards and analytics</li>
                        <li>Agent workflow tracking</li>
                        <li>Predictive budget alerts</li>
                    </ul>
                    <div class="cta">
                        <a href="{settings.FRONTEND_URL}/register">Create Your Account</a>
                    </div>
                    <p>Register with this email ({email}) to automatically receive your $5 credits.</p>
                    <div class="footer">
                        <p>Questions? Reply to this email or reach out at support@tokentrail.dev</p>
                        <p>Happy building!</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

        body_text = f"""
Hi {full_name},

Great news! Your TokenTrail trial request has been approved.

Create your account to unlock $5 in trial credits and explore all features:
- Multi-tenant LLM usage tracking
- Smart model routing for cost optimization
- Real-time dashboards and analytics
- Agent workflow tracking
- Predictive budget alerts

Create your account: {settings.FRONTEND_URL}/register

Register with this email ({email}) to automatically receive your $5 credits.

Questions? Reply to this email.

Happy building!
- The TokenTrail Team
        """

        return await self.send_email(
            to_email=email,
            subject=subject,
            body_html=body_html,
            body_text=body_text
        )


# Singleton instance
email_service = EmailService()
