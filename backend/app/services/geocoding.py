import json
import logging
import math
import re
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
MAPBOX_SEARCHBOX_URL = "https://api.mapbox.com/search/searchbox/v1/forward"

# Reject pins essentially identical to the destination city center (bad Mapbox matches).
MIN_DEST_CENTER_SEPARATION_KM = 0.8

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

# Activities must land within this radius of the destination city center.
ACTIVITY_MAX_DISTANCE_KM = 40.0
MAX_DISTANCE_KM_FROM_DESTINATION = 120.0
# Minimum composite score (0–1) to accept a Mapbox match.
MIN_MATCH_SCORE = 0.38

STOP_WORDS = frozenset(
    {
        "a",
        "an",
        "and",
        "at",
        "by",
        "for",
        "in",
        "of",
        "on",
        "or",
        "the",
        "to",
        "with",
        "visit",
        "explore",
        "tour",
        "enjoy",
        "discover",
        "experience",
        "stroll",
        "walk",
        "see",
    }
)

# POI type tiers — try precise venues before broader place names.
GEOCODE_TYPE_TIERS = (
    "poi",
    "poi,address",
    "poi,address,place,locality",
)


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


def _mapbox_geocode(encoded_query: str, extra_params: str = "", *, limit: int = 8) -> dict | None:
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


def _reverse_country_code(lng: float, lat: float) -> str | None:
    encoded = quote(f"{lng},{lat}", safe="")
    payload = _mapbox_geocode(encoded, "types=country", limit=1)
    if not payload:
        return None
    for feature in payload.get("features", []):
        for item in feature.get("context", []):
            if isinstance(item, dict) and item.get("id", "").startswith("country."):
                code = item.get("short_code", "")
                return str(code).lower() if code else None
        if feature.get("id", "").startswith("country."):
            code = feature.get("properties", {}).get("short_code") or feature.get("short_code", "")
            return str(code).lower() if code else None
    return None


def _enrich_dest_context(dest_context: dict, dest_center: tuple[float, float] | None) -> dict:
    if dest_context.get("country_code") or dest_center is None:
        return dest_context
    lng, lat = dest_center
    code = _reverse_country_code(lng, lat)
    if not code:
        return dest_context
    enriched = dict(dest_context)
    enriched["country_code"] = code
    return enriched


def _feature_country(feature: dict) -> str | None:
    for item in feature.get("context", []):
        if isinstance(item, dict) and item.get("id", "").startswith("country."):
            code = item.get("short_code", "")
            return str(code).lower() if code else None
    if feature.get("id", "").startswith("country."):
        code = feature.get("properties", {}).get("short_code") or feature.get("short_code", "")
        return str(code).lower() if code else None
    return None


def _normalize_tokens(text: str) -> set[str]:
    tokens = {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) > 1}
    return tokens - STOP_WORDS


def _token_overlap(search: str, candidate: str) -> float:
    search_tokens = _normalize_tokens(search)
    if not search_tokens:
        return 0.0
    candidate_tokens = _normalize_tokens(candidate)
    if not candidate_tokens:
        return 0.0
    return len(search_tokens & candidate_tokens) / len(search_tokens)


def _resolve_destination_center(
    destination: str,
    dest_context: dict,
) -> tuple[tuple[float, float] | None, dict]:
    if not destination:
        return None, dest_context

    dest_coords = geocode_destination(destination, dest_context.get("country_code"))
    if dest_coords is None:
        return None, dest_context

    dest_center = (dest_coords[1], dest_coords[0])
    return dest_center, _enrich_dest_context(dest_context, dest_center)


def geocode_destination(
    destination: str,
    country_code: str | None = None,
) -> tuple[float, float] | None:
    """Return (latitude, longitude) for a trip destination string."""
    encoded = quote(destination.strip(), safe="")
    if not encoded:
        return None

    params: list[str] = ["types=place,locality,region"]
    if country_code:
        params.append(f"country={country_code.lower()}")

    payload = _mapbox_geocode(encoded, "&".join(params), limit=5)
    if not payload:
        return None

    for feature in payload.get("features", []):
        center = feature.get("center")
        if not isinstance(center, list) or len(center) < 2:
            continue
        if country_code:
            feature_country = _feature_country(feature)
            if feature_country and feature_country != country_code.lower():
                continue
        lng, lat = float(center[0]), float(center[1])
        return lat, lng
    return None


