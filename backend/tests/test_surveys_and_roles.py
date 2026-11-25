import pytest
from app.main import app
from fastapi.testclient import TestClient
from app.core.database import SessionLocal, engine, Base
from app.models.archimate import User, UserRoleAssignment, ArchimateElement, ApplicationBusinessAttributes
from app.models.surveys import ApplicationOwnership, SurveyCampaign, SurveyScope, SurveyResponse
from app.services.auth_service import create_access_token
from app.services.rbac_service import (
    seed_default_rbac,
    check_user_permission,
    can_user_view_financials,
    is_user_app_owner,
    ROLE_DEFINITIONS,
    get_roles_metadata
)
from app.services.survey_service import SurveyService
from app.services.seed_easybank_apm_data import seed_easybank_apm_portfolio


def test_new_roles_defined_in_rbac():
    db = SessionLocal()
    try:
        seed_default_rbac(db)
        meta = get_roles_metadata()
        role_keys = {r["role"] for r in meta["roles"]}
        assert "c_level" in role_keys
        assert "app_owner" in role_keys
        assert "process_owner" in role_keys
        assert "business_user" in role_keys
        assert "business_owner" not in role_keys

        # Check scope rules
        assert "c_level" in meta["scope_rules"]
        assert "app_owner" in meta["scope_rules"]
        assert "process_owner" in meta["scope_rules"]
        assert "business_user" in meta["scope_rules"]
        assert "business_owner" not in meta["scope_rules"]
    finally:
        db.close()


def test_c_level_financial_visibility():
    db = SessionLocal()
    try:
        seed_default_rbac(db)
        cio_user = db.query(User).filter(User.username == "giorgio_cio").first()
        assert cio_user is not None

        # C-Level can view financial analytics
        perm = check_user_permission(db, cio_user.id, "view_financial_analytics", "sample-easybank-ea")
        assert perm["allowed"] is True
        assert can_user_view_financials(db, cio_user) is True

        # Standard business user CANNOT view financial analytics
        buser = db.query(User).filter(User.username == "elena_business").first()
        assert buser is not None
        perm_b = check_user_permission(db, buser.id, "view_financial_analytics", "sample-easybank-ea")
        assert perm_b["allowed"] is False
        assert can_user_view_financials(db, buser) is False
    finally:
        db.close()


def test_app_owner_and_ownership_assignment():
    db = SessionLocal()
    try:
        seed_default_rbac(db)
        seed_easybank_apm_portfolio(db)

        owner_user = db.query(User).filter(User.username == "roberto_owner").first()
        assert owner_user is not None

        # Pick an application
        app = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == "sample-easybank-ea",
            ArchimateElement.type == "ApplicationComponent"
        ).first()
        assert app is not None

        # Assign ownership
        ownership = SurveyService.assign_application_owner(
            db=db,
            element_id=app.id,
            user_id=owner_user.id,
            ownership_type="technical_owner",
            notes="Assigned for testing"
        )
        assert ownership.element_id == app.id
        assert ownership.user_id == owner_user.id

        # Verify is_user_app_owner
        assert is_user_app_owner(db, owner_user, app.id) is True

        # Verify can_user_view_financials on owned app vs other app
        assert can_user_view_financials(db, owner_user, element_id=app.id) is True
        assert can_user_view_financials(db, owner_user, element_id="some-unowned-app-id") is False
        assert can_user_view_financials(db, owner_user) is False # aggregate is false

        # List owned apps
        owned_apps = SurveyService.get_user_owned_applications(db, owner_user, model_id="sample-easybank-ea")
        assert any(a["id"] == app.id for a in owned_apps)

        # Check permissions for editing APM attributes
        perm_edit_owned = check_user_permission(db, owner_user.id, "edit_apm_attributes", "sample-easybank-ea", element_id=app.id)
        assert perm_edit_owned["allowed"] is True

        perm_edit_unowned = check_user_permission(db, owner_user.id, "edit_apm_attributes", "sample-easybank-ea", element_id="unowned-id")
        assert perm_edit_unowned["allowed"] is False
    finally:
        db.close()


