import json
import logging
import time

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.trip_plan import TripPlan
from app.models.user import User
from app.schemas.trip import DestinationSuggestion, SuggestDestinationsResponse
from app.services.llm import get_llm_client, get_llm_model, get_llm_provider, llm_configured

logger = logging.getLogger(__name__)

MOCK_SUGGESTIONS = [
    DestinationSuggestion(
        city="Kyoto",
        country="Japan",
        blurb="Temples, zen gardens, and traditional culture — perfect for a mindful historical escape.",
    ),
    DestinationSuggestion(
        city="Barcelona",
        country="Spain",
        blurb="Gaudí architecture, Mediterranean beaches, and vibrant street life for modern explorers.",
    ),
    DestinationSuggestion(
        city="Queenstown",
        country="New Zealand",
        blurb="Stunning alpine lakes and adventure activities surrounded by breathtaking natural scenery.",
    ),
]


def _trip_context(trip: TripPlan) -> str:
    parts = [
        f"Trip purpose: {trip.trip_purpose or 'explore'}",
        f"Theme: {trip.theme or 'mixed'}",
        f"Budget tier: {trip.budget_tier or 'mid'}",
        f"Travelers: {trip.num_adults} adults, {trip.num_children} children",
        f"Dates: {trip.start_date} to {trip.end_date}",
        f"Origin: {trip.origin or 'unknown'}",
        f"Include flights: {trip.include_flights}",
        f"Include hotels: {trip.include_hotels}",
    ]
    return "\n".join(parts)


def _mock_suggestions(trip: TripPlan) -> list[DestinationSuggestion]:
    theme = trip.theme or "natural"
    purpose = trip.trip_purpose or "explore"
    tier = trip.budget_tier or "mid"

    themed = {
        "historical": 0,
        "modern": 1,
        "natural": 2,
    }
    primary_idx = themed.get(theme, 1)
    order = [primary_idx] + [i for i in range(len(MOCK_SUGGESTIONS)) if i != primary_idx]

    return [
        DestinationSuggestion(
            city=MOCK_SUGGESTIONS[i].city,
            country=MOCK_SUGGESTIONS[i].country,
            blurb=f"{MOCK_SUGGESTIONS[i].blurb} Tailored for {purpose} travel at {tier} tier.",
        )
        for i in order[:3]
    ]


def _parse_llm_destinations(content: str) -> list[dict]:
    text = content.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            for key in ("suggestions", "cities", "destinations"):
                value = parsed.get(key)
                if isinstance(value, list):
                    return value
            return [parsed]
    except json.JSONDecodeError:
        pass

    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end > start:
        return json.loads(text[start : end + 1])

    raise ValueError(f"No JSON array in LLM response: {content[:300]!r}")


def _is_retryable_llm_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(token in message for token in ("429", "503", "rate", "quota", "high demand", "unavailable"))


def _ai_suggestions(trip: TripPlan) -> list[DestinationSuggestion]:
    client = get_llm_client()
    if client is None:
        raise RuntimeError("No LLM client configured")

    model = get_llm_model()
    prompt = f"""Based on these travel preferences, suggest exactly 3 destination cities.
Return JSON only: an array of objects with keys "city", "country", "blurb".
Each blurb should be 1-2 sentences explaining why the city fits.
Do not include markdown, code fences, or any text outside the JSON array.

Preferences:
{_trip_context(trip)}
"""

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a travel advisor. Respond with valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
            )
            content = response.choices[0].message.content or ""
            raw = _parse_llm_destinations(content)
            return [DestinationSuggestion.model_validate(item) for item in raw[:3]]
        except Exception as exc:
            last_error = exc
            if _is_retryable_llm_error(exc) and attempt < 2:
                wait = 2 * (attempt + 1)
                logger.info("LLM attempt %s failed, retrying in %ss: %s", attempt + 1, wait, exc)
                time.sleep(wait)
                continue
            raise

    if last_error:
        raise last_error
    raise RuntimeError("LLM request failed")


def suggest_destinations(
    db: Session,
    user: User,
    trip_plan_id: int,
) -> SuggestDestinationsResponse:
    trip = db.get(TripPlan, trip_plan_id)
    if trip is None or trip.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip plan not found",
        )

    if trip.destination_known:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Destination is already known for this trip",
        )

    source = "mock"
    fallback_reason: str | None = None

    if llm_configured():
        try:
            suggestions = _ai_suggestions(trip)
            source = get_llm_provider()
        except Exception as exc:
            fallback_reason = f"{type(exc).__name__}: {exc}"
            logger.warning(
                "LLM destination suggestions failed (provider=%s model=%s), using mock: %s",
                get_llm_provider(),
                get_llm_model(),
                fallback_reason,
            )
            suggestions = _mock_suggestions(trip)
    else:
        fallback_reason = "No LLM API key configured for provider " + get_llm_provider()
        logger.info("LLM not configured; using mock destination suggestions")
        suggestions = _mock_suggestions(trip)

    trip.status = "destinations_suggested"
    db.commit()

    return SuggestDestinationsResponse(
        suggestions=suggestions,
        source=source,
        fallback_reason=fallback_reason,
    )


def select_destination(
    db: Session,
    user: User,
    trip_plan_id: int,
    destination: str,
) -> TripPlan:
    trip = db.get(TripPlan, trip_plan_id)
    if trip is None or trip.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip plan not found",
        )

    trip.destination = destination.strip()
    trip.destination_known = True
    trip.status = "destination_selected"
    db.commit()
    db.refresh(trip)
    return trip
