from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from app.core.database import get_db
from app.models.archimate import User
from app.api.deps import get_current_user
from app.services.resilience_service import ResilienceService

router = APIRouter(prefix="/resilience", tags=["Operational Resilience & SLA"])


@router.get("/analysis/{model_id}")
def get_resilience_analysis(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns full DORA, RTO/RPO, and SLA Mismatch Analysis across Business,
    Application, and Technology layers for the specified model workspace.
    """
    return ResilienceService.analyze_resilience_mismatches(db, model_id)


@router.get("/summary/{model_id}")
def get_resilience_summary(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns high-level compliance KPI metrics for operational resilience.
    """
    analysis = ResilienceService.analyze_resilience_mismatches(db, model_id)
    return {
        "model_id": model_id,
        "metrics": analysis.get("metrics", {})
    }
