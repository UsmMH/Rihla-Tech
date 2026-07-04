from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.trip import TripDetailResponse


class ShareTripRequest(BaseModel):
    caption: str | None = Field(default=None, max_length=500)


class CommunityAuthor(BaseModel):
    id: int
    display_name: str


class CommunityTripItem(BaseModel):
    id: int
    destination: str | None
    start_date: date | None
    end_date: date | None
    theme: str | None
    trip_purpose: str | None
    num_days: int
    activity_count: int
    share_caption: str | None
    shared_at: datetime
    author: CommunityAuthor
    vote_count: int
    comment_count: int
    save_count: int
    viewer_voted: bool
    viewer_saved: bool
    is_owner: bool


class CommunityFeedResponse(BaseModel):
    trips: list[CommunityTripItem]


class ShareTripResponse(BaseModel):
    trip_plan_id: int
    is_shared: bool
    share_caption: str | None
    shared_at: datetime | None


class ToggleVoteResponse(BaseModel):
    voted: bool
    vote_count: int


class ToggleSaveResponse(BaseModel):
    saved: bool
    save_count: int


class CommentPublic(BaseModel):
    id: int
    body: str
    created_at: datetime
    author: CommunityAuthor
    is_mine: bool


class CommentListResponse(BaseModel):
    comments: list[CommentPublic]


class CreateCommentRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class CommunityTripDetailResponse(BaseModel):
    trip: TripDetailResponse
    share_caption: str | None
    shared_at: datetime
    author: CommunityAuthor
    vote_count: int
    comment_count: int
    save_count: int
    viewer_voted: bool
    viewer_saved: bool
    is_owner: bool
