"""Test LLM JSON parsing / salvage. Run: python scripts/test_llm_json.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.llm_json import parse_llm_json_array

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
