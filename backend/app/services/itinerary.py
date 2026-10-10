import logging
import re
from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import delete, or_, update
from sqlalchemy.orm import Session, joinedload

from app.models.place import Place
from app.models.trip_plan import TripPlan
from app.models.user import User
from app.schemas.trip import (
    ActivityPublic,
    DayItineraryPublic,
    GenerateTripResponse,
    MapPinPublic,
    TripDetailResponse,
    TripStatPublic,
)
from app.services.geocoding import mapbox_configured
from app.services.destinations import trip_context
from app.services.llm import ITINERARY_TIMEOUT, complete_chat, get_llm_model, get_llm_provider, llm_configured
from app.services.llm_json import (
    ITINERARY_MAX_TOKENS,
    itinerary_max_tokens,
    parse_llm_itinerary_object,
)
from app.services.theme_preferences import theme_display_label

logger = logging.getLogger(__name__)

TIME_SLOT_ORDER = ("morning", "afternoon", "evening")
TIME_SLOT_LABELS = {
    "morning": "9:00 AM",
    "afternoon": "2:00 PM",
    "evening": "7:00 PM",
}

MOCK_DAY_THEMES = ("Arrival & First Impressions", "Local Culture & Cuisine", "Highlights & Farewell")


def trip_day_count(trip: TripPlan, *, fallback: int = 3, from_places: bool = False) -> int:
    if trip.start_date and trip.end_date and trip.end_date >= trip.start_date:
        days = (trip.end_date - trip.start_date).days + 1
        return max(1, min(days, 14))
    if from_places:
        places = trip.places or []
        if places:
            return max(p.day_number for p in places)
    return fallback


def _trip_date_for_day(trip: TripPlan, day_number: int) -> date | None:
    if trip.start_date is None:
        return None
    return trip.start_date + timedelta(days=day_number - 1)


def _duration_label(num_days: int) -> str:
    return f"{num_days} Day{'s' if num_days != 1 else ''}"


def _tags_for_trip(trip: TripPlan) -> str:
    parts = []
    if trip.trip_purpose:
        parts.append(trip.trip_purpose.replace("_", " ").capitalize())
    theme_label = theme_display_label(trip.theme)
    if theme_label != "Mixed":
        parts.append(theme_label)
    if trip.budget_tier:
        parts.append(f"{trip.budget_tier.capitalize()} tier")
    return " · ".join(parts) if parts else "Personalized for you"


def _stats_for_trip(trip: TripPlan) -> list[TripStatPublic]:
    tier = (trip.budget_tier or "mid").capitalize()
    travelers = trip.num_adults + trip.num_children
    return [
        TripStatPublic(label="Budget tier", value=tier),
        TripStatPublic(label="Travelers", value=str(travelers)),
        TripStatPublic(
            label="Flights & hotels",
            value="Included" if trip.include_flights or trip.include_hotels else "Activities only",
        ),
    ]


def _normalize_activities(raw_day: dict) -> list[dict]:
    activities = raw_day.get("activities")
    if isinstance(activities, list) and activities:
        return activities

    slots: list[dict] = []
    for slot in TIME_SLOT_ORDER:
        value = raw_day.get(slot)
        if isinstance(value, dict):
            slots.append({**value, "time_slot": slot})
        elif isinstance(value, str) and value.strip():
            slots.append({"time_slot": slot, "name": value.strip(), "description": value.strip()})
    return slots


def _mock_itinerary(trip: TripPlan) -> dict:
    destination = trip.destination or "your destination"
    num_days = trip_day_count(trip)
    theme = trip.theme or "mixed"
    purpose = trip.trip_purpose or "explore"

    days = []
    for day_num in range(1, num_days + 1):
        theme_label = MOCK_DAY_THEMES[(day_num - 1) % len(MOCK_DAY_THEMES)]
        activities = [
            {
                "time_slot": "morning",
                "name": f"{destination} walking tour",
                "description": f"Start day {day_num} with a guided stroll through iconic neighborhoods.",
                "type": "Culture",
                "duration": "2 hrs",
            },
            {
                "time_slot": "afternoon",
                "name": f"Local flavors experience",
                "description": f"Sample regional dishes aligned with your {purpose} trip and {theme} theme.",
                "type": "Food",
                "duration": "1.5 hrs",
            },
            {
                "time_slot": "evening",
                "name": f"Sunset viewpoint",
                "description": "Unwind with scenic views and photo opportunities before dinner.",
                "type": "Scenic",
                "duration": "1 hr",
            },
        ]
        days.append({"day": day_num, "theme": theme_label, "activities": activities})

    return {
        "tags": _tags_for_trip(trip),
        "days": days,
    }


