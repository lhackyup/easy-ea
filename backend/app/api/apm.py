from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.models.archimate import ArchimateElement, User
from app.api.deps import get_current_user, require_library_permission
from app.services.apm_service import APMService
from app.services.tech_risk_service import TechRiskService

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
    business_criticality: Optional[str] = None
    lifecycle_status: Optional[str] = None
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
    """
    return APMService.get_portfolio_summary(db, model_id)

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
    require_library_permission(db, current_user, "edit_apm_attributes", el.model_id)
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    apm = APMService.update_app_attributes(db, element_id, update_data)
    return {
        "element_id": apm.element_id,
        "business_fit": apm.business_fit,
        "technical_fit": apm.technical_fit,
        "time_quadrant": apm.time_quadrant,
        "annual_cost": apm.annual_cost,
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
    return TechRiskService.analyze_tech_risk(db, model_id)

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