def _is_mostly_non_latin(text: str) -> bool:
    letters = [char for char in text if char.isalpha()]
    if not letters:
        return False
    non_ascii = sum(1 for char in letters if ord(char) > 127)
    return (non_ascii / len(letters)) > 0.5


def _feature_locality_names(feature: dict) -> set[str]:
    names: set[str] = set()
    for item in feature.get("context", []):
        if not isinstance(item, dict):
            continue
        item_id = item.get("id", "")
        if item_id.startswith("place.") or item_id.startswith("locality.") or item_id.startswith("neighborhood."):
            text = str(item.get("text", "")).strip().lower()
            if text:
                names.add(text)
    return names


def _coords_from_activity_payload(
    activity: dict,
    dest_center: tuple[float, float] | None,
) -> tuple[float, float] | None:
    lat_raw = activity.get("latitude")
    lng_raw = activity.get("longitude")
    if lat_raw is None or lng_raw is None:
        return None
    try:
        lat, lng = float(lat_raw), float(lng_raw)
    except (TypeError, ValueError):
        return None
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
        return None
    if dest_center is not None:
        dist = _haversine_km(dest_center[1], dest_center[0], lat, lng)
        if dist > ACTIVITY_MAX_DISTANCE_KM:
            return None
    return lat, lng


def _score_feature(
    feature: dict,
    *,
    search_name: str,
    dest_center: tuple[float, float],
    max_distance_km: float,
    country_code: str | None,
    dest_city: str | None = None,
) -> float | None:
    center = feature.get("center")
    if not isinstance(center, list) or len(center) < 2:
        return None

    if country_code:
        feature_country = _feature_country(feature)
        if feature_country and feature_country != country_code.lower():
            return None

    lng, lat = float(center[0]), float(center[1])
    dist_km = _haversine_km(dest_center[1], dest_center[0], lat, lng)
    if dist_km > max_distance_km:
        return None
    if _too_close_to_dest_center(lat, lng, dest_center):
        return None

    relevance = float(feature.get("relevance", 0))
    label = feature.get("place_name") or feature.get("text") or ""
    overlap = _token_overlap(search_name, label)

    if relevance < 0.35 and overlap < 0.25:
        return None

    place_types = feature.get("place_type") or []
    if place_types in (["locality"], ["place"]) or place_types == ["address"]:
        return None
    poi_bonus = 0.12 if "poi" in place_types else 0.0

    dist_penalty = (dist_km / max_distance_km) * 0.15
    dest_city_lower = (dest_city or "").lower()

    localities = _feature_locality_names(feature)
    if dest_city_lower and dest_city_lower in label.lower():
        locality_bonus = 0.12
    elif dest_city_lower and dest_city_lower in localities:
        locality_bonus = 0.1
    else:
        locality_bonus = 0.0

    if _is_mostly_non_latin(label):
        # Mapbox often returns Arabic labels; trust relevance + distance near destination.
        score = (relevance * 0.65) + poi_bonus + locality_bonus - dist_penalty
        if relevance >= 0.85 and dist_km < 15.0:
            score += 0.06
        return score

    score = (relevance * 0.4) + (overlap * 0.45) + poi_bonus + locality_bonus - dist_penalty
    return score


def _fetch_features(
    query: str,
    *,
    dest_center: tuple[float, float],
    country_code: str | None,
    types: str,
) -> list[dict]:
    encoded = quote(query.strip(), safe="")
    if not encoded:
        return []

    lng, lat = dest_center
    params = [
        f"proximity={lng},{lat}",
        f"types={quote(types, safe=',')}",
    ]
    if country_code:
        params.append(f"country={country_code.lower()}")

    payload = _mapbox_geocode(encoded, "&".join(params), limit=8)
    if not payload:
        return []
    return payload.get("features", [])


def _best_coords_from_features(
    features: list[dict],
    *,
    search_name: str,
    dest_center: tuple[float, float],
    max_distance_km: float,
    country_code: str | None,
    dest_city: str | None = None,
) -> tuple[float, float] | None:
    best_score = 0.0
    best_coords: tuple[float, float] | None = None

    for feature in features:
        score = _score_feature(
            feature,
            search_name=search_name,
            dest_center=dest_center,
            max_distance_km=max_distance_km,
            country_code=country_code,
            dest_city=dest_city,
        )
        if score is None or score < MIN_MATCH_SCORE:
            continue
        if score > best_score:
            center = feature["center"]
            lng, lat = float(center[0]), float(center[1])
            best_score = score
            best_coords = (lat, lng)

    return best_coords


