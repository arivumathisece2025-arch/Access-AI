"""Authentication: SQLite users + bcrypt hashes + JWT sessions.

Feature endpoints remain open for the demo, benchmark, and mobile client.
"""
from __future__ import annotations

import os
import re
import sqlite3
import time
from contextlib import closing
from pathlib import Path

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

DB_PATH = Path(__file__).with_name("access_ai.db")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
TOKEN_TTL_SECONDS = 7 * 24 * 3600
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)


class UserOut(BaseModel):
    id: int | None
    email: str
    display_name: str
    guest: bool = False


class TokenResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    user: UserOut


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    display_name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with closing(_connect()) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at REAL NOT NULL
            )
            """
        )
        conn.commit()


init_db()


def _issue_token(subject: str, email: str, name: str, guest: bool) -> str:
    now = int(time.time())
    payload = {
        "sub": subject,
        "email": email,
        "name": name,
        "guest": guest,
        "iat": now,
        "exp": now + TOKEN_TTL_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _validate_password(password: str) -> None:
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must contain at least one letter and one number.",
        )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest) -> TokenResponse:
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter a valid email address.",
        )
    _validate_password(body.password)
    name = body.display_name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Display name cannot be empty.",
        )
    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    with closing(_connect()) as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (email, name, password_hash, time.time()),
            )
            conn.commit()
            user_id = cur.lastrowid
        except sqlite3.IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )
    token = _issue_token(str(user_id), email, name, guest=False)
    return TokenResponse(token=token, user=UserOut(id=user_id, email=email, display_name=name))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest) -> TokenResponse:
    email = body.email.strip().lower()
    with closing(_connect()) as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if row is None or not bcrypt.checkpw(body.password.encode(), row["password_hash"].encode()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
        )
    token = _issue_token(str(row["id"]), email, row["display_name"], guest=False)
    return TokenResponse(
        token=token,
        user=UserOut(id=row["id"], email=email, display_name=row["display_name"]),
    )


@router.post("/guest", response_model=TokenResponse)
def guest() -> TokenResponse:
    token = _issue_token("guest", "guest@local", "Guest", guest=True)
    return TokenResponse(
        token=token,
        user=UserOut(id=None, email="guest@local", display_name="Guest", guest=True),
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UserOut:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please sign in again.",
        )
    return UserOut(
        id=None if payload["sub"] == "guest" else int(payload["sub"]),
        email=payload["email"],
        display_name=payload["name"],
        guest=bool(payload.get("guest", False)),
    )


@router.get("/me", response_model=UserOut)
def me(user: UserOut = Depends(get_current_user)) -> UserOut:
    return user
