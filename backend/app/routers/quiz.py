from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.quiz import QuestionPublic, QuizSubmitRequest, QuizSubmitResponse
from app.services.quiz import get_questions_by_phase, submit_quiz_answers

router = APIRouter(prefix="/quiz", tags=["quiz"])


@router.get("/questions", response_model=list[QuestionPublic])
def list_questions(
    phase: str = Query(..., pattern="^(quiz|preferences)$"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[QuestionPublic]:
    questions = get_questions_by_phase(db, phase)
    return [QuestionPublic.model_validate(q) for q in questions]


@router.post("/submit", response_model=QuizSubmitResponse)
def submit_quiz(
    payload: QuizSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizSubmitResponse:
    return submit_quiz_answers(
        db,
        current_user,
        payload.phase,
        payload.answers,
        payload.trip_plan_id,
    )
