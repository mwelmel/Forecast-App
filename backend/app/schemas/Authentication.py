from pydantic import BaseModel 

class LoginRequest(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    user_id: int
    full_name: str
    username: str
    role: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse