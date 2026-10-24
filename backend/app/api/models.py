from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import uuid
import re

from app.core.database import get_db
from app.models.archimate import ModelWorkspace, ArchimateElement, ArchimateRelationship, ArchimateView, ApplicationBusinessAttributes, User
from app.api.deps import (
    get_current_user,
    require_admin,
    require_library_permission,
    read_upload_bounded,
)
from app.parsers.archi_parser import ArchiModelParser
from app.services.sample_data import seed_sample_model
from app.services.apm_service import calculate_time_quadrant
from app.services.metamodel_service import activate_default_packages_for_workspace

router = APIRouter(prefix="/models", tags=["Models & Import"])

def generate_unique_library_code(db: Session, name: Optional[str] = None, requested_code: Optional[str] = None) -> str:
    """
    Validates or generates a unique 4-letter uppercase code [A-Z]{4} for a library workspace.
    """
    existing_codes = {c[0] for c in db.query(ModelWorkspace.code).filter(ModelWorkspace.code != None).all() if c[0]}

    if requested_code:
        code_clean = requested_code.strip().upper()
        if not re.match(r"^[A-Z]{4}$", code_clean):
            raise HTTPException(
                status_code=400,
                detail="Library code must consist of exactly 4 uppercase alphabetic letters [A-Z] (e.g. 'EASY', 'CORE')."
            )
        if code_clean in existing_codes:
            raise HTTPException(
                status_code=400,
                detail=f"Library code '{code_clean}' is already in use by another library."
            )
        return code_clean

    # Auto-generate from name
    source_str = name or "LIBRARY"
    # If 4 or more words, take first letter of each
    words = [w for w in re.split(r"[^A-Za-z]+", source_str) if w]
    if len(words) >= 4:
        letters = "".join([w[0].upper() for w in words[:4]])
    else:
        letters = "".join([c.upper() for c in source_str if c.isalpha()])

    candidate = (letters[:4] if len(letters) >= 4 else (letters + "XXXX")[:4])
    base = candidate[:3] if len(candidate) >= 3 else "MOD"
    suffix_char = ord('A')

    while candidate in existing_codes:
        candidate = f"{base[:3]}{chr(suffix_char)}"
        suffix_char += 1
        if suffix_char > ord('Z'):
            suffix_char = ord('A')
            base = f"{base[:2]}X"

    return candidate

@router.get("", response_model=List[Dict[str, Any]])
def list_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all architectural models in the repository."""
    models = db.query(ModelWorkspace).all()
    results = []
    for m in models:
        elem_count = db.query(ArchimateElement).filter(ArchimateElement.model_id == m.id).count()
        rel_count = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == m.id).count()
        view_count = db.query(ArchimateView).filter(ArchimateView.model_id == m.id).count()
        results.append({
            "id": m.id,
            "code": m.code,
            "name": m.name,
            "description": m.description,
            "version": m.version,
            "source_format": m.source_format,
            "modeling_tool": getattr(m, "modeling_tool", "archi") or "archi",
            "element_count": elem_count,
            "relationship_count": rel_count,
            "view_count": view_count,
            "created_at": m.created_at,
            "updated_at": m.updated_at
        })
    return results

@router.get("/{model_id}")
def get_model_detail(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get overview details for a specific model."""
    m = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Model not found")

    elem_count = db.query(ArchimateElement).filter(ArchimateElement.model_id == m.id).count()
    rel_count = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == m.id).count()
    view_count = db.query(ArchimateView).filter(ArchimateView.model_id == m.id).count()
    app_count = db.query(ArchimateElement).filter(
        ArchimateElement.model_id == m.id,
        ArchimateElement.type == "ApplicationComponent"
    ).count()

    return {
        "id": m.id,
        "code": m.code,
        "name": m.name,
        "description": m.description,
        "version": m.version,
        "source_format": m.source_format,
        "modeling_tool": getattr(m, "modeling_tool", "archi") or "archi",
        "element_count": elem_count,
        "relationship_count": rel_count,
        "view_count": view_count,
        "application_count": app_count,
        "created_at": m.created_at,
        "updated_at": m.updated_at
    }

