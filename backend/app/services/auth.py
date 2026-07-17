import re
from datetime import UTC, datetime, timedelta

import bcrypt
from jose import jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128
_PASSWORD_HAS_LETTER = re.compile(r"[A-Za-z]")
_PASSWORD_HAS_DIGIT = re.compile(r"\d")
_EMAIL_BASIC = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_DOMAIN_LABEL = re.compile(r"^[a-zA-Z0-9-]+$")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_email_format(email: str) -> str:
    cleaned = email.strip()
    if not cleaned:
        raise ValueError("Enter your email address.")
    if not _EMAIL_BASIC.match(cleaned):
        raise ValueError("Enter a valid email address.")

    local, domain = cleaned.rsplit("@", 1)
    if not local or not domain or ".." in domain:
        raise ValueError("Enter a valid email address.")

    labels = domain.split(".")
    if len(labels) < 2:
        raise ValueError("Enter a valid email address.")

    for label in labels:
        if not label or not _DOMAIN_LABEL.fullmatch(label):
            raise ValueError("Enter a valid email address.")

    tld = labels[-1]
    # Reject likely typos like user@gmail.co (single-label TLD must be 3+ chars).
    if len(labels) == 2 and len(tld) < 3:
        raise ValueError("Enter a valid email address.")

    return cleaned.lower()


def validate_password_format(password: str) -> str:
    if not password:
        raise ValueError("Password is required.")
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Password must be at least {PASSWORD_MIN_LENGTH} characters.")
    if len(password) > PASSWORD_MAX_LENGTH:
        raise ValueError(f"Password must be at most {PASSWORD_MAX_LENGTH} characters.")
    if password != password.strip():
        raise ValueError("Password cannot start or end with spaces.")
    if not _PASSWORD_HAS_LETTER.search(password):
        raise ValueError("Password must include at least one letter.")
    if not _PASSWORD_HAS_DIGIT.search(password):
        raise ValueError("Password must include at least one number.")
    return password


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def create_access_token(user_id: int) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def create_user(
    db: Session,
    *,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    phone_num: str | None,
) -> User:
    validate_password_format(password)
    user = User(
        email=normalize_email(email),
        password=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        phone_num=phone_num,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
