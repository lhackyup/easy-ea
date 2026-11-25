from fastapi import APIRouter, Depends, Query, Header
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from app.core.database import get_db
from app.models.archimate import User
from app.api.deps import get_current_user, require_library_permission
from app.services.process_service import ProcessService
from app.services.rbac_service import can_user_view_financials

router = APIRouter(prefix="/processes", tags=["Business Processes & Lineage"])

def _resolve_lang(lang: Optional[str], accept_language: Optional[str]) -> str:
    if lang:
        return "en" if lang.lower().startswith("en") else "it"
    if accept_language and accept_language.lower().startswith("en"):
        return "en"
    return "it"

@router.get("/catalog/{model_id}")
def get_process_catalog(
    model_id: str,
    lang: Optional[str] = Query(None, description="Report language: 'it' or 'en'"),
    accept_language: Optional[str] = Header(None, alias="Accept-Language"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns full business process catalog with stakeholder assignments,
    supporting application components, technology infrastructure, and embedded risk analysis.
    """
    clean_lang = _resolve_lang(lang, accept_language)
    return ProcessService.get_process_catalog(db, model_id, lang=clean_lang)

@router.get("/impact/{model_id}/{element_id}")
def simulate_impact(
    model_id: str,
    element_id: str,
    mode: str = Query("failure", description="Simulation mode: 'failure' (outage) or 'change' (decommission/modification)"),
    max_hops: int = Query(10, ge=1, le=20, description="Maximum traversal hop distance"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simulates multi-hop ripple / downstream business impact when a specific element
    (e.g., application, microservice or server) experiences an outage or change.
    Returns hop distance, propagation paths, and layer-by-layer blast radius.
    """
    return ProcessService.simulate_impact(db, model_id, element_id, mode=mode, max_hops=max_hops)

@router.get("/risks/{model_id}")
def get_architectural_risks(
    model_id: str,
    lang: Optional[str] = Query(None, description="Report language: 'it' or 'en'"),
    accept_language: Optional[str] = Header(None, alias="Accept-Language"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Performs an architectural audit on the model to identify Single Points of Failure (SPOFs),
    Lifecycle incompatibilities (Mission-Critical processes relying on Eliminate/Phase-out apps),
    and SLA / criticality mismatches.
    """
    clean_lang = _resolve_lang(lang, accept_language)
    return ProcessService.detect_architectural_risks(db, model_id, lang=clean_lang)

@router.get("/tco/{model_id}")
def get_process_tco(
    model_id: str,
    lang: Optional[str] = Query(None, description="Report language: 'it' or 'en'"),
    accept_language: Optional[str] = Header(None, alias="Accept-Language"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Calculates IT Cost Allocation and TCO for business processes based on
    enabling application components and cloud infrastructure nodes.
    Financial metrics are redacted for users without C-Level/Admin access.
    """
    require_library_permission(db, current_user, "read_repository", model_id)
    clean_lang = _resolve_lang(lang, accept_language)
    data = ProcessService.calculate_process_tco(db, model_id, lang=clean_lang)

    if not can_user_view_financials(db, current_user):
        if "summary" in data:
            data["summary"]["total_allocated_cost"] = None
            data["summary"]["total_gross_cost"] = None
            data["summary"]["top_spend_process"] = None
            data["summary"]["average_process_cost"] = None
            if "cost_by_criticality" in data["summary"]:
                data["summary"]["cost_by_criticality"] = {k: None for k in data["summary"]["cost_by_criticality"]}
            data["summary"]["_financials_redacted"] = True

        for proc in data.get("processes", []):
            proc["allocated_cost"] = None
            proc["gross_cost"] = None
            proc["cost_percentage"] = None
            proc["_financials_redacted"] = True
            for app in proc.get("supporting_applications", []):
                app["allocated_cost"] = None
                app["annual_cost"] = None
                app["_financials_redacted"] = True

    return data

@router.get("/automation/{model_id}")
def get_process_automation(
    model_id: str,
    lang: Optional[str] = Query(None, description="Report language: 'it' or 'en'"),
    accept_language: Optional[str] = Header(None, alias="Accept-Language"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Calculates Digital Maturity, Task Automation Index, Straight-Through Processing (STP) rate,
    and identifies high-priority RPA & AI Agent candidates across BPMN tasks.
    """
    clean_lang = _resolve_lang(lang, accept_language)
    return ProcessService.calculate_process_automation(db, model_id, lang=clean_lang)
