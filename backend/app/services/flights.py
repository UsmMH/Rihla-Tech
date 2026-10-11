"""Flight search via SerpApi google_flights with Duffel airport autocomplete."""

from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote, urlencode
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config import settings
from app.models.serpapi import SerpApiCache
from app.models.trip_plan import TripPlan
from app.models.user import User
from app.schemas.trip import (
    BookingOptionPublic,
    BookingResponse,
    FlightOfferPublic,
    FlightSegmentPublic,
    FlightsResponse,
)
from app.services.geocoding import search_airports
from app.services.itinerary import get_owned_trip
from app.services.place_labels import city_comparable_key
from app.services.serpapi import (
    SerpApiUnavailable,
    cache_key_digest,
    get_cached,
    put_cached,
    serpapi_mock_enabled,
    serpapi_search,
)

logger = logging.getLogger(__name__)

DUFFEL_API_BASE = "https://api.duffel.com"
DUFFEL_VERSION = "v2"
MAX_OFFERS = 8
FLIGHT_SEARCH_COOLDOWN_SECONDS = 60
FLIGHT_TRIP_SEARCH_LOCK_BASE = 8_424_243
AIRPORT_FAIL_KIND = "airport_fail"
AIRPORT_FAIL_TTL_HOURS = 1


class SerpApiFlightPayloadError(Exception):
    """SerpApi google_flights body is not usable (avoid 500 on bad shapes)."""


def duffel_configured() -> bool:
    token = settings.duffel_access_token
    return bool(token and token.strip())


def _duffel_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.duffel_access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Duffel-Version": DUFFEL_VERSION,
    }


def _duffel_request(method: str, path: str, body: dict | None = None, params: dict | None = None) -> dict:
    query = f"?{urlencode(params)}" if params else ""
    url = f"{DUFFEL_API_BASE}{path}{query}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = Request(url, data=data, headers=_duffel_headers(), method=method)
    try:
        with urlopen(request, timeout=45) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Duffel HTTP {exc.code}: {detail[:500]}") from exc
    except URLError as exc:
        raise RuntimeError(f"Duffel network error: {exc.reason}") from exc


def _extract_iata_from_label(label: str) -> str | None:
    match = re.search(r"\(([A-Za-z]{3})\)", label)
    if match:
        return match.group(1).upper()
    return None


def search_airport_suggestions(query: str, *, limit: int = 8) -> list[dict]:
    """Airport autocomplete via Duffel places API."""
    cleaned = query.strip()
    if len(cleaned) < 2 or not duffel_configured():
        return []

    try:
        payload = _duffel_request("GET", "/places/suggestions", params={"query": cleaned})
    except Exception as exc:
        logger.warning("Duffel airport search failed for %r: %s", cleaned, exc)
        return []

    from app.services.place_labels import country_name_from_iata

    results: list[dict] = []
    seen_iata: set[str] = set()
    for item in payload.get("data") or []:
        if str(item.get("type") or "").lower() != "airport":
            continue
        iata_raw = item.get("iata_code")
        if not isinstance(iata_raw, str) or not iata_raw:
            continue
        iata = iata_raw.upper()
        if iata in seen_iata:
            continue
        seen_iata.add(iata)

        name = str(item.get("name") or "").strip()
        city = str(item.get("city_name") or "").strip()
        country = country_name_from_iata(str(item.get("iata_country_code") or ""))
        display_name = f"{name} ({iata})"
        if city and country:
            label = f"{display_name}, {city}, {country}"
        elif city:
            label = f"{display_name}, {city}"
        else:
            label = display_name

        lat = item.get("latitude")
        lng = item.get("longitude")
        if lat is None or lng is None:
            continue

        results.append(
            {
                "label": label,
                "latitude": float(lat),
                "longitude": float(lng),
                "kind": "airport",
                "iata_code": iata,
                "city": city or None,
            }
        )
        if len(results) >= limit:
            break
    return results


def _departure_date(trip: TripPlan) -> date:
    if trip.start_date:
        return trip.start_date
    return date.today() + timedelta(days=30)


