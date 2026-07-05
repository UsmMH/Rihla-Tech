from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.question import Question
from app.models.trip_plan import QuizResponse, TripPlan
from app.models.user import User
from app.schemas.quiz import QuizAnswerItem, QuizSubmitResponse, TripPlanPublic
from app.services.quiz_validation import validate_quiz_submission


def get_questions_by_phase(db: Session, phase: str) -> list[Question]:
    # joinedload multiplies rows per option — .unique() is required
    return list(
        db.scalars(
            select(Question)
            .options(joinedload(Question.options))
            .where(Question.phase == phase)
            .order_by(Question.sort_order, Question.id)
        ).unique()
    )


def _get_question_map(db: Session, phase: str) -> dict[int, Question]:
    questions = get_questions_by_phase(db, phase)
    return {q.id: q for q in questions}


def _parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid date format: {value}",
        ) from exc


def _apply_answer_to_trip(trip: TripPlan, question: Question, value) -> None:
    key = question.key

    if key == "destination_known":
        trip.destination_known = value == "yes"
        if value == "not_sure":
            trip.destination = None
    elif key == "dates" and isinstance(value, dict):
        start = value.get("start")
        end = value.get("end")
        if start:
            trip.start_date = _parse_date(start) if isinstance(start, str) else start
        if end:
            trip.end_date = _parse_date(end) if isinstance(end, str) else end
    elif key == "destination" and isinstance(value, str):
        trip.destination = value.strip() or None
    elif key == "travelers" and isinstance(value, dict):
        trip.num_adults = max(1, int(value.get("adults", 1)))
        trip.num_children = max(0, int(value.get("children", 0)))
    elif key == "origin" and isinstance(value, str):
        trip.origin = value.strip() or None
    elif key == "trip_purpose" and isinstance(value, str):
        trip.trip_purpose = value
    elif key == "theme" and isinstance(value, str):
        trip.theme = value
    elif key == "budget_tier" and isinstance(value, str):
        trip.budget_tier = value
    elif key == "include_flights":
        trip.include_flights = value == "yes" or value is True
    elif key == "include_hotels":
        trip.include_hotels = value == "yes" or value is True


def _upsert_response(
    db: Session,
    user: User,
    trip: TripPlan,
    question_id: int,
    value,
) -> None:
    existing = (
        db.query(QuizResponse)
        .filter(
            QuizResponse.trip_plan_id == trip.id,
            QuizResponse.question_id == question_id,
        )
        .first()
    )
    if existing:
        existing.value = value
    else:
        db.add(
            QuizResponse(
                user_id=user.id,
                trip_plan_id=trip.id,
                question_id=question_id,
                value=value,
            )
        )


def submit_quiz_answers(
    db: Session,
    user: User,
    phase: str,
    answers: list[QuizAnswerItem],
    trip_plan_id: int | None,
) -> QuizSubmitResponse:
    question_map = _get_question_map(db, phase)
    if not question_map:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No questions found for phase '{phase}'",
        )

    for item in answers:
        if item.question_id not in question_map:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Question {item.question_id} is not valid for phase '{phase}'",
            )

    answers_by_id = {item.question_id: item.value for item in answers}
    validate_quiz_submission(phase, question_map, answers_by_id)

    if trip_plan_id is not None:
        trip = db.get(TripPlan, trip_plan_id)
        if trip is None or trip.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip plan not found",
            )
    else:
        trip = TripPlan(user_id=user.id)
        db.add(trip)
        db.flush()

    for item in answers:
        question = question_map[item.question_id]
        _apply_answer_to_trip(trip, question, item.value)
        _upsert_response(db, user, trip, item.question_id, item.value)

    if phase == "quiz":
        trip.status = "quiz_complete"
    elif phase == "preferences":
        trip.status = "preferences_complete"

    db.commit()
    db.refresh(trip)

    needs_destination_suggestion = (
        phase == "preferences"
        and not trip.destination_known
        and not trip.destination
    )

    return QuizSubmitResponse(
        trip_plan=TripPlanPublic.model_validate(trip),
        needs_destination_suggestion=needs_destination_suggestion,
    )
