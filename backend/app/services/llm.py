"""LLM client — OpenRouter, Gemini, or direct OpenAI (pick via LLM_PROVIDER)."""

import logging
import time
from collections.abc import Callable
from typing import TypeVar

from openai import OpenAI

from app.config import settings
from app.services.llm_json import is_retryable_llm_error

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

LLM_ATTEMPTS = 3
ITINERARY_TIMEOUT = 90.0
CHAT_TIMEOUT = 35.0

T = TypeVar("T")


class LLMError(Exception):
    """Raised when an LLM request fails after retries."""


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


def get_llm_client(*, timeout: float = ITINERARY_TIMEOUT) -> OpenAI | None:
    provider = _active_provider()

    if provider == "gemini" and settings.gemini_api_key:
        return OpenAI(
            api_key=settings.gemini_api_key,
            base_url=GEMINI_BASE_URL,
            timeout=timeout,
            max_retries=0,
        )

    if provider == "openrouter" and settings.openrouter_api_key:
        return OpenAI(
            api_key=settings.openrouter_api_key,
            base_url=OPENROUTER_BASE_URL,
            default_headers={
                "HTTP-Referer": settings.openrouter_site_url,
                "X-Title": settings.openrouter_app_name,
            },
            timeout=timeout,
            max_retries=0,
        )

    if provider == "openai" and settings.openai_api_key:
        return OpenAI(api_key=settings.openai_api_key, timeout=timeout, max_retries=0)

    return None


def complete_chat(
    messages: list[dict],
    *,
    temperature: float,
    max_tokens: int,
    timeout: float,
    token_bump: int = 0,
    token_cap: int | None = None,
    parse: Callable[[str], T] | None = None,
) -> str | T:
    """One completion with shared timeout/retry. Raises LLMError on failure."""
    client = get_llm_client(timeout=timeout)
    if client is None:
        raise LLMError("No LLM client configured")

    model = get_llm_model()
    last_error: Exception | None = None
    for attempt in range(LLM_ATTEMPTS):
        token_budget = max_tokens + token_bump * attempt
        if token_cap is not None:
            token_budget = min(token_cap, token_budget)
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=token_budget,
            )
            content = response.choices[0].message.content or ""
            if not content.strip():
                raise ValueError("Empty LLM response")
            return parse(content) if parse else content
        except Exception as exc:
            last_error = exc
            if is_retryable_llm_error(exc) and attempt < LLM_ATTEMPTS - 1:
                wait = 2 * (attempt + 1)
                logger.info("LLM attempt %s failed, retrying in %ss: %s", attempt + 1, wait, exc)
                time.sleep(wait)
                continue
            raise LLMError(str(exc)) from exc

    raise LLMError(str(last_error) if last_error else "LLM request failed") from last_error