def _search_queries(
    search_name: str,
    location_hint: str | None,
    dest_context: dict,
    destination: str,
) -> list[str]:
    city = dest_context.get("city") or ""
    country_label = dest_context.get("country_name", "").title()
    full = dest_context.get("full") or destination
    name = search_name.strip()
    hint = (location_hint or "").strip()

    queries: list[str] = []
    if hint:
        queries.append(f"{name}, {hint}, {city}".strip(", "))
    queries.append(f"{name}, {city}, {country_label}".strip(", "))
    queries.append(f"{name}, {full}")
    queries.append(f"{name}, {city}")

    seen: set[str] = set()
    unique: list[str] = []
    for query in queries:
        key = query.lower()
        if key not in seen and query.strip():
            seen.add(key)
            unique.append(query)
    return unique


def geocode_activity(
    search_name: str,
    *,
    location_hint: str | None,
    destination: str,
    dest_context: dict,
    dest_center: tuple[float, float],
) -> tuple[float, float] | None:
    """
    Resolve a single itinerary activity to coordinates.

    Uses scored POI matching — no artificial pin spreading; the map UI handles overlap.
    """
    country_code = dest_context.get("country_code")
    dest_city = dest_context.get("city")
    queries = _search_queries(search_name, location_hint, dest_context, destination)

    for types in GEOCODE_TYPE_TIERS:
        for query in queries:
            features = _fetch_features(
                query,
                dest_center=dest_center,
                country_code=country_code,
                types=types,
            )
            coords = _best_coords_from_features(
                features,
                search_name=search_name,
                dest_center=dest_center,
                max_distance_km=ACTIVITY_MAX_DISTANCE_KM,
                country_code=country_code,
                dest_city=dest_city,
            )
            if coords:
                return coords

    logger.info(
        "No confident Mapbox match for %r (hint=%r) near %s",
        search_name,
        location_hint,
        destination,
    )
    return None


def _searchbox_forward(
    query: str,
    *,
    proximity: tuple[float, float],
    country_code: str | None = None,
    limit: int = 5,
) -> list[dict]:
    """Mapbox Search Box API — better POI coverage than Geocoding v5."""
    if not mapbox_configured() or not query.strip():
        return []

    token = settings.mapbox_access_token
    lng, lat = proximity
    encoded = quote(query.strip(), safe="")
    url = (
        f"{MAPBOX_SEARCHBOX_URL}?q={encoded}"
        f"&proximity={lng},{lat}&limit={limit}&access_token={token}"
    )
    if country_code:
        url += f"&country={country_code.lower()}"

    try:
        with urlopen(url, timeout=12) as response:
            payload = json.loads(response.read().decode())
    except (HTTPError, URLError, json.JSONDecodeError, TimeoutError) as exc:
        logger.warning("Mapbox Search Box request failed: %s", exc)
        return []

    results: list[dict] = []
    for feature in payload.get("features", []):
        geometry = feature.get("geometry", {})
        coords = geometry.get("coordinates")
        if not isinstance(coords, list) or len(coords) < 2:
            continue
        props = feature.get("properties", {}) or {}
        name = props.get("name") or props.get("place_formatted") or props.get("full_address") or ""
        feature_type = str(props.get("feature_type") or "").lower()
        lng_f, lat_f = float(coords[0]), float(coords[1])
        results.append(
            {
                "latitude": lat_f,
                "longitude": lng_f,
                "name": str(name),
                "feature_type": feature_type,
                "mapbox_id": props.get("mapbox_id"),
            }
        )
    return results


def search_activity_places(
    query: str,
    *,
    proximity: tuple[float, float] | None = None,
    country_code: str | None = None,
    limit: int = 8,
) -> list[dict]:
    """POI search for the location picker (Mapbox Search Box)."""
    if not mapbox_configured() or not query.strip() or proximity is None:
        return []

    raw = _searchbox_forward(
        query,
        proximity=proximity,
        country_code=country_code,
        limit=limit,
    )
    if not raw and country_code:
        raw = _searchbox_forward(
            query,
            proximity=proximity,
            country_code=None,
            limit=limit,
        )

    results: list[dict] = []
    seen: set[str] = set()
    for item in raw:
        feature_type = str(item.get("feature_type") or "").lower()
        if _reject_city_level_feature(feature_type):
            continue
        label = str(item.get("name") or "").strip()
        if not label:
            continue
        key = f"{item['latitude']:.5f},{item['longitude']:.5f}"
        if key in seen:
            continue
        seen.add(key)
        results.append(
            {
                "label": label,
                "latitude": float(item["latitude"]),
                "longitude": float(item["longitude"]),
                "mapbox_id": item.get("mapbox_id"),
            }
        )
    return results


