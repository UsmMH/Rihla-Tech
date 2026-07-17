"""Encode pace + interest tags in trip.theme (pace|interest1,interest2)."""

from __future__ import annotations


def encode_theme_preferences(pace: str | None, interests: list[str] | str | None) -> str | None:
    if isinstance(interests, list):
        interest_str = ",".join(interests)
    elif isinstance(interests, str):
        interest_str = interests.strip()
    else:
        interest_str = ""

    pace_key = (pace or "").strip()
    if pace_key and interest_str:
        return f"{pace_key}|{interest_str}"
    if pace_key:
        return f"{pace_key}|mixed"
    if interest_str:
        return interest_str
    return None


def decode_theme_preferences(theme: str | None) -> tuple[str | None, list[str]]:
    if not theme:
        return None, []
    if "|" in theme:
        pace, interests_raw = theme.split("|", 1)
        interests = [part.strip() for part in interests_raw.split(",") if part.strip()]
        return pace.strip() or None, interests
    interests = [part.strip() for part in theme.split(",") if part.strip()]
    return None, interests


def theme_display_label(theme: str | None) -> str:
    pace, interests = decode_theme_preferences(theme)
    parts: list[str] = []
    if pace:
        parts.append(pace.replace("_", " ").capitalize())
    if interests:
        parts.append(", ".join(i.replace("_", " ").capitalize() for i in interests))
    return " · ".join(parts) if parts else "Mixed"
