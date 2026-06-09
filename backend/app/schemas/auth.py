from pydantic import BaseModel

from app.schemas.user import UserPublic


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
