from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from sqlalchemy import text

from app.database import Base, engine
from app.data.quiz_seed import seed_questions
from app.database import SessionLocal
from app.routers import auth, chat, health, places, quiz, trips


def _ensure_schema_patches() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE trip_plans "
                "ADD COLUMN IF NOT EXISTS itinerary_source VARCHAR(30)"
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
