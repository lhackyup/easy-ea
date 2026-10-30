import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.parsers.archi_parser import ArchiModelParser
from app.models.archimate import ModelWorkspace, ArchimateElement, ArchimateRelationship, ArchimateView, ImportHistory, User, UserRoleAssignment
from app.services.auth_service import create_access_token

TEST_DATABASE_URL = "sqlite:///./test_open_exchange.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

client = TestClient(app)

SAMPLE_OPEN_EXCHANGE_XML = """<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       identifier="id-open-exchange-test-01">
    <name xml:lang="en">Open Exchange Insurance Model</name>
    <documentation xml:lang="en">Standard ArchiMate model in Open Exchange Format</documentation>
    <propertyDefinitions>
        <propertyDefinition identifier="prop-vendor" type="string">
            <name xml:lang="en">vendor</name>
        </propertyDefinition>
        <propertyDefinition identifier="prop-cost" type="number">
            <name xml:lang="en">annual_cost</name>
        </propertyDefinition>
    </propertyDefinitions>
    <elements>
        <element identifier="elem-crm-01" xsi:type="ApplicationComponent">
            <name xml:lang="en">CRM Portal</name>
            <documentation xml:lang="en">Customer relationship portal</documentation>
            <properties>
                <property propertyDefinitionRef="prop-vendor">
                    <value xml:lang="en">Salesforce</value>
                </property>
                <property propertyDefinitionRef="prop-cost">
                    <value>75000</value>
                </property>
            </properties>
        </element>
        <element identifier="elem-proc-01" xsi:type="BusinessProcess">
            <name xml:lang="en">Claim Handling Process</name>
            <documentation xml:lang="en">Handles insurance claims</documentation>
        </element>
    </elements>
    <relationships>
        <relationship identifier="rel-crm-proc-01" source="elem-crm-01" target="elem-proc-01" xsi:type="Serving">
            <name xml:lang="en">Supports Claims</name>
            <documentation xml:lang="en">CRM serves Claim Handling</documentation>
        </relationship>
    </relationships>
    <views>
        <diagrams>
            <view identifier="view-claims-01" xsi:type="Diagram" viewpoint="Application">
                <name xml:lang="en">Claims Application Overview</name>
                <node identifier="node-1" elementRef="elem-crm-01" x="50" y="50" w="140" h="60"/>
                <node identifier="node-2" elementRef="elem-proc-01" x="250" y="50" w="140" h="60"/>
                <connection identifier="conn-1" relationshipRef="rel-crm-proc-01" source="node-1" target="node-2"/>
            </view>
        </diagrams>
    </views>
</model>"""


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    # Create test user & workspace
    admin_user = db.query(User).filter(User.id == "usr-oe-admin").first()
    if not admin_user:
        admin_user = User(
            id="usr-oe-admin",
            username="oe_admin",
            email="oe_admin@easyea.com",
            full_name="OpenExchange Admin",
            auth_provider="local",
            is_active=True
        )
        db.add(admin_user)
        db.flush()
        role = UserRoleAssignment(
            id="role-oe-admin",
            user_id="usr-oe-admin",
            role="admin",
            model_id=None
        )
        db.add(role)

    ws = db.query(ModelWorkspace).filter(ModelWorkspace.id == "ws-oe-test").first()
    if not ws:
        ws = ModelWorkspace(
            id="ws-oe-test",
            code="OEXC",
            name="Open Exchange Test Library",
            modeling_tool="archi"
        )
        db.add(ws)

    db.commit()
    db.close()
    yield
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)


def test_archi_model_parser_open_exchange():
    parser = ArchiModelParser(SAMPLE_OPEN_EXCHANGE_XML)
    res = parser.parse()
    assert res["source_format"] == "open_exchange"
    assert res["name"] == "Open Exchange Insurance Model"
    assert "Standard ArchiMate model" in res["description"]

    # Elements
    assert len(res["elements"]) == 2
    crm = next(e for e in res["elements"] if e["id"] == "elem-crm-01")
    assert crm["name"] == "CRM Portal"
    assert crm["type"] == "ApplicationComponent"
    assert crm["layer"] == "Application"
    assert crm["properties"]["vendor"] == "Salesforce"
    assert crm["properties"]["annual_cost"] == "75000"

    proc = next(e for e in res["elements"] if e["id"] == "elem-proc-01")
    assert proc["name"] == "Claim Handling Process"
    assert proc["type"] == "BusinessProcess"
    assert proc["layer"] == "Business"

    # Relationships
    assert len(res["relationships"]) == 1
    rel = res["relationships"][0]
    assert rel["id"] == "rel-crm-proc-01"
    assert rel["type"] == "ServingRelationship"
    assert rel["source_id"] == "elem-crm-01"
    assert rel["target_id"] == "elem-proc-01"

    # Views
    assert len(res["views"]) == 1
    v = res["views"][0]
    assert v["name"] == "Claims Application Overview"
    assert len(v["view_data"]["nodes"]) == 2
    assert v["view_data"]["nodes"][0]["width"] == 140
    assert len(v["view_data"]["connections"]) == 1


def test_data_import_open_exchange_dry_run_and_commit():
    db = TestingSessionLocal()
    admin_user = db.query(User).filter(User.id == "usr-oe-admin").first()
    token = create_access_token(admin_user)
    db.close()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Dry run
    files = {"file": ("insurance_model.xml", io.BytesIO(SAMPLE_OPEN_EXCHANGE_XML.encode("utf-8")), "application/xml")}
    res_dry = client.post(
        "/api/import/upload",
        data={"model_id": "ws-oe-test", "dry_run": "true", "update_existing": "true"},
        files=files,
        headers=headers
    )
    assert res_dry.status_code == 200, res_dry.text
    data_dry = res_dry.json()
    assert data_dry["dry_run"] is True
    assert data_dry["elements_created"] == 2
    assert data_dry["relationships_created"] == 1
    assert data_dry["views_count"] == 1
    assert data_dry["errors_count"] == 0

    # 2. Actual commit
    files_commit = {"file": ("insurance_model.xml", io.BytesIO(SAMPLE_OPEN_EXCHANGE_XML.encode("utf-8")), "application/xml")}
    res_commit = client.post(
        "/api/import/upload",
        data={"model_id": "ws-oe-test", "dry_run": "false", "update_existing": "true"},
        files=files_commit,
        headers=headers
    )
    assert res_commit.status_code == 200, res_commit.text
    data_commit = res_commit.json()
    assert data_commit["success"] is True
    assert data_commit["elements_created"] == 2
    assert data_commit["relationships_created"] == 1
    assert data_commit["views_imported"] == 1

    # Verify DB persistence
    db = TestingSessionLocal()
    elems = db.query(ArchimateElement).filter(ArchimateElement.model_id == "ws-oe-test").all()
    assert len(elems) == 2

    rels = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == "ws-oe-test").all()
    assert len(rels) == 1
    assert rels[0].type == "ServingRelationship"

    views = db.query(ArchimateView).filter(ArchimateView.model_id == "ws-oe-test").all()
    assert len(views) == 1
    assert views[0].name == "Claims Application Overview"

    history = db.query(ImportHistory).filter(ImportHistory.model_id == "ws-oe-test").all()
    assert len(history) == 1
    assert history[0].file_format == "xml"
    db.close()