def _ai_itinerary(trip: TripPlan, *, on_attempt: Callable[[], None] | None = None) -> dict:
    num_days = trip_day_count(trip)
    destination = trip.destination or "the chosen destination"

    prompt = f"""Create a {num_days}-day travel itinerary for {destination}.
Return JSON only with this shape:
{{
  "tags": "short comma-separated vibe tags",
  "days": [
    {{
      "day": 1,
      "theme": "short day theme",
      "activities": [
        {{
          "time_slot": "morning",
          "name": "Perdana Botanical Garden",
          "map_search": "Perdana Botanical Garden",
          "location_hint": "neighborhood or district in {destination}",
          "description": "Stroll through the lake and tropical plant collections.",
          "type": "Culture|Food|Nature|Adventure|Relaxation|Shopping|Nightlife|Scenic",
          "duration": "e.g. 2 hrs"
        }}
      ]
    }}
  ]
}}

Rules:
- Exactly {num_days} days, numbered 1 through {num_days}.
- Each day must have exactly 3 activities: morning, afternoon, evening (use those time_slot values).
- name MUST be the real venue or landmark name (this is shown as the card title). Examples: "Perdana Botanical Garden", "Sultan Abu Bakar State Mosque" — NOT "Botanical Walk", "Cultural Immersion", or "Sunset Views".
- map_search must match name (same official venue name used for the map pin).
- description explains what the traveler does or sees at that venue (1-2 sentences).
- Do NOT use vague venue names like "Nile cruise", "walking tour", "local food market", or "sunset viewpoint".
- For boats or cruises, name must be a specific dock, pier, or operator in {destination}.
- location_hint should name the neighborhood or district within {destination}.
- Spread activities across different neighborhoods when possible.
- Match budget tier, theme, and trip purpose from preferences.
- No markdown, code fences, or text outside the JSON object.

Preferences:
{trip_context(trip)}
"""

    return complete_chat(
        [
            {"role": "system", "content": "You are a travel planner. Activity names must be real venue or landmark names, never generic labels like 'Food Tour' or 'Sunset Views'. Respond with valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.5,
        max_tokens=itinerary_max_tokens(num_days),
        timeout=ITINERARY_TIMEOUT,
        token_bump=2048,
        token_cap=ITINERARY_MAX_TOKENS,
        parse=lambda content: parse_llm_itinerary_object(content, expected_days=num_days),
        on_attempt=on_attempt,
    )


def _day_number_from_raw(raw_day: dict, fallback: int) -> int:
    raw = raw_day.get("day", fallback)
    if isinstance(raw, bool):
        return fallback
    if isinstance(raw, int):
        return raw
    match = re.search(r"\d+", str(raw))
    if not match:
        return fallback
    try:
        return int(match.group())
    except ValueError:
        return fallback


def _persist_itinerary(
    db: Session,
    trip: TripPlan,
    payload: dict,
) -> list[Place]:
    db.execute(delete(Place).where(Place.trip_plan_id == trip.id))

    places: list[Place] = []
    raw_days = payload.get("days", [])
    if not isinstance(raw_days, list):
        raw_days = []

    for index, raw_day in enumerate(raw_days, start=1):
        if not isinstance(raw_day, dict):
            continue
        day_number = _day_number_from_raw(raw_day, index)
        day_theme = raw_day.get("theme")
        trip_date = _trip_date_for_day(trip, day_number)
        activities = _normalize_activities(raw_day)

        for sort_order, activity in enumerate(activities):
            if not isinstance(activity, dict):
                continue
            time_slot = str(activity.get("time_slot", "morning")).lower()
            if time_slot not in TIME_SLOT_ORDER:
                time_slot = TIME_SLOT_ORDER[min(sort_order, len(TIME_SLOT_ORDER) - 1)]

            name = str(activity.get("name", "")).strip()
            map_search = str(activity.get("map_search", "")).strip()
            # Card title = real venue; prefer map_search when LLM splits generic title vs venue.
            if map_search:
                name = map_search
            if not name:
                continue
            if not map_search:
                map_search = name
            location_hint = str(activity.get("location_hint", "")).strip() or None

            place = Place(
                trip_plan_id=trip.id,
                day_number=day_number,
                trip_date=trip_date,
                time_slot=time_slot,
                sort_order=sort_order,
                day_theme=str(day_theme).strip() if day_theme else None,
                name=name,
                map_search=map_search,
                location_hint=location_hint,
                latitude=None,
                longitude=None,
                description=str(activity.get("description", "")).strip() or None,
                activity_type=str(activity.get("type", "Activity")).strip() or None,
                duration=str(activity.get("duration", "1 hr")).strip() or None,
            )
            db.add(place)
            places.append(place)

    return places


def build_trip_response(
    trip: TripPlan,
    places: list[Place],
    source: str,
    fallback_reason: str | None,
    tags_override: str | None = None,
) -> TripDetailResponse:
    from app.schemas.quiz import TripPlanPublic

    grouped: dict[int, list[Place]] = {}
    day_themes: dict[int, str | None] = {}
    for place in places:
        grouped.setdefault(place.day_number, []).append(place)
        if place.day_theme and place.day_number not in day_themes:
            day_themes[place.day_number] = place.day_theme

    itinerary: list[DayItineraryPublic] = []
    for day_number in sorted(grouped):
        day_places = grouped[day_number]
        activities = [
            ActivityPublic(
                place_id=p.id,
                name=p.name,
                time=TIME_SLOT_LABELS.get(p.time_slot, p.time_slot.capitalize()),
                time_slot=p.time_slot,
                type=p.activity_type or "Activity",
                desc=p.description or "",
                duration=p.duration or "1 hr",
                latitude=p.latitude,
                longitude=p.longitude,
                location_confirmed=bool(getattr(p, "location_confirmed", False)),
            )
            for p in day_places
        ]
        itinerary.append(
            DayItineraryPublic(
                day=day_number,
                theme=day_themes.get(day_number) or f"Day {day_number}",
                date=day_places[0].trip_date if day_places else None,
                activities=activities,
            )
        )

    map_pins = [
        MapPinPublic(
            place_id=p.id,
            name=p.name,
            day_number=p.day_number,
            time_slot=p.time_slot,
            activity_type=p.activity_type,
            latitude=p.latitude,
            longitude=p.longitude,
        )
        for p in places
        if p.latitude is not None and p.longitude is not None
    ]

    num_days = len(itinerary) or trip_day_count(trip)
    return TripDetailResponse(
        trip_plan=TripPlanPublic.model_validate(trip),
        destination=trip.destination or "Your trip",
        duration=_duration_label(num_days),
        tags=tags_override or _tags_for_trip(trip),
        stats=_stats_for_trip(trip),
        itinerary=itinerary,
        map_pins=map_pins,
        geocoding_configured=mapbox_configured(),
        places_geocoded=len(map_pins),
        source=source,
        fallback_reason=fallback_reason,
        is_shared=bool(getattr(trip, "is_shared", False)),
        share_caption=getattr(trip, "share_caption", None),
    )


def get_owned_trip(db: Session, user: User, trip_plan_id: int) -> TripPlan:
    trip = (
        db.query(TripPlan)
        .options(joinedload(TripPlan.places))
        .filter(TripPlan.id == trip_plan_id, TripPlan.user_id == user.id)
        .first()
    )
    if trip is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip plan not found",
        )
    return trip


def delete_trip_plan(db: Session, user: User, trip_plan_id: int) -> None:
    trip = (
        db.query(TripPlan)
        .filter(TripPlan.id == trip_plan_id, TripPlan.user_id == user.id)
        .first()
    )
    if trip is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip plan not found",
        )
    db.delete(trip)
    db.commit()


