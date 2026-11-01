import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session

from app.models.archimate import ApiKey, User

API_KEY_PREFIX = "eea_live_"


def _hash_api_key(raw_key: str) -> str:
    """Computes SHA-256 hex digest of the raw API key."""
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def generate_api_key(
    db: Session,
    user_id: str,
    name: str,
    expires_in_days: Optional[int] = None
) -> Tuple[ApiKey, str]:
    """
    Generates a secure API key with prefix 'eea_live_', hashes it,
    stores the hash and metadata in the database, and returns the (ApiKey, raw_key).
    Note: The raw key is only returned once upon generation!
    """
    secret = secrets.token_urlsafe(32)
    raw_key = f"{API_KEY_PREFIX}{secret}"
    prefix = raw_key[:15]  # e.g. "eea_live_abc123"
    hashed = _hash_api_key(raw_key)

    expires_at = None
    if expires_in_days and expires_in_days > 0:
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

    api_key_entry = ApiKey(
        name=name.strip(),
        prefix=prefix,
        hashed_key=hashed,
        user_id=user_id,
        expires_at=expires_at,
        is_active=True
    )
    db.add(api_key_entry)
    db.commit()
    db.refresh(api_key_entry)
    return api_key_entry, raw_key


def verify_api_key(db: Session, raw_key: str) -> Optional[User]:
    """
    Verifies a raw API key. If valid, active, not expired, and associated
    with an active user, updates last_used_at and returns the User.
    """
    if not raw_key or not raw_key.startswith(API_KEY_PREFIX):
        return None

    hashed = _hash_api_key(raw_key.strip())
    api_key = db.query(ApiKey).filter(
        ApiKey.hashed_key == hashed,
        ApiKey.is_active == True
    ).first()

    if not api_key:
        return None

    # Check expiration
    if api_key.expires_at:
        now = datetime.now(timezone.utc)
        exp = api_key.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if now > exp:
            return None

    # Fetch and check user
    user = db.query(User).filter(User.id == api_key.user_id, User.is_active == True).first()
    if not user:
        return None

    # Update last_used_at
    api_key.last_used_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except Exception:
        db.rollback()

    return user


def list_api_keys(db: Session, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists API keys (sanitized, hashed key never exposed)."""
    query = db.query(ApiKey)
    if user_id:
        query = query.filter(ApiKey.user_id == user_id)
    keys = query.order_by(ApiKey.created_at.desc()).all()

    return [
        {
            "id": k.id,
            "name": k.name,
            "prefix": k.prefix + "...",
            "user_id": k.user_id,
            "created_at": k.created_at.isoformat() if k.created_at else None,
            "expires_at": k.expires_at.isoformat() if k.expires_at else None,
            "is_active": k.is_active,
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None
        }
        for k in keys
    ]


def revoke_api_key(db: Session, key_id: str, user_id: Optional[str] = None) -> bool:
    """Revokes (deactivates) an API key."""
    query = db.query(ApiKey).filter(ApiKey.id == key_id)
    if user_id:
        query = query.filter(ApiKey.user_id == user_id)
    key = query.first()
    if not key:
        return False
    key.is_active = False
    db.commit()
    return True
