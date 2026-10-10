import json
import logging
import re
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import urlopen

from app.config import settings
from app.services.place_labels import city_comparable_key

logger = logging.getLogger(__name__)

MAPBOX_GEOCODE_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places"
MAPBOX_SEARCHBOX_URL = "https://api.mapbox.com/search/searchbox/v1/forward"

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


def mapbox_configured() -> bool:
    return bool(settings.mapbox_access_token)


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


def _normalize_city_label(feature: dict) -> str:
    """Build a consistent 'City, Country' label from Mapbox feature properties."""
    city = str(feature.get("text") or "").strip()
    if city.lower().startswith("al-"):
        city = city[3:].strip() or city
    country = ""
    for ctx in feature.get("context") or []:
        ctx_id = str(ctx.get("id") or "")
        if ctx_id.startswith("country."):
            country = str(ctx.get("text") or "").strip()
            break
    if city and country:
        return f"{city}, {country}"
    return str(feature.get("place_name") or feature.get("text") or "").strip()


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
    seen_keys: set[str] = set()
    for feature in payload.get("features", []):
        center = feature.get("center")
        if not isinstance(center, list) or len(center) < 2:
            continue
        lng, lat = float(center[0]), float(center[1])
        label = _normalize_city_label(feature)
        if not label:
            continue
        dedupe_key = city_comparable_key(label)
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)
        results.append(
            {
                "label": label,
                "latitude": lat,
                "longitude": lng,
                "kind": "city",
                "iata_code": None,
                "city": label.split(",")[0].strip() or None,
            }
        )
    return results


def _airport_dedupe_key(item: dict) -> str:
    iata = item.get("iata_code")
    if isinstance(iata, str) and iata:
        return iata.upper()
    label = str(item.get("label") or "")
    return label.split("(")[0].split(",")[0].strip().lower()


def search_airports(query: str, *, limit: int = 8) -> list[dict]:
    """Search airports for origin autocomplete when flights are included."""
    cleaned = query.strip()
    if len(cleaned) < 2:
        return []

    from app.services.flights import search_airport_suggestions

    results = search_airport_suggestions(cleaned, limit=limit)
    seen_keys = {_airport_dedupe_key(item) for item in results}

    if len(results) < limit:
        for item in _searchbox_airport_results(cleaned, limit=limit):
            key = _airport_dedupe_key(item)
            if key in seen_keys:
                continue
            seen_keys.add(key)
            results.append(item)
            if len(results) >= limit:
                break

    if not results and "airport" not in cleaned.lower():
        return search_airports(f"{cleaned} airport", limit=limit)

    return results[:limit]


def _searchbox_airport_results(query: str, *, limit: int = 8) -> list[dict]:
    """Mapbox Search Box airport POI fallback when Duffel is unavailable."""
    if not mapbox_configured() or not query.strip():
        return []

    token = settings.mapbox_access_token
    encoded = quote(query.strip(), safe="")
    url = (
        f"{MAPBOX_SEARCHBOX_URL}?q={encoded}"
        f"&limit={limit}&types=poi&poi_category=airport&access_token={token}"
    )

    try:
        with urlopen(url, timeout=12) as response:
            payload = json.loads(response.read().decode())
    except (HTTPError, URLError, json.JSONDecodeError, TimeoutError) as exc:
        logger.warning("Mapbox airport search failed: %s", exc)
        return []

    results: list[dict] = []
    for feature in payload.get("features", []):
        item = _normalize_searchbox_airport(feature)
        if item:
            results.append(item)
    return results