def test_survey_campaign_lifecycle():
    db = SessionLocal()
    try:
        seed_default_rbac(db)
        seed_easybank_apm_portfolio(db)

        admin = db.query(User).filter(User.username == "admin").first()
        owner = db.query(User).filter(User.username == "roberto_owner").first()
        app = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == "sample-easybank-ea",
            ArchimateElement.type == "ApplicationComponent"
        ).first()

        # Ensure ownership
        SurveyService.assign_application_owner(db, app.id, owner.id, "technical_owner")

        # Create Campaign
        campaign = SurveyService.create_campaign(
            db=db,
            model_id="sample-easybank-ea",
            title="Q4 2026 APM Health Check",
            description="Crowdsourcing audit campaign for all banking applications",
            created_by=admin,
            mode="approval_required",
            target_owner_type="technical_owner",
            target_element_ids=[app.id]
        )
        assert campaign.id is not None
        assert campaign.status == "active"
        assert len(campaign.scopes) == 1

        scope = campaign.scopes[0]
        assert scope.element_id == app.id

        # Get survey details for user
        user_surveys = SurveyService.get_user_surveys(db, owner, model_id="sample-easybank-ea")
        assert len(user_surveys) >= 1
        matched_survey = next((s for s in user_surveys if s["scope_id"] == scope.id), None)
        assert matched_survey is not None
        assert matched_survey["status"] == "pending"

        # Submit response
        answers = {
            "name": app.name,
            "business_fit": 4,
            "technical_fit": 4,
            "time_quadrant": "Invest",
            "annual_cost": 75000.0,
            "lifecycle_status": "Live",
            "notes": "Survey updated fit to 4 and quadrant to Invest."
        }
        res = SurveyService.submit_survey_response(
            db=db,
            scope_id=scope.id,
            user=owner,
            answers=answers,
            notes="Updated for Q4"
        )
        assert res["status"] == "submitted"
        assert "diff_summary" in res

        # Approve response as admin/architect
        appr = SurveyService.approve_survey_response(
            db=db,
            scope_id=scope.id,
            reviewer_user=admin,
            feedback="All data looks consistent."
        )
        assert appr["status"] == "approved"

        # Verify live model updated
        db.refresh(app)
        apm = app.apm_attributes
        assert apm.business_fit == 4
        assert apm.technical_fit == 4
        assert apm.time_quadrant == "Invest"
        assert apm.annual_cost == 75000.0

    finally:
        db.close()