def list_user_trips(db: Session, user: User) -> list[TripPlan]:
    return (
        db.query(TripPlan)
        .options(joinedload(TripPlan.places))
        .filter(TripPlan.user_id == user.id)
        .order_by(TripPlan.updated_at.desc())
        .all()
    )


def get_trip_detail(db: Session, user: User, trip_plan_id: int) -> TripDetailResponse:
    trip = get_owned_trip(db, user, trip_plan_id)
    if not trip.places:
        if trip.status == "generating":
            return build_trip_response(trip, [], source="generating", fallback_reason=None)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Itinerary not generated yet",
        )

    places = list(trip.places)
    source = trip.itinerary_source or "generated"
    return build_trip_response(trip, places, source=source, fallback_reason=None)


# How long a trip can sit in "generating" before we assume the request that
# claimed it crashed/timed out and allow a new attempt to reclaim it.
GENERATION_LOCK_TIMEOUT = timedelta(minutes=3)


def _claim_generation_slot(db: Session, trip: TripPlan) -> None:
    """Atomically flip the trip to status="generating" so a second concurrent
    /trips/{id}/generate call (e.g. user backs out mid-generation and re-opens
    the trip from My Trips before the first request finishes) can't also run
    the LLM + persist step and create duplicate places for every day."""
    stale_cutoff = datetime.now(timezone.utc) - GENERATION_LOCK_TIMEOUT
    result = db.execute(
        update(TripPlan)
        .where(
            TripPlan.id == trip.id,
            or_(TripPlan.status != "generating", TripPlan.updated_at < stale_cutoff),
        )
        .values(status="generating", updated_at=datetime.now(timezone.utc))
    )
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This trip's itinerary is already being generated. Please wait a moment and try again.",
        )
    db.refresh(trip)


