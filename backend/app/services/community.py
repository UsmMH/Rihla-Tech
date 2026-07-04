from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.community import TripComment, TripSave, TripVote
from app.models.trip_plan import TripPlan
from app.models.user import User
from app.schemas.community import (
    CommentListResponse,
    CommentPublic,
    CommunityAuthor,
    CommunityFeedResponse,
    CommunityTripDetailResponse,
    CommunityTripItem,
    ShareTripResponse,
    ToggleSaveResponse,
    ToggleVoteResponse,
)
from app.services.itinerary import _build_response


def _author_display(user: User) -> CommunityAuthor:
    last_initial = user.last_name[:1].upper() if user.last_name else ""
    display = f"{user.first_name} {last_initial}.".strip()
    return CommunityAuthor(id=user.id, display_name=display)


def _trip_day_count(trip: TripPlan) -> int:
    if trip.start_date and trip.end_date and trip.end_date >= trip.start_date:
        days = (trip.end_date - trip.start_date).days + 1
        return max(1, min(days, 14))
    places = trip.places or []
    if places:
        return max(p.day_number for p in places)
    return 1


def _counts_for_trip(db: Session, trip_plan_id: int) -> tuple[int, int, int]:
    vote_count = db.query(func.count(TripVote.id)).filter(TripVote.trip_plan_id == trip_plan_id).scalar() or 0
    save_count = db.query(func.count(TripSave.id)).filter(TripSave.trip_plan_id == trip_plan_id).scalar() or 0
    comment_count = (
        db.query(func.count(TripComment.id)).filter(TripComment.trip_plan_id == trip_plan_id).scalar() or 0
    )
    return int(vote_count), int(save_count), int(comment_count)


def _viewer_flags(
    db: Session,
    trip_plan_id: int,
    user: User,
) -> tuple[bool, bool]:
    voted = (
        db.query(TripVote.id)
        .filter(TripVote.trip_plan_id == trip_plan_id, TripVote.user_id == user.id)
        .first()
        is not None
    )
    saved = (
        db.query(TripSave.id)
        .filter(TripSave.trip_plan_id == trip_plan_id, TripSave.user_id == user.id)
        .first()
        is not None
    )
    return voted, saved


def _get_shared_trip(db: Session, trip_plan_id: int) -> TripPlan:
    trip = (
        db.query(TripPlan)
        .options(joinedload(TripPlan.places))
        .filter(TripPlan.id == trip_plan_id, TripPlan.is_shared.is_(True))
        .first()
    )
    if trip is None or not trip.places:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared trip not found")
    return trip


def _get_owned_trip(db: Session, user: User, trip_plan_id: int) -> TripPlan:
    trip = (
        db.query(TripPlan)
        .options(joinedload(TripPlan.places))
        .filter(TripPlan.id == trip_plan_id, TripPlan.user_id == user.id)
        .first()
    )
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip plan not found")
    return trip


def _to_feed_item(
    db: Session,
    trip: TripPlan,
    author: User,
    viewer: User,
) -> CommunityTripItem:
    vote_count, save_count, comment_count = _counts_for_trip(db, trip.id)
    viewer_voted, viewer_saved = _viewer_flags(db, trip.id, viewer)
    return CommunityTripItem(
        id=trip.id,
        destination=trip.destination,
        start_date=trip.start_date,
        end_date=trip.end_date,
        theme=trip.theme,
        trip_purpose=trip.trip_purpose,
        num_days=_trip_day_count(trip),
        activity_count=len(trip.places or []),
        share_caption=trip.share_caption,
        shared_at=trip.shared_at or trip.updated_at,
        author=_author_display(author),
        vote_count=vote_count,
        comment_count=comment_count,
        save_count=save_count,
        viewer_voted=viewer_voted,
        viewer_saved=viewer_saved,
        is_owner=trip.user_id == viewer.id,
    )


def list_feed(db: Session, user: User) -> CommunityFeedResponse:
    rows = (
        db.query(TripPlan, User)
        .join(User, User.id == TripPlan.user_id)
        .options(joinedload(TripPlan.places))
        .filter(TripPlan.is_shared.is_(True))
        .order_by(TripPlan.shared_at.desc().nullslast(), TripPlan.updated_at.desc())
        .all()
    )
    items = [_to_feed_item(db, trip, author, user) for trip, author in rows if trip.places]
    return CommunityFeedResponse(trips=items)


