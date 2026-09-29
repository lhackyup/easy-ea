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









