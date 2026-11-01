import time
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import get_db, SessionLocal, engine, Base
from app.models.archimate import User, UserRoleAssignment, RevokedToken
from app.services.auth_service import (
    create_access_token,
    decode_access_token,
    revoke_token,
    is_token_revoked,
    clean_expired_revoked_tokens,
    hash_password
)

# Ensure all tables (including revoked_tokens) exist
Base.metadata.create_all(bind=engine)
client = TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def test_user(db: Session):
    unique_id = uuid.uuid4().hex[:8]
    username = f"revtest_{unique_id}"
    email = f"rev_{unique_id}@easyea.test"
    user = User(
        id=str(uuid.uuid4()),
        username=username,
        email=email,
        full_name="Revocation Test User",
        password_hash=hash_password("TestPassword123!"),
        auth_provider="local",
        is_active=True
    )
    db.add(user)
    db.flush()

    role = UserRoleAssignment(
        id=str(uuid.uuid4()),
        user_id=user.id,
        role="admin",
        model_id=None
    )
    db.add(role)
    db.commit()
    db.refresh(user)

    yield user

    # Cleanup
    db.query(RevokedToken).filter(RevokedToken.user_id == user.id).delete()
    db.query(UserRoleAssignment).filter(UserRoleAssignment.user_id == user.id).delete()
    db.query(User).filter(User.id == user.id).delete()
    db.commit()


def test_token_contains_jti(test_user):
    """Verify that newly minted JWT access tokens contain a unique JTI claim."""
    token = create_access_token(test_user)
    payload = decode_access_token(token)
    assert payload is not None
    assert "jti" in payload
    assert isinstance(payload["jti"], str)
    assert len(payload["jti"]) > 10


def test_logout_revokes_token_in_database(test_user, db: Session):
    """Verify that calling /logout invalidates the session and adds JTI to revoked_tokens table."""
    # 1. Login to get token
    login_resp = client.post("/api/auth/login", json={
        "username": test_user.username,
        "password": "TestPassword123!"
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["token"]

    payload = decode_access_token(token)
    assert payload is not None
    jti = payload["jti"]

    # Verify token is valid and not yet revoked
    assert not is_token_revoked(db, jti)
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["id"] == test_user.id

    # 2. Perform Logout
    logout_resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_resp.status_code == 200
    assert logout_resp.json()["success"] is True

    # 3. Check database blacklist
    assert is_token_revoked(db, jti)
    revoked_entry = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
    assert revoked_entry is not None
    assert revoked_entry.user_id == test_user.id
    assert revoked_entry.reason == "logout"
    assert revoked_entry.expires_at is not None

    # 4. Attempt to use revoked token on protected endpoint -> 401 Unauthorized
    me_after_logout = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_after_logout.status_code == 401
    assert "revoked" in me_after_logout.json()["detail"].lower()


def test_logout_with_body_payload(test_user, db: Session):
    """Verify token revocation when passing token in the JSON body."""
    token = create_access_token(test_user)
    payload = decode_access_token(token)
    jti = payload["jti"]

    assert not is_token_revoked(db, jti)

    # Logout with JSON payload
    resp = client.post("/api/auth/logout", json={"token": token})
    assert resp.status_code == 200
    assert is_token_revoked(db, jti)

    # Calling again should be idempotent
    resp_again = client.post("/api/auth/logout", json={"token": token})
    assert resp_again.status_code == 200


def test_clean_expired_revoked_tokens(test_user, db: Session):
    """Verify that expired blacklisted tokens are cleaned up while active ones remain."""
    active_jti = f"active_{uuid.uuid4().hex}"
    expired_jti = f"expired_{uuid.uuid4().hex}"

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    # Past expiration
    expired_entry = RevokedToken(
        id=str(uuid.uuid4()),
        jti=expired_jti,
        token_type="access_token",
        user_id=test_user.id,
        reason="test_expired",
        revoked_at=now - timedelta(days=2),
        expires_at=now - timedelta(hours=1)
    )
    # Future expiration
    active_entry = RevokedToken(
        id=str(uuid.uuid4()),
        jti=active_jti,
        token_type="access_token",
        user_id=test_user.id,
        reason="test_active",
        revoked_at=now,
        expires_at=now + timedelta(hours=1)
    )
    db.add(expired_entry)
    db.add(active_entry)
    db.commit()

    # Run cleanup
    deleted_count = clean_expired_revoked_tokens(db)
    assert deleted_count >= 1

    # Verify expired is deleted, active is still present
    assert db.query(RevokedToken).filter(RevokedToken.jti == expired_jti).first() is None
    assert db.query(RevokedToken).filter(RevokedToken.jti == active_jti).first() is not None

    # Cleanup active
    db.query(RevokedToken).filter(RevokedToken.jti == active_jti).delete()
    db.commit()
