from pwdlib import PasswordHash
import jwt
import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

password_hash = PasswordHash.recommended()

Secret_key = os.getenv("Secret_key")
algorithm = "HS256"
access_token_expire_minutes = 60

#  function hash pw nya 
def hash_password(password: str):
    return password_hash.hash(password)

def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(minutes=access_token_expire_minutes)

    to_encode.update({"exp": expire})

    return jwt.encode(to_encode, Secret_key, algorithm=algorithm)