def list_saved(db: Session, user: User) -> CommunityFeedResponse:
    rows = (
        db.query(TripPlan, User)
        .join(TripSave, TripSave.trip_plan_id == TripPlan.id)
        .join(User, User.id == TripPlan.user_id)
        .options(joinedload(TripPlan.places))
        .filter(TripSave.user_id == user.id, TripPlan.is_shared.is_(True))
        .order_by(TripSave.created_at.desc())
        .all()
    )
    items = [_to_feed_item(db, trip, author, user) for trip, author in rows if trip.places]
    return CommunityFeedResponse(trips=items)


def share_trip(db: Session, user: User, trip_plan_id: int, caption: str | None) -> ShareTripResponse:
    trip = _get_owned_trip(db, user, trip_plan_id)
    if not trip.places:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Generate an itinerary before sharing",
        )
    trip.is_shared = True
    trip.share_caption = caption.strip() if caption and caption.strip() else None
    trip.shared_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(trip)
    return ShareTripResponse(
        trip_plan_id=trip.id,
        is_shared=trip.is_shared,
        share_caption=trip.share_caption,
        shared_at=trip.shared_at,
    )


def unshare_trip(db: Session, user: User, trip_plan_id: int) -> ShareTripResponse:
    trip = _get_owned_trip(db, user, trip_plan_id)
    trip.is_shared = False
    trip.share_caption = None
    trip.shared_at = None
    db.commit()
    return ShareTripResponse(
        trip_plan_id=trip.id,
        is_shared=False,
        share_caption=None,
        shared_at=None,
    )


def toggle_vote(db: Session, user: User, trip_plan_id: int) -> ToggleVoteResponse:
    _get_shared_trip(db, trip_plan_id)
    existing = (
        db.query(TripVote)
        .filter(TripVote.trip_plan_id == trip_plan_id, TripVote.user_id == user.id)
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
        voted = False
    else:
        db.add(TripVote(trip_plan_id=trip_plan_id, user_id=user.id))
        db.commit()
        voted = True
    vote_count, _, _ = _counts_for_trip(db, trip_plan_id)
    return ToggleVoteResponse(voted=voted, vote_count=vote_count)


def toggle_save(db: Session, user: User, trip_plan_id: int) -> ToggleSaveResponse:
    _get_shared_trip(db, trip_plan_id)
    existing = (
        db.query(TripSave)
        .filter(TripSave.trip_plan_id == trip_plan_id, TripSave.user_id == user.id)
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
        saved = False
    else:
        db.add(TripSave(trip_plan_id=trip_plan_id, user_id=user.id))
        db.commit()
        saved = True
    _, save_count, _ = _counts_for_trip(db, trip_plan_id)
    return ToggleSaveResponse(saved=saved, save_count=save_count)


def get_shared_trip_detail(db: Session, user: User, trip_plan_id: int) -> CommunityTripDetailResponse:
    trip = _get_shared_trip(db, trip_plan_id)
    author = db.get(User, trip.user_id)
    if author is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared trip not found")

    places = list(trip.places)
    source = trip.itinerary_source or "generated"
    detail = _build_response(trip, places, source=source, fallback_reason=None)
    vote_count, save_count, comment_count = _counts_for_trip(db, trip_plan_id)
    viewer_voted, viewer_saved = _viewer_flags(db, trip_plan_id, user)

    return CommunityTripDetailResponse(
        trip=detail,
        share_caption=trip.share_caption,
        shared_at=trip.shared_at or trip.updated_at,
        author=_author_display(author),
        vote_count=vote_count,
        comment_count=comment_count,
        save_count=save_count,
        viewer_voted=viewer_voted,
        viewer_saved=viewer_saved,
        is_owner=trip.user_id == user.id,
    )


def list_comments(db: Session, user: User, trip_plan_id: int) -> CommentListResponse:
    _get_shared_trip(db, trip_plan_id)
    rows = (
        db.query(TripComment)
        .options(joinedload(TripComment.author))
        .filter(TripComment.trip_plan_id == trip_plan_id)
        .order_by(TripComment.created_at.asc(), TripComment.id.asc())
        .all()
    )
    comments = [
        CommentPublic(
            id=c.id,
            body=c.body,
            created_at=c.created_at,
            author=_author_display(c.author),
            is_mine=c.user_id == user.id,
        )
        for c in rows
    ]
    return CommentListResponse(comments=comments)


def add_comment(db: Session, user: User, trip_plan_id: int, body: str) -> CommentPublic:
    _get_shared_trip(db, trip_plan_id)
    comment = TripComment(trip_plan_id=trip_plan_id, user_id=user.id, body=body.strip())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return CommentPublic(
        id=comment.id,
        body=comment.body,
        created_at=comment.created_at,
        author=_author_display(user),
        is_mine=True,
    )


def delete_comment(db: Session, user: User, comment_id: int) -> None:
    comment = db.get(TripComment, comment_id)
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    if comment.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    db.delete(comment)
    db.commit()
