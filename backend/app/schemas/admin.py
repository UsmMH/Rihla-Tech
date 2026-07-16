from datetime import datetime

from pydantic import BaseModel


class AdminStats(BaseModel):
    users: int
    trips: int
    shared_trips: int
    comments: int


class AdminUserRow(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    is_admin: bool
    created_at: datetime
    trip_count: int

    model_config = {"from_attributes": True}


class AdminUserListResponse(BaseModel):
    items: list[AdminUserRow]
    total: int


class AdminTripRow(BaseModel):
    id: int
    user_id: int
    user_email: str
    destination: str | None
    status: str
    is_shared: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminTripListResponse(BaseModel):
    items: list[AdminTripRow]
    total: int


class AdminUserPatch(BaseModel):
    is_admin: bool