def _reject_city_level_feature(feature_type: str) -> bool:
    return feature_type in {"country", "region", "district", "place", "locality", "neighborhood", "street"}


def _too_close_to_dest_center(
    lat: float,
    lng: float,
    dest_center: tuple[float, float],
) -> bool:
    return _haversine_km(dest_center[1], dest_center[0], lat, lng) < MIN_DEST_CENTER_SEPARATION_KM


def _fix_possible_lat_lng_swap(
    lat: float,
    lng: float,
    dest_center: tuple[float, float] | None,
) -> tuple[float, float]:
    if dest_center is None:
        return lat, lng
    dest_lat, dest_lng = dest_center[1], dest_center[0]
    normal = _haversine_km(dest_lat, dest_lng, lat, lng)
    swapped = _haversine_km(dest_lat, dest_lng, lng, lat)
    if swapped + 1.0 < normal:
        return lng, lat
    return lat, lng


def _score_searchbox_result(
    result: dict,
    *,
    search_name: str,
    dest_center: tuple[float, float],
    max_distance_km: float,
    dest_city: str | None = None,
) -> float | None:
    feature_type = result.get("feature_type", "")
    if _reject_city_level_feature(feature_type):
        return None

    lat = float(result["latitude"])
    lng = float(result["longitude"])
    dist_km = _haversine_km(dest_center[1], dest_center[0], lat, lng)
    if dist_km > max_distance_km:
        return None
    if _too_close_to_dest_center(lat, lng, dest_center):
        return None

    label = str(result.get("name") or "")
    overlap = _token_overlap(search_name, label)
    if overlap < 0.2:
        return None

    poi_bonus = 0.15 if feature_type == "poi" else 0.0
    dist_penalty = (dist_km / max_distance_km) * 0.12
    dest_city_lower = (dest_city or "").lower()
    city_bonus = 0.08 if dest_city_lower and dest_city_lower in label.lower() else 0.0
    return (overlap * 0.65) + poi_bonus + city_bonus - dist_penalty


def _pick_searchbox_result(
    results: list[dict],
    *,
    search_name: str,
    dest_center: tuple[float, float],
    max_distance_km: float,
    dest_city: str | None = None,
) -> tuple[float, float] | None:
    best_score = 0.0
    best_coords: tuple[float, float] | None = None

    for result in results:
        score = _score_searchbox_result(
            result,
            search_name=search_name,
            dest_center=dest_center,
            max_distance_km=max_distance_km,
            dest_city=dest_city,
        )
        if score is None or score < MIN_MATCH_SCORE:
            continue
        if score > best_score:
            best_score = score
            best_coords = (float(result["latitude"]), float(result["longitude"]))

    return best_coords


def _searchbox_geocode_activity(
    search_name: str,
    *,
    location_hint: str | None,
    destination: str,
    dest_context: dict,
    dest_center: tuple[float, float],
) -> tuple[float, float] | None:
    country_code = dest_context.get("country_code")
    dest_city = dest_context.get("city")

    for query in _search_queries(search_name, location_hint, dest_context, destination):
        results = _searchbox_forward(
            query,
            proximity=dest_center,
            country_code=country_code,
        )
        coords = _pick_searchbox_result(
            results,
            search_name=search_name,
            dest_center=dest_center,
            max_distance_km=ACTIVITY_MAX_DISTANCE_KM,
            dest_city=dest_city,
        )
        if coords:
            return coords

    short_query = f"{search_name}, {dest_city or ''}".strip(", ")
    results = _searchbox_forward(short_query, proximity=dest_center, country_code=None)
    return _pick_searchbox_result(
        results,
        search_name=search_name,
        dest_center=dest_center,
        max_distance_km=ACTIVITY_MAX_DISTANCE_KM,
        dest_city=dest_city,
    )


