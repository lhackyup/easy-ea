import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models.archimate import User
from app.services.sample_data import seed_sample_model
from app.services.rbac_service import seed_default_rbac
from app.services.auth_service import create_access_token
from app.services.functional_analysis_service import FunctionalAnalysisService

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def init_test_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSession()
    seed_sample_model(db)
    seed_default_rbac(db)
    admin = db.query(User).filter(User.username == "admin").first() or db.query(User).first()
    if admin:
        token = create_access_token(admin)
        client.headers.update({"Authorization": f"Bearer {token}"})
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)

def test_functional_analysis_service():
    db = TestingSession()
    result = FunctionalAnalysisService.analyze_functional_architecture(db, "sample-easybank-ea")
    db.close()

    assert "total_leaf_functions" in result
    assert result["total_leaf_functions"] > 0
    assert result["gap_leaf_functions_count"] > 0
    assert result["overlapping_leaf_functions_count"] > 0
    assert result["coverage_rate_percentage"] > 0
    assert result["total_potential_savings"] > 0
    assert len(result["hierarchy_trees"]) > 0
    assert "heatmap_domains" in result
    assert len(result["heatmap_domains"]) > 0
    assert "global_avg_functional_fit" in result
    assert result["global_avg_functional_fit"] > 0
    assert "global_avg_maturity_level" in result

    levels_found = {leaf["level"] for leaf in result["leaf_functions"]}
    assert 1 in levels_found
    assert 2 in levels_found
    # Ensure no evaluation units exceed Level 2
    assert max(levels_found) <= 2

def test_l3_subfunction_imputation_to_l2():
    """
    Verify that if an architect defines an L3 sub-function under L2,
    and maps an application to L3, it is automatically imputed to the L2 function.
    """
    from app.models.archimate import ArchimateElement, ArchimateRelationship
    db = TestingSession()
    
    # Create L3 under fn-cash-ops (L2)
    l3_elem = ArchimateElement(
        id="fn-cash-ops-l3-detail",
        model_id="sample-easybank-ea",
        name="Foreign Currency Physical Exchange Task",
        type="BusinessFunction",
        layer="Business",
        documentation="Detailed L3 task for currency notes counting",
        properties={}
    )
    db.add(l3_elem)
    
    # Composition L2 -> L3
    comp_rel = ArchimateRelationship(
        id="rel-comp-l2-l3",
        model_id="sample-easybank-ea",
        source_id="fn-cash-ops",
        target_id="fn-cash-ops-l3-detail",
        type="CompositionRelationship",
        name="Decomposes into L3"
    )
    db.add(comp_rel)

    # Link another application (app-stripe-engine) directly to L3
    srv_rel = ArchimateRelationship(
        id="rel-srv-l3",
        model_id="sample-easybank-ea",
        source_id="app-stripe-engine",
        target_id="fn-cash-ops-l3-detail",
        type="ServingRelationship",
        name="FX Gateway Support"
    )
    db.add(srv_rel)
    db.commit()

    result = FunctionalAnalysisService.analyze_functional_architecture(db, "sample-easybank-ea")
    db.close()

    # Find the L2 function in leaf_functions (evaluation units)
    l2_func = next((f for f in result["leaf_functions"] if f["id"] == "fn-cash-ops"), None)
    assert l2_func is not None
    assert l2_func["level"] == 2
    # fn-cash-ops had 1 app (Vault Core), now with L3 app (Stripe) it has 2 applications -> Overlapping!
    assert l2_func["app_count"] == 2
    assert l2_func["is_overlapping"] is True
    # Verify imputation metadata is present
    imputed_app = next((a for a in l2_func["applications"] if a["app_id"] == "app-stripe-engine"), None)
    assert imputed_app is not None
    assert imputed_app["is_imputed_from_child"] is True
    assert "Foreign Currency" in imputed_app["imputed_from"]

def test_functional_analysis_api():
    res = client.get("/api/functional/analysis/sample-easybank-ea")
    assert res.status_code == 200
    data = res.json()
    assert data["model_id"] == "sample-easybank-ea"
    assert data["total_leaf_functions"] > 0
    assert len(data["hierarchy_trees"]) > 0

def test_functional_export_docx_api():
    res = client.get("/api/functional/export/docx/sample-easybank-ea?lang=it")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert "attachment; filename=" in res.headers["content-disposition"]
    assert len(res.content) > 10000

    # Also test English
    res_en = client.get("/api/functional/export/docx/sample-easybank-ea?lang=en")
    assert res_en.status_code == 200
    assert len(res_en.content) > 10000

    # Test POST with base64 heatmap image
    fake_png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    res_post = client.post("/api/functional/export/docx/sample-easybank-ea", json={
        "lang": "it",
        "heatmap_image_base64": fake_png
    })
    assert res_post.status_code == 200
    assert len(res_post.content) > 10000
