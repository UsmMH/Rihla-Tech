"""In-process rate limits for auth endpoints (ponytail: per-worker only; use Redis if you scale out)."""

import logging
import threading
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

logger = logging.getLogger(__name__)

_BUCKETS: dict[str, list[float]] = defaultdict(list)
_LOCK = threading.Lock()
_LOGGED_FORWARDED_FOR = False


def _client_key(request: Request) -> str:
    global _LOGGED_FORWARDED_FOR
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and not _LOGGED_FORWARDED_FOR:
        _LOGGED_FORWARDED_FOR = True
        logger.info("x-forwarded-for sample (one-time): %s", forwarded)
    if forwarded:
        parts = [part.strip() for part in forwarded.split(",") if part.strip()]
        if parts:
            return parts[-1]
    if request.client:
        return request.client.host
    return "unknown"


def enforce_rate_limit(request: Request, scope: str, *, max_calls: int, window_seconds: int) -> None:
    client = _client_key(request)
    key = f"{scope}:{client}"
    now = time.monotonic()
    window_start = now - window_seconds

    with _LOCK:
        hits = [t for t in _BUCKETS.get(key, []) if t > window_start]
        if len(hits) >= max_calls:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
            )
        hits.append(now)
        _BUCKETS[key] = hits
        for stale_key, timestamps in list(_BUCKETS.items()):
            recent = [t for t in timestamps if t > window_start]
            if recent:
                _BUCKETS[stale_key] = recent
            else:
                del _BUCKETS[stale_key]
