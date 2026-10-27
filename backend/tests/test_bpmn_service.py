import pytest
from app.services.bpmn_service import (
    generate_empty_bpmn_xml,
    parse_bpmn_file_to_canonical_model,
    export_schema_to_bpmn_xml
)
from app.models.archimate import ArchiSchema

SAMPLE_BPMN_XML = """<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:easyea="http://easyea.org/schema/1.0/bpmn"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant_1" name="Divisione Crediti" processRef="Process_1" />
  </bpmn:collaboration>
  <bpmn:process id="Process_1" name="Valutazione Richiesta Prestito" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_1" name="Gestore Pratica">
        <bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_1</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_2" name="Ufficio Rischi">
        <bpmn:flowNodeRef>ServiceTask_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>EndEvent_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    
    <bpmn:startEvent id="StartEvent_1" name="Richiesta Ricevuta">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    
    <bpmn:userTask id="Task_1" name="Verifica Documentale">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
    
    <bpmn:exclusiveGateway id="Gateway_1" name="Documenti OK?">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    
    <bpmn:serviceTask id="ServiceTask_1" name="Scoring Automatico">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:serviceTask>
    
    <bpmn:endEvent id="EndEvent_1" name="Pratica Approvata">
      <bpmn:incoming>Flow_4</bpmn:incoming>
    </bpmn:endEvent>
    
    <bpmn:dataObjectReference id="DataObject_1" name="Dossier Reddituale" />
    
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Gateway_1" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Gateway_1" targetRef="ServiceTask_1" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="ServiceTask_1" targetRef="EndEvent_1" />
  </bpmn:process>
  
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1">
        <dc:Bounds x="100" y="80" width="800" height="300" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_1_di" bpmnElement="Lane_1">
        <dc:Bounds x="130" y="80" width="770" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_2_di" bpmnElement="Lane_2">
        <dc:Bounds x="130" y="230" width="770" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="130" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="260" y="110" width="120" height="70" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1">
        <dc:Bounds x="430" y="125" width="40" height="40" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ServiceTask_1_di" bpmnElement="ServiceTask_1">
        <dc:Bounds x="520" y="270" width="120" height="70" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="700" y="285" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
"""

def test_generate_empty_bpmn_xml():
    xml = generate_empty_bpmn_xml("Nuovo Processo Credito")
    assert "<bpmn:definitions" in xml
    assert "Nuovo Processo Credito" in xml
    assert "<bpmndi:BPMNDiagram" in xml

def test_parse_bpmn_file_to_canonical_model():
    parsed = parse_bpmn_file_to_canonical_model(SAMPLE_BPMN_XML)
    
    assert "elements" in parsed
    assert "relationships" in parsed
    assert "views" in parsed
    
    elements = parsed["elements"]
    elem_types = {e["name"]: e["type"] for e in elements}
    
    # Assert ArchiMate mappings
    assert elem_types.get("Divisione Crediti") == "BusinessActor"
    assert elem_types.get("Gestore Pratica") == "BusinessRole"
    assert elem_types.get("Ufficio Rischi") == "BusinessRole"
    assert elem_types.get("Verifica Documentale") == "BusinessProcess"
    assert elem_types.get("Scoring Automatico") == "ApplicationService"
    assert elem_types.get("Richiesta Ricevuta") == "BusinessEvent"
    assert elem_types.get("Pratica Approvata") == "BusinessEvent"
    assert elem_types.get("Dossier Reddituale") == "BusinessObject"
    assert elem_types.get("Documenti OK?") == "Junction"

    # Assert Relationships
    relationships = parsed["relationships"]
    rel_types = [r["type"] for r in relationships]
    assert "TriggeringRelationship" in rel_types
    assert "AssignmentRelationship" in rel_types

    # Assert Views and Coordinates
    views = parsed["views"]
    assert len(views) == 1
    nodes = views[0]["view_data"]["nodes"]
    assert len(nodes) > 0
    # Coordinates check
    task_node = next(n for n in nodes if n["element_id"] == "Task_1")
    assert task_node["x"] == 260
    assert task_node["y"] == 110

def test_export_schema_to_bpmn():
    schema = ArchiSchema(id="s1", name="Test BPMN Schema", raw_xml=SAMPLE_BPMN_XML)
    exported = export_schema_to_bpmn_xml(schema, None)
    assert "Valutazione Richiesta Prestito" in exported


def test_bpmn_checkin_confirm_end_to_end():
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.database import SessionLocal, Base, engine
    from app.models.archimate import ModelWorkspace, User, ArchiSchema
    from app.services.rbac_service import seed_default_rbac
    from app.services.sample_data import seed_sample_model

    saved_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    Base.metadata.create_all(bind=engine)
    client = TestClient(app)
    db = SessionLocal()
    try:
        if not db.query(ModelWorkspace).first():
            seed_sample_model(db)
        seed_default_rbac(db)

        ws = db.query(ModelWorkspace).first()
        user = db.query(User).filter(User.username == "admin").first()
        assert ws is not None
        assert user is not None

        # 1. Create a BPMN Schema
        schema_id = "test-bpmn-schema-01"
        existing = db.query(ArchiSchema).filter(ArchiSchema.id == schema_id).first()
        if existing:
            db.delete(existing)
            db.commit()

        new_s = ArchiSchema(
            id=schema_id,
            model_id=ws.id,
            name="Valutazione Richiesta Prestito",
            format="bpmn",
            status="checked_out",
            locked_by_user_id=user.id,
            locked_by_username=user.username,
            raw_xml=SAMPLE_BPMN_XML
        )
        db.add(new_s)
        db.commit()

        # 2. Login to get token
        login_res = client.post("/api/auth/login", json={"username": "admin", "password": "AdminEasyEA2026!"})
        assert login_res.status_code == 200
        token = login_res.json()["token"]

        # 3. Checkin Confirm with modified start event name in raw_xml
        modified_xml = SAMPLE_BPMN_XML.replace('name="Richiesta Ricevuta"', 'name="Nuova Domanda Ricevuta"')
        confirm_res = client.post(
            f"/api/schemas/{schema_id}/checkin-confirm",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "commit_message": "Renamed start event to Nuova Domanda Ricevuta",
                "raw_xml": modified_xml
            }
        )
        assert confirm_res.status_code == 200, f"Error: {confirm_res.text}"
        data = confirm_res.json()
        assert data["success"] is True
        assert data["schema"]["status"] == "available"
        assert data["schema"]["current_version"] == "v1.1"

        # Check that the element was updated/created in DB catalog
        from app.models.archimate import ArchimateElement
        el = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == ws.id,
            ArchimateElement.name == "Nuova Domanda Ricevuta"
        ).first()
        assert el is not None
        assert el.type == "BusinessEvent"

        # 4. Test Catalog Search Endpoint (/api/elements/search)
        search_res = client.get("/api/elements/search?layer=Business", headers={"Authorization": f"Bearer {token}"})
        assert search_res.status_code == 200
        business_elements = search_res.json()
        assert len(business_elements) > 0
        assert any(e["layer"] == "Business" for e in business_elements)

        # Search by query term
        term_res = client.get("/api/elements/search?query=Domanda", headers={"Authorization": f"Bearer {token}"})
        assert term_res.status_code == 200
        found = term_res.json()
        assert len(found) >= 1
        assert any(e["name"] == "Nuova Domanda Ricevuta" for e in found)
    finally:
        db.close()
        app.dependency_overrides = saved_overrides