def _normalize_searchbox_airport(feature: dict) -> dict | None:
    geometry = feature.get("geometry", {})
    coords = geometry.get("coordinates")
    if not isinstance(coords, list) or len(coords) < 2:
        return None

    props = feature.get("properties", {}) or {}
    name = str(props.get("name") or props.get("name_preferred") or "").strip()
    if not name:
        return None

    lng, lat = float(coords[0]), float(coords[1])
    context = props.get("context") or {}
    city = str(context.get("place", {}).get("name") or "").strip()
    country = str(context.get("country", {}).get("name") or "").strip()
    if city.lower().startswith("al-"):
        city = city[3:].strip() or city

    iata_match = re.search(r"\b([A-Z]{3})\b", name)
    iata = iata_match.group(1) if iata_match else None
    display_name = f"{name} ({iata})" if iata else name
    if city and country:
        label = f"{display_name}, {city}, {country}"
    elif country:
        label = f"{display_name}, {country}"
    else:
        label = display_name

    return {
        "label": label,
        "latitude": lat,
        "longitude": lng,
        "kind": "airport",
        "iata_code": iata,
        "city": city or None,
    }


def _normalize_searchbox_lodging(feature: dict) -> dict | None:
    geometry = feature.get("geometry", {})
    coords = geometry.get("coordinates")
    if not isinstance(coords, list) or len(coords) < 2:
        return None

    props = feature.get("properties", {}) or {}
    name = str(props.get("name") or props.get("name_preferred") or "").strip()
    if not name:
        return None

    lng, lat = float(coords[0]), float(coords[1])
    context = props.get("context") or {}
    neighborhood = str(context.get("neighborhood", {}).get("name") or "").strip()
    place = str(context.get("place", {}).get("name") or "").strip()
    if place.lower().startswith("al-"):
        place = place[3:].strip() or place
    area = neighborhood or place or "City center"

    return {
        "name": name,
        "area": area,
        "city": place or None,
        "latitude": lat,
        "longitude": lng,
    }


def _searchbox_lodging_results(
    query: str,
    *,
    proximity: tuple[float, float],
    country_code: str | None = None,
    limit: int = 8,
) -> list[dict]:
    """Mapbox Search Box lodging POIs near a destination center."""
    if not mapbox_configured() or not query.strip():
        return []

    lng, lat = proximity
    token = settings.mapbox_access_token
    encoded = quote(query.strip(), safe="")
    url = (
        f"{MAPBOX_SEARCHBOX_URL}?q={encoded}"
        f"&proximity={lng},{lat}&limit={limit}&types=poi&poi_category=hotel&access_token={token}"
    )
    if country_code:
        url += f"&country={country_code.lower()}"

    try:
        with urlopen(url, timeout=12) as response:
            payload = json.loads(response.read().decode())
    except (HTTPError, URLError, json.JSONDecodeError, TimeoutError) as exc:
        logger.warning("Mapbox lodging search failed: %s", exc)
        return []

    results: list[dict] = []
    for feature in payload.get("features", []):
        item = _normalize_searchbox_lodging(feature)
        if item:
            results.append(item)
    return results


def search_lodging_hotels(destination: str, *, limit: int = 6) -> list[dict]:
    """Return lodging POIs for a trip destination. Empty list on failure."""
    cleaned = destination.strip()
    if not cleaned or not mapbox_configured():
        return []

    dest_context = _destination_context(cleaned)
    dest_center, dest_context = _resolve_destination_center(cleaned, dest_context)
    if dest_center is None:
        return []

    city = dest_context.get("city") or cleaned.split(",")[0].strip()
    country_code = dest_context.get("country_code")
    queries = [f"hotels in {city}", "hotel", f"{city} hotel"]

    seen_names: set[str] = set()
    results: list[dict] = []
    for query in queries:
        if len(results) >= limit:
            break
        batch = _searchbox_lodging_results(
            query,
            proximity=dest_center,
            country_code=country_code,
            limit=limit,
        )
        for item in batch:
            key = item["name"].strip().lower()
            if not key or key in seen_names:
                continue
            seen_names.add(key)
            if not item.get("city"):
                item["city"] = city
            results.append(item)
            if len(results) >= limit:
                break
    return results[:limit]