def _return_date(trip: TripPlan) -> date | None:
    depart = _departure_date(trip)
    if trip.end_date and trip.end_date > depart:
        return trip.end_date
    return None


def _traveler_count(trip: TripPlan) -> int:
    return max(1, trip.num_adults + trip.num_children)


def _effective_trip_type(trip: TripPlan, requested: str) -> str:
    stored = (trip.flight_trip_type or "").strip().lower()
    if stored == "one_way":
        return "one_way"
    if stored == "round":
        if _return_date(trip) is None:
            return "one_way"
        return "round"
    if requested == "one_way":
        return "one_way"
    if _return_date(trip) is None:
        return "one_way"
    return "round"


def _cache_kind(trip_type: str) -> str:
    return "flights_one_way" if trip_type == "one_way" else "flights_round"


def _flight_cache_key(trip: TripPlan, origin: str, dest: str, trip_type: str) -> str:
    parts = "|".join(
        [
            origin,
            dest,
            str(trip.start_date or ""),
            str(trip.end_date or ""),
            str(trip.num_adults),
            str(trip.num_children),
            trip_type,
        ]
    )
    return cache_key_digest(parts)


def _google_flights_url(
    origin_code: str | None,
    destination_code: str | None,
    origin_label: str,
    destination_label: str,
    depart: date,
    return_date: date | None,
    adults: int,
    children: int = 0,
) -> str:
    origin = (
        origin_code
        or _extract_iata_from_label(origin_label)
        or origin_label.split(",")[0].strip()
    )
    destination = (
        destination_code
        or _extract_iata_from_label(destination_label)
        or destination_label.split(",")[0].strip()
    )
    query = f"Flights from {origin} to {destination} on {depart.isoformat()}"
    if return_date:
        query += f" through {return_date.isoformat()}"
    if adults > 1:
        query += f" {adults} adults"
    elif adults == 1:
        query += " 1 adult"
    if children > 0:
        query += f" {children} children"
    return f"https://www.google.com/travel/flights?q={quote(query)}"


def _format_duration(minutes: int | None) -> str | None:
    if minutes is None or minutes <= 0:
        return None
    hours, mins = divmod(int(minutes), 60)
    if hours and mins:
        return f"{hours}h {mins}m"
    if hours:
        return f"{hours}h"
    return f"{mins}m"


def _airport_fail_cache_key(role: str, label: str) -> str:
    return cache_key_digest(f"{role}|{label.strip().lower()}")


def _airport_resolution_blocked(db: Session, trip_plan_id: int, role: str, label: str) -> bool:
    key = _airport_fail_cache_key(role, label)
    cached = get_cached(db, trip_plan_id, AIRPORT_FAIL_KIND, key)
    if cached is None:
        return False
    _, stale = cached
    return not stale


def _record_airport_resolution_fail(db: Session, trip_plan_id: int, role: str, label: str) -> None:
    key = _airport_fail_cache_key(role, label)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=AIRPORT_FAIL_TTL_HOURS)
    stmt = (
        insert(SerpApiCache)
        .values(
            trip_plan_id=trip_plan_id,
            kind=AIRPORT_FAIL_KIND,
            cache_key=key,
            payload={"failed": True},
            expires_at=expires_at,
        )
        .on_conflict_do_update(
            constraint="uq_serpapi_cache_trip_kind_key",
            set_={
                "payload": {"failed": True},
                "expires_at": expires_at,
                "created_at": func.now(),
            },
        )
    )
    db.execute(stmt)
    db.flush()


