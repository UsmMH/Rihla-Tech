"""SerpApi quota log and per-trip search cache (normalized payloads only)."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Cache kinds persisted in serpapi_cache.kind (no booking — booking responses are never stored).
SERPAPI_CACHE_KINDS = frozenset(
    {"flights_round", "flights_one_way", "flights_return", "hotels"}
)


class SerpApiCache(Base):
    """Normalized flight/hotel offers and server-side tokens — not raw SerpApi JSON."""

    __tablename__ = "serpapi_cache"
    __table_args__ = (
        UniqueConstraint("trip_plan_id", "kind", "cache_key", name="uq_serpapi_cache_trip_kind_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trip_plan_id: Mapped[int] = mapped_column(
        ForeignKey("trip_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    cache_key: Mapped[str] = mapped_column(String(64), nullable=False)
    # ponytail: enforcement at write time in services/serpapi.put_cached (step 4+); never post_data or api_key.
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SerpApiUsage(Base):
    """One row per charged SerpApi search (engine name only; no URLs, keys, or response bodies)."""

    __tablename__ = "serpapi_usage"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    engine: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
