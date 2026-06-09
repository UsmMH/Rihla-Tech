from datetime import date

from pydantic import BaseModel, Field

from app.schemas.quiz import TripPlanPublic


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


class GenerateTripRequest(BaseModel):
    trip_plan_id: int


class PlacePublic(BaseModel):
    id: int
    day_number: int
    trip_date: date | None
    time_slot: str
    sort_order: int
    day_theme: str | None
    name: str
    description: str | None
    activity_type: str | None
    duration: str | None
    latitude: float | None
    longitude: float | None

    model_config = {"from_attributes": True}


class TripStatPublic(BaseModel):
    label: str
    value: str


class DayItineraryPublic(BaseModel):
    day: int
    theme: str
    date: date | None
    activities: list["ActivityPublic"]


class ActivityPublic(BaseModel):
    name: str
    time: str
    time_slot: str
    type: str
    desc: str
    duration: str


class TripDetailResponse(BaseModel):
    trip_plan: TripPlanPublic
    destination: str
    duration: str
    tags: str
    stats: list[TripStatPublic]
    itinerary: list[DayItineraryPublic]
    source: str
    fallback_reason: str | None = None


class GenerateTripResponse(TripDetailResponse):
    pass
