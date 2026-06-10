from fastapi import APIRouter

from app.database import check_database_connection
from app.schemas.health import HealthResponse, LlmStatusResponse, MapboxStatusResponse
from app.services.geocoding import mapbox_configured
from app.services.llm import get_llm_model, get_llm_provider, llm_configured

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    db_ok = check_database_connection()
    return HealthResponse(
        status="ok",
        database="connected" if db_ok else "disconnected",
    )


@router.get("/health/llm", response_model=LlmStatusResponse)
def llm_status() -> LlmStatusResponse:
    return LlmStatusResponse(
        configured=llm_configured(),
        provider=get_llm_provider(),
        model=get_llm_model(),
    )


@router.get("/health/mapbox", response_model=MapboxStatusResponse)
def mapbox_status() -> MapboxStatusResponse:
    return MapboxStatusResponse(configured=mapbox_configured())
