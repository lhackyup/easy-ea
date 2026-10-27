import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, get_db
from app.services.metamodel_service import seed_default_custom_attributes
from app.services.sample_data import seed_sample_model
from app.services.rbac_service import seed_default_rbac
from app.models.archimate import (
    ModelWorkspace,
    ArchimateElement,
    ArchimateRelationship,
    User,
    WorkspaceAttributePackage
)
from app.services.auth_service import create_access_token
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

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
def setup_test_db():
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

def test_bian_framework_catalog_and_canonical_elements():
    # 1. Check BIAN package in catalog
    res = client.get("/api/metamodel/packages")
    assert res.status_code == 200
    pkgs = res.json()
    bian = next((p for p in pkgs if p["code"] == "bian"), None)
    assert bian is not None
    assert bian["package_type"] == "framework"
    assert bian["standard_version"] == "v12.0"
    assert bian["reference_elements_count"] >= 8
    assert bian["reference_relationships_count"] >= 5

    # 2. Detail view of BIAN package
    res_detail = client.get(f"/api/metamodel/packages/{bian['id']}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert len(detail["reference_elements"]) >= 8
    assert len(detail["stereotypes"]) >= 2
    assert any(st["label"] == "«Service Domain»" for st in detail["stereotypes"])
    assert any(el["name"] == "Current Account" for el in detail["reference_elements"])

def test_framework_activation_scoping_and_readonly_protection():
    # Setup test workspace without active packages
    db = TestingSessionLocal()
    db.query(WorkspaceAttributePackage).filter(WorkspaceAttributePackage.model_id == "ws-framework-test").delete()
    ws = db.query(ModelWorkspace).filter(ModelWorkspace.id == "ws-framework-test").first()
    if not ws:
        ws = ModelWorkspace(id="ws-framework-test", name="Framework Test Lib", code="fwk")
        db.add(ws)
    db.commit()
    db.close()

    # 1. Without activation, elements query for ws-framework-test should NOT contain BIAN elements
    res_init = client.get("/api/elements?model_id=ws-framework-test")
    assert res_init.status_code == 200
    assert not any(e.get("package_code") == "bian" for e in res_init.json())

    # 2. Activate BIAN package
    res_act = client.post("/api/metamodel/libraries/ws-framework-test/packages/pkg-bian/toggle", json={"active": True})
    assert res_act.status_code == 200
    assert res_act.json()["is_active"] is True

    # 3. Now elements query MUST contain canonical reference elements with is_reference=True
    res_active = client.get("/api/elements?model_id=ws-framework-test")
    assert res_active.status_code == 200
    elements = res_active.json()
    bian_elems = [e for e in elements if e.get("package_code") == "bian"]
    assert len(bian_elems) >= 8
    cur_acc = next(e for e in bian_elems if e["name"] == "Current Account")
    assert cur_acc["is_reference"] is True
    assert cur_acc["package_id"] == "pkg-bian"

    # 4. Read-Only Protection: editing or deleting canonical reference element must fail with 403
    res_edit = client.put(f"/api/elements/{cur_acc['id']}", json={"name": "Hacked Account"})
    assert res_edit.status_code == 403

    res_del = client.delete(f"/api/elements/{cur_acc['id']}")
    assert res_del.status_code == 403

    # 5. Read-Only Protection on canonical reference relationship
    res_rels = client.get("/api/relationships?model_id=ws-framework-test")
    assert res_rels.status_code == 200
    ref_rel = next((r for r in res_rels.json() if r.get("package_code") == "bian"), None)
    assert ref_rel is not None
    assert ref_rel["is_reference"] is True

    res_rel_edit = client.put(f"/api/relationships/{ref_rel['id']}", json={"name": "Hacked Rel"})
    assert res_rel_edit.status_code == 403

    res_rel_del = client.delete(f"/api/relationships/{ref_rel['id']}")
    assert res_rel_del.status_code == 403

def test_framework_local_connection_and_deactivation_guard():
    # Ensure BIAN is activated on ws-framework-test
    client.post("/api/metamodel/libraries/ws-framework-test/packages/pkg-bian/toggle", json={"active": True})

    # 1. Create a local component in ws-framework-test
    res_create = client.post("/api/elements?model_id=ws-framework-test", json={
        "name": "Custom Core App",
        "type": "ApplicationComponent",
        "layer": "Application"
    })
    assert res_create.status_code == 200
    local_elem_id = res_create.json()["id"]

    # 2. Connect local component to BIAN reference element 'elem-bian-sd-current-account'
    res_rel = client.post("/api/relationships?model_id=ws-framework-test", json={
        "source_id": local_elem_id,
        "target_id": "elem-bian-sd-current-account",
        "type": "AssociationRelationship",
        "name": "Implements BIAN Current Account"
    })
    assert res_rel.status_code == 200
    rel_id = res_rel.json()["id"]

    # 3. Attempting to deactivate BIAN must be BLOCKED with 409 because local relationship depends on it
    res_deact = client.post("/api/metamodel/libraries/ws-framework-test/packages/pkg-bian/toggle", json={"active": False})
    assert res_deact.status_code == 409
    assert res_deact.json()["detail"]["error"] == "package_deactivation_blocked"

    # 4. Delete the local relationship
    res_del_rel = client.delete(f"/api/relationships/{rel_id}")
    assert res_del_rel.status_code == 200

    # 5. Now deactivation succeeds cleanly
    res_deact_ok = client.post("/api/metamodel/libraries/ws-framework-test/packages/pkg-bian/toggle", json={"active": False})
    assert res_deact_ok.status_code == 200
    assert res_deact_ok.json()["is_active"] is False


def test_it4it_framework_catalog_and_canonical_elements():
    # 1. Check IT4IT package in catalog
    res = client.get("/api/metamodel/packages")
    assert res.status_code == 200
    pkgs = res.json()
    it4it = next((p for p in pkgs if p["code"] == "it4it"), None)
    assert it4it is not None
    assert it4it["package_type"] == "framework"
    assert it4it["standard_version"] == "v3.0"
    assert it4it["website_url"] == "https://www.opengroup.org/it4it"
    assert it4it["reference_elements_count"] >= 17
    assert it4it["reference_relationships_count"] >= 16

    # 2. Detail view of IT4IT package
    res_detail = client.get(f"/api/metamodel/packages/{it4it['id']}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert len(detail["reference_elements"]) >= 17
    assert len(detail["stereotypes"]) >= 3
    assert any(st["label"] == "«IT4IT Value Stream»" for st in detail["stereotypes"])
    assert any(st["label"] == "«IT4IT Functional Component»" for st in detail["stereotypes"])
    assert any(st["label"] == "«IT4IT Key Data Object»" for st in detail["stereotypes"])
    assert any(el["name"] == "Strategy to Portfolio (S2P)" for el in detail["reference_elements"])
    assert any(el["name"] == "Build & Continuous Delivery (CI/CD)" for el in detail["reference_elements"])
    assert any(el["name"] == "Configuration Management (CMS / CMDB)" for el in detail["reference_elements"])
    assert any(el["name"] == "Digital Product Blueprint" for el in detail["reference_elements"])

