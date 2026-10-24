import pytest
import io
import zipfile
import openpyxl
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.parsers.archi_parser import ArchiModelParser, detect_layer
from app.services.apm_service import calculate_time_quadrant, APMService
from app.services.overlap_service import OverlapService
from app.services.sample_data import seed_sample_model
from app.services.metamodel_service import seed_default_custom_attributes, compute_archimate_derivation, get_plateau_roadmap
from app.services.rbac_service import seed_default_rbac
from app.services.auth_service import create_access_token
from app.services.process_service import ProcessService
from app.models.archimate import User, ModelWorkspace, ArchimateElement, ArchimateRelationship, ApplicationBusinessAttributes

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

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_sample_model(db)
    seed_default_custom_attributes(db)
    seed_default_rbac(db)
    admin_user = db.query(User).filter(User.username == "admin").first() or db.query(User).first()
    if admin_user:
        token = create_access_token(admin_user)
        client.headers.update({"Authorization": f"Bearer {token}"})
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)

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

def test_attribute_packages_and_extension_management():
    # 1. Metamodel query should contain apm_ and tme_ package attributes under custom_attributes with is_package=True
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
    
    # Custom attributes should contain apm_ and tme_ package attributes
    custom_attrs = app_comp.get("custom_attributes", [])
    apm_annual_cost = next((a for a in custom_attrs if a["name"] == "apm_annual_cost"), None)
    assert apm_annual_cost is not None
    assert apm_annual_cost["is_system"] is True
    assert apm_annual_cost["is_package"] is True
    assert apm_annual_cost["package_code"] == "APM"

    tme_fit = next((a for a in custom_attrs if a["name"] == "tme_business_fit"), None)
    assert tme_fit is not None
    assert tme_fit["package_code"] == "TME"

    # 2. Query packages endpoint
    res_pkgs = client.get("/api/metamodel/packages")
    assert res_pkgs.status_code == 200
    pkgs = res_pkgs.json()
    pkg_codes = [p["code"] for p in pkgs]
    assert "apm" in pkg_codes
    assert "tme" in pkg_codes

    # 3. Create a custom attribute package with 3-character code
    res_create = client.post("/api/metamodel/packages", json={
        "code": "sec",
        "name": "Security & Resilience",
        "description": "Security posture and compliance metrics",
        "icon_color": "rose",
        "is_default_active": False
    })
    assert res_create.status_code == 200
    sec_pkg = res_create.json()
    assert sec_pkg["code"] == "sec"

    # Enforce 3-character code: code with 2 or 4 chars must fail
    res_fail = client.post("/api/metamodel/packages", json={
        "code": "failcode",
        "name": "Invalid"
    })
    assert res_fail.status_code == 400

    # Add item to package - must enforce 3-character prefix
    res_item = client.post(f"/api/metamodel/packages/{sec_pkg['id']}/items", json={
        "name": "sec_compliance_tier",
        "label": "Security Compliance Tier",
        "element_type": "ApplicationComponent",
        "layer": "Application",
        "data_type": "string"
    })
    assert res_item.status_code == 200
    assert res_item.json()["name"] == "sec_compliance_tier"

    # 4. Strict deactivation guard:
    # Populating an element with an attribute of the package and then attempting deactivation must be blocked
    model_id = "sample-easybank-ea"
    # First activate sec package on sample-easybank-ea
    res_act = client.post(f"/api/metamodel/libraries/{model_id}/packages/{sec_pkg['id']}/toggle", json={"active": True})
    assert res_act.status_code == 200
    assert res_act.json()["is_active"] is True

    # Find an element in sample-easybank-ea and populate sec_compliance_tier
    res_elems = client.get(f"/api/elements?model_id={model_id}")
    elem = res_elems.json()[0]
    res_edit = client.put(f"/api/elements/{elem['id']}", json={
        "name": elem["name"],
        "properties": {**(elem.get("properties") or {}), "sec_compliance_tier": "Level 3"}
    })
    assert res_edit.status_code == 200

    # Attempting to deactivate sec package must be blocked with 409
    res_deact_blocked = client.post(f"/api/metamodel/libraries/{model_id}/packages/{sec_pkg['id']}/toggle", json={"active": False})
    assert res_deact_blocked.status_code == 409
    assert res_deact_blocked.json()["detail"]["error"] == "package_deactivation_blocked"

    # Check audit usage endpoint
    res_audit = client.get(f"/api/metamodel/packages/{sec_pkg['id']}/usage")
    assert res_audit.status_code == 200
    audit_data = res_audit.json()
    assert audit_data["total_populated_elements"] >= 1

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


