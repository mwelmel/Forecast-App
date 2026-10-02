from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException 
from sqlalchemy.orm import Session

from app.core.database import get_db 
from app.core.security import hash_password
from app.models.User import Users
from app.schemas.User import UserCreate, UserResponse, UserUpdate
from app.dependencies.authorization import require_superuser 

# api edit data user di db 
router = APIRouter(
    prefix="/api/users",
    tags=["Users"]
)

@router.post(
    "",
    response_model=UserResponse,
    status_code=201
)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(require_superuser)
):

    # Cek username
    existing_user = (
        db.query(Users)
        .filter(Users.username == user_data.username)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username sudah digunakan"
        )

    # Validasi role
    allowed_roles = ["super_user", "user"]

    if user_data.role not in allowed_roles:
        raise HTTPException(
            status_code=400,
            detail="Role tidak valid"
        )

    # Hash password
    hashed_password = hash_password(
        user_data.password
    )

    # Buat user baru
    new_user = Users(
        full_name=user_data.full_name,
        username=user_data.username,
        password_hash=hashed_password,
        role=user_data.role,
        is_active=user_data.is_active,
        created_at=datetime.utcnow()
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

@router.patch(
    "/{user_id}",
    response_model=UserResponse
)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(require_superuser)
):

    # Cari user
    user = (
        db.query(Users)
        .filter(Users.user_id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User tidak ditemukan"
        )

    # Cek username jika diubah
    if user_data.username is not None:

        existing_user = (
            db.query(Users)
            .filter(
                Users.username == user_data.username,
                Users.user_id != user_id
            )
            .first()
        )

        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Username sudah digunakan"
            )

        user.username = user_data.username

    # Update full name
    if user_data.full_name is not None:
        user.full_name = user_data.full_name

    # Update role
    if user_data.role is not None:

        allowed_roles = ["super_user", "user"]

        if user_data.role not in allowed_roles:
            raise HTTPException(
                status_code=400,
                detail="Role tidak valid"
            )

        user.role = user_data.role

    # Update status
    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    db.commit()
    db.refresh(user)

    return user

# buat status user
@router.patch(
    "/{user_id}/status",
    response_model=UserResponse
)
def toggle_user_status(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(require_superuser)
):

    user = (
        db.query(Users)
        .filter(Users.user_id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User tidak ditemukan"
        )

    # Mencegah super_user menonaktifkan dirinya sendiri
    if user.user_id == current_user.user_id:
        raise HTTPException(
            status_code=400,
            detail="Tidak dapat mengubah status akun sendiri"
        )

    user.is_active = not user.is_active

    db.commit()
    db.refresh(user)

    return user

# dapetin data user semua 
@router.get("", response_model=list[UserResponse])
def get_users(
    db: Session = Depends(get_db),
    current_user: Users = Depends(require_superuser)
):
    return db.query(Users).all()