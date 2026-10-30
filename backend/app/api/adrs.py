from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.archimate import ArchitectureDecisionRecord, User
from app.api.deps import get_current_user, require_library_permission
from app.services.adr_service import ADRService

router = APIRouter(prefix="/adrs", tags=["Architecture Decision Records (ADR)"])


class ConsideredOptionModel(BaseModel):
    title: str
    description: Optional[str] = ""
    pros: Optional[str] = ""
    cons: Optional[str] = ""


class LinkedElementPayload(BaseModel):
    element_id: str
    impact_type: Optional[str] = "governs"
    notes: Optional[str] = ""


class ADRCreatePayload(BaseModel):
    code: Optional[str] = None
    title: str = Field(..., min_length=1)
    status: Optional[str] = "Draft"
    domain: Optional[str] = "Application"
    context_and_problem: Optional[str] = ""
    decision_drivers: Optional[List[str]] = []
    considered_options: Optional[List[Dict[str, Any]]] = []
    decision_outcome: Optional[str] = ""
    consequences: Optional[str] = ""
    compliance_impact: Optional[str] = ""
    deciders: Optional[str] = ""
    author_name: Optional[str] = None
    superseded_by_id: Optional[str] = None
    supersedes_adr_id: Optional[str] = None
    linked_elements: Optional[List[Dict[str, Any]]] = []


class ADRUpdatePayload(BaseModel):
    code: Optional[str] = None
    title: Optional[str] = None
    status: Optional[str] = None
    domain: Optional[str] = None
    context_and_problem: Optional[str] = None
    decision_drivers: Optional[List[str]] = None
    considered_options: Optional[List[Dict[str, Any]]] = None
    decision_outcome: Optional[str] = None
    consequences: Optional[str] = None
    compliance_impact: Optional[str] = None
    deciders: Optional[str] = None
    superseded_by_id: Optional[str] = None
    linked_elements: Optional[List[Dict[str, Any]]] = None


class ADRTransitionPayload(BaseModel):
    status: str
    superseded_by_id: Optional[str] = None
    deciders: Optional[str] = None


@router.get("")
def list_adrs(
    model_id: str = Query(..., description="Workspace library ID"),
    status: Optional[str] = Query(None, description="Filter by ADR status"),
    domain: Optional[str] = Query(None, description="Filter by architectural domain"),
    element_id: Optional[str] = Query(None, description="Filter by linked ArchiMate element ID"),
    search: Optional[str] = Query(None, description="Full-text search across ADR fields"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List Architecture Decision Records (ADRs) for a model with KPI summary."""
    return ADRService.list_adrs(
        db=db,
        model_id=model_id,
        status=status,
        domain=domain,
        element_id=element_id,
        search=search
    )


@router.get("/export-all")
def export_all_adrs_markdown(
    model_id: str = Query(..., description="Workspace library ID"),
    download: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Exports the complete ADR Governance Log for a library in MADR Markdown format."""
    data = ADRService.list_adrs(db=db, model_id=model_id)
    items = data.get("items", [])
    sections = [
        "# Architecture Decision Records (ADR) — Governance Log",
        "",
        f"**Total Decisions Recorded:** {len(items)}",
        "",
        "---",
        ""
    ]
    for item in items:
        sections.append(ADRService.export_adr_markdown(item))
        sections.append("\n---\n")

    full_md = "\n".join(sections)
    filename = f"ADR-Governance-Log-{model_id}.md"
    if download:
        return Response(
            content=full_md,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    return {"filename": filename, "markdown": full_md, "count": len(items)}


@router.get("/{adr_id}")
def get_adr_detail(
    adr_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get full details of a specific ADR including linked ArchiMate elements."""
    return ADRService.get_adr(db, adr_id)


@router.post("")
def create_adr(
    model_id: str = Query(..., description="Workspace library ID"),
    payload: ADRCreatePayload = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new Architecture Decision Record in the specified library."""
    require_library_permission(db, current_user, "write_architecture", model_id)
    return ADRService.create_adr(
        db=db,
        model_id=model_id,
        payload=payload.model_dump(),
        current_user=current_user
    )


@router.put("/{adr_id}")
def update_adr(
    adr_id: str,
    payload: ADRUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing Architecture Decision Record and its linked elements."""
    adr = db.query(ArchitectureDecisionRecord).filter(ArchitectureDecisionRecord.id == adr_id).first()
    if not adr:
        raise HTTPException(status_code=404, detail="ADR not found.")
    require_library_permission(db, current_user, "write_architecture", adr.model_id)
    return ADRService.update_adr(
        db=db,
        adr_id=adr_id,
        payload=payload.model_dump(exclude_unset=True)
    )


@router.post("/{adr_id}/transition")
def transition_adr_status(
    adr_id: str,
    payload: ADRTransitionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Transition an ADR through its governance lifecycle (Draft -> Proposed -> Accepted/Rejected/Deprecated/Superseded)."""
    adr = db.query(ArchitectureDecisionRecord).filter(ArchitectureDecisionRecord.id == adr_id).first()
    if not adr:
        raise HTTPException(status_code=404, detail="ADR not found.")
    require_library_permission(db, current_user, "write_architecture", adr.model_id)
    return ADRService.transition_adr(
        db=db,
        adr_id=adr_id,
        target_status=payload.status,
        superseded_by_id=payload.superseded_by_id,
        deciders=payload.deciders
    )


@router.delete("/{adr_id}")
def delete_adr(
    adr_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an Architecture Decision Record."""
    adr = db.query(ArchitectureDecisionRecord).filter(ArchitectureDecisionRecord.id == adr_id).first()
    if not adr:
        raise HTTPException(status_code=404, detail="ADR not found.")
    require_library_permission(db, current_user, "write_architecture", adr.model_id)
    return ADRService.delete_adr(db=db, adr_id=adr_id)


@router.get("/{adr_id}/export-md")
def export_single_adr_markdown(
    adr_id: str,
    download: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Exports a single ADR in MADR v3.0 Markdown format."""
    adr_data = ADRService.get_adr(db, adr_id)
    md = ADRService.export_adr_markdown(adr_data)
    safe_code = (adr_data["code"] or "ADR").replace(" ", "-")
    filename = f"{safe_code}.md"
    if download:
        return Response(
            content=md,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    return {
        "id": adr_id,
        "code": adr_data["code"],
        "filename": filename,
        "markdown": md
    }
