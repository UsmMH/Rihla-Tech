"""In-process rate limits for auth endpoints (ponytail: per-worker only; use Redis if you scale out)."""

import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

_BUCKETS: dict[str, list[float]] = defaultdict(list)


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def enforce_rate_limit(request: Request, scope: str, *, max_calls: int, window_seconds: int) -> None:
    key = f"{scope}:{_client_key(request)}"
    now = time.monotonic()
    window_start = now - window_seconds
    hits = [t for t in _BUCKETS[key] if t > window_start]
    if len(hits) >= max_calls:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )
    hits.append(now)
    _BUCKETS[key] = hits
