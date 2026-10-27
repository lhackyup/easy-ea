import io
import json
import zipfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.services.metamodel_service import seed_default_custom_attributes
from app.services.sample_data import seed_sample_model
from app.services.rbac_service import seed_default_rbac
from app.services.it4it_seed import seed_it4it_framework
from app.models.archimate import (
    User,
    ModelWorkspace,
    AttributePackage,
    WorkspaceAttributePackage,
    ElementStereotype,
    ArchimateElement,
    PackageView
)
from app.services.auth_service import create_access_token
from app.services.package_manager import inspect_package_bundle, install_package_bundle, export_package_bundle

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
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    # Clean up test packages
    db.query(AttributePackage).filter(AttributePackage.code.in_(["doraview", "testpkg"])).delete()
    db.commit()

    seed_sample_model(db)
    seed_default_custom_attributes(db)
    seed_default_rbac(db)
    seed_it4it_framework(db)

    admin_user = db.query(User).filter(User.username == "admin").first() or db.query(User).first()
    if admin_user:
        token = create_access_token(admin_user)
        client.headers.update({"Authorization": f"Bearer {token}"})
    db.close()


def create_eap_with_views(code: str = "doraview", version: str = "1.0.0") -> bytes:
    """Helper to generate an in-memory .eap bundle with views.json."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        manifest = {
            "id": f"pkg-{code}",
            "code": code,
            "name": "DORA Resilience Views",
            "version": version,
            "package_type": "framework",
            "author": "EasyEA Standards",
            "license": "Apache-2.0",
            "description": "Package with views for DORA operational resilience governance."
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))

        attributes = [
            {
                "name": "criticality_tier",
                "label": "Criticality Tier",
                "element_type": "ApplicationComponent",
                "layer": "Application",
                "data_type": "select",
                "options": ["Tier-1", "Tier-2", "Non-Critical"],
                "default_value": "Tier-1",
                "is_required": True
            },
            {
                "name": "rto_hours",
                "label": "Target RTO (Hours)",
                "element_type": "ApplicationComponent",
                "layer": "Application",
                "data_type": "number",
                "default_value": "4",
                "is_required": False
            }
        ]
        zf.writestr("attributes.json", json.dumps(attributes, indent=2))

        stereotypes = [
            {
                "base_type": "ApplicationComponent",
                "name": "Critical ICT Service",
                "label": "«Critical ICT Service»",
                "description": "Critical ICT service or application subject to DORA governance.",
                "icon_color": "rose",
                "links": [
                    { "attribute_name": "criticality_tier", "is_required": True },
                    { "attribute_name": "rto_hours", "is_required": False }
                ]
            }
        ]
        zf.writestr("stereotypes.json", json.dumps(stereotypes, indent=2))

        views = [
            {
                "id": "dora_critical_services_table",
                "name": "DORA Critical Services Register",
                "description": "Inventory of applications classified as critical ICT services.",
                "category": "Risk & Compliance",
                "view_type": "table",
                "icon": "ShieldAlert",
                "sort_order": 1,
                "target_stereotypes": ["Critical ICT Service"],
                "columns": [
                    { "field": "name", "label": "Service Name", "type": "string", "sortable": True },
                    { "field": "doraview_criticality_tier", "label": "Criticality", "type": "badge", "filterable": True },
                    { "field": "doraview_rto_hours", "label": "RTO (Hours)", "type": "number", "sortable": True }
                ],
                "default_sort": { "field": "name", "direction": "asc" }
            },
            {
                "id": "dora_risk_kpi",
                "name": "DORA Risk Summary Dashboard",
                "description": "Breakdown distribution by ICT criticality tier.",
                "category": "Analytics",
                "view_type": "kpi_dashboard",
                "icon": "PieChart",
                "sort_order": 2,
                "target_stereotypes": ["Critical ICT Service"],
                "metrics": [
                    { "id": "total_services", "label": "Total ICT Services", "type": "count" },
                    { "id": "tier1_count", "label": "Tier-1 Critical Services", "type": "count", "where": { "doraview_criticality_tier": "Tier-1" } }
                ],
                "charts": [
                    {
                        "id": "chart_by_tier",
                        "title": "Distribution by Criticality Tier",
                        "type": "pie",
                        "group_by": "doraview_criticality_tier"
                    }
                ]
            }
        ]
        zf.writestr("views.json", json.dumps(views, indent=2))
        zf.writestr("README.md", "# DORA Resilience Views\nPackage views documentation.")

    return buf.getvalue()


def test_inspect_and_install_bundle_with_views():
    """Test inspect and install recognizing views.json."""
    db = TestingSessionLocal()
    bundle = create_eap_with_views()

    # 1. Inspect
    inspect_res = inspect_package_bundle(bundle, db)
    assert inspect_res["valid"] is True
    assert inspect_res["counts"]["views"] == 2
    assert inspect_res["counts"]["attributes"] == 2
    assert inspect_res["counts"]["stereotypes"] == 1

    # 2. Install
    pkg = install_package_bundle(bundle, db)
    assert pkg.code == "doraview"
    assert len(pkg.views) == 2

    view_keys = {v.view_key for v in pkg.views}
    assert "dora_critical_services_table" in view_keys
    assert "dora_risk_kpi" in view_keys

    # 3. Export round-trip
    export_bytes, fname = export_package_bundle(pkg.id, db)
    assert fname == "doraview-1.0.0.eap"

    zf = zipfile.ZipFile(io.BytesIO(export_bytes))
    assert "views.json" in zf.namelist()
    exported_views = json.loads(zf.read("views.json").decode())
    assert len(exported_views) == 2
    db.close()


def test_business_package_views_api():
    """Test listing and executing views on enterprise model elements."""
    db = TestingSessionLocal()
    # Ensure doraview is installed
    bundle = create_eap_with_views()
    install_package_bundle(bundle, db)

    # Get sample workspace
    model = db.query(ModelWorkspace).first()
    assert model is not None

    # Activate installed package on the workspace
    db.merge(WorkspaceAttributePackage(id=f"wap-{model.id}-doraview", model_id=model.id, package_id="pkg-doraview"))
    db.commit()

    # Find the stereotype
    st = db.query(ElementStereotype).filter(ElementStereotype.name == "Critical ICT Service").first()
    assert st is not None

    # Create 2 enterprise elements (is_reference == False)
    el1 = ArchimateElement(
        id="elem-test-core-banking",
        model_id=model.id,
        name="Core Banking Platform",
        type="ApplicationComponent",
        layer="Application",
        is_reference=False,
        stereotype_id=st.id,
        properties={
            "doraview_criticality_tier": "Tier-1",
            "doraview_rto_hours": 2
        }
    )
    el2 = ArchimateElement(
        id="elem-test-internal-wiki",
        model_id=model.id,
        name="Internal Corporate Wiki",
        type="ApplicationComponent",
        layer="Application",
        is_reference=False,
        stereotype_id=st.id,
        properties={
            "doraview_criticality_tier": "Non-Critical",
            "doraview_rto_hours": 48
        }
    )
    # Also create a reference element that SHOULD be ignored by business views
    ref_el = ArchimateElement(
        id="elem-test-ref-std",
        model_id=model.id,
        name="Standard DORA Template",
        type="ApplicationComponent",
        layer="Application",
        is_reference=True,
        stereotype_id=st.id,
        properties={"doraview_criticality_tier": "Tier-1"}
    )
    db.merge(el1)
    db.merge(el2)
    db.merge(ref_el)
    db.commit()

    # 1. Test GET /api/business/package-views?model_id={model_id}
    res_list = client.get(f"/api/business/package-views?model_id={model.id}")
    assert res_list.status_code == 200
    list_data = res_list.json()
    assert "packages" in list_data
    dora_pkg = next((p for p in list_data["packages"] if p["code"] == "doraview"), None)
    assert dora_pkg is not None
    assert len(dora_pkg["views"]) == 2
    assert [v["view_key"] for v in dora_pkg["views"]] == ["dora_critical_services_table", "dora_risk_kpi"]
    # Verify matching elements count is 2 (ignoring the 1 reference element)
    table_view_meta = next(v for v in dora_pkg["views"] if v["view_key"] == "dora_critical_services_table")
    assert table_view_meta["matching_elements_count"] == 2

    # Verify APM views ordering
    db.merge(WorkspaceAttributePackage(id=f"wap-{model.id}-apm", model_id=model.id, package_id="pkg-apm"))
    db.commit()
    res_list_apm = client.get(f"/api/business/package-views?model_id={model.id}")
    assert res_list_apm.status_code == 200
    apm_pkg = next((p for p in res_list_apm.json()["packages"] if p["id"] == "pkg-apm"), None)
    assert apm_pkg is not None
    apm_view_names = [v["name"] for v in apm_pkg["views"]]
    assert apm_view_names == [
        "Business Applications Catalog",
        "Executive Portfolio & TCO Dashboard",
        "Gartner TIME Rationalization Matrix",
        "Operational Resilience & Compliance (DORA/GDPR)",
        "Lifecycle & Obsolescence Roadmap"
    ]

    # 2. Test POST execute Table View
    res_exec_table = client.post(
        f"/api/business/package-views/{table_view_meta['id']}/execute?model_id={model.id}",
        json={"search": "", "filters": {}}
    )
    assert res_exec_table.status_code == 200
    table_data = res_exec_table.json()
    assert table_data["view_type"] == "table"
    assert table_data["total"] == 2
    assert "Tier-1" in table_data["facet_options"]["doraview_criticality_tier"]
    assert "Non-Critical" in table_data["facet_options"]["doraview_criticality_tier"]

    # Test runtime facet filter
    res_filtered = client.post(
        f"/api/business/package-views/{table_view_meta['id']}/execute?model_id={model.id}",
        json={"filters": {"doraview_criticality_tier": "Tier-1"}}
    )
    assert res_filtered.status_code == 200
    filtered_data = res_filtered.json()
    assert filtered_data["total"] == 1
    assert filtered_data["rows"][0]["name"] == "Core Banking Platform"

    # 3. Test POST execute KPI Dashboard View
    kpi_view_meta = next(v for v in dora_pkg["views"] if v["view_key"] == "dora_risk_kpi")
    res_exec_kpi = client.post(
        f"/api/business/package-views/{kpi_view_meta['id']}/execute?model_id={model.id}",
        json={}
    )
    assert res_exec_kpi.status_code == 200
    kpi_data = res_exec_kpi.json()
    assert kpi_data["view_type"] == "kpi_dashboard"
    # Metrics
    tot_metric = next(m for m in kpi_data["metrics"] if m["id"] == "total_services")
    assert tot_metric["value"] == 2
    tier1_metric = next(m for m in kpi_data["metrics"] if m["id"] == "tier1_count")
    assert tier1_metric["value"] == 1
    # Charts
    tier_chart = next(c for c in kpi_data["charts"] if c["id"] == "chart_by_tier")
    chart_dict = {item["label"]: item["count"] for item in tier_chart["data"]}
    assert chart_dict["Tier-1"] == 1
    assert chart_dict["Non-Critical"] == 1

    db.close()
