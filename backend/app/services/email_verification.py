import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User

CODE_LENGTH = 6
CODE_TTL = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_ATTEMPTS = 5


def _hash_code(code: str) -> str:
    return hashlib.sha256(f"{code}:{settings.jwt_secret}".encode()).hexdigest()


def _generate_code() -> str:
    return f"{secrets.randbelow(10 ** CODE_LENGTH):0{CODE_LENGTH}d}"


def resend_cooldown_seconds_remaining(user: User) -> int:
    if not user.verification_last_sent_at:
        return 0
    elapsed = datetime.now(timezone.utc) - user.verification_last_sent_at
    remaining = RESEND_COOLDOWN - elapsed
    return max(0, int(remaining.total_seconds()))


def issue_verification_code(db: Session, user: User) -> str:
    """Generate a fresh code, store its hash, and reset attempt/expiry state."""
    code = _generate_code()
    user.verification_code_hash = _hash_code(code)
    user.verification_code_expires_at = datetime.now(timezone.utc) + CODE_TTL
    user.verification_attempts = 0
    user.verification_last_sent_at = datetime.now(timezone.utc)
    db.commit()
    return code


def consume_verification_code(db: Session, user: User, code: str) -> str | None:
    """Validate a submitted code. Returns None on success (and marks the user
    verified), or a user-facing error message on failure."""
    if not user.verification_code_hash or not user.verification_code_expires_at:
        return "No pending verification code. Please request a new one."

    if datetime.now(timezone.utc) > user.verification_code_expires_at:
        return "This code has expired. Please request a new one."

    if user.verification_attempts >= MAX_ATTEMPTS:
        user.verification_code_hash = None
        user.verification_code_expires_at = None
        db.commit()
        return "Too many incorrect attempts. Please request a new code."

    if not hmac.compare_digest(_hash_code(code.strip()), user.verification_code_hash):
        user.verification_attempts += 1
        remaining = MAX_ATTEMPTS - user.verification_attempts
        if remaining <= 0:
            user.verification_code_hash = None
            user.verification_code_expires_at = None
            db.commit()
            return "Too many incorrect attempts. Please request a new code."
        db.commit()
        return f"Incorrect code. {remaining} attempt{'s' if remaining != 1 else ''} left."

    user.is_verified = True
    user.verification_code_hash = None
    user.verification_code_expires_at = None
    user.verification_attempts = 0
    db.commit()
    return None