def resolve_place_coordinates(
    search_name: str,
    *,
    location_hint: str | None,
    destination: str,
    dest_context: dict,
    dest_center: tuple[float, float],
    llm_coords: tuple[float, float] | None = None,
) -> tuple[float, float] | None:
    """Search Box POI first, legacy geocoding second, validated LLM hint last."""
    coords = _searchbox_geocode_activity(
        search_name,
        location_hint=location_hint,
        destination=destination,
        dest_context=dest_context,
        dest_center=dest_center,
    )
    if coords:
        return coords

    coords = geocode_activity(
        search_name,
        location_hint=location_hint,
        destination=destination,
        dest_context=dest_context,
        dest_center=dest_center,
    )
    if coords and not _too_close_to_dest_center(coords[0], coords[1], dest_center):
        return coords

    if llm_coords:
        lat, lng = _fix_possible_lat_lng_swap(llm_coords[0], llm_coords[1], dest_center)
        if _coords_valid_for_trip(lat, lng, dest_center):
            country_code = dest_context.get("country_code")
            if country_code:
                reverse = _reverse_country_code(lng, lat)
                if reverse and reverse != country_code.lower():
                    return None
            if not _too_close_to_dest_center(lat, lng, dest_center):
                logger.info("Using validated LLM coordinates for %r", search_name)
                return lat, lng

    return None


def geocode_query(
    query: str,
    *,
    proximity: tuple[float, float] | None = None,
    country_code: str | None = None,
    types: str | None = None,
    max_distance_km: float | None = None,
) -> tuple[float, float] | None:
    """Return (latitude, longitude) for a generic place search query."""
    if proximity is None:
        encoded = quote(query.strip(), safe="")
        if not encoded:
            return None
        params: list[str] = []
        if country_code:
            params.append(f"country={country_code.lower()}")
        if types:
            params.append(f"types={quote(types, safe=',')}")
        payload = _mapbox_geocode(encoded, "&".join(params), limit=5)
        if not payload:
            return None
        for feature in payload.get("features", []):
            center = feature.get("center")
            if isinstance(center, list) and len(center) >= 2:
                lng, lat = float(center[0]), float(center[1])
                return lat, lng
        return None

    dest_center = proximity
    features = _fetch_features(
        query,
        dest_center=dest_center,
        country_code=country_code,
        types=types or "poi,address,place",
    )
    return _best_coords_from_features(
        features,
        search_name=query.split(",")[0],
        dest_center=dest_center,
        max_distance_km=max_distance_km or ACTIVITY_MAX_DISTANCE_KM,
        country_code=country_code,
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
) -> bool:
    if dest_center is None:
        return True
    dist = _haversine_km(dest_center[1], dest_center[0], lat, lng)
    return dist <= ACTIVITY_MAX_DISTANCE_KM


def place_needs_geocode(
    place: Place,
    dest_center: tuple[float, float] | None,
) -> bool:
    if getattr(place, "location_confirmed", False) and place.latitude is not None and place.longitude is not None:
        return False
    if place.latitude is None or place.longitude is None:
        return True
    if dest_center is not None and not _coords_valid_for_trip(
        place.latitude,
        place.longitude,
        dest_center,
    ):
        return True
    return False


def trip_needs_geocoding(trip: TripPlan, places: list[Place]) -> bool:
    if not places:
        return False
    if any(p.latitude is None or p.longitude is None for p in places):
        return True

    destination = trip.destination or ""
    dest_center, _ = _resolve_destination_center(destination, _destination_context(destination))
    if dest_center is None:
        return False
    return any(place_needs_geocode(p, dest_center) for p in places)


def enrich_trip_places(
    db: Session,
    trip: TripPlan,
    places: list[Place] | None = None,
    *,
    force: bool = False,
) -> int:
    """Resolve latitude/longitude via Mapbox Search Box (POI-first)."""
    if not mapbox_configured():
        return 0

    target_places = places if places is not None else list(trip.places)
    if not target_places:
        return 0

    destination = trip.destination or ""
    dest_context = _destination_context(destination)
    dest_center, dest_context = _resolve_destination_center(destination, dest_context)
    if dest_center is None:
        logger.warning("Could not resolve destination center for %r — skipping geocoding", destination)
        return 0

    updated = 0
    for place in target_places:
        if getattr(place, "location_confirmed", False):
            continue
        if not force and not place_needs_geocode(place, dest_center):
            continue

        search_name = (place.map_search or place.name).strip()
        llm_coords: tuple[float, float] | None = None
        if place.latitude is not None and place.longitude is not None:
            llm_coords = (place.latitude, place.longitude)

        coords = resolve_place_coordinates(
            search_name,
            location_hint=place.location_hint,
            destination=destination,
            dest_context=dest_context,
            dest_center=dest_center,
            llm_coords=llm_coords,
        )
        if coords is None:
            continue

        place.latitude, place.longitude = coords
        updated += 1
        time.sleep(0.05)

    if updated:
        db.commit()

    return updated
