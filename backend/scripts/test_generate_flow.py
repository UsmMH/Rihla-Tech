"""Simulate itinerary generation LLM call. Run: python scripts/test_generate_flow.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.models.trip_plan import TripPlan
from app.services.itinerary import _ai_itinerary
from app.services.llm import get_llm_model, get_llm_provider

print(f"Provider: {get_llm_provider()}")
print(f"Model: {get_llm_model()}")

db = SessionLocal()
trip = (
    db.query(TripPlan)
    .filter(TripPlan.destination.isnot(None))
    .order_by(TripPlan.id.desc())
    .first()
)
if not trip:
    print("No trip_plans with destination in DB — complete quiz flow first")
    sys.exit(1)

print(f"Using trip_plan id={trip.id} destination={trip.destination}")

try:
    payload = _ai_itinerary(trip)
    days = payload.get("days", [])
    print(f"SUCCESS — {len(days)} days generated")
    for day in days[:2]:
        print(f"  Day {day.get('day')}: {day.get('theme')}")
        for act in day.get("activities", [])[:1]:
            print(f"    - {act.get('time_slot')}: {act.get('name')}")
except Exception as exc:
    print(f"FAIL (this triggers mock on site): {type(exc).__name__}: {exc}")
finally:
    db.close()
