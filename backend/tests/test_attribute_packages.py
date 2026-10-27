import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.main import app
from app.core.database import Base, get_db
from app.models.archimate import (
    AttributePackage,
    AttributePackageItem,
    WorkspaceAttributePackage,
    ModelWorkspace,
    ArchimateElement,
    User
)
from app.services.metamodel_service import seed_default_attribute_packages, seed_default_custom_attributes
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

def test_attribute_packages_full_lifecycle():
    db: Session = TestingSessionLocal()
    try:
        seed_default_attribute_packages(db)

        # 1. Check seeded standard packages
        apm_pkg = db.query(AttributePackage).filter(AttributePackage.code == "apm").first()
        assert apm_pkg is not None
        assert apm_pkg.is_system is True

        # Check that items have 3-letter prefix
        for it in apm_pkg.items:
            assert it.name.startswith("apm_")

        # Check that Business Application stereotype is in APM package
        biz_st = next((s for s in apm_pkg.stereotypes if s.name == "Business Application"), None)
        assert biz_st is not None
        assert biz_st.package_id == apm_pkg.id
        assert biz_st.base_type == "ApplicationComponent"
        assert biz_st.label == "«Business Application»"

        # 2. Test API list packages
        res = client.get("/api/metamodel/packages")
        assert res.status_code == 200
        packages = res.json()
        codes = [p["code"] for p in packages]
        assert "apm" in codes

        # 3. Create a custom package with exactly 3 letters
        res_create = client.post("/api/metamodel/packages", json={
            "code": "gov",
            "name": "Data Governance Package",
            "description": "Attributes for data lineage and classification",
            "icon_color": "emerald",
            "is_default_active": False
        })
        assert res_create.status_code == 200
        gov_pkg = res_create.json()
        assert gov_pkg["code"] == "gov"

        # Code with < 3 or > 8 characters must fail
        res_bad_code = client.post("/api/metamodel/packages", json={
            "code": "toolongcode",
            "name": "Too long code"
        })
        assert res_bad_code.status_code == 400

        # 4. Add items to package
        res_add_item = client.post(f"/api/metamodel/packages/{gov_pkg['id']}/items", json={
            "name": "gov_retention_years",
            "label": "Retention Period (Years)",
            "element_type": "DataObject",
            "layer": "Business",
            "data_type": "number",
            "default_value": "5",
            "is_required": True
        })
        assert res_add_item.status_code == 200
        item_data = res_add_item.json()
        assert item_data["name"] == "gov_retention_years"

        # Auto-prefix: if name provided without prefix, it gets auto-prepended
        res_auto_prefix = client.post(f"/api/metamodel/packages/{gov_pkg['id']}/items", json={
            "name": "custodian",
            "label": "Data Custodian",
            "element_type": "DataObject",
            "layer": "Business",
            "data_type": "string"
        })
        assert res_auto_prefix.status_code == 200
        assert res_auto_prefix.json()["name"] == "gov_custodian"

        # 5. Test library activation
        model = db.query(ModelWorkspace).filter(ModelWorkspace.id == "sample-easybank-ea").first()
        assert model is not None
        model_id = model.id

        # Toggle activate
        res_act = client.post(f"/api/metamodel/libraries/{model_id}/packages/{gov_pkg['id']}/toggle", json={"active": True})
        assert res_act.status_code == 200
        assert res_act.json()["is_active"] is True

        # Query packages for this library - gov package must report is_active=True
        res_lib_pkgs = client.get(f"/api/metamodel/packages?model_id={model_id}")
        assert res_lib_pkgs.status_code == 200
        lib_pkg_match = next(p for p in res_lib_pkgs.json() if p["id"] == gov_pkg["id"])
        assert lib_pkg_match["is_active"] is True

        # 6. Deactivate when no elements have values -> must SUCCEED
        res_deact_ok = client.post(f"/api/metamodel/libraries/{model_id}/packages/{gov_pkg['id']}/toggle", json={"active": False})
        assert res_deact_ok.status_code == 200
        assert res_deact_ok.json()["is_active"] is False

        # Reactivate
        client.post(f"/api/metamodel/libraries/{model_id}/packages/{gov_pkg['id']}/toggle", json={"active": True})

        # 7. Strict deactivation guard:
        # Populate an element with gov_retention_years
        elem = db.query(ArchimateElement).filter(ArchimateElement.model_id == model_id).first()
        assert elem is not None
        props = dict(elem.properties or {})
        props["gov_retention_years"] = 10
        elem.properties = props
        db.commit()

        # Deactivation MUST BE BLOCKED with 409
        res_blocked = client.post(f"/api/metamodel/libraries/{model_id}/packages/{gov_pkg['id']}/toggle", json={"active": False})
        assert res_blocked.status_code == 409
        detail = res_blocked.json()["detail"]
        assert detail["error"] == "package_deactivation_blocked"
        assert detail["populated_count"] >= 1

        # 8. Audit endpoint
        res_audit = client.get(f"/api/metamodel/packages/{gov_pkg['id']}/usage")
        assert res_audit.status_code == 200
        audit = res_audit.json()
        assert audit["package_id"] == gov_pkg["id"]
        assert audit["total_populated_elements"] >= 1
        lib_audit = next(l for l in audit["libraries"] if l["model_id"] == model_id)
        assert lib_audit["populated_elements_count"] >= 1

        # 9. Clean up populated value and deactivation should then succeed
        props = dict(elem.properties or {})
        del props["gov_retention_years"]
        elem.properties = props
        db.commit()

        res_deact_clean = client.post(f"/api/metamodel/libraries/{model_id}/packages/{gov_pkg['id']}/toggle", json={"active": False})
        assert res_deact_clean.status_code == 200
        assert res_deact_clean.json()["is_active"] is False

    finally:
        db.close()
