from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.models.User import Users
from app.schemas.Authentication import LoginRequest, LoginResponse


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


@router.post("/login", response_model=LoginResponse)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db)
):
    user = (
        db.query(Users)
        .filter(Users.username == data.username)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Username atau password salah"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Akun tidak aktif"
        )

    if not verify_password(
        data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Username atau password salah"
        )

    access_token = create_access_token(
        {
            "sub": str(user.user_id),
            "username": user.username,
            "role": user.role
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "user_id": user.user_id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role
        }
    }