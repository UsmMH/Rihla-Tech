from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.trip_plan import TripPlan
from app.models.user import User
from app.schemas.trip import ActivityPlaceSearchResult, PlaceSearchResult
from app.services.flights import duffel_configured
from app.services.geocoding import (
    _destination_context,
    _resolve_destination_center,
    mapbox_configured,
    search_activity_places,
    search_airports,
    search_places,
)

router = APIRouter(prefix="/places", tags=["places"])


@router.get("/search", response_model=list[PlaceSearchResult])
def search_origin_places(
    q: str = Query(min_length=2, max_length=120),
    kind: str = Query("city", pattern="^(city|airport)$"),
    _current_user: User = Depends(get_current_user),
) -> list[PlaceSearchResult]:
    if kind == "airport":
        if not duffel_configured() and not mapbox_configured():
            return []
        raw = search_airports(q)
    else:
        if not mapbox_configured():
            return []
        raw = search_places(q)
    return [PlaceSearchResult.model_validate(item) for item in raw]


@router.get("/search-poi", response_model=list[ActivityPlaceSearchResult])
def search_activity_poi(
    q: str = Query(min_length=2, max_length=120),
    trip_plan_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ActivityPlaceSearchResult]:
    if not mapbox_configured():
        return []

    trip = (
        db.query(TripPlan)
        .filter(TripPlan.id == trip_plan_id, TripPlan.user_id == current_user.id)
        .first()
    )
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip plan not found")

    destination = trip.destination or ""
    if not destination:
        return []

    dest_context = _destination_context(destination)
    dest_center, dest_context = _resolve_destination_center(destination, dest_context)
    if dest_center is None:
        return []

    results = search_activity_places(
        q,
        proximity=dest_center,
        country_code=dest_context.get("country_code"),
    )
    return [ActivityPlaceSearchResult.model_validate(item) for item in results]
