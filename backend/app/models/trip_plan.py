from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TripPlan(Base):
    __tablename__ = "trip_plans"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    destination: Mapped[str | None] = mapped_column(String(255), nullable=True)
    destination_known: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    num_adults: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    num_children: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    origin: Mapped[str | None] = mapped_column(String(255), nullable=True)
    trip_purpose: Mapped[str | None] = mapped_column(String(50), nullable=True)
    theme: Mapped[str | None] = mapped_column(String(50), nullable=True)
    budget_tier: Mapped[str | None] = mapped_column(String(20), nullable=True)
    include_flights: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    include_hotels: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="draft", nullable=False)
    itinerary_source: Mapped[str | None] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    quiz_responses: Mapped[list["QuizResponse"]] = relationship(
        back_populates="trip_plan",
        cascade="all, delete-orphan",
    )
    places: Mapped[list["Place"]] = relationship(
        back_populates="trip_plan",
        cascade="all, delete-orphan",
        order_by="Place.day_number, Place.sort_order, Place.id",
    )
    chat_messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="trip_plan",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at, ChatMessage.id",
    )


class QuizResponse(Base):
    __tablename__ = "quiz_responses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    trip_plan_id: Mapped[int] = mapped_column(
        ForeignKey("trip_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    value: Mapped[dict | list | str | int | bool] = mapped_column(JSON, nullable=False)

    trip_plan: Mapped["TripPlan"] = relationship(back_populates="quiz_responses")