def _resolve_airport_code(
    label: str,
    db: Session,
    trip_plan_id: int,
    role: str,
) -> str | None:
    cleaned = label.strip()
    if not cleaned:
        return None

    embedded = _extract_iata_from_label(cleaned)
    if embedded:
        return embedded

    if _airport_resolution_blocked(db, trip_plan_id, role, cleaned):
        return None

    city_part = cleaned.split(",")[0].strip()
    city_key = city_comparable_key(city_part)
    for item in search_airports(city_part, limit=8):
        item_city = str(item.get("city") or "").strip()
        label_key = city_comparable_key(item_city or str(item.get("label") or ""))
        if label_key == city_key:
            code = item.get("iata_code")
            if isinstance(code, str) and code:
                return code.upper()

    try:
        from app.services.llm import complete_chat, llm_configured

        if not llm_configured():
            _record_airport_resolution_fail(db, trip_plan_id, role, cleaned)
            return None
        raw = complete_chat(
            [
                {
                    "role": "user",
                    "content": f"Main airport IATA code for {city_part}. Reply with only the 3-letter code.",
                }
            ],
            temperature=0,
            max_tokens=8,
            timeout=15,
        )
        code = str(raw).strip().upper()
        if not re.fullmatch(r"[A-Z]{3}", code):
            _record_airport_resolution_fail(db, trip_plan_id, role, cleaned)
            return None
        for item in search_airports(code, limit=5):
            if (item.get("iata_code") or "").upper() == code:
                return code
    except Exception:
        logger.debug("LLM airport resolution failed for %r", city_part, exc_info=True)
    _record_airport_resolution_fail(db, trip_plan_id, role, cleaned)
    return None


def _saved_airport_unavailable_reason(trip: TripPlan) -> str | None:
    if not (trip.destination or "").strip():
        return "no_airport"
    if not trip.start_date:
        return "no_dates"
    if not trip.destination_airport:
        return "no_airport"
    if trip.include_flights and not trip.origin_airport:
        return "no_airport"
    return None


def _sync_trip_airports(db: Session, trip: TripPlan) -> str | None:
    """Resolve and persist airport columns on a live search. Returns unavailable reason or None."""
    if not (trip.destination or "").strip():
        return "no_airport"
    if not trip.start_date:
        return "no_dates"

    changed = False
    origin_label = (trip.origin or "").strip()
    if origin_label and not trip.origin_airport:
        code = _resolve_airport_code(origin_label, db, trip.id, "origin")
        if code:
            trip.origin_airport = code
            changed = True

    if not trip.destination_airport:
        dest_label = trip.destination or ""
        code = _resolve_airport_code(dest_label, db, trip.id, "destination")
        if code:
            trip.destination_airport = code
            changed = True

    if changed:
        db.commit()
        db.refresh(trip)

    return _saved_airport_unavailable_reason(trip)


def _confirm_airport_label(label: str) -> str:
    code = _extract_iata_from_label(label)
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Airport label must include a 3-letter IATA code in parentheses",
        )
    for item in search_airports(code, limit=20):
        if (item.get("iata_code") or "").upper() == code:
            return code
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Airport code could not be confirmed",
    )


def set_trip_airports(
    db: Session,
    user: User,
    trip_plan_id: int,
    *,
    origin: str | None,
    destination: str | None,
) -> TripPlan:
    trip = get_owned_trip(db, user, trip_plan_id)
    if not origin and not destination:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="origin or destination required")
    if origin:
        trip.origin_airport = _confirm_airport_label(origin)
    if destination:
        trip.destination_airport = _confirm_airport_label(destination)
    db.commit()
    db.refresh(trip)
    return trip


def _token_offer_id(token: str) -> str:
    return hashlib.sha1(token.encode("utf-8")).hexdigest()[:16]


def _price_note(price: float, trip: TripPlan, *, round_trip_listing: bool) -> str:
    travelers = _traveler_count(trip)
    t_label = f"{travelers} traveler{'s' if travelers != 1 else ''}, total"
    amount = int(price) if float(price).is_integer() else price
    if round_trip_listing:
        return f"Round trip from SAR {amount} · {t_label}"
    return f"One way · SAR {amount} · {t_label}"


def _segment_from_serp(flight_item: dict) -> FlightSegmentPublic:
    legs = flight_item.get("flights")
    if not isinstance(legs, list):
        raise SerpApiFlightPayloadError("flights segment is not a list")
    first = legs[0] if legs else {}
    last = legs[-1] if legs else first
    dep = first.get("departure_airport") or {}
    arr = last.get("arrival_airport") or {}
    layovers_raw = flight_item.get("layovers") or []
    layover_ids = [str(lo.get("id") or "").strip() for lo in layovers_raw if lo.get("id")]
    airlines = {str(seg.get("airline") or "").strip() for seg in legs if seg.get("airline")}
    airline = " + ".join(sorted(a for a in airlines if a)) or "Airline"
    return FlightSegmentPublic(
        origin=str(dep.get("name") or ""),
        origin_code=str(dep.get("id") or ""),
        destination=str(arr.get("name") or ""),
        destination_code=str(arr.get("id") or ""),
        departure_at=dep.get("time"),
        arrival_at=arr.get("time"),
        duration=_format_duration(flight_item.get("total_duration")),
        airline=airline,
        stops=len(layovers_raw),
        layovers=layover_ids,
    )


