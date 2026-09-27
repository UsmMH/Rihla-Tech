"""Hotel suggestions via Mapbox lodging POI search with mock + Booking.com deep-link fallback."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from urllib.parse import quote

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.trip import HotelOptionPublic, HotelsResponse
from app.services.geocoding import search_lodging_hotels
from app.services.itinerary import _get_trip_for_user

logger = logging.getLogger(__name__)

MIN_MAPBOX_HOTELS = 3
MAPBOX_HOTEL_LIMIT = 3

HOTEL_BLUEPRINTS: dict[str, list[dict]] = {
    "budget": [
        {
            "name": "Urban Nest Hostel",
            "area": "City center",
            "stars": 2,
            "nightly": (45, 65),
            "amenities": ["Free Wi‑Fi", "Shared kitchen", "24h reception"],
        },
        {
            "name": "Travelers Lodge",
            "area": "Near transit",
            "stars": 3,
            "nightly": (58, 78),
            "amenities": ["Breakfast", "Air conditioning", "Luggage storage"],
        },
        {
            "name": "Old Town Inn",
            "area": "Old town",
            "stars": 2,
            "nightly": (40, 55),
            "amenities": ["Wi‑Fi", "Walkable location", "Front desk"],
        },
    ],
    "mid": [
        {
            "name": "The Courtyard Boutique",
            "area": "Historic quarter",
            "stars": 4,
            "nightly": (95, 130),
            "amenities": ["Restaurant", "Fitness room", "City views"],
        },
        {
            "name": "Harborview Hotel",
            "area": "Downtown",
            "stars": 4,
            "nightly": (110, 145),
            "amenities": ["Breakfast included", "Rooftop bar", "Concierge"],
        },
        {
            "name": "Garden Terrace Suites",
            "area": "Quiet district",
            "stars": 3,
            "nightly": (85, 115),
            "amenities": ["Garden terrace", "Room service", "Parking"],
        },
    ],
    "luxury": [
        {
            "name": "The Royal Crescent",
            "area": "Waterfront",
            "stars": 5,
            "nightly": (220, 310),
            "amenities": ["Spa", "Fine dining", "Pool"],
        },
        {
            "name": "Skyline Collection",
            "area": "Premium district",
            "stars": 5,
            "nightly": (280, 390),
            "amenities": ["Butler service", "Infinity pool", "Michelin dining"],
        },
        {
            "name": "Seaside Retreat & Spa",
            "area": "Scenic outskirts",
            "stars": 5,
            "nightly": (195, 275),
            "amenities": ["Spa treatments", "Private beach access", "Airport shuttle"],
        },
    ],
}

TIER_STARS: dict[str, list[int]] = {
    "budget": [2, 3, 2],
    "mid": [4, 4, 3],
    "luxury": [5, 5, 5],
}

TIER_AMENITIES: dict[str, list[list[str]]] = {
    "budget": [
        ["Free Wi‑Fi", "Central location"],
        ["Breakfast", "Air conditioning"],
        ["Walkable area", "Front desk"],
    ],
    "mid": [
        ["Restaurant", "Fitness room"],
        ["Breakfast included", "Concierge"],
        ["Room service", "Parking"],
    ],
    "luxury": [
        ["Spa", "Fine dining"],
        ["Pool", "Concierge"],
        ["Spa treatments", "Airport shuttle"],
    ],
}


def _destination_city_name(destination: str) -> str:
    parts = [part.strip() for part in destination.split(",") if part.strip()]
    return parts[0] if parts else destination.strip()


def _default_dates(trip) -> tuple[date, date]:
    check_in = trip.start_date or (date.today() + timedelta(days=30))
    check_out = trip.end_date or (check_in + timedelta(days=3))
    if check_out <= check_in:
        check_out = check_in + timedelta(days=1)
    return check_in, check_out


def _booking_search_url(destination: str, check_in: date, check_out: date, adults: int) -> str:
    params = (
        f"ss={quote(destination)}"
        f"&checkin={check_in.isoformat()}"
        f"&checkout={check_out.isoformat()}"
        f"&group_adults={max(1, adults)}"
        f"&no_rooms=1"
    )
    return f"https://www.booking.com/searchresults.html?{params}"


def _hotel_booking_url(hotel_name: str, city: str, check_in: date, check_out: date, adults: int) -> str:
    query = f"{hotel_name}, {city}"
    params = (
        f"ss={quote(query)}"
        f"&checkin={check_in.isoformat()}"
        f"&checkout={check_out.isoformat()}"
        f"&group_adults={max(1, adults)}"
        f"&no_rooms=1"
    )
    return f"https://www.booking.com/searchresults.html?{params}"


def _price_label(amount: int) -> str:
    return f"from ${amount}/night"


def _hotel_price_note(adults: int) -> str:
    guest_label = "guest" if adults == 1 else "guests"
    return f"Per room per night · {adults} {guest_label}"


def _tier_nightly_prices(tier: str) -> list[int]:
    blueprints = HOTEL_BLUEPRINTS.get(tier, HOTEL_BLUEPRINTS["mid"])
    prices: list[int] = []
    for idx, blueprint in enumerate(blueprints):
        low, high = blueprint["nightly"]
        prices.append(low + (idx * ((high - low) // 2 or 1)))
    return prices


def _mock_hotels(
    *,
    tier: str,
    city: str,
    check_in: date,
    check_out: date,
    adults: int,
    price_note: str,
) -> list[HotelOptionPublic]:
    hotels: list[HotelOptionPublic] = []
    for idx, blueprint in enumerate(HOTEL_BLUEPRINTS[tier]):
        low, high = blueprint["nightly"]
        nightly = low + (idx * ((high - low) // 2 or 1))
        name = blueprint["name"]
        hotels.append(
            HotelOptionPublic(
                id=f"hotel-{idx}",
                name=name,
                area=blueprint["area"],
                stars=blueprint["stars"],
                price_per_night=_price_label(nightly),
                price_note=price_note,
                price_tier=tier,
                amenities=blueprint["amenities"],
                booking_url=_hotel_booking_url(name, city, check_in, check_out, adults),
            )
        )
    return hotels


def _mapbox_hotels(
    lodging: list[dict],
    *,
    tier: str,
    city: str,
    check_in: date,
    check_out: date,
    adults: int,
    price_note: str,
) -> list[HotelOptionPublic]:
    stars_list = TIER_STARS.get(tier, TIER_STARS["mid"])
    amenities_list = TIER_AMENITIES.get(tier, TIER_AMENITIES["mid"])
    nightly_prices = _tier_nightly_prices(tier)

    hotels: list[HotelOptionPublic] = []
    for idx, item in enumerate(lodging[:MAPBOX_HOTEL_LIMIT]):
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        hotel_city = str(item.get("city") or city).strip()
        area = str(item.get("area") or "City center").strip()
        stars = stars_list[idx] if idx < len(stars_list) else stars_list[-1]
        amenities = amenities_list[idx] if idx < len(amenities_list) else amenities_list[-1]
        nightly = nightly_prices[idx] if idx < len(nightly_prices) else nightly_prices[-1]
        hotels.append(
            HotelOptionPublic(
                id=f"mapbox-{idx}",
                name=name,
                area=area,
                stars=stars,
                price_per_night=_price_label(nightly),
                price_note=price_note,
                price_tier=tier,
                amenities=amenities,
                booking_url=_hotel_booking_url(name, hotel_city, check_in, check_out, adults),
            )
        )
    return hotels


def search_hotels(db: Session, user: User, trip_plan_id: int) -> HotelsResponse:
    trip = _get_trip_for_user(db, user, trip_plan_id)
    if not trip.include_hotels:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Hotels not requested for this trip")

    destination = (trip.destination or "your destination").strip()
    if not destination:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trip destination is required")

    tier = (trip.budget_tier or "mid").lower()
    if tier not in HOTEL_BLUEPRINTS:
        tier = "mid"

    check_in, check_out = _default_dates(trip)
    adults = max(1, trip.num_adults)
    city = _destination_city_name(destination)
    search_url = _booking_search_url(destination, check_in, check_out, adults)
    price_note = _hotel_price_note(adults)

    source = "mock"
    hotels: list[HotelOptionPublic] = []

    try:
        lodging = search_lodging_hotels(destination, limit=MAPBOX_HOTEL_LIMIT)
        if len(lodging) >= MIN_MAPBOX_HOTELS:
            hotels = _mapbox_hotels(
                lodging,
                tier=tier,
                city=city,
                check_in=check_in,
                check_out=check_out,
                adults=adults,
                price_note=price_note,
            )
            if len(hotels) >= MIN_MAPBOX_HOTELS:
                source = "mapbox"
    except Exception as exc:
        logger.warning("Mapbox hotel search failed, using mock hotels: %s", exc)

    if len(hotels) < MIN_MAPBOX_HOTELS:
        hotels = _mock_hotels(
            tier=tier,
            city=city,
            check_in=check_in,
            check_out=check_out,
            adults=adults,
            price_note=price_note,
        )
        source = "mock"

    return HotelsResponse(
        hotels=hotels,
        search_url=search_url,
        source=source,
        check_in=check_in,
        check_out=check_out,
    )
