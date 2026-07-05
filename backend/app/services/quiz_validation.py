"""Server-side validation for quiz and preferences submissions."""

from __future__ import annotations

import re
from datetime import date

from fastapi import HTTPException, status

from app.models.question import Question
from app.services.geocoding import mapbox_configured, search_places

MAX_TRIP_NIGHTS = 14
MAX_TRAVELERS_TOTAL = 20
MIN_CITY_LENGTH = 2
MAX_CITY_LENGTH = 120

CITY_PATTERN = re.compile(r"^[\w\s,'.\-()]+$", re.UNICODE)


def _city_label_matches(query: str, label: str) -> bool:
    q = query.strip().lower()
    lab = label.strip().lower()
    return q == lab or q in lab or lab in q


def validate_city_name(value: str, *, field: str) -> str:
    cleaned = value.strip()
    if len(cleaned) < MIN_CITY_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field} must be at least {MIN_CITY_LENGTH} characters.",
        )
    if len(cleaned) > MAX_CITY_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field} must be at most {MAX_CITY_LENGTH} characters.",
        )
    if not CITY_PATTERN.match(cleaned):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field} contains invalid characters.",
        )

    if mapbox_configured():
        results = search_places(cleaned, limit=8)
        if results and not any(_city_label_matches(cleaned, r["label"]) for r in results):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Could not verify {field.lower()}. Pick a city from search suggestions.",
            )

    return cleaned


def validate_date_range(value: dict) -> tuple[date, date]:
    start_raw = value.get("start")
    end_raw = value.get("end")
    if not start_raw or not end_raw:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Select both departure and return dates.",
        )

    try:
        start = date.fromisoformat(start_raw) if isinstance(start_raw, str) else start_raw
        end = date.fromisoformat(end_raw) if isinstance(end_raw, str) else end_raw
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid date format.",
        ) from exc

    today = date.today()
    if start < today:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Departure cannot be in the past.",
        )
    if end < start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Return date must be on or after departure.",
        )

    nights = (end - start).days
    if nights > MAX_TRIP_NIGHTS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Trips can be up to {MAX_TRIP_NIGHTS} nights.",
        )

    return start, end


def validate_travelers(value: dict) -> tuple[int, int]:
    try:
        adults = int(value.get("adults", 1))
        children = int(value.get("children", 0))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid traveler counts.",
        ) from exc

    if adults < 1:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="At least one adult is required.")
    if children < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Children count cannot be negative.")
    if adults > 20 or children > 10 or adults + children > MAX_TRAVELERS_TOTAL:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Maximum {MAX_TRAVELERS_TOTAL} travelers per trip.",
        )
    return adults, children


def validate_choice(question: Question, value) -> str | list[str]:
    allowed = {opt.option_key for opt in question.options}

    if question.multi:
        if not isinstance(value, list) or not value:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Select at least one option.")
        if any(v not in allowed for v in value):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid selection.")
        return value

    if not isinstance(value, str) or value not in allowed:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Please select a valid option.")
    return value


def validate_answer(question: Question, value) -> None:
    if question.question_type == "choice":
        validate_choice(question, value)
        return

    if question.question_type == "date_range":
        if not isinstance(value, dict):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid date range.")
        validate_date_range(value)
        return

    if question.question_type == "travelers":
        if not isinstance(value, dict):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid travelers value.")
        validate_travelers(value)
        return

    if question.question_type == "text":
        if not isinstance(value, str):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid text answer.")
        if question.key in ("origin", "destination"):
            validate_city_name(value, field="Origin" if question.key == "origin" else "Destination")
        elif not value.strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Answer cannot be empty.")


def validate_quiz_submission(
    phase: str,
    question_map: dict[int, Question],
    answers_by_id: dict[int, object],
) -> None:
    answers_by_key: dict[str, object] = {}
    for question_id, value in answers_by_id.items():
        question = question_map.get(question_id)
        if question is None:
            continue
        answers_by_key[question.key] = value
        validate_answer(question, value)

    if phase == "quiz":
        required = {"destination_known", "dates", "travelers", "origin"}
        if answers_by_key.get("destination_known") != "not_sure":
            required.add("destination")

        missing = required - set(answers_by_key.keys())
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Please complete all quiz steps before continuing.",
            )

        origin = answers_by_key.get("origin")
        destination = answers_by_key.get("destination")
        if (
            isinstance(origin, str)
            and isinstance(destination, str)
            and origin.strip().lower() == destination.strip().lower()
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Origin and destination must be different cities.",
            )

    elif phase == "preferences":
        required = {"trip_purpose", "theme", "budget_tier", "include_flights", "include_hotels"}
        missing = required - set(answers_by_key.keys())
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Please complete all preference steps.",
            )
