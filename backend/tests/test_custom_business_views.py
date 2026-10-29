import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_FILE = "./test_custom_views.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

from app.main import app
from app.core.database import Base, get_db
from app.services.metamodel_service import seed_default_custom_attributes
from app.services.sample_data import seed_sample_model
from app.services.rbac_service import seed_default_rbac
from app.models.archimate import (
    User,
    ModelWorkspace,
    ArchimateElement,
    PackageView
)
from app.services.auth_service import create_access_token

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
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

    seed_sample_model(db)
    seed_default_custom_attributes(db)
    seed_default_rbac(db)

    admin_user = db.query(User).filter(User.username == "admin").first() or db.query(User).first()
    if admin_user:
        token = create_access_token(admin_user)
        client.headers.update({"Authorization": f"Bearer {token}"})
    db.close()
    yield
    app.dependency_overrides.pop(get_db, None)


def test_custom_business_views_crud_and_execution():
    db = TestingSessionLocal()
    model = db.query(ModelWorkspace).first()
    assert model is not None, "Model workspace should exist"
    model_id = model.id

    # 0. Test live preview of an in-flight view definition (before saving)
    preview_payload = {
        "name": "Live Preview Apps",
        "view_type": "table",
        "target_types": ["ApplicationComponent"],
        "config": {
            "columns": [
                {"field": "name", "label": "App Name", "type": "string"},
                {"field": "type", "label": "Type", "type": "badge"}
            ]
        }
    }
    prev_resp = client.post(f"/api/business/package-views/preview?model_id={model_id}", json=preview_payload)
    assert prev_resp.status_code == 200, prev_resp.text
    prev_data = prev_resp.json()
    assert prev_data["view_type"] == "table"
    assert "rows" in prev_data
    assert len(prev_data["rows"]) > 0, "Preview should return real workspace elements"
    for r in prev_data["rows"]:
        assert r["type"] == "ApplicationComponent"

    # 1. Create a custom business view
    payload = {
        "name": "Mission Critical Applications",
        "view_key": "mission_critical_apps",
        "description": "List of core enterprise applications",
        "category": "Governance",
        "view_type": "table",
        "icon": "Table",
        "sort_order": 5,
        "is_global": False,
        "target_stereotypes": [],
        "target_types": ["ApplicationComponent"],
        "config": {
            "columns": [
                {"field": "name", "label": "Application Name", "type": "string", "sortable": True, "filterable": True},
                {"field": "type", "label": "Type", "type": "badge", "sortable": True},
                {"field": "layer", "label": "Layer", "type": "badge", "sortable": True}
            ]
        }
    }

    create_resp = client.post(f"/api/business/package-views/custom?model_id={model_id}", json=payload)
    assert create_resp.status_code == 200, create_resp.text
    created = create_resp.json()["view"]
    assert created["name"] == "Mission Critical Applications"
    view_id = created["id"]
    assert view_id is not None
    assert created["is_active"] is False, "Newly created custom view must be inactive (draft) by default"

    # 2. List custom business views (visible to architect as inactive)
    list_resp = client.get(f"/api/business/package-views/custom?model_id={model_id}")
    assert list_resp.status_code == 200
    views_list = list_resp.json().get("views", [])
    found = [v for v in views_list if v["id"] == view_id]
    assert len(found) == 1
    assert found[0]["is_active"] is False
    assert found[0]["matching_elements_count"] >= 0

    # 3. Check that inactive view is NOT visible in Business hub (GET /api/business/package-views)
    pkg_views_resp = client.get(f"/api/business/package-views?model_id={model_id}")
    assert pkg_views_resp.status_code == 200
    pkgs = pkg_views_resp.json().get("packages", [])
    custom_pkg = next((p for p in pkgs if p["id"] == "custom-business-views"), None)
    if custom_pkg:
        assert not any(v["id"] == view_id for v in custom_pkg["views"]), "Inactive view must NOT appear in business section"

    # 4. Activate the view via PATCH status
    status_resp = client.patch(f"/api/business/package-views/custom/{view_id}/status", json={"is_active": True})
    assert status_resp.status_code == 200
    assert status_resp.json()["is_active"] is True

    # 5. Verify that active view is NOW visible in Business hub
    pkg_views_resp2 = client.get(f"/api/business/package-views?model_id={model_id}")
    assert pkg_views_resp2.status_code == 200
    pkgs2 = pkg_views_resp2.json().get("packages", [])
    custom_pkg2 = next((p for p in pkgs2 if p["id"] == "custom-business-views"), None)
    assert custom_pkg2 is not None, "custom-business-views package should exist once a view is active"
    assert any(v["id"] == view_id for v in custom_pkg2["views"]), "Active view must appear in business section"

    # 6. Execute the custom view
    exec_resp = client.post(f"/api/business/package-views/{view_id}/execute?model_id={model_id}", json={})
    assert exec_resp.status_code == 200, exec_resp.text
    exec_data = exec_resp.json()
    assert exec_data["view_id"] == view_id
    assert "rows" in exec_data
    # Should only contain ApplicationComponent elements
    for row in exec_data["rows"]:
        assert row["type"] == "ApplicationComponent"

    # 5. Update the custom view
    update_payload = {
        "name": "Updated Mission Critical Apps",
        "sort_order": 1,
        "is_global": True
    }
    update_resp = client.put(f"/api/business/package-views/custom/{view_id}", json=update_payload)
    assert update_resp.status_code == 200
    updated = update_resp.json()["view"]
    assert updated["name"] == "Updated Mission Critical Apps"
    assert updated["sort_order"] == 1
    assert updated["is_global"] is True

    # 6. Global view visibility: create a second model and verify global view is visible
    model2 = ModelWorkspace(id="test-secondary-model", name="Secondary Model Workspace")
    db.add(model2)
    db.commit()

    list_resp2 = client.get(f"/api/business/package-views/custom?model_id={model2.id}")
    assert list_resp2.status_code == 200
    assert any(v["id"] == view_id for v in list_resp2.json().get("views", []))

    # 7. Delete the custom view
    del_resp = client.delete(f"/api/business/package-views/custom/{view_id}")
    assert del_resp.status_code == 200

    # Verify view is deleted
    list_after_del = client.get(f"/api/business/package-views/custom?model_id={model_id}")
    assert not any(v["id"] == view_id for v in list_after_del.json().get("views", []))

    # Clean up secondary model
    db.delete(model2)
    db.commit()
    db.close()


