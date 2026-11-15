import pytest
from app.core.database import SessionLocal
from app.services.apm_service import APMService
from app.services.seed_easybank_apm_data import seed_easybank_apm_portfolio

def test_tco_breakdown_calculation():
    db = SessionLocal()
    try:
        # Seed or refresh easybank apm
        seed_easybank_apm_portfolio(db)
        
        tco = APMService.get_tco_breakdown(db, "sample-easybank-ea")
        assert "summary" in tco
        assert "cost_by_category" in tco
        assert "cost_by_cost_center" in tco
        assert "cost_vs_value" in tco
        assert "applications" in tco

        summary = tco["summary"]
        assert summary["total_annual_tco"] > 0
        assert summary["total_software_licenses"] > 0
        assert summary["total_cloud_infrastructure"] > 0
        assert summary["total_vendor_maintenance"] > 0
        assert summary["total_internal_labor"] > 0
        assert summary["total_active_users"] > 0
        assert summary["average_cost_per_user"] > 0
        assert summary["waste_eliminate_cost"] > 0

        # Verify category percentages sum to approx 100%
        pct_sum = sum(cat["percentage"] for cat in tco["cost_by_category"])
        assert 99.0 <= pct_sum <= 101.0

        # Verify cost centers are sorted descending
        ccs = tco["cost_by_cost_center"]
        assert len(ccs) > 0
        for i in range(len(ccs) - 1):
            assert ccs[i]["total_cost"] >= ccs[i + 1]["total_cost"]

        # Verify cost vs value categorization
        cv = tco["cost_vs_value"]
        assert "bad_cost_apps" in cv
        assert "strategic_core_apps" in cv
        assert "efficiency_apps" in cv

    finally:
        db.close()


def test_lifecycle_analysis_calculation():
    db = SessionLocal()
    try:
        lifecycle = APMService.get_lifecycle_analysis(db, "sample-easybank-ea")
        assert "summary" in lifecycle
        assert "timeline_range" in lifecycle
        assert "applications" in lifecycle

        summary = lifecycle["summary"]
        assert summary["total_applications"] > 0
        assert summary["total_takeout_savings"] > 0
        assert "counts_by_status" in summary
        assert "costs_by_status" in summary
        assert summary["counts_by_status"]["Live"] > 0
        assert summary["counts_by_status"]["Phase Out"] > 0

        # Check applications
        apps = lifecycle["applications"]
        assert len(apps) > 0
        phase_out_apps = [a for a in apps if a["lifecycle_status"] == "Phase Out"]
        assert len(phase_out_apps) > 0

        # At least one app has blocker information
        has_blocker_info = any("is_ready_for_decommission" in a for a in phase_out_apps)
        assert has_blocker_info

        # Verify portfolio summary includes is_apm_package_active
        portfolio = APMService.get_portfolio_summary(db, "sample-easybank-ea")
        assert "is_apm_package_active" in portfolio
        assert portfolio["is_apm_package_active"] is True

    finally:
        db.close()
