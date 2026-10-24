from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.core.database import get_db
from app.models.archimate import User
from app.api.deps import get_current_user
from app.services.process_service import ProcessService

router = APIRouter(prefix="/processes", tags=["Business Processes & Lineage"])

@router.get("/catalog/{model_id}")
def get_process_catalog(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns full business process catalog with stakeholder assignments,
    supporting application components, technology infrastructure, and embedded risk analysis.
    """
    return ProcessService.get_process_catalog(db, model_id)

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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Performs an architectural audit on the model to identify Single Points of Failure (SPOFs),
    Lifecycle incompatibilities (Mission-Critical processes relying on Eliminate/Phase-out apps),
    and SLA / criticality mismatches.
    """
    return ProcessService.detect_architectural_risks(db, model_id)
