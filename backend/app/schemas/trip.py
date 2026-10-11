from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator

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
    location_confirmed: bool = False


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
    kind: str = "city"
    iata_code: str | None = None
    city: str | None = None


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
    is_shared: bool = False
    share_caption: str | None = None


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


class ChatMessageRequest(BaseModel):
    trip_plan_id: int
    message: str = Field(min_length=1, max_length=4000)


class ChatMessagePublic(BaseModel):
    id: int
    role: str
    content: str
    proposes_edit: bool
    apply_instruction: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessagePublic]


class ApplyEditRequest(BaseModel):
    instruction: str = Field(min_length=1, max_length=4000)
    chat_message_id: int | None = None


class ChatMessageResponse(BaseModel):
    message: str
    source: str
    fallback_reason: str | None = None
    proposes_edit: bool = False
    apply_instruction: str | None = None
    assistant_message_id: int | None = None
    itinerary_updated: bool = False
    trip: TripDetailResponse | None = None


class ConsultHistoryItem(BaseModel):
    role: str
    content: str = Field(max_length=2000)

    @field_validator("content", mode="before")
    @classmethod
    def cap_content(cls, value: object) -> object:
        if isinstance(value, str) and len(value) > 2000:
            return value[:2000]
        return value


class ConsultChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ConsultHistoryItem] = Field(default_factory=list, max_length=20)

    @field_validator("history", mode="before")
    @classmethod
    def cap_history(cls, value: object) -> object:
        if isinstance(value, list) and len(value) > 20:
            return value[-20:]
        return value


class ConsultChatResponse(BaseModel):
    message: str
    source: str
    fallback_reason: str | None = None


class FlightSegmentPublic(BaseModel):
    origin: str
    origin_code: str
    destination: str
    destination_code: str
    departure_at: str | None = None
    arrival_at: str | None = None
    duration: str | None = None
    airline: str
    stops: int = 0
    layovers: list[str] = Field(default_factory=list)


class FlightOfferPublic(BaseModel):
    id: str
    airline: str
    price: str
    price_note: str | None = None
    price_amount: float | None = None
    currency: str = "SAR"
    leg: FlightSegmentPublic
    can_pick_return: bool = False
    can_book: bool = False


class FlightsResponse(BaseModel):
    offers: list[FlightOfferPublic]
    search_url: str
    source: str  # serpapi | fixture | unavailable
    unavailable_reason: str | None = None
    trip_type: str  # round | one_way
    origin_airport: str | None = None
    destination_airport: str | None = None
    traveler_count: int = 1
    fetched_at: datetime | None = None
    stale: bool = False
    refresh_failed: bool = False


class TripAirportsUpdate(BaseModel):
    origin: str | None = Field(default=None, max_length=255)
    destination: str | None = Field(default=None, max_length=255)


class BookingOptionPublic(BaseModel):
    provider: str
    price: str
    url: str
    post_data: str


class BookingResponse(BaseModel):
    options: list[BookingOptionPublic]
    fallback_url: str
    unavailable: bool = False
    unavailable_reason: str | None = None


class HotelOptionPublic(BaseModel):
    id: str
    name: str
    area: str
    stars: int
    price_per_night: str
    price_note: str | None = None
    price_tier: str
    amenities: list[str]
    booking_url: str


class HotelsResponse(BaseModel):
    hotels: list[HotelOptionPublic]
    search_url: str
    source: str
    check_in: date | None = None
    check_out: date | None = None
