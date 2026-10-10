"""SerpApi client checks (mock + quota). Run: python scripts/test_serpapi.py"""
import json
import logging
import os
import secrets
import sys
import traceback
import unittest
from contextlib import contextmanager
from io import BytesIO
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import delete, func, select
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.database import SessionLocal
from app.models.chat_message import ChatMessage  # noqa: F401 — register ORM
from app.models.community import TripComment, TripSave, TripVote  # noqa: F401
from app.models.serpapi import SerpApiUsage  # noqa: F401 — register table
from app.models.trip_plan import TripPlan  # noqa: F401
from app.models.user import User
from app.services.serpapi import (
    SERPAPI_LOCALE,
    SerpApiUnavailable,
    _reserve_serpapi_usage,
    is_production_environment,
    put_cached,
    serpapi_mock_enabled,
    serpapi_search,
)

DUMMY_KEY = "serpapi_test_key_do_not_log_me_99"
BASE_FLIGHT = {
    "engine": "google_flights",
    "departure_id": "RUH",
    "arrival_id": "CDG",
    "outbound_date": "2026-11-25",
    "return_date": "2026-11-30",
    "adults": 1,
    "type": "1",
}


@contextmanager
def _env(**overrides: str | None):
    saved = {key: os.environ.get(key) for key in overrides}
    try:
        for key, value in overrides.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        yield
    finally:
        for key, old in saved.items():
            if old is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = old


def _assert_mock_fixture(params: dict, expected_engine: str) -> None:
    db = SessionLocal()
    try:
        with patch("app.services.serpapi.serpapi_mock_enabled", return_value=True):
            data = serpapi_search(db, None, params)
    finally:
        db.close()
    assert data.get("mock") is True, "fixture response must set mock=true"
    sp = data.get("search_parameters") or {}
    for key, value in SERPAPI_LOCALE.items():
        assert sp.get(key) == value, f"locale {key} not merged in mock response"
    assert sp.get("engine") == expected_engine


def _url_with_key() -> str:
    return f"https://serpapi.com/search.json?api_key={DUMMY_KEY}&engine=google_flights"


print("mock fixtures + locale")
_assert_mock_fixture({**BASE_FLIGHT, "type": "1"}, "google_flights")
_assert_mock_fixture({**BASE_FLIGHT, "type": "2", "return_date": None}, "google_flights")
_assert_mock_fixture({**BASE_FLIGHT, "departure_token": "tok"}, "google_flights")
_assert_mock_fixture({**BASE_FLIGHT, "booking_token": "tok", "type": "1"}, "google_flights")
_assert_mock_fixture({**BASE_FLIGHT, "booking_token": "tok", "type": "2"}, "google_flights")
_assert_mock_fixture(
    {
        "engine": "google_hotels",
        "q": "hotels in Paris",
        "check_in_date": "2026-11-25",
        "check_out_date": "2026-11-30",
        "adults": 2,
    },
    "google_hotels",
)
print("OK mock fixtures")

print("environment detection")
with _env(RENDER="true", APP_ENV=None):
    settings.app_env = ""
    assert is_production_environment() is True
    settings.serpapi_mock = True
    assert serpapi_mock_enabled() is False
with _env(RENDER=None, APP_ENV="production"):
    settings.app_env = "production"
    assert is_production_environment() is True
    settings.serpapi_mock = True
    assert serpapi_mock_enabled() is False
with _env(RENDER=None, APP_ENV="development"):
    settings.app_env = "development"
    assert is_production_environment() is False
    settings.serpapi_mock = True
    assert serpapi_mock_enabled() is True
settings.serpapi_mock = False
print("OK environment detection")

