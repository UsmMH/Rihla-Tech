import logging
import time

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.trip_plan import TripPlan
from app.models.user import User
from app.schemas.trip import EditTripResponse, TripAlternativePublic
from app.services.destinations import _trip_context
from app.services.llm import get_llm_client, get_llm_model, get_llm_provider, llm_configured
from app.services.llm_json import LLM_MAX_TOKENS, is_retryable_llm_error, parse_llm_json_array

logger = logging.getLogger(__name__)

DEFAULT_EDIT_PROMPT = "Suggest 3 alternative destinations similar to this trip."

MOCK_ALTERNATIVES = [
    TripAlternativePublic(
        title="Osaka, Japan",
        tagline="Street food capital with vibrant nightlife",
        highlights=["Dotonbori", "Osaka Castle", "Kuromon Market"],
        budget_note="Similar budget",
        match_percent=94,
    ),
    TripAlternativePublic(
        title="Seoul, South Korea",
        tagline="K-culture meets ancient tradition",
        highlights=["Gyeongbokgung Palace", "Gangnam", "Myeongdong"],
        budget_note="Slightly lower cost",
        match_percent=91,
    ),
    TripAlternativePublic(
        title="Kyoto, Japan",
        tagline="Temples, gardens, and timeless culture",
        highlights=["Fushimi Inari", "Arashiyama Bamboo", "Gion District"],
        budget_note="Similar budget",
        match_percent=89,
    ),
]


def _itinerary_summary(trip: TripPlan) -> str:
    if not trip.places:
        return "No itinerary generated yet."
    lines: list[str] = []
    current_day: int | None = None
    for place in trip.places:
        if place.day_number != current_day:
            current_day = place.day_number
            theme = place.day_theme or f"Day {current_day}"
            lines.append(f"Day {current_day} ({theme}):")
        lines.append(f"  - {place.time_slot}: {place.name} ({place.activity_type or 'Activity'})")
    return "\n".join(lines)


def _mock_alternatives(trip: TripPlan, prompt: str) -> list[TripAlternativePublic]:
    destination = trip.destination or "your destination"
    return [
        TripAlternativePublic(
            title=alt.title,
            tagline=alt.tagline.replace("Japan", destination.split(",")[-1].strip() if "," in destination else destination),
            highlights=alt.highlights,
            budget_note=alt.budget_note,
            match_percent=alt.match_percent,
        )
        for alt in MOCK_ALTERNATIVES
    ]


def _ai_alternatives(trip: TripPlan, prompt: str) -> list[TripAlternativePublic]:
    client = get_llm_client()
    if client is None:
        raise RuntimeError("No LLM client configured")

    destination = trip.destination or "the chosen destination"
    model = get_llm_model()

    user_prompt = f"""The traveler has a trip to {destination} and asks: "{prompt}"

Return a JSON array of exactly 3 alternatives. Each item:
{{
  "title": "City, Country",
  "tagline": "short appealing subtitle",
  "highlights": ["place 1", "place 2", "place 3"],
  "budget_note": "e.g. Similar budget or +$200 est.",
  "match_percent": 85
}}

Rules:
- match_percent is an integer 80-98 reflecting fit with their preferences.
- highlights has 2-4 real attractions.
- Alternatives should address the user's request when possible.
- No markdown or text outside the JSON array.

Trip preferences:
{_trip_context(trip)}

Current itinerary:
{_itinerary_summary(trip)}
"""

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a travel planner. Respond with valid JSON only."},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.6,
                max_tokens=LLM_MAX_TOKENS,
            )
            content = response.choices[0].message.content or ""
            raw = parse_llm_json_array(content)
            alternatives: list[TripAlternativePublic] = []
            for item in raw[:3]:
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title", "")).strip()
                if not title:
                    continue
                highlights = item.get("highlights", [])
                if not isinstance(highlights, list):
                    highlights = []
                highlights = [str(h).strip() for h in highlights if str(h).strip()][:4]
                match = item.get("match_percent", 90)
                try:
                    match_int = max(80, min(98, int(match)))
                except (TypeError, ValueError):
                    match_int = 90
                alternatives.append(
                    TripAlternativePublic(
                        title=title,
                        tagline=str(item.get("tagline", "")).strip() or "A great alternative",
                        highlights=highlights or ["Local culture", "Great food", "Scenic views"],
                        budget_note=str(item.get("budget_note", "Similar budget")).strip(),
                        match_percent=match_int,
                    )
                )
            if alternatives:
                return alternatives
            raise ValueError("LLM returned no valid alternatives")
        except Exception as exc:
            last_error = exc
            if is_retryable_llm_error(exc) and attempt < 2:
                wait = 2 * (attempt + 1)
                logger.info("LLM edit attempt %s failed, retrying in %ss: %s", attempt + 1, wait, exc)
                time.sleep(wait)
                continue
            raise

    if last_error:
        raise last_error
    raise RuntimeError("LLM request failed")


def edit_trip_alternatives(
    db: Session,
    user: User,
    trip_plan_id: int,
    prompt: str,
) -> EditTripResponse:
    trip = (
        db.query(TripPlan)
        .options(joinedload(TripPlan.places))
        .filter(TripPlan.id == trip_plan_id, TripPlan.user_id == user.id)
        .first()
    )
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip plan not found")

    if not trip.destination:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trip destination is required",
        )

    text = (prompt or DEFAULT_EDIT_PROMPT).strip()
    source = "mock"
    fallback_reason: str | None = None
    alternatives: list[TripAlternativePublic]

    if llm_configured():
        try:
            alternatives = _ai_alternatives(trip, text)
            source = get_llm_provider()
        except Exception as exc:
            fallback_reason = f"{type(exc).__name__}: {exc}"
            logger.warning("LLM edit alternatives failed, using mock: %s", fallback_reason)
            alternatives = _mock_alternatives(trip, text)
    else:
        fallback_reason = "No LLM API key configured"
        alternatives = _mock_alternatives(trip, text)

    return EditTripResponse(
        alternatives=alternatives,
        source=source,
        fallback_reason=fallback_reason,
    )
