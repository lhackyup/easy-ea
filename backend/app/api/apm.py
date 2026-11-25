from fastapi import APIRouter, Depends, HTTPException, Body, Query, Response
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.models.archimate import ArchimateElement, ArchimateRelationship, User, ModelWorkspace
from app.api.deps import get_current_user, require_library_permission
from app.services.apm_service import APMService
from app.services.tech_risk_service import TechRiskService
from app.services.apm_report_service import APMReportService
from app.services.rbac_service import can_user_view_financials, check_user_permission

router = APIRouter(prefix="/apm", tags=["Application Portfolio Management"])

class TechLifecycleUpdate(BaseModel):
    vendor: Optional[str] = None
    version: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    eol_date: Optional[str] = None
    eoes_date: Optional[str] = None
    cve_risk: Optional[str] = None

class AppAttributeUpdate(BaseModel):
    business_fit: Optional[int] = None
    technical_fit: Optional[int] = None
    time_quadrant: Optional[str] = None
    annual_cost: Optional[float] = None
    cost_software_licenses: Optional[float] = None
    cost_cloud_infrastructure: Optional[float] = None
    cost_vendor_maintenance: Optional[float] = None
    cost_internal_labor: Optional[float] = None
    active_users: Optional[int] = None
    capex_ratio: Optional[float] = None
    cost_center: Optional[str] = None
    cost_type: Optional[str] = None
    business_criticality: Optional[str] = None
    lifecycle_status: Optional[str] = None
    live_date: Optional[str] = None
    retirement_date: Optional[str] = None
    business_owner: Optional[str] = None
    technical_owner: Optional[str] = None
    vendor: Optional[str] = None
    hosting_type: Optional[str] = None
    data_classification: Optional[str] = None
    sla_level: Optional[str] = None
    in_apm_scope: Optional[bool] = None
    notes: Optional[str] = None

