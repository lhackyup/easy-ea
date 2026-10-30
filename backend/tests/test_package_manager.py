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
from app.models.archimate import User, AttributePackage
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
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    db = TestingSessionLocal()
    # Clean up test packages
    dora_pkgs = db.query(AttributePackage).filter(AttributePackage.code.in_(["dora", "testpkg"])).all()
    for p in dora_pkgs:
        db.delete(p)
    db.commit()

    seed_sample_model(db)
    seed_default_custom_attributes(db)
    seed_default_rbac(db)
    admin_user = db.query(User).filter(User.username == "admin").first() or db.query(User).first()
    if admin_user:
        token = create_access_token(admin_user)
        client.headers.update({"Authorization": f"Bearer {token}"})
    db.close()


def create_sample_eap_bundle(code: str = "dora", version: str = "1.0.0", extra_elem: bool = False) -> bytes:
    """Helper to generate an in-memory .eap bundle."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        manifest = {
            "id": f"pkg-{code}",
            "code": code,
            "name": "DORA Operational Resilience",
            "version": version,
            "package_type": "framework",
            "standard_version": "EU 2022/2554",
            "description": "Digital Operational Resilience Act - Standard di resilienza operativa digitale per il settore finanziario.",
            "author": "European Union / ESAs",
            "website_url": "https://eur-lex.europa.eu",
            "icon_color": "rose"
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))

        attributes = [
            {
                "name": "criticality_tier",
                "label": "Criticality Tier",
                "element_type": "ApplicationComponent",
                "layer": "Application",
                "data_type": "select",
                "options": ["Critical", "Important", "Standard"],
                "default_value": "Critical",
                "is_required": True,
                "section": "DORA Compliance"
            },
            {
                "name": "rto_hours",
                "label": "Maximum Tolerable Downtime (RTO Hours)",
                "element_type": "ApplicationComponent",
                "layer": "Application",
                "data_type": "number",
                "default_value": "4",
                "is_required": False,
                "section": "DORA Compliance"
            }
        ]
        if extra_elem:
            attributes.append({
                "name": "multi_vendor_strategy",
                "label": "Multi-Vendor Exit Strategy",
                "element_type": "ApplicationComponent",
                "layer": "Application",
                "data_type": "string",
                "section": "DORA Compliance"
            })
        zf.writestr("attributes.json", json.dumps(attributes, indent=2))

        stereotypes = [
            {
                "base_type": "ApplicationComponent",
                "name": "Critical ICT Service",
                "label": "«Critical ICT Service»",
                "description": "Funzione essenziale per la resilienza operativa bancaria.",
                "icon_color": "rose",
                "links": [
                    {
                        "attribute_name": "criticality_tier",
                        "is_required": True,
                        "default_value": "Critical"
                    }
                ]
            }
        ]
        zf.writestr("stereotypes.json", json.dumps(stereotypes, indent=2))

        elements = [
            {
                "id_alias": "elem-dora-core-banking",
                "name": "Core Banking Ledger",
                "type": "ApplicationComponent",
                "layer": "Application",
                "documentation": "Sistema centrale di tenuta conti.",
                "stereotype_name": "Critical ICT Service",
                "properties": {"criticality_tier": "Critical", "rto_hours": "2"}
            }
        ]
        if extra_elem:
            elements.append({
                "id_alias": "elem-dora-payment-switch",
                "name": "Instant Payment Gateway",
                "type": "ApplicationComponent",
                "layer": "Application",
                "documentation": "Gateway pagamenti istantanei ad alta resilienza.",
                "stereotype_name": "Critical ICT Service",
                "properties": {"criticality_tier": "Critical", "rto_hours": "1"}
            })
        zf.writestr("reference_model/elements.json", json.dumps(elements, indent=2))

        relationships = []
        if extra_elem:
            relationships.append({
                "id_alias": "rel-dora-switch-to-ledger",
                "source_alias": "Instant Payment Gateway",
                "target_alias": "Core Banking Ledger",
                "type": "ServingRelationship",
                "name": "Routes Payments"
            })
        zf.writestr("reference_model/relationships.json", json.dumps(relationships, indent=2))

        zf.writestr("README.md", "# DORA Resilience Standard\nDocumentazione ufficiale.")

    return buf.getvalue()


def test_export_package_archive():
    # Export IT4IT package
    res = client.get("/api/metamodel/packages/pkg-it4it/export")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/x-easyea-package"
    assert "it4it" in res.headers["content-disposition"]
    assert len(res.content) > 100

    # Verify zip content
    zf = zipfile.ZipFile(io.BytesIO(res.content))
    names = zf.namelist()
    assert "manifest.json" in names
    assert "attributes.json" in names
    assert "stereotypes.json" in names
    assert "reference_model/elements.json" in names
    assert "reference_model/relationships.json" in names
    assert "README.md" in names

    manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
    assert manifest["code"] == "it4it"
    assert manifest["package_type"] == "framework"


def test_inspect_and_install_new_package():
    # 1. Inspect new DORA package
    bundle_bytes = create_sample_eap_bundle("dora", "1.0.0")
    files = {"bundle": ("dora-1.0.0.eap", bundle_bytes, "application/x-easyea-package")}
    res_inspect = client.post("/api/metamodel/packages/inspect", files=files)
    assert res_inspect.status_code == 200
    report = res_inspect.json()
    assert report["valid"] is True
    assert report["action"] == "new_install"
    assert report["manifest"]["code"] == "dora"
    assert report["counts"]["attributes"] == 2
    assert report["counts"]["reference_elements"] == 1

    # 2. Install DORA package
    files_install = {"bundle": ("dora-1.0.0.eap", bundle_bytes, "application/x-easyea-package")}
    res_install = client.post("/api/metamodel/packages/install", files=files_install)
    assert res_install.status_code == 200
    install_res = res_install.json()
    assert install_res["status"] == "success"
    assert install_res["package"]["code"] == "dora"

    # 3. Verify in catalog
    res_pkgs = client.get("/api/metamodel/packages")
    assert res_pkgs.status_code == 200
    dora_pkg = next((p for p in res_pkgs.json() if p["code"] == "dora"), None)
    assert dora_pkg is not None
    assert dora_pkg["name"] == "DORA Operational Resilience"
    assert dora_pkg["package_type"] == "framework"
    assert dora_pkg["version"] == "1.0.0"
    assert dora_pkg["reference_elements_count"] == 1


def test_upgrade_existing_package():
    # 1. Install DORA 1.0.0 first
    bundle_v10 = create_sample_eap_bundle("dora", "1.0.0", extra_elem=False)
    client.post("/api/metamodel/packages/install", files={"bundle": ("dora-1.0.0.eap", bundle_v10, "application/x-easyea-package")})

    # 2. Inspect upgrade to DORA 1.1.0 with extra attribute and element
    bundle_v11 = create_sample_eap_bundle("dora", "1.1.0", extra_elem=True)
    files_inspect = {"bundle": ("dora-1.1.0.eap", bundle_v11, "application/x-easyea-package")}
    res_inspect = client.post("/api/metamodel/packages/inspect", files=files_inspect)
    assert res_inspect.status_code == 200
    report = res_inspect.json()
    assert report["valid"] is True
    assert report["action"] == "upgrade"
    assert report["manifest"]["version"] == "1.1.0"
    assert report["counts"]["attributes"] == 3
    assert report["counts"]["reference_elements"] == 2

    # Perform upgrade
    files_install = {"bundle": ("dora-1.1.0.eap", bundle_v11, "application/x-easyea-package")}
    res_install = client.post("/api/metamodel/packages/install", files=files_install)
    assert res_install.status_code == 200

    # Verify upgraded catalog
    res_detail = client.get(f"/api/metamodel/packages/pkg-dora")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["version"] == "1.1.0"
    assert len(detail["items"]) == 3
    assert len(detail["reference_elements"]) == 2


def test_inspect_invalid_bundle():
    # Test non-zip file
    files_bad = {"bundle": ("broken.eap", b"not-a-zip-content", "application/x-easyea-package")}
    res = client.post("/api/metamodel/packages/inspect", files=files_bad)
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is False
    assert len(data["errors"]) > 0

    # Test zip without manifest.json
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("test.txt", "hello")
    files_missing = {"bundle": ("no_manifest.eap", buf.getvalue(), "application/x-easyea-package")}
    res_m = client.post("/api/metamodel/packages/inspect", files=files_missing)
    assert res_m.status_code == 200
    assert res_m.json()["valid"] is False
    assert "manifest.json" in res_m.json()["errors"][0]