def test_element_creation_and_editing_with_properties_and_sections():
    # 1. Create a new ArchiMate Business Process with custom properties
    create_payload = {
        "name": "Instant Credit Authorization",
        "type": "BusinessProcess",
        "layer": "Business",
        "documentation": "Real-time AI credit assessment and authorization process.",
        "properties": {
            "gdpr_compliance_tier": "Tier 3 - Sensitive / financial data",
            "sla_target_minutes": 15,
            "cost_center_code": "CC-FIN-200"
        }
    }
    res_create = client.post("/api/elements?model_id=sample-easybank-ea", json=create_payload)
    assert res_create.status_code == 200
    created = res_create.json()
    elem_id = created["id"]
    assert created["name"] == "Instant Credit Authorization"
    assert created["type"] == "BusinessProcess"
    assert created["layer"] == "Business"

    # 2. Get element details and verify properties are returned
    res_detail = client.get(f"/api/elements/{elem_id}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["name"] == "Instant Credit Authorization"
    assert detail["properties"]["gdpr_compliance_tier"] == "Tier 3 - Sensitive / financial data"
    assert detail["properties"]["sla_target_minutes"] == 15

    # 3. Update element attributes
    update_payload = {
        "name": "Instant Credit & Risk Authorization (Updated)",
        "documentation": "Updated documentation for automated credit flow.",
        "properties": {
            "gdpr_compliance_tier": "Tier 4 - High-risk / biometric data",
            "sla_target_minutes": 10,
            "cost_center_code": "CC-FIN-200",
            "risk_score_limit": "A+"
        }
    }
    res_update = client.put(f"/api/elements/{elem_id}", json=update_payload)
    assert res_update.status_code == 200

    # 4. Verify updated details
    res_updated_detail = client.get(f"/api/elements/{elem_id}")
    assert res_updated_detail.status_code == 200
    updated_detail = res_updated_detail.json()
    assert updated_detail["name"] == "Instant Credit & Risk Authorization (Updated)"
    assert updated_detail["documentation"] == "Updated documentation for automated credit flow."
    assert updated_detail["properties"]["gdpr_compliance_tier"] == "Tier 4 - High-risk / biometric data"
    assert updated_detail["properties"]["risk_score_limit"] == "A+"

    # 5. Create an ApplicationComponent with APM properties and verify sync
    app_payload = {
        "name": "Cloud Ledger Engine",
        "type": "ApplicationComponent",
        "layer": "Application",
        "documentation": "Next-gen distributed ledger system.",
        "properties": {
            "eea_annual_cost": 75000.0,
            "eea_business_fit": 5,
            "eea_technical_fit": 4,
            "eea_business_owner": "Mario Rossi",
            "rto_hours": 2
        }
    }
    res_app = client.post("/api/elements?model_id=sample-easybank-ea", json=app_payload)
    assert res_app.status_code == 200
    app_id = res_app.json()["id"]

    res_app_detail = client.get(f"/api/elements/{app_id}")
    assert res_app_detail.status_code == 200
    app_data = res_app_detail.json()
    assert app_data["apm"]["annual_cost"] == 75000.0
    assert app_data["apm"]["business_fit"] == 5
    assert app_data["apm"]["business_owner"] == "Mario Rossi"
    assert app_data["properties"]["rto_hours"] == 2

    # 6. Delete the created element
    res_del = client.delete(f"/api/elements/{elem_id}")
    assert res_del.status_code == 200
    res_check = client.get(f"/api/elements/{elem_id}")
    assert res_check.status_code == 404

def test_archimate_relationship_management_and_validation():
    # 1. Query allowed relationship types between ApplicationComponent and BusinessProcess
    res_allowed = client.get("/api/relationships/allowed-types?source_type=ApplicationComponent&target_type=BusinessProcess")
    assert res_allowed.status_code == 200
    allowed_data = res_allowed.json()
    allowed_type_names = [t["type"] for t in allowed_data]
    assert "ServingRelationship" in allowed_type_names
    assert "AssociationRelationship" in allowed_type_names
    assert "AssignmentRelationship" not in allowed_type_names  # ApplicationComponent cannot assign to BusinessProcess in ArchiMate

    # 2. Get two existing elements in sample model
    res_elems = client.get("/api/elements?model_id=sample-easybank-ea")
    assert res_elems.status_code == 200
    elems = res_elems.json()
    app_elem = next(e for e in elems if e["type"] == "ApplicationComponent")
    proc_elem = next(e for e in elems if e["type"] == "BusinessProcess")

    # 3. Create a valid relationship (ApplicationComponent -> BusinessProcess, ServingRelationship)
    valid_payload = {
        "source_id": app_elem["id"],
        "target_id": proc_elem["id"],
        "type": "ServingRelationship",
        "name": "Serves Core Banking Operations",
        "documentation": "Provides automated settlement capabilities to the process."
    }
    res_create = client.post("/api/relationships?model_id=sample-easybank-ea", json=valid_payload)
    assert res_create.status_code == 200
    created_rel = res_create.json()
    rel_id = created_rel["id"]
    assert created_rel["type"] == "ServingRelationship"
    assert created_rel["source_id"] == app_elem["id"]
    assert created_rel["target_id"] == proc_elem["id"]
    assert created_rel["name"] == "Serves Core Banking Operations"

    # 4. Attempt to create an INVALID relationship (ApplicationComponent -> BusinessProcess with AssignmentRelationship)
    invalid_payload = {
        "source_id": app_elem["id"],
        "target_id": proc_elem["id"],
        "type": "AssignmentRelationship",
        "name": "Invalid Assignment"
    }
    res_invalid = client.post("/api/relationships?model_id=sample-easybank-ea", json=invalid_payload)
    assert res_invalid.status_code == 400
    assert "not permitted by ArchiMate 3.x" in res_invalid.json()["detail"]

    # 5. Query relationships for the source element
    res_query = client.get(f"/api/relationships?element_id={app_elem['id']}")
    assert res_query.status_code == 200
    rel_list = res_query.json()
    assert any(r["id"] == rel_id for r in rel_list)

    # 6. Update the relationship to another valid type (e.g. RealizationRelationship) and new documentation
    update_payload = {
        "type": "RealizationRelationship",
        "name": "Realizes Settlement Operations",
        "documentation": "Direct realization link."
    }
    res_update = client.put(f"/api/relationships/{rel_id}", json=update_payload)
    assert res_update.status_code == 200
    updated_rel = res_update.json()
    assert updated_rel["type"] == "RealizationRelationship"
    assert updated_rel["name"] == "Realizes Settlement Operations"

    # 7. Attempt to update the relationship to an INVALID type
    invalid_update_payload = {
        "type": "AssignmentRelationship"
    }
    res_invalid_update = client.put(f"/api/relationships/{rel_id}", json=invalid_update_payload)
    assert res_invalid_update.status_code == 400
    assert "not permitted by ArchiMate 3.x" in res_invalid_update.json()["detail"]

    # 8. Delete the relationship
    res_delete = client.delete(f"/api/relationships/{rel_id}")
    assert res_delete.status_code == 200

    # Verify deletion
    res_after_delete = client.get(f"/api/relationships?element_id={app_elem['id']}")
    assert res_after_delete.status_code == 200
    assert not any(r["id"] == rel_id for r in res_after_delete.json())

def test_data_import_template_and_xlsx_csv_processing():
    import io
    import openpyxl

    # 1. Test template downloads (XLSX, CSV elements, CSV relationships)
    res_tmpl_xlsx = client.get("/api/import/template?model_id=sample-easybank-ea&format=xlsx")
    assert res_tmpl_xlsx.status_code == 200
    assert res_tmpl_xlsx.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    
    # Verify openpyxl can read the generated template and has 3 sheets
    wb_read = openpyxl.load_workbook(io.BytesIO(res_tmpl_xlsx.content))
    assert "Elements" in wb_read.sheetnames
    assert "Relationships" in wb_read.sheetnames
    assert "Metamodel_Guide" in wb_read.sheetnames

    res_tmpl_csv_e = client.get("/api/import/template?format=csv_elements")
    assert res_tmpl_csv_e.status_code == 200
    assert "name" in res_tmpl_csv_e.text

    res_tmpl_csv_r = client.get("/api/import/template?format=csv_relationships")
    assert res_tmpl_csv_r.status_code == 200
    assert "source" in res_tmpl_csv_r.text

    # 2. Build a test Excel file with both valid and invalid items
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    
    # Sheet 1: Elements
    ws_e = wb.create_sheet(title="Elements")
    ws_e.append(["id", "name", "type", "layer", "documentation", "annual_cost", "business_fit", "rto_hours"])
    ws_e.append(["test-imp-app-1", "Automated Fraud Shield", "ApplicationComponent", "Application", "AI Fraud detection engine.", 85000, 5, 2])
    ws_e.append(["test-imp-proc-1", "Card Transaction Monitoring", "BusinessProcess", "Business", "Continuous transaction scoring.", 0, 4, 1])

    # Sheet 2: Relationships
    ws_r = wb.create_sheet(title="Relationships")
    ws_r.append(["source", "target", "type", "name", "documentation"])
    # Valid relationship: ApplicationComponent -> BusinessProcess with ServingRelationship
    ws_r.append(["Automated Fraud Shield", "Card Transaction Monitoring", "ServingRelationship", "Fraud alerts stream", "Real-time Kafka topic."])
    # Invalid relationship: ApplicationComponent -> BusinessProcess with AssignmentRelationship (forbidden by ArchiMate)
    ws_r.append(["Automated Fraud Shield", "Card Transaction Monitoring", "AssignmentRelationship", "Invalid Assign", "Should trigger ArchiMate warning/error."])

    excel_buffer = io.BytesIO()
    wb.save(excel_buffer)
    excel_buffer.seek(0)
    file_bytes = excel_buffer.getvalue()

    # 3. Test Dry-Run upload
    res_dry = client.post(
        "/api/import/upload",
        data={"model_id": "sample-easybank-ea", "dry_run": "true", "update_existing": "true"},
        files={"file": ("test_import.xlsx", file_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    )
    assert res_dry.status_code == 200
    dry_data = res_dry.json()
    assert dry_data["dry_run"] is True
    assert dry_data["elements_created"] == 2
    assert dry_data["relationships_created"] == 1
    assert dry_data["errors_count"] == 1  # The invalid ArchiMate assignment was flagged
    assert dry_data["status"] == "partial_success"

    # 4. Test Live Execute upload
    res_live = client.post(
        "/api/import/upload",
        data={"model_id": "sample-easybank-ea", "dry_run": "false", "update_existing": "true"},
        files={"file": ("test_import.xlsx", file_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    )
    assert res_live.status_code == 200
    live_data = res_live.json()
    assert live_data["success"] is True
    assert live_data["elements_created"] == 2
    assert live_data["relationships_created"] == 1
    import_id = live_data["import_id"]

    # 5. Verify created elements in repository
    res_elem_check = client.get(f"/api/elements/test-imp-app-1")
    assert res_elem_check.status_code == 200
    elem_detail = res_elem_check.json()
    assert elem_detail["name"] == "Automated Fraud Shield"
    assert elem_detail["apm"]["annual_cost"] == 85000.0
    assert elem_detail["properties"]["rto_hours"] == 2

    # 6. Verify Import History
    res_history = client.get("/api/import/history?model_id=sample-easybank-ea")
    assert res_history.status_code == 200
    history_list = res_history.json()
    assert any(h["id"] == import_id for h in history_list)

    # 7. Verify History Details
    res_hist_detail = client.get(f"/api/import/history/{import_id}")
    assert res_hist_detail.status_code == 200
    hist_detail = res_hist_detail.json()
    assert hist_detail["filename"] == "test_import.xlsx"
    assert hist_detail["file_format"] == "xlsx"
    assert len(hist_detail["details"]["created_elements"]) == 2
    assert len(hist_detail["details"]["errors"]) == 1

    # 8. Clean up created elements and relationships
    client.delete("/api/elements/test-imp-app-1")
    client.delete("/api/elements/test-imp-proc-1")
    client.delete(f"/api/import/history/{import_id}")


def test_saved_views_crud():
    # 1. Create a saved filter view
    payload = {
        "model_id": "sample-easybank-ea",
        "name": "High Cost Live Applications",
        "description": "Critical live applications costing more than €50k",
        "author": "Chief Architect",
        "is_shared": True,
        "tags": ["APM", "Financial", "Governance"],
        "filter_config": {
            "selectedLayer": "Application",
            "selectedType": "ApplicationComponent",
            "search": "",
            "searchInProps": True,
            "relationshipFilter": "connected",
            "documentationFilter": "with_doc",
            "matchLogic": "AND",
            "attributeFilterRules": [
                {
                    "id": "rule-1",
                    "attributeName": "annual_cost",
                    "operator": "greater_than",
                    "value": "50000"
                }
            ],
            "sortBy": "cost_desc"
        }
    }
    res_create = client.post("/api/saved-views", json=payload)
    assert res_create.status_code == 201
    created_view = res_create.json()
    assert created_view["name"] == "High Cost Live Applications"
    assert created_view["author"] == "Chief Architect"
    assert created_view["is_shared"] is True
    assert len(created_view["tags"]) == 3
    assert created_view["filter_config"]["selectedLayer"] == "Application"
    view_id = created_view["id"]

    # 2. List saved views for model
    res_list = client.get("/api/saved-views?model_id=sample-easybank-ea")
    assert res_list.status_code == 200
    views = res_list.json()
    assert any(v["id"] == view_id for v in views)

    # 3. Get single saved view
    res_get = client.get(f"/api/saved-views/{view_id}")
    assert res_get.status_code == 200
    view_detail = res_get.json()
    assert view_detail["name"] == "High Cost Live Applications"

    # 4. Update saved view
    res_update = client.put(f"/api/saved-views/{view_id}", json={
        "name": "High Cost Live Apps (Updated)",
        "is_shared": False,
        "tags": ["APM", "Financial"]
    })
    assert res_update.status_code == 200
    updated_view = res_update.json()
    assert updated_view["name"] == "High Cost Live Apps (Updated)"
    assert updated_view["is_shared"] is False
    assert len(updated_view["tags"]) == 2

    # 5. Duplicate saved view
    res_dup = client.post(f"/api/saved-views/{view_id}/duplicate")
    assert res_dup.status_code == 201
    dup_view = res_dup.json()
    assert dup_view["name"] == "High Cost Live Apps (Updated) (Copia)"
    assert dup_view["id"] != view_id
    dup_id = dup_view["id"]

    # 6. Delete duplicated and original views
    res_del_dup = client.delete(f"/api/saved-views/{dup_id}")
    assert res_del_dup.status_code == 200
    res_del_orig = client.delete(f"/api/saved-views/{view_id}")
    assert res_del_orig.status_code == 200

    # Verify 404 after deletion
    res_verify_del = client.get(f"/api/saved-views/{view_id}")
    assert res_verify_del.status_code == 404


def test_saved_view_export_and_roundtrip_reimport():
    # 1. Create a saved filter view targeting Application components with multi-attribute rules
    payload = {
        "model_id": "sample-easybank-ea",
        "name": "Export Test Applications",
        "description": "Export testing for round-trip import",
        "author": "QA Architect",
        "is_shared": True,
        "tags": ["Export", "Test"],
        "filter_config": {
            "selectedLayer": "Application",
            "selectedType": "ApplicationComponent",
            "search": "",
            "searchInProps": False,
            "relationshipFilter": "all",
            "documentationFilter": "all",
            "matchLogic": "AND",
            "attributeFilterRules": [
                {
                    "id": "rule-1",
                    "attributeName": "annual_cost",
                    "operator": "gte",
                    "value": "0"
                }
            ],
            "sortBy": "name_asc"
        }
    }
    res_create = client.post("/api/saved-views", json=payload)
    assert res_create.status_code == 201
    view_id = res_create.json()["id"]

    # 2. Test GET /{view_id}/export?format=xlsx
    res_exp_xlsx = client.get(f"/api/saved-views/{view_id}/export?format=xlsx")
    assert res_exp_xlsx.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in res_exp_xlsx.headers["content-type"]
    assert "attachment; filename=" in res_exp_xlsx.headers["content-disposition"]

    # Validate Excel content
    xlsx_bytes = res_exp_xlsx.content
    wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))
    assert "Elements" in wb.sheetnames
    assert "Relationships" in wb.sheetnames
    assert "Metamodel_Guide" in wb.sheetnames
    
    ws_elements = wb["Elements"]
    assert ws_elements.max_row > 1, "Elements sheet must have data rows, not just headers!"
    headers = [cell.value for cell in ws_elements[1]]
    assert "id" in headers
    assert "name" in headers
    assert "type" in headers
    assert "annual_cost" in headers
    assert "business_fit" in headers

    # Verify first data row has non-empty name, type, layer
    first_row = [cell.value for cell in ws_elements[2]]
    assert first_row[headers.index("name")] is not None
    assert first_row[headers.index("type")] == "ApplicationComponent"

    # Validate Relationships sheet
    ws_rel = wb["Relationships"]
    assert ws_rel.max_row >= 1
    rel_headers = [cell.value for cell in ws_rel[1]]
    assert "source" in rel_headers
    assert "target" in rel_headers
    assert "type" in rel_headers

    # 3. Test POST /api/saved-views/export with CSV zip
    res_exp_csv = client.post("/api/saved-views/export", json={
        "model_id": "sample-easybank-ea",
        "view_id": view_id,
        "format": "csv"
    })
    assert res_exp_csv.status_code == 200
    assert "application/zip" in res_exp_csv.headers["content-type"]
    with zipfile.ZipFile(io.BytesIO(res_exp_csv.content)) as zf:
        namelist = zf.namelist()
        assert "elements.csv" in namelist
        assert "relationships.csv" in namelist
        
        elem_csv_text = zf.read("elements.csv").decode("utf-8-sig")
        lines = [l for l in elem_csv_text.strip().splitlines() if l]
        assert len(lines) > 1, "elements.csv must have data lines beyond the header!"

    # 4. Test Round-Trip Re-Import of the exported Excel
    res_dry_reimport = client.post(
        "/api/import/upload",
        data={"model_id": "sample-easybank-ea", "dry_run": "true", "update_existing": "true"},
        files={"file": ("export_reimport.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    )
    assert res_dry_reimport.status_code == 200
    dry_data = res_dry_reimport.json()
    assert dry_data["dry_run"] is True
    assert dry_data["status"] == "success"
    assert dry_data["errors_count"] == 0
    assert dry_data["elements_updated"] > 0 or dry_data["elements_created"] > 0

    # 5. Clean up test saved view
    client.delete(f"/api/saved-views/{view_id}")


def test_phase1_quick_wins_id_reconciliation_metamodel_and_overlap():
    # 1. Verify extended ArchiMate 3.2 metamodel types and relationship rules
    res_allowed_func = client.get("/api/relationships/allowed-types?source_type=ApplicationComponent&target_type=ApplicationFunction")
    assert res_allowed_func.status_code == 200
    allowed_func_types = [t["type"] for t in res_allowed_func.json()]
    assert "AssignmentRelationship" in allowed_func_types
    assert "CompositionRelationship" in allowed_func_types

    res_allowed_evt = client.get("/api/relationships/allowed-types?source_type=BusinessEvent&target_type=BusinessProcess")
    assert res_allowed_evt.status_code == 200
    allowed_evt_types = [t["type"] for t in res_allowed_evt.json()]
    assert "TriggeringRelationship" in allowed_evt_types

    # 2. Verify OverlapService target keeper selection (Invest priority) & in_apm_scope filtering
    res_overlap = client.get("/api/overlap/matrix/sample-easybank-ea")
    assert res_overlap.status_code == 200
    overlap_data = res_overlap.json()
    crm_cluster = next((c for c in overlap_data["redundancy_clusters"] if "Customer" in c["capability_name"]), None)
    assert crm_cluster is not None
    assert "target_app_name" in crm_cluster
    assert crm_cluster["potential_savings"] > 0

    # 3. Verify compute_schema_diff reconciles by easyea_id when name is modified in Draw.io
    from app.services.drawio_service import parse_drawio_file_to_canonical_model
    from app.services.schema_diff_service import compute_schema_diff
    from app.models.archimate import ArchiSchema, ArchimateElement

    db = TestingSessionLocal()
    try:
        existing_app = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == "sample-easybank-ea",
            ArchimateElement.type == "ApplicationComponent"
        ).first()
        assert existing_app is not None

        dummy_schema = ArchiSchema(
            id="schema-test-id-reconcile",
            model_id="sample-easybank-ea",
            name="Test Reconcile View",
            view_data={"nodes": [{"id": "cell-1", "element_id": existing_app.id}], "connections": []}
        )

        # Simulate a Draw.io XML where the element kept its easyea_id but its label was renamed
        renamed_label = f"{existing_app.name} v2.0"
        drawio_xml = f"""<mxfile>
          <diagram id="d1" name="Test Reconcile View">
            <mxGraphModel>
              <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <object id="cell-1" label="{renamed_label}" easyea_id="{existing_app.id}" archimate_type="{existing_app.type}" layer="{existing_app.layer}">
                  <mxCell vertex="1" parent="1">
                    <mxGeometry x="100" y="100" width="160" height="65" as="geometry"/>
                  </mxCell>
                </object>
              </root>
            </mxGraphModel>
          </diagram>
        </mxfile>"""

        parsed = parse_drawio_file_to_canonical_model(drawio_xml)
        diff = compute_schema_diff(dummy_schema, parsed, db)

        # Must be recognized as 0 new elements, 0 removed elements, and 1 modified element (name change)
        assert diff["summary"]["new_elements_count"] == 0
        assert diff["summary"]["removed_elements_count"] == 0
        assert diff["summary"]["modified_elements_count"] == 1
        mod_el = diff["modified_elements"][0]
        assert mod_el["id"] == existing_app.id
        assert any(c["field"] == "name" and c["new_value"] == renamed_label for c in mod_el["changes"])
    finally:
        db.close()


def test_phase2_bpmn_hierarchy_and_macro_process_steps():
    from app.services.bpmn_service import parse_bpmn_file_to_canonical_model
    from app.services.process_service import ProcessService
    from app.models.archimate import ArchimateElement, ArchimateRelationship

    bpmn_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Defs_1">
      <bpmn:process id="proc_onboarding" name="Digital Customer Onboarding" isExecutable="true">
        <bpmn:userTask id="task_kyc" name="Verify KYC Documents" />
        <bpmn:manualTask id="task_sign" name="Collect Digital Signature" />
      </bpmn:process>
    </bpmn:definitions>"""

    parsed = parse_bpmn_file_to_canonical_model(bpmn_xml)
    elems_by_id = {e["id"]: e for e in parsed["elements"]}
    assert "proc_onboarding" in elems_by_id
    assert elems_by_id["proc_onboarding"]["properties"]["is_bpmn_step"] is False
    assert elems_by_id["task_kyc"]["properties"]["is_bpmn_step"] is True
    assert elems_by_id["task_kyc"]["properties"]["parent_process_id"] == "proc_onboarding"

    # Verify CompositionRelationship generated from macro process to step
    comp_rels = [
        r for r in parsed["relationships"]
        if r["type"] == "CompositionRelationship" and r["source_id"] == "proc_onboarding"
    ]
    assert len(comp_rels) == 2

    # Insert into DB and verify ProcessService.get_process_catalog groups steps under macro process
    db = TestingSessionLocal()
    try:
        for e in parsed["elements"]:
            db.add(ArchimateElement(
                id=e["id"],
                model_id="sample-easybank-ea",
                name=e["name"],
                type=e["type"],
                layer=e["layer"],
                documentation=e["documentation"],
                properties=e["properties"]
            ))
        for r in parsed["relationships"]:
            db.add(ArchimateRelationship(
                id=r["id"],
                model_id="sample-easybank-ea",
                source_id=r["source_id"],
                target_id=r["target_id"],
                type=r["type"],
                name=r["name"],
                documentation=r["documentation"]
            ))
        db.commit()

        catalog = ProcessService.get_process_catalog(db, "sample-easybank-ea")
        proc_names = [p["name"] for p in catalog["processes"]]
        assert "Digital Customer Onboarding" in proc_names
        # Micro-tasks must be grouped under the parent process, not polluting top-level process list
        assert "Verify KYC Documents" not in proc_names
        onb_proc = next(p for p in catalog["processes"] if p["id"] == "proc_onboarding")
        assert onb_proc["steps_count"] == 2
        step_names = [s["name"] for s in onb_proc["process_steps"]]
        assert "Verify KYC Documents" in step_names
    finally:
        db.close()


def test_sast_crit_01_authentication_and_rbac_enforcement():
    """Verify SAST-CRIT-01: unauthenticated requests get 401, non-admin users get 403 on admin/unassigned libraries, and client_secret is masked."""
    anon_client = TestClient(app)

    # 1. Unauthenticated requests to protected endpoints must return 401
    for path in ["/api/models", "/api/auth/admin/config", "/api/rbac/users", "/api/elements", "/api/views", "/api/apm/portfolio/sample-easybank-ea"]:
        res = anon_client.get(path)
        assert res.status_code == 401, f"Expected 401 for unauthenticated GET {path}, got {res.status_code}"

    # 2. Public auth endpoints remain accessible without token
    res_oidc = anon_client.get("/api/auth/oidc/config")
    assert res_oidc.status_code == 200

    # 3. Admin creates a second library where marco_arch has NO assignment
    res_lib = client.post("/api/models", json={"name": "Restricted Library", "code": "REST"})
    assert res_lib.status_code == 200
    restricted_model_id = res_lib.json()["id"]

    # 4. Non-admin architect user (marco_arch is assigned only to sample-easybank-ea as architect)
    db = TestingSessionLocal()
    try:
        marco = db.query(User).filter(User.username == "marco_arch").first()
        assert marco is not None
        marco_token = create_access_token(marco)
    finally:
        db.close()

    marco_client = TestClient(app)
    marco_client.headers.update({"Authorization": f"Bearer {marco_token}"})

    # Non-admin blocked from admin endpoints (403)
    assert marco_client.get("/api/auth/admin/config").status_code == 403
    assert marco_client.post("/api/rbac/assignments", json={
        "user_id": marco.id,
        "role_id": "role-sys-admin",
        "model_id": None
    }).status_code == 403

    # Non-admin blocked from deleting a model workspace (requires admin)
    assert marco_client.delete("/api/models/sample-easybank-ea").status_code == 403

    # Non-admin allowed to create elements in assigned library (sample-easybank-ea)
    res_allowed = marco_client.post(
        "/api/elements?model_id=sample-easybank-ea",
        json={"name": "Marco App", "type": "ApplicationComponent", "layer": "Application"}
    )
    assert res_allowed.status_code == 200

    # Non-admin blocked from creating elements in unassigned library (restricted_model_id)
    res_forbidden = marco_client.post(
        f"/api/elements?model_id={restricted_model_id}",
        json={"name": "Unauthorized App", "type": "ApplicationComponent", "layer": "Application"}
    )
    assert res_forbidden.status_code == 403

    # 5. Admin config masks OIDC client_secret and preserves it when masked placeholder is sent back
    res_put_cfg = client.put("/api/auth/admin/config", json={
        "auth_mode": "hybrid",
        "provider_name": "Keycloak",
        "issuer_url": "https://sso.example.com/realms/easyea",
        "client_id": "easyea-web",
        "client_secret": "super-secret-oidc-key",
        "redirect_uri": "http://localhost:5173/auth/callback",
        "scopes": "openid profile email",
        "auto_provision_users": True,
        "default_role_name": "viewer"
    })
    assert res_put_cfg.status_code == 200
    assert res_put_cfg.json()["config"]["client_secret"] == "********"
    assert client.get("/api/auth/admin/config").json()["client_secret"] == "********"

    # Sending back "********" must preserve the real secret in DB
    res_put_masked = client.put("/api/auth/admin/config", json={
        "auth_mode": "hybrid",
        "provider_name": "Keycloak Updated",
        "issuer_url": "https://sso.example.com/realms/easyea",
        "client_id": "easyea-web",
        "client_secret": "********",
        "redirect_uri": "http://localhost:5173/auth/callback",
        "scopes": "openid profile email",
        "auto_provision_users": True,
        "default_role_name": "viewer"
    })
    assert res_put_masked.status_code == 200
    from app.services.auth_service import get_system_auth_settings
    db = TestingSessionLocal()
    try:
        settings_db = get_system_auth_settings(db)
        assert settings_db.client_secret == "super-secret-oidc-key"
        assert settings_db.provider_name == "Keycloak Updated"
    finally:
        db.close()


def test_sast_crit_02_no_hardcoded_jwt_secret_and_safe_user_passwords(monkeypatch):
    """Verify SAST-CRIT-02: no hardcoded JWT SECRET_KEY, no predictable fallback user passwords, and PBKDF2 600k iterations."""
    import base64
    import hashlib
    import hmac
    import json
    import time
    from app.core.config import settings as app_settings, _resolve_secret_key
    from app.services.auth_service import hash_password, verify_password

    # 1. Active SECRET_KEY is not the old hardcoded string and has strong entropy
    assert app_settings.SECRET_KEY != "easyea-production-secret-key-2026-auth-session"
    assert len(app_settings.SECRET_KEY) >= 32

    # 2. Forging a token with the legacy hardcoded key must fail with 401
    header_b64 = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps({
        "sub": "usr-sysadmin-00",
        "username": "sys_admin",
        "email": "sys_admin@easyea.local",
        "exp": int(time.time()) + 3600,
        "iat": int(time.time())
    }).encode()).decode().rstrip("=")
    signing_input = f"{header_b64}.{payload_b64}".encode()
    forged_sig = base64.urlsafe_b64encode(
        hmac.new(b"easyea-production-secret-key-2026-auth-session", signing_input, hashlib.sha256).digest()
    ).decode().rstrip("=")
    forged_token = f"{header_b64}.{payload_b64}.{forged_sig}"

    anon_client = TestClient(app)
    res_forged = anon_client.get("/api/models", headers={"Authorization": f"Bearer {forged_token}"})
    assert res_forged.status_code == 401

    # 3. Production mode rejects missing or weak EASYEA_SECRET_KEY
    monkeypatch.setenv("EASYEA_ENV", "production")
    monkeypatch.delenv("EASYEA_SECRET_KEY", raising=False)
    with pytest.raises(RuntimeError):
        _resolve_secret_key()

    monkeypatch.setenv("EASYEA_SECRET_KEY", "easyea-production-secret-key-2026-auth-session")
    with pytest.raises(RuntimeError):
        _resolve_secret_key()

    # 4. Creating a user without a password must NOT assign the predictable 'EasyEA2026!' password
    res_new_user = client.post("/api/rbac/users", json={
        "email": "nopass.user@easybank.it",
        "full_name": "No Password User",
        "username": "nopass_user"
    })
    assert res_new_user.status_code == 200
    res_login_default = anon_client.post("/api/auth/login", json={
        "username": "nopass_user",
        "password": "EasyEA2026!"
    })
    assert res_login_default.status_code == 401

    # 5. Password hashing uses 600,000 PBKDF2 iterations and remains backward-compatible with legacy 100k hashes
    new_hash = hash_password("StrongPass#2026")
    assert new_hash.startswith("pbkdf2_sha256$600000$")
    assert verify_password("StrongPass#2026", new_hash) is True
    assert verify_password("WrongPass", new_hash) is False


def test_sast_crit_03_oidc_open_redirect_state_signature_jws_and_email_verified():
    """Verify SAST-CRIT-03: OIDC return_to allowlist, HMAC-signed state, JWS verification, and verified-email account linking."""
    import base64
    import hashlib
    import hmac
    import json
    import time
    from app.services.auth_service import (
        create_oidc_state,
        verify_oidc_state,
        _verify_and_decode_oidc_jwt,
        provision_or_sync_oidc_user,
    )

    anon_client = TestClient(app)

    # 1. Open Redirect blocked on /api/auth/oidc/login
    res_evil = anon_client.get(
        "/api/auth/oidc/login?return_to=https://evil-attacker.com/steal",
        follow_redirects=False,
    )
    assert res_evil.status_code == 400

    # Allowed frontend origin and Archi RFC 8252 loopback callback succeed
    res_valid = anon_client.get(
        "/api/auth/oidc/login?return_to=http://localhost:5173",
        follow_redirects=False,
    )
    assert res_valid.status_code == 302

    res_loopback = anon_client.get(
        "/api/auth/oidc/login?return_to=http://127.0.0.1:8765/callback",
        follow_redirects=False,
    )
    assert res_loopback.status_code == 302

    # 2. Unsigned or tampered OIDC state rejected on /api/auth/oidc/callback
    forged_state = base64.urlsafe_b64encode(
        json.dumps({"return_to": "https://evil-attacker.com", "nonce": "123"}).encode()
    ).decode().rstrip("=")
    res_cb_json = anon_client.get(
        f"/api/auth/oidc/callback?code=dummy&state={forged_state}&format=json"
    )
    assert res_cb_json.status_code == 400

    res_cb_redirect = anon_client.get(
        f"/api/auth/oidc/callback?code=dummy&state={forged_state}",
        follow_redirects=False,
    )
    assert res_cb_redirect.status_code == 302
    assert "evil-attacker.com" not in res_cb_redirect.headers.get("location", "")
    assert "auth_error=" in res_cb_redirect.headers.get("location", "")

    # Valid signed state verifies cleanly, tampered signature raises ValueError
    valid_state = create_oidc_state("http://localhost:5173")
    verified_state = verify_oidc_state(valid_state)
    assert verified_state["return_to"] == "http://localhost:5173"
    with pytest.raises(ValueError):
        verify_oidc_state(valid_state + "tampered")

    # 3. OIDC JWT signature & claims verification (_verify_and_decode_oidc_jwt)
    issuer = "http://localhost:18000/realms/dev-realm"
    client_id = "easyea-client"
    secret = "test-oidc-client-secret-key"
    discovery = {"issuer": issuer}

    def _make_jwt(header_dict, payload_dict, key_str=secret):
        h_b64 = base64.urlsafe_b64encode(json.dumps(header_dict).encode()).decode().rstrip("=")
        p_b64 = base64.urlsafe_b64encode(json.dumps(payload_dict).encode()).decode().rstrip("=")
        if header_dict.get("alg") == "none":
            return f"{h_b64}.{p_b64}."
        sig = hmac.new(key_str.encode(), f"{h_b64}.{p_b64}".encode(), hashlib.sha256).digest()
        s_b64 = base64.urlsafe_b64encode(sig).decode().rstrip("=")
        return f"{h_b64}.{p_b64}.{s_b64}"

    now = int(time.time())
    valid_claims = {
        "sub": "oidc-sub-123",
        "iss": issuer,
        "aud": client_id,
        "exp": now + 600,
        "iat": now,
    }
    valid_jwt = _make_jwt({"alg": "HS256", "typ": "JWT"}, valid_claims)
    decoded = _verify_and_decode_oidc_jwt(valid_jwt, issuer, client_id, secret, discovery)
    assert decoded["sub"] == "oidc-sub-123"

    # Reject alg=none
    with pytest.raises(ValueError):
        _verify_and_decode_oidc_jwt(_make_jwt({"alg": "none"}, valid_claims), issuer, client_id, secret, discovery)

    # Reject wrong signature
    with pytest.raises(ValueError):
        _verify_and_decode_oidc_jwt(_make_jwt({"alg": "HS256"}, valid_claims, key_str="wrong-key"), issuer, client_id, secret, discovery)

    # Reject expired token
    with pytest.raises(ValueError):
        _verify_and_decode_oidc_jwt(
            _make_jwt({"alg": "HS256"}, {**valid_claims, "exp": now - 3600}),
            issuer, client_id, secret, discovery,
        )

    # Reject wrong issuer
    with pytest.raises(ValueError):
        _verify_and_decode_oidc_jwt(
            _make_jwt({"alg": "HS256"}, {**valid_claims, "iss": "https://evil-idp.example.com"}),
            issuer, client_id, secret, discovery,
        )

    # Reject wrong audience
    with pytest.raises(ValueError):
        _verify_and_decode_oidc_jwt(
            _make_jwt({"alg": "HS256"}, {**valid_claims, "aud": "other-client"}),
            issuer, client_id, secret, discovery,
        )

    # 4. Prevent Pre-Auth Account Takeover via unverified email linking
    db = TestingSessionLocal()
    try:
        # Attempt to link to existing local user 'marco.arch@easybank.it' WITHOUT email_verified=True
        with pytest.raises(ValueError, match="Account linking denied"):
            provision_or_sync_oidc_user(db, {
                "sub": "attacker-oidc-sub-999",
                "email": "marco.arch@easybank.it",
                "email_verified": False,
                "name": "Attacker Marco",
            })

        # Attempt to link to built-in sys_admin is always denied even with email_verified=True
        with pytest.raises(ValueError, match="Account linking denied"):
            provision_or_sync_oidc_user(db, {
                "sub": "attacker-oidc-sub-000",
                "email": "sys_admin@easyea.local",
                "email_verified": True,
                "name": "Attacker Admin",
            })

        # Legitimate linking to existing local user succeeds when email_verified=True
        linked_user = provision_or_sync_oidc_user(db, {
            "sub": "verified-marco-oidc-sub",
            "email": "marco.arch@easybank.it",
            "email_verified": True,
            "name": "Marco Bianchi (Verified SSO)",
        })
        assert linked_user.external_id == "verified-marco-oidc-sub"

        # Subsequent attempt by a DIFFERENT sub to hijack the already-linked email is denied
        with pytest.raises(ValueError, match="Account linking denied"):
            provision_or_sync_oidc_user(db, {
                "sub": "second-attacker-sub",
                "email": "marco.arch@easybank.it",
                "email_verified": True,
                "name": "Second Attacker",
            })
    finally:
        db.close()


def test_sast_high_01_ssrf_protection_in_test_idp_connection_and_config(monkeypatch):
    """Verify SAST-HIGH-01: SSRF blocked on cloud metadata, internal ports/IPs, non-HTTP schemes, and no response body leak."""
    import app.services.auth_service as auth_svc

    ssrf_payloads = [
        "http://169.254.169.254/latest/meta-data",
        "http://metadata.google.internal/computeMetadata/v1",
        "http://127.0.0.1:8000/api/models",
        "http://localhost:5432",
        "http://127.0.0.1:6379",
        "http://10.0.0.1:8080/realms/internal",
        "http://192.168.1.10/admin",
        "http://172.16.0.5:8080",
        "file:///etc/passwd",
        "gopher://127.0.0.1:6379/_INFO",
        "https://sso.example.com/realms/easyea#fragment",
        "https://sso.example.com/realms/easyea?query=1",
        "https://user:pass@sso.example.com/realms/easyea",
    ]

    for bad_url in ssrf_payloads:
        res = client.post("/api/auth/admin/test-connection", json={"issuer_url": bad_url})
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is False, f"Expected SSRF payload {bad_url} to be blocked"

    # Saving an SSRF issuer_url via PUT /api/auth/admin/config must fail with 400
    res_put_ssrf = client.put("/api/auth/admin/config", json={
        "issuer_url": "http://169.254.169.254/latest/meta-data"
    })
    assert res_put_ssrf.status_code == 400

    # Verify non-200 HTTP response from an external host does NOT leak resp.text in error message
    class DummyResp:
        status_code = 404
        text = "SENSITIVE_INTERNAL_SECRET_BODY_CONTENT_12345"
        def json(self):
            return {}

    monkeypatch.setattr(auth_svc, "_make_oidc_request", lambda method, url, **kw: DummyResp())
    monkeypatch.setattr(auth_svc, "validate_oidc_issuer_url", lambda url, resolve_dns=False: "https://sso.example.com/realms/easyea")

    res_no_leak = client.post(
        "/api/auth/admin/test-connection",
        json={"issuer_url": "https://sso.example.com/realms/easyea"}
    )
    assert res_no_leak.status_code == 200
    data_no_leak = res_no_leak.json()
    assert data_no_leak["success"] is False
    assert "SENSITIVE_INTERNAL_SECRET_BODY_CONTENT_12345" not in data_no_leak["message"]


def test_sast_high_02_to_06_xml_bomb_cors_and_upload_limits(monkeypatch):
    """Verify SAST-HIGH-02 (defusedxml Billion Laughs / XXE block), SAST-HIGH-05 (no wildcard CORS), and SAST-HIGH-06 (upload size & zip bomb guards)."""
    import io
    import zipfile
    from defusedxml.common import EntitiesForbidden, DTDForbidden
    from app.parsers.archi_parser import ArchiModelParser
    from app.services.bpmn_service import parse_bpmn_file_to_canonical_model
    from app.services.drawio_service import parse_drawio_file_to_canonical_model
    from app.core.config import settings
    import app.api.deps as api_deps

    # 1. SAST-HIGH-02: Billion Laughs / DTD / XXE payloads must be rejected by defusedxml across all parsers
    xml_bomb = """<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">
]>
<archimate:model xmlns:archimate="http://www.archimatetool.com/archimate" name="&lol2;" id="m1"/>"""

    with pytest.raises((EntitiesForbidden, DTDForbidden, Exception)):
        ArchiModelParser(xml_bomb).parse()

    with pytest.raises((EntitiesForbidden, DTDForbidden, Exception)):
        parse_bpmn_file_to_canonical_model(xml_bomb)

    with pytest.raises((EntitiesForbidden, DTDForbidden, Exception)):
        parse_drawio_file_to_canonical_model(xml_bomb)

    # Uploading XML bomb via /api/models/upload-archi must fail cleanly with 400
    res_bomb = client.post(
        "/api/models/upload-archi",
        files={"file": ("bomb.archimate", xml_bomb.encode("utf-8"), "application/xml")},
    )
    assert res_bomb.status_code == 400

    # 2. SAST-HIGH-05: CORS_ORIGINS must never contain wildcard '*'
    assert "*" not in settings.CORS_ORIGINS
    assert all(origin.startswith(("http://", "https://", "null", "file:")) for origin in settings.CORS_ORIGINS)

    # 3. SAST-HIGH-06: Oversized upload rejected with 413 Payload Too Large
    monkeypatch.setattr(api_deps.settings, "MAX_UPLOAD_BYTES", 1024)  # 1 KB limit for test
    oversized_payload = b"A" * 2048
    res_large = client.post(
        "/api/import/upload",
        data={"model_id": "sample-easybank-ea", "dry_run": "true"},
        files={"file": ("huge.csv", oversized_payload, "text/csv")},
    )
    assert res_large.status_code == 413

    # 4. SAST-HIGH-06: Zip Bomb (high compression ratio / uncompressed size limit) rejected with 413
    monkeypatch.setattr(api_deps.settings, "MAX_UPLOAD_BYTES", 15 * 1024 * 1024)
    monkeypatch.setattr(api_deps.settings, "MAX_UNCOMPRESSED_ZIP_BYTES", 4096)  # 4 KB uncompressed limit for test
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("elements.csv", "id,name,type\n" + ("elem-1,App,ApplicationComponent\n" * 500))
    zip_buf.seek(0)

    res_zip_bomb = client.post(
        "/api/import/upload",
        data={"model_id": "sample-easybank-ea", "dry_run": "true"},
        files={"file": ("bomb.zip", zip_buf.getvalue(), "application/zip")},
    )
    assert res_zip_bomb.status_code == 413

    # 5. SAST-HIGH-06: Zip-Slip path traversal inside archive rejected with 400
    monkeypatch.setattr(api_deps.settings, "MAX_UNCOMPRESSED_ZIP_BYTES", 50 * 1024 * 1024)
    slip_buf = io.BytesIO()
    with zipfile.ZipFile(slip_buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("../../etc/passwd.csv", "id,name,type\n1,A,ApplicationComponent\n")
    slip_buf.seek(0)

    res_slip = client.post(
        "/api/import/upload",
        data={"model_id": "sample-easybank-ea", "dry_run": "true"},
        files={"file": ("slip.zip", slip_buf.getvalue(), "application/zip")},
    )
    assert res_slip.status_code == 400


def test_sast_med_01_to_03_rate_limiting_and_formula_injection_and_archi_settings():
    """Verify SAST-MED-01 (Archi loopback binding, anti-CSRF, reflected XSS, chmod 0600), SAST-MED-02 (login rate limiter & PBKDF2), and SAST-MED-03 (CSV/XLSX DDE formula injection sanitization)."""
    import os
    import io
    import zipfile
    import openpyxl
    from app.services.auth_service import login_rate_limiter, PBKDF2_ITERATIONS, hash_password, verify_password
    from app.services.export_service import sanitize_formula_injection, generate_view_excel, generate_view_csv_zip
    from app.models.archimate import ArchimateElement, ModelWorkspace

    # 1. SAST-MED-02: PBKDF2 600,000 iterations & password hashing
    assert PBKDF2_ITERATIONS == 600_000
    pwd = "SecuredPassword2026!"
    hashed = hash_password(pwd)
    assert hashed.startswith("pbkdf2_sha256$600000$")
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False

    # 2. SAST-MED-02: Sliding-window login rate limiting (max 5 failed attempts -> 429)
    login_rate_limiter.reset()
    test_user = "rate_limit_test_user"
    for i in range(5):
        res_fail = client.post("/api/auth/login", json={
            "username": test_user,
            "password": "WrongPassword!"
        })
        assert res_fail.status_code == 401

    # 6th attempt with same user/IP must trigger HTTP 429 Too Many Requests
    res_blocked = client.post("/api/auth/login", json={
        "username": test_user,
        "password": "WrongPassword!"
    })
    assert res_blocked.status_code == 429
    assert "Retry-After" in res_blocked.headers
    assert int(res_blocked.headers["Retry-After"]) > 0
    assert "Troppi tentativi" in res_blocked.json()["detail"]

    # Success with different user resets their rate limiter
    res_admin = client.post("/api/auth/login", json={
        "username": "sys_admin",
        "password": "AdminEasyEA2026!"
    })
    assert res_admin.status_code == 200

    login_rate_limiter.reset()

    # 3. SAST-MED-03: Formula injection (DDE / CSV Injection / CWE-1236) sanitization
    assert sanitize_formula_injection("=cmd|'/C calc'!A0") == "'=cmd|'/C calc'!A0"
    assert sanitize_formula_injection("+123456") == "'+123456"
    assert sanitize_formula_injection("-5+5") == "'-5+5"
    assert sanitize_formula_injection("@SUM(A1:A10)") == "'@SUM(A1:A10)"
    assert sanitize_formula_injection("\tcalc") == "'\tcalc"
    assert sanitize_formula_injection("\rcmd") == "'\rcmd"
    assert sanitize_formula_injection("  =2+2") == "'  =2+2"
    assert sanitize_formula_injection("Normal Element Name") == "Normal Element Name"
    assert sanitize_formula_injection(12345) == 12345
    assert sanitize_formula_injection(None) is None

    # Verify Excel and CSV export sanitize dangerous element names
    fake_ws = ModelWorkspace(id="ws-sec-test", name="Security Test Workspace")
    fake_el = ArchimateElement(
        id="el-inj-1",
        name="=cmd|'/C calc'!A0",
        type="ApplicationComponent",
        layer="Application",
        documentation="@SUM(1+1)"
    )

    # Excel export check
    excel_stream = generate_view_excel(fake_ws, [fake_el], [], [])
    wb = openpyxl.load_workbook(excel_stream, data_only=False)
    ws = wb["Elements"]
    assert ws.cell(row=2, column=2).value == "'=cmd|'/C calc'!A0"
    assert ws.cell(row=2, column=5).value == "'@SUM(1+1)"

    # CSV Zip export check
    zip_stream = generate_view_csv_zip(fake_ws, [fake_el], [], [])
    with zipfile.ZipFile(zip_stream, "r") as zf:
        csv_text = zf.read("elements.csv").decode("utf-8-sig")
        assert "'=cmd|'/C calc'!A0" in csv_text
        assert "'@SUM(1+1)" in csv_text

    # 4. SAST-MED-01: Archi plugin security hardening checks
    plugin_path = os.path.join(os.path.dirname(__file__), "../../plugins/archi-easyea/EasyEA_Settings.ajs")
    assert os.path.exists(plugin_path)
    with open(plugin_path, "r", encoding="utf-8") as f:
        plugin_code = f.read()

    # Loopback binding
    assert 'InetAddress.getByName("127.0.0.1")' in plugin_code
    assert 'new ServerSocket(p, 1, loopback)' in plugin_code
    # Anti-CSRF client_state
    assert "expectedClientState" in plugin_code
    assert "receivedClientState !== expectedClientState" in plugin_code
    # HTML escaping for Reflected XSS
    assert "escapeHtml" in plugin_code
    assert "escapeHtml(receivedError" in plugin_code
    # POSIX 0600 permissions
    assert "setReadable(false, false)" in plugin_code
    assert "setReadable(true, true)" in plugin_code
    assert "setWritable(true, true)" in plugin_code


def test_phase3_semantic_impact_spof_and_archimate_derivation():
    """
    Tests Phase 3 capabilities:
    1. Multi-hop semantic impact analysis (failure vs change modes with hop distances and critical paths).
    2. Model-wide architectural risk and SPOF detection.
    3. ArchiMate 3.2 §5.7 Derivation Engine (weakest link rule).
    4. Plateau and transition roadmap endpoints.
    """
    db = TestingSessionLocal()
    try:
        model_id = "ws-phase3-ea"
        ws = ModelWorkspace(id=model_id, name="Phase 3 EA Test Workspace")
        db.add(ws)
        db.commit()

        # Create elements across ArchiMate layers:
        # Tech: Node1 (Server)
        node1 = ArchimateElement(
            id="p3-node-1",
            model_id=model_id,
            name="Primary Core DB Server",
            type="Node",
            layer="Technology"
        )
        # Application: App1 (Core CRM) & App2 (Billing Engine in Migrate/Phase-out)
        app1 = ArchimateElement(
            id="p3-app-1",
            model_id=model_id,
            name="Core CRM Engine",
            type="ApplicationComponent",
            layer="Application",
            properties={"eea_lifecycle_status": "Live"}
        )
        app2 = ArchimateElement(
            id="p3-app-2",
            model_id=model_id,
            name="Legacy Billing Tool",
            type="ApplicationComponent",
            layer="Application",
            properties={"eea_lifecycle_status": "Phase-out"}
        )
        # Business: Process1 (Mission Critical Checkout)
        proc1 = ArchimateElement(
            id="p3-proc-1",
            model_id=model_id,
            name="Customer Onboarding Process",
            type="BusinessProcess",
            layer="Business"
        )
        # Data: DataObject1
        data1 = ArchimateElement(
            id="p3-data-1",
            model_id=model_id,
            name="Customer Master Record",
            type="DataObject",
            layer="Business"
        )

        db.add_all([node1, app1, app2, proc1, data1])
        db.commit()

        # APM Attributes: App1 is Mission Critical; App2 is Eliminate
        apm1 = ApplicationBusinessAttributes(
            element_id=app1.id,
            business_criticality="Mission Critical",
            time_quadrant="Invest",
            annual_cost=120000.0
        )
        apm2 = ApplicationBusinessAttributes(
            element_id=app2.id,
            business_criticality="Business Operational",
            time_quadrant="Eliminate",
            annual_cost=45000.0
        )
        db.add_all([apm1, apm2])
        db.commit()

        # Relationships:
        # Node1 --Serving--> App1
        rel1 = ArchimateRelationship(
            id="p3-rel-1",
            model_id=model_id,
            source_id=node1.id,
            target_id=app1.id,
            type="ServingRelationship"
        )
        # App1 --Serving--> Proc1
        rel2 = ArchimateRelationship(
            id="p3-rel-2",
            model_id=model_id,
            source_id=app1.id,
            target_id=proc1.id,
            type="ServingRelationship"
        )
        # App2 --Serving--> Proc1 (Proc1 uses an app in Eliminate/Phase-out!)
        rel3 = ArchimateRelationship(
            id="p3-rel-3",
            model_id=model_id,
            source_id=app2.id,
            target_id=proc1.id,
            type="ServingRelationship"
        )
        # App1 --Access--> Data1
        rel4 = ArchimateRelationship(
            id="p3-rel-4",
            model_id=model_id,
            source_id=app1.id,
            target_id=data1.id,
            type="AccessRelationship"
        )

        db.add_all([rel1, rel2, rel3, rel4])
        db.commit()

        # 1. Multi-Hop Impact Simulation from Node1 in 'failure' mode
        impact_fail = ProcessService.simulate_impact(db, model_id, node1.id, mode="failure")
        assert impact_fail["source_element"]["id"] == node1.id
        assert impact_fail["simulation_mode"] == "failure"
        assert impact_fail["blast_radius"]["total_impacted_elements"] >= 2
        
        # Verify hop distances: App1 should be Hop 1, Proc1 should be Hop 2
        app_entry = next((a for a in impact_fail["impacted_applications"] if a["id"] == app1.id), None)
        assert app_entry is not None
        assert app_entry["hop_distance"] == 1

        proc_entry = next((p for p in impact_fail["impacted_processes"] if p["id"] == proc1.id), None)
        assert proc_entry is not None
        assert proc_entry["hop_distance"] == 2
        # Verify critical path sequence
        assert len(proc_entry["path"]) == 3
        assert proc_entry["path"][0]["id"] == node1.id
        assert proc_entry["path"][1]["id"] == app1.id
        assert proc_entry["path"][2]["id"] == proc1.id

        # In failure mode, Access to Data1 should NOT be in failure path
        assert len(impact_fail["impacted_data_objects"]) == 0

        # Now test 'change' mode from App1: Data1 should be impacted via Access
        impact_change = ProcessService.simulate_impact(db, model_id, app1.id, mode="change")
        assert len(impact_change["impacted_data_objects"]) >= 1
        assert impact_change["impacted_data_objects"][0]["id"] == data1.id

        # 2. Architectural Risk & SPOF Audit
        risks = ProcessService.detect_architectural_risks(db, model_id)
        assert risks["model_id"] == model_id
        assert risks["summary"]["total_risks"] >= 1
        # Check lifecycle risk detection (App2 in Eliminate/Phase-out supporting Proc1)
        assert any(r["severity"] == "HIGH" for r in risks["lifecycle_risks"])

        # Also verify catalog incorporates process risk diagnostics
        catalog = ProcessService.get_process_catalog(db, model_id)
        p1_cat = next((p for p in catalog["processes"] if p["id"] == proc1.id), None)
        assert p1_cat is not None
        assert p1_cat["is_critical"] is True
        assert p1_cat["has_lifecycle_risk"] is True

        # 3. ArchiMate Derivation Engine (§5.7)
        # Node1 --Serving (6)--> App1 --Serving (6)--> Proc1
        # Between Node (Technology) and BusinessProcess (Business), ArchiMate metamodel allows Association
        derived = compute_archimate_derivation(
            [node1, app1, app2, proc1, data1],
            [rel1, rel2, rel3, rel4],
            source_id=node1.id,
            target_id=proc1.id
        )
        assert len(derived) == 1
        assert derived[0]["source_id"] == node1.id
        assert derived[0]["target_id"] == proc1.id
        assert derived[0]["type"] == "AssociationRelationship"
        assert derived[0]["is_derived"] is True
        assert len(derived[0]["chain"]) == 2

        # Now test a chain where Serving is directly permitted:
        # AppService1 --Serving (6)--> App1 --Serving (6)--> Proc1
        app_srv = ArchimateElement(
            id="p3-srv-1",
            model_id=model_id,
            name="Customer Account Service",
            type="ApplicationService",
            layer="Application"
        )
        rel_srv = ArchimateRelationship(
            id="p3-rel-srv-1",
            model_id=model_id,
            source_id=app_srv.id,
            target_id=app1.id,
            type="ServingRelationship"
        )
        derived_srv = compute_archimate_derivation(
            [app_srv, app1, proc1],
            [rel_srv, rel2],
            source_id=app_srv.id,
            target_id=proc1.id
        )
        assert len(derived_srv) == 1
        assert derived_srv[0]["type"] == "ServingRelationship"

        # 4. Plateau Roadmap
        plateau_data = get_plateau_roadmap(
            [node1, app1, app2, proc1, data1],
            [rel1, rel2, rel3, rel4]
        )
        assert "horizons" in plateau_data
        assert len(plateau_data["horizons"]) == 3

    finally:
        db.close()


def test_sast_low_01_security_headers_and_docker_non_root():
    """Verify SAST-LOW-01 (OWASP HTTP security headers on all responses) and SCA-CONTAINER-ROOT (non-root Dockerfile)."""
    import os

    # 1. SAST-LOW-01: Verify HTTP Security Headers in FastAPI response
    res = client.get("/health")
    assert res.status_code == 200
    headers = res.headers
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "SAMEORIGIN"
    assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "camera=()" in headers.get("Permissions-Policy", "")
    assert "frame-ancestors 'self'" in headers.get("Content-Security-Policy", "")
    assert headers.get("X-XSS-Protection") == "1; mode=block"

    # Also test an API endpoint with security headers
    res_api = client.get("/api/auth/oidc/config")
    assert res_api.status_code == 200
    assert res_api.headers.get("X-Content-Type-Options") == "nosniff"
    assert res_api.headers.get("X-Frame-Options") == "SAMEORIGIN"

    # 2. SCA-CONTAINER-ROOT: Verify Dockerfile creates and switches to non-root user
    dockerfile_path = os.path.join(os.path.dirname(__file__), "../../Dockerfile")
    assert os.path.exists(dockerfile_path)
    with open(dockerfile_path, "r", encoding="utf-8") as f:
        dockerfile_content = f.read()

    assert "groupadd" in dockerfile_content
    assert "useradd" in dockerfile_content
    assert "USER easyea" in dockerfile_content
    assert "chown -R easyea:easyea" in dockerfile_content




