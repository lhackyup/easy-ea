import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.archimate import User, ArchimateElement, ApplicationBusinessAttributes
from app.services.auth_service import create_access_token
from app.services.rbac_service import seed_default_rbac
from app.services.seed_easybank_apm_data import seed_easybank_apm_portfolio


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture(scope="module")
def seeded_db():
    db = SessionLocal()
    seed_default_rbac(db)
    seed_easybank_apm_portfolio(db)
    yield db
    db.close()


@pytest.fixture(scope="module")
def user_tokens(seeded_db):
    usernames = [
        "admin", "giorgio_cio", "marco_arch", "laura_analyst",
        "roberto_owner", "elena_business", "demo"
    ]
    tokens = {}
    for u in usernames:
        user = seeded_db.query(User).filter(User.username == u).first()
        assert user is not None, f"User {u} not found in DB"
        tokens[u] = create_access_token(user)
    return tokens


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. UNAUTHENTICATED ACCESS AUDIT
# ==============================================================================
def test_unauthenticated_requests_are_rejected(client):
    sensitive_endpoints = [
        ("GET", "/api/models"),
        ("GET", "/api/elements?model_id=sample-easybank-ea"),
        ("POST", "/api/elements"),
        ("GET", "/api/apm/portfolio/sample-easybank-ea"),
        ("GET", "/api/apm/tco-breakdown/sample-easybank-ea"),
        ("GET", "/api/surveys/campaigns/sample-easybank-ea"),
        ("GET", "/api/surveys/my-surveys"),
        ("GET", "/api/api-keys"),
        ("GET", "/api/admin/audit-logs"),
        ("GET", "/api/auth/admin/config"),
        ("GET", "/api/metamodel/attributes"),
        ("GET", "/api/schemas/sample-easybank-ea/list"),
    ]
    for method, path in sensitive_endpoints:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path, json={})
        assert res.status_code == 401, f"Expected 401 on unauthenticated {method} {path}, got {res.status_code}"


# ==============================================================================
# 2. ADMINISTRATION HUB & SENSITIVE CONFIG AUDIT
# ==============================================================================
def test_admin_hub_rbac_isolation(client, user_tokens):
    admin_endpoints = [
        ("GET", "/api/admin/audit-logs"),
        ("GET", "/api/admin/audit-logs/summary"),
        ("GET", "/api/api-keys"),
        ("GET", "/api/auth/admin/config"),
        ("POST", "/api/api-keys", {"name": "Test Key", "scopes": ["read"]}),
    ]

    # Admin: all allowed
    for method, path, *payload in admin_endpoints:
        body = payload[0] if payload else None
        if method == "GET":
            res = client.get(path, headers=auth_header(user_tokens["admin"]))
        else:
            res = client.post(path, headers=auth_header(user_tokens["admin"]), json=body)
        assert res.status_code in (200, 201), f"Admin should access {method} {path}, got {res.status_code}"

    # Non-admin roles (except demo on read-only) MUST receive 403 Forbidden
    non_admin_roles = ["giorgio_cio", "marco_arch", "laura_analyst", "roberto_owner", "elena_business"]
    for role in non_admin_roles:
        token = user_tokens[role]
        for method, path, *payload in admin_endpoints:
            body = payload[0] if payload else None
            if method == "GET":
                res = client.get(path, headers=auth_header(token))
            else:
                res = client.post(path, headers=auth_header(token), json=body)
            assert res.status_code == 403, f"Role {role} should be forbidden on {method} {path}, got {res.status_code}"

    # Demo / Viewer: allowed on read-only (require_admin_or_viewer), forbidden on write
    res_viewer_audit = client.get("/api/admin/audit-logs", headers=auth_header(user_tokens["demo"]))
    assert res_viewer_audit.status_code == 200

    res_viewer_write = client.post(
        "/api/api-keys",
        headers=auth_header(user_tokens["demo"]),
        json={"name": "Illegal Viewer Key", "scopes": ["read"]}
    )
    assert res_viewer_write.status_code == 403


