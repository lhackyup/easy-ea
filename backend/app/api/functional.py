from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.core.database import get_db
from app.models.archimate import User
from app.api.deps import get_current_user
from app.services.functional_analysis_service import FunctionalAnalysisService

router = APIRouter(prefix="/functional", tags=["Functional Architecture & Gap Analysis"])

@router.get("/analysis/{model_id}")
def get_functional_analysis(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Computes and returns comprehensive functional architecture analytics:
    - Hierarchical functional tree (Composition/Aggregation) with variable depth (L0, L1, L2...)
    - Leaf-level evaluation of Functional Gaps (0 apps), Optimal Coverage (1 app), and Overlapping/Redundancy (>=2 apps)
    - Roll-up metrics (Coverage %, Redundancy %, Potential Savings) for parent branches
    - Prioritized rationalization recommendations and gap alerts
    """
    return FunctionalAnalysisService.analyze_functional_architecture(db, model_id)
