"""Promote a user to admin by email. Run from backend/: python scripts/promote_admin.py you@example.com"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.models.chat_message import ChatMessage  # noqa: F401 — register ORM models
from app.models.community import TripComment, TripSave, TripVote  # noqa: F401
from app.models.trip_plan import TripPlan  # noqa: F401
from app.models.user import User


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python scripts/promote_admin.py <email>")
        sys.exit(1)

    email = sys.argv[1].strip().lower()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            print(f"No user found with email: {email}")
            sys.exit(1)
        if user.is_admin:
            print(f"{email} is already an admin.")
            return
        user.is_admin = True
        db.commit()
        print(f"Promoted {email} to admin.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
