from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from sqlalchemy import text

from app.database import Base, engine
from app.data.quiz_seed import seed_questions
from app.database import SessionLocal
from app.models.chat_message import ChatMessage  # noqa: F401 — register table
from app.models.community import TripComment, TripSave, TripVote  # noqa: F401
from app.models.serpapi import SerpApiCache, SerpApiUsage  # noqa: F401 — register tables
from app.routers import admin, auth, chat, community, health, places, quiz, trips


_SCHEMA_COLUMNS = (
    ("trip_plans", "itinerary_source", "VARCHAR(30)"),
    ("places", "map_search", "VARCHAR(255)"),
    ("places", "location_hint", "VARCHAR(255)"),
    ("places", "mapbox_id", "VARCHAR(120)"),
    ("places", "location_confirmed", "BOOLEAN DEFAULT FALSE"),
    ("trip_plans", "is_shared", "BOOLEAN DEFAULT FALSE"),
    ("trip_plans", "share_caption", "VARCHAR(500)"),
    ("trip_plans", "shared_at", "TIMESTAMPTZ"),
    ("users", "is_verified", "BOOLEAN NOT NULL DEFAULT TRUE"),
    ("users", "verification_code_hash", "VARCHAR(64)"),
    ("users", "verification_code_expires_at", "TIMESTAMPTZ"),
    ("users", "verification_attempts", "INTEGER NOT NULL DEFAULT 0"),
    ("users", "verification_last_sent_at", "TIMESTAMPTZ"),
    ("trip_plans", "selected_hotel", "VARCHAR(255)"),
    ("trip_plans", "origin_airport", "VARCHAR(3)"),
    ("trip_plans", "destination_airport", "VARCHAR(3)"),
    ("trip_plans", "flight_trip_type", "VARCHAR(10)"),
)


def _ensure_schema_patches() -> None:
    with engine.begin() as conn:
        for table, column, spec in _SCHEMA_COLUMNS:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {spec}"))
        # One-shot legacy backfill: column is added with DEFAULT TRUE; new signups use DEFAULT FALSE.
        conn.execute(text("ALTER TABLE users ALTER COLUMN is_verified SET DEFAULT FALSE"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_schema_patches()
    db = SessionLocal()
    try:
        seed_questions(db)
    finally:
        db.close()
    yield


app = FastAPI(title="RihlaTech API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(quiz.router, prefix=settings.api_prefix)
app.include_router(trips.router, prefix=settings.api_prefix)
app.include_router(chat.router, prefix=settings.api_prefix)
app.include_router(places.router, prefix=settings.api_prefix)
app.include_router(community.router, prefix=settings.api_prefix)
app.include_router(admin.router, prefix=settings.api_prefix)
