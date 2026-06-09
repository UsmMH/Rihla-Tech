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
        "key": "travelers",
        "title": "Who's traveling?",
        "subtitle": "Tell us how many adults and children.",
        "question_type": "travelers",
        "multi": False,
        "sort_order": 4,
        "options": [],
    },
    {
        "phase": "quiz",
        "key": "origin",
        "title": "Where are you flying from?",
        "subtitle": "Your departure city or airport.",
        "question_type": "text",
        "multi": False,
        "sort_order": 5,
        "options": [],
    },
]

PREFERENCE_QUESTIONS = [
    {
        "phase": "preferences",
        "key": "trip_purpose",
        "title": "What's the purpose of your trip?",
        "subtitle": "This helps us tailor activities to your mood.",
        "question_type": "choice",
        "multi": False,
        "sort_order": 1,
        "options": [
            {"option_key": "fun", "label": "Fun & Entertainment", "icon": "🎉", "description": "Nightlife, events, and good vibes"},
            {"option_key": "heal", "label": "Rest & Heal", "icon": "🧘", "description": "Slow pace, wellness, and recharge"},
            {"option_key": "explore", "label": "Explore & Discover", "icon": "🧭", "description": "New cultures, sights, and adventures"},
        ],
    },
    {
        "phase": "preferences",
        "key": "theme",
        "title": "What theme interests you most?",
        "subtitle": "We'll shape your itinerary around this.",
        "question_type": "choice",
        "multi": False,
        "sort_order": 2,
        "options": [
            {"option_key": "historical", "label": "Historical", "icon": "🏛️", "description": "Heritage sites, museums, and stories"},
            {"option_key": "modern", "label": "Modern", "icon": "🏙️", "description": "Contemporary culture, design, and city life"},
            {"option_key": "natural", "label": "Natural", "icon": "🌿", "description": "Parks, landscapes, and outdoor beauty"},
        ],
    },
    {
        "phase": "preferences",
        "key": "budget_tier",
        "title": "What's your budget tier?",
        "subtitle": "We'll match activities and stays to your comfort level.",
        "question_type": "choice",
        "multi": False,
        "sort_order": 3,
        "options": [
            {"option_key": "eco", "label": "Eco", "icon": "🎒", "description": "Budget-friendly and local experiences"},
            {"option_key": "mid", "label": "Mid", "icon": "💳", "description": "Comfortable mid-range travel"},
            {"option_key": "luxury", "label": "Luxury", "icon": "✨", "description": "Premium stays and exclusive experiences"},
        ],
    },
    {
        "phase": "preferences",
        "key": "include_flights",
        "title": "Include flights in your plan?",
        "subtitle": "We can search flight options for your trip.",
        "question_type": "choice",
        "multi": False,
        "sort_order": 4,
        "options": [
            {"option_key": "yes", "label": "Yes, include flights", "icon": "✈️", "description": "Show flight options and deep-links"},
            {"option_key": "no", "label": "No, skip flights", "icon": "🚫", "description": "I'll arrange my own transport"},
        ],
    },
    {
        "phase": "preferences",
        "key": "include_hotels",
        "title": "Include hotels in your plan?",
        "subtitle": "We can recommend stays that match your tier.",
        "question_type": "choice",
        "multi": False,
        "sort_order": 5,
        "options": [
            {"option_key": "yes", "label": "Yes, include hotels", "icon": "🏨", "description": "Show hotel options and deep-links"},
            {"option_key": "no", "label": "No, skip hotels", "icon": "🚫", "description": "I'll arrange my own accommodation"},
        ],
    },
]


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


def seed_questions(db: Session) -> None:
    dedupe_questions(db)

    for raw in QUIZ_QUESTIONS + PREFERENCE_QUESTIONS:
        item = dict(raw)
        options = item.pop("options")

        existing = (
            db.query(Question)
            .filter(Question.phase == item["phase"], Question.key == item["key"])
            .first()
        )
        if existing:
            continue

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

    db.commit()
