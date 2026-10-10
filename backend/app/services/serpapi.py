"""SerpApi client, quota, and per-trip cache. Only module that reads SERPAPI_API_KEY."""

from __future__ import annotations

import copy
import hashlib
import json
import logging
import os
import socket
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from sqlalchemy import delete, func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.serpapi import SERPAPI_CACHE_KINDS, SerpApiCache, SerpApiUsage
from app.models.user import User

logger = logging.getLogger(__name__)

SERPAPI_LOCALE = {"currency": "SAR", "gl": "sa", "hl": "en"}
SERPAPI_SEARCH_URL = "https://serpapi.com/search.json"
# Single global quota lock (ponytail: one integer; split locks if contention ever matters).
SERPAPI_QUOTA_LOCK_ID = 8_424_242
_FIXTURES_DIR = Path(__file__).resolve().parents[1] / "data" / "serpapi_fixtures"
_HTTP_RELEASE_CODES = frozenset({400, 401, 429})


class SerpApiUnavailable(Exception):
    """SerpApi cannot run (config, quota, or upstream failure)."""

    def __init__(self, reason: str, *, release_usage: bool = False) -> None:
        self.reason = reason
        self.release_usage = release_usage
        super().__init__(reason)


def is_production_environment() -> bool:
    """Hosted prod: APP_ENV=production or Render's RENDER=true."""
    if (settings.app_env or "").strip().lower() == "production":
        return True
    return os.getenv("RENDER") == "true"


def serpapi_mock_enabled() -> bool:
    return bool(settings.serpapi_mock) and not is_production_environment()


def serpapi_configured() -> bool:
    key = settings.serpapi_api_key
    return bool(key and key.strip())


def _merge_locale(params: dict[str, Any]) -> dict[str, Any]:
    return {**SERPAPI_LOCALE, **params}


def _fixture_stem(params: dict[str, Any]) -> str:
    engine = str(params.get("engine") or "")
    if engine == "google_hotels":
        return "hotels"
    if params.get("booking_token"):
        return "booking_one_way" if str(params.get("type")) == "2" else "booking"
    if params.get("departure_token"):
        return "flights_return"
    if str(params.get("type")) == "2":
        return "flights_one_way"
    return "flights_round"


def _load_mock_response(params: dict[str, Any]) -> dict[str, Any]:
    stem = _fixture_stem(params)
    path = _FIXTURES_DIR / f"{stem}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data = copy.deepcopy(data)
    data["mock"] = True
    merged = _merge_locale(params)
    search_params = dict(data.get("search_parameters") or {})
    for key, value in merged.items():
        if key != "api_key":
            search_params[key] = value
    data["search_parameters"] = search_params
    return data


def _redact_key(text: str, api_key: str) -> str:
    if not api_key:
        return text
    return text.replace(api_key, "***")


def _engine_name(params: dict[str, Any]) -> str:
    engine = str(params.get("engine") or "google_flights")
    return engine[:20]


def _month_start_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _hour_start_utc() -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=1)


def _usage_count_since(db: Session, since: datetime, *, user_id: int | None = None) -> int:
    stmt = select(func.count()).select_from(SerpApiUsage).where(SerpApiUsage.created_at >= since)
    if user_id is not None:
        stmt = stmt.where(SerpApiUsage.user_id == user_id)
    return int(db.scalar(stmt) or 0)


def _acquire_quota_lock(db: Session) -> None:
    db.execute(text("SELECT pg_advisory_xact_lock(:lock_id)"), {"lock_id": SERPAPI_QUOTA_LOCK_ID})


def _check_caps(db: Session, user: User | None) -> None:
    if settings.serpapi_monthly_cap <= 0:
        raise SerpApiUnavailable("quota")
    if _usage_count_since(db, _month_start_utc()) >= settings.serpapi_monthly_cap:
        raise SerpApiUnavailable("quota")
    if _usage_count_since(db, _hour_start_utc()) >= settings.serpapi_hourly_cap:
        raise SerpApiUnavailable("quota")
    if user is not None and not user.is_admin:
        if _usage_count_since(db, _month_start_utc(), user_id=user.id) >= settings.serpapi_user_monthly_cap:
            raise SerpApiUnavailable("user_limit")


def _reserve_usage(db: Session, user: User | None, engine: str) -> SerpApiUsage:
    row = SerpApiUsage(user_id=user.id if user else None, engine=engine)
    db.add(row)
    db.flush()
    return row


def _release_usage(db: Session, usage_id: int) -> None:
    db.execute(delete(SerpApiUsage).where(SerpApiUsage.id == usage_id))
    db.flush()


def _reserve_serpapi_usage(user: User | None, engine: str) -> int:
    """Quota lock + usage row in a dedicated session (never holds caller transaction)."""
    db = SessionLocal()
    try:
        _acquire_quota_lock(db)
        _check_caps(db, user)
        usage = _reserve_usage(db, user, engine)
        usage_id = usage.id
        db.commit()
        return usage_id
    except SerpApiUnavailable:
        db.rollback()
        raise
    except SQLAlchemyError:
        db.rollback()
        logger.exception("SerpApi quota DB error engine=%s", engine)
        raise SerpApiUnavailable("error") from None
    finally:
        db.close()


