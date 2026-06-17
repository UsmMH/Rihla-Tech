from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.trip import ChatHistoryResponse, ChatMessageRequest, ChatMessageResponse
from app.services.chat import chat_with_trip, list_chat_messages

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/{trip_plan_id}/messages", response_model=ChatHistoryResponse)
def get_chat_messages(
    trip_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatHistoryResponse:
    messages = list_chat_messages(db, current_user, trip_plan_id)
    return ChatHistoryResponse(messages=messages)


@router.post("/message", response_model=ChatMessageResponse)
def send_chat_message(
    payload: ChatMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessageResponse:
    return chat_with_trip(db, current_user, payload.trip_plan_id, payload.message)