def _cached_offer_from_raw(
    raw: dict,
    trip: TripPlan,
    *,
    round_trip_listing: bool,
) -> dict[str, Any]:
    departure_token = raw.get("departure_token")
    booking_token = raw.get("booking_token")
    token_for_id = departure_token or booking_token
    if not isinstance(token_for_id, str) or not token_for_id:
        offer_id = hashlib.sha1(json.dumps(raw, sort_keys=True).encode()).hexdigest()[:16]
    else:
        offer_id = _token_offer_id(token_for_id)

    price_raw = raw.get("price")
    try:
        price_amount = float(price_raw) if price_raw is not None else None
    except (TypeError, ValueError):
        price_amount = None

    leg = _segment_from_serp(raw)
    price_display = f"SAR {price_raw}" if price_raw is not None else "SAR —"
    return {
        "id": offer_id,
        "airline": leg.airline,
        "price": price_display,
        "price_note": _price_note(price_amount or 0, trip, round_trip_listing=round_trip_listing)
        if price_amount is not None
        else None,
        "price_amount": price_amount,
        "currency": "SAR",
        "leg": leg.model_dump(),
        "can_pick_return": bool(departure_token),
        "can_book": bool(booking_token),
        "departure_token": departure_token if isinstance(departure_token, str) else None,
        "booking_token": booking_token if isinstance(booking_token, str) else None,
    }


def _public_offer(cached: dict[str, Any]) -> FlightOfferPublic:
    data = {k: v for k, v in cached.items() if k not in ("departure_token", "booking_token")}
    return FlightOfferPublic.model_validate(data)


def _collect_serp_flights(data: dict[str, Any]) -> list[dict]:
    items: list[dict] = []
    for key in ("best_flights", "other_flights"):
        chunk = data.get(key)
        if chunk is None:
            continue
        if not isinstance(chunk, list):
            raise SerpApiFlightPayloadError(f"{key} is not a list")
        items.extend(chunk)
    return items[:MAX_OFFERS]


def _search_url_from_metadata(data: dict[str, Any], fallback: str) -> str:
    meta = data.get("search_metadata") or {}
    url = meta.get("google_flights_url")
    if isinstance(url, str) and url.strip():
        return url
    return fallback


def _base_serp_params(trip: TripPlan, origin: str, dest: str, trip_type: str) -> dict[str, Any]:
    depart = _departure_date(trip)
    params: dict[str, Any] = {
        "engine": "google_flights",
        "departure_id": origin,
        "arrival_id": dest,
        "outbound_date": depart.isoformat(),
        "adults": max(1, trip.num_adults),
        "type": "2" if trip_type == "one_way" else "1",
    }
    if trip.num_children > 0:
        params["children"] = trip.num_children
    ret = _return_date(trip)
    if trip_type == "round" and ret is not None:
        params["return_date"] = ret.isoformat()
    return params


def _response_source(data: dict[str, Any]) -> str:
    if data.get("mock") or serpapi_mock_enabled():
        return "fixture"
    return "serpapi"


def _parse_search_payload(
    data: dict[str, Any],
    trip: TripPlan,
    *,
    trip_type: str,
    fallback_url: str,
) -> tuple[list[dict[str, Any]], str, str]:
    items = _collect_serp_flights(data)
    round_listing = trip_type == "round"
    offers: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            raise SerpApiFlightPayloadError("flight item is not an object")
        offers.append(_cached_offer_from_raw(item, trip, round_trip_listing=round_listing))
    search_url = _search_url_from_metadata(data, fallback_url)
    source = _response_source(data)
    return offers, search_url, source


