"""Test LLM JSON parsing / salvage. Run: python scripts/test_llm_json.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.llm_json import parse_llm_json_array, parse_llm_itinerary_object

TRUNCATED = """[
 {
 "city": "Barcelona",
 "country": "Spain",
 "blurb": "Barcelona vibrant modern architecture and beaches."
 },
 {
 "city": "Dubai",
 "country": "UAE",
 "blurb": "Du"""

items = parse_llm_json_array(TRUNCATED, min_items=1)
assert len(items) >= 1, "expected at least one salvaged city"
assert items[0]["city"] == "Barcelona"
print(f"OK salvaged {len(items)} item(s) from truncated JSON")

TRUNCATED_ITINERARY = """{
  "tags": "culture, food",
  "days": [
    {"day": 1, "theme": "Arrival", "activities": [{"time_slot": "morning", "name": "Louvre"}]},
    {"day": 2, "theme": "Museums", "activities": [{"time_slot": "morning", "name": "Orsay"}]},
    {"day": 3, "theme": "Gardens", "activities": [{"time_slot": "morning", "name": "Luxembourg"}]},
    {"day": 4, "theme": "River", "activities": [{"time_slot": "evening", "name": "Bateaux Mouches", "map_search": "Bateaux Mouches", "latitude": 48.86"""

payload = parse_llm_itinerary_object(TRUNCATED_ITINERARY, expected_days=3)
assert len(payload["days"]) == 3, f"expected 3 salvaged days, got {len(payload['days'])}"
print(f"OK salvaged {len(payload['days'])} day(s) from truncated itinerary JSON")
