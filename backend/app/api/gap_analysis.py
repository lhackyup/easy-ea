from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from app.core.database import get_db
from app.models.archimate import User
from app.api.deps import get_current_user
from app.services.gap_analysis_service import GapAnalysisService

router = APIRouter(prefix="/gap-analysis", tags=["As-Is vs To-Be Gap Analysis"])


@router.get("/{model_id}")
def get_gap_analysis(
    model_id: str,
    compare_model_id: Optional[str] = Query(None, description="Optional target workspace ID to compare against for cross-library gap analysis"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns full As-Is vs To-Be Gap Analysis matrix, delta categorization
    (Retained, Added, Modified, Retired), financial delta, and work package coverage.
    """
    return GapAnalysisService.analyze_gap_matrix(db, model_id, compare_model_id=compare_model_id)


@router.get("/{model_id}/summary")
def get_gap_analysis_summary(
    model_id: str,
    compare_model_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns summary KPIs for the Gap Analysis (Retained, Added, Modified, Retired, Financial Delta).
    """
    analysis = GapAnalysisService.analyze_gap_matrix(db, model_id, compare_model_id=compare_model_id)
    return {
        "model_id": model_id,
        "mode": analysis.get("mode"),
        "metrics": analysis.get("metrics", {})
    }
