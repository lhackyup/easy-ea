import pytest
import xml.etree.ElementTree as ET
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.services.sample_data import seed_sample_model
from app.services.metamodel_service import seed_default_custom_attributes
from app.services.rbac_service import seed_default_rbac
from app.models.archimate import (
    User,
    ModelWorkspace,
    ArchimateElement,
    ArchimateRelationship,
    ArchimateView
)
from app.services.auth_service import create_access_token
from app.services.exchange_export_service import export_model_to_exchange_xml, OPEN_EXCHANGE_NS
from app.services.archimate_native_export_service import export_model_to_archimate_xml
from app.parsers.archi_parser import ArchiModelParser

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

    seed_sample_model(db)
    seed_default_custom_attributes(db)
    seed_default_rbac(db)

    admin_user = db.query(User).filter(User.username == "admin").first() or db.query(User).first()
    if admin_user:
        token = create_access_token(admin_user)
        client.headers.update({"Authorization": f"Bearer {token}"})
    db.close()
    yield


def test_export_model_to_exchange_xml_service():
    db = TestingSessionLocal()
    model = db.query(ModelWorkspace).first()
    assert model is not None, "Model workspace should be present"

    xml_str, filename = export_model_to_exchange_xml(model.id, db)
    db.close()

    assert xml_str is not None
    assert filename.endswith(".xml")
    assert OPEN_EXCHANGE_NS in xml_str
    assert "<model" in xml_str
    assert "<elements>" in xml_str
    assert "<relationships>" in xml_str

    root = ET.fromstring(xml_str)
    # Check root tag ends with 'model'
    assert root.tag.endswith("model")
    # Check elements exist
    elements_tag = root.find(f"{{{OPEN_EXCHANGE_NS}}}elements")
    assert elements_tag is not None
    assert len(elements_tag) > 0


def test_export_model_exchange_xml_endpoint():
    db = TestingSessionLocal()
    model = db.query(ModelWorkspace).first()
    assert model is not None
    model_id = model.id
    db.close()

    response = client.get(f"/api/models/{model_id}/export/exchange-xml")
    assert response.status_code == 200
    assert "application/xml" in response.headers.get("content-type", "")
    assert "attachment;" in response.headers.get("content-disposition", "")
    assert "_exchange.xml" in response.headers.get("content-disposition", "")
    
    xml_content = response.content.decode("utf-8")
    assert OPEN_EXCHANGE_NS in xml_content
    assert "<elements>" in xml_content


def test_export_view_exchange_xml_endpoint():
    db = TestingSessionLocal()
    view = db.query(ArchimateView).first()
    assert view is not None, "At least one view should be present"
    view_id = view.id
    db.close()

    response = client.get(f"/api/views/{view_id}/export/exchange-xml")
    assert response.status_code == 200
    assert "application/xml" in response.headers.get("content-type", "")
    assert "attachment;" in response.headers.get("content-disposition", "")
    
    xml_content = response.content.decode("utf-8")
    assert OPEN_EXCHANGE_NS in xml_content
    root = ET.fromstring(xml_content)
    diagrams_tag = root.find(f".//{{{OPEN_EXCHANGE_NS}}}diagrams")
    assert diagrams_tag is not None
    assert len(diagrams_tag) == 1


def test_roundtrip_import_parsed_from_export():
    db = TestingSessionLocal()
    model = db.query(ModelWorkspace).first()
    elements_count = db.query(ArchimateElement).filter(ArchimateElement.model_id == model.id).count()
    rel_count = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == model.id).count()
    view_count = db.query(ArchimateView).filter(ArchimateView.model_id == model.id).count()

    xml_str, filename = export_model_to_exchange_xml(model.id, db)
    db.close()

    # Pass into ArchiModelParser
    parser = ArchiModelParser(xml_str.encode("utf-8"))
    assert parser.format_type == "open_exchange"

    parsed_result = parser.parse()
    assert parsed_result["source_format"] == "open_exchange"
    assert len(parsed_result["elements"]) == elements_count
    assert len(parsed_result["relationships"]) == rel_count
    assert len(parsed_result["views"]) == view_count


def test_export_model_to_archimate_native_service_and_roundtrip():
    db = TestingSessionLocal()
    model = db.query(ModelWorkspace).first()
    assert model is not None
    elements_count = db.query(ArchimateElement).filter(ArchimateElement.model_id == model.id).count()
    rel_count = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == model.id).count()
    view_count = db.query(ArchimateView).filter(ArchimateView.model_id == model.id).count()

    xml_str, filename = export_model_to_archimate_xml(model.id, db)
    db.close()

    assert xml_str is not None
    assert filename.endswith(".archimate")
    assert "http://www.archimatetool.com/archimate" in xml_str
    assert "<archimate:model" in xml_str
    assert '<folder name="Business"' in xml_str
    assert '<folder name="Relations"' in xml_str
    assert '<folder name="Views"' in xml_str

    # Pass into ArchiModelParser to verify round-trip
    parser = ArchiModelParser(xml_str.encode("utf-8"))
    assert parser.format_type == "archi_native"

    parsed_result = parser.parse()
    assert parsed_result["source_format"] == "archi_native"
    assert len(parsed_result["elements"]) == elements_count
    assert len(parsed_result["relationships"]) == rel_count
    assert len(parsed_result["views"]) == view_count


def test_export_model_archimate_native_endpoint():
    db = TestingSessionLocal()
    model = db.query(ModelWorkspace).first()
    assert model is not None
    model_id = model.id
    db.close()

    # 1. The old JSON endpoint must no longer exist (404 Not Found)
    res_old = client.get(f"/api/models/{model_id}/export")
    assert res_old.status_code == 404

    # 2. The new .archimate endpoint must return status 200 and .archimate attachment
    response = client.get(f"/api/models/{model_id}/export/archimate")
    assert response.status_code == 200
    assert "application/xml" in response.headers.get("content-type", "")
    assert ".archimate" in response.headers.get("content-disposition", "")
    
    xml_content = response.content.decode("utf-8")
    assert "archimatetool.com/archimate" in xml_content
    assert "<archimate:model" in xml_content


def test_export_view_archimate_native_endpoint():
    db = TestingSessionLocal()
    view = db.query(ArchimateView).first()
    assert view is not None
    view_id = view.id
    db.close()

    response = client.get(f"/api/views/{view_id}/export/archimate")
    assert response.status_code == 200
    assert "application/xml" in response.headers.get("content-type", "")
    assert ".archimate" in response.headers.get("content-disposition", "")
    
    xml_content = response.content.decode("utf-8")
    assert "archimatetool.com/archimate" in xml_content