db = SessionLocal()
test_users: list[int] = []
try:
    for is_admin in (False, True):
        user = User(
            email=f"serpapi-{secrets.token_hex(6)}@example.test",
            password="hashed",
            first_name="Serp",
            last_name="Test",
            is_admin=is_admin,
            is_verified=True,
        )
        db.add(user)
        db.flush()
        test_users.append(user.id)

    db.commit()
    user_id, admin_id = test_users

    def usage_count() -> int:
        return int(db.scalar(select(func.count()).select_from(SerpApiUsage)) or 0)

    with patch("app.services.serpapi.serpapi_mock_enabled", return_value=False):
        settings.serpapi_api_key = DUMMY_KEY
        settings.serpapi_monthly_cap = 210
        settings.serpapi_user_monthly_cap = 30

        def _run_fetch_failure(urlopen_impl, *, label: str) -> None:
            before = usage_count()
            with patch("app.services.serpapi.urlopen", urlopen_impl):
                try:
                    serpapi_search(db, db.get(User, user_id), BASE_FLIGHT)
                    raise AssertionError(f"expected SerpApiUnavailable ({label})")
                except SerpApiUnavailable as exc:
                    assert exc.reason == "error"
            after = usage_count()
            return before, after

        def http_error(code: int, body: bytes = b"oops"):
            def _open(url, timeout=60):  # noqa: ARG001
                raise HTTPError(
                    url=_url_with_key(),
                    code=code,
                    msg="err",
                    hdrs=None,
                    fp=BytesIO(body),
                )

            return _open

        before, after = _run_fetch_failure(http_error(500), label="HTTP 500")
        assert after == before + 1, "usage row kept on HTTP 5xx"

        for code in (400, 401, 429):
            before, after = _run_fetch_failure(http_error(code), label=f"HTTP {code}")
            assert after == before, f"usage row released on HTTP {code}"

        def url_error_connect(url, timeout=60):  # noqa: ARG001
            raise URLError("connection refused")

        before, after = _run_fetch_failure(url_error_connect, label="URLError connect")
        assert after == before, "usage row released on connect URLError"

        class _ReadTimeoutResponse:
            def read(self, *args, **kwargs):  # noqa: ARG002
                raise TimeoutError("read timed out")

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        def urlopen_read_timeout(url, timeout=60):  # noqa: ARG001
            return _ReadTimeoutResponse()

        before, after = _run_fetch_failure(urlopen_read_timeout, label="read timeout")
        assert after == before + 1, "usage row kept on read timeout"

        def urlopen_api_error_json(url, timeout=60):  # noqa: ARG001
            payload = json.dumps({"error": "Invalid API key"}).encode()

            class _Resp:
                def read(self, *a, **k):
                    return payload

                def __enter__(self):
                    return self

                def __exit__(self, *a):
                    return False

            return _Resp()

        before, after = _run_fetch_failure(urlopen_api_error_json, label="JSON error field")
        assert after == before, "usage row released on API error JSON"

        def urlopen_invalid_json(url, timeout=60):  # noqa: ARG001
            class _Resp:
                def read(self, *a, **k):
                    return b"not-json"

                def __enter__(self):
                    return self

                def __exit__(self, *a):
                    return False

            return _Resp()

        before, after = _run_fetch_failure(urlopen_invalid_json, label="invalid JSON")
        assert after == before + 1, "usage row kept on invalid JSON body"

        def urlopen_json_null(url, timeout=60):  # noqa: ARG001
            class _Resp:
                def read(self, *a, **k):
                    return b"null"

                def __enter__(self):
                    return self

                def __exit__(self, *a):
                    return False

            return _Resp()

        before, after = _run_fetch_failure(urlopen_json_null, label="JSON null")
        assert after == before + 1, "usage row kept on JSON null"

    print("OK usage row release rules")

    with patch("app.services.serpapi.serpapi_mock_enabled", return_value=False):
        settings.serpapi_api_key = DUMMY_KEY
        settings.serpapi_monthly_cap = 210

        def failing_urlopen_release(url, timeout=60):  # noqa: ARG001
            raise HTTPError(
                url=_url_with_key(),
                code=400,
                msg="Bad Request",
                hdrs=None,
                fp=BytesIO(b"bad"),
            )

        with patch("app.services.serpapi.urlopen", failing_urlopen_release):
            with patch("app.services.serpapi._release_serpapi_usage") as broken_release:
                broken_release.side_effect = RuntimeError("release db blew up")
                try:
                    serpapi_search(db, db.get(User, user_id), BASE_FLIGHT)
                    raise AssertionError("expected SerpApiUnavailable")
                except SerpApiUnavailable as exc:
                    assert exc.reason == "error"
                    assert broken_release.called
                except RuntimeError:
                    raise AssertionError("release failure must not replace SerpApiUnavailable")

    print("OK release failure does not mask fetch error")

    with patch("app.services.serpapi.serpapi_mock_enabled", return_value=False):
        settings.serpapi_api_key = DUMMY_KEY
        settings.serpapi_monthly_cap = 210

        def failing_urlopen_key_hygiene(url, timeout=60):  # noqa: ARG001
            raise HTTPError(
                url=_url_with_key(),
                code=500,
                msg="err",
                hdrs=None,
                fp=BytesIO(b"fail"),
            )

        with patch("app.services.serpapi.urlopen", failing_urlopen_key_hygiene):
            with unittest.TestCase().assertLogs(logging.getLogger(), level=logging.DEBUG) as log_ctx:
                try:
                    serpapi_search(db, db.get(User, user_id), BASE_FLIGHT)
                    raise AssertionError("expected SerpApiUnavailable")
                except SerpApiUnavailable as exc:
                    for text in (
                        str(exc),
                        repr(exc),
                        "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
                        "\n".join(log_ctx.output),
                    ):
                        assert DUMMY_KEY not in text, "API key leaked"
    print("OK key hygiene")

    with patch("app.services.serpapi.serpapi_mock_enabled", return_value=False):
        settings.serpapi_api_key = DUMMY_KEY
        settings.serpapi_user_monthly_cap = 1
        settings.serpapi_monthly_cap = 210
        db.add(SerpApiUsage(user_id=user_id, engine="google_flights"))
        db.commit()
        try:
            serpapi_search(db, db.get(User, user_id), BASE_FLIGHT)
            raise AssertionError("expected user_limit")
        except SerpApiUnavailable as exc:
            assert exc.reason == "user_limit"
        try:
            with patch("app.services.serpapi._fetch_serpapi_json", return_value={"search_metadata": {}}):
                serpapi_search(db, db.get(User, admin_id), BASE_FLIGHT)
        except SerpApiUnavailable as exc:
            if exc.reason == "user_limit":
                raise AssertionError("admin must not hit per-user cap") from exc
            raise
    print("OK per-user cap (admin exempt)")

    db.execute(delete(SerpApiUsage))
    db.commit()

    with patch("app.services.serpapi.serpapi_mock_enabled", return_value=False):
        settings.serpapi_api_key = DUMMY_KEY
        settings.serpapi_monthly_cap = 0
        try:
            serpapi_search(db, db.get(User, admin_id), BASE_FLIGHT)
            raise AssertionError("expected quota")
        except SerpApiUnavailable as exc:
            assert exc.reason == "quota"
        settings.serpapi_monthly_cap = 210
        with patch("app.services.serpapi._fetch_serpapi_json", return_value={"search_metadata": {}}):
            serpapi_search(db, db.get(User, admin_id), BASE_FLIGHT)
    print("OK quota rejection does not wedge lock")

    with patch("app.services.serpapi.serpapi_mock_enabled", return_value=False):
        settings.serpapi_api_key = DUMMY_KEY
        settings.serpapi_monthly_cap = 210
        with patch(
            "app.services.serpapi._acquire_quota_lock",
            side_effect=SQLAlchemyError("db down"),
        ):
            try:
                _reserve_serpapi_usage(db.get(User, admin_id), "google_flights")
                raise AssertionError("expected SerpApiUnavailable")
            except SerpApiUnavailable as exc:
                assert exc.reason == "error"
    print("OK quota DB error -> SerpApiUnavailable")

    try:
        put_cached(db, 1, "hotels", "abc", {"post_data": "secret"})
        raise AssertionError("put_cached must reject post_data")
    except ValueError:
        pass
    print("OK put_cached rejects post_data")

finally:
    if test_users:
        db.execute(delete(SerpApiUsage).where(SerpApiUsage.user_id.in_(test_users)))
        db.execute(delete(User).where(User.id.in_(test_users)))
    db.commit()
    db.close()

print("All SerpApi client checks passed.")
