"""Mock hotel suggestions with Booking.com deep-links."""

from __future__ import annotations

from datetime import date, timedelta
from urllib.parse import quote

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.trip import HotelOptionPublic, HotelsResponse
from app.services.itinerary import _get_trip_for_user

HOTEL_BLUEPRINTS: dict[str, list[dict]] = {
    "budget": [
        {
            "suffix": "Central Hostel",
            "area": "City center",
            "stars": 2,
            "nightly": (45, 65),
            "amenities": ["Free Wi‑Fi", "Shared kitchen", "24h reception"],
        },
        {
            "suffix": "Inn & Suites",
            "area": "Near transit",
            "stars": 3,
            "nightly": (58, 78),
            "amenities": ["Breakfast", "Air conditioning", "Luggage storage"],
        },
        {
            "suffix": "Budget Stay",
            "area": "Old town",
            "stars": 2,
            "nightly": (40, 55),
            "amenities": ["Wi‑Fi", "Walkable location", "Front desk"],
        },
    ],
    "mid": [
        {
            "suffix": "Boutique Hotel",
            "area": "Historic quarter",
            "stars": 4,
            "nightly": (95, 130),
            "amenities": ["Restaurant", "Fitness room", "City views"],
        },
        {
            "suffix": "City Hotel",
            "area": "Downtown",
            "stars": 4,
            "nightly": (110, 145),
            "amenities": ["Breakfast included", "Rooftop bar", "Concierge"],
        },
        {
            "suffix": "Garden Residence",
            "area": "Quiet district",
            "stars": 3,
            "nightly": (85, 115),
            "amenities": ["Garden terrace", "Room service", "Parking"],
        },
    ],
    "luxury": [
        {
            "suffix": "Grand Palace",
            "area": "Waterfront",
            "stars": 5,
            "nightly": (220, 310),
            "amenities": ["Spa", "Fine dining", "Pool"],
        },
        {
            "suffix": "Luxury Collection",
            "area": "Premium district",
            "stars": 5,
            "nightly": (280, 390),
            "amenities": ["Butler service", "Infinity pool", "Michelin dining"],
        },
        {
            "suffix": "Resort & Spa",
            "area": "Scenic outskirts",
            "stars": 5,
            "nightly": (195, 275),
            "amenities": ["Spa treatments", "Private beach access", "Airport shuttle"],
        },
    ],
}


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


def _hotel_booking_url(hotel_name: str, destination: str, check_in: date, check_out: date, adults: int) -> str:
    query = f"{hotel_name} {destination}"
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
    search_url = _booking_search_url(destination, check_in, check_out, adults)

    hotels: list[HotelOptionPublic] = []
    for idx, blueprint in enumerate(HOTEL_BLUEPRINTS[tier]):
        low, high = blueprint["nightly"]
        nightly = low + (idx * ((high - low) // 2 or 1))
        name = f"{destination} {blueprint['suffix']}"
        hotels.append(
            HotelOptionPublic(
                id=f"hotel-{idx}",
                name=name,
                area=blueprint["area"],
                stars=blueprint["stars"],
                price_per_night=_price_label(nightly),
                price_tier=tier,
                amenities=blueprint["amenities"],
                booking_url=_hotel_booking_url(name, destination, check_in, check_out, adults),
            )
        )

    return HotelsResponse(
        hotels=hotels,
        search_url=search_url,
        source="mock",
        check_in=check_in,
        check_out=check_out,
    )