def test_api_financial_masking_and_survey_endpoints():
    client = TestClient(app)
    db = SessionLocal()
    try:
        seed_default_rbac(db)
        seed_easybank_apm_portfolio(db)

        cio_user = db.query(User).filter(User.username == "giorgio_cio").first()
        b_user = db.query(User).filter(User.username == "elena_business").first()
        owner_user = db.query(User).filter(User.username == "roberto_owner").first()
        admin_user = db.query(User).filter(User.username == "admin").first()

        cio_token = create_access_token(cio_user)
        b_token = create_access_token(b_user)
        owner_token = create_access_token(owner_user)
        admin_token = create_access_token(admin_user)

        # 1. C-Level calls APM portfolio -> gets real cost values
        resp_cio = client.get(
            "/api/apm/portfolio/sample-easybank-ea",
            headers={"Authorization": f"Bearer {cio_token}"}
        )
        assert resp_cio.status_code == 200
        data_cio = resp_cio.json()
        assert data_cio["total_annual_cost"] is not None
        assert data_cio["total_annual_cost"] > 0
        assert data_cio.get("_financials_redacted") is not True

        # 2. Business user calls APM portfolio -> costs are redacted!
        resp_b = client.get(
            "/api/apm/portfolio/sample-easybank-ea",
            headers={"Authorization": f"Bearer {b_token}"}
        )
        assert resp_b.status_code == 200
        data_b = resp_b.json()
        assert data_b["total_annual_cost"] is None
        assert data_b.get("_financials_redacted") is True
        # Check that individual apps also have null costs
        assert len(data_b["applications"]) > 0
        assert data_b["applications"][0]["cost"] is None

        # 3. Business user calls TCO breakdown -> 403 Forbidden!
        resp_tco = client.get(
            "/api/apm/tco-breakdown/sample-easybank-ea",
            headers={"Authorization": f"Bearer {b_token}"}
        )
        assert resp_tco.status_code == 403

        # 4. App Owner calls my-applications and my-surveys
        resp_my_apps = client.get(
            "/api/surveys/my-applications?model_id=sample-easybank-ea",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert resp_my_apps.status_code == 200

        resp_my_surveys = client.get(
            "/api/surveys/my-surveys?model_id=sample-easybank-ea",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert resp_my_surveys.status_code == 200

        # 5. Admin creates a campaign via API
        resp_cmp = client.post(
            "/api/surveys/campaigns",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "model_id": "sample-easybank-ea",
                "title": "API Automated Campaign",
                "description": "Integration test campaign",
                "mode": "approval_required"
            }
        )
        assert resp_cmp.status_code == 200
        cmp_data = resp_cmp.json()
        assert "id" in cmp_data

        # 6. List campaigns via API
        resp_list = client.get(
            "/api/surveys/campaigns/sample-easybank-ea",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp_list.status_code == 200
        assert len(resp_list.json()) > 0

        # 7. Role enforcement: Elena (business_user) must receive 403 on survey management & portal APIs
        resp_b_campaigns = client.get(
            "/api/surveys/campaigns/sample-easybank-ea",
            headers={"Authorization": f"Bearer {b_token}"}
        )
        assert resp_b_campaigns.status_code == 403

        resp_b_create = client.post(
            "/api/surveys/campaigns",
            headers={"Authorization": f"Bearer {b_token}"},
            json={
                "model_id": "sample-easybank-ea",
                "title": "Illegal Campaign by Business User"
            }
        )
        assert resp_b_create.status_code == 403

        resp_b_my_surveys = client.get(
            "/api/surveys/my-surveys?model_id=sample-easybank-ea",
            headers={"Authorization": f"Bearer {b_token}"}
        )
        assert resp_b_my_surveys.status_code == 403

        resp_b_my_apps = client.get(
            "/api/surveys/my-applications?model_id=sample-easybank-ea",
            headers={"Authorization": f"Bearer {b_token}"}
        )
        assert resp_b_my_apps.status_code == 403

    finally:
        db.close()


def test_process_and_app_owner_permissions_and_targeted_campaigns():
    client = TestClient(app)
    db = SessionLocal()
    try:
        seed_default_rbac(db)
        seed_easybank_apm_portfolio(db)

        silvia = db.query(User).filter(User.username == "silvia_bizowner").first()
        roberto = db.query(User).filter(User.username == "roberto_owner").first()
        admin = db.query(User).filter(User.username == "admin").first()

        assert silvia is not None
        assert roberto is not None
        assert admin is not None

        silvia_token = create_access_token(silvia)
        roberto_token = create_access_token(roberto)

        # 1. Verify permissions
        p_portal_silvia = check_user_permission(db, silvia.id, "view_owner_portal", "sample-easybank-ea")
        assert p_portal_silvia["allowed"] is True

        p_surveys_silvia = check_user_permission(db, silvia.id, "fill_surveys", "sample-easybank-ea")
        assert p_surveys_silvia["allowed"] is True

        p_edit_proc = check_user_permission(db, silvia.id, "edit_owned_processes", "sample-easybank-ea", element_id="proc-onboarding")
        assert p_edit_proc["allowed"] is True

        p_fin_silvia = check_user_permission(db, silvia.id, "view_financial_analytics", "sample-easybank-ea")
        assert p_fin_silvia["allowed"] is False

        # Roberto (app_owner) permissions
        p_portal_roberto = check_user_permission(db, roberto.id, "view_owner_portal", "sample-easybank-ea")
        assert p_portal_roberto["allowed"] is True

        # Financial visibility on owned vs unowned for Roberto
        assert can_user_view_financials(db, roberto, element_id="app-cloud-core") is True
        assert can_user_view_financials(db, roberto, element_id="app-atm-switch") is False
        assert can_user_view_financials(db, roberto) is False

        # 2. API Access
        resp_roberto_apps = client.get(
            "/api/surveys/my-applications?model_id=sample-easybank-ea",
            headers={"Authorization": f"Bearer {roberto_token}"}
        )
        assert resp_roberto_apps.status_code == 200
        my_apps = resp_roberto_apps.json()
        assert len(my_apps) >= 1
        cloud_app = next((a for a in my_apps if a["id"] == "app-cloud-core"), None)
        assert cloud_app is not None

        resp_silvia_procs = client.get(
            "/api/surveys/my-processes?model_id=sample-easybank-ea",
            headers={"Authorization": f"Bearer {silvia_token}"}
        )
        assert resp_silvia_procs.status_code == 200
        my_procs = resp_silvia_procs.json()
        assert len(my_procs) >= 1

        # Cannot access aggregate TCO or create campaigns
        assert client.get(
            "/api/apm/tco-breakdown/sample-easybank-ea",
            headers={"Authorization": f"Bearer {silvia_token}"}
        ).status_code == 403

        assert client.post(
            "/api/surveys/campaigns",
            headers={"Authorization": f"Bearer {silvia_token}"},
            json={"model_id": "sample-easybank-ea", "title": "Unauthorized"}
        ).status_code == 403

        # 3. Targeted campaign creation and dispatch
        # Campaign A: target_owner_type="process_owner"
        cmp_proc = SurveyService.create_campaign(
            db=db,
            model_id="sample-easybank-ea",
            title="Process Performance Campaign 2026",
            description="Only for process owners",
            created_by=admin,
            target_owner_type="process_owner",
            target_element_ids=["proc-onboarding"]
        )
        assert cmp_proc.target_owner_type == "process_owner"

        silvia_surveys = SurveyService.get_user_surveys(db, silvia, model_id="sample-easybank-ea")
        assert any(s["campaign_id"] == cmp_proc.id for s in silvia_surveys)

        roberto_surveys = SurveyService.get_user_surveys(db, roberto, model_id="sample-easybank-ea")
        assert not any(s["campaign_id"] == cmp_proc.id for s in roberto_surveys)

        # Campaign B: target_owner_type="technical_owner"
        cmp_tech = SurveyService.create_campaign(
            db=db,
            model_id="sample-easybank-ea",
            title="Technical Debt & Obsolescence Campaign 2026",
            description="Only for technical application owners",
            created_by=admin,
            target_owner_type="technical_owner",
            target_element_ids=["app-cloud-core"]
        )
        assert cmp_tech.target_owner_type == "technical_owner"

        silvia_surveys_tech = SurveyService.get_user_surveys(db, silvia, model_id="sample-easybank-ea")
        assert not any(s["campaign_id"] == cmp_tech.id for s in silvia_surveys_tech)

        roberto_surveys_tech = SurveyService.get_user_surveys(db, roberto, model_id="sample-easybank-ea")
        assert any(s["campaign_id"] == cmp_tech.id for s in roberto_surveys_tech)

    finally:
        db.close()


def test_ownership_matrix_includes_business_processes():
    client = TestClient(app)
    db = SessionLocal()
    try:
        seed_default_rbac(db)
        seed_easybank_apm_portfolio(db)

        admin = db.query(User).filter(User.username == "admin").first()
        admin_token = create_access_token(admin)

        resp = client.get(
            "/api/surveys/ownership-matrix/sample-easybank-ea",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()

        # Check applications
        assert "applications" in data
        assert len(data["applications"]) > 0
        assert data["total_applications"] > 0

        # Check processes
        assert "processes" in data
        assert len(data["processes"]) > 0
        assert data["total_processes"] > 0

        # Check elements combined
        assert "elements" in data
        assert len(data["elements"]) == len(data["applications"]) + len(data["processes"])
        assert data["total_elements"] == data["total_applications"] + data["total_processes"]

        # Check that process ownership assignment works
        proc = data["processes"][0]
        assign_resp = client.post(
            f"/api/surveys/ownerships/{proc['id']}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "user_id": admin.id,
                "ownership_type": "process_owner",
                "notes": "Assigned test process owner"
            }
        )
        assert assign_resp.status_code == 200

        # Reload matrix and check assignment
        matrix_after = SurveyService.get_ownership_matrix(db, "sample-easybank-ea")
        assigned_p = next((p for p in matrix_after["processes"] if p["id"] == proc["id"]), None)
        assert assigned_p is not None
        assert assigned_p["has_owner"] is True
        assert any(o["user_id"] == admin.id and o["ownership_type"] == "process_owner" for o in assigned_p["owners"])

        # Remove ownership
        rem_resp = client.delete(
            f"/api/surveys/ownerships/{proc['id']}/{admin.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert rem_resp.status_code == 200
    finally:
        db.close()


def test_process_owner_survey_campaign_lifecycle():
    client = TestClient(app)
    db = SessionLocal()
    try:
        seed_default_rbac(db)
        seed_easybank_apm_portfolio(db)

        admin = db.query(User).filter(User.username == "admin").first()
        silvia = db.query(User).filter(User.username == "silvia_bizowner").first()
        assert admin is not None
        assert silvia is not None

        admin_token = create_access_token(admin)
        silvia_token = create_access_token(silvia)

        # 1. Silvia checks /api/surveys/my-processes
        my_proc_resp = client.get(
            "/api/surveys/my-processes?model_id=sample-easybank-ea",
            headers={"Authorization": f"Bearer {silvia_token}"}
        )
        assert my_proc_resp.status_code == 200
        procs = my_proc_resp.json()
        assert len(procs) > 0
        proc_ids = {p["id"] for p in procs}
        assert "proc-onboarding" in proc_ids or len(procs) >= 1

        # 2. Admin creates a campaign targeted specifically at process owners
        camp_resp = client.post(
            "/api/surveys/campaigns",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": "BPMN Process Optimization 2026",
                "description": "Aggiornamento metriche BPMN e SLA per Process Owners",
                "model_id": "sample-easybank-ea",
                "target_owner_type": "process_owner",
                "execution_mode": "approval_required",
                "sections": ["process_general", "process_performance", "process_automation", "process_governance"]
            }
        )
        assert camp_resp.status_code == 200
        camp_data = camp_resp.json()
        camp_id = camp_data["id"]

        # Check scopes were created for processes
        scopes = db.query(SurveyScope).filter(SurveyScope.campaign_id == camp_id).all()
        assert len(scopes) > 0

        # Check that Silvia has a pending survey task for one of the processes
        silvia_scope = next((s for s in scopes if s.assigned_user_id == silvia.id), None)
        assert silvia_scope is not None

        # 3. Silvia retrieves scope detail
        detail_resp = client.get(
            f"/api/surveys/scope/{silvia_scope.id}",
            headers={"Authorization": f"Bearer {silvia_token}"}
        )
        assert detail_resp.status_code == 200
        detail_data = detail_resp.json()
        assert detail_data["element_category"] == "process"
        assert "bpmn_cycle_time_minutes" in detail_data["response"]["initial_values"]

        # 4. Silvia submits answers with updated process parameters
        submit_resp = client.post(
            f"/api/surveys/scope/{silvia_scope.id}/submit",
            headers={"Authorization": f"Bearer {silvia_token}"},
            json={
                "answers": {
                    "name": "Onboarding Digitale Clienti (STP)",
                    "documentation": "Processo end-to-end fully automated con SPID/CIE e verifica AML automatizzata",
                    "process_criticality": "Mission Critical",
                    "bpmn_automation_level": "Full Automated",
                    "bpmn_cycle_time_minutes": 15.0,
                    "bpmn_execution_volume_month": 4500,
                    "bpmn_error_rework_rate_pct": 1.2,
                    "sla_target": "RTO: 1 ora, Completamento STP < 30 min",
                    "regulatory_compliance": "DORA Core ICT Service",
                    "process_owner": "silvia.bizowner@easybank.it"
                },
                "notes": "Ottimizzazione flusso con SPID/CIE completata con successo"
            }
        )
        assert submit_resp.status_code == 200

        # Verify survey status is submitted
        db.refresh(silvia_scope)
        assert silvia_scope.status == "submitted"

        # 5. Admin reviews and approves the survey
        review_resp = client.post(
            f"/api/surveys/scope/{silvia_scope.id}/approve",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "feedback": "Ottimo lavoro, metriche conformi a DORA"
            }
        )
        assert review_resp.status_code == 200

        # 6. Verify changes merged directly into ArchimateElement in DB
        db.expire_all()
        target_el = db.query(ArchimateElement).filter(ArchimateElement.id == silvia_scope.element_id).first()
        assert target_el is not None
        assert target_el.name == "Onboarding Digitale Clienti (STP)"
        assert "SPID/CIE" in target_el.documentation
        assert target_el.properties.get("bpmn_cycle_time_minutes") == 15.0
        assert target_el.properties.get("bpmn_automation_level") == "Full Automated"
        assert target_el.properties.get("process_criticality") == "Mission Critical"
        assert target_el.properties.get("regulatory_compliance") == "DORA Core ICT Service"

    finally:
        db.close()


def test_search_users_autocomplete_api():
    client = TestClient(app)
    db = SessionLocal()
    try:
        seed_default_rbac(db)

        silvia = db.query(User).filter(User.username == "silvia_bizowner").first()
        assert silvia is not None
        silvia_token = create_access_token(silvia)

        # 1. Search for 'silvia'
        resp_silvia = client.get(
            "/api/rbac/users/search?q=silvia",
            headers={"Authorization": f"Bearer {silvia_token}"}
        )
        assert resp_silvia.status_code == 200
        data_silvia = resp_silvia.json()
        assert len(data_silvia) >= 1
        assert any("silvia" in u["username"].lower() or "silvia" in u["full_name"].lower() for u in data_silvia)

        # 2. Search for 'giorgio'
        resp_gio = client.get(
            "/api/rbac/users/search?q=giorgio",
            headers={"Authorization": f"Bearer {silvia_token}"}
        )
        assert resp_gio.status_code == 200
        data_gio = resp_gio.json()
        assert len(data_gio) >= 1
        assert any("giorgio" in u["username"].lower() or "giorgio" in u["full_name"].lower() for u in data_gio)

        # 3. Search without query returns default user list
        resp_all = client.get(
            "/api/rbac/users/search?limit=10",
            headers={"Authorization": f"Bearer {silvia_token}"}
        )
        assert resp_all.status_code == 200
        assert len(resp_all.json()) >= 3

    finally:
        db.close()





