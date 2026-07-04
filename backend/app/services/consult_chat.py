import logging
import time

from app.models.user import User
from app.schemas.trip import ConsultChatRequest, ConsultChatResponse
from app.services.llm import get_llm_client, get_llm_model, get_llm_provider, llm_configured

logger = logging.getLogger(__name__)

MOCK_REPLY = (
    "I'd love to help you plan your next trip! Ask about destinations, budgets, "
    "packing tips, or when to visit — or tap Plan a new trip to build a full itinerary. "
    "(AI chat requires an LLM API key in .env)"
)


def consult_chat(user: User, payload: ConsultChatRequest) -> ConsultChatResponse:
    text = payload.message.strip()

    if not llm_configured():
        return ConsultChatResponse(
            message=MOCK_REPLY,
            source="mock",
            fallback_reason="No LLM API key configured",
        )

    client = get_llm_client()
    if client is None:
        return ConsultChatResponse(
            message=MOCK_REPLY,
            source="mock",
            fallback_reason="LLM client unavailable",
        )

    model = get_llm_model()
    name = user.first_name or "there"
    system = f"""You are RihlaTech AI, a friendly travel planning assistant.
The user ({name}) is browsing the app and may not have a trip itinerary yet.
Answer travel questions concisely (2-4 sentences unless detail is needed). Be practical and warm.
You cannot book flights or hotels directly.
When they seem ready to plan a specific trip, encourage them to use "Plan a new trip" in the app for a personalized day-by-day itinerary.
Do not invent specific itinerary details for their trip — offer general advice and destination ideas instead."""

    history = [
        {"role": row.role, "content": row.content}
        for row in payload.history[-10:]
        if row.role in ("user", "assistant") and row.content.strip()
    ]
    messages = [{"role": "system", "content": system}, *history, {"role": "user", "content": text}]

    last_error: Exception | None = None
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.6,
                max_tokens=768,
            )
            reply = (response.choices[0].message.content or "").strip()
            if not reply:
                raise ValueError("Empty LLM response")
            return ConsultChatResponse(
                message=reply,
                source=get_llm_provider(),
                fallback_reason=None,
            )
        except Exception as exc:
            last_error = exc
            logger.warning("Consult chat attempt %s failed: %s", attempt + 1, exc)
            if attempt < 1:
                time.sleep(2)

    fallback_reason = f"{type(last_error).__name__}: {last_error}" if last_error else "Unknown error"
    return ConsultChatResponse(
        message=MOCK_REPLY,
        source="mock",
        fallback_reason=fallback_reason,
    )