# ==============================================================================
# 3. FINANCIAL REDACTION & C-LEVEL ACCESS AUDIT
# ==============================================================================
def test_financial_analytics_rbac_matrix(client, user_tokens):
    # 1. TCO Breakdown: ONLY C-Level and Admin allowed (HTTP 200)
    res_admin = client.get("/api/apm/tco-breakdown/sample-easybank-ea", headers=auth_header(user_tokens["admin"]))
    assert res_admin.status_code == 200

    res_cio = client.get("/api/apm/tco-breakdown/sample-easybank-ea", headers=auth_header(user_tokens["giorgio_cio"]))
    assert res_cio.status_code == 200

    # All non-C-Level roles MUST be 403 Forbidden
    forbidden_roles = ["marco_arch", "laura_analyst", "roberto_owner", "elena_business", "demo"]
    for role in forbidden_roles:
        res = client.get("/api/apm/tco-breakdown/sample-easybank-ea", headers=auth_header(user_tokens[role]))
        assert res.status_code == 403, f"Role {role} should be 403 on TCO breakdown, got {res.status_code}"

    # 2. APM Portfolio: Financial redaction check
    # C-Level: real costs
    data_cio = client.get("/api/apm/portfolio/sample-easybank-ea", headers=auth_header(user_tokens["giorgio_cio"])).json()
    assert data_cio["total_annual_cost"] is not None and data_cio["total_annual_cost"] > 0
    assert data_cio.get("_financials_redacted") is not True

    # Business User: redacted
    data_buser = client.get("/api/apm/portfolio/sample-easybank-ea", headers=auth_header(user_tokens["elena_business"])).json()
    assert data_buser["total_annual_cost"] is None
    assert data_buser.get("_financials_redacted") is True

    # Analyst: redacted
    data_analyst = client.get("/api/apm/portfolio/sample-easybank-ea", headers=auth_header(user_tokens["laura_analyst"])).json()
    assert data_analyst["total_annual_cost"] is None
    assert data_analyst.get("_financials_redacted") is True

    # Viewer: redacted
    data_viewer = client.get("/api/apm/portfolio/sample-easybank-ea", headers=auth_header(user_tokens["demo"])).json()
    assert data_viewer["total_annual_cost"] is None
    assert data_viewer.get("_financials_redacted") is True


# ==============================================================================
# 4. ARCHITECTURAL MUTATIONS & WRITE ISOLATION AUDIT
# ==============================================================================
def test_architectural_mutations_rbac(client, user_tokens):
    new_element_payload = {
        "name": "RBAC Audit Component",
        "type": "ApplicationComponent",
        "layer": "Application"
    }

    # Architect (marco_arch) & Admin (admin) CAN create elements in assigned library
    res_arch = client.post(
        "/api/elements?model_id=sample-easybank-ea",
        headers=auth_header(user_tokens["marco_arch"]),
        json=new_element_payload
    )
    assert res_arch.status_code in (200, 201), f"Architect should create element, got {res_arch.status_code}: {res_arch.text}"

    # Non-architects CANNOT create elements (HTTP 403)
    read_only_roles = ["elena_business", "demo", "giorgio_cio", "roberto_owner"]
    for role in read_only_roles:
        res = client.post(
            "/api/elements?model_id=sample-easybank-ea",
            headers=auth_header(user_tokens[role]),
            json=new_element_payload
        )
        assert res.status_code == 403, f"Role {role} should be forbidden from creating elements, got {res.status_code}"


# ==============================================================================
# 5. SURVEYS & APPLICATION OWNERSHIP PORTAL AUDIT
# ==============================================================================
def test_surveys_and_ownership_rbac(client, user_tokens):
    # Campaign Management (manage_surveys): Admin and Architect allowed, others 403
    res_admin = client.get("/api/surveys/campaigns/sample-easybank-ea", headers=auth_header(user_tokens["admin"]))
    assert res_admin.status_code == 200

    res_arch = client.get("/api/surveys/campaigns/sample-easybank-ea", headers=auth_header(user_tokens["marco_arch"]))
    assert res_arch.status_code == 200

    unauthorized_campaign_roles = ["elena_business", "giorgio_cio", "roberto_owner", "demo"]
    for role in unauthorized_campaign_roles:
        res = client.get("/api/surveys/campaigns/sample-easybank-ea", headers=auth_header(user_tokens[role]))
        assert res.status_code == 403, f"Role {role} should be 403 on survey campaigns, got {res.status_code}"

    # Owner Portal (view_owner_portal): Roberto (app_owner) and Admin allowed, business user forbidden (403)
    res_owner_surveys = client.get("/api/surveys/my-surveys?model_id=sample-easybank-ea", headers=auth_header(user_tokens["roberto_owner"]))
    assert res_owner_surveys.status_code == 200

    res_owner_apps = client.get("/api/surveys/my-applications?model_id=sample-easybank-ea", headers=auth_header(user_tokens["roberto_owner"]))
    assert res_owner_apps.status_code == 200

    res_buser_surveys = client.get("/api/surveys/my-surveys?model_id=sample-easybank-ea", headers=auth_header(user_tokens["elena_business"]))
    assert res_buser_surveys.status_code == 403

    res_buser_apps = client.get("/api/surveys/my-applications?model_id=sample-easybank-ea", headers=auth_header(user_tokens["elena_business"]))
    assert res_buser_apps.status_code == 403


# ==============================================================================
# 6. WORKSPACE ISOLATION AUDIT (CROSS-LIBRARY RESTRICTIONS)
# ==============================================================================
def test_cross_library_write_isolation(client, user_tokens, seeded_db):
    # Marco (marco_arch) is assigned to 'sample-easybank-ea'.
    # If he attempts to write to an unassigned library, he MUST be 403 Forbidden.
    unassigned_library_id = "model-unassigned-test"
    
    res = client.post(
        f"/api/elements?model_id={unassigned_library_id}",
        headers=auth_header(user_tokens["marco_arch"]),
        json={
            "name": "Cross Library Illegal Component",
            "type": "ApplicationComponent",
            "layer": "Application"
        }
    )
    assert res.status_code == 403, f"Architect must not be able to write to unassigned library, got {res.status_code}"