def _trip_fallback_search_url(trip: TripPlan, trip_type: str, origin: str | None, dest: str | None) -> str:
    return _google_flights_url(
        origin,
        dest,
        trip.origin or "",
        trip.destination or "",
        _departure_date(trip),
        _return_date(trip) if trip_type == "round" else None,
        max(1, trip.num_adults),
        trip.num_children,
    )


def _acquire_trip_flight_search_lock(db: Session, trip_plan_id: int) -> None:
    lock_id = FLIGHT_TRIP_SEARCH_LOCK_BASE + (trip_plan_id % 1_000_000)
    db.execute(text("SELECT pg_advisory_xact_lock(:lock_id)"), {"lock_id": lock_id})


def _trip_live_search_in_cooldown(db: Session, trip_plan_id: int) -> bool:
    latest = db.scalar(
        select(func.max(SerpApiCache.created_at)).where(
            SerpApiCache.trip_plan_id == trip_plan_id,
            SerpApiCache.kind.in_(("flights_round", "flights_one_way", "flights_return")),
        )
    )
    if latest is None:
        return False
    if latest.tzinfo is None:
        latest = latest.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - latest
    return age.total_seconds() < FLIGHT_SEARCH_COOLDOWN_SECONDS


def _cache_payload_no_results(trip: TripPlan, trip_type: str, fallback_url: str) -> dict[str, Any]:
    fetched_at = datetime.now(timezone.utc)
    return {
        "offers": [],
        "search_url": fallback_url,
        "source": "serpapi",
        "fetched_at": fetched_at.isoformat(),
        "no_results": True,
    }


def _unavailable_flights(
    trip: TripPlan,
    *,
    trip_type: str,
    reason: str,
    origin: str | None = None,
    dest: str | None = None,
    fetched_at: datetime | None = None,
    stale: bool = False,
) -> FlightsResponse:
    origin_label = (trip.origin or "").strip()
    dest_label = (trip.destination or "").strip()
    depart = _departure_date(trip)
    ret = _return_date(trip) if trip_type == "round" else None
    search_url = _google_flights_url(
        origin or trip.origin_airport,
        dest or trip.destination_airport,
        origin_label,
        dest_label,
        depart,
        ret,
        max(1, trip.num_adults),
        trip.num_children,
    )
    return FlightsResponse(
        offers=[],
        search_url=search_url,
        source="unavailable",
        unavailable_reason=reason,
        trip_type=trip_type,
        origin_airport=origin or trip.origin_airport,
        destination_airport=dest or trip.destination_airport,
        traveler_count=_traveler_count(trip),
        fetched_at=fetched_at,
        stale=stale,
        refresh_failed=False,
    )


def _flights_from_cache(
    payload: dict[str, Any],
    trip: TripPlan,
    *,
    trip_type: str,
    stale: bool,
    refresh_failed: bool = False,
) -> FlightsResponse:
    offers = [_public_offer(item) for item in payload.get("offers") or []]
    fetched_raw = payload.get("fetched_at")
    fetched_at = None
    if isinstance(fetched_raw, str):
        try:
            fetched_at = datetime.fromisoformat(fetched_raw.replace("Z", "+00:00"))
        except ValueError:
            fetched_at = None
    search_url = str(payload.get("search_url") or "").strip()
    if not search_url:
        search_url = _trip_fallback_search_url(trip, trip_type, trip.origin_airport, trip.destination_airport)
    unavailable_reason = "no_results" if payload.get("no_results") and not offers else None
    source = "unavailable" if unavailable_reason else str(payload.get("source") or "serpapi")
    return FlightsResponse(
        offers=offers,
        search_url=search_url,
        source=source,
        unavailable_reason=unavailable_reason,
        trip_type=trip_type,
        origin_airport=trip.origin_airport,
        destination_airport=trip.destination_airport,
        traveler_count=_traveler_count(trip),
        fetched_at=fetched_at,
        stale=stale,
        refresh_failed=refresh_failed,
    )


