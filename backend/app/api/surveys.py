from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.archimate import User, ArchimateElement
from app.models.surveys import SurveyScope
from app.api.deps import get_current_user, require_library_permission
from app.services.survey_service import SurveyService
from app.services.rbac_service import check_user_permission, can_user_view_financials

router = APIRouter(prefix="/surveys", tags=["Surveys & Crowdsourcing"])


class CreateCampaignPayload(BaseModel):
    model_id: str
    title: str
    description: Optional[str] = None
    mode: str = "approval_required" # approval_required | direct_apply
    target_owner_type: Optional[str] = "all" # all | app_owner | process_owner
    deadline: Optional[datetime] = None
    sections: Optional[List[str]] = None
    custom_questions: Optional[List[Dict[str, Any]]] = None
    target_element_ids: Optional[List[str]] = None


class SubmitSurveyPayload(BaseModel):
    answers: Dict[str, Any]
    notes: Optional[str] = None


class ReviewSurveyPayload(BaseModel):
    feedback: Optional[str] = None


class AssignOwnerPayload(BaseModel):
    user_id: str
    ownership_type: str = "app_owner" # app_owner | process_owner | process_manager | delegate
    notes: Optional[str] = None


@router.get("/campaigns/{model_id}")
def list_campaigns(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all survey campaigns for the given architectural workspace. Restricted to Architects and Admins."""
    require_library_permission(db, current_user, "manage_surveys", model_id)
    return SurveyService.list_campaigns(db, model_id=model_id)


@router.post("/campaigns")
def create_campaign(
    payload: CreateCampaignPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new crowdsourcing survey campaign. Requires Architect or Admin privileges."""
    require_library_permission(db, current_user, "manage_surveys", payload.model_id)
    campaign = SurveyService.create_campaign(
        db=db,
        model_id=payload.model_id,
        title=payload.title,
        description=payload.description,
        created_by=current_user,
        mode=payload.mode,
        target_owner_type=payload.target_owner_type or "all",
        deadline=payload.deadline,
        sections=payload.sections,
        custom_questions=payload.custom_questions,
        target_element_ids=payload.target_element_ids
    )
    return {"id": campaign.id, "title": campaign.title, "status": campaign.status, "mode": campaign.mode, "target_owner_type": campaign.target_owner_type}


@router.get("/campaigns/detail/{campaign_id}")
def get_campaign_detail(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves detailed status and scopes of a survey campaign. Restricted to Architects and Admins."""
    detail = SurveyService.get_campaign_detail(db, campaign_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Campaign not found")
    require_library_permission(db, current_user, "manage_surveys", detail["model_id"])
    return detail


@router.get("/my-surveys")
def get_my_surveys(
    model_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns survey tasks assigned to the current application owner. Requires view_owner_portal permission."""
    if model_id:
        require_library_permission(db, current_user, "view_owner_portal", model_id)
    else:
        roles = {a.role for a in current_user.role_assignments}
        if not any(r in {"admin", "app_owner", "process_owner", "architect", "lead_architect"} for r in roles):
            raise HTTPException(status_code=403, detail="Access to Owner portal is restricted.")
    return SurveyService.get_user_surveys(db, current_user, model_id=model_id)


@router.get("/my-applications")
def get_my_applications(
    model_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns all applications owned by the current user with health and completeness metrics."""
    if model_id:
        require_library_permission(db, current_user, "view_owner_portal", model_id)
    else:
        roles = {a.role for a in current_user.role_assignments}
        if not any(r in {"admin", "app_owner", "process_owner", "architect", "lead_architect"} for r in roles):
            raise HTTPException(status_code=403, detail="Access to Owner portal is restricted.")

    apps = SurveyService.get_user_owned_applications(db, current_user, model_id=model_id)
    # App owner can view costs of their own apps, but if user has no right, redact
    for app in apps:
        can_view_fin = can_user_view_financials(db, current_user, element_id=app["id"])
        if not can_view_fin:
            app["annual_cost"] = None
    return apps


@router.get("/my-processes")
def get_my_processes(
    model_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns all business processes owned by the current user with automation and completeness metrics."""
    if model_id:
        require_library_permission(db, current_user, "view_owner_portal", model_id)
    else:
        roles = {a.role for a in current_user.role_assignments}
        if not any(r in {"admin", "app_owner", "process_owner", "architect", "lead_architect"} for r in roles):
            raise HTTPException(status_code=403, detail="Access to Owner portal is restricted.")

    return SurveyService.get_user_owned_processes(db, current_user, model_id=model_id)


@router.get("/scope/{scope_id}")
def get_survey_scope(
    scope_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves the questionnaire and current application snapshot for an assigned survey scope."""
    scope = db.query(SurveyScope).filter(SurveyScope.id == scope_id).first()
    if not scope:
        raise HTTPException(status_code=404, detail="Survey scope not found")

    perm = check_user_permission(db, current_user.id, "manage_surveys", scope.campaign.model_id)
    is_assigned = (scope.assigned_user_id == current_user.id) or (
        scope.assigned_email and current_user.email and scope.assigned_email.strip().lower() == current_user.email.strip().lower()
    )
    if not perm.get("allowed") and not is_assigned:
        raise HTTPException(status_code=403, detail="Access denied: You are not assigned to this survey.")

    data = SurveyService.get_survey_scope_details(db, scope_id, current_user)
    if not data:
        raise HTTPException(status_code=404, detail="Survey scope details not found")

    # If the user is not allowed to view financial data for this app, redact financial keys from answers and snapshot
    can_fin = can_user_view_financials(db, current_user, element_id=data["element_id"])
    if not can_fin:
        fin_fields = [
            "annual_cost", "cost_software_licenses", "cost_cloud_infrastructure",
            "cost_vendor_maintenance", "cost_internal_labor"
        ]
        resp = data.get("response", {})
        init_vals = resp.get("initial_values", {})
        answers = resp.get("answers", {})
        for f in fin_fields:
            if f in init_vals:
                init_vals[f] = None
            if f in answers:
                answers[f] = None

    return data


@router.post("/scope/{scope_id}/submit")
def submit_survey(
    scope_id: str,
    payload: SubmitSurveyPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submits the questionnaire answers. Directly applies or requests architect review based on campaign mode."""
    scope = db.query(SurveyScope).filter(SurveyScope.id == scope_id).first()
    if not scope:
        raise HTTPException(status_code=404, detail="Survey scope not found")

    perm = check_user_permission(db, current_user.id, "manage_surveys", scope.campaign.model_id)
    is_assigned = (scope.assigned_user_id == current_user.id) or (
        scope.assigned_email and current_user.email and scope.assigned_email.strip().lower() == current_user.email.strip().lower()
    )
    if not perm.get("allowed") and not is_assigned:
        raise HTTPException(status_code=403, detail="Access denied: You are not authorized to submit this survey.")

    try:
        res = SurveyService.submit_survey_response(
            db=db,
            scope_id=scope_id,
            user=current_user,
            answers=payload.answers,
            notes=payload.notes
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/scope/{scope_id}/approve")
def approve_survey(
    scope_id: str,
    payload: ReviewSurveyPayload = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approves a submitted survey and applies the changes to the live architecture model. Restricted to Architects and Admins."""
    scope = db.query(SurveyScope).filter(SurveyScope.id == scope_id).first()
    if not scope:
        raise HTTPException(status_code=404, detail="Survey scope not found")
    require_library_permission(db, current_user, "manage_surveys", scope.campaign.model_id)

    try:
        return SurveyService.approve_survey_response(
            db=db,
            scope_id=scope_id,
            reviewer_user=current_user,
            feedback=payload.feedback
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/scope/{scope_id}/reject")
def reject_survey(
    scope_id: str,
    payload: ReviewSurveyPayload = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Rejects a submitted survey and sends it back to the application owner for revisions. Restricted to Architects and Admins."""
    scope = db.query(SurveyScope).filter(SurveyScope.id == scope_id).first()
    if not scope:
        raise HTTPException(status_code=404, detail="Survey scope not found")
    require_library_permission(db, current_user, "manage_surveys", scope.campaign.model_id)

    try:
        return SurveyService.reject_survey_response(
            db=db,
            scope_id=scope_id,
            reviewer_user=current_user,
            feedback=payload.feedback or "Rifiutato: si prega di verificare i dati inseriti."
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/ownership-matrix/{model_id}")
def get_ownership_matrix(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns the application ownership matrix and coverage metrics for a workspace."""
    require_library_permission(db, current_user, "read_repository", model_id)
    return SurveyService.get_ownership_matrix(db, model_id)


@router.get("/ownerships/{element_id}")
def get_element_owners(
    element_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns the list of assigned owners for an application element."""
    el = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
    if not el:
        raise HTTPException(status_code=404, detail="Element not found")
    require_library_permission(db, current_user, "read_repository", el.model_id)
    return SurveyService.get_application_owners(db, element_id)


@router.post("/ownerships/{element_id}")
def assign_element_owner(
    element_id: str,
    payload: AssignOwnerPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assigns an application owner. Requires Architect or Admin privileges."""
    el = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
    if not el:
        raise HTTPException(status_code=404, detail="Element not found")
    require_library_permission(db, current_user, "edit_element", el.model_id)

    own = SurveyService.assign_application_owner(
        db=db,
        element_id=element_id,
        user_id=payload.user_id,
        ownership_type=payload.ownership_type,
        notes=payload.notes
    )
    return {"id": own.id, "element_id": own.element_id, "user_id": own.user_id, "ownership_type": own.ownership_type}


@router.delete("/ownerships/{element_id}/{user_id}")
def remove_element_owner(
    element_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Removes an application owner assignment."""
    el = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
    if not el:
        raise HTTPException(status_code=404, detail="Element not found")
    require_library_permission(db, current_user, "edit_element", el.model_id)

    success = SurveyService.remove_application_owner(db, element_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Ownership relation not found")
    return {"success": True}