def _refresh_generation_lock(db: Session, trip_id: int) -> None:
    db.execute(
        update(TripPlan)
        .where(TripPlan.id == trip_id, TripPlan.status == "generating")
        .values(updated_at=datetime.now(timezone.utc))
    )
    db.commit()


def generate_itinerary(db: Session, user: User, trip_plan_id: int) -> GenerateTripResponse:
    trip = get_owned_trip(db, user, trip_plan_id)

    if not trip.destination:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trip destination is required before generating an itinerary",
        )

    previous_status = trip.status
    _claim_generation_slot(db, trip)

    try:
        source = "mock"
        fallback_reason: str | None = None
        tags_override: str | None = None
        payload: dict

        if llm_configured():
            try:
                payload = _ai_itinerary(
                    trip,
                    on_attempt=lambda: _refresh_generation_lock(db, trip.id),
                )
                source = get_llm_provider()
                tags_override = payload.get("tags") if isinstance(payload.get("tags"), str) else None
            except Exception as exc:
                logger.warning(
                    "LLM itinerary generation failed (provider=%s model=%s), using mock: %s",
                    get_llm_provider(),
                    get_llm_model(),
                    exc,
                )
                fallback_reason = "LLM request failed"
                payload = _mock_itinerary(trip)
                tags_override = payload.get("tags")
        else:
            fallback_reason = "No LLM API key configured for provider " + get_llm_provider()
            logger.info("LLM not configured; using mock itinerary")
            payload = _mock_itinerary(trip)
            tags_override = payload.get("tags")

        places = _persist_itinerary(db, trip, payload)
        trip.status = "itinerary_generated"
        trip.itinerary_source = source
        db.commit()
    except Exception:
        # Release the "generating" lock immediately instead of making the next
        # attempt wait out the full staleness timeout.
        db.rollback()
        db.execute(update(TripPlan).where(TripPlan.id == trip.id).values(status=previous_status))
        db.commit()
        raise

    db.refresh(trip)
    places = list(trip.places)

    return GenerateTripResponse(
        **build_trip_response(trip, places, source, fallback_reason, tags_override).model_dump()
    )
