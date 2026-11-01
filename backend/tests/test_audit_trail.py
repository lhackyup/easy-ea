import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models.archimate import User, UserRoleAssignment, SecurityAuditLog
from app.services.auth_service import hash_password, create_access_token
from app.services.audit_service import (
    log_security_event,
    verify_audit_trail,
    compute_entry_hash,
    sanitize_details,
    GENESIS_HASH
)

# Ensure tables exist
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
def admin_user(db: Session):
    unique_id = uuid.uuid4().hex[:8]
    user = User(
        id=str(uuid.uuid4()),
        username=f"aud_admin_{unique_id}",
        email=f"aud_admin_{unique_id}@easyea.test",
        full_name="Audit Administrator",
        password_hash=hash_password("AdminPass123!"),
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
    db.query(SecurityAuditLog).filter(SecurityAuditLog.actor_id == user.id).delete()
    db.query(UserRoleAssignment).filter(UserRoleAssignment.user_id == user.id).delete()
    db.query(User).filter(User.id == user.id).delete()
    db.commit()


@pytest.fixture
def regular_user(db: Session):
    unique_id = uuid.uuid4().hex[:8]
    user = User(
        id=str(uuid.uuid4()),
        username=f"aud_reg_{unique_id}",
        email=f"aud_reg_{unique_id}@easyea.test",
        full_name="Regular Architect",
        password_hash=hash_password("UserPass123!"),
        auth_provider="local",
        is_active=True
    )
    db.add(user)
    db.flush()

    role = UserRoleAssignment(
        id=str(uuid.uuid4()),
        user_id=user.id,
        role="architect",
        model_id=None
    )
    db.add(role)
    db.commit()
    db.refresh(user)

    yield user

    db.query(SecurityAuditLog).filter(SecurityAuditLog.actor_id == user.id).delete()
    db.query(UserRoleAssignment).filter(UserRoleAssignment.user_id == user.id).delete()
    db.query(User).filter(User.id == user.id).delete()
    db.commit()


def test_sanitize_details_masks_credentials():
    """Verify sensitive keys like passwords, tokens and secrets are redacted."""
    raw = {
        "username": "alice",
        "password": "SuperSecretPassword123!",
        "token": "bearer.jwt.xyz",
        "mfa_token": "challenge-token-123",
        "totp_secret": "JBSWY3DPEHPK3PXP",
        "nested": {
            "api_key": "eea_live_secret",
            "normal_field": "public_value"
        }
    }
    cleaned = sanitize_details(raw)
    assert cleaned["username"] == "alice"
    assert cleaned["password"] == "[REDACTED]"
    assert cleaned["token"] == "[REDACTED]"
    assert cleaned["mfa_token"] == "[REDACTED]"
    assert cleaned["totp_secret"] == "[REDACTED]"
    assert cleaned["nested"]["api_key"] == "[REDACTED]"
    assert cleaned["nested"]["normal_field"] == "public_value"


def test_audit_hash_chaining_and_tamper_detection(db: Session, admin_user):
    """
    Verify:
    1. Cryptographic SHA-256 hash chaining (blockchain structure)
    2. verify_audit_trail detects integrity on valid chain
    3. Tampering with any record in the DB is caught by verify_audit_trail
    """
    # Clean previous logs to start clean chain
    db.query(SecurityAuditLog).delete()
    db.commit()

    # Log 3 events
    entry1 = log_security_event(
        db=db,
        action="AUTH_LOGIN",
        outcome="SUCCESS",
        actor=admin_user,
        details={"ip": "127.0.0.1"}
    )
    assert entry1 is not None
    assert entry1.sequence_number == 1
    assert entry1.prev_hash == GENESIS_HASH

    entry2 = log_security_event(
        db=db,
        action="RBAC_ROLE_ASSIGNED",
        outcome="SUCCESS",
        actor=admin_user,
        target_type="role",
        target_id="usr-test",
        details={"role": "architect"}
    )
    assert entry2 is not None
    assert entry2.sequence_number == 2
    assert entry2.prev_hash == entry1.current_hash

    entry3 = log_security_event(
        db=db,
        action="AUTH_LOGOUT",
        outcome="SUCCESS",
        actor=admin_user
    )
    assert entry3 is not None
    assert entry3.sequence_number == 3
    assert entry3.prev_hash == entry2.current_hash

    # 1. Verify intact chain
    verification = verify_audit_trail(db)
    assert verification["is_valid"] is True
    assert verification["total_records"] == 3
    assert verification["tampered_at_sequence"] is None

    # 2. Simulate Tampering: Malicious DBA changes outcome of record 2
    original_outcome = entry2.outcome
    entry2.outcome = "FAILURE"
    db.commit()

    # Verify detection of modified content
    tampered_verification = verify_audit_trail(db)
    assert tampered_verification["is_valid"] is False
    assert tampered_verification["tampered_at_sequence"] == 2
    assert "Current hash mismatch" in tampered_verification["reason"]

    # Restore record 2 outcome
    entry2.outcome = original_outcome
    db.commit()

    # 3. Verify chain is restored
    restored_verification = verify_audit_trail(db)
    assert restored_verification["is_valid"] is True


def test_audit_api_endpoints_rbac(admin_user, regular_user, db: Session):
    """Verify Admin audit endpoints require administrator privileges and return data."""
    admin_token = create_access_token(admin_user)
    user_token = create_access_token(regular_user)

    # 1. Non-admin is rejected
    res_forbidden = client.get(
        "/api/admin/audit-logs",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert res_forbidden.status_code == 403

    # 2. Admin can list audit logs
    res_list = client.get(
        "/api/admin/audit-logs",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_list.status_code == 200
    data = res_list.json()
    assert "items" in data
    assert "total" in data

    # 3. Admin can verify integrity
    res_verify = client.get(
        "/api/admin/audit-logs/verify",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_verify.status_code == 200
    assert "is_valid" in res_verify.json()

    # 4. Admin can get summary stats
    res_summary = client.get(
        "/api/admin/audit-logs/summary",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_summary.status_code == 200
    summary_data = res_summary.json()
    assert "total_records" in summary_data
    assert "recent_24h_events" in summary_data


def test_recent_logins_counter_and_api_key_failure(admin_user, regular_user, db: Session):
    """Verify successful login increments recent_24h_logins counter and failed API key is logged."""
    admin_token = create_access_token(admin_user)

    # 1. Get initial summary
    res_init = client.get(
        "/api/admin/audit-logs/summary",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_init.status_code == 200
    init_logins = res_init.json().get("recent_24h_logins", 0)

    # 2. Perform a successful login
    login_res = client.post(
        "/api/auth/login",
        json={"username": regular_user.username, "password": "UserPass123!"}
    )
    assert login_res.status_code == 200

    # 3. Verify counter incremented
    res_after = client.get(
        "/api/admin/audit-logs/summary",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_after.status_code == 200
    new_logins = res_after.json().get("recent_24h_logins", 0)
    assert new_logins == init_logins + 1

    # 4. Attempt access with invalid API Key
    bad_key_res = client.get(
        "/api/auth/me",
        headers={"X-API-Key": "eea_live_badkey999999"}
    )
    assert bad_key_res.status_code == 401

    # 5. Verify failed API Key attempt is logged in audit trail
    failed_api_log = db.query(SecurityAuditLog).filter(
        SecurityAuditLog.action == "AUTH_API_KEY",
        SecurityAuditLog.outcome == "FAILURE"
    ).order_by(SecurityAuditLog.sequence_number.desc()).first()
    assert failed_api_log is not None
    assert failed_api_log.details.get("reason") == "invalid_or_expired_key"
    assert "eea_live_bad" in failed_api_log.details.get("prefix", "")
