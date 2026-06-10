import json
import logging
import math
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import urlopen

from sqlalchemy.orm import Session

from app.config import settings
from app.models.place import Place
from app.models.trip_plan import TripPlan

logger = logging.getLogger(__name__)

MAPBOX_GEOCODE_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places"

# Common destination countries for FYP demos — extend as needed.
COUNTRY_NAME_TO_CODE: dict[str, str] = {
    "greece": "gr",
    "italy": "it",
    "spain": "es",
    "france": "fr",
    "germany": "de",
    "united kingdom": "gb",
    "uk": "gb",
    "portugal": "pt",
    "turkey": "tr",
    "türkiye": "tr",
    "egypt": "eg",
    "morocco": "ma",
    "japan": "jp",
    "south korea": "kr",
    "korea": "kr",
    "china": "cn",
    "thailand": "th",
    "vietnam": "vn",
    "indonesia": "id",
    "malaysia": "my",
    "singapore": "sg",
    "india": "in",
    "uae": "ae",
    "united arab emirates": "ae",
    "saudi arabia": "sa",
    "qatar": "qa",
    "jordan": "jo",
    "lebanon": "lb",
    "usa": "us",
    "united states": "us",
    "united states of america": "us",
    "canada": "ca",
    "mexico": "mx",
    "brazil": "br",
    "argentina": "ar",
    "chile": "cl",
    "peru": "pe",
    "colombia": "co",
    "australia": "au",
    "new zealand": "nz",
    "south africa": "za",
    "kenya": "ke",
    "netherlands": "nl",
    "belgium": "be",
    "switzerland": "ch",
    "austria": "at",
    "czech republic": "cz",
    "czechia": "cz",
    "poland": "pl",
    "hungary": "hu",
    "croatia": "hr",
    "iceland": "is",
    "norway": "no",
    "sweden": "se",
    "denmark": "dk",
    "finland": "fi",
    "ireland": "ie",
    "scotland": "gb",
    "england": "gb",
}

MAX_DISTANCE_KM_FROM_DESTINATION = 120.0
# Prefer pins at least this far apart so the map isn't a single cluster.
MIN_PLACE_SEPARATION_M = 450.0


def mapbox_configured() -> bool:
    return bool(settings.mapbox_access_token)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def _destination_context(destination: str) -> dict:
    parts = [part.strip() for part in destination.split(",") if part.strip()]
    city = parts[0] if parts else destination.strip()
    country_name = parts[-1].lower() if len(parts) > 1 else ""
    country_code = COUNTRY_NAME_TO_CODE.get(country_name)

    return {
        "city": city,
        "country_name": country_name,
        "country_code": country_code,
        "full": destination.strip(),
    }


def _mapbox_geocode(encoded_query: str, extra_params: str = "", *, limit: int = 5) -> dict | None:
    if not mapbox_configured() or not encoded_query:
        return None

    token = settings.mapbox_access_token
    url = f"{MAPBOX_GEOCODE_URL}/{encoded_query}.json?access_token={token}&limit={limit}"
    if extra_params:
        url += f"&{extra_params}"

    try:
        with urlopen(url, timeout=10) as response:
            return json.loads(response.read().decode())
    except (HTTPError, URLError, json.JSONDecodeError, TimeoutError) as exc:
        logger.warning("Mapbox geocoding request failed: %s", exc)
        return None


def _distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    return _haversine_km(lat1, lng1, lat2, lng2) * 1000.0


def _too_close_to_any(
    lat: float,
    lng: float,
    others: list[tuple[float, float]],
    min_separation_m: float,
) -> bool:
    return any(_distance_m(lat, lng, other_lat, other_lng) < min_separation_m for other_lat, other_lng in others)


def _pick_feature(
    features: list,
    *,
    proximity: tuple[float, float] | None,
    country_code: str | None,
    max_distance_km: float | None,
    avoid_points: list[tuple[float, float]] | None = None,
    min_separation_m: float = MIN_PLACE_SEPARATION_M,
) -> tuple[float, float] | None:
    valid: list[tuple[float, float]] = []

    for feature in features:
        center = feature.get("center")
        if not isinstance(center, list) or len(center) < 2:
            continue

        if country_code:
            context = feature.get("context", [])
            feature_country = None
            for item in context:
                if isinstance(item, dict) and item.get("id", "").startswith("country."):
                    feature_country = item.get("short_code", "").lower()
                    break
            if feature_country and feature_country != country_code.lower():
                continue

        lng, lat = float(center[0]), float(center[1])

        if proximity is not None and max_distance_km is not None:
            dist = _haversine_km(proximity[1], proximity[0], lat, lng)
            if dist > max_distance_km:
                continue

        valid.append((lat, lng))

    if not valid:
        return None

    if avoid_points:
        for lat, lng in valid:
            if not _too_close_to_any(lat, lng, avoid_points, min_separation_m):
                return lat, lng
        # All candidates cluster together — keep the best match rather than failing.
        return valid[0]

    return valid[0]


