from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.trip_plan import TripPlan
from app.models.user import User
from app.schemas.quiz import TripPlanPublic
from app.schemas.trip import (
    ApplyEditRequest,
    BookingResponse,
    FlightsResponse,
    GenerateTripRequest,
    GenerateTripResponse,
    HotelsResponse,
    SelectDestinationRequest,
    SuggestDestinationsRequest,
    SuggestDestinationsResponse,
    TripAirportsUpdate,
    TripDetailResponse,
    TripListItem,
    TripListResponse,
)
from app.services.destinations import select_destination, suggest_destinations
from app.services.flights import booking_options, search_flights, search_returns, set_trip_airports
from app.services.rate_limit import enforce_rate_limit
from app.services.hotels import search_hotels
from app.services.apply_edit import apply_itinerary_edit
from app.services.chat import mark_chat_edit_applied
from app.services.itinerary import (
    delete_trip_plan,
    generate_itinerary,
    get_trip_detail,
    list_user_trips,
)

router = APIRouter(prefix="/trips", tags=["trips"])


@router.get("", response_model=TripListResponse)
def list_trips(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TripListResponse:
    trips = list_user_trips(db, current_user)
    items = [
        TripListItem(
            id=t.id,
            destination=t.destination,
            start_date=t.start_date,
            end_date=t.end_date,
            status=t.status,
            itinerary_source=t.itinerary_source,
            has_itinerary=bool(t.places),
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in trips
    ]
    return TripListResponse(trips=items)


@router.post("/suggest-destinations", response_model=SuggestDestinationsResponse)
def suggest_trip_destinations(
    payload: SuggestDestinationsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SuggestDestinationsResponse:
    return suggest_destinations(db, current_user, payload.trip_plan_id)


@router.post("/generate", response_model=GenerateTripResponse)
def generate_trip_itinerary(
    payload: GenerateTripRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GenerateTripResponse:
    return generate_itinerary(db, current_user, payload.trip_plan_id)


@router.delete("/{trip_plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(
    trip_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    delete_trip_plan(db, current_user, trip_plan_id)


@router.get("/{trip_plan_id}", response_model=TripDetailResponse)
def get_trip(
    trip_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TripDetailResponse:
    return get_trip_detail(db, current_user, trip_plan_id)


FLIGHTS_BURST_SCOPE = "trip_flights_live"


@router.get("/{trip_plan_id}/flights", response_model=FlightsResponse)
def get_trip_flights(
    trip_plan_id: int,
    request: Request,
    trip_type: str = Query("round", pattern="^(round|one_way)$"),
    cached_only: bool = Query(True),
    refresh: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FlightsResponse:
    if not cached_only:
        enforce_rate_limit(
            request,
            FLIGHTS_BURST_SCOPE,
            max_calls=10,
            window_seconds=60,
            key=f"user:{current_user.id}",
        )
    return search_flights(
        db,
        current_user,
        trip_plan_id,
        trip_type,
        cached_only=cached_only,
        refresh=refresh,
    )


@router.post("/{trip_plan_id}/flights/{offer_id}/returns", response_model=FlightsResponse)
def get_return_flights(
    trip_plan_id: int,
    offer_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FlightsResponse:
    enforce_rate_limit(
        request,
        FLIGHTS_BURST_SCOPE,
        max_calls=10,
        window_seconds=60,
        key=f"user:{current_user.id}",
    )
    return search_returns(db, current_user, trip_plan_id, offer_id)


@router.post("/{trip_plan_id}/flights/{offer_id}/booking", response_model=BookingResponse)
def get_flight_booking(
    trip_plan_id: int,
    offer_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookingResponse:
    enforce_rate_limit(
        request,
        FLIGHTS_BURST_SCOPE,
        max_calls=10,
        window_seconds=60,
        key=f"user:{current_user.id}",
    )
    return booking_options(db, current_user, trip_plan_id, offer_id)


@router.put("/{trip_plan_id}/airports", response_model=TripPlanPublic)
def update_trip_airports(
    trip_plan_id: int,
    payload: TripAirportsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TripPlanPublic:
    trip: TripPlan = set_trip_airports(
        db,
        current_user,
        trip_plan_id,
        origin=payload.origin,
        destination=payload.destination,
    )
    return TripPlanPublic.model_validate(trip)


@router.get("/{trip_plan_id}/hotels", response_model=HotelsResponse)
def get_trip_hotels(
    trip_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> HotelsResponse:
    return search_hotels(db, current_user, trip_plan_id)


@router.post("/{trip_plan_id}/apply-edit", response_model=TripDetailResponse)
def apply_trip_edit(
    trip_plan_id: int,
    payload: ApplyEditRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TripDetailResponse:
    result = apply_itinerary_edit(db, current_user, trip_plan_id, payload.instruction)
    if payload.chat_message_id is not None:
        mark_chat_edit_applied(db, current_user, trip_plan_id, payload.chat_message_id)
    return result


@router.post("/{trip_plan_id}/destination", response_model=TripPlanPublic)
def set_trip_destination(
    trip_plan_id: int,
    payload: SelectDestinationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TripPlanPublic:
    trip = select_destination(db, current_user, trip_plan_id, payload.destination)
    return TripPlanPublic.model_validate(trip)
