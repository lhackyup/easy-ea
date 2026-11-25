from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from app.core.database import get_db
from app.models.archimate import User, ModelWorkspace
from app.api.deps import get_current_user, require_library_permission
from app.services.functional_analysis_service import FunctionalAnalysisService
from app.services.functional_report_service import FunctionalReportService
from app.services.rbac_service import can_user_view_financials

router = APIRouter(prefix="/functional", tags=["Functional Architecture & Gap Analysis"])

class DocxExportRequest(BaseModel):
    lang: str = "it"
    heatmap_image_base64: Optional[str] = None

def _redact_tree_financials(nodes):
    for node in nodes:
        node["potential_savings"] = None
        if "rollup" in node and isinstance(node["rollup"], dict):
            node["rollup"]["potential_savings"] = None
        if "children" in node and isinstance(node["children"], list):
            _redact_tree_financials(node["children"])

def _redact_functional_financials(data: Dict[str, Any]):
    data["total_potential_savings"] = None
    data["_financials_redacted"] = True
    for cluster in data.get("redundancy_clusters", []):
        cluster["potential_savings"] = None
    for col in data.get("applications_columns", []):
        col["annual_cost"] = None
    for unit in data.get("leaf_functions", []):
        unit["potential_savings"] = None
    for domain in data.get("heatmap_domains", []):
        domain["potential_savings"] = None
    _redact_tree_financials(data.get("hierarchy_trees", []))
    return data

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
    Financial fields are redacted for users without C-Level/Admin access.
    """
    require_library_permission(db, current_user, "read_repository", model_id)
    data = FunctionalAnalysisService.analyze_functional_architecture(db, model_id)
    if not can_user_view_financials(db, current_user):
        _redact_functional_financials(data)
    return data


@router.get("/export/docx/{model_id}")
def export_functional_docx_report(
    model_id: str,
    lang: str = Query("it", description="Report language: 'it' or 'en'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Response:
    """
    Generates and downloads a comprehensive Word (.docx) assessment document:
    - Executive summary and KPI scorecards
    - Native capability fit & maturity heatmap grid
    - Gap registry and prioritized coverage initiatives
    - Redundancy clusters and rationalization / decommissioning roadmap
    - Hierarchical functional inventory (L2 leaf matrix)
    """
    require_library_permission(db, current_user, "read_repository", model_id)
    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    model_name = model.name if model else model_id

    data = FunctionalAnalysisService.analyze_functional_architecture(db, model_id)
    if not can_user_view_financials(db, current_user):
        _redact_functional_financials(data)
    clean_lang = "en" if lang.lower().startswith("en") else "it"
    docx_stream = FunctionalReportService.generate_docx_report(data, model_name=model_name, lang=clean_lang)

    safe_name = "".join(c for c in model_name if c.isalnum() or c in (" ", "-", "_")).strip().replace(" ", "_")
    filename = f"Functional_Assessment_{safe_name}.docx"

    return Response(
        content=docx_stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@router.post("/export/docx/{model_id}")
def export_functional_docx_report_post(
    model_id: str,
    req: DocxExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Response:
    """
    Generates and downloads a Word (.docx) assessment document including the
    visual Heatmap screenshot and full data analysis.
    """
    require_library_permission(db, current_user, "read_repository", model_id)
    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    model_name = model.name if model else model_id

    data = FunctionalAnalysisService.analyze_functional_architecture(db, model_id)
    if not can_user_view_financials(db, current_user):
        _redact_functional_financials(data)
    clean_lang = "en" if req.lang.lower().startswith("en") else "it"
    docx_stream = FunctionalReportService.generate_docx_report(
        data,
        model_name=model_name,
        lang=clean_lang,
        heatmap_image_base64=req.heatmap_image_base64
    )

    safe_name = "".join(c for c in model_name if c.isalnum() or c in (" ", "-", "_")).strip().replace(" ", "_")
    filename = f"Functional_Assessment_{safe_name}.docx"

    return Response(
        content=docx_stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )
