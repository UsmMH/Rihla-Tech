from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.quiz import TripPlanPublic
from app.schemas.trip import (
    GenerateTripRequest,
    GenerateTripResponse,
    SelectDestinationRequest,
    SuggestDestinationsRequest,
    SuggestDestinationsResponse,
    TripDetailResponse,
)
from app.services.destinations import select_destination, suggest_destinations
from app.services.itinerary import generate_itinerary, get_trip_detail

router = APIRouter(prefix="/trips", tags=["trips"])


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


@router.post("/{trip_plan_id}/destination", response_model=TripPlanPublic)
def set_trip_destination(
    trip_plan_id: int,
    payload: SelectDestinationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TripPlanPublic:
    trip = select_destination(db, current_user, trip_plan_id, payload.destination)
    return TripPlanPublic.model_validate(trip)
