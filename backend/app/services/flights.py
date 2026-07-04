"""Flight search via Duffel sandbox with mock + Google Flights deep-link fallback."""

from __future__ import annotations

import json
import logging
import re
from datetime import date, timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.trip_plan import TripPlan
from app.models.user import User
from app.schemas.trip import FlightOfferPublic, FlightSegmentPublic, FlightsResponse
from app.services.itinerary import _get_trip_for_user

logger = logging.getLogger(__name__)

DUFFEL_API_BASE = "https://api.duffel.com"
DUFFEL_VERSION = "v2"
MAX_OFFERS = 4


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


def _looks_like_iata(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z]{3}", value.strip()))


def _resolve_place_code(place_name: str) -> str | None:
    cleaned = place_name.strip()
    if not cleaned:
        return None
    if _looks_like_iata(cleaned):
        return cleaned.upper()

    if not duffel_configured():
        return None

    try:
        payload = _duffel_request(
            "GET",
            "/places/suggestions",
            params={"query": cleaned},
        )
    except Exception as exc:
        logger.warning("Duffel place lookup failed for %r: %s", cleaned, exc)
        return None

    for item in payload.get("data") or []:
        code = item.get("iata_code")
        if isinstance(code, str) and code:
            return code.upper()
        for airport in item.get("airports") or []:
            airport_code = airport.get("iata_code")
            if isinstance(airport_code, str) and airport_code:
                return airport_code.upper()
    return None


def _default_departure_date(trip: TripPlan) -> date:
    if trip.start_date:
        return trip.start_date
    return date.today() + timedelta(days=30)


def _google_flights_url(
    origin: str,
    destination: str,
    depart: date,
    return_date: date | None,
    adults: int,
) -> str:
    parts = [f"Flights from {origin} to {destination} on {depart.isoformat()}"]
    if return_date:
        parts.append(f"return {return_date.isoformat()}")
    if adults > 1:
        parts.append(f"{adults} adults")
    return f"https://www.google.com/travel/flights?q={quote(' '.join(parts))}"


def _format_duration(minutes: int | None) -> str | None:
    if minutes is None or minutes <= 0:
        return None
    hours, mins = divmod(minutes, 60)
    if hours and mins:
        return f"{hours}h {mins}m"
    if hours:
        return f"{hours}h"
    return f"{mins}m"


def _segment_from_duffel_slice(slice_data: dict, origin_label: str, dest_label: str) -> FlightSegmentPublic:
    segments = slice_data.get("segments") or []
    first = segments[0] if segments else {}
    last = segments[-1] if segments else first
    origin = first.get("origin") or {}
    destination = last.get("destination") or {}
    marketing = first.get("marketing_carrier") or first.get("operating_carrier") or {}
    airline = marketing.get("name") or "Airline"
    return FlightSegmentPublic(
        origin=origin.get("city_name") or origin.get("name") or origin_label,
        origin_code=origin.get("iata_code") or "",
        destination=destination.get("city_name") or destination.get("name") or dest_label,
        destination_code=destination.get("iata_code") or "",
        departure_at=first.get("departing_at"),
        arrival_at=last.get("arriving_at"),
        duration=_format_duration(slice_data.get("duration")),
        airline=airline,
        stops=max(0, len(segments) - 1),
    )


def _offer_from_duffel(
    offer: dict,
    origin_label: str,
    dest_label: str,
    search_url: str,
) -> FlightOfferPublic:
    slices = offer.get("slices") or []
    outbound = _segment_from_duffel_slice(slices[0], origin_label, dest_label) if slices else None
    inbound = (
        _segment_from_duffel_slice(slices[1], dest_label, origin_label)
        if len(slices) > 1
        else None
    )
    owner = offer.get("owner") or {}
    total = offer.get("total_amount") or "0"
    currency = offer.get("total_currency") or "USD"
    try:
        amount = float(total)
    except (TypeError, ValueError):
        amount = None
    price_display = f"{currency} {total}" if currency else str(total)
    airline = owner.get("name") or (outbound.airline if outbound else "Airline")
    return FlightOfferPublic(
        id=str(offer.get("id") or ""),
        airline=airline,
        price=price_display,
        price_amount=amount,
        currency=currency,
        outbound=outbound
        or FlightSegmentPublic(
            origin=origin_label,
            origin_code="",
            destination=dest_label,
            destination_code="",
            airline=airline,
        ),
        inbound=inbound,
        booking_url=search_url,
    )


