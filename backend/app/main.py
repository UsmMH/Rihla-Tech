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
from app.routers import admin, auth, chat, community, health, places, quiz, trips


def _ensure_schema_patches() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE trip_plans "
                "ADD COLUMN IF NOT EXISTS itinerary_source VARCHAR(30)"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE places "
                "ADD COLUMN IF NOT EXISTS map_search VARCHAR(255)"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE places "
                "ADD COLUMN IF NOT EXISTS location_hint VARCHAR(255)"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE places "
                "ADD COLUMN IF NOT EXISTS mapbox_id VARCHAR(120)"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE places "
                "ADD COLUMN IF NOT EXISTS location_confirmed BOOLEAN DEFAULT FALSE"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE trip_plans "
                "ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE trip_plans "
                "ADD COLUMN IF NOT EXISTS share_caption VARCHAR(500)"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE trip_plans "
                "ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS verification_code_hash VARCHAR(64)"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS verification_attempts INTEGER NOT NULL DEFAULT 0"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS verification_last_sent_at TIMESTAMPTZ"
            )
        )
        # Legacy accounts (pre email-verification): no pending code — keep them able to log in.
        conn.execute(
            text(
                "UPDATE users SET is_verified = TRUE "
                "WHERE is_verified = FALSE "
                "AND verification_code_hash IS NULL "
                "AND verification_code_expires_at IS NULL "
                "AND verification_last_sent_at IS NULL "
                "AND verification_attempts = 0"
            )
        )


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
