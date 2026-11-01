import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.models.archimate import User, UserRoleAssignment
from app.services.api_key_service import generate_api_key, verify_api_key, revoke_api_key
from app.services.auth_service import create_access_token

# Test DB in memory or dedicated test file
TEST_DB_URL = "sqlite:///./test_api_keys.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_teardown_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    # Create test admin user
    user = User(
        id="usr-b2b-test",
        username="agent_service_user",
        email="agent@easyea.local",
        full_name="AI Agent Service Account",
        is_active=True
    )
    db.add(user)
    db.commit()

    role = UserRoleAssignment(
        id="role-b2b-admin",
        user_id="usr-b2b-test",
        role="admin",
        model_id=None
    )
    db.add(role)
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)


def test_api_key_generation_and_verification():
    db = TestingSessionLocal()
    api_key_obj, raw_key = generate_api_key(db, user_id="usr-b2b-test", name="Antigravity Test Agent")
    assert raw_key.startswith("eea_live_")
    assert api_key_obj.prefix == raw_key[:15]
    assert api_key_obj.is_active is True

    # Verify key
    verified_user = verify_api_key(db, raw_key)
    assert verified_user is not None
    assert verified_user.id == "usr-b2b-test"

    # Verify invalid key returns None
    assert verify_api_key(db, "eea_live_invalidkey1234567890") is None
    assert verify_api_key(db, "not_an_api_key") is None

    # Revoke key
    revoked = revoke_api_key(db, api_key_obj.id)
    assert revoked is True
    assert verify_api_key(db, raw_key) is None
    db.close()


def test_api_key_via_http_endpoints():
    db = TestingSessionLocal()
    _, raw_key = generate_api_key(db, user_id="usr-b2b-test", name="B2B HTTP Agent")
    db.close()

    # 1. Test calling /api/elements/search with X-API-Key header
    res1 = client.get("/api/elements/search?query=test", headers={"X-API-Key": raw_key})
    assert res1.status_code == 200

    # 2. Test calling /api/elements/search with Authorization: Bearer eea_live_...
    res2 = client.get("/api/elements/search?query=test", headers={"Authorization": f"Bearer {raw_key}"})
    assert res2.status_code == 200

    # 3. Test with invalid API key
    res_invalid = client.get("/api/elements/search?query=test", headers={"X-API-Key": "eea_live_tamperedkey999"})
    assert res_invalid.status_code == 401

    # 4. Test listing API keys via endpoint
    res_list = client.get("/api/api-keys", headers={"X-API-Key": raw_key})
    assert res_list.status_code == 200
    keys = res_list.json()
    assert len(keys) >= 1
    assert any(k["name"] == "B2B HTTP Agent" for k in keys)

    # 5. Test creating another key via endpoint
    res_create = client.post(
        "/api/api-keys",
        json={"name": "Second Agent", "expires_in_days": 30},
        headers={"X-API-Key": raw_key}
    )
    assert res_create.status_code == 201
    created_data = res_create.json()
    new_raw_key = created_data["raw_key"]
    assert new_raw_key.startswith("eea_live_")

    # 6. Test revoking key
    res_delete = client.delete(f"/api/api-keys/{created_data['id']}", headers={"X-API-Key": raw_key})
    assert res_delete.status_code == 200

    # Now using the revoked key must fail with 401
    res_revoked = client.get("/api/elements/search?query=test", headers={"X-API-Key": new_raw_key})
    assert res_revoked.status_code == 401


def test_mcp_access_administrative_toggle():
    db = TestingSessionLocal()
    _, raw_key = generate_api_key(db, user_id="usr-b2b-test", name="MCP Test Agent")
    from app.services.auth_service import get_system_auth_settings
    auth_cfg = get_system_auth_settings(db)
    auth_cfg.allow_mcp_access = True
    db.commit()
    db.close()

    # 1. With allow_mcp_access = True, MCP caller succeeds
    res_allowed = client.get(
        "/api/elements/search?query=test",
        headers={"X-API-Key": raw_key, "X-MCP-Agent": "true"}
    )
    assert res_allowed.status_code == 200

    # 2. Disable allow_mcp_access via admin config
    db = TestingSessionLocal()
    auth_cfg = get_system_auth_settings(db)
    auth_cfg.allow_mcp_access = False
    db.commit()
    db.close()

    # 3. With allow_mcp_access = False, MCP caller is rejected with 403
    res_blocked = client.get(
        "/api/elements/search?query=test",
        headers={"X-API-Key": raw_key, "X-MCP-Agent": "true"}
    )
    assert res_blocked.status_code == 403
    assert "disabilitato" in res_blocked.json()["detail"]

    # 4. Standard non-MCP caller still succeeds
    res_standard = client.get(
        "/api/elements/search?query=test",
        headers={"X-API-Key": raw_key}
    )
    assert res_standard.status_code == 200
