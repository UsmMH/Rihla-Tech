from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    database: str


class LlmStatusResponse(BaseModel):
    configured: bool
    provider: str
    model: str