def search_flights(
    db: Session,
    user: User,
    trip_plan_id: int,
    trip_type: str,
    *,
    cached_only: bool = True,
    refresh: bool = False,
) -> FlightsResponse:
    trip = get_owned_trip(db, user, trip_plan_id)
    if not trip.include_flights:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Flights not requested for this trip")

    effective = _effective_trip_type(trip, trip_type)

    if cached_only:
        airport_reason = _saved_airport_unavailable_reason(trip)
        origin = trip.origin_airport
        dest = trip.destination_airport
        if airport_reason:
            return _unavailable_flights(trip, trip_type=effective, reason=airport_reason, origin=origin, dest=dest)
        assert origin and dest
        kind = _cache_kind(effective)
        key = _flight_cache_key(trip, origin, dest, effective)
        cached = get_cached(db, trip_plan_id, kind, key)
        if cached is None:
            return _unavailable_flights(trip, trip_type=effective, reason="not_loaded", origin=origin, dest=dest)
        payload, stale = cached
        return _flights_from_cache(payload, trip, trip_type=effective, stale=stale)

    airport_reason = _sync_trip_airports(db, trip)
    origin = trip.origin_airport
    dest = trip.destination_airport
    fallback_url = _trip_fallback_search_url(trip, effective, origin, dest)

    if airport_reason:
        return _unavailable_flights(trip, trip_type=effective, reason=airport_reason, origin=origin, dest=dest)

    assert origin and dest
    kind = _cache_kind(effective)
    key = _flight_cache_key(trip, origin, dest, effective)
    cached = get_cached(db, trip_plan_id, kind, key)

    if cached is not None:
        payload, stale = cached
        if refresh and not stale:
            return _flights_from_cache(payload, trip, trip_type=effective, stale=False)
        if not refresh:
            return _flights_from_cache(payload, trip, trip_type=effective, stale=stale)
        if refresh and stale and _trip_live_search_in_cooldown(db, trip_plan_id):
            return _flights_from_cache(payload, trip, trip_type=effective, stale=True)

    _acquire_trip_flight_search_lock(db, trip_plan_id)
    cached = get_cached(db, trip_plan_id, kind, key)
    if cached is not None and _trip_live_search_in_cooldown(db, trip_plan_id):
        payload, stale = cached
        return _flights_from_cache(payload, trip, trip_type=effective, stale=stale)

    params = _base_serp_params(trip, origin, dest, effective)
    try:
        raw = serpapi_search(db, user, params)
        offers, search_url, source = _parse_search_payload(raw, trip, trip_type=effective, fallback_url=fallback_url)
    except SerpApiUnavailable as exc:
        if cached is not None:
            payload, stale = cached
            return _flights_from_cache(
                payload,
                trip,
                trip_type=effective,
                stale=True,
                refresh_failed=True,
            )
        return _unavailable_flights(trip, trip_type=effective, reason=exc.reason, origin=origin, dest=dest)
    except SerpApiFlightPayloadError:
        if cached is not None:
            payload, stale = cached
            return _flights_from_cache(
                payload,
                trip,
                trip_type=effective,
                stale=True,
                refresh_failed=True,
            )
        return _unavailable_flights(trip, trip_type=effective, reason="error", origin=origin, dest=dest)

    if not offers:
        cache_payload = _cache_payload_no_results(trip, effective, fallback_url)
        put_cached(db, trip_plan_id, kind, key, cache_payload)
        db.commit()
        return _flights_from_cache(cache_payload, trip, trip_type=effective, stale=False)

    fetched_at = datetime.now(timezone.utc)
    cache_payload = {
        "offers": offers,
        "search_url": search_url,
        "source": source,
        "fetched_at": fetched_at.isoformat(),
    }
    put_cached(db, trip_plan_id, kind, key, cache_payload)
    db.commit()

    return FlightsResponse(
        offers=[_public_offer(o) for o in offers],
        search_url=search_url,
        source=source,
        unavailable_reason=None,
        trip_type=effective,
        origin_airport=origin,
        destination_airport=dest,
        traveler_count=_traveler_count(trip),
        fetched_at=fetched_at,
        stale=False,
        refresh_failed=False,
    )


