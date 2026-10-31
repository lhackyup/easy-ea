import pytest
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
    AttributePackage,
    ElementStereotype
)
from app.services.auth_service import create_access_token
from app.services.gap_analysis_service import GapAnalysisService

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


def test_pkg_gap_analysis_seeding():
    db = TestingSessionLocal()
    pkg = db.query(AttributePackage).filter(AttributePackage.id == "pkg-gap-analysis").first()
    assert pkg is not None, "pkg-gap-analysis should be registered in database"
    assert pkg.code == "gap_analysis"
    assert pkg.is_default_active is False
    assert pkg.is_system is True

    # Check items exist
    item_names = {it.name for it in pkg.items}
    assert "architecture_horizon" in item_names
    assert "gap_action" in item_names
    assert "target_plateau" in item_names
    assert "transition_cost_impact" in item_names
    assert "work_package_ref" in item_names

    # Check views exist
    view_keys = {v.view_key for v in pkg.views}
    assert "gap_matrix" in view_keys
    assert "gap_table" not in view_keys

    # Check Stereotypes
    st_baseline = db.query(ElementStereotype).filter(ElementStereotype.id == "stereo-plateau-baseline").first()
    st_target = db.query(ElementStereotype).filter(ElementStereotype.id == "stereo-plateau-target").first()
    st_wp = db.query(ElementStereotype).filter(ElementStereotype.id == "stereo-workpackage-strategic").first()
    assert st_baseline is not None
    assert st_target is not None
    assert st_wp is not None
    db.close()


def test_intra_model_gap_analysis_categorization():
    db = TestingSessionLocal()
    model = db.query(ModelWorkspace).first()
    assert model is not None

    # Setup explicit transition items in this model
    # 1. Retained element
    elem_retained = ArchimateElement(
        id="elem-test-retained",
        model_id=model.id,
        name="Standard Core Ledger",
        type="ApplicationComponent",
        layer="Application",
        properties={
            "architecture_horizon": "Persistent (Both)",
            "gap_action": "Retain",
            "work_package_ref": "WP-101"
        }
    )
    # 2. Added element (New Cloud SaaS CRM, cost impact +50000)
    elem_added = ArchimateElement(
        id="elem-test-added",
        model_id=model.id,
        name="Cloud Customer Engagement SaaS",
        type="ApplicationComponent",
        layer="Application",
        properties={
            "architecture_horizon": "To-Be (Target)",
            "gap_action": "Add / Introduce",
            "transition_cost_impact": 50000.0,
            "work_package_ref": "WP-102"
        }
    )
    # 3. Retired element (Legacy On-Prem CRM, savings -80000)
    elem_retired = ArchimateElement(
        id="elem-test-retired",
        model_id=model.id,
        name="Legacy On-Premise CRM 2012",
        type="ApplicationComponent",
        layer="Application",
        properties={
            "architecture_horizon": "As-Is (Current)",
            "gap_action": "Retire / Decommission",
            "transition_cost_impact": -80000.0,
            "work_package_ref": "WP-103"
        }
    )
    # 4. Modified element without WP (Missing WP alert test)
    elem_modified = ArchimateElement(
        id="elem-test-modified",
        model_id=model.id,
        name="Payment Gateway API v2",
        type="ApplicationComponent",
        layer="Application",
        properties={
            "architecture_horizon": "Transition Plateau",
            "gap_action": "Modify / Migrate",
            "transition_cost_impact": 15000.0,
            "work_package_ref": ""  # Missing WP!
        }
    )
    db.add_all([elem_retained, elem_added, elem_retired, elem_modified])
    db.commit()

    # Run intra-model analysis
    result = GapAnalysisService.analyze_gap_matrix(db, model.id)
    db.close()

    assert result["mode"] == "intra_model"
    metrics = result["metrics"]
    assert metrics["retained_count"] >= 1
    assert metrics["added_count"] >= 1
    assert metrics["retired_count"] >= 1
    assert metrics["modified_count"] >= 1

    # Check items content
    items_by_id = {it["id"]: it for it in result["items"]}
    assert items_by_id["elem-test-retained"]["category"] == "RETAINED"
    assert items_by_id["elem-test-added"]["category"] == "ADDED"
    assert items_by_id["elem-test-retired"]["category"] == "RETIRED"
    assert items_by_id["elem-test-modified"]["category"] == "MODIFIED"
    assert items_by_id["elem-test-modified"]["has_work_package"] is False
    assert metrics["gaps_missing_work_package"] >= 1

    # Financial delta check
    assert metrics["total_savings"] >= 80000.0
    assert metrics["total_added_investments"] >= 65000.0  # 50k + 15k


def test_cross_model_gap_analysis():
    db = TestingSessionLocal()
    # Create two models: Model Base (As-Is) and Model Target (To-Be)
    base_m = ModelWorkspace(id="ws-base-test", name="As-Is Enterprise 2026", code="ASIS")
    target_m = ModelWorkspace(id="ws-target-test", name="Target Enterprise 2028", code="TOBE")
    db.add_all([base_m, target_m])
    db.flush()

    # Base has App A and App B
    app_a_base = ArchimateElement(id="e-a-base", model_id=base_m.id, name="Shared Auth Service", type="ApplicationComponent", layer="Application")
    app_b_base = ArchimateElement(id="e-b-base", model_id=base_m.id, name="Legacy Monolith App", type="ApplicationComponent", layer="Application")

    # Target has App A (same) and App C (new)
    app_a_target = ArchimateElement(id="e-a-target", model_id=target_m.id, name="Shared Auth Service", type="ApplicationComponent", layer="Application")
    app_c_target = ArchimateElement(id="e-c-target", model_id=target_m.id, name="Cloud Native Microservices", type="ApplicationComponent", layer="Application")

    db.add_all([app_a_base, app_b_base, app_a_target, app_c_target])
    db.commit()

    # Run cross-model comparison
    result = GapAnalysisService.analyze_gap_matrix(db, base_m.id, compare_model_id=target_m.id)
    db.close()

    assert result["mode"] == "cross_model"
    metrics = result["metrics"]
    assert metrics["retained_count"] == 1  # Shared Auth Service
    assert metrics["retired_count"] == 1   # Legacy Monolith App (only in base)
    assert metrics["added_count"] == 1     # Cloud Native Microservices (only in target)


def test_gap_analysis_api_endpoints():
    db = TestingSessionLocal()
    model = db.query(ModelWorkspace).first()
    assert model is not None
    model_id = model.id
    db.close()

    # 1. Full matrix
    res = client.get(f"/api/gap-analysis/{model_id}")
    assert res.status_code == 200
    data = res.json()
    assert "metrics" in data
    assert "items" in data
    assert "retained_count" in data["metrics"]

    # 2. Summary
    res_sum = client.get(f"/api/gap-analysis/{model_id}/summary")
    assert res_sum.status_code == 200
    s_data = res_sum.json()
    assert "metrics" in s_data
