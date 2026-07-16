import logging
import time

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.trip_plan import TripPlan
from app.models.user import User
from app.schemas.trip import ChatMessageResponse
from app.services.destinations import _trip_context
from app.services.edit import _itinerary_summary
from app.services.llm import get_llm_client, get_llm_model, get_llm_provider, llm_configured

logger = logging.getLogger(__name__)

MOCK_REPLY = (
    "I'd be happy to help adjust your itinerary! Try asking about specific days, "
    "activities, budget, or local tips. (AI chat requires an LLM API key in .env)"
)


def chat_with_trip(
    db: Session,
    user: User,
    trip_plan_id: int,
    message: str,
) -> ChatMessageResponse:
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
            detail="Generate an itinerary before using the chatbot",
        )

    destination = trip.destination or "your destination"
    source = "mock"
    fallback_reason: str | None = None

    if not llm_configured():
        return ChatMessageResponse(
            message=MOCK_REPLY,
            source=source,
            fallback_reason="No LLM API key configured",
        )

    client = get_llm_client()
    if client is None:
        return ChatMessageResponse(message=MOCK_REPLY, source=source, fallback_reason="LLM client unavailable")

    model = get_llm_model()
    system = f"""You are RihlaTech AI, a helpful travel assistant for a trip to {destination}.
Answer concisely (2-4 sentences unless detail is needed). Be practical and friendly.
You can suggest itinerary changes but cannot book flights or hotels.
If asked to change the plan, describe what you would change and ask for confirmation.

Trip preferences:
{_trip_context(trip)}

Current itinerary:
{_itinerary_summary(trip)}
"""

    last_error: Exception | None = None
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": message.strip()},
                ],
                temperature=0.6,
                max_tokens=1024,
            )
            content = (response.choices[0].message.content or "").strip()
            if not content:
                raise ValueError("Empty LLM response")
            return ChatMessageResponse(message=content, source=get_llm_provider(), fallback_reason=None)
        except Exception as exc:
            last_error = exc
            logger.warning("Chat attempt %s failed: %s", attempt + 1, exc)
            if attempt < 1:
                time.sleep(2)
                continue

    fallback_reason = f"{type(last_error).__name__}: {last_error}" if last_error else "Unknown error"
    return ChatMessageResponse(message=MOCK_REPLY, source="mock", fallback_reason=fallback_reason)
