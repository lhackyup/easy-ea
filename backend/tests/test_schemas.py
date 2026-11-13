import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.models.archimate import ModelWorkspace, User, SchemaFolder, ArchiSchema, SchemaVersionHistory, ArchimateElement
from app.services.sample_data import seed_sample_model
from app.services.metamodel_service import seed_default_custom_attributes
from app.services.rbac_service import seed_default_rbac
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
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def auth_headers():
    db = TestingSessionLocal()
    user = db.query(User).filter(User.username == "admin").first()
    if not user:
        user = db.query(User).first()
    token = create_access_token(user)
    db.close()
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def test_workspace():
    db = TestingSessionLocal()
    ws = db.query(ModelWorkspace).first()
    db.close()
    return ws


def test_schema_folders_crud(test_workspace, auth_headers):
    # 1. Create root folder
    res = client.post(
        f"/api/schemas/{test_workspace.id}/folders",
        json={"name": "Core Banking Domain", "parent_id": None},
        headers=auth_headers
    )
    assert res.status_code == 200, res.text
    folder_data = res.json()
    root_folder_id = folder_data["id"]
    assert folder_data["name"] == "Core Banking Domain"

    # 2. Create subfolder
    res_sub = client.post(
        f"/api/schemas/{test_workspace.id}/folders",
        json={"name": "Payments & Transfers", "parent_id": root_folder_id},
        headers=auth_headers
    )
    assert res_sub.status_code == 200
    subfolder_data = res_sub.json()
    sub_folder_id = subfolder_data["id"]
    assert subfolder_data["parent_id"] == root_folder_id

    # 3. List folders
    res_list = client.get(f"/api/schemas/{test_workspace.id}/folders")
    assert res_list.status_code == 200
    folders = res_list.json()
    assert any(f["id"] == root_folder_id for f in folders)
    assert any(f["id"] == sub_folder_id for f in folders)

    # 4. Update folder
    res_update = client.put(
        f"/api/schemas/folders/{sub_folder_id}",
        json={"name": "Payments & Cards"},
        headers=auth_headers
    )
    assert res_update.status_code == 200
    assert res_update.json()["name"] == "Payments & Cards"

    # Clean up (delete folder)
    res_del = client.delete(f"/api/schemas/folders/{sub_folder_id}", headers=auth_headers)
    assert res_del.status_code == 200


def test_schema_lifecycle_and_checkout(test_workspace, auth_headers):
    # 1. Create schema
    res_create = client.post(
        f"/api/schemas/{test_workspace.id}/create",
        json={
            "name": "Payment Gateway Flow",
            "viewpoint": "Application",
            "documentation": "Schema di test per pagamenti",
            "view_data": {
                "nodes": [
                    {"id": "node-1", "element_id": "elem-crm-1", "x": 100, "y": 100, "width": 140, "height": 60}
                ],
                "connections": []
            }
        },
        headers=auth_headers
    )
    assert res_create.status_code == 200
    schema = res_create.json()
    schema_id = schema["id"]
    assert schema["status"] == "available"
    assert schema["current_version"] == "v1.0"

    # 2. Checkout schema
    res_checkout = client.post(f"/api/schemas/{schema_id}/checkout", headers=auth_headers)
    assert res_checkout.status_code == 200
    checkout_data = res_checkout.json()
    assert checkout_data["schema"]["status"] == "checked_out"
    assert "xml_content" in checkout_data
    assert "<archimate:model" in checkout_data["xml_content"]

    # 3. Discard checkout
    res_discard = client.post(f"/api/schemas/{schema_id}/discard-checkout", headers=auth_headers)
    assert res_discard.status_code == 200
    assert res_discard.json()["schema"]["status"] == "available"

    # 4. Check out again and test forced unlock
    client.post(f"/api/schemas/{schema_id}/checkout", headers=auth_headers)
    res_unlock = client.post(f"/api/schemas/{schema_id}/forced-unlock", headers=auth_headers)
    assert res_unlock.status_code == 200
    assert res_unlock.json()["schema"]["status"] == "available"

    # 5. Checkin diff with sample XML
    sample_xml = """<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="Payment Gateway Flow" id="model-1">
  <folder name="Application" id="f-app" type="application">
    <element xsi:type="archimate:ApplicationComponent" id="el-new-1" name="Payment Processor Engine">
      <documentation>High throughput engine</documentation>
    </element>
  </folder>
  <folder name="Views" id="f-views" type="diagrams">
    <element xsi:type="archimate:ArchimateDiagramModel" id="diag-1" name="Payment Gateway Flow">
      <child xsi:type="archimate:DiagramObject" id="n-1" archimateElement="el-new-1">
        <bounds x="200" y="150" width="160" height="70"/>
      </child>
    </element>
  </folder>
</archimate:model>"""

    # Checkin confirm
    res_confirm = client.post(
        f"/api/schemas/{schema_id}/checkin-confirm",
        json={
            "file_content": sample_xml,
            "commit_message": "Aggiunto Payment Processor Engine",
            "new_elements": [
                {
                    "xml_id": "el-new-1",
                    "name": "Payment Processor Engine",
                    "type": "ApplicationComponent",
                    "layer": "Application",
                    "documentation": "High throughput engine"
                }
            ]
        },
        headers=auth_headers
    )
    assert res_confirm.status_code == 200
    updated_schema = res_confirm.json()["schema"]
    assert updated_schema["status"] == "available"
    assert updated_schema["current_version"] == "v1.1"

    # 6. Check version history
    res_versions = client.get(f"/api/schemas/{schema_id}/versions")
    assert res_versions.status_code == 200
    versions = res_versions.json()
    assert len(versions) >= 2
    assert versions[0]["version_label"] == "v1.1"

    # 7. Rollback to v1.0
    v1_id = versions[-1]["id"]
    res_rollback = client.post(f"/api/schemas/{schema_id}/versions/{v1_id}/rollback", headers=auth_headers)
    assert res_rollback.status_code == 200
    assert res_rollback.json()["schema"]["current_version"] == "v1.2"

    # Clean up
    client.delete(f"/api/schemas/{schema_id}", headers=auth_headers)


