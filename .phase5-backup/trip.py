from datetime import date, datetime

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
    place_id: int
    name: str
    time: str
    time_slot: str
    type: str
    desc: str
    duration: str
    latitude: float | None = None
    longitude: float | None = None


class MapPinPublic(BaseModel):
    place_id: int
    name: str
    day_number: int
    time_slot: str
    activity_type: str | None
    latitude: float
    longitude: float


class PlaceSearchResult(BaseModel):
    label: str
    latitude: float
    longitude: float


class TripDetailResponse(BaseModel):
    trip_plan: TripPlanPublic
    destination: str
    duration: str
    tags: str
    stats: list[TripStatPublic]
    itinerary: list[DayItineraryPublic]
    map_pins: list[MapPinPublic]
    geocoding_configured: bool
    places_geocoded: int
    source: str
    fallback_reason: str | None = None


class GenerateTripResponse(TripDetailResponse):
    pass


class TripListItem(BaseModel):
    id: int
    destination: str | None
    start_date: date | None
    end_date: date | None
    status: str
    itinerary_source: str | None
    has_itinerary: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TripListResponse(BaseModel):
    trips: list[TripListItem]


class EditTripRequest(BaseModel):
    prompt: str = Field(
        default="Suggest 3 alternative destinations similar to this trip.",
        min_length=1,
        max_length=2000,
    )


class TripAlternativePublic(BaseModel):
    title: str
    tagline: str
    highlights: list[str]
    budget_note: str
    match_percent: int


class EditTripResponse(BaseModel):
    alternatives: list[TripAlternativePublic]
    source: str
    fallback_reason: str | None = None


class ChatMessageRequest(BaseModel):
    trip_plan_id: int
    message: str = Field(min_length=1, max_length=4000)


class ChatMessageResponse(BaseModel):
    message: str
    source: str
    fallback_reason: str | None = None