@router.get("/portfolio/{model_id}")
def get_apm_portfolio(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns full executive APM metrics:
    - TIME quadrant distributions (counts & costs)
    - Total TCO / annual cost
    - Criticality & Lifecycle status breakdowns
    - List of all applications with business metrics
    Financial fields are redacted for users without C-Level/Admin access,
    except for applications directly owned by an Application Owner.
    """
    require_library_permission(db, current_user, "read_repository", model_id)
    summary = APMService.get_portfolio_summary(db, model_id)
    can_global_fin = can_user_view_financials(db, current_user)

    if not can_global_fin:
        summary["total_annual_cost"] = None
        if "time_cost_distribution" in summary:
            summary["time_cost_distribution"] = {k: None for k in summary["time_cost_distribution"]}
        if "top_vendors_by_cost" in summary:
            summary["top_vendors_by_cost"] = [{"vendor": item["vendor"], "cost": None} for item in summary["top_vendors_by_cost"]]
        summary["_financials_redacted"] = True

        for app in summary.get("applications", []):
            can_app_fin = can_user_view_financials(db, current_user, element_id=app.get("id"))
            if not can_app_fin:
                app["cost"] = None
                app["annual_cost"] = None
                app["cost_software_licenses"] = None
                app["cost_cloud_infrastructure"] = None
                app["cost_vendor_maintenance"] = None
                app["cost_internal_labor"] = None
                app["cost_per_user"] = None
                app["capex_ratio"] = None
                app["_financials_redacted"] = True

    return summary

@router.get("/tco-breakdown/{model_id}")
def get_tco_breakdown(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns full analytic TCO financial metrics.
    Restricted to C-Level and Admin roles.
    """
    require_library_permission(db, current_user, "read_repository", model_id)
    if not can_user_view_financials(db, current_user):
        raise HTTPException(
            status_code=403,
            detail="L'accesso al TCO Breakdown finanziario è riservato esclusivamente ai ruoli C-Level e Amministratore."
        )
    return APMService.get_tco_breakdown(db, model_id)

@router.get("/lifecycle/{model_id}")
def get_lifecycle_analysis(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns full Application Lifecycle & Decommissioning metrics:
    - Counts and costs per lifecycle phase (Plan, Phase In, Live, Phase Out, Retired)
    - TCO Takeout Savings from decommissioning sunset applications
    - Retirement milestones (<6m, <12m, <24m)
    - Decommissioning readiness and architectural blockers (active serving/flow relations)
    - Chronological multi-year timeline dataset
    """
    require_library_permission(db, current_user, "read_repository", model_id)
    res = APMService.get_lifecycle_analysis(db, model_id)
    if not can_user_view_financials(db, current_user):
        if "summary" in res:
            res["summary"]["total_takeout_savings"] = None
            res["summary"]["takeout_savings"] = None
            if "costs_by_status" in res["summary"]:
                res["summary"]["costs_by_status"] = {k: None for k in res["summary"]["costs_by_status"]}
            res["summary"]["_financials_redacted"] = True

        for app in res.get("applications", []):
            can_app_fin = can_user_view_financials(db, current_user, element_id=app.get("id"))
            if not can_app_fin:
                app["annual_cost"] = None
                app["cost"] = None
                app["_financials_redacted"] = True

        for milestone_list in res.get("milestones", {}).values():
            if isinstance(milestone_list, list):
                for app in milestone_list:
                    can_app_fin = can_user_view_financials(db, current_user, element_id=app.get("id"))
                    if not can_app_fin:
                        app["annual_cost"] = None
                        app["cost"] = None
                        app["_financials_redacted"] = True

        for app in res.get("timeline_dataset", []):
            can_app_fin = can_user_view_financials(db, current_user, element_id=app.get("id"))
            if not can_app_fin:
                app["annual_cost"] = None
                app["cost"] = None
                app["_financials_redacted"] = True
    return res

@router.put("/applications/{element_id}")
def update_application_apm(
    element_id: str,
    payload: AppAttributeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update business attributes (fit scores, cost, owners, lifecycle) for an application."""
    el = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
    if not el:
        raise HTTPException(status_code=404, detail="Application element not found")
    
    perm = check_user_permission(
        db,
        user_id=current_user.id,
        action="edit_apm_attributes",
        target_model_id=el.model_id,
        element_id=el.id
    )
    if not perm.get("allowed"):
        raise HTTPException(
            status_code=403,
            detail=perm.get("reason", "Permission denied for this application.")
        )

    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    
    # If user cannot view/edit financials for this app, prevent altering cost fields
    if not can_user_view_financials(db, current_user, element_id=el.id):
        for f in ["annual_cost", "cost_software_licenses", "cost_cloud_infrastructure", "cost_vendor_maintenance", "cost_internal_labor", "capex_ratio"]:
            update_data.pop(f, None)

    apm = APMService.update_app_attributes(db, element_id, update_data)
    can_fin = can_user_view_financials(db, current_user, element_id=el.id)
    return {
        "element_id": apm.element_id,
        "business_fit": apm.business_fit,
        "technical_fit": apm.technical_fit,
        "time_quadrant": apm.time_quadrant,
        "annual_cost": apm.annual_cost if can_fin else None,
        "business_criticality": apm.business_criticality,
        "lifecycle_status": apm.lifecycle_status,
        "business_owner": apm.business_owner,
        "vendor": apm.vendor,
        "hosting_type": apm.hosting_type,
        "in_apm_scope": apm.in_apm_scope
    }

@router.get("/tech-risk/{model_id}")
def get_tech_risk_analysis(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns full Technology Obsolescence & Risk Radar metrics:
    - Overall high/critical risk percentages
    - DORA / regulatory compliance violations for mission critical apps
    - Business Criticality vs Technology Risk 4x4 matrix
    - EOL Horizon Timeline (expired, <6mo, <12mo, >24mo)
    - Blast Radius per technology component
    - Detailed list of applications with connected technology stack
    """
    require_library_permission(db, current_user, "read_repository", model_id)
    data = TechRiskService.analyze_tech_risk(db, model_id)

    can_view_all_fin = can_user_view_financials(db, current_user)
    if not can_view_all_fin:
        for alert in data.get("dora_compliance_alerts", []):
            can_app_fin = can_user_view_financials(db, current_user, element_id=alert.get("application_id"))
            if not can_app_fin:
                alert["annual_cost"] = None
                alert["_financials_redacted"] = True

        for app in data.get("applications", []):
            can_app_fin = can_user_view_financials(db, current_user, element_id=app.get("id"))
            if not can_app_fin:
                app["annual_cost"] = None
                app["_financials_redacted"] = True

        for tech in data.get("technology_blast_radius", []):
            tech["total_impacted_annual_cost"] = None
            tech["_financials_redacted"] = True
            for iapp in tech.get("impacted_applications", []):
                can_app_fin = can_user_view_financials(db, current_user, element_id=iapp.get("id"))
                if not can_app_fin:
                    iapp["annual_cost"] = None
                    iapp["_financials_redacted"] = True

        data["_financials_redacted"] = True

    return data

@router.put("/technologies/{element_id}")
def update_technology_lifecycle(
    element_id: str,
    payload: TechLifecycleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update technology lifecycle attributes (vendor, version, EOL/EOS dates, status, CVE risk)."""
    el = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
    if not el:
        raise HTTPException(status_code=404, detail="Technology element not found")
    require_library_permission(db, current_user, "edit_apm_attributes", el.model_id)
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    try:
        return TechRiskService.update_technology_lifecycle(db, element_id, update_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

class InterfaceUpdatePayload(BaseModel):
    name: Optional[str] = None
    documentation: Optional[str] = None
    protocol: Optional[str] = None
    pattern: Optional[str] = None
    data_format: Optional[str] = None
    criticality: Optional[str] = None
    frequency: Optional[str] = None
    security_auth: Optional[str] = None
    data_classification: Optional[str] = None
    status: Optional[str] = None

class InterfaceCreatePayload(BaseModel):
    name: str
    source_id: str
    target_id: str
    documentation: Optional[str] = ""
    protocol: Optional[str] = "REST API / JSON"
    pattern: Optional[str] = "Synchronous"
    data_format: Optional[str] = "JSON Payload"
    criticality: Optional[str] = "Business Critical"
    frequency: Optional[str] = "Real-time"
    security_auth: Optional[str] = "OAuth 2.0 / JWT"
    data_classification: Optional[str] = "Internal"
    status: Optional[str] = "Live"

@router.get("/interfaces/{model_id}")
def get_interface_inventory(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns full Interface & Data Flow Inventory:
    - Summary metrics (totals, protocol distribution, integration patterns, top connected apps)
    - Detailed list of all application interfaces and inter-application flows
    - Diagram usage / schema traceability
    """
    return APMService.get_interface_inventory(db, model_id)

@router.put("/interfaces/{interface_id}")
def update_interface_attributes(
    interface_id: str,
    payload: InterfaceUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update metadata and properties for an interface or flow."""
    rel = db.query(ArchimateRelationship).filter(ArchimateRelationship.id == interface_id).first()
    model_id = rel.model_id if rel else None
    if not model_id:
        el = db.query(ArchimateElement).filter(ArchimateElement.id == interface_id).first()
        model_id = el.model_id if el else None
    if not model_id:
        raise HTTPException(status_code=404, detail="Interface not found")
    require_library_permission(db, current_user, "edit_apm_attributes", model_id)
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    try:
        return APMService.update_interface(db, interface_id, update_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/interfaces/{model_id}")
def create_interface(
    model_id: str,
    payload: InterfaceCreatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new inter-application flow interface in the model."""
    require_library_permission(db, current_user, "edit_apm_attributes", model_id)
    try:
        return APMService.create_interface(db, model_id, payload.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/export/docx/{model_id}")
def export_apm_docx_report(
    model_id: str,
    lang: str = Query("it", description="Report language: 'it' or 'en'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Response:
    """
    Generates and downloads a comprehensive Word (.docx) APM assessment document:
    - Executive summary and KPI scorecards
    - Gartner TIME matrix & rationalization priorities
    - Technological risk & DORA / NIS2 compliance
    - Financial analysis & TCO breakdown
    - Interface & flow inventory
    - Lifecycle roadmap & decommissioning plan
    - Full Master Inventory Table (Landscape)
    """
    require_library_permission(db, current_user, "read_repository", model_id)
    if not can_user_view_financials(db, current_user):
        raise HTTPException(
            status_code=403,
            detail="Il download del documento strategico APM con TCO e dettagli finanziari è riservato ai ruoli C-Level e Amministratore."
        )
    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    model_name = model.name if model else model_id

    portfolio = APMService.get_portfolio_summary(db, model_id)
    tco = APMService.get_tco_breakdown(db, model_id)
    lifecycle = APMService.get_lifecycle_analysis(db, model_id)
    interfaces = APMService.get_interface_inventory(db, model_id)
    tech_risk = TechRiskService.analyze_tech_risk(db, model_id)

    clean_lang = "en" if lang.lower().startswith("en") else "it"
    docx_stream = APMReportService.generate_docx_report(
        portfolio, tco, lifecycle, interfaces, tech_risk,
        model_name=model_name,
        lang=clean_lang
    )

    safe_name = "".join(c for c in model_name if c.isalnum() or c in (" ", "-", "_")).strip().replace(" ", "_")
    filename = f"APM_Strategic_Assessment_{safe_name}.docx"

    return Response(
        content=docx_stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