def test_library_stencil_style_configuration(auth_headers):
    """
    Verifies that an administrator can configure stencil_style at library (workspace) level,
    switching between 'standard' (default) and 'modern'.
    """
    # 1. Create a library with default stencil style
    res_create = client.post(
        "/api/models",
        json={
            "name": "Cloud Architecture Library",
            "modeling_tool": "drawio",
            "stencil_style": "standard"
        },
        headers=auth_headers
    )
    assert res_create.status_code == 200
    model = res_create.json()
    model_id = model["id"]
    assert model["stencil_style"] == "standard"

    # 2. Verify in detail endpoint
    res_get = client.get(f"/api/models/{model_id}", headers=auth_headers)
    assert res_get.status_code == 200
    assert res_get.json()["stencil_style"] == "standard"

    # 3. Update library stencil style to 'modern'
    res_update = client.put(
        f"/api/models/{model_id}",
        json={"stencil_style": "modern"},
        headers=auth_headers
    )
    assert res_update.status_code == 200

    # 4. Verify updated value in detail endpoint
    res_get2 = client.get(f"/api/models/{model_id}", headers=auth_headers)
    assert res_get2.status_code == 200
    assert res_get2.json()["stencil_style"] == "modern"

    # Clean up
    client.delete(f"/api/models/{model_id}", headers=auth_headers)


def test_schema_drawio_cache_invalidation_and_xml_endpoint(test_workspace, auth_headers):
    """
    Validates Draw.io Web cache invalidation headers, version cookies,
    and the dedicated fresh XML endpoint.
    """
    # 1. Create a draw.io format schema
    res = client.post(
        f"/api/schemas/{test_workspace.id}/create",
        json={
            "name": "Integration Architecture View",
            "format": "drawio",
            "viewpoint": "Application Cooperation",
            "documentation": "Draw.io Web schema with anti-cache controls"
        },
        headers=auth_headers
    )
    assert res.status_code == 200
    schema = res.json()
    schema_id = schema["id"]
    assert schema["format"] == "drawio"

    # 2. Test Checkout endpoint anti-cache headers & cookies
    res_co = client.post(f"/api/schemas/{schema_id}/checkout", headers=auth_headers)
    assert res_co.status_code == 200
    assert "no-cache" in res_co.headers.get("Cache-Control", "")
    assert "no-store" in res_co.headers.get("Cache-Control", "")
    assert res_co.headers.get("Pragma") == "no-cache"
    assert "ETag" in res_co.headers
    assert f"easyea_schema_ver_{schema_id}" in res_co.cookies
    assert "easyea_cache_bust" in res_co.cookies

    # 3. Test raw XML endpoint GET /{schema_id}/xml
    res_xml = client.get(f"/api/schemas/{schema_id}/xml", headers=auth_headers)
    assert res_xml.status_code == 200
    assert "no-cache" in res_xml.headers.get("Cache-Control", "")
    assert "no-store" in res_xml.headers.get("Cache-Control", "")
    assert len(res_xml.text) > 0
    assert ("<mxfile" in res_xml.text or "<mxGraphModel" in res_xml.text)

    # 4. Test download endpoint anti-cache headers
    res_dl = client.get(f"/api/schemas/{schema_id}/download", headers=auth_headers)
    assert res_dl.status_code == 200
    assert "no-cache" in res_dl.headers.get("Cache-Control", "")
    assert "no-store" in res_dl.headers.get("Cache-Control", "")

    # 5. Discard checkout and verify headers
    res_discard = client.post(f"/api/schemas/{schema_id}/discard-checkout", headers=auth_headers)
    assert res_discard.status_code == 200
    assert "no-cache" in res_discard.headers.get("Cache-Control", "")

    # Clean up
    client.delete(f"/api/schemas/{schema_id}", headers=auth_headers)


def test_library_stencil_style_configuration(auth_headers):
    """
    Verifies that an administrator can configure stencil_style at library (workspace) level,
    switching between 'standard' (default) and 'modern'.
    """
    # 1. Create a library with default stencil style
    res_create = client.post(
        "/api/models",
        json={
            "name": "Cloud Architecture Library",
            "modeling_tool": "drawio",
            "stencil_style": "standard"
        },
        headers=auth_headers
    )
    assert res_create.status_code == 200
    model = res_create.json()
    model_id = model["id"]
    assert model["stencil_style"] == "standard"

    # 2. Verify in detail endpoint
    res_get = client.get(f"/api/models/{model_id}", headers=auth_headers)
    assert res_get.status_code == 200
    assert res_get.json()["stencil_style"] == "standard"

    # 3. Update library stencil style to 'modern'
    res_update = client.put(
        f"/api/models/{model_id}",
        json={"stencil_style": "modern"},
        headers=auth_headers
    )
    assert res_update.status_code == 200

    # 4. Verify updated value in detail endpoint
    res_get2 = client.get(f"/api/models/{model_id}", headers=auth_headers)
    assert res_get2.status_code == 200
    assert res_get2.json()["stencil_style"] == "modern"

    # Clean up
    client.delete(f"/api/models/{model_id}", headers=auth_headers)

