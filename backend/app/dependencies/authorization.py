from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import jwt

from app.core.database import get_db
from app.core.security import Secret_key as SECRET_KEY, algorithm as ALGORITHM
from app.models.User import Users

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# buat cari user sekarang
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token tidak valid")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token tidak valid")

    user = db.query(Users).filter(Users.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User tidak ditemukan")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Akun tidak aktif")

    return user

# fungsi buat super user 
def require_superuser(
    current_user: Users = Depends(get_current_user)
):
    if current_user.role != "super_user":
        raise HTTPException(
            status_code=403,
            detail="Akses ditolak, hanya super user yang diizinkan"
        )
    return current_user


