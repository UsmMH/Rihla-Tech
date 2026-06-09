"""LLM client — OpenRouter, Gemini, or direct OpenAI (pick via LLM_PROVIDER)."""

from openai import OpenAI

from app.config import settings

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"


def _active_provider() -> str:
    explicit = settings.llm_provider.strip().lower()
    if explicit in {"openrouter", "gemini", "openai"}:
        return explicit

    if settings.gemini_api_key:
        return "gemini"
    if settings.openrouter_api_key:
        return "openrouter"
    if settings.openai_api_key:
        return "openai"
    return "none"


def llm_configured() -> bool:
    provider = _active_provider()
    if provider == "gemini":
        return bool(settings.gemini_api_key)
    if provider == "openrouter":
        return bool(settings.openrouter_api_key)
    if provider == "openai":
        return bool(settings.openai_api_key)
    return False


def get_llm_provider() -> str:
    return _active_provider()


def get_llm_model() -> str:
    provider = _active_provider()
    if provider == "gemini":
        return settings.gemini_model
    if provider == "openrouter":
        return settings.openrouter_model
    return "gpt-4o-mini"


def get_llm_client() -> OpenAI | None:
    provider = _active_provider()

    if provider == "gemini" and settings.gemini_api_key:
        return OpenAI(
            api_key=settings.gemini_api_key,
            base_url=GEMINI_BASE_URL,
        )

    if provider == "openrouter" and settings.openrouter_api_key:
        return OpenAI(
            api_key=settings.openrouter_api_key,
            base_url=OPENROUTER_BASE_URL,
            default_headers={
                "HTTP-Referer": settings.openrouter_site_url,
                "X-Title": settings.openrouter_app_name,
            },
        )

    if provider == "openai" and settings.openai_api_key:
        return OpenAI(api_key=settings.openai_api_key)

    return None
