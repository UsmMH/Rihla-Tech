from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.trip import PlaceSearchResult
from app.services.flights import duffel_configured
from app.services.geocoding import mapbox_configured, search_airports, search_places

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
