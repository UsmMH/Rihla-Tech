"""SerpApi client checks (mock + quota). Run: python scripts/test_serpapi.py"""
import json
import logging
import os
import secrets
import sys
import threading
import traceback
import unittest
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.database import SessionLocal
from app.models.chat_message import ChatMessage  # noqa: F401 — register ORM
from app.models.community import TripComment, TripSave, TripVote  # noqa: F401
from datetime import date

from fastapi import HTTPException

from app.models.serpapi import SerpApiCache, SerpApiUsage  # noqa: F401 — register table
from app.models.trip_plan import TripPlan
from app.models.user import User
from app.services.flights import (
    _flight_cache_key,
    _resolve_airport_code,
    booking_options,
    search_flights,
    search_returns,
)
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
# Rows with this engine are created only by this script's live-search mocks.
TEST_USAGE_ENGINE = "google_flights"
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


def _delete_test_usage_rows(session, user_ids: list[int], since: datetime) -> None:
    if not user_ids:
        return
    session.execute(
        delete(SerpApiUsage).where(
            or_(
                SerpApiUsage.user_id.in_(user_ids),
                and_(
                    SerpApiUsage.user_id.is_(None),
                    SerpApiUsage.engine == TEST_USAGE_ENGINE,
                    SerpApiUsage.created_at >= since,
                ),
            )
        )
    )


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
test_started_at = datetime.now(timezone.utc)
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
        assert after == before + 1, "usage row kept on 200 JSON error field"

        def urlopen_no_results_error(url, timeout=60):  # noqa: ARG001
            payload = json.dumps(
                {"error": "Google Flights hasn't returned any results for this query."}
            ).encode()

            class _Resp:
                def read(self, *a, **k):
                    return payload

                def __enter__(self):
                    return self

                def __exit__(self, *a):
                    return False

            return _Resp()

        before = usage_count()
        with patch("app.services.serpapi.urlopen", urlopen_no_results_error):
            result = serpapi_search(db, db.get(User, user_id), BASE_FLIGHT)
        after = usage_count()
        assert result == {}, "no-results error returns empty result"
        assert after == before + 1, "usage row kept on no-results 200 error"

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

    _delete_test_usage_rows(db, test_users, test_started_at)
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

    print("flights backend (mock)")
    flight_user = db.get(User, user_id)
    trip = TripPlan(
        user_id=user_id,
        destination="Paris, France",
        origin="King Khalid International Airport (RUH), Riyadh",
        start_date=date(2026, 11, 25),
        end_date=date(2026, 11, 30),
        num_adults=1,
        num_children=0,
        include_flights=True,
        origin_airport="RUH",
        destination_airport="CDG",
        status="ready",
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)

    settings.serpapi_mock = True
    with patch("app.services.serpapi.serpapi_mock_enabled", return_value=True):
        outbound = search_flights(db, flight_user, trip.id, "round", cached_only=False)
        assert outbound.source == "fixture"
        assert outbound.offers
        pick = next(o for o in outbound.offers if o.can_pick_return)
        offer_id = pick.id

        captured_params: list[dict] = []
        real_search = serpapi_search

        def _recording_search(session, user, params):
            captured_params.append(dict(params))
            return real_search(session, user, params)

        with patch("app.services.flights.serpapi_search", side_effect=_recording_search):
            first_returns = search_returns(db, flight_user, trip.id, offer_id)
            assert first_returns.offers
            second_returns = search_returns(db, flight_user, trip.id, offer_id)
            assert second_returns.offers
            assert len(captured_params) == 1, "return search must be cached on second call"

        params = captured_params[0]
        assert params.get("departure_id") == "RUH"
        assert params.get("arrival_id") == "CDG"
        assert params.get("departure_token")
        assert "booking_token" not in params

        return_offer = next(o for o in first_returns.offers if o.can_book)
        before_booking_rows = int(
            db.scalar(select(func.count()).select_from(SerpApiCache).where(SerpApiCache.kind == "flights_return"))
            or 0
        )
        booking = booking_options(db, flight_user, trip.id, return_offer.id)
        assert booking.options and booking.options[0].post_data
        after_booking_rows = int(
            db.scalar(select(func.count()).select_from(SerpApiCache).where(SerpApiCache.kind == "flights_return"))
            or 0
        )
        assert before_booking_rows == after_booking_rows, "booking must not write cache rows"

        try:
            search_returns(db, flight_user, trip.id, "not-in-cache-offer")
            raise AssertionError("expected 404 for unknown offer")
        except HTTPException as exc:
            assert exc.status_code == 404
        assert len(captured_params) == 1, "404 must not trigger SerpApi search"

    db.execute(delete(SerpApiCache).where(SerpApiCache.trip_plan_id == trip.id))
    db.commit()
    with patch("app.services.serpapi.serpapi_mock_enabled", return_value=False):
        settings.serpapi_api_key = None
        settings.serpapi_mock = False
        unconfigured = search_flights(db, flight_user, trip.id, "round", cached_only=False)
        assert unconfigured.source == "unavailable"
        assert unconfigured.unavailable_reason == "not_configured"
        assert unconfigured.search_url.startswith("https://www.google.com/travel/flights")

    with patch("app.services.flights.search_airports", return_value=[]):
        assert _resolve_airport_code("King Khalid International Airport (RUH), Riyadh", db, trip.id, "origin") == "RUH"

    with patch("app.services.flights.search_airports", return_value=[]):
        with patch("app.services.llm.llm_configured", return_value=True):
            with patch("app.services.llm.complete_chat", return_value="ZZZ"):
                assert _resolve_airport_code("Mystery City", db, trip.id, "destination") is None

    print("review fixes")
    trip_no_airports = TripPlan(
        user_id=user_id,
        destination="Paris, France",
        origin="Riyadh, Saudi Arabia",
        start_date=date(2026, 11, 25),
        end_date=date(2026, 11, 30),
        num_adults=1,
        num_children=0,
        include_flights=True,
        status="ready",
    )
    db.add(trip_no_airports)
    db.commit()
    db.refresh(trip_no_airports)

    with patch("app.services.flights.search_airport_suggestions") as mock_duffel:
        with patch("app.services.flights.search_airports") as mock_airports:
            with patch("app.services.flights.serpapi_search") as mock_serp:
                with patch("app.services.llm.complete_chat") as mock_llm:
                    cached = search_flights(db, flight_user, trip_no_airports.id, "round", cached_only=True)
                    assert cached.unavailable_reason == "no_airport"
                    assert mock_duffel.call_count == 0
                    assert mock_airports.call_count == 0
                    assert mock_serp.call_count == 0
                    assert mock_llm.call_count == 0

    with patch(
        "app.services.flights.search_airports",
        return_value=[
            {
                "label": "Charles de Gaulle (CDG), Paris, France",
                "iata_code": "CDG",
                "city": "Paris",
                "latitude": 1.0,
                "longitude": 2.0,
                "kind": "airport",
            },
            {
                "label": "Paris Beauvais (BVA), Beauvais, France",
                "iata_code": "BVA",
                "city": "Beauvais",
                "latitude": 1.0,
                "longitude": 2.0,
                "kind": "airport",
            },
        ],
    ):
        assert _resolve_airport_code("Paris, France", db, trip_no_airports.id, "destination") == "CDG"
    with patch(
        "app.services.flights.search_airports",
        return_value=[
            {
                "label": "Paris Beauvais (BVA), Beauvais, France",
                "iata_code": "BVA",
                "city": "Beauvais",
                "latitude": 1.0,
                "longitude": 2.0,
                "kind": "airport",
            },
        ],
    ):
        with patch("app.services.llm.llm_configured", return_value=False):
            assert _resolve_airport_code("Paris, France", db, trip_no_airports.id, "destination") is None

    trip_no_airports.origin_airport = "RUH"
    trip_no_airports.destination_airport = "CDG"
    db.commit()
    round_key = _flight_cache_key(trip_no_airports, "RUH", "CDG", "round")
    stale_offer_id = "stale-offer-1"
    stale_payload = {
        "offers": [
            {
                "id": stale_offer_id,
                "airline": "Test Air",
                "price": "SAR 100",
                "price_note": "note",
                "price_amount": 100,
                "currency": "SAR",
                "leg": {
                    "origin": "RUH",
                    "origin_code": "RUH",
                    "destination": "CDG",
                    "destination_code": "CDG",
                    "airline": "Test Air",
                    "stops": 0,
                    "layovers": [],
                },
                "can_pick_return": False,
                "can_book": True,
                "booking_token": "book-stale",
            }
        ],
        "search_url": "",
        "source": "fixture",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    put_cached(db, trip_no_airports.id, "flights_round", round_key, stale_payload)
    row = (
        db.query(SerpApiCache)
        .filter(
            SerpApiCache.trip_plan_id == trip_no_airports.id,
            SerpApiCache.kind == "flights_round",
            SerpApiCache.cache_key == round_key,
        )
        .one()
    )
    row.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db.commit()

    booking_stale = booking_options(db, flight_user, trip_no_airports.id, stale_offer_id)
    assert booking_stale.unavailable is True
    assert booking_stale.unavailable_reason == "refresh_needed"
    assert booking_stale.options == []

    search_counts: list[int] = []
    search_lock = threading.Lock()

    def _counting_search(session, user, params):
        with search_lock:
            search_counts.append(1)
        return serpapi_search(session, user, params)

    with patch("app.services.serpapi.serpapi_mock_enabled", return_value=True):
        with patch("app.services.flights.serpapi_search", side_effect=_counting_search):
            barrier = threading.Barrier(2)

            def _refresh():
                barrier.wait()
                session = SessionLocal()
                try:
                    user = session.get(User, user_id)
                    search_flights(
                        session,
                        user,
                        concurrent_trip_id,
                        "round",
                        cached_only=False,
                        refresh=True,
                    )
                    session.commit()
                finally:
                    session.close()

            trip.origin_airport = "RUH"
            trip.destination_airport = "CDG"
            db.commit()
            concurrent_trip_id = trip.id
            base_key = _flight_cache_key(trip, "RUH", "CDG", "round")
            warm_payload = {
                "offers": stale_payload["offers"],
                "search_url": "https://www.google.com/travel/flights?q=warm",
                "source": "fixture",
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }
            put_cached(db, trip.id, "flights_round", base_key, warm_payload)
            warm_row = (
                db.query(SerpApiCache)
                .filter(
                    SerpApiCache.trip_plan_id == trip.id,
                    SerpApiCache.kind == "flights_round",
                    SerpApiCache.cache_key == base_key,
                )
                .one()
            )
            warm_row.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
            warm_row.created_at = datetime.now(timezone.utc) - timedelta(hours=2)
            db.commit()

            t1 = threading.Thread(target=_refresh)
            t2 = threading.Thread(target=_refresh)
            t1.start()
            t2.start()
            t1.join()
            t2.join()
            assert len(search_counts) == 1, "concurrent stale refresh must perform one SerpApi search"

    fail_payload = {
        "offers": [
            {
                "id": "keep-me",
                "airline": "Keep Air",
                "price": "SAR 200",
                "price_note": "note",
                "price_amount": 200,
                "currency": "SAR",
                "leg": {
                    "origin": "RUH",
                    "origin_code": "RUH",
                    "destination": "CDG",
                    "destination_code": "CDG",
                    "airline": "Keep Air",
                    "stops": 0,
                    "layovers": [],
                },
                "can_pick_return": False,
                "can_book": False,
            }
        ],
        "search_url": "",
        "source": "fixture",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    put_cached(db, trip_no_airports.id, "flights_round", round_key, fail_payload)
    fail_row = (
        db.query(SerpApiCache)
        .filter(
            SerpApiCache.trip_plan_id == trip_no_airports.id,
            SerpApiCache.kind == "flights_round",
            SerpApiCache.cache_key == round_key,
        )
        .one()
    )
    fail_row.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    fail_row.created_at = datetime.now(timezone.utc) - timedelta(hours=2)
    db.commit()

    with patch("app.services.flights.serpapi_search", side_effect=SerpApiUnavailable("error")):
        refreshed = search_flights(
            db,
            flight_user,
            trip_no_airports.id,
            "round",
            cached_only=False,
            refresh=True,
        )
    assert refreshed.refresh_failed is True
    assert refreshed.stale is True
    assert refreshed.offers and refreshed.offers[0].id == "keep-me"
    assert refreshed.search_url.startswith("https://www.google.com/travel/flights")

    db.execute(delete(SerpApiCache).where(SerpApiCache.trip_plan_id == trip_no_airports.id))
    db.execute(delete(TripPlan).where(TripPlan.id == trip_no_airports.id))
    print("OK review fixes")

    db.execute(delete(SerpApiCache).where(SerpApiCache.trip_plan_id == trip.id))
    db.execute(delete(TripPlan).where(TripPlan.id == trip.id))
    db.commit()
    print("OK flights backend")

finally:
    if test_users:
        _delete_test_usage_rows(db, test_users, test_started_at)
        db.execute(delete(User).where(User.id.in_(test_users)))
    db.commit()
    db.close()

print("All SerpApi client checks passed.")