def _find_outbound_offer(payload: dict[str, Any], offer_id: str) -> dict[str, Any] | None:
    for item in payload.get("offers") or []:
        if str(item.get("id")) == offer_id:
            return item
    return None


def search_returns(db: Session, user: User, trip_plan_id: int, offer_id: str) -> FlightsResponse:
    trip = get_owned_trip(db, user, trip_plan_id)
    if not trip.include_flights:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Flights not requested for this trip")

    effective = "round"
    origin, dest = trip.origin_airport, trip.destination_airport
    fallback_url = _trip_fallback_search_url(trip, effective, origin, dest)

    if not origin or not dest:
        airport_reason = _saved_airport_unavailable_reason(trip) or "no_airport"
        return _unavailable_flights(trip, trip_type=effective, reason=airport_reason, origin=origin, dest=dest)

    base_key = _flight_cache_key(trip, origin, dest, effective)
    outbound_cached = get_cached(db, trip_plan_id, "flights_round", base_key)
    if outbound_cached is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outbound offer not found")
    outbound_payload, outbound_stale = outbound_cached
    if outbound_stale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outbound offer not found")
    outbound_offer = _find_outbound_offer(outbound_payload, offer_id)
    if outbound_offer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outbound offer not found")

    departure_token = outbound_offer.get("departure_token")
    if not isinstance(departure_token, str) or not departure_token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outbound offer not found")

    return_key = cache_key_digest(f"{base_key}|{offer_id}")
    cached = get_cached(db, trip_plan_id, "flights_return", return_key)
    if cached is not None:
        payload, stale = cached
        return _flights_from_cache(payload, trip, trip_type=effective, stale=stale)

    airport_reason = _sync_trip_airports(db, trip)
    origin, dest = trip.origin_airport, trip.destination_airport
    if airport_reason or not origin or not dest:
        return _unavailable_flights(
            trip,
            trip_type=effective,
            reason=airport_reason or "no_airport",
            origin=origin,
            dest=dest,
        )

    params = {**_base_serp_params(trip, origin, dest, effective), "departure_token": departure_token}
    try:
        raw = serpapi_search(db, user, params)
        offers, search_url, source = _parse_search_payload(raw, trip, trip_type=effective, fallback_url=fallback_url)
    except SerpApiUnavailable as exc:
        return _unavailable_flights(trip, trip_type=effective, reason=exc.reason, origin=origin, dest=dest)
    except SerpApiFlightPayloadError:
        return _unavailable_flights(trip, trip_type=effective, reason="error", origin=origin, dest=dest)

    if not offers:
        cache_payload = _cache_payload_no_results(trip, effective, fallback_url)
        put_cached(db, trip_plan_id, "flights_return", return_key, cache_payload)
        db.commit()
        return _flights_from_cache(cache_payload, trip, trip_type=effective, stale=False)

    fetched_at = datetime.now(timezone.utc)
    cache_payload = {
        "offers": offers,
        "search_url": search_url,
        "source": source,
        "fetched_at": fetched_at.isoformat(),
    }
    put_cached(db, trip_plan_id, "flights_return", return_key, cache_payload)
    db.commit()

    return FlightsResponse(
        offers=[_public_offer(o) for o in offers],
        search_url=search_url,
        source=source,
        unavailable_reason=None,
        trip_type=effective,
        origin_airport=origin,
        destination_airport=dest,
        traveler_count=_traveler_count(trip),
        fetched_at=fetched_at,
        stale=False,
        refresh_failed=False,
    )


