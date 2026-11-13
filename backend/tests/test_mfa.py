import pytest
import pyotp
from fastapi.testclient import TestClient
from app.main import app
from app.models import archimate as _archimate_models
from app.core.database import SessionLocal, Base, engine
from app.models.archimate import User, UserRoleAssignment, SystemAuthSettings
from app.services.auth_service import hash_password
from app.services.rbac_service import seed_default_rbac

Base.metadata.create_all(bind=engine)
_init_db = SessionLocal()
seed_default_rbac(_init_db)
_init_db.close()

client = TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_mfa_admin_policy_configuration(db_session):
    # 1. Login as sys_admin to get admin token
    res_login = client.post("/api/auth/login", json={
        "username": "sys_admin",
        "password": "AdminEasyEA2026!"
    })
    assert res_login.status_code == 200
    admin_token = res_login.json()["token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Get current config - check default mfa_policy is "disabled"
    res_cfg = client.get("/api/auth/admin/config", headers=headers)
    assert res_cfg.status_code == 200
    cfg = res_cfg.json()
    assert cfg.get("mfa_policy") in ["disabled", None]

    # 3. Test invalid policy value rejection
    res_invalid = client.put("/api/auth/admin/config", json={
        "mfa_policy": "invalid_mode"
    }, headers=headers)
    assert res_invalid.status_code == 400
    assert "Policy MFA non valida" in res_invalid.json()["detail"]

    # 4. Test updating through all valid options
    valid_options = ["admin_only", "write_roles", "all", "disabled"]
    for opt in valid_options:
        res_update = client.put("/api/auth/admin/config", json={
            "mfa_policy": opt
        }, headers=headers)
        assert res_update.status_code == 200
        assert res_update.json()["config"]["mfa_policy"] == opt

        # Verify via GET
        res_check = client.get("/api/auth/admin/config", headers=headers)
        assert res_check.json()["mfa_policy"] == opt

    # Reset back to disabled for next tests
    client.put("/api/auth/admin/config", json={"mfa_policy": "disabled"}, headers=headers)


def test_mfa_self_service_enrollment_and_login_flow(db_session):
    # Create a dedicated local test user
    username = "mfa_local_user"
    email = "mfa_local@easyea.local"
    password = "TestPassword2026!"

    # Clean up previous if existing
    db_session.query(UserRoleAssignment).filter(UserRoleAssignment.user_id == username).delete()
    db_session.query(User).filter(User.username == username).delete()
    db_session.commit()

    test_user = User(
        id=username,
        username=username,
        email=email,
        full_name="Local MFA Test User",
        password_hash=hash_password(password),
        auth_provider="local",
        external_id=None,
        is_active=True,
        is_mfa_enabled=False,
        totp_secret=None
    )
    db_session.add(test_user)
    db_session.commit()

    # 1. Login without MFA (policy is disabled) -> 200 directly
    res_login = client.post("/api/auth/login", json={
        "username": username,
        "password": password
    })
    assert res_login.status_code == 200
    user_token = res_login.json()["token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 2. Check MFA status
    res_status = client.get("/api/auth/mfa/status", headers=user_headers)
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["is_local"] is True
    assert status_data["is_mfa_enabled"] is False
    assert status_data["is_enforced"] is False

    # 3. Setup MFA
    res_setup = client.post("/api/auth/mfa/setup", headers=user_headers)
    assert res_setup.status_code == 200
    setup_data = res_setup.json()
    assert "secret" in setup_data
    assert "otpauth_url" in setup_data
    assert "<svg" in setup_data["qr_code_svg"]
    secret = setup_data["secret"]

    # 4. Try enabling with wrong code -> 400
    res_fail = client.post("/api/auth/mfa/enable", json={
        "secret": secret,
        "totp_code": "000000"
    }, headers=user_headers)
    assert res_fail.status_code == 400

    # 5. Enable with valid code
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()
    res_enable = client.post("/api/auth/mfa/enable", json={
        "secret": secret,
        "totp_code": valid_code
    }, headers=user_headers)
    assert res_enable.status_code == 200
    assert res_enable.json()["success"] is True

    # 6. Verify MFA status is now enabled
    res_status_after = client.get("/api/auth/mfa/status", headers=user_headers)
    assert res_status_after.json()["is_mfa_enabled"] is True

    # 7. Now try login with password only -> triggers MFA challenge!
    res_challenge = client.post("/api/auth/login", json={
        "username": username,
        "password": password
    })
    assert res_challenge.status_code == 200
    challenge_data = res_challenge.json()
    assert challenge_data["mfa_required"] is True
    assert challenge_data["mfa_setup_required"] is False
    assert "mfa_token" in challenge_data
    assert "token" not in challenge_data or challenge_data["token"] is None
    mfa_token = challenge_data["mfa_token"]

    # 8. Submit invalid TOTP code to /api/auth/login/mfa -> 401
    res_mfa_fail = client.post("/api/auth/login/mfa", json={
        "mfa_token": mfa_token,
        "totp_code": "999999"
    })
    assert res_mfa_fail.status_code == 401

    # 9. Submit valid TOTP code to /api/auth/login/mfa -> 200 with JWT!
    res_mfa_success = client.post("/api/auth/login/mfa", json={
        "mfa_token": mfa_token,
        "totp_code": totp.now()
    })
    assert res_mfa_success.status_code == 200
    assert "token" in res_mfa_success.json()
    new_token = res_mfa_success.json()["token"]

    # 10. Also test single-step login with totp_code in payload -> 200 directly
    res_single_step = client.post("/api/auth/login", json={
        "username": username,
        "password": password,
        "totp_code": totp.now()
    })
    assert res_single_step.status_code == 200
    assert "token" in res_single_step.json()

    # 11. Disable MFA with wrong password -> 401
    res_dis_fail = client.post("/api/auth/mfa/disable", json={
        "password": "WrongPassword!"
    }, headers={"Authorization": f"Bearer {new_token}"})
    assert res_dis_fail.status_code == 401

    # 12. Disable MFA with correct password -> 200
    res_dis_ok = client.post("/api/auth/mfa/disable", json={
        "password": password
    }, headers={"Authorization": f"Bearer {new_token}"})
    assert res_dis_ok.status_code == 200

    # Cleanup
    db_session.query(User).filter(User.username == username).delete()
    db_session.commit()


def test_mfa_policy_enforcement_and_mandatory_enrollment(db_session):
    # Setup admin token
    res_admin_login = client.post("/api/auth/login", json={
        "username": "sys_admin",
        "password": "AdminEasyEA2026!"
    })
    admin_token = res_admin_login.json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create users with different roles:
    # 1. arch_user -> architect (write role)
    # 2. view_user -> viewer (read-only role)
    # 3. oidc_user -> federated user (Keycloak)
    arch_username = "mfa_arch_user"
    view_username = "mfa_view_user"
    oidc_username = "mfa_keycloak_user"
    pwd = "GenericPassword123!"

    for u in [arch_username, view_username, oidc_username]:
        db_session.query(UserRoleAssignment).filter(UserRoleAssignment.user_id == u).delete()
        db_session.query(User).filter(User.username == u).delete()
    db_session.commit()

    arch_user = User(
        id=arch_username, username=arch_username, email="arch@easyea.local",
        full_name="Architect User", password_hash=hash_password(pwd),
        auth_provider="local", is_active=True, is_mfa_enabled=False
    )
    view_user = User(
        id=view_username, username=view_username, email="view@easyea.local",
        full_name="Viewer User", password_hash=hash_password(pwd),
        auth_provider="local", is_active=True, is_mfa_enabled=False
    )
    oidc_user = User(
        id=oidc_username, username=oidc_username, email="oidc@corporate.com",
        full_name="Keycloak Federated User", password_hash=None,
        auth_provider="keycloak", external_id="kc-sub-123456", is_active=True, is_mfa_enabled=False
    )
    db_session.add_all([arch_user, view_user, oidc_user])
    db_session.commit()

    # Assign roles
    arch_role = UserRoleAssignment(id=f"role-{arch_username}", user_id=arch_username, role="architect")
    view_role = UserRoleAssignment(id=f"role-{view_username}", user_id=view_username, role="viewer")
    oidc_role = UserRoleAssignment(id=f"role-{oidc_username}", user_id=oidc_username, role="admin")
    db_session.add_all([arch_role, view_role, oidc_role])
    db_session.commit()

    try:
        # A. SET POLICY TO 'admin_only'
        client.put("/api/auth/admin/config", json={"mfa_policy": "admin_only"}, headers=admin_headers)

        # Arch user logging in: NOT admin -> succeeds directly without MFA challenge
        res_arch = client.post("/api/auth/login", json={"username": arch_username, "password": pwd})
        assert res_arch.status_code == 200
        assert "token" in res_arch.json()

        # View user logging in: NOT admin -> succeeds directly without MFA challenge
        res_view = client.post("/api/auth/login", json={"username": view_username, "password": pwd})
        assert res_view.status_code == 200
        assert "token" in res_view.json()

        # B. SET POLICY TO 'write_roles'
        client.put("/api/auth/admin/config", json={"mfa_policy": "write_roles"}, headers=admin_headers)

        # Viewer user: read-only -> NO MFA required
        res_view_2 = client.post("/api/auth/login", json={"username": view_username, "password": pwd})
        assert res_view_2.status_code == 200
        assert "token" in res_view_2.json()

        # Architect user: write role -> MANDATORY MFA ENROLLMENT TRIGGERED!
        res_arch_enforce = client.post("/api/auth/login", json={"username": arch_username, "password": pwd})
        assert res_arch_enforce.status_code == 200
        arch_data = res_arch_enforce.json()
        assert arch_data["mfa_required"] is True
        assert arch_data["mfa_setup_required"] is True
        assert "secret" in arch_data
        assert "qr_code_svg" in arch_data
        temp_secret = arch_data["secret"]
        mfa_token = arch_data["mfa_token"]

        # Complete mandatory enrollment via /api/auth/login/mfa
        totp = pyotp.TOTP(temp_secret)
        res_complete_enroll = client.post("/api/auth/login/mfa", json={
            "mfa_token": mfa_token,
            "totp_code": totp.now()
        })
        assert res_complete_enroll.status_code == 200
        assert "token" in res_complete_enroll.json()
        arch_token = res_complete_enroll.json()["token"]

        # Now architect user is enrolled; trying to disable MFA must fail (403 forbidden by policy)
        res_disable_denied = client.post("/api/auth/mfa/disable", json={
            "password": pwd
        }, headers={"Authorization": f"Bearer {arch_token}"})
        assert res_disable_denied.status_code == 403
        assert "richiesta obbligatoriamente" in res_disable_denied.json()["detail"]

        # C. VERIFY FEDERATED KEYCLOAK USER EXEMPTION
        # Self-service MFA setup on federated user must return 400 (managed on IdP)
        from app.services.auth_service import create_access_token
        oidc_token = create_access_token(oidc_user)
        res_oidc_mfa = client.post("/api/auth/mfa/setup", headers={"Authorization": f"Bearer {oidc_token}"})
        assert res_oidc_mfa.status_code == 400
        assert "Keycloak" in res_oidc_mfa.json()["detail"]

    finally:
        # Reset policy back to disabled
        client.put("/api/auth/admin/config", json={"mfa_policy": "disabled"}, headers=admin_headers)
        for u in [arch_username, view_username, oidc_username]:
            db_session.query(UserRoleAssignment).filter(UserRoleAssignment.user_id == u).delete()
            db_session.query(User).filter(User.username == u).delete()
        db_session.commit()