# ==============================================================================
# 7. ANALYSES FINANCIAL REDACTION AUDIT (OVERLAP, FUNCTIONAL & DOCX EXPORT)
# ==============================================================================
def test_analyses_financial_redaction(client, user_tokens, seeded_db):
    # 1. Overlap matrix: C-Level gets savings figures, Business User & App Owner get None
    res_cio_overlap = client.get("/api/overlap/matrix/sample-easybank-ea", headers=auth_header(user_tokens["giorgio_cio"]))
    assert res_cio_overlap.status_code == 200
    assert res_cio_overlap.json().get("potential_savings_opportunity") is not None

    res_buser_overlap = client.get("/api/overlap/matrix/sample-easybank-ea", headers=auth_header(user_tokens["elena_business"]))
    assert res_buser_overlap.status_code == 200
    assert res_buser_overlap.json().get("potential_savings_opportunity") is None
    assert res_buser_overlap.json().get("_financials_redacted") is True

    res_owner_overlap = client.get("/api/overlap/matrix/sample-easybank-ea", headers=auth_header(user_tokens["roberto_owner"]))
    assert res_owner_overlap.status_code == 200
    assert res_owner_overlap.json().get("potential_savings_opportunity") is None

    # 2. Functional analysis: C-Level gets savings, Business User gets None
    res_cio_func = client.get("/api/functional/analysis/sample-easybank-ea", headers=auth_header(user_tokens["giorgio_cio"]))
    assert res_cio_func.status_code == 200
    assert res_cio_func.json().get("total_potential_savings") is not None

    res_buser_func = client.get("/api/functional/analysis/sample-easybank-ea", headers=auth_header(user_tokens["elena_business"]))
    assert res_buser_func.status_code == 200
    assert res_buser_func.json().get("total_potential_savings") is None
    assert res_buser_func.json().get("_financials_redacted") is True

    # 3. APM DOCX export: C-Level allowed (200), Business User forbidden (403)
    res_buser_docx = client.get("/api/apm/export/docx/sample-easybank-ea", headers=auth_header(user_tokens["elena_business"]))
    assert res_buser_docx.status_code == 403

    res_cio_docx = client.get("/api/apm/export/docx/sample-easybank-ea", headers=auth_header(user_tokens["giorgio_cio"]))
    assert res_cio_docx.status_code == 200

    # 4. Process Cost & TCO: C-Level gets costs, Business User gets None
    res_cio_ptco = client.get("/api/processes/tco/sample-easybank-ea", headers=auth_header(user_tokens["giorgio_cio"]))
    assert res_cio_ptco.status_code == 200
    assert res_cio_ptco.json()["summary"].get("total_allocated_cost") is not None

    res_buser_ptco = client.get("/api/processes/tco/sample-easybank-ea", headers=auth_header(user_tokens["elena_business"]))
    assert res_buser_ptco.status_code == 200
    assert res_buser_ptco.json()["summary"].get("total_allocated_cost") is None
    assert res_buser_ptco.json()["summary"].get("_financials_redacted") is True

    # 5. Lifecycle & Decommissioning: C-Level gets takeout savings & costs, Business User gets None
    res_cio_life = client.get("/api/apm/lifecycle/sample-easybank-ea", headers=auth_header(user_tokens["giorgio_cio"]))
    assert res_cio_life.status_code == 200
    assert res_cio_life.json()["summary"].get("total_takeout_savings") is not None

    res_buser_life = client.get("/api/apm/lifecycle/sample-easybank-ea", headers=auth_header(user_tokens["elena_business"]))
    assert res_buser_life.status_code == 200
    assert res_buser_life.json()["summary"].get("total_takeout_savings") is None
    assert res_buser_life.json()["summary"].get("_financials_redacted") is True
    # Verify costs_by_status has None values for business user
    status_costs = res_buser_life.json()["summary"].get("costs_by_status", {})
    assert all(v is None for v in status_costs.values())

    # 6. Technology Obsolescence & Risk Radar: C-Level gets annual costs, Business User gets None
    res_cio_tech = client.get("/api/apm/tech-risk/sample-easybank-ea", headers=auth_header(user_tokens["giorgio_cio"]))
    assert res_cio_tech.status_code == 200
    assert any(a.get("annual_cost") is not None for a in res_cio_tech.json().get("dora_compliance_alerts", []))
    assert any(t.get("total_impacted_annual_cost") is not None for t in res_cio_tech.json().get("technology_blast_radius", []))

    res_buser_tech = client.get("/api/apm/tech-risk/sample-easybank-ea", headers=auth_header(user_tokens["elena_business"]))
    assert res_buser_tech.status_code == 200
    assert res_buser_tech.json().get("_financials_redacted") is True
    assert all(a.get("annual_cost") is None for a in res_buser_tech.json().get("dora_compliance_alerts", []))
    assert all(t.get("total_impacted_annual_cost") is None for t in res_buser_tech.json().get("technology_blast_radius", []))
    assert all(a.get("annual_cost") is None for a in res_buser_tech.json().get("applications", []))
