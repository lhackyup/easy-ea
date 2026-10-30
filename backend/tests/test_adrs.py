import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.services.sample_data import seed_sample_model
from app.services.rbac_service import seed_default_rbac
from app.models.archimate import User, ArchitectureDecisionRecord, ADRLinkedElement
from app.services.auth_service import create_access_token

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    db = TestingSessionLocal()

    # Clean up test ADRs before seeding
    db.query(ADRLinkedElement).delete()
    db.query(ArchitectureDecisionRecord).delete()
    db.commit()

    seed_sample_model(db)
    seed_default_rbac(db)

    admin_user = db.query(User).filter(User.username == "admin").first() or db.query(User).first()
    if admin_user:
        token = create_access_token(admin_user)
        client.headers.update({"Authorization": f"Bearer {token}"})
    db.close()
    yield
    app.dependency_overrides.pop(get_db, None)


def test_list_seeded_adrs_and_summary():
    """Verify sample ADRs are seeded and KPI summary is accurately computed."""
    res = client.get("/api/adrs?model_id=sample-easybank-ea")
    assert res.status_code == 200
    data = res.json()
    assert data["model_id"] == "sample-easybank-ea"
    assert data["summary"]["total"] == 4
    assert data["summary"]["accepted"] == 2
    assert data["summary"]["deprecated"] == 1
    assert data["summary"]["proposed"] == 1
    assert len(data["items"]) == 4

    # Filter by status
    res_acc = client.get("/api/adrs?model_id=sample-easybank-ea&status=Accepted")
    assert res_acc.status_code == 200
    assert len(res_acc.json()["items"]) == 2


def test_create_update_supersede_and_export_adr():
    """Verify ADR creation with auto-code generation, linked elements, Supersede lifecycle, and MADR export."""
    create_payload = {
        "title": "Adoption of OAuth2 / OIDC with Keycloak for Enterprise SSO",
        "status": "Proposed",
        "domain": "Security",
        "context_and_problem": "Need unified identity provider across internal portals and APIs.",
        "decision_drivers": [
            "Zero-Trust security posture",
            "Eliminate local password silos"
        ],
        "considered_options": [
            {
                "title": "Keycloak Self-Hosted on EKS",
                "description": "CNCF open-source IAM.",
                "pros": "Full control, no per-MAU licensing fee",
                "cons": "Operational maintenance"
            },
            {
                "title": "Commercial SaaS IdP",
                "description": "Cloud identity provider.",
                "pros": "Managed service",
                "cons": "High cost at scale"
            }
        ],
        "decision_outcome": "Adopt Keycloak on AWS EKS Cluster.",
        "consequences": "Requires HA Postgres cluster.",
        "compliance_impact": "GDPR & DORA strong authentication compliance.",
        "deciders": "CISO, Lead Enterprise Architect",
        "linked_elements": [
            {
                "element_id": "tech-aws-cluster",
                "impact_type": "modifies",
                "notes": "Hosts Keycloak StatefulSet"
            },
            {
                "element_id": "app-cloud-core",
                "impact_type": "governs",
                "notes": "Enforces OIDC token validation"
            }
        ]
    }
    res = client.post("/api/adrs?model_id=sample-easybank-ea", json=create_payload)
    assert res.status_code == 200
    created = res.json()
    assert created["code"] == "ADR-0005"
    assert created["status"] == "Proposed"
    assert created["linked_elements_count"] == 2

    adr_id = created["id"]

    # Check that get_element returns this linked ADR
    el_res = client.get("/api/elements/app-cloud-core")
    assert el_res.status_code == 200
    el_data = el_res.json()
    linked_codes = [a["code"] for a in el_data.get("linked_adrs", [])]
    assert "ADR-0001" in linked_codes
    assert "ADR-0005" in linked_codes

    # Transition ADR-0005 to Accepted
    trans_res = client.post(
        f"/api/adrs/{adr_id}/transition",
        json={"status": "Accepted", "deciders": "Architecture Board"}
    )
    assert trans_res.status_code == 200
    assert trans_res.json()["status"] == "Accepted"
    assert trans_res.json()["decided_at"] is not None

    # Create ADR-0006 that supersedes ADR-0005
    sup_payload = {
        "title": "Upgrade Identity Architecture to Passkeys / WebAuthn FIDO2",
        "status": "Accepted",
        "domain": "Security",
        "context_and_problem": "Phishing-resistant MFA required for privileged operations.",
        "decision_outcome": "Supersede password-based OIDC flows with FIDO2 Passkeys.",
        "supersedes_adr_id": adr_id,
        "linked_elements": [
            {"element_id": "app-cloud-core", "impact_type": "governs", "notes": "FIDO2 enforced"}
        ]
    }
    res_sup = client.post("/api/adrs?model_id=sample-easybank-ea", json=sup_payload)
    assert res_sup.status_code == 200
    new_adr = res_sup.json()
    assert new_adr["code"] == "ADR-0006"
    assert len(new_adr["supersedes"]) == 1
    assert new_adr["supersedes"][0]["code"] == "ADR-0005"

    # Verify old ADR-0005 is now marked Superseded and points to ADR-0006
    old_res = client.get(f"/api/adrs/{adr_id}")
    assert old_res.status_code == 200
    old_data = old_res.json()
    assert old_data["status"] == "Superseded"
    assert old_data["superseded_by"]["code"] == "ADR-0006"

    # Export MADR Markdown
    md_res = client.get(f"/api/adrs/{new_adr['id']}/export-md")
    assert md_res.status_code == 200
    md_text = md_res.json()["markdown"]
    assert "# ADR-0006:" in md_text
    assert "**Supersedes:** ADR-0005" in md_text
    assert "Thought Machine Vault Core" in md_text


def test_adr_governance_risks_in_process_audit():
    """Verify ProcessService.detect_architectural_risks detects ADR governance drift."""
    res = client.get("/api/processes/risks/sample-easybank-ea")
    assert res.status_code == 200
    data = res.json()
    assert "adr_governance_risks" in data
    assert "adr_governance_risks_count" in data["summary"]
    # ADR-0003 is Deprecated and governs app-feedzai-fraud (which is Live)
    drift_codes = [r["adr_code"] for r in data["adr_governance_risks"]]
    assert "ADR-0003" in drift_codes
