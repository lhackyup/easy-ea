"""
Tests for ArchiMate standard layer packages:
- 1A bcm (Strategy)
- 2B bsc (Business)
- 3B alc (Application)
- 4A cld (Technology)
- 4B eol (Technology)
- 5A req (Motivation)
- 6A ppm (Implementation)
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.archimate import AttributePackage, AttributePackageItem, PackageView, ModelWorkspace, WorkspaceAttributePackage
from app.api.business_views import _run_view_execution, ViewExecuteRequest

client = TestClient(app)

def test_standard_layer_packages_registered_and_inactive_by_default():
    db = SessionLocal()
    try:
        expected_pkgs = ["bcm", "bsc", "alc", "cld", "eol", "req", "ppm"]
        for code in expected_pkgs:
            pkg = db.query(AttributePackage).filter(AttributePackage.code == code).first()
            assert pkg is not None, f"Package with code '{code}' should exist"
            assert pkg.is_default_active is False, f"Package '{code}' must have is_default_active = False"
            assert pkg.is_system is True, f"Package '{code}' should be marked as system package"
            
            # Verify items exist
            items = db.query(AttributePackageItem).filter(AttributePackageItem.package_id == pkg.id).all()
            assert len(items) >= 4, f"Package '{code}' should have at least 4 attribute items"
            
            # Verify package view exists
            view = db.query(PackageView).filter(PackageView.package_id == pkg.id).first()
            assert view is not None, f"Package '{code}' should have an associated PackageView"
    finally:
        db.close()

def test_easybank_model_has_all_packages_and_layer_elements():
    db = SessionLocal()
    try:
        model = db.query(ModelWorkspace).filter(
            (ModelWorkspace.id == "sample-easybank-ea") | (ModelWorkspace.code == "EASY")
        ).first()
        assert model is not None, "EASY model workspace must exist"
        
        # Verify packages are active in EASY
        expected_pkgs = ["bcm", "bsc", "alc", "cld", "eol", "req", "ppm"]
        active_pkgs = db.query(AttributePackage.code).join(
            WorkspaceAttributePackage, WorkspaceAttributePackage.package_id == AttributePackage.id
        ).filter(WorkspaceAttributePackage.model_id == model.id).all()
        active_codes = {p[0] for p in active_pkgs}
        
        for code in expected_pkgs:
            assert code in active_codes, f"Package '{code}' should be active in EASY model"
            
        # Verify views execute with non-empty results
        views_to_test = [
            "bcm_capability_matrix",
            "bsc_service_catalog",
            "alc_tech_health",
            "cld_infra_topology",
            "eol_technology_lifecycle",
            "req_requirements_matrix",
            "ppm_delivery_roadmap"
        ]
        for vk in views_to_test:
            v = db.query(PackageView).filter(PackageView.view_key == vk).first()
            assert v is not None, f"PackageView '{vk}' must exist"
            res = _run_view_execution(db, model.id, v, ViewExecuteRequest())
            assert res["total"] > 0, f"PackageView '{vk}' must return data for EASY model"
    finally:
        db.close()
