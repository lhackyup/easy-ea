from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.services.apm_service import APMService

router = APIRouter(prefix="/apm", tags=["Application Portfolio Management"])

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
def get_apm_portfolio(model_id: str, db: Session = Depends(get_db)):
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
    db: Session = Depends(get_db)
):
    """Update business attributes (fit scores, cost, owners, lifecycle) for an application."""
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