def _release_serpapi_usage(usage_id: int) -> None:
    db = SessionLocal()
    try:
        _release_usage(db, usage_id)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("SerpApi failed to release usage row id=%s", usage_id)
    finally:
        db.close()


def _raise_unavailable(reason: str, *, release_usage: bool = False) -> None:
    raise SerpApiUnavailable(reason, release_usage=release_usage) from None


def _fetch_serpapi_json(params: dict[str, Any], api_key: str) -> dict[str, Any]:
    """HTTP GET search.json. api_key must never appear in raised exception messages."""
    engine = _engine_name(params)
    try:
        response = urlopen(
            f"{SERPAPI_SEARCH_URL}?{urlencode({**params, 'api_key': api_key})}",
            timeout=60,
        )
    except HTTPError as exc:
        release = exc.code in _HTTP_RELEASE_CODES
        detail = ""
        try:
            raw = exc.read()
            detail = raw.decode("utf-8", errors="replace")[:500]
        except Exception:
            detail = ""
        logger.warning(
            "SerpApi HTTP %s engine=%s detail=%s",
            exc.code,
            engine,
            _redact_key(detail, api_key),
        )
        _raise_unavailable("error", release_usage=release)
    except URLError:
        logger.warning("SerpApi network error engine=%s", engine)
        _raise_unavailable("error", release_usage=True)
    except Exception:
        logger.exception("SerpApi unexpected error engine=%s", engine)
        _raise_unavailable("error")

    try:
        with response:
            try:
                body = response.read().decode("utf-8")
            except (TimeoutError, socket.timeout, URLError):
                logger.warning("SerpApi read error engine=%s", engine)
                _raise_unavailable("error", release_usage=False)
    except SerpApiUnavailable:
        raise
    except Exception:
        logger.exception("SerpApi unexpected read error engine=%s", engine)
        _raise_unavailable("error", release_usage=False)

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        logger.warning("SerpApi invalid JSON engine=%s", engine)
        _raise_unavailable("error", release_usage=False)

    if not isinstance(payload, dict):
        logger.warning("SerpApi non-object JSON engine=%s", engine)
        _raise_unavailable("error", release_usage=False)

    err = payload.get("error")
    if isinstance(err, str) and err.strip():
        normalized = err.strip().lower()
        if "any results" in normalized or "no results" in normalized:
            return {}
        logger.warning(
            "SerpApi API error engine=%s detail=%s",
            engine,
            _redact_key(err, api_key),
        )
        _raise_unavailable("error", release_usage=False)
    return payload


def serpapi_search(db: Session, user: User | None, params: dict[str, Any]) -> dict[str, Any]:
    merged = _merge_locale(params)
    if serpapi_mock_enabled():
        return _load_mock_response(merged)

    api_key = (settings.serpapi_api_key or "").strip()
    if not api_key:
        raise SerpApiUnavailable("not_configured")

    engine = _engine_name(merged)
    usage_id = _reserve_serpapi_usage(user, engine)
    try:
        return _fetch_serpapi_json(merged, api_key)
    except SerpApiUnavailable as exc:
        exc.__cause__ = None
        exc.__context__ = None
        if exc.release_usage:
            try:
                _release_serpapi_usage(usage_id)
            except Exception:
                logger.exception("SerpApi failed to release usage row id=%s", usage_id)
        raise


def _payload_has_post_data(value: Any) -> bool:
    if isinstance(value, dict):
        if "post_data" in value:
            return True
        return any(_payload_has_post_data(v) for v in value.values())
    if isinstance(value, list):
        return any(_payload_has_post_data(v) for v in value)
    return False


def cache_key_digest(parts: str) -> str:
    return hashlib.sha256(parts.encode("utf-8")).hexdigest()


def get_cached(
    db: Session,
    trip_id: int,
    kind: str,
    cache_key: str,
) -> tuple[dict[str, Any], bool] | None:
    if kind not in SERPAPI_CACHE_KINDS:
        raise ValueError(f"invalid serpapi cache kind: {kind}")
    row = (
        db.query(SerpApiCache)
        .filter(
            SerpApiCache.trip_plan_id == trip_id,
            SerpApiCache.kind == kind,
            SerpApiCache.cache_key == cache_key,
        )
        .one_or_none()
    )
    if row is None:
        return None
    now = datetime.now(timezone.utc)
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    stale = now >= expires
    return row.payload, stale


def put_cached(
    db: Session,
    trip_id: int,
    kind: str,
    cache_key: str,
    payload: dict[str, Any],
) -> None:
    if kind not in SERPAPI_CACHE_KINDS:
        raise ValueError(f"invalid serpapi cache kind: {kind}")
    if _payload_has_post_data(payload):
        raise ValueError("serpapi cache payload must not contain post_data")

    ttl_hours = settings.serpapi_cache_ttl_hours
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=ttl_hours)
    stmt = (
        insert(SerpApiCache)
        .values(
            trip_plan_id=trip_id,
            kind=kind,
            cache_key=cache_key,
            payload=payload,
            expires_at=expires_at,
        )
        .on_conflict_do_update(
            constraint="uq_serpapi_cache_trip_kind_key",
            set_={
                "payload": payload,
                "expires_at": expires_at,
                "created_at": func.now(),
            },
        )
    )
    db.execute(stmt)
    db.flush()
