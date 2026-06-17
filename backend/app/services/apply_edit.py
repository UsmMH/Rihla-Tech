import logging
import time

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.place import Place
from app.models.trip_plan import TripPlan
from app.models.user import User
from app.schemas.trip import TripDetailResponse
from app.services.destinations import _trip_context
from app.services.geocoding import (
    _coords_from_activity_payload,
    _destination_context,
    _resolve_destination_center,
    enrich_trip_places,
    resolve_place_coordinates,
)
from app.services.itinerary import get_trip_detail
from app.services.llm import get_llm_client, get_llm_model, llm_configured
from app.services.llm_json import LLM_MAX_TOKENS, is_retryable_llm_error, parse_llm_json_object

logger = logging.getLogger(__name__)


def _itinerary_with_ids(trip: TripPlan) -> str:
    if not trip.places:
        return "No places in itinerary."
    lines: list[str] = []
    for place in trip.places:
        lines.append(
            f"place_id={place.id} day={place.day_number} slot={place.time_slot} "
            f"name={place.name!r} type={place.activity_type or 'Activity'} "
            f"duration={place.duration or '1 hr'} desc={place.description or ''}"
        )
    return "\n".join(lines)


def apply_itinerary_edit(
    db: Session,
    user: User,
    trip_plan_id: int,
    instruction: str,
) -> TripDetailResponse:
    trip = (
        db.query(TripPlan)
        .options(joinedload(TripPlan.places))
        .filter(TripPlan.id == trip_plan_id, TripPlan.user_id == user.id)
        .first()
    )
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip plan not found")

    if not trip.places:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Generate an itinerary before applying edits",
        )

    if not llm_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM not configured — cannot apply itinerary edits",
        )

    client = get_llm_client()
    if client is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="LLM client unavailable")

    destination = trip.destination or "the destination"
    model = get_llm_model()
    text = instruction.strip()

    prompt = f"""Apply this itinerary change for a trip to {destination}:
"{text}"

Return JSON only:
{{
  "updates": [
    {{
      "place_id": 123,
      "name": "Official Venue Name",
      "map_search": "Official Venue Name",
      "location_hint": "neighborhood",
      "latitude": 30.0444,
      "longitude": 31.2357,
      "description": "1-2 sentences",
      "activity_type": "Culture|Food|Nature|Adventure|Relaxation|Shopping|Nightlife|Scenic",
      "duration": "e.g. 2 hrs"
    }}
  ]
}}

Rules:
- Only include places that should change. Use exact place_id values from the list below.
- name and map_search must be the real venue or landmark name (not generic labels like "Food Tour").
- Keep venues realistic and mappable in {destination}.
- If swapping an activity, update that place_id's fields including coordinates.
- No markdown outside JSON.

Trip preferences:
{_trip_context(trip)}

Current places (use place_id):
{_itinerary_with_ids(trip)}
"""

    last_error: Exception | None = None
    payload: dict | None = None
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a travel planner. Respond with valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.4,
                max_tokens=LLM_MAX_TOKENS,
            )
            content = response.choices[0].message.content or ""
            payload = parse_llm_json_object(content)
            break
        except Exception as exc:
            last_error = exc
            if is_retryable_llm_error(exc) and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            raise

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to parse edit response: {last_error}",
        )

    updates = payload.get("updates", [])
    if not isinstance(updates, list) or not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No itinerary updates returned",
        )

    places_by_id = {place.id: place for place in trip.places}
    dest_center: tuple[float, float] | None = None
    dest_context: dict = {}
    if trip.destination:
        dest_context = _destination_context(trip.destination)
        dest_center, dest_context = _resolve_destination_center(trip.destination, dest_context)

    changed = 0
    for item in updates:
        if not isinstance(item, dict):
            continue
        place_id = item.get("place_id")
        if place_id is None:
            continue
        try:
            pid = int(place_id)
        except (TypeError, ValueError):
            continue
        place = places_by_id.get(pid)
        if place is None:
            continue

        name = str(item.get("name", "")).strip()
        map_search = str(item.get("map_search", "")).strip()
        if map_search:
            name = map_search
        elif name:
            map_search = name
        if name:
            place.name = name
        if map_search:
            place.map_search = map_search
        location_hint = item.get("location_hint")
        if location_hint is not None:
            hint = str(location_hint).strip()
            place.location_hint = hint or None
        desc = item.get("description")
        if desc is not None:
            place.description = str(desc).strip() or None
        activity_type = item.get("activity_type")
        if activity_type is not None:
            place.activity_type = str(activity_type).strip() or place.activity_type
        duration = item.get("duration")
        if duration is not None:
            place.duration = str(duration).strip() or place.duration

        llm_coords = _coords_from_activity_payload(item, dest_center)
        search_name = (place.map_search or place.name).strip()
        coords: tuple[float, float] | None = None
        if dest_center is not None:
            coords = resolve_place_coordinates(
                search_name,
                location_hint=place.location_hint,
                destination=trip.destination or "",
                dest_context=dest_context,
                dest_center=dest_center,
                llm_coords=llm_coords,
            )
        if coords:
            place.latitude, place.longitude = coords
        else:
            place.latitude = None
            place.longitude = None
        changed += 1

    if changed == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not match any places to update",
        )

    db.commit()
    enrich_trip_places(db, trip, force=True)
    return get_trip_detail(db, user, trip_plan_id)
