import pytest
import io
import xml.etree.ElementTree as ET
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.services.sample_data import seed_sample_model
from app.services.metamodel_service import seed_default_custom_attributes
from app.services.rbac_service import seed_default_rbac
from app.models.archimate import ModelWorkspace, ArchimateView, ArchimateElement
from app.services.drawio_service import export_view_to_drawio, export_model_to_drawio, parse_and_import_drawio

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


def test_export_single_view_to_drawio():
    db = TestingSessionLocal()
    view = db.query(ArchimateView).first()
    assert view is not None

    xml_res = export_view_to_drawio(view.id, db)
    assert "<mxfile" in xml_res
    assert "<diagram" in xml_res
    assert "<mxGraphModel" in xml_res
    assert "Core Banking" in xml_res

    # Parse XML to ensure it's valid
    root = ET.fromstring(xml_res)
    assert root.tag == "mxfile"
    db.close()


def test_export_model_to_drawio():
    db = TestingSessionLocal()
    workspace = db.query(ModelWorkspace).first()
    assert workspace is not None

    xml_res = export_model_to_drawio(workspace.id, db)
    assert "<mxfile" in xml_res
    assert "<diagram" in xml_res

    # Check via REST API endpoint
    response = client.get(f"/api/import/drawio/export?model_id={workspace.id}")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/xml")
    assert "<mxfile" in response.text
    db.close()


def test_export_single_view_endpoint():
    db = TestingSessionLocal()
    view = db.query(ArchimateView).first()
    assert view is not None

    response = client.get(f"/api/views/{view.id}/drawio")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/xml")
    assert "<mxfile" in response.text
    db.close()


def test_parse_and_import_drawio():
    db = TestingSessionLocal()
    workspace = db.query(ModelWorkspace).first()
    assert workspace is not None

    sample_drawio_xml = """<mxfile host="EasyEA Platform" version="21.0.0">
      <diagram id="diag-test-1" name="Payment Microservices View">
        <mxGraphModel>
          <root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <object id="c-app-1" label="New Mobile App" archimate_type="ApplicationComponent" layer="Application">
              <mxCell style="rounded=1;fillColor=#B5FFFF;" vertex="1" parent="1">
                <mxGeometry x="100" y="100" width="160" height="70" as="geometry"/>
              </mxCell>
            </object>
            <object id="c-app-2" label="New Backend Service" archimate_type="ApplicationService" layer="Application">
              <mxCell style="rounded=1;fillColor=#B5FFFF;" vertex="1" parent="1">
                <mxGeometry x="350" y="100" width="160" height="70" as="geometry"/>
              </mxCell>
            </object>
            <object id="rel-1" label="Calls" archimate_rel_type="ServingRelationship">
              <mxCell style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="1" source="c-app-1" target="c-app-2">
                <mxGeometry relative="1" as="geometry"/>
              </mxCell>
            </object>
          </root>
        </mxGraphModel>
      </diagram>
    </mxfile>"""

    result = parse_and_import_drawio(workspace.id, sample_drawio_xml, db)
    assert result["imported_views"] == 1
    assert result["created_elements"] == 2
    assert result["created_relations"] == 1

    # Verify elements in DB
    elem1 = db.query(ArchimateElement).filter(ArchimateElement.name == "New Mobile App").first()
    assert elem1 is not None
    assert elem1.type == "ApplicationComponent"

    # Verify view in DB
    view = db.query(ArchimateView).filter(ArchimateView.name == "Payment Microservices View").first()
    assert view is not None
    assert len(view.view_data["nodes"]) == 2
    assert len(view.view_data["connections"]) == 1

    # Test via REST Upload API
    file_bytes = sample_drawio_xml.encode("utf-8")
    response = client.post(
        f"/api/import/drawio?model_id={workspace.id}",
        files={"file": ("test_diagram.drawio", file_bytes, "application/xml")}
    )
    assert response.status_code == 200
    res_data = response.json()
    assert "imported_views" in res_data
    db.close()


def test_schema_drawio_palette_and_schema_diff():
    from app.services.drawio_service import (
        generate_drawio_archimate_library_xml,
        export_schema_to_drawio_xml,
        parse_drawio_file_to_canonical_model
    )
    from app.models.archimate import ArchiSchema
    from app.services.schema_diff_service import compute_schema_diff

    db = TestingSessionLocal()
    schema = db.query(ArchiSchema).first()
    assert schema is not None

    # Test Palette XML generation
    palette_xml = generate_drawio_archimate_library_xml()
    assert "<mxlibrary>" in palette_xml
    assert "</mxlibrary>" in palette_xml
    assert "BusinessActor" in palette_xml
    assert "ApplicationComponent" in palette_xml

    # Test Palette REST API
    res = client.get("/api/schemas/drawio/palette")
    assert res.status_code == 200
    assert "<mxlibrary>" in res.text

    # Test schema export to Draw.io XML
    drawio_xml = export_schema_to_drawio_xml(schema, db)
    assert "<mxfile" in drawio_xml
    assert "<diagram" in drawio_xml
    assert "<mxGraphModel" in drawio_xml

    # Test parse Draw.io XML to canonical model
    canonical = parse_drawio_file_to_canonical_model(drawio_xml)
    assert len(canonical.get("elements", [])) > 0
    assert len(canonical.get("views", [])) == 1

    # Test compute_schema_diff on the exported Draw.io file
    diff = compute_schema_diff(schema, canonical, db)
    assert "new_elements" in diff
    assert "modified_elements" in diff
    assert "removed_elements" in diff

    # Test Checkout with format drawio
    schema.format = "drawio"
    db.commit()

    download_res = client.get(f"/api/schemas/{schema.id}/download")
    assert download_res.status_code == 200
    assert 'filename="' in download_res.headers.get("content-disposition", "")
    assert ".drawio" in download_res.headers.get("content-disposition", "")
    db.close()
