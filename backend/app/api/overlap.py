from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.core.database import get_db
from app.services.overlap_service import OverlapService

router = APIRouter(prefix="/overlap", tags=["Functional Overlap & Rationalization"])

@router.get("/matrix/{model_id}")
def get_overlap_matrix(model_id: str, db: Session = Depends(get_db)):
    """
    Computes and returns:
    - 2D Matrix of Business Capability/Function vs Applications
    - Redundancy Score (% of capabilities with multiple apps)
    - Identified Overlap Clusters & Rationalization Recommendations
    - Estimated Potential Cost Waste / Savings Opportunity
    """
    return OverlapService.analyze_functional_overlap(db, model_id)
