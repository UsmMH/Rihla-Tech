import json
import logging
import re
import time

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.chat_message import ChatMessage
from app.models.trip_plan import TripPlan
from app.models.user import User
from app.schemas.trip import ChatMessagePublic, ChatMessageResponse
from app.services.apply_edit import apply_itinerary_edit
from app.services.destinations import _trip_context
from app.services.edit import _itinerary_summary
from app.services.llm import get_llm_client, get_llm_model, get_llm_provider, llm_configured
from app.services.llm_json import parse_llm_json_object

logger = logging.getLogger(__name__)

MOCK_REPLY = (
    "I'd be happy to help adjust your itinerary! Try asking about specific days, "
    "activities, budget, or local tips. (AI chat requires an LLM API key in .env)"
)

CONFIRM_RE = re.compile(
    r"^(yes|yeah|yep|yup|sure|ok|okay|do it|go ahead|please do|apply|"
    r"update it|adjust it|sounds good|let'?s do it|that works|confirm|proceed)\b",
    re.IGNORECASE,
)


def _get_trip(db: Session, user: User, trip_plan_id: int) -> TripPlan:
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
    return trip


def list_chat_messages(db: Session, user: User, trip_plan_id: int) -> list[ChatMessagePublic]:
    _get_trip(db, user, trip_plan_id)
    rows = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.trip_plan_id == trip_plan_id,
            ChatMessage.user_id == user.id,
        )
        .order_by(ChatMessage.created_at, ChatMessage.id)
        .all()
    )
    return [ChatMessagePublic.model_validate(row) for row in rows]


def _save_message(
    db: Session,
    *,
    trip_plan_id: int,
    user_id: int,
    role: str,
    content: str,
    proposes_edit: bool = False,
    apply_instruction: str | None = None,
) -> ChatMessage:
    row = ChatMessage(
        trip_plan_id=trip_plan_id,
        user_id=user_id,
        role=role,
        content=content,
        proposes_edit=proposes_edit,
        apply_instruction=apply_instruction,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _last_pending_edit(db: Session, trip_plan_id: int, user_id: int) -> ChatMessage | None:
    return (
        db.query(ChatMessage)
        .filter(
            ChatMessage.trip_plan_id == trip_plan_id,
            ChatMessage.user_id == user_id,
            ChatMessage.role == "assistant",
            ChatMessage.proposes_edit.is_(True),
            ChatMessage.apply_instruction.isnot(None),
        )
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .first()
    )


def _supersede_pending_edits(db: Session, trip_plan_id: int, user_id: int) -> None:
    """Clear stale Apply buttons when the user continues the conversation."""
    rows = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.trip_plan_id == trip_plan_id,
            ChatMessage.user_id == user_id,
            ChatMessage.role == "assistant",
            ChatMessage.proposes_edit.is_(True),
        )
        .all()
    )
    if not rows:
        return
    for row in rows:
        row.proposes_edit = False
        row.apply_instruction = None
    db.commit()


def mark_chat_edit_applied(
    db: Session,
    user: User,
    trip_plan_id: int,
    chat_message_id: int,
) -> None:
    row = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.id == chat_message_id,
            ChatMessage.trip_plan_id == trip_plan_id,
            ChatMessage.user_id == user.id,
        )
        .first()
    )
    if row is None:
        return
    row.proposes_edit = False
    db.commit()


def _is_confirmation(message: str) -> bool:
    return bool(CONFIRM_RE.match(message.strip()))


def _history_for_llm(rows: list[ChatMessage], limit: int = 12) -> list[dict]:
    recent = rows[-limit:] if len(rows) > limit else rows
    return [{"role": row.role, "content": row.content} for row in recent]


