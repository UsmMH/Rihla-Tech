from pydantic import BaseModel, Field


class DestinationSuggestion(BaseModel):
    city: str
    country: str
    blurb: str


class SuggestDestinationsRequest(BaseModel):
    trip_plan_id: int


class SuggestDestinationsResponse(BaseModel):
    suggestions: list[DestinationSuggestion]
    source: str  # "gemini" | "openrouter" | "openai" | "mock"
    fallback_reason: str | None = None


class SelectDestinationRequest(BaseModel):
    destination: str = Field(min_length=1, max_length=255)
