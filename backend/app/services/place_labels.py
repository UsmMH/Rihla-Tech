"""Shared helpers for normalizing and comparing city / airport labels."""


def normalize_city_token(name: str) -> str:
    token = name.strip().lower()
    if token.startswith("al-"):
        token = token[3:]
    return token


def city_comparable_key(label: str) -> str:
    parts = [part.strip() for part in label.split(",") if part.strip()]
    if not parts:
        return ""
    # Airport labels: "Airport Name (RUH), City, Country"
    if len(parts) >= 3 and "(" in parts[0]:
        return normalize_city_token(parts[1])
    return normalize_city_token(parts[0])


def cities_conflict(origin: str, destination: str) -> bool:
    origin_clean = origin.strip()
    dest_clean = destination.strip()
    if not origin_clean or not dest_clean:
        return False

    origin_key = city_comparable_key(origin_clean)
    dest_key = city_comparable_key(dest_clean)
    if origin_key and dest_key:
        return origin_key == dest_key

    return origin_clean.lower() == dest_clean.lower()


_IATA_COUNTRY_NAMES: dict[str, str] = {
    "SA": "Saudi Arabia",
    "AE": "United Arab Emirates",
    "US": "United States",
    "GB": "United Kingdom",
    "FR": "France",
    "DE": "Germany",
    "IT": "Italy",
    "ES": "Spain",
    "TR": "Turkey",
    "EG": "Egypt",
    "JP": "Japan",
    "KR": "South Korea",
    "CN": "China",
    "TH": "Thailand",
    "IN": "India",
    "QA": "Qatar",
    "KW": "Kuwait",
    "BH": "Bahrain",
    "OM": "Oman",
    "JO": "Jordan",
    "MA": "Morocco",
}


def country_name_from_iata(code: str) -> str:
    normalized = (code or "").strip().upper()
    return _IATA_COUNTRY_NAMES.get(normalized, normalized)

