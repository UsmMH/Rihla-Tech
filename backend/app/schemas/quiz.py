from datetime import date
from typing import Any

from pydantic import BaseModel, Field


class AnswerOptionPublic(BaseModel):
    id: int
    option_key: str
    label: str
    icon: str | None
    description: str | None

    model_config = {"from_attributes": True}


class QuestionPublic(BaseModel):
    id: int
    phase: str
    key: str
    title: str
    subtitle: str
    question_type: str
    multi: bool
    sort_order: int
    options: list[AnswerOptionPublic]

    model_config = {"from_attributes": True}


class QuizAnswerItem(BaseModel):
    question_id: int
    value: Any


class QuizSubmitRequest(BaseModel):
    phase: str = Field(pattern="^(quiz|preferences)$")
    answers: list[QuizAnswerItem]
    trip_plan_id: int | None = None


class TripPlanPublic(BaseModel):
    id: int
    destination: str | None
    destination_known: bool
    start_date: date | None
    end_date: date | None
    num_adults: int
    num_children: int
    origin: str | None
    trip_purpose: str | None
    theme: str | None
    budget_tier: str | None
    include_flights: bool
    include_hotels: bool
    status: str

    model_config = {"from_attributes": True}


class QuizSubmitResponse(BaseModel):
    trip_plan: TripPlanPublic
    needs_destination_suggestion: bool
