from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.user import (
    EmailVerificationRequest,
    RegisterAcceptedResponse,
    ResendCodeRequest,
    UserLogin,
    UserPublic,
    UserRegister,
)
from app.services.auth import create_access_token, create_user, get_user_by_email, verify_password
from app.services.email import send_verification_email
from app.services.email_verification import (
    consume_verification_code,
    issue_verification_code,
    resend_cooldown_seconds_remaining,
)
from app.services.rate_limit import enforce_rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=RegisterAcceptedResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: UserRegister,
    request: Request,
    db: Session = Depends(get_db),
) -> RegisterAcceptedResponse:
    enforce_rate_limit(request, "auth-register", max_calls=10, window_seconds=60)
    if get_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = create_user(
        db,
        email=payload.email,
        password=payload.password,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone_num=payload.phone_num,
    )
    code = issue_verification_code(db, user)
    send_verification_email(user.email, code)
    return RegisterAcceptedResponse(
        email=user.email,
        message="We sent a 6-digit verification code to your email.",
    )


@router.post("/verify", response_model=TokenResponse)
def verify_email(
    payload: EmailVerificationRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    enforce_rate_limit(request, "auth-verify", max_calls=20, window_seconds=60)
    user = get_user_by_email(db, payload.email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found with this email")

    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email is already verified. Please log in.",
        )

    error = consume_verification_code(db, user, payload.code)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserPublic.model_validate(user))


@router.post("/resend-code", response_model=RegisterAcceptedResponse)
def resend_code(
    payload: ResendCodeRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> RegisterAcceptedResponse:
    enforce_rate_limit(request, "auth-resend", max_calls=10, window_seconds=60)
    user = get_user_by_email(db, payload.email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found with this email")
    if user.is_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email is already verified. Please log in.")

    wait = resend_cooldown_seconds_remaining(user)
    if wait > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {wait}s before requesting another code.",
        )

    code = issue_verification_code(db, user)
    send_verification_email(user.email, code)
    return RegisterAcceptedResponse(
        email=user.email,
        message="A new verification code was sent to your email.",
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    user = get_user_by_email(db, payload.email)
    if user is None or not verify_password(payload.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email to continue.",
        )

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserPublic.model_validate(user))


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
