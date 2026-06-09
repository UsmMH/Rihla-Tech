from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserPublic(BaseModel):
    id: int
    email: EmailStr
    first_name: str
    last_name: str
    phone_num: str | None
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone_num: str | None = Field(default=None, max_length=30)


class UserLogin(BaseModel):
    email: EmailStr
    password: str
