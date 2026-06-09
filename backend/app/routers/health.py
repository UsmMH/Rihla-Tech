from fastapi import APIRouter

from app.database import check_database_connection
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    db_ok = check_database_connection()
    return HealthResponse(
        status="ok",
        database="connected" if db_ok else "disconnected",
    )