def test_custom_business_view_filter_config_preservation():
    """Verify that views saved from repository filter search apply ALL filters when executed in Business Hub."""
    db = TestingSessionLocal()
    model = db.query(ModelWorkspace).first()
    assert model is not None
    model_id = model.id

    # Create a view representing a saved filtered repository search
    # Filter on Application layer + Mission Critical attribute rule + search for "Vault"
    filter_config = {
        "selectedLayer": "Application",
        "selectedType": "ApplicationComponent",
        "search": "Vault",
        "searchInProps": True,
        "relationshipFilter": "all",
        "documentationFilter": "with_doc",
        "matchLogic": "AND",
        "attributeFilterRules": [
            {
                "id": "rule-crit",
                "attributeName": "business_criticality",
                "operator": "equals",
                "value": "Mission Critical"
            }
        ],
        "sortBy": "name_asc"
    }

    payload = {
        "name": "Vault Core Mission Critical View",
        "category": "Repository Views",
        "view_type": "table",
        "is_active": True,
        "target_types": ["ApplicationComponent"],
        "config": {
            "columns": [
                {"field": "name", "label": "Nome", "type": "string", "sortable": True, "filterable": True},
                {"field": "type", "label": "Tipo", "type": "badge", "sortable": True},
                {"field": "business_criticality", "label": "Criticità", "type": "badge", "filterable": True}
            ],
            "filter_config": filter_config
        }
    }

    create_resp = client.post(f"/api/business/package-views/custom?model_id={model_id}", json=payload)
    assert create_resp.status_code == 200, create_resp.text
    created = create_resp.json()["view"]
    view_id = created["id"]

    # 1. Check matching elements count via custom list endpoint
    list_resp = client.get(f"/api/business/package-views/custom?model_id={model_id}")
    assert list_resp.status_code == 200
    views = list_resp.json()["views"]
    target_v = next((v for v in views if v["id"] == view_id), None)
    assert target_v is not None
    # Exactly 1 element matches "Vault" + "Mission Critical": "Thought Machine Vault Core"
    assert target_v["matching_elements_count"] == 1

    # 2. Execute the view as Business section does
    exec_resp = client.post(f"/api/business/package-views/{view_id}/execute?model_id={model_id}", json={})
    assert exec_resp.status_code == 200, exec_resp.text
    exec_data = exec_resp.json()

    assert exec_data["total"] == 1, f"Expected 1 element matching filters, got {exec_data['total']}"
    assert len(exec_data["rows"]) == 1
    matched = exec_data["rows"][0]
    assert matched["name"] == "Thought Machine Vault Core"
    assert matched["business_criticality"] == "Mission Critical"
    assert "Vault" in matched["name"]

    # 3. Test Preview endpoint with the same in-flight config
    prev_resp = client.post(f"/api/business/package-views/preview?model_id={model_id}", json=payload)
    assert prev_resp.status_code == 200
    prev_data = prev_resp.json()
    assert prev_data["total"] == 1
    assert prev_data["rows"][0]["name"] == "Thought Machine Vault Core"

    # 4. Test Partial Update WITHOUT name (ensures no 422 Unprocessable Entity error)
    partial_update_payload = {
        "target_types": ["ApplicationComponent"],
        "package_id": "pkg-apm-enterprise",
        "config": {
            "columns": payload["config"]["columns"],
            "filter_config": {
                **filter_config,
                "search": "Vault Updated"
            }
        }
    }
    update_resp = client.put(f"/api/business/package-views/custom/{view_id}", json=partial_update_payload)
    assert update_resp.status_code == 200, f"Expected 200 on partial update without name, got {update_resp.status_code}: {update_resp.text}"
    updated_view = update_resp.json()["view"]
    assert updated_view["name"] == payload["name"], "Name should be preserved when omitted in partial update"
    assert updated_view["package_id"] == "pkg-apm-enterprise"
    assert updated_view["config"]["filter_config"]["search"] == "Vault Updated"

    # Cleanup
    client.delete(f"/api/business/package-views/custom/{view_id}")
    db.close()


