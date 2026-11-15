import pytest
from app.core.database import SessionLocal
from app.services.tech_risk_service import TechRiskService, calculate_tech_status
from app.services.seed_easybank_tech_risk_data import seed_easybank_tech_risk_portfolio
from datetime import date

def test_calculate_tech_status():
    today = date(2026, 11, 14)

    # 1. Past EOL date -> Obsolete
    res_eol = calculate_tech_status({
        "tech_lifecycle_status": "Supported",
        "tech_eol_date": "2024-01-01"
    }, today)
    assert res_eol["computed_status"] == "End of Life / Obsolete"
    assert res_eol["risk_score"] == 4
    assert res_eol["risk_level"] == "Critical"

    # 2. Upcoming EOL within 180 days -> Approaching EOL
    res_app = calculate_tech_status({
        "tech_lifecycle_status": "Supported",
        "tech_eol_date": "2027-01-15" # ~60 days ahead
    }, today)
    assert res_app["computed_status"] == "Approaching EOL"
    assert res_app["risk_score"] == 2
    assert res_app["risk_level"] == "Medium"

    # 3. Far future EOL -> Supported
    res_sup = calculate_tech_status({
        "tech_lifecycle_status": "Supported",
        "tech_eol_date": "2028-06-30"
    }, today)
    assert res_sup["computed_status"] == "Supported"
    assert res_sup["risk_score"] == 1
    assert res_sup["risk_level"] == "Low"

    # 4. Extended Support
    res_ext = calculate_tech_status({
        "tech_lifecycle_status": "Extended Support",
        "tech_eol_date": "2025-01-01",
        "tech_eoes_date": "2027-12-31"
    }, today)
    assert res_ext["computed_status"] == "Extended Support"
    assert res_ext["risk_score"] == 3
    assert res_ext["risk_level"] == "High"


def test_tech_risk_service_easybank():
    db = SessionLocal()
    try:
        seed_res = seed_easybank_tech_risk_portfolio(db, "sample-easybank-ea")
        assert seed_res["status"] == "success"

        analysis = TechRiskService.analyze_tech_risk(db, "sample-easybank-ea")
        summary = analysis["summary"]

        assert summary["total_applications"] > 0
        assert summary["assessed_applications"] >= 8
        assert summary["obsolete_technologies_count"] >= 3
        assert len(analysis["dora_compliance_alerts"]) >= 1

        # Check that Thought Machine has low risk
        tm_app = next((a for a in analysis["applications"] if a["id"] == "app-cloud-core"), None)
        assert tm_app is not None
        assert tm_app["tech_risk_level"] == "Low"
        assert tm_app["is_dora_violation"] is False

        # Check that Legacy CRM or AS400 Ledger has critical risk
        as400 = next((a for a in analysis["applications"] if a["id"] == "app-legacy-ledger"), None)
        assert as400 is not None
        assert as400["tech_risk_level"] == "Critical"
        assert as400["is_dora_violation"] is True

        # Check blast radius
        assert len(analysis["technology_blast_radius"]) > 0
        top_blast = analysis["technology_blast_radius"][0]
        assert top_blast["impacted_applications_count"] > 0
    finally:
        db.close()
