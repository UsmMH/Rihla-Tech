"""Transactional email sending (Resend). See docs/project-summary.md / plan.md
for the current sandbox limitation: without a verified domain, Resend's
onboarding@resend.dev sender can only deliver to the email on the Resend
account itself — everything else gets a 403. We never let that fail the
request; the code is logged instead so local dev/testing can continue."""

import logging

import resend

from app.config import settings

logger = logging.getLogger(__name__)


def email_configured() -> bool:
    return bool(settings.resend_api_key)


def send_verification_email(to_email: str, code: str) -> None:
    if not email_configured():
        logger.warning(
            "RESEND_API_KEY not set — verification code for %s: %s", to_email, code
        )
        return

    resend.api_key = settings.resend_api_key
    try:
        resend.Emails.send(
            {
                "from": settings.resend_from_email,
                "to": [to_email],
                "subject": "Your RihlaTech verification code",
                "html": (
                    "<div style=\"font-family: sans-serif;\">"
                    "<p>Your RihlaTech verification code is:</p>"
                    f"<p style=\"font-size: 28px; font-weight: 700; letter-spacing: 6px;\">{code}</p>"
                    "<p>This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>"
                    "</div>"
                ),
            }
        )
    except Exception as exc:
        logger.warning("Failed to send verification email to %s: %s", to_email, exc)
