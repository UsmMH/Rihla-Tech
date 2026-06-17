from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Place(Base):
    __tablename__ = "places"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trip_plan_id: Mapped[int] = mapped_column(
        ForeignKey("trip_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    trip_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    time_slot: Mapped[str] = mapped_column(String(20), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    day_theme: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    map_search: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location_hint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    activity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    duration: Mapped[str | None] = mapped_column(String(50), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    mapbox_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    location_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    trip_plan: Mapped["TripPlan"] = relationship(back_populates="places")