@router.post("/seed-sample")
def seed_sample(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Populates or resets the rich enterprise sample model."""
    model_id = seed_sample_model(db)
    return {"message": "Sample enterprise model ready", "model_id": model_id}

@router.post("/upload-archi")
async def upload_archi_model(
    file: UploadFile = File(...),
    model_name: Optional[str] = Form(None),
    code: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Imports an Archi Tool XML file (.archimate or Open Group ArchiMate Exchange XML)
    and extracts all Elements, Relationships, Views, and sets up APM foundations.
    """
    content_bytes = await read_upload_bounded(file)
    try:
        content_str = content_bytes.decode("utf-8", errors="ignore")
        
        parser = ArchiModelParser(content_str)
        parsed_data = parser.parse()

        # Create Model Workspace
        workspace_id = f"model-{uuid.uuid4().hex[:8]}"
        final_name = model_name or parsed_data.get("name") or file.filename
        final_code = generate_unique_library_code(db, final_name, code)
        
        workspace = ModelWorkspace(
            id=workspace_id,
            code=final_code,
            name=final_name,
            description=parsed_data.get("description", f"Imported from {file.filename}"),
            version="1.0.0",
            source_format=parsed_data.get("source_format", "archi_native"),
            modeling_tool="archi"
        )
        db.add(workspace)

        # Add Elements
        for elem in parsed_data.get("elements", []):
            el = ArchimateElement(
                id=elem["id"],
                model_id=workspace_id,
                name=elem["name"],
                type=elem["type"],
                layer=elem["layer"],
                documentation=elem.get("documentation", ""),
                properties=elem.get("properties", {})
            )
            db.add(el)

            # If it is an ApplicationComponent, initialize default APM record
            if elem["type"] == "ApplicationComponent":
                apm = ApplicationBusinessAttributes(
                    element_id=elem["id"],
                    business_fit=3,
                    technical_fit=3,
                    time_quadrant="Tolerate",
                    annual_cost=0.0,
                    business_criticality="Business Operational",
                    lifecycle_status="Live",
                    business_owner="Unassigned",
                    technical_owner="Unassigned",
                    vendor="Internal",
                    hosting_type="Cloud"
                )
                db.add(apm)

        # Add Relationships
        for rel in parsed_data.get("relationships", []):
            r = ArchimateRelationship(
                id=rel["id"],
                model_id=workspace_id,
                source_id=rel["source_id"],
                target_id=rel["target_id"],
                type=rel["type"],
                name=rel.get("name", ""),
                documentation=rel.get("documentation", ""),
                properties=rel.get("properties", {})
            )
            db.add(r)

        # Add Views
        for view in parsed_data.get("views", []):
            v = ArchimateView(
                id=view["id"],
                model_id=workspace_id,
                name=view["name"],
                viewpoint=view.get("viewpoint", "Total"),
                documentation=view.get("documentation", ""),
                view_data=view.get("view_data", {})
            )
            db.add(v)

        db.commit()
        activate_default_packages_for_workspace(db, workspace_id)

        return {
            "success": True,
            "model_id": workspace_id,
            "code": final_code,
            "name": final_name,
            "modeling_tool": "archi",
            "elements_imported": len(parsed_data.get("elements", [])),
            "relationships_imported": len(parsed_data.get("relationships", [])),
            "views_imported": len(parsed_data.get("views", []))
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to parse and import Archi file: {str(e)}")

class ModelCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = ""
    version: Optional[str] = "1.0.0"
    modeling_tool: Optional[str] = "archi"

class ModelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    modeling_tool: Optional[str] = None

@router.post("", response_model=Dict[str, Any])
def create_empty_model(
    payload: ModelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Creates a new empty architectural model."""
    workspace_id = f"model-{uuid.uuid4().hex[:8]}"
    final_code = generate_unique_library_code(db, payload.name, payload.code)
    workspace = ModelWorkspace(
        id=workspace_id,
        code=final_code,
        name=payload.name,
        description=payload.description or "Nuovo modello architetturale",
        version=payload.version or "1.0.0",
        source_format="manual",
        modeling_tool=payload.modeling_tool or "archi"
    )
    db.add(workspace)
    db.commit()
    activate_default_packages_for_workspace(db, workspace.id)
    db.refresh(workspace)
    return {
        "id": workspace.id,
        "code": workspace.code,
        "name": workspace.name,
        "description": workspace.description,
        "version": workspace.version,
        "source_format": workspace.source_format,
        "modeling_tool": workspace.modeling_tool or "archi"
    }

@router.put("/{model_id}")
def update_model(
    model_id: str,
    payload: ModelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates model metadata."""
    require_library_permission(db, current_user, "write_architecture", model_id)
    m = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Model not found")
    if payload.name is not None:
        m.name = payload.name
    if payload.description is not None:
        m.description = payload.description
    if payload.version is not None:
        m.version = payload.version
    if payload.modeling_tool is not None:
        m.modeling_tool = payload.modeling_tool
    db.commit()
    return {"message": "Model updated successfully"}

@router.get("/{model_id}/export")
def export_model_json(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Exports full model content in structured JSON format."""
    m = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Model not found")

    elements = db.query(ArchimateElement).filter(ArchimateElement.model_id == model_id).all()
    relationships = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == model_id).all()
    views = db.query(ArchimateView).filter(ArchimateView.model_id == model_id).all()

    elem_list = []
    for e in elements:
        apm = e.apm_attributes
        elem_list.append({
            "id": e.id,
            "name": e.name,
            "type": e.type,
            "layer": e.layer,
            "documentation": e.documentation,
            "properties": e.properties or {},
            "apm": {
                "business_fit": apm.business_fit,
                "technical_fit": apm.technical_fit,
                "time_quadrant": apm.time_quadrant,
                "annual_cost": apm.annual_cost,
                "business_criticality": apm.business_criticality,
                "lifecycle_status": apm.lifecycle_status,
                "business_owner": apm.business_owner,
                "vendor": apm.vendor,
                "hosting_type": apm.hosting_type
            } if apm else None
        })

    rel_list = [{
        "id": r.id,
        "type": r.type,
        "name": r.name,
        "source_id": r.source_id,
        "target_id": r.target_id,
        "documentation": r.documentation
    } for r in relationships]

    view_list = [{
        "id": v.id,
        "name": v.name,
        "viewpoint": v.viewpoint,
        "view_data": v.view_data
    } for v in views]

    return {
        "model": {
            "id": m.id,
            "code": m.code,
            "name": m.name,
            "description": m.description,
            "version": m.version,
            "source_format": m.source_format,
            "created_at": str(m.created_at),
            "updated_at": str(m.updated_at)
        },
        "elements": elem_list,
        "relationships": rel_list,
        "views": view_list
    }

@router.delete("/{model_id}")
def delete_model(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Deletes a model workspace and all associated elements, views, and relationships."""
    m = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Model not found")
    db.delete(m)
    db.commit()
    return {"message": "Model deleted successfully"}

