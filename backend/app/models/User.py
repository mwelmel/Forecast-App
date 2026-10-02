from sqlalchemy import Integer,String,Boolean,DateTime, Column
from app.core.database import Base 

# table user
class Users(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash  = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, nullable=False)
