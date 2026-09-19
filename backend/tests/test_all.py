import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.parsers.archi_parser import ArchiModelParser, detect_layer
from app.services.apm_service import calculate_time_quadrant, APMService
from app.services.overlap_service import OverlapService
from app.services.sample_data import seed_sample_model
from app.services.metamodel_service import seed_default_custom_attributes
from app.services.rbac_service import seed_default_rbac

# Test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_sample_model(db)
    seed_default_custom_attributes(db)
    seed_default_rbac(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)

client = TestClient(app)

def test_time_quadrant_logic():
    assert calculate_time_quadrant(5, 5) == "Invest"
    assert calculate_time_quadrant(4, 2) == "Migrate"
    assert calculate_time_quadrant(2, 4) == "Tolerate"
    assert calculate_time_quadrant(1, 1) == "Eliminate"

def test_layer_detection():
    assert detect_layer("ApplicationComponent") == "Application"
    assert detect_layer("BusinessProcess") == "Business"
    assert detect_layer("Capability") == "Strategy"
    assert detect_layer("Node") == "Technology"

def test_archi_parser_native():
    sample_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="Test Archi Model" id="m-1">
      <folder name="Business" id="f-biz" type="business">
        <element xsi:type="archimate:BusinessProcess" id="bp-1" name="Order Intake"/>
      </folder>
      <folder name="Application" id="f-app" type="application">
        <element xsi:type="archimate:ApplicationComponent" id="app-1" name="SAP ERP"/>
      </folder>
      <folder name="Relations" id="f-rel" type="relations">
        <element xsi:type="archimate:ServingRelationship" id="rel-1" source="app-1" target="bp-1" name="Serves Process"/>
      </folder>
    </archimate:model>
    """
    parser = ArchiModelParser(sample_xml)
    res = parser.parse()
    assert res["name"] == "Test Archi Model"
    assert len(res["elements"]) == 2
    assert len(res["relationships"]) == 1
    assert res["elements"][0]["name"] == "Order Intake"
    assert res["elements"][0]["layer"] == "Business"
    assert res["relationships"][0]["source_id"] == "app-1"

def test_api_models():
    response = client.get("/api/models")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert data[0]["id"] == "sample-easybank-ea"
    assert data[0]["code"] == "EASY"

def test_library_code_lifecycle():
    # 1. Create with custom code
    res1 = client.post("/api/models", json={"name": "Finance Model", "code": "FINA"})
    assert res1.status_code == 200
    m1 = res1.json()
    assert m1["code"] == "FINA"
    assert m1["name"] == "Finance Model"

    # 2. Duplicate code rejected
    res_dup = client.post("/api/models", json={"name": "Another Finance", "code": "FINA"})
    assert res_dup.status_code == 400

    # 3. Invalid code formats rejected (must be 4 uppercase letters)
    res_short = client.post("/api/models", json={"name": "Bad Code", "code": "ABC"})
    assert res_short.status_code == 400
    res_num = client.post("/api/models", json={"name": "Bad Code", "code": "AB12"})
    assert res_num.status_code == 400

    # 4. Auto-generate code from name
    res_auto = client.post("/api/models", json={"name": "Digital Payment System Core"})
    assert res_auto.status_code == 200
    m_auto = res_auto.json()
    assert len(m_auto["code"]) == 4
    assert m_auto["code"].isalpha() and m_auto["code"].isupper()

    # 5. Immutability: PUT update doesn't alter code
    res_up = client.put(f"/api/models/{m1['id']}", json={"name": "Finance Model Renamed", "code": "HACK"})
    assert res_up.status_code == 200
    detail = client.get(f"/api/models/{m1['id']}").json()
    assert detail["name"] == "Finance Model Renamed"
    assert detail["code"] == "FINA"

def test_api_apm_portfolio():
    response = client.get("/api/apm/portfolio/sample-easybank-ea")
    assert response.status_code == 200
    data = response.json()
    assert data["total_applications"] > 0
    assert "Invest" in data["time_distribution"]
    assert data["total_annual_cost"] > 0

def test_api_overlap_matrix():
    response = client.get("/api/overlap/matrix/sample-easybank-ea")
    assert response.status_code == 200
    data = response.json()
    assert data["total_capabilities"] > 0
    assert len(data["redundancy_clusters"]) > 0
    # Customer Relationship Management should have 2 applications (Salesforce + Legacy CRM)
    crm_cluster = next((c for c in data["redundancy_clusters"] if "Customer" in c["capability_name"]), None)
    assert crm_cluster is not None
    assert crm_cluster["app_count"] == 2

def test_api_processes():
    response = client.get("/api/processes/catalog/sample-easybank-ea")
    assert response.status_code == 200
    data = response.json()
    assert data["total_processes"] > 0

def test_api_impact_simulation():
    response = client.get("/api/processes/impact/sample-easybank-ea/app-cloud-core")
    assert response.status_code == 200
    data = response.json()
    assert "impact_summary" in data
    assert data["impact_summary"]["total_impacted_processes"] > 0

def test_library_custom_attributes():
    # 1. Create a library-scoped attribute for sample-easybank-ea (code 'EASY')
    payload = {
        "name": "cost_center",
        "label": "Cost Center Allocation",
        "model_id": "sample-easybank-ea",
        "element_type": "ApplicationComponent",
        "layer": "Application",
        "data_type": "string"
    }
    res = client.post("/api/metamodel/attributes", json=payload)
    assert res.status_code == 200
    created = res.json()
    assert created["name"] == "easy_cost_center"
    assert created["library_code"] == "EASY"
    assert created["model_id"] == "sample-easybank-ea"

    # 2. Query metamodel with model_id=sample-easybank-ea
    res_meta = client.get("/api/metamodel/types?model_id=sample-easybank-ea")
    assert res_meta.status_code == 200
    layers = res_meta.json()
    app_layer = next(l for l in layers if l["layer"] == "Application")
    app_comp = next(e for e in app_layer["element_types"] if e["type"] == "ApplicationComponent")
    custom_names = [a["name"] for a in app_comp.get("custom_attributes", [])]
    assert "easy_cost_center" in custom_names

    # 3. Query global metamodel (model_id=None) -> should NOT contain easy_cost_center
    res_global = client.get("/api/metamodel/types")
    assert res_global.status_code == 200
    g_layers = res_global.json()
    g_app_layer = next(l for l in g_layers if l["layer"] == "Application")
    g_app_comp = next(e for e in g_app_layer["element_types"] if e["type"] == "ApplicationComponent")
    g_custom_names = [a["name"] for a in g_app_comp.get("custom_attributes", [])]
    assert "easy_cost_center" not in g_custom_names

    # 4. Duplicate name rejected in same library
    res_dup = client.post("/api/metamodel/attributes", json=payload)
    assert res_dup.status_code == 400

def test_custom_attribute_sections_and_updates():
    # 1. Create attribute with custom section
    payload = {
        "name": "sec_audit_score",
        "label": "Security Audit Score",
        "section": "Security & Compliance",
        "element_type": "ApplicationComponent",
        "layer": "Application",
        "data_type": "number"
    }
    res = client.post("/api/metamodel/attributes", json=payload)
    assert res.status_code == 200
    attr = res.json()
    attr_id = attr["id"]
    assert attr["section"] == "Security & Compliance"

    # 2. Update custom attribute (e.g. change section and label)
    update_payload = {
        "label": "Cybersecurity & Audit Score",
        "section": "Cybersecurity & Risk",
        "is_required": True
    }
    res_update = client.put(f"/api/metamodel/attributes/{attr_id}", json=update_payload)
    assert res_update.status_code == 200
    updated = res_update.json()
    assert updated["label"] == "Cybersecurity & Audit Score"
    assert updated["section"] == "Cybersecurity & Risk"
    assert updated["is_required"] is True

    # 3. Rename section in bulk
    rename_payload = {
        "old_section": "Cybersecurity & Risk",
        "new_section": "InfoSec & Governance"
    }
    res_rename = client.put("/api/metamodel/sections/rename", json=rename_payload)
    assert res_rename.status_code == 200
    rename_res = res_rename.json()
    assert rename_res["updated_count"] >= 1

    # Verify query returns new section name
    res_list = client.get("/api/metamodel/attributes?element_type=ApplicationComponent")
    assert res_list.status_code == 200
    items = res_list.json()
    matched = next((a for a in items if a["id"] == attr_id), None)
    assert matched is not None
    assert matched["section"] == "InfoSec & Governance"

def test_easy_ea_extension_attributes_management():
    # 1. Metamodel query should contain eea_ attributes under custom_attributes with is_system=True
    res = client.get("/api/metamodel/types")
    assert res.status_code == 200
    layers = res.json()
    app_layer = next(l for l in layers if l["layer"] == "Application")
    app_comp = next(e for e in app_layer["element_types"] if e["type"] == "ApplicationComponent")
    
    # Core attributes should only have 3 standard ArchiMate attributes
    std_names = [a["name"] for a in app_comp["standard_attributes"]]
    assert "id" in std_names
    assert "name" in std_names
    assert "documentation" in std_names
    assert "in_apm_scope" not in std_names
    
    # Custom attributes should contain eea_ attributes with is_system=True
    custom_attrs = app_comp.get("custom_attributes", [])
    eea_annual_cost = next((a for a in custom_attrs if a["name"] == "eea_annual_cost"), None)
    assert eea_annual_cost is not None
    assert eea_annual_cost["is_system"] is True
    assert eea_annual_cost["section"] == "APM & Business Portfolio"
    
    # 2. Reassigning section for eea_annual_cost to "Financial Governance" should succeed
    cost_id = eea_annual_cost["id"]
    res_update = client.put(f"/api/metamodel/attributes/{cost_id}", json={
        "section": "Financial Governance",
        "label": "Annual Cost / TCO (€) Updated"
    })
    assert res_update.status_code == 200
    updated_cost = res_update.json()
    assert updated_cost["section"] == "Financial Governance"
    assert updated_cost["label"] == "Annual Cost / TCO (€) Updated"
    assert updated_cost["is_system"] is True
    assert updated_cost["name"] == "eea_annual_cost" # technical name preserved
    
    # 3. Attempting to delete eea_ system attribute should fail with 400
    res_del = client.delete(f"/api/metamodel/attributes/{cost_id}")
    assert res_del.status_code == 400
    assert "cannot be deleted" in res_del.json()["detail"].lower()

def test_rbac_global_vs_library_scoped_permissions():
    # 1. Check roles metadata
    res_roles = client.get("/api/rbac/roles")
    assert res_roles.status_code == 200
    roles_data = res_roles.json()
    roles = roles_data["roles"]
    role_keys = [r["role"] for r in roles]
    assert "admin" in role_keys
    assert "architect" in role_keys
    assert "analyst" in role_keys
    assert "executive" in role_keys

    # Admin is global, others are library-scoped
    admin_def = next(r for r in roles if r["role"] == "admin")
    assert admin_def["scope_type"] == "global"
    arch_def = next(r for r in roles if r["role"] == "architect")
    assert arch_def["scope_type"] == "library"

    # 2. Create a test library Y
    lib_y_payload = {
        "name": "Library Y Test",
        "code": "LIBY",
        "description": "Second test library"
    }
    res_lib_y = client.post("/api/models", json=lib_y_payload)
    assert res_lib_y.status_code == 200
    lib_y_id = res_lib_y.json()["id"]

    # 3. Create users
    u_arch = client.post("/api/rbac/users", json={
        "email": "architect_x@easyea.local",
        "full_name": "Architect For Lib X"
    }).json()
    u_arch_id = u_arch["id"]

    u_analyst = client.post("/api/rbac/users", json={
        "email": "analyst_x@easyea.local",
        "full_name": "Analyst For Lib X"
    }).json()
    u_analyst_id = u_analyst["id"]

    # 4. Assign roles:
    # Architect -> Library sample-easybank-ea
    assign_arch = client.post("/api/rbac/assignments", json={
        "user_id": u_arch_id,
        "role": "architect",
        "model_id": "sample-easybank-ea"
    })
    assert assign_arch.status_code == 200
    arch_assignment_id = assign_arch.json()["id"]

    # Analyst -> Library sample-easybank-ea
    assign_analyst = client.post("/api/rbac/assignments", json={
        "user_id": u_analyst_id,
        "role": "analyst",
        "model_id": "sample-easybank-ea"
    })
    assert assign_analyst.status_code == 200

    # Non-admin without model_id should fail
    fail_assign = client.post("/api/rbac/assignments", json={
        "user_id": u_arch_id,
        "role": "architect"
    })
    assert fail_assign.status_code == 400

    # 5. Permission checks:
    # Architect on Library sample-easybank-ea (write_architecture) -> True
    chk1 = client.post("/api/rbac/check-permission", json={
        "user_id": u_arch_id,
        "action": "write_architecture",
        "model_id": "sample-easybank-ea"
    }).json()
    assert chk1["allowed"] is True

    # Architect on Library Y (write_architecture) -> False! (Isolated scope)
    chk2 = client.post("/api/rbac/check-permission", json={
        "user_id": u_arch_id,
        "action": "write_architecture",
        "model_id": lib_y_id
    }).json()
    assert chk2["allowed"] is False

    # Architect trying to do manage_system_metamodel -> False (Admin only)
    chk3 = client.post("/api/rbac/check-permission", json={
        "user_id": u_arch_id,
        "action": "manage_system_metamodel"
    }).json()
    assert chk3["allowed"] is False

    # Analyst on Library sample-easybank-ea for edit_apm_scores -> True
    chk4 = client.post("/api/rbac/check-permission", json={
        "user_id": u_analyst_id,
        "action": "edit_apm_scores",
        "model_id": "sample-easybank-ea"
    }).json()
    assert chk4["allowed"] is True

    # Analyst trying write_architecture -> False
    chk5 = client.post("/api/rbac/check-permission", json={
        "user_id": u_analyst_id,
        "action": "write_architecture",
        "model_id": "sample-easybank-ea"
    }).json()
    assert chk5["allowed"] is False

    # Check Admin permission (admin user from seed)
    users_list = client.get("/api/rbac/users").json()
    admin_user = next((u for u in users_list if any(a["role"] == "admin" for a in u.get("role_assignments", []))), None)
    assert admin_user is not None

    chk_admin_liby = client.post("/api/rbac/check-permission", json={
        "user_id": admin_user["id"],
        "action": "write_architecture",
        "model_id": lib_y_id
    }).json()
    assert chk_admin_liby["allowed"] is True

    # 6. Delete role assignment
    del_res = client.delete(f"/api/rbac/assignments/{arch_assignment_id}")
    assert del_res.status_code == 200

    # After deletion, permission is revoked
    chk_revoked = client.post("/api/rbac/check-permission", json={
        "user_id": u_arch_id,
        "action": "write_architecture",
        "model_id": "sample-easybank-ea"
    }).json()
    assert chk_revoked["allowed"] is False


def test_auth_flow():
    # 1. Login with sys_admin username and correct password
    res_login = client.post("/api/auth/login", json={
        "username": "sys_admin",
        "password": "AdminEasyEA2026!"
    })
    assert res_login.status_code == 200
    data = res_login.json()
    assert "token" in data
    token = data["token"]
    assert data["user"]["username"] == "sys_admin"
    assert data["user"]["email"] == "sys_admin@easyea.local"
    assert any(a["role"] == "admin" for a in data["user"]["assignments"])

    # 2. Login with email
    res_email_login = client.post("/api/auth/login", json={
        "username": "sys_admin@easyea.local",
        "password": "AdminEasyEA2026!"
    })
    assert res_email_login.status_code == 200

    # 3. Login with wrong password
    res_fail = client.post("/api/auth/login", json={
        "username": "sys_admin",
        "password": "WrongPassword123"
    })
    assert res_fail.status_code == 401

    # 4. Get Current User with valid token
    res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_me.status_code == 200
    me_data = res_me.json()
    assert me_data["username"] == "sys_admin"

    # 5. Get Current User with invalid token
    res_me_invalid = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.token.value"})
    assert res_me_invalid.status_code == 401

    # 6. Logout endpoint
    res_logout = client.post("/api/auth/logout")
    assert res_logout.status_code == 200


def test_oidc_public_config_and_login_flow():
    # 1. Check OIDC config
    res_cfg = client.get("/api/auth/oidc/config")
    assert res_cfg.status_code == 200
    cfg = res_cfg.json()
    assert cfg["enabled"] is True
    assert "login_url" in cfg
    assert cfg["provider_name"] == "Keycloak SSO"
    assert cfg["rbac_mode"] == "hybrid"

    # 2. Check OIDC login redirect
    res_login = client.get("/api/auth/oidc/login", follow_redirects=False)
    assert res_login.status_code == 302
    location = res_login.headers.get("location", "")
    assert "response_type=code" in location
    assert "client_id=easyea-client" in location


def test_hybrid_user_provisioning_and_role_sync():
    from app.services.auth_service import provision_or_sync_oidc_user
    db = TestingSessionLocal()
    try:
        # Simulate IdP claims with Keycloak admin role
        admin_claims = {
            "sub": "keycloak-user-admin-uuid-1",
            "email": "keycloak_admin@company.com",
            "name": "Giulia Bianchi",
            "preferred_username": "giulia_admin",
            "realm_access": {"roles": ["admin", "default-roles-easyea"]},
            "groups": ["/easyea-admins"]
        }
        user = provision_or_sync_oidc_user(db, admin_claims)
        assert user.email == "keycloak_admin@company.com"
        assert user.full_name == "Giulia Bianchi"
        assert "keycloak" in user.auth_provider.lower()
        assert user.external_id == "keycloak-user-admin-uuid-1"

        # Check hybrid role assignment: global admin was assigned
        roles = [a.role for a in user.role_assignments]
        assert "admin" in roles

        # Simulate IdP claims for an architect with custom library assignment
        architect_claims = {
            "sub": "keycloak-user-arch-uuid-2",
            "email": "arch_user@company.com",
            "name": "Marco Verdi",
            "preferred_username": "mverdi",
            "realm_access": {"roles": ["architect"]},
            "groups": ["/easyea-architects"]
        }
        arch_user = provision_or_sync_oidc_user(db, architect_claims)
        arch_roles = [a.role for a in arch_user.role_assignments]
        assert "architect" in arch_roles
    finally:
        db.close()


def test_admin_auth_config_crud_and_anti_lockout():
    # 1. Get current config
    res = client.get("/api/auth/admin/config")
    assert res.status_code == 200
    cfg = res.json()
    assert "allow_local_login" in cfg
    assert "allow_idp_login" in cfg
    assert "role_mappings" in cfg
    assert isinstance(cfg["role_mappings"], list)

    # 2. Update config: add a custom role mapping rule
    new_rule = {
        "id": "custom-rule-test",
        "claim_type": "realm_role",
        "claim_name": "lead_architect",
        "expected_value": "",
        "target_role": "architect",
        "target_model_id": None,
        "description": "Test custom mapping"
    }
    updated_mappings = list(cfg["role_mappings"]) + [new_rule]
    update_payload = {
        "provider_name": "Corporate Keycloak IdP",
        "prompt_login": True,
        "rbac_mode": "hybrid",
        "role_mappings": updated_mappings
    }
    res_update = client.put("/api/auth/admin/config", json=update_payload)
    assert res_update.status_code == 200
    updated_data = res_update.json()
    assert updated_data["config"]["provider_name"] == "Corporate Keycloak IdP"
    assert updated_data["config"]["prompt_login"] is True

    # 3. Test Anti-Lockout safeguard: cannot disable both local and idp login
    res_lockout = client.put("/api/auth/admin/config", json={
        "allow_local_login": False,
        "allow_idp_login": False
    })
    assert res_lockout.status_code == 400
    assert "Impossibile disabilitare contemporaneamente" in res_lockout.json()["detail"]




