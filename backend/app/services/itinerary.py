import logging
import time
from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import delete
from sqlalchemy.orm import Session, joinedload

from app.models.place import Place
from app.models.trip_plan import TripPlan
from app.models.user import User
from app.schemas.trip import (
    ActivityPublic,
    DayItineraryPublic,
    GenerateTripResponse,
    TripDetailResponse,
    TripStatPublic,
)
from app.services.destinations import _trip_context
from app.services.llm import get_llm_client, get_llm_model, get_llm_provider, llm_configured
from app.services.llm_json import LLM_MAX_TOKENS, is_retryable_llm_error, parse_llm_json_object

logger = logging.getLogger(__name__)

TIME_SLOT_ORDER = ("morning", "afternoon", "evening")
TIME_SLOT_LABELS = {
    "morning": "9:00 AM",
    "afternoon": "2:00 PM",
    "evening": "7:00 PM",
}

MOCK_DAY_THEMES = ("Arrival & First Impressions", "Local Culture & Cuisine", "Highlights & Farewell")


def _trip_day_count(trip: TripPlan) -> int:
    if trip.start_date and trip.end_date and trip.end_date >= trip.start_date:
        days = (trip.end_date - trip.start_date).days + 1
        return max(1, min(days, 14))
    return 3


def _trip_date_for_day(trip: TripPlan, day_number: int) -> date | None:
    if trip.start_date is None:
        return None
    return trip.start_date + timedelta(days=day_number - 1)


def _duration_label(num_days: int) -> str:
    return f"{num_days} Day{'s' if num_days != 1 else ''}"


def _tags_for_trip(trip: TripPlan) -> str:
    parts = []
    if trip.trip_purpose:
        parts.append(trip.trip_purpose.capitalize())
    if trip.theme:
        parts.append(trip.theme.capitalize())
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
    num_days = _trip_day_count(trip)
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


def _ai_itinerary(trip: TripPlan) -> dict:
    client = get_llm_client()
    if client is None:
        raise RuntimeError("No LLM client configured")

    num_days = _trip_day_count(trip)
    destination = trip.destination or "the chosen destination"
    model = get_llm_model()

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
          "name": "place or activity name",
          "description": "1-2 sentences",
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
- Use real places or experiences appropriate for {destination}.
- Match budget tier, theme, and trip purpose from preferences.
- No markdown, code fences, or text outside the JSON object.

Preferences:
{_trip_context(trip)}
"""

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a travel planner. Respond with valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.5,
                max_tokens=LLM_MAX_TOKENS,
            )
            content = response.choices[0].message.content or ""
            return parse_llm_json_object(content)
        except Exception as exc:
            last_error = exc
            if is_retryable_llm_error(exc) and attempt < 2:
                wait = 2 * (attempt + 1)
                logger.info("LLM itinerary attempt %s failed, retrying in %ss: %s", attempt + 1, wait, exc)
                time.sleep(wait)
                continue
            raise

    if last_error:
        raise last_error
    raise RuntimeError("LLM request failed")


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

    for raw_day in raw_days:
        if not isinstance(raw_day, dict):
            continue
        day_number = int(raw_day.get("day", len(places) + 1))
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
            if not name:
                continue

            place = Place(
                trip_plan_id=trip.id,
                day_number=day_number,
                trip_date=trip_date,
                time_slot=time_slot,
                sort_order=sort_order,
                day_theme=str(day_theme).strip() if day_theme else None,
                name=name,
                description=str(activity.get("description", "")).strip() or None,
                activity_type=str(activity.get("type", "Activity")).strip() or None,
                duration=str(activity.get("duration", "1 hr")).strip() or None,
            )
            db.add(place)
            places.append(place)

    return places


def _build_response(
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
                name=p.name,
                time=TIME_SLOT_LABELS.get(p.time_slot, p.time_slot.capitalize()),
                time_slot=p.time_slot,
                type=p.activity_type or "Activity",
                desc=p.description or "",
                duration=p.duration or "1 hr",
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

    num_days = len(itinerary) or _trip_day_count(trip)
    return TripDetailResponse(
        trip_plan=TripPlanPublic.model_validate(trip),
        destination=trip.destination or "Your trip",
        duration=_duration_label(num_days),
        tags=tags_override or _tags_for_trip(trip),
        stats=_stats_for_trip(trip),
        itinerary=itinerary,
        source=source,
        fallback_reason=fallback_reason,
    )


def _get_trip_for_user(db: Session, user: User, trip_plan_id: int) -> TripPlan:
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


def get_trip_detail(db: Session, user: User, trip_plan_id: int) -> TripDetailResponse:
    trip = _get_trip_for_user(db, user, trip_plan_id)
    if not trip.places:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Itinerary not generated yet",
        )

    source = trip.itinerary_source or "generated"
    return _build_response(trip, list(trip.places), source=source, fallback_reason=None)


def generate_itinerary(db: Session, user: User, trip_plan_id: int) -> GenerateTripResponse:
    trip = _get_trip_for_user(db, user, trip_plan_id)

    if not trip.destination:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trip destination is required before generating an itinerary",
        )

    source = "mock"
    fallback_reason: str | None = None
    tags_override: str | None = None
    payload: dict

    if llm_configured():
        try:
            payload = _ai_itinerary(trip)
            source = get_llm_provider()
            tags_override = payload.get("tags") if isinstance(payload.get("tags"), str) else None
        except Exception as exc:
            fallback_reason = f"{type(exc).__name__}: {exc}"
            logger.warning(
                "LLM itinerary generation failed (provider=%s model=%s), using mock: %s",
                get_llm_provider(),
                get_llm_model(),
                fallback_reason,
            )
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
    db.refresh(trip)

    return GenerateTripResponse(
        **_build_response(trip, places, source, fallback_reason, tags_override).model_dump()
    )
