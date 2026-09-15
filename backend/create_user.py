from app.core.database import SessionLocal 
from app.core.security import hash_password
from app.models.User import Users
from datetime import datetime

db = SessionLocal()

# buat coba buat user 1 dlu
try:
    admin = Users(
        username="admin",
        full_name="meltest",
        password_hash=hash_password("admin123"),
        role="super_user",
        is_active=True,
        created_at=datetime.now()
    )

    db.add(admin)
    db.commit()

    print("admin mel berhasil dibuat")

except Exception as e:
    db.rollback()
    print("gagal membuat admin mel",e)

finally:
    db.close()