def _mock_offers(
    trip: TripPlan,
    origin_code: str,
    dest_code: str,
    search_url: str,
) -> list[FlightOfferPublic]:
    origin = trip.origin or origin_code
    destination = trip.destination or dest_code
    tier = (trip.budget_tier or "mid").lower()
    base_prices = {"budget": (320, 410), "mid": (480, 620), "luxury": (890, 1240)}
    low, high = base_prices.get(tier, base_prices["mid"])
    carriers = [
        ("Duffel Airways", low, "6h 15m", 0),
        ("SkyConnect", low + 45, "7h 40m", 1),
        ("Global Wings", high, "5h 50m", 0),
    ]
    offers: list[FlightOfferPublic] = []
    for idx, (airline, price, duration, stops) in enumerate(carriers):
        offers.append(
            FlightOfferPublic(
                id=f"mock-{idx}",
                airline=airline,
                price=f"USD {price}",
                price_amount=float(price),
                currency="USD",
                outbound=FlightSegmentPublic(
                    origin=origin,
                    origin_code=origin_code,
                    destination=destination,
                    destination_code=dest_code,
                    departure_at=None,
                    arrival_at=None,
                    duration=duration,
                    airline=airline,
                    stops=stops,
                ),
                inbound=None,
                booking_url=search_url,
            )
        )
    return offers


def _search_duffel(
    trip: TripPlan,
    origin_code: str,
    dest_code: str,
    depart: date,
    return_date: date | None,
) -> list[FlightOfferPublic]:
    passengers: list[dict] = [{"type": "adult"} for _ in range(max(1, trip.num_adults))]
    passengers.extend({"age": 10} for _ in range(max(0, trip.num_children)))

    slices = [
        {
            "origin": origin_code,
            "destination": dest_code,
            "departure_date": depart.isoformat(),
        }
    ]
    if return_date:
        slices.append(
            {
                "origin": dest_code,
                "destination": origin_code,
                "departure_date": return_date.isoformat(),
            }
        )

    payload = _duffel_request(
        "POST",
        "/air/offer_requests",
        body={
            "data": {
                "cabin_class": "economy",
                "slices": slices,
                "passengers": passengers,
            }
        },
        params={"return_offers": "true", "supplier_timeout": "20000"},
    )
    data = payload.get("data") or {}
    offers = data.get("offers") or []
    search_url = _google_flights_url(
        trip.origin or origin_code,
        trip.destination or dest_code,
        depart,
        return_date,
        max(1, trip.num_adults),
    )
    origin_label = trip.origin or origin_code
    dest_label = trip.destination or dest_code
    parsed = [
        _offer_from_duffel(offer, origin_label, dest_label, search_url)
        for offer in offers[:MAX_OFFERS]
    ]
    return parsed


def search_flights(db: Session, user: User, trip_plan_id: int) -> FlightsResponse:
    trip = _get_trip_for_user(db, user, trip_plan_id)
    if not trip.include_flights:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Flights not requested for this trip")

    origin_name = (trip.origin or "").strip()
    dest_name = (trip.destination or "").strip()
    if not dest_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trip destination is required")

    depart = _default_departure_date(trip)
    return_date = trip.end_date if trip.end_date and trip.end_date > depart else None

    origin_code = _resolve_place_code(origin_name) if origin_name else None
    dest_code = _resolve_place_code(dest_name)
    search_url = _google_flights_url(
        origin_name or origin_code or "origin",
        dest_name,
        depart,
        return_date,
        max(1, trip.num_adults),
    )

    if not origin_code or not dest_code:
        reason = "Could not resolve airport codes for origin or destination"
        return FlightsResponse(
            offers=_mock_offers(trip, origin_code or "RUH", dest_code or "DXB", search_url),
            search_url=search_url,
            source="mock",
            fallback_reason=reason,
            origin_code=origin_code,
            destination_code=dest_code,
        )

    if duffel_configured():
        try:
            offers = _search_duffel(trip, origin_code, dest_code, depart, return_date)
            if offers:
                return FlightsResponse(
                    offers=offers,
                    search_url=search_url,
                    source="duffel",
                    fallback_reason=None,
                    origin_code=origin_code,
                    destination_code=dest_code,
                )
            fallback_reason = "Duffel returned no offers for this route"
        except Exception as exc:
            fallback_reason = f"{type(exc).__name__}: {exc}"
            logger.warning("Duffel flight search failed: %s", fallback_reason)
    else:
        fallback_reason = "DUFFEL_ACCESS_TOKEN not configured"

    return FlightsResponse(
        offers=_mock_offers(trip, origin_code, dest_code, search_url),
        search_url=search_url,
        source="mock",
        fallback_reason=fallback_reason,
        origin_code=origin_code,
        destination_code=dest_code,
    )