def _find_booking_token(
    db: Session,
    trip: TripPlan,
    trip_plan_id: int,
    offer_id: str,
) -> tuple[str, str] | None:
    """Return (booking_token, trip_type for serp) from a fresh cache row under the current key."""
    origin = trip.origin_airport
    dest = trip.destination_airport
    if not origin or not dest:
        return None

    one_way_key = _flight_cache_key(trip, origin, dest, "one_way")
    one_way = get_cached(db, trip_plan_id, "flights_one_way", one_way_key)
    if one_way is not None:
        payload, stale = one_way
        if not stale:
            offer = _find_outbound_offer(payload, offer_id)
            token = offer.get("booking_token") if offer else None
            if isinstance(token, str) and token:
                return token, "one_way"

    round_key = _flight_cache_key(trip, origin, dest, "round")
    round_cached = get_cached(db, trip_plan_id, "flights_round", round_key)
    if round_cached is not None:
        outbound_payload, stale = round_cached
        if not stale:
            offer = _find_outbound_offer(outbound_payload, offer_id)
            token = offer.get("booking_token") if offer else None
            if isinstance(token, str) and token:
                return token, "round"
            for outbound in outbound_payload.get("offers") or []:
                outbound_id = outbound.get("id")
                if not outbound_id:
                    continue
                return_key = cache_key_digest(f"{round_key}|{outbound_id}")
                return_cached = get_cached(db, trip_plan_id, "flights_return", return_key)
                if return_cached is None:
                    continue
                return_payload, return_stale = return_cached
                if return_stale:
                    continue
                ret_offer = _find_outbound_offer(return_payload, offer_id)
                token = ret_offer.get("booking_token") if ret_offer else None
                if isinstance(token, str) and token:
                    return token, "round"
    return None


def _booking_price_label(price_val: object, trip: TripPlan) -> str:
    travelers = _traveler_count(trip)
    t_label = f"{travelers} traveler{'s' if travelers != 1 else ''}, total"
    if price_val is None:
        return f"SAR — · {t_label}"
    amount = int(price_val) if isinstance(price_val, (int, float)) and float(price_val).is_integer() else price_val
    return f"SAR {amount} · {t_label}"


def _parse_booking_options(data: dict[str, Any], fallback_url: str, trip: TripPlan) -> BookingResponse:
    options: list[BookingOptionPublic] = []
    for entry in data.get("booking_options") or []:
        together = entry.get("together") or {}
        booking_request = together.get("booking_request") or {}
        url = booking_request.get("url")
        post_data = booking_request.get("post_data")
        if not url or not post_data:
            continue
        provider = str(together.get("book_with") or "Provider")
        price_val = together.get("price")
        price = _booking_price_label(price_val, trip)
        options.append(
            BookingOptionPublic(
                provider=provider,
                price=price,
                url=str(url),
                post_data=str(post_data),
            )
        )
    meta = data.get("search_metadata") or {}
    meta_url = meta.get("google_flights_url")
    resolved_fallback = meta_url if isinstance(meta_url, str) and meta_url.strip() else fallback_url
    return BookingResponse(options=options, fallback_url=resolved_fallback)


def _booking_unavailable(trip: TripPlan, reason: str) -> BookingResponse:
    fallback_url = _trip_fallback_search_url(
        trip,
        "round" if _return_date(trip) else "one_way",
        trip.origin_airport,
        trip.destination_airport,
    )
    return BookingResponse(
        options=[],
        fallback_url=fallback_url,
        unavailable=True,
        unavailable_reason=reason,
    )


def booking_options(db: Session, user: User, trip_plan_id: int, offer_id: str) -> BookingResponse:
    trip = get_owned_trip(db, user, trip_plan_id)
    if not trip.include_flights:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Flights not requested for this trip")

    origin, dest = trip.origin_airport, trip.destination_airport
    fallback_url = _trip_fallback_search_url(
        trip,
        "round" if _return_date(trip) else "one_way",
        origin,
        dest,
    )
    airport_reason = _saved_airport_unavailable_reason(trip)
    if airport_reason:
        return _booking_unavailable(trip, airport_reason)

    token_info = _find_booking_token(db, trip, trip_plan_id, offer_id)
    if token_info is None:
        return _booking_unavailable(trip, "refresh_needed")

    booking_token, serp_trip_type = token_info
    params = {**_base_serp_params(trip, origin or "", dest or "", serp_trip_type), "booking_token": booking_token}
    try:
        raw = serpapi_search(db, user, params)
    except SerpApiUnavailable as exc:
        return _booking_unavailable(trip, exc.reason)

    return _parse_booking_options(raw, fallback_url, trip)


# ponytail: self-check for offer id hashing
assert _token_offer_id("tok") == hashlib.sha1(b"tok").hexdigest()[:16]