def chat_with_trip(
    db: Session,
    user: User,
    trip_plan_id: int,
    message: str,
) -> ChatMessageResponse:
    trip = _get_trip(db, user, trip_plan_id)
    text = message.strip()
    destination = trip.destination or "your destination"

    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.trip_plan_id == trip_plan_id, ChatMessage.user_id == user.id)
        .order_by(ChatMessage.created_at, ChatMessage.id)
        .all()
    )

    _save_message(db, trip_plan_id=trip_plan_id, user_id=user.id, role="user", content=text)

    if _is_confirmation(text):
        pending = _last_pending_edit(db, trip_plan_id, user.id)
        if pending and pending.apply_instruction:
            try:
                trip_detail = apply_itinerary_edit(db, user, trip_plan_id, pending.apply_instruction)
                pending.proposes_edit = False
                db.commit()
                reply = "Done! I've updated your itinerary with those changes."
                assistant_row = _save_message(
                    db,
                    trip_plan_id=trip_plan_id,
                    user_id=user.id,
                    role="assistant",
                    content=reply,
                )
                return ChatMessageResponse(
                    message=reply,
                    source=get_llm_provider(),
                    fallback_reason=None,
                    proposes_edit=False,
                    apply_instruction=None,
                    assistant_message_id=assistant_row.id,
                    itinerary_updated=True,
                    trip=trip_detail,
                )
            except HTTPException as exc:
                reply = f"I couldn't apply those changes: {exc.detail}"
                _save_message(db, trip_plan_id=trip_plan_id, user_id=user.id, role="assistant", content=reply)
                return ChatMessageResponse(
                    message=reply,
                    source="mock",
                    fallback_reason=str(exc.detail),
                    proposes_edit=False,
                    apply_instruction=None,
                    itinerary_updated=False,
                    trip=None,
                )

    if not llm_configured():
        reply = MOCK_REPLY
        _save_message(db, trip_plan_id=trip_plan_id, user_id=user.id, role="assistant", content=reply)
        return ChatMessageResponse(
            message=reply,
            source="mock",
            fallback_reason="No LLM API key configured",
            proposes_edit=False,
            apply_instruction=None,
            itinerary_updated=False,
            trip=None,
        )

    pending = _last_pending_edit(db, trip_plan_id, user.id)
    pending_context = ""
    if pending and pending.apply_instruction:
        pending_context = (
            f"\nPending itinerary change awaiting user confirmation:\n{pending.apply_instruction}\n"
            "If the user refines this request (e.g. a different location or venue), update the SAME "
            "target activity from that proposal — do not pick a different activity unless they clearly "
            "change the subject.\n"
        )

    _supersede_pending_edits(db, trip_plan_id, user.id)

    client = get_llm_client()
    if client is None:
        _save_message(db, trip_plan_id=trip_plan_id, user_id=user.id, role="assistant", content=MOCK_REPLY)
        return ChatMessageResponse(
            message=MOCK_REPLY,
            source="mock",
            fallback_reason="LLM client unavailable",
            proposes_edit=False,
            apply_instruction=None,
            itinerary_updated=False,
            trip=None,
        )

    model = get_llm_model()
    system = f"""You are RihlaTech AI, a helpful travel assistant for a trip to {destination}.
Answer concisely (2-4 sentences unless detail is needed). Be practical and friendly.
You cannot book flights or hotels.

When the user asks to change the itinerary, describe the specific changes you recommend.
Do NOT say you have already updated the plan — changes are only applied after the user confirms.
Use the conversation history: resolve "it", "that", "instead", and follow-up refinements to the
same activity or topic the user was discussing.

When the user refines a proposed change, keep the same place/activity being replaced unless they
explicitly switch to something else. Name the exact itinerary activity you are changing (day + name).

Respond with JSON only:
{{
  "reply": "your message to the user",
  "proposes_edit": false,
  "apply_instruction": null
}}

Set proposes_edit to true and apply_instruction to a clear, self-contained edit request when you are proposing itinerary changes the user could confirm (e.g. swap an activity, move a museum, add a stroll).
apply_instruction must be detailed enough to execute without prior chat context — include day number, current activity name, and the replacement.
{pending_context}
Trip preferences:
{_trip_context(trip)}

Current itinerary:
{_itinerary_summary(trip)}
"""

    messages = [{"role": "system", "content": system}, *_history_for_llm(history), {"role": "user", "content": text}]

    last_error: Exception | None = None
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.5,
                max_tokens=1024,
            )
            raw = (response.choices[0].message.content or "").strip()
            if not raw:
                raise ValueError("Empty LLM response")

            try:
                parsed = parse_llm_json_object(raw)
                reply = str(parsed.get("reply", "")).strip() or raw
                proposes_edit = bool(parsed.get("proposes_edit", False))
                apply_instruction = parsed.get("apply_instruction")
                if apply_instruction is not None:
                    apply_instruction = str(apply_instruction).strip() or None
                if proposes_edit and not apply_instruction:
                    proposes_edit = False
            except (json.JSONDecodeError, ValueError, TypeError):
                reply = raw
                proposes_edit = False
                apply_instruction = None

            assistant_row = _save_message(
                db,
                trip_plan_id=trip_plan_id,
                user_id=user.id,
                role="assistant",
                content=reply,
                proposes_edit=proposes_edit,
                apply_instruction=apply_instruction,
            )
            return ChatMessageResponse(
                message=reply,
                source=get_llm_provider(),
                fallback_reason=None,
                proposes_edit=proposes_edit,
                apply_instruction=apply_instruction,
                assistant_message_id=assistant_row.id,
                itinerary_updated=False,
                trip=None,
            )
        except Exception as exc:
            last_error = exc
            logger.warning("Chat attempt %s failed: %s", attempt + 1, exc)
            if attempt < 1:
                time.sleep(2)

    fallback_reason = f"{type(last_error).__name__}: {last_error}" if last_error else "Unknown error"
    _save_message(db, trip_plan_id=trip_plan_id, user_id=user.id, role="assistant", content=MOCK_REPLY)
    return ChatMessageResponse(
        message=MOCK_REPLY,
        source="mock",
        fallback_reason=fallback_reason,
        proposes_edit=False,
        apply_instruction=None,
        itinerary_updated=False,
        trip=None,
    )
