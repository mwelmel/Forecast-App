from pydantic import BaseModel, Field
from typing import Optional 

class UserCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    username: str = Field(min_length=3, max_length=60)
    password: str = Field(min_length=6, max_length=10)
    role: str 
    is_active: bool = True 

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=100)
    username: Optional[str] = Field(default=None, max_length=60)
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    user_id: int
    full_name: str
    username: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True
