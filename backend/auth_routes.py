"""Auth-related FastAPI routes for login and current user."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import create_access_token, get_current_user, get_user_by_username, hash_password, require_admin, verify_password
from db import get_db
from models import User
from schemas import UserCreate, UserOut


router = APIRouter()


class TokenResponse(BaseModel):
  access_token: str
  token_type: str = "bearer"
  username: str
  role: str


class LoginRequest(BaseModel):
  username: str
  password: str


class PasswordChangeRequest(BaseModel):
  current_password: str
  new_password: str = Field(min_length=6)


@router.post("/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
  user = get_user_by_username(db, payload.username)
  if user is None or not verify_password(payload.password, user.password_hash):
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
  token = create_access_token(user)
  return TokenResponse(access_token=token, username=user.username, role=user.role)


@router.get("/auth/me")
async def me(current_user: User = Depends(get_current_user)):
  return {"id": current_user.id, "username": current_user.username, "role": current_user.role}


@router.get("/auth/users", response_model=list[UserOut])
async def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
  """List all users (admin only)."""
  return db.query(User).all()


@router.post("/auth/users", response_model=UserOut)
async def create_user(payload: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
  """Create a new user (admin only)."""
  if payload.role not in ("admin", "operator"):
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role must be 'admin' or 'operator'")
  if get_user_by_username(db, payload.username):
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")
  user = User(
    username=payload.username,
    password_hash=hash_password(payload.password),
    role=payload.role,
  )
  db.add(user)
  db.commit()
  db.refresh(user)
  return user


@router.delete("/auth/users/{user_id}")
async def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
  """Delete a user (admin only). Cannot delete yourself."""
  if user_id == current_user.id:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")
  user = db.query(User).filter(User.id == user_id).first()
  if not user:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
  db.delete(user)
  db.commit()
  return {"message": "User deleted"}


@router.post("/auth/change-password")
async def change_password(
  payload: PasswordChangeRequest,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user),
):
  """Change the current user's password."""
  if not verify_password(payload.current_password, current_user.password_hash):
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")
  current_user.password_hash = hash_password(payload.new_password)
  db.commit()
  db.refresh(current_user)
  return {"message": "Password changed successfully"}


def bootstrap_default_users(db: Session) -> None:
  """Create a small set of default users if table is empty."""
  try:
    if db.query(User).count() > 0:
      return
    users = [
      ("admin", "admin123", "admin"),
      ("operator1", "operator123", "operator"),
    ]
    for username, password, role in users:
      if get_user_by_username(db, username) is None:
        db.add(User(username=username, password_hash=hash_password(password), role=role))
    db.commit()
  except Exception as e:
    import logging
    logging.warning(f"Failed to bootstrap users: {e}")
    db.rollback()


