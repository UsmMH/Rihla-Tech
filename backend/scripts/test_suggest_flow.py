"""Simulate destination suggestion LLM call. Run: python scripts/test_suggest_flow.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.database import SessionLocal
from app.models.trip_plan import TripPlan
from app.services.destinations import _ai_suggestions
from app.services.llm import get_llm_model, get_llm_provider

print(f"Provider: {get_llm_provider()}")
print(f"Model: {get_llm_model()}")

db = SessionLocal()
trip = db.query(TripPlan).order_by(TripPlan.id.desc()).first()
if not trip:
    print("No trip_plans in DB — complete quiz flow first")
    sys.exit(1)

print(f"Using trip_plan id={trip.id} purpose={trip.trip_purpose} theme={trip.theme}")

try:
    suggestions = _ai_suggestions(trip)
    print("SUCCESS — AI suggestions:")
    for s in suggestions:
        print(f"  - {s.city}, {s.country}: {s.blurb[:80]}...")
except Exception as exc:
    print(f"FAIL (this triggers mock on site): {type(exc).__name__}: {exc}")
finally:
    db.close()
