import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.services.sample_data import seed_sample_model
from app.services.metamodel_service import seed_default_custom_attributes, activate_default_packages_for_workspace
from app.services.rbac_service import seed_default_rbac
from app.models.archimate import (
    User,
    ModelWorkspace,
    ArchimateElement,
    ArchimateRelationship,
    AttributePackage,
    WorkspaceAttributePackage
)
from app.services.auth_service import create_access_token
from app.services.resilience_service import ResilienceService

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


def test_pkg_resilience_seeded_correctly():
    db = TestingSessionLocal()
    pkg = db.query(AttributePackage).filter(AttributePackage.id == "pkg-resilience").first()
    assert pkg is not None, "pkg-resilience should be registered in database"
    assert pkg.code == "resilience"
    assert pkg.is_default_active is False
    assert pkg.is_system is True

    # Check items exist across all 3 layers
    items = pkg.items
    layers = {it.layer for it in items}
    assert "Business" in layers
    assert "Application" in layers
    assert "Technology" in layers

    # Check views exist
    views = pkg.views
    view_types = {v.view_type for v in views}
    assert "resilience_dashboard" in view_types
    assert "table" in view_types

    db.close()


def test_resilience_analysis_service_calculation():
    db = TestingSessionLocal()
    model = db.query(ModelWorkspace).first()
    assert model is not None

    # Setup a scenario:
    # 1. Mission-Critical Process (Target: SLA 99.99%, RTO 1.0h, RPO 0.25h)
    proc = ArchimateElement(
        id="elem-test-proc-critical",
        model_id=model.id,
        name="Real-Time Payment Settlement",
        type="BusinessProcess",
        layer="Business",
        properties={
            "resilience_criticality": "Tier-1 (Mission Critical)",
            "target_sla_availability": 99.99,
            "target_rto_hours": 1.0,
            "target_rpo_hours": 0.25,
            "dora_critical_function": True
        }
    )
    # 2. Supporting App with lower SLA (99.0%) and high RTO (3.0h)
    app_comp = ArchimateElement(
        id="elem-test-app-legacy",
        model_id=model.id,
        name="Legacy Core Settlement App",
        type="ApplicationComponent",
        layer="Application",
        properties={
            "app_sla_availability": 99.00,
            "app_rto_hours": 3.0,
            "app_rpo_hours": 2.0
        }
    )
    # 3. Supporting Tech Node with RTO (2.0h)
    node_comp = ArchimateElement(
        id="elem-test-node-db",
        model_id=model.id,
        name="On-Premises Oracle RAC",
        type="Node",
        layer="Technology",
        properties={
            "infra_sla_availability": 99.50,
            "infra_rto_hours": 2.0,
            "infra_rpo_hours": 4.0
        }
    )
    db.add_all([proc, app_comp, node_comp])
    db.flush()

    # Rel 1: App Serves Process
    rel_app_proc = ArchimateRelationship(
        id="rel-test-app-proc",
        model_id=model.id,
        type="ServingRelationship",
        source_id=app_comp.id,
        target_id=proc.id
    )
    # Rel 2: Node Serves App
    rel_node_app = ArchimateRelationship(
        id="rel-test-node-app",
        model_id=model.id,
        type="ServingRelationship",
        source_id=node_comp.id,
        target_id=app_comp.id
    )
    db.add_all([rel_app_proc, rel_node_app])
    db.commit()

    # Run analysis
    result = ResilienceService.analyze_resilience_mismatches(db, model.id)
    db.close()

    assert result["model_id"] == model.id
    metrics = result["metrics"]
    assert metrics["total_processes"] >= 1
    assert metrics["mismatched_processes"] >= 1

    # Find our specific test process in mismatches
    proc_match = next((m for m in result["mismatches"] if m["process_id"] == proc.id), None)
    assert proc_match is not None, "Critical process must be present in mismatches"
    assert proc_match["status"] == "CRITICAL_MISMATCH"
    assert proc_match["has_sla_mismatch"] is True
    assert proc_match["effective_sla"] <= 99.0  # App bottleneck is 99.0%
    assert proc_match["sla_gap"] >= 0.99  # 99.99 - 99.0 = 0.99
    assert proc_match["has_rto_breach"] is True
    assert proc_match["effective_rto_hours"] >= 5.0  # 3.0 app + 2.0 infra = 5.0h vs target 1.0h
    assert proc_match["rto_gap_hours"] >= 4.0
    assert proc_match["has_rpo_breach"] is True
    assert proc_match["bottleneck"] is not None
    assert proc_match["bottleneck"]["id"] == app_comp.id  # App with 99.0% SLA


def test_resilience_api_endpoints():
    db = TestingSessionLocal()
    model = db.query(ModelWorkspace).first()
    assert model is not None
    model_id = model.id
    db.close()

    # Test full analysis endpoint
    res = client.get(f"/api/resilience/analysis/{model_id}")
    assert res.status_code == 200
    data = res.json()
    assert "metrics" in data
    assert "mismatches" in data
    assert "compliance_rate" in data["metrics"]

    # Test summary KPI endpoint
    res_summary = client.get(f"/api/resilience/summary/{model_id}")
    assert res_summary.status_code == 200
    s_data = res_summary.json()
    assert "metrics" in s_data
