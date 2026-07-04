from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.community import (
    CommentListResponse,
    CommentPublic,
    CommunityFeedResponse,
    CommunityTripDetailResponse,
    CreateCommentRequest,
    ShareTripRequest,
    ShareTripResponse,
    ToggleSaveResponse,
    ToggleVoteResponse,
)
from app.services import community as community_service

router = APIRouter(prefix="/community", tags=["community"])


@router.get("/feed", response_model=CommunityFeedResponse)
def community_feed(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommunityFeedResponse:
    return community_service.list_feed(db, current_user)


@router.get("/saved", response_model=CommunityFeedResponse)
def saved_trips(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommunityFeedResponse:
    return community_service.list_saved(db, current_user)


@router.get("/trips/{trip_plan_id}", response_model=CommunityTripDetailResponse)
def shared_trip_detail(
    trip_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommunityTripDetailResponse:
    return community_service.get_shared_trip_detail(db, current_user, trip_plan_id)


@router.post("/trips/{trip_plan_id}/share", response_model=ShareTripResponse)
def share_trip(
    trip_plan_id: int,
    payload: ShareTripRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShareTripResponse:
    return community_service.share_trip(db, current_user, trip_plan_id, payload.caption)


@router.delete("/trips/{trip_plan_id}/share", response_model=ShareTripResponse)
def unshare_trip(
    trip_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShareTripResponse:
    return community_service.unshare_trip(db, current_user, trip_plan_id)


@router.post("/trips/{trip_plan_id}/vote", response_model=ToggleVoteResponse)
def toggle_vote(
    trip_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ToggleVoteResponse:
    return community_service.toggle_vote(db, current_user, trip_plan_id)


@router.post("/trips/{trip_plan_id}/save", response_model=ToggleSaveResponse)
def toggle_save(
    trip_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ToggleSaveResponse:
    return community_service.toggle_save(db, current_user, trip_plan_id)


@router.get("/trips/{trip_plan_id}/comments", response_model=CommentListResponse)
def list_comments(
    trip_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentListResponse:
    return community_service.list_comments(db, current_user, trip_plan_id)


@router.post("/trips/{trip_plan_id}/comments", response_model=CommentPublic, status_code=status.HTTP_201_CREATED)
def add_comment(
    trip_plan_id: int,
    payload: CreateCommentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentPublic:
    return community_service.add_comment(db, current_user, trip_plan_id, payload.body)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    community_service.delete_comment(db, current_user, comment_id)
