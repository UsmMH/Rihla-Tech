from fastapi import APIRouter

from app.database import check_database_connection
from app.schemas.health import (
    DuffelStatusResponse,
    HealthResponse,
    LlmStatusResponse,
    MapboxStatusResponse,
    SerpApiStatusResponse,
)
from app.services.flights import duffel_configured
from app.services.geocoding import mapbox_configured
from app.services.llm import get_llm_model, get_llm_provider, llm_configured
from app.services.serpapi import serpapi_configured, serpapi_mock_enabled

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


@router.get("/health/duffel", response_model=DuffelStatusResponse)
def duffel_status() -> DuffelStatusResponse:
    return DuffelStatusResponse(configured=duffel_configured())


@router.get("/health/serpapi", response_model=SerpApiStatusResponse)
def serpapi_status() -> SerpApiStatusResponse:
    return SerpApiStatusResponse(configured=serpapi_configured(), mock=serpapi_mock_enabled())
