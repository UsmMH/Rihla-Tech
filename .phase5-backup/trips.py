from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.quiz import TripPlanPublic
from app.schemas.trip import (
    EditTripRequest,
    EditTripResponse,
    GenerateTripRequest,
    GenerateTripResponse,
    SelectDestinationRequest,
    SuggestDestinationsRequest,
    SuggestDestinationsResponse,
    TripDetailResponse,
    TripListItem,
    TripListResponse,
)
from app.services.destinations import select_destination, suggest_destinations
from app.models.trip_plan import TripPlan
from app.services.geocoding import enrich_trip_places, mapbox_configured
from app.services.edit import edit_trip_alternatives
from app.services.itinerary import generate_itinerary, get_trip_detail, list_user_trips

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


@router.get("/{trip_plan_id}", response_model=TripDetailResponse)
def get_trip(
    trip_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TripDetailResponse:
    return get_trip_detail(db, current_user, trip_plan_id)


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
            place.latitude = None
            place.longitude = None
        db.commit()
        enrich_trip_places(db, trip)

    return get_trip_detail(db, current_user, trip_plan_id)


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
