from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_admin_user
from app.models.community import TripComment
from app.models.trip_plan import TripPlan
from app.models.user import User
from app.schemas.admin import (
    AdminStats,
    AdminTripListResponse,
    AdminTripRow,
    AdminUserListResponse,
    AdminUserPatch,
    AdminUserRow,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStats)
def admin_stats(
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminStats:
    return AdminStats(
        users=db.scalar(select(func.count()).select_from(User)) or 0,
        trips=db.scalar(select(func.count()).select_from(TripPlan)) or 0,
        shared_trips=db.scalar(
            select(func.count()).select_from(TripPlan).where(TripPlan.is_shared.is_(True))
        )
        or 0,
        comments=db.scalar(select(func.count()).select_from(TripComment)) or 0,
    )


@router.get("/users", response_model=AdminUserListResponse)
def list_users(
    limit: int = 50,
    offset: int = 0,
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminUserListResponse:
    limit = min(max(limit, 1), 100)
    offset = max(offset, 0)
    total = db.scalar(select(func.count()).select_from(User)) or 0
    trip_counts = dict(
        db.execute(
            select(TripPlan.user_id, func.count())
            .group_by(TripPlan.user_id)
        ).all()
    )
    users = (
        db.execute(
            select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
        )
        .scalars()
        .all()
    )
    items = [
        AdminUserRow(
            id=u.id,
            email=u.email,
            first_name=u.first_name,
            last_name=u.last_name,
            is_admin=u.is_admin,
            created_at=u.created_at,
            trip_count=trip_counts.get(u.id, 0),
        )
        for u in users
    ]
    return AdminUserListResponse(items=items, total=total)


@router.patch("/users/{user_id}")
def patch_user(
    user_id: int,
    body: AdminUserPatch,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminUserRow:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == admin.id and not body.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your own admin access",
        )
    user.is_admin = body.is_admin
    db.commit()
    db.refresh(user)
    trip_count = (
        db.scalar(select(func.count()).select_from(TripPlan).where(TripPlan.user_id == user.id))
        or 0
    )
    return AdminUserRow(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        is_admin=user.is_admin,
        created_at=user.created_at,
        trip_count=trip_count,
    )


@router.get("/trips", response_model=AdminTripListResponse)
def list_trips(
    limit: int = 50,
    offset: int = 0,
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminTripListResponse:
    limit = min(max(limit, 1), 100)
    offset = max(offset, 0)
    total = db.scalar(select(func.count()).select_from(TripPlan)) or 0
    rows = db.execute(
        select(TripPlan, User.email)
        .join(User, TripPlan.user_id == User.id)
        .order_by(TripPlan.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    items = [
        AdminTripRow(
            id=trip.id,
            user_id=trip.user_id,
            user_email=email,
            destination=trip.destination,
            status=trip.status,
            is_shared=trip.is_shared,
            created_at=trip.created_at,
        )
        for trip, email in rows
    ]
    return AdminTripListResponse(items=items, total=total)


@router.delete("/trips/{trip_plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_trip(
    trip_plan_id: int,
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> None:
    trip = db.get(TripPlan, trip_plan_id)
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    db.delete(trip)
    db.commit()


@router.delete("/trips/{trip_plan_id}/share", status_code=status.HTTP_204_NO_CONTENT)
def admin_unshare_trip(
    trip_plan_id: int,
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> None:
    trip = db.get(TripPlan, trip_plan_id)
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    trip.is_shared = False
    trip.share_caption = None
    trip.shared_at = None
    db.commit()
