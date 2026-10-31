"""
Automated tests for EasyEA Package Repository & Marketplace Service:
- Verifies BIAN and IT4IT are not automatically seeded on fresh database boot
- Verifies registry index retrieval and SemVer correlation
- Verifies repository configuration and connection testing
- Verifies one-click installation of an .eap bundle from the repository
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.models.archimate import (
    AttributePackage,
    AttributePackageItem,
    ArchimateElement,
    ArchimateRelationship,
    User,
    UserRoleAssignment
)
from app.services.auth_service import create_access_token
from app.services.metamodel_service import seed_default_custom_attributes
from app.services.package_repository_service import PackageRepositoryService

client = TestClient(app)


def test_bian_it4it_not_seeded_automatically_on_fresh_db():
    """Verify that startup seeding does NOT automatically install BIAN or IT4IT into database."""
    engine_fresh = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine_fresh)
    SessionFresh = sessionmaker(autocommit=False, autoflush=False, bind=engine_fresh)
    db = SessionFresh()
    try:
        seed_default_custom_attributes(db)
        bian_pkg = db.query(AttributePackage).filter(AttributePackage.id == "pkg-bian").first()
        it4it_pkg = db.query(AttributePackage).filter(AttributePackage.id == "pkg-it4it").first()
        assert bian_pkg is None, "BIAN framework should NOT be installed by default on a fresh database"
        assert it4it_pkg is None, "IT4IT framework should NOT be installed by default on a fresh database"

        # Verify base packages ARE seeded
        apm_pkg = db.query(AttributePackage).filter(AttributePackage.id == "pkg-apm").first()
        adr_pkg = db.query(AttributePackage).filter(AttributePackage.id == "pkg-adr").first()
        assert apm_pkg is not None
        assert adr_pkg is not None
        assert apm_pkg.is_default_active is True
        assert adr_pkg.is_default_active is True
    finally:
        db.close()


def test_package_repository_list_and_correlation():
    """Verify registry listing correlates with local installed status."""
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        result = PackageRepositoryService.list_packages(db)
        assert result["total"] >= 2
        packages = result["packages"]
        codes = {p["code"] for p in packages}
        assert "bian" in codes
        assert "it4it" in codes

        for p in packages:
            assert "name" in p
            assert "version" in p
            assert "bundle_url" in p
            assert "status" in p
            assert p["status"] in ("installed", "update_available", "available")
    finally:
        db.close()


def test_package_repository_api_endpoints():
    """Verify REST API endpoints for repository browsing, config, and connection testing."""
    from app.core.database import SessionLocal
    db = SessionLocal()
    ra = db.query(UserRoleAssignment).filter(UserRoleAssignment.role == "admin").first()
    admin = db.query(User).filter(User.id == ra.user_id).first()
    token = create_access_token(admin)
    db.close()

    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /packages/repository
    res = client.get("/api/metamodel/packages/repository", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "packages" in data
    assert data["total"] >= 2

    # 2. GET /packages/repository/config
    res_cfg = client.get("/api/metamodel/packages/repository/config", headers=headers)
    assert res_cfg.status_code == 200
    cfg = res_cfg.json()
    assert "configured_url" in cfg

    # 3. POST /packages/repository/test (local)
    res_test = client.post("/api/metamodel/packages/repository/test", json={"url": "local"}, headers=headers)
    assert res_test.status_code == 200
    test_data = res_test.json()
    assert test_data["status"] == "success"
    assert test_data["reachable"] is True
    assert test_data["packages_count"] >= 2


def test_package_repository_install_lifecycle():
    """Verify on-demand installation of a package from repository."""
    from app.core.database import SessionLocal
    db = SessionLocal()
    ra = db.query(UserRoleAssignment).filter(UserRoleAssignment.role == "admin").first()
    admin = db.query(User).filter(User.id == ra.user_id).first()
    token = create_access_token(admin)

    # Clean up pkg-bian if present
    db.query(ArchimateRelationship).filter(ArchimateRelationship.package_id == "pkg-bian").delete()
    db.query(ArchimateElement).filter(ArchimateElement.package_id == "pkg-bian").delete()
    db.query(AttributePackageItem).filter(AttributePackageItem.package_id == "pkg-bian").delete()
    db.query(AttributePackage).filter(AttributePackage.id == "pkg-bian").delete()
    db.commit()
    db.close()

    headers = {"Authorization": f"Bearer {token}"}

    # Verify not installed
    res_before = client.get("/api/metamodel/packages/repository", headers=headers)
    bian_entry = next(p for p in res_before.json()["packages"] if p["code"] == "bian")
    assert bian_entry["is_installed"] is False
    assert bian_entry["status"] == "available"

    # Install from repository via API
    res_install = client.post(
        "/api/metamodel/packages/repository/install",
        json={"package_id_or_code": "bian", "force": True},
        headers=headers
    )
    assert res_install.status_code == 200
    installed_data = res_install.json()
    assert installed_data["status"] == "success"
    assert installed_data["package"]["code"] == "bian"

    # Verify now installed
    res_after = client.get("/api/metamodel/packages/repository", headers=headers)
    bian_after = next(p for p in res_after.json()["packages"] if p["code"] == "bian")
    assert bian_after["is_installed"] is True
    assert bian_after["status"] == "installed"


def _get_active_db():
    if get_db in app.dependency_overrides:
        gen = app.dependency_overrides[get_db]()
        return next(gen)
    from app.core.database import SessionLocal
    return SessionLocal()


def test_tmforum_package_repository_installation():
    """Verify TM Forum ODA & eTOM package is present in repository and can be installed via API."""
    db = _get_active_db()
    admin_assignment = db.query(UserRoleAssignment).filter(UserRoleAssignment.role == "admin").first()
    admin_user = db.query(User).filter(User.id == admin_assignment.user_id).first() if admin_assignment else db.query(User).first()
    token = create_access_token(admin_user)
    headers = {"Authorization": f"Bearer {token}"}

    # Clean up any existing tmforum package
    db.query(ArchimateRelationship).filter(ArchimateRelationship.package_id == "pkg-tmforum-oda").delete()
    db.query(ArchimateElement).filter(ArchimateElement.package_id == "pkg-tmforum-oda").delete()
    db.query(AttributePackageItem).filter(AttributePackageItem.package_id == "pkg-tmforum-oda").delete()
    db.query(AttributePackage).filter(AttributePackage.id == "pkg-tmforum-oda").delete()
    db.commit()
    db.close()

    # 1. Verify TM Forum is listed in repository
    res = client.get("/api/metamodel/packages/repository", headers=headers)
    assert res.status_code == 200
    pkgs = res.json()["packages"]
    tmf_entry = next((p for p in pkgs if p["id"] == "pkg-tmforum-oda"), None)
    assert tmf_entry is not None, "TM Forum package should be listed in repository"
    assert tmf_entry["code"] == "tmforum"
    assert tmf_entry["standard_version"] == "v23.5"
    assert tmf_entry["is_installed"] is False

    # 2. Install TM Forum package
    res_install = client.post(
        "/api/metamodel/packages/repository/install",
        json={"package_id_or_code": "pkg-tmforum-oda", "force": True},
        headers=headers
    )
    assert res_install.status_code == 200
    inst_resp = res_install.json()
    assert inst_resp["status"] == "success"
    assert inst_resp["package"]["code"] == "tmforum"

    # 3. Verify elements and relationships are in DB
    db = _get_active_db()
    tmf_elems = db.query(ArchimateElement).filter(ArchimateElement.package_id == "pkg-tmforum-oda").all()
    assert len(tmf_elems) >= 50, f"Expected at least 50 TM Forum elements, got {len(tmf_elems)}"
    
    # Check specific eTOM and ODA components
    order_proc = next((e for e in tmf_elems if "Order Handling" in e.name), None)
    assert order_proc is not None
    assert order_proc.is_reference is True

    oda_comp = next((e for e in tmf_elems if "Product Order" in e.name), None)
    assert oda_comp is not None

    db.close()


def test_rami_isa95_package_repository_installation():
    """Verify RAMI 4.0 & ISA-95 package is present in repository and can be installed via API."""
    db = _get_active_db()
    admin_assignment = db.query(UserRoleAssignment).filter(UserRoleAssignment.role == "admin").first()
    admin_user = db.query(User).filter(User.id == admin_assignment.user_id).first() if admin_assignment else db.query(User).first()
    token = create_access_token(admin_user)
    headers = {"Authorization": f"Bearer {token}"}

    # Clean up any existing rami package
    db.query(ArchimateRelationship).filter(ArchimateRelationship.package_id == "pkg-rami-isa95").delete()
    db.query(ArchimateElement).filter(ArchimateElement.package_id == "pkg-rami-isa95").delete()
    db.query(AttributePackageItem).filter(AttributePackageItem.package_id == "pkg-rami-isa95").delete()
    db.query(AttributePackage).filter(AttributePackage.id == "pkg-rami-isa95").delete()
    db.commit()
    db.close()

    # 1. Verify RAMI 4.0 is listed in repository
    res = client.get("/api/metamodel/packages/repository", headers=headers)
    assert res.status_code == 200
    pkgs = res.json()["packages"]
    rami_entry = next((p for p in pkgs if p["id"] == "pkg-rami-isa95"), None)
    assert rami_entry is not None, "RAMI 4.0 package should be listed in repository"
    assert rami_entry["code"] == "rami"
    assert rami_entry["standard_version"] == "v4.0 / IEC 62264"
    assert rami_entry["is_installed"] is False

    # 2. Install RAMI 4.0 package
    res_install = client.post(
        "/api/metamodel/packages/repository/install",
        json={"package_id_or_code": "pkg-rami-isa95", "force": True},
        headers=headers
    )
    assert res_install.status_code == 200
    inst_resp = res_install.json()
    assert inst_resp["status"] == "success"
    assert inst_resp["package"]["code"] == "rami"

    # 3. Verify elements and relationships are in DB
    db = _get_active_db()
    rami_elems = db.query(ArchimateElement).filter(ArchimateElement.package_id == "pkg-rami-isa95").all()
    assert len(rami_elems) >= 40, f"Expected at least 40 RAMI elements, got {len(rami_elems)}"

    # Check specific equipment, software, and operations
    cnc_elem = next((e for e in rami_elems if "CNC" in e.name), None)
    assert cnc_elem is not None
    assert cnc_elem.type == "Equipment"
    assert cnc_elem.is_reference is True

    mes_elem = next((e for e in rami_elems if "Manufacturing Execution" in e.name), None)
    assert mes_elem is not None
    assert mes_elem.type == "ApplicationComponent"

    aas_elem = next((e for e in rami_elems if "Asset Administration Shell" in e.name), None)
    assert aas_elem is not None

    db.close()


def test_acord_package_repository_installation():
    """Verify ACORD Insurance Framework package is present in repository and can be installed via API."""
    db = _get_active_db()
    admin_assignment = db.query(UserRoleAssignment).filter(UserRoleAssignment.role == "admin").first()
    admin_user = db.query(User).filter(User.id == admin_assignment.user_id).first() if admin_assignment else db.query(User).first()
    token = create_access_token(admin_user)
    headers = {"Authorization": f"Bearer {token}"}

    # Clean up any existing acord package
    db.query(ArchimateRelationship).filter(ArchimateRelationship.package_id == "pkg-acord-framework").delete()
    db.query(ArchimateElement).filter(ArchimateElement.package_id == "pkg-acord-framework").delete()
    db.query(AttributePackageItem).filter(AttributePackageItem.package_id == "pkg-acord-framework").delete()
    db.query(AttributePackage).filter(AttributePackage.id == "pkg-acord-framework").delete()
    db.commit()
    db.close()

    # 1. Verify ACORD is listed in repository
    res = client.get("/api/metamodel/packages/repository", headers=headers)
    assert res.status_code == 200
    pkgs = res.json()["packages"]
    acord_entry = next((p for p in pkgs if p["id"] == "pkg-acord-framework"), None)
    assert acord_entry is not None, "ACORD package should be listed in repository"
    assert acord_entry["code"] == "acord"
    assert acord_entry["is_installed"] is False

    # 2. Install ACORD package
    res_install = client.post(
        "/api/metamodel/packages/repository/install",
        json={"package_id_or_code": "pkg-acord-framework", "force": True},
        headers=headers
    )
    assert res_install.status_code == 200
    inst_resp = res_install.json()
    assert inst_resp["status"] == "success"
    assert inst_resp["package"]["code"] == "acord"

    # 3. Verify elements and relationships are in DB
    db = _get_active_db()
    acord_elems = db.query(ArchimateElement).filter(ArchimateElement.package_id == "pkg-acord-framework").all()
    assert len(acord_elems) >= 40, f"Expected at least 40 ACORD elements, got {len(acord_elems)}"

    # Check specific capability, PAS, CMS, and policy contract
    fnol_elem = next((e for e in acord_elems if "First Notice of Loss" in e.name), None)
    assert fnol_elem is not None
    assert fnol_elem.type == "Capability"
    assert fnol_elem.is_reference is True

    pas_elem = next((e for e in acord_elems if "Policy Administration System" in e.name), None)
    assert pas_elem is not None
    assert pas_elem.type == "ApplicationComponent"

    policy_elem = next((e for e in acord_elems if "Policy Contract" in e.name), None)
    assert policy_elem is not None
    assert policy_elem.type == "BusinessObject"

    db.close()


def test_sgam_cim_package_repository_installation():
    """Verify SGAM & IEC CIM Smart Grid package is present in repository and can be installed via API."""
    db = _get_active_db()
    admin_assignment = db.query(UserRoleAssignment).filter(UserRoleAssignment.role == "admin").first()
    admin_user = db.query(User).filter(User.id == admin_assignment.user_id).first() if admin_assignment else db.query(User).first()
    token = create_access_token(admin_user)
    headers = {"Authorization": f"Bearer {token}"}

    # Clean up any existing sgam package
    db.query(ArchimateRelationship).filter(ArchimateRelationship.package_id == "pkg-sgam-cim").delete()
    db.query(ArchimateElement).filter(ArchimateElement.package_id == "pkg-sgam-cim").delete()
    db.query(AttributePackageItem).filter(AttributePackageItem.package_id == "pkg-sgam-cim").delete()
    db.query(AttributePackage).filter(AttributePackage.id == "pkg-sgam-cim").delete()
    db.commit()
    db.close()

    # 1. Verify SGAM is listed in repository
    res = client.get("/api/metamodel/packages/repository", headers=headers)
    assert res.status_code == 200
    pkgs = res.json()["packages"]
    sgam_entry = next((p for p in pkgs if p["id"] == "pkg-sgam-cim"), None)
    assert sgam_entry is not None, "SGAM package should be listed in repository"
    assert sgam_entry["code"] == "sgam"
    assert sgam_entry["is_installed"] is False

    # 2. Install SGAM package
    res_install = client.post(
        "/api/metamodel/packages/repository/install",
        json={"package_id_or_code": "pkg-sgam-cim", "force": True},
        headers=headers
    )
    assert res_install.status_code == 200
    inst_resp = res_install.json()
    assert inst_resp["status"] == "success"
    assert inst_resp["package"]["code"] == "sgam"

    # 3. Verify elements and relationships are in DB
    db = _get_active_db()
    sgam_elems = db.query(ArchimateElement).filter(ArchimateElement.package_id == "pkg-sgam-cim").all()
    assert len(sgam_elems) >= 25, f"Expected at least 25 SGAM elements, got {len(sgam_elems)}"

    # Check FLISR, ADMS, and Substation
    flisr_elem = next((e for e in sgam_elems if "FLISR" in e.name), None)
    assert flisr_elem is not None
    assert flisr_elem.type == "BusinessFunction"

    adms_elem = next((e for e in sgam_elems if "ADMS" in e.name), None)
    assert adms_elem is not None
    assert adms_elem.type == "ApplicationComponent"

    db.close()


def test_scor_ds_package_repository_installation():
    """Verify SCOR Digital Standard (ASCM) package is present in repository and can be installed via API."""
    db = _get_active_db()
    admin_assignment = db.query(UserRoleAssignment).filter(UserRoleAssignment.role == "admin").first()
    admin_user = db.query(User).filter(User.id == admin_assignment.user_id).first() if admin_assignment else db.query(User).first()
    token = create_access_token(admin_user)
    headers = {"Authorization": f"Bearer {token}"}

    # Clean up any existing scor package
    db.query(ArchimateRelationship).filter(ArchimateRelationship.package_id == "pkg-scor-ds").delete()
    db.query(ArchimateElement).filter(ArchimateElement.package_id == "pkg-scor-ds").delete()
    db.query(AttributePackageItem).filter(AttributePackageItem.package_id == "pkg-scor-ds").delete()
    db.query(AttributePackage).filter(AttributePackage.id == "pkg-scor-ds").delete()
    db.commit()
    db.close()

    # 1. Verify SCOR is listed in repository
    res = client.get("/api/metamodel/packages/repository", headers=headers)
    assert res.status_code == 200
    pkgs = res.json()["packages"]
    scor_entry = next((p for p in pkgs if p["id"] == "pkg-scor-ds"), None)
    assert scor_entry is not None, "SCOR DS package should be listed in repository"
    assert scor_entry["code"] == "scor"
    assert scor_entry["is_installed"] is False

    # 2. Install SCOR package
    res_install = client.post(
        "/api/metamodel/packages/repository/install",
        json={"package_id_or_code": "pkg-scor-ds", "force": True},
        headers=headers
    )
    assert res_install.status_code == 200
    inst_resp = res_install.json()
    assert inst_resp["status"] == "success"
    assert inst_resp["package"]["code"] == "scor"

    # 3. Verify elements and relationships are in DB
    db = _get_active_db()
    scor_elems = db.query(ArchimateElement).filter(ArchimateElement.package_id == "pkg-scor-ds").all()
    assert len(scor_elems) >= 30, f"Expected at least 30 SCOR elements, got {len(scor_elems)}"

    # Check Plan, WMS, and Sales Order
    plan_elem = next((e for e in scor_elems if "Demand Forecasting" in e.name), None)
    assert plan_elem is not None
    assert plan_elem.type == "BusinessProcess"

    wms_elem = next((e for e in scor_elems if "Warehouse Management" in e.name), None)
    assert wms_elem is not None
    assert wms_elem.type == "ApplicationComponent"

    db.close()





