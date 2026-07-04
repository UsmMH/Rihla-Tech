from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.quiz import TripPlanPublic
from app.schemas.trip import (
    ApplyEditRequest,
    EditTripRequest,
    EditTripResponse,
    FlightsResponse,
    GenerateTripRequest,
    GenerateTripResponse,
    HotelsResponse,
    SelectDestinationRequest,
    SuggestDestinationsRequest,
    SuggestDestinationsResponse,
    TripDetailResponse,
    TripListItem,
    TripListResponse,
    UpdatePlaceLocationRequest,
)
from app.services.destinations import select_destination, suggest_destinations
from app.models.trip_plan import TripPlan
from app.services.flights import search_flights
from app.services.geocoding import enrich_trip_places, mapbox_configured
from app.services.hotels import search_hotels
from app.services.apply_edit import apply_itinerary_edit
from app.services.chat import mark_chat_edit_applied
from app.services.edit import edit_trip_alternatives
from app.services.itinerary import (
    delete_trip_plan,
    generate_itinerary,
    get_trip_detail,
    list_user_trips,
    update_place_location,
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


@router.get("/{trip_plan_id}/flights", response_model=FlightsResponse)
def get_trip_flights(
    trip_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FlightsResponse:
    return search_flights(db, current_user, trip_plan_id)


@router.get("/{trip_plan_id}/hotels", response_model=HotelsResponse)
def get_trip_hotels(
    trip_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> HotelsResponse:
    return search_hotels(db, current_user, trip_plan_id)


@router.post("/{trip_plan_id}/enrich-places", response_model=TripDetailResponse)
def enrich_trip_places_endpoint(
    trip_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TripDetailResponse:
    trip = (
        db.query(TripPlan)
        .options(joinedload(TripPlan.places))
        .filter(TripPlan.id == trip_plan_id, TripPlan.user_id == current_user.id)
        .first()
    )
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip plan not found")

    if mapbox_configured():
        for place in trip.places:
            if place.location_confirmed:
                continue
            place.latitude = None
            place.longitude = None
            place.mapbox_id = None
        db.commit()
        enrich_trip_places(db, trip, force=True)

    return get_trip_detail(db, current_user, trip_plan_id)


@router.patch("/{trip_plan_id}/places/{place_id}", response_model=TripDetailResponse)
def confirm_place_location(
    trip_plan_id: int,
    place_id: int,
    payload: UpdatePlaceLocationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TripDetailResponse:
    return update_place_location(
        db,
        current_user,
        trip_plan_id,
        place_id,
        label=payload.label,
        latitude=payload.latitude,
        longitude=payload.longitude,
        mapbox_id=payload.mapbox_id,
    )


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


@router.post("/{trip_plan_id}/edit", response_model=EditTripResponse)
def edit_trip(
    trip_plan_id: int,
    payload: EditTripRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EditTripResponse:
    return edit_trip_alternatives(db, current_user, trip_plan_id, payload.prompt)


@router.post("/{trip_plan_id}/destination", response_model=TripPlanPublic)
def set_trip_destination(
    trip_plan_id: int,
    payload: SelectDestinationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TripPlanPublic:
    trip = select_destination(db, current_user, trip_plan_id, payload.destination)
    return TripPlanPublic.model_validate(trip)
