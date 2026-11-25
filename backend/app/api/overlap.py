from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.core.database import get_db
from app.models.archimate import User
from app.api.deps import get_current_user, require_library_permission
from app.services.overlap_service import OverlapService
from app.services.rbac_service import can_user_view_financials

router = APIRouter(prefix="/overlap", tags=["Functional Overlap & Rationalization"])

@router.get("/matrix/{model_id}")
def get_overlap_matrix(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Computes and returns:
    - 2D Matrix of Business Capability/Function vs Applications
    - Redundancy Score (% of capabilities with multiple apps)
    - Identified Overlap Clusters & Rationalization Recommendations
    - Estimated Potential Cost Waste / Savings Opportunity (redacted for non-C-Level)
    """
    require_library_permission(db, current_user, "read_repository", model_id)
    data = OverlapService.analyze_functional_overlap(db, model_id)

    if not can_user_view_financials(db, current_user):
        data["potential_savings_opportunity"] = None
        data["_financials_redacted"] = True
        for cluster in data.get("redundancy_clusters", []):
            cluster["potential_savings"] = None
            if "annual_waste_estimate" in cluster:
                cluster["annual_waste_estimate"] = None
        for col in data.get("applications_columns", []):
            col["annual_cost"] = None
        for row in data.get("capability_rows", []):
            if "potential_savings" in row:
                row["potential_savings"] = None

    return data
