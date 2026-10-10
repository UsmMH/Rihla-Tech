from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, EmailStr, Field, field_validator

from app.services.auth import (
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    validate_email_format,
    validate_password_format,
)


def _normalize_email(value: object) -> object:
    if isinstance(value, str):
        return validate_email_format(value)
    return value


NormalizedEmail = Annotated[EmailStr, BeforeValidator(_normalize_email)]


class UserPublic(BaseModel):
    id: int
    email: EmailStr
    first_name: str
    last_name: str
    phone_num: str | None
    is_admin: bool
    is_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserRegister(BaseModel):
    email: NormalizedEmail
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone_num: str | None = Field(default=None, max_length=30)

    @field_validator("password")
    @classmethod
    def check_register_password(cls, value: str) -> str:
        return validate_password_format(value)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def strip_name(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value


class UserLogin(BaseModel):
    email: NormalizedEmail
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class RegisterAcceptedResponse(BaseModel):
    email: EmailStr
    message: str


class EmailVerificationRequest(BaseModel):
    email: NormalizedEmail
    code: str = Field(min_length=6, max_length=6)

    @field_validator("code")
    @classmethod
    def check_code_format(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned.isdigit() or len(cleaned) != 6:
            raise ValueError("Enter the 6-digit code.")
        return cleaned


class ResendCodeRequest(BaseModel):
    email: NormalizedEmail
