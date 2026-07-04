from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TripVote(Base):
    __tablename__ = "trip_votes"
    __table_args__ = (UniqueConstraint("trip_plan_id", "user_id", name="uq_trip_vote_user"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trip_plan_id: Mapped[int] = mapped_column(
        ForeignKey("trip_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class TripSave(Base):
    __tablename__ = "trip_saves"
    __table_args__ = (UniqueConstraint("trip_plan_id", "user_id", name="uq_trip_save_user"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trip_plan_id: Mapped[int] = mapped_column(
        ForeignKey("trip_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class TripComment(Base):
    __tablename__ = "trip_comments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trip_plan_id: Mapped[int] = mapped_column(
        ForeignKey("trip_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    author: Mapped["User"] = relationship("User", lazy="joined")

from app.models.user import User  # noqa: E402
