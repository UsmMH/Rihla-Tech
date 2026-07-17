from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.question import AnswerOption, Question

QUIZ_QUESTIONS = [
    {
        "phase": "quiz",
        "key": "destination_known",
        "title": "Do you know your destination?",
        "subtitle": "We can suggest cities if you're still deciding.",
        "question_type": "choice",
        "multi": False,
        "sort_order": 1,
        "options": [
            {"option_key": "yes", "label": "Yes, I have a place in mind", "icon": "📍", "description": "I'll enter my destination"},
            {"option_key": "not_sure", "label": "Not sure yet", "icon": "🤔", "description": "Help me discover the perfect city"},
        ],
    },
    {
        "phase": "quiz",
        "key": "dates",
        "title": "When are you traveling?",
        "subtitle": "Select your trip start and end dates.",
        "question_type": "date_range",
        "multi": False,
        "sort_order": 2,
        "options": [],
    },
    {
        "phase": "quiz",
        "key": "destination",
        "title": "Where are you going?",
        "subtitle": "Enter your destination city or country.",
        "question_type": "text",
        "multi": False,
        "sort_order": 3,
        "options": [],
    },
    {
        "phase": "quiz",
        "key": "include_flights",
        "title": "Include flight suggestions?",
        "subtitle": "We'll show sample fares and Google Flights links on your trip page.",
        "question_type": "choice",
        "multi": False,
        "sort_order": 4,
        "options": [
            {"option_key": "yes", "label": "Yes, show flights", "icon": "✈️", "description": "I'll enter where I'm flying from"},
            {"option_key": "no", "label": "No flights needed", "icon": "🚗", "description": "Skip departure city — great for road trips or local stays"},
        ],
    },
    {
        "phase": "quiz",
        "key": "origin",
        "title": "Which airport are you departing from?",
        "subtitle": "Search by airport or city — used for flight suggestions.",
        "question_type": "text",
        "multi": False,
        "sort_order": 5,
        "options": [],
    },
    {
        "phase": "quiz",
        "key": "travelers",
        "title": "Who's traveling?",
        "subtitle": "Tell us how many adults and children.",
        "question_type": "travelers",
        "multi": False,
        "sort_order": 6,
        "options": [],
    },
]

PREFERENCE_QUESTIONS = [
    {
        "phase": "preferences",
        "key": "trip_purpose",
        "title": "What's the vibe of this trip?",
        "subtitle": "Think mood, not logistics — we'll shape days around how you want to feel.",
        "question_type": "choice",
        "multi": False,
        "sort_order": 1,
        "options": [
            {"option_key": "fun", "label": "Fun & social", "icon": "🎉", "description": "Energy, events, and memorable nights out"},
            {"option_key": "heal", "label": "Rest & recharge", "icon": "🧘", "description": "Slow mornings, wellness, and breathing room"},
            {"option_key": "explore", "label": "Explore & discover", "icon": "🧭", "description": "Curiosity-led days and new experiences"},
        ],
    },
    {
        "phase": "preferences",
        "key": "pace",
        "title": "How packed should each day feel?",
        "subtitle": "We'll balance activities and downtime to match your rhythm.",
        "question_type": "choice",
        "multi": False,
        "sort_order": 2,
        "options": [
            {"option_key": "relaxed", "label": "Easygoing", "icon": "☕", "description": "1–2 highlights with plenty of free time"},
            {"option_key": "balanced", "label": "Balanced", "icon": "⚖️", "description": "A full day with room to wander"},
            {"option_key": "packed", "label": "See it all", "icon": "⚡", "description": "Maximize sights from morning to night"},
        ],
    },
    {
        "phase": "preferences",
        "key": "theme",
        "title": "What should we lean into?",
        "subtitle": "Pick up to two — we'll thread these through your itinerary.",
        "question_type": "choice",
        "multi": True,
        "sort_order": 3,
        "options": [
            {"option_key": "historical", "label": "History & heritage", "icon": "🏛️", "description": "Museums, landmarks, and local stories"},
            {"option_key": "food", "label": "Food & cafés", "icon": "🍜", "description": "Markets, restaurants, and regional flavors"},
            {"option_key": "nature", "label": "Nature & outdoors", "icon": "🌿", "description": "Parks, viewpoints, and fresh air"},
            {"option_key": "arts", "label": "Arts & design", "icon": "🎨", "description": "Galleries, architecture, and creative scenes"},
            {"option_key": "nightlife", "label": "Nightlife", "icon": "🌙", "description": "Evening spots, live music, and city lights"},
            {"option_key": "local", "label": "Local neighborhoods", "icon": "🏘️", "description": "Everyday streets away from the crowds"},
        ],
    },
    {
        "phase": "preferences",
        "key": "budget_tier",
        "title": "How do you like to spend?",
        "subtitle": "Sets the tone for stays, dining, and activity picks.",
        "question_type": "choice",
        "multi": False,
        "sort_order": 4,
        "options": [
            {"option_key": "eco", "label": "Budget-smart", "icon": "🎒", "description": "Great value and authentic local picks"},
            {"option_key": "mid", "label": "Comfortable", "icon": "💳", "description": "Reliable mid-range favorites"},
            {"option_key": "luxury", "label": "Premium", "icon": "✨", "description": "Upscale stays and standout experiences"},
        ],
    },
    {
        "phase": "preferences",
        "key": "travel_extras",
        "title": "Want hotel suggestions?",
        "subtitle": "Optional — we'll show stay ideas and Booking.com links on your trip page.",
        "question_type": "choice",
        "multi": True,
        "sort_order": 5,
        "options": [
            {"option_key": "hotels", "label": "Hotels", "icon": "🏨", "description": "Stay ideas and Booking.com links"},
        ],
    },
]

OBSOLETE_PREFERENCE_KEYS = {"include_flights", "include_hotels"}


def dedupe_questions(db: Session) -> None:
    """Remove duplicate questions left from earlier seed runs (keeps lowest id per phase+key)."""
    groups = (
        db.query(Question.phase, Question.key, func.min(Question.id).label("keep_id"))
        .group_by(Question.phase, Question.key)
        .all()
    )
    keep_ids = {row.keep_id for row in groups}
    dupes = db.query(Question).filter(Question.id.notin_(keep_ids)).all()
    if dupes:
        for question in dupes:
            db.delete(question)
        db.commit()


def _remove_obsolete_preference_questions(db: Session) -> None:
    for key in OBSOLETE_PREFERENCE_KEYS:
        existing = (
            db.query(Question)
            .filter(Question.phase == "preferences", Question.key == key)
            .first()
        )
        if existing:
            db.delete(existing)
    db.commit()


def _upsert_question(db: Session, raw: dict) -> None:
    item = dict(raw)
    options = item.pop("options")

    existing = (
        db.query(Question)
        .filter(Question.phase == item["phase"], Question.key == item["key"])
        .first()
    )
    if existing:
        for field, value in item.items():
            setattr(existing, field, value)
        db.query(AnswerOption).filter(AnswerOption.question_id == existing.id).delete()
        question = existing
    else:
        question = Question(**item)
        db.add(question)
        db.flush()

    for i, opt in enumerate(options):
        db.add(
            AnswerOption(
                question_id=question.id,
                sort_order=i + 1,
                **opt,
            )
        )


def seed_questions(db: Session) -> None:
    dedupe_questions(db)
    _remove_obsolete_preference_questions(db)

    for raw in QUIZ_QUESTIONS:
        _upsert_question(db, raw)

    for raw in PREFERENCE_QUESTIONS:
        _upsert_question(db, raw)

    db.commit()