def test_default_archimate_views_seeding_and_execution():
    db = TestingSessionLocal()
    model = db.query(ModelWorkspace).first()
    assert model is not None
    model_id = model.id

    # 1. Verify default views seeded
    from app.services.metamodel_service import seed_default_archimate_views
    seed_default_archimate_views(db)

    list_resp = client.get(f"/api/business/package-views/custom?model_id={model_id}")
    assert list_resp.status_code == 200
    views = list_resp.json().get("views", [])

    archimate_keys = {
        "archimate_app_landscape",
        "archimate_process_catalog",
        "archimate_infra_landscape",
        "archimate_data_catalog",
        "archimate_strategy_portfolio",
        "archimate_model_health",
        "archimate_cross_layer_matrix",
        "archimate_orphan_audit",
        "archimate_undocumented_audit"
    }

    found_keys = {v["view_key"] for v in views}
    assert archimate_keys.issubset(found_keys), f"Missing keys: {archimate_keys - found_keys}"

    # Verify they are inactive (draft) initially and global
    for v in views:
        if v["view_key"] in archimate_keys:
            assert v["is_global"] is True
            assert v["is_active"] is False

    # 2. Activate Application Landscape Catalog
    app_v = next(v for v in views if v["view_key"] == "archimate_app_landscape")
    status_resp = client.patch(f"/api/business/package-views/custom/{app_v['id']}/status", json={"is_active": True})
    assert status_resp.status_code == 200
    assert status_resp.json()["is_active"] is True

    # 3. Verify it is now visible in Business hub
    hub_resp = client.get(f"/api/business/package-views?model_id={model_id}")
    assert hub_resp.status_code == 200
    pkgs = hub_resp.json().get("packages", [])
    biz_views_pkg = next((p for p in pkgs if p["id"] == "custom-business-views"), None)
    assert biz_views_pkg is not None
    assert any(v["id"] == app_v["id"] for v in biz_views_pkg["views"])

    # 4. Execute Application Landscape Catalog
    exec_app = client.post(f"/api/business/package-views/{app_v['id']}/execute?model_id={model_id}", json={})
    assert exec_app.status_code == 200
    data_app = exec_app.json()
    assert data_app["view_type"] == "table"
    assert data_app["total"] > 0
    for r in data_app["rows"]:
        assert r["type"] in ["ApplicationComponent", "ApplicationService", "ApplicationInterface"]

    # 5. Execute Model Health KPI Dashboard
    health_v = next(v for v in views if v["view_key"] == "archimate_model_health")
    exec_health = client.post(f"/api/business/package-views/{health_v['id']}/execute?model_id={model_id}", json={})
    assert exec_health.status_code == 200
    data_health = exec_health.json()
    assert data_health["view_type"] == "kpi_dashboard"
    assert "metrics" in data_health
    assert "charts" in data_health
    assert any(m["id"] == "total_elements" for m in data_health["metrics"])

    # 6. Execute Cross-Layer Matrix
    matrix_v = next(v for v in views if v["view_key"] == "archimate_cross_layer_matrix")
    exec_mat = client.post(f"/api/business/package-views/{matrix_v['id']}/execute?model_id={model_id}", json={})
    assert exec_mat.status_code == 200
    data_mat = exec_mat.json()
    assert data_mat["view_type"] == "matrix"
    assert "matrix_summary" in data_mat
    assert "grid" in data_mat["matrix_summary"]

    # 7. Execute Orphan Audit
    orphan_v = next(v for v in views if v["view_key"] == "archimate_orphan_audit")
    exec_orphan = client.post(f"/api/business/package-views/{orphan_v['id']}/execute?model_id={model_id}", json={})
    assert exec_orphan.status_code == 200
    data_orphan = exec_orphan.json()
    assert data_orphan["view_type"] == "table"

    # Reset status back to False
    client.patch(f"/api/business/package-views/custom/{app_v['id']}/status", json={"is_active": False})
    db.close()
