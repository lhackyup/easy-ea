from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.core.database import get_db
from app.services.process_service import ProcessService

router = APIRouter(prefix="/processes", tags=["Business Processes & Lineage"])

@router.get("/catalog/{model_id}")
def get_process_catalog(model_id: str, db: Session = Depends(get_db)):
    """
    Returns full business process catalog with stakeholder assignments,
    supporting application components, and technology infrastructure.
    """
    return ProcessService.get_process_catalog(db, model_id)

@router.get("/impact/{model_id}/{element_id}")
def simulate_impact(model_id: str, element_id: str, db: Session = Depends(get_db)):
    """
    Simulates ripple / downstream business impact when a specific element
    (e.g., application or server) is decommissioned or experiences an outage.
    """
    return ProcessService.simulate_impact(db, model_id, element_id)
