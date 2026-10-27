import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.main import app
from app.core.database import Base, get_db
from app.models.archimate import (
    ElementStereotype,
    StereotypeAttributeLink,
    ModelWorkspace,
    ArchimateElement,
    User
)
from app.services.metamodel_service import seed_default_custom_attributes
from app.services.sample_data import seed_sample_model
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
    Base.metadata.drop_all(bind=engine)


def test_stereotypes_lifecycle_and_validation():
    db: Session = TestingSessionLocal()
    try:
        model = db.query(ModelWorkspace).first()
        model_id = model.id

        # 1. Check default stereotypes were seeded
        st_micro = db.query(ElementStereotype).filter(ElementStereotype.id == "stereo-microservice").first()
        assert st_micro is not None
        assert st_micro.base_type == "ApplicationComponent"
        assert st_micro.label == "«Microservice»"
        assert len(st_micro.attribute_links) >= 2

        # 2. List stereotypes via API
        resp = client.get("/api/metamodel/stereotypes?base_type=ApplicationComponent")
        assert resp.status_code == 200
        items = resp.json()
        assert any(s["id"] == "stereo-microservice" for s in items)
        assert any(s["id"] == "stereo-saas" for s in items)

        # 3. Create custom stereotype with linked required attribute
        create_resp = client.post("/api/metamodel/stereotypes", json={
            "name": "Event Driven Service",
            "base_type": "ApplicationComponent",
            "description": "Servizio asincrono guidato da eventi Kafka/RabbitMQ",
            "icon_color": "purple",
            "attribute_links": [
                {
                    "attribute_name": "event_broker_topic",
                    "is_required": True,
                    "default_value": "events.default",
                    "section_override": "Messaging Config",
                    "sort_order": 1
                }
            ]
        })
        assert create_resp.status_code == 200
        new_st = create_resp.json()
        assert new_st["name"] == "Event Driven Service"
        assert new_st["label"] == "«Event Driven Service»"
        assert len(new_st["attribute_links"]) == 1

        # 4. Attempt creating element with stereotype but missing required attribute -> 400
        bad_elem_resp = client.post(f"/api/elements?model_id={model_id}", json={
            "name": "OrderEventsConsumer",
            "type": "ApplicationComponent",
            "stereotype_id": new_st["id"],
            "properties": {}
        })
        assert bad_elem_resp.status_code == 400
        assert "event_broker_topic" in bad_elem_resp.json()["detail"]

        # 5. Create element with required attribute satisfied -> 200
        good_elem_resp = client.post(f"/api/elements?model_id={model_id}", json={
            "name": "OrderEventsConsumer",
            "type": "ApplicationComponent",
            "stereotype_id": new_st["id"],
            "properties": {
                "event_broker_topic": "orders.v1.created"
            }
        })
        assert good_elem_resp.status_code == 200
        created_elem = good_elem_resp.json()
        elem_id = created_elem["id"]
        assert created_elem["stereotype_id"] == new_st["id"]
        assert created_elem["stereotype"]["name"] == "Event Driven Service"

        # 6. Concept type mismatch check (e.g. assigning ApplicationComponent stereotype to BusinessProcess) -> 400
        mismatch_resp = client.post(f"/api/elements?model_id={model_id}", json={
            "name": "Invalid Process",
            "type": "BusinessProcess",
            "stereotype_id": new_st["id"],
            "properties": {
                "event_broker_topic": "topic"
            }
        })
        assert mismatch_resp.status_code == 400

        # 7. Update element stereotype (switch to Microservice, required: apm_hosting_type & apm_technical_fit)
        # Attempt update missing microservice required attributes -> 400
        up_fail = client.put(f"/api/elements/{elem_id}", json={
            "stereotype_id": "stereo-microservice",
            "properties": {"event_broker_topic": "orders.v1.created"}
        })
        assert up_fail.status_code == 400

        # Satisfy microservice required attributes -> 200
        up_ok = client.put(f"/api/elements/{elem_id}", json={
            "stereotype_id": "stereo-microservice",
            "properties": {
                "apm_hosting_type": "Public Cloud",
                "apm_technical_fit": "4 - Perfect (Cloud Native)"
            }
        })
        assert up_ok.status_code == 200
        assert up_ok.json()["stereotype"]["name"] == "Microservice"

        # 8. Filter elements by stereotype_id
        list_resp = client.get(f"/api/elements?model_id={model_id}&stereotype_id=stereo-microservice")
        assert list_resp.status_code == 200
        filtered = list_resp.json()
        assert len(filtered) >= 1
        assert any(e["id"] == elem_id for e in filtered)

        # 9. Clear stereotype
        clear_resp = client.put(f"/api/elements/{elem_id}", json={
            "stereotype_id": ""
        })
        assert clear_resp.status_code == 200
        assert clear_resp.json()["stereotype_id"] is None
        assert clear_resp.json()["stereotype"] is None
    finally:
        db.close()
