from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.trip_plan import TripPlan
from app.models.user import User
from app.schemas.trip import TripDetailResponse
from app.services.destinations import trip_context
from app.services.itinerary import get_owned_trip, get_trip_detail
from app.services.llm import ITINERARY_TIMEOUT, LLMError, complete_chat, llm_configured
from app.services.llm_json import LLM_MAX_TOKENS, parse_llm_json_object


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
    trip = get_owned_trip(db, user, trip_plan_id)
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

    destination = trip.destination or "the destination"
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
- If swapping an activity, update that place_id's fields.
- No markdown outside JSON.

Trip preferences:
{trip_context(trip)}

Current places (use place_id):
{_itinerary_with_ids(trip)}
"""

    try:
        payload = complete_chat(
            [
                {"role": "system", "content": "You are a travel planner. Respond with valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_tokens=LLM_MAX_TOKENS,
            timeout=ITINERARY_TIMEOUT,
            parse=parse_llm_json_object,
        )
    except LLMError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to parse edit response: {exc}",
        ) from exc

    updates = payload.get("updates", [])
    if not isinstance(updates, list) or not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No itinerary updates returned",
        )

    places_by_id = {place.id: place for place in trip.places}

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
        changed += 1

    if changed == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not match any places to update",
        )

    db.commit()
    return get_trip_detail(db, user, trip_plan_id)