def geocode_query(
    query: str,
    *,
    proximity: tuple[float, float] | None = None,
    country_code: str | None = None,
    types: str | None = None,
    max_distance_km: float | None = None,
    avoid_points: list[tuple[float, float]] | None = None,
) -> tuple[float, float] | None:
    """Return (latitude, longitude) for a place search query."""
    encoded = quote(query.strip(), safe="")
    if not encoded:
        return None

    params: list[str] = []
    if proximity is not None:
        lng, lat = proximity
        params.append(f"proximity={lng},{lat}")
    if country_code:
        params.append(f"country={country_code.lower()}")
    if types:
        params.append(f"types={quote(types, safe=',')}")

    payload = _mapbox_geocode(encoded, "&".join(params), limit=5)
    if not payload:
        return None

    return _pick_feature(
        payload.get("features", []),
        proximity=proximity,
        country_code=country_code,
        max_distance_km=max_distance_km,
        avoid_points=avoid_points,
    )


def search_places(query: str, *, limit: int = 5) -> list[dict]:
    """Search cities/places for origin autocomplete."""
    encoded = quote(query.strip(), safe="")
    if len(query.strip()) < 2:
        return []

    extra = "types=place,locality,region&autocomplete=true"
    payload = _mapbox_geocode(encoded, extra, limit=limit)
    if not payload:
        return []

    results: list[dict] = []
    for feature in payload.get("features", []):
        center = feature.get("center")
        if not isinstance(center, list) or len(center) < 2:
            continue
        lng, lat = float(center[0]), float(center[1])
        label = feature.get("place_name") or feature.get("text") or ""
        if not label:
            continue
        results.append(
            {
                "label": label,
                "latitude": lat,
                "longitude": lng,
            }
        )
    return results


def _coords_valid_for_trip(
    lat: float,
    lng: float,
    dest_center: tuple[float, float] | None,
    country_code: str | None,
) -> bool:
    if dest_center is None:
        return True
    dist = _haversine_km(dest_center[1], dest_center[0], lat, lng)
    if dist > MAX_DISTANCE_KM_FROM_DESTINATION:
        return False
    return True


def _geocode_place_name(
    place_name: str,
    destination: str,
    dest_context: dict,
    dest_center: tuple[float, float] | None,
    *,
    avoid_points: list[tuple[float, float]] | None = None,
) -> tuple[float, float] | None:
    country_code = dest_context.get("country_code")
    city = dest_context.get("city") or ""
    full = dest_context.get("full") or destination

    queries = [
        f"{place_name}, {full}",
        f"{place_name}, {city}, {dest_context.get('country_name', '').title()}".strip(", "),
        f"{place_name}, {city}",
        place_name,
    ]

    for query in queries:
        if not query.strip():
            continue
        coords = geocode_query(
            query,
            proximity=dest_center,
            country_code=country_code,
            types="poi,place,address,locality,neighborhood",
            max_distance_km=MAX_DISTANCE_KM_FROM_DESTINATION,
            avoid_points=avoid_points,
        )
        if coords:
            return coords

    return None


def places_need_spacing_refresh(places: list[Place]) -> bool:
    """True when any two geocoded places are closer than MIN_PLACE_SEPARATION_M."""
    coords = [
        (place.latitude, place.longitude)
        for place in places
        if place.latitude is not None and place.longitude is not None
    ]
    for index, (lat1, lng1) in enumerate(coords):
        for lat2, lng2 in coords[index + 1 :]:
            if _distance_m(lat1, lng1, lat2, lng2) < MIN_PLACE_SEPARATION_M:
                return True
    return False


def enrich_trip_places(db: Session, trip: TripPlan, places: list[Place] | None = None) -> int:
    """Backfill latitude/longitude on itinerary places via Mapbox."""
    if not mapbox_configured():
        return 0

    target_places = places if places is not None else list(trip.places)
    if not target_places:
        return 0

    destination = trip.destination or ""
    dest_context = _destination_context(destination)
    dest_center: tuple[float, float] | None = None

    if destination:
        dest_coords = geocode_query(
            destination,
            country_code=dest_context.get("country_code"),
            types="place,locality,region",
        )
        if dest_coords:
            dest_center = (dest_coords[1], dest_coords[0])

    assigned: list[tuple[float, float]] = [
        (place.latitude, place.longitude)
        for place in target_places
        if place.latitude is not None and place.longitude is not None
    ]

    updated = 0
    for place in target_places:
        others = [
            coords
            for coords in assigned
            if not (
                place.latitude is not None
                and place.longitude is not None
                and coords[0] == place.latitude
                and coords[1] == place.longitude
            )
        ]

        needs_geocode = place.latitude is None or place.longitude is None
        if not needs_geocode and dest_center is not None:
            needs_geocode = not _coords_valid_for_trip(
                place.latitude,
                place.longitude,
                dest_center,
                dest_context.get("country_code"),
            )
        if (
            not needs_geocode
            and place.latitude is not None
            and place.longitude is not None
            and _too_close_to_any(place.latitude, place.longitude, others, MIN_PLACE_SEPARATION_M)
        ):
            needs_geocode = True

        if not needs_geocode:
            continue

        coords = _geocode_place_name(
            place.name,
            destination,
            dest_context,
            dest_center,
            avoid_points=others,
        )
        if coords is None:
            logger.info("Could not geocode place %r for trip %s", place.name, trip.id)
            continue

        if place.latitude is not None and place.longitude is not None:
            assigned = [
                c
                for c in assigned
                if not (c[0] == place.latitude and c[1] == place.longitude)
            ]

        place.latitude, place.longitude = coords
        assigned.append(coords)
        updated += 1
        time.sleep(0.05)

    if updated:
        db.commit()

    return updated
