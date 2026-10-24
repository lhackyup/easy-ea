from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import uuid
import re

from app.core.database import get_db
from app.models.archimate import (
    SavedFilterView,
    ModelWorkspace,
    ArchimateElement,
    ArchimateRelationship,
    CustomAttributeDefinition,
    User,
    utc_now
)
from app.api.deps import get_current_user, require_library_permission
from app.services.export_service import generate_view_excel, generate_view_csv_zip

router = APIRouter(prefix="/saved-views", tags=["saved-views"])

class ViewExportRequest(BaseModel):
    model_id: str
    view_id: Optional[str] = None
    view_name: Optional[str] = "Repository_Export"
    format: str = "xlsx" # "xlsx" or "csv"
    element_ids: Optional[List[str]] = None
    filter_config: Optional[Dict[str, Any]] = None
    include_relationships: bool = True

class SavedViewCreate(BaseModel):
    model_id: str
    name: str
    description: Optional[str] = None
    author: Optional[str] = "Enterprise Architect"
    is_shared: bool = True
    tags: Optional[List[str]] = []
    filter_config: Dict[str, Any]

class SavedViewUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    author: Optional[str] = None
    is_shared: Optional[bool] = None
    tags: Optional[List[str]] = None
    filter_config: Optional[Dict[str, Any]] = None

@router.get("")
def list_saved_views(
    model_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve all saved filter views for a specific model workspace (or all models)."""
    query = db.query(SavedFilterView)
    if model_id:
        query = query.filter(SavedFilterView.model_id == model_id)
    
    views = query.order_by(SavedFilterView.updated_at.desc()).all()
    return [
        {
            "id": v.id,
            "model_id": v.model_id,
            "name": v.name,
            "description": v.description,
            "author": v.author or "Enterprise Architect",
            "is_shared": v.is_shared if v.is_shared is not None else True,
            "tags": v.tags or [],
            "filter_config": v.filter_config or {},
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "updated_at": v.updated_at.isoformat() if v.updated_at else None
        }
        for v in views
    ]

@router.get("/{view_id}")
def get_saved_view(
    view_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get details of a specific saved view."""
    v = db.query(SavedFilterView).filter(SavedFilterView.id == view_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Saved view not found")
    return {
        "id": v.id,
        "model_id": v.model_id,
        "name": v.name,
        "description": v.description,
        "author": v.author or "Enterprise Architect",
        "is_shared": v.is_shared if v.is_shared is not None else True,
        "tags": v.tags or [],
        "filter_config": v.filter_config or {},
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "updated_at": v.updated_at.isoformat() if v.updated_at else None
    }

@router.post("", status_code=201)
def create_saved_view(
    req: SavedViewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new saved filter view."""
    require_library_permission(db, current_user, "write_architecture", req.model_id)
    workspace = db.query(ModelWorkspace).filter(ModelWorkspace.id == req.model_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Model workspace not found")

    new_view = SavedFilterView(
        id=f"view_{uuid.uuid4().hex[:12]}",
        model_id=req.model_id,
        name=req.name.strip(),
        description=req.description.strip() if req.description else None,
        author=req.author or "Enterprise Architect",
        is_shared=req.is_shared,
        tags=req.tags or [],
        filter_config=req.filter_config or {},
        created_at=utc_now(),
        updated_at=utc_now()
    )
    db.add(new_view)
    db.commit()
    db.refresh(new_view)

    return {
        "id": new_view.id,
        "model_id": new_view.model_id,
        "name": new_view.name,
        "description": new_view.description,
        "author": new_view.author,
        "is_shared": new_view.is_shared,
        "tags": new_view.tags,
        "filter_config": new_view.filter_config,
        "created_at": new_view.created_at.isoformat() if new_view.created_at else None,
        "updated_at": new_view.updated_at.isoformat() if new_view.updated_at else None
    }

@router.put("/{view_id}")
def update_saved_view(
    view_id: str,
    req: SavedViewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing saved filter view."""
    v = db.query(SavedFilterView).filter(SavedFilterView.id == view_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Saved view not found")
    require_library_permission(db, current_user, "write_architecture", v.model_id)

    if req.name is not None:
        v.name = req.name.strip()
    if req.description is not None:
        v.description = req.description.strip() if req.description else None
    if req.author is not None:
        v.author = req.author
    if req.is_shared is not None:
        v.is_shared = req.is_shared
    if req.tags is not None:
        v.tags = req.tags
    if req.filter_config is not None:
        v.filter_config = req.filter_config
    
    v.updated_at = utc_now()
    db.commit()
    db.refresh(v)

    return {
        "id": v.id,
        "model_id": v.model_id,
        "name": v.name,
        "description": v.description,
        "author": v.author,
        "is_shared": v.is_shared,
        "tags": v.tags,
        "filter_config": v.filter_config,
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "updated_at": v.updated_at.isoformat() if v.updated_at else None
    }

@router.delete("/{view_id}")
def delete_saved_view(
    view_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a saved filter view."""
    v = db.query(SavedFilterView).filter(SavedFilterView.id == view_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Saved view not found")
    require_library_permission(db, current_user, "write_architecture", v.model_id)
    
    db.delete(v)
    db.commit()
    return {"status": "deleted", "id": view_id}

@router.post("/{view_id}/duplicate", status_code=201)
def duplicate_saved_view(
    view_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Duplicate an existing saved filter view."""
    orig = db.query(SavedFilterView).filter(SavedFilterView.id == view_id).first()
    if not orig:
        raise HTTPException(status_code=404, detail="Saved view not found")
    require_library_permission(db, current_user, "write_architecture", orig.model_id)
    
    dup = SavedFilterView(
        id=f"view_{uuid.uuid4().hex[:12]}",
        model_id=orig.model_id,
        name=f"{orig.name} (Copia)",
        description=orig.description,
        author=orig.author,
        is_shared=orig.is_shared,
        tags=list(orig.tags) if orig.tags else [],
        filter_config=dict(orig.filter_config) if orig.filter_config else {},
        created_at=utc_now(),
        updated_at=utc_now()
    )
    db.add(dup)
    db.commit()
    db.refresh(dup)

    return {
        "id": dup.id,
        "model_id": dup.model_id,
        "name": dup.name,
        "description": dup.description,
        "author": dup.author,
        "is_shared": dup.is_shared,
        "tags": dup.tags,
        "filter_config": dup.filter_config,
        "created_at": dup.created_at.isoformat() if dup.created_at else None,
        "updated_at": dup.updated_at.isoformat() if dup.updated_at else None
    }


def evaluate_single_rule(actual_val: Any, op: str, target_val: Any, second_val: Any) -> bool:
    op_clean = (op or "").strip().lower()

    if op_clean in ("empty", "is_empty", "null"):
        return actual_val is None or actual_val == "" or (isinstance(actual_val, (list, dict)) and len(actual_val) == 0)

    if op_clean in ("not_empty", "is_not_empty", "not_null"):
        return actual_val is not None and actual_val != "" and (not isinstance(actual_val, (list, dict)) or len(actual_val) > 0)

    if op_clean in ("is_true", "true"):
        return actual_val is True or str(actual_val).lower() in ("true", "1", "yes", "si", "sì", "t", "y")

    if op_clean in ("is_false", "false"):
        return actual_val is False or str(actual_val).lower() in ("false", "0", "no", "f", "n")

    if actual_val is None or actual_val == "":
        return False

    act_str = str(actual_val).strip().lower()
    tar_str = str(target_val).strip().lower() if target_val is not None else ""

    if op_clean in ("equals", "eq", "=", "=="):
        return act_str == tar_str

    if op_clean in ("not_equals", "neq", "!=", "<>"):
        return act_str != tar_str

    if op_clean in ("contains", "like"):
        return tar_str in act_str

    if op_clean in ("not_contains", "not_like"):
        return tar_str not in act_str

    if op_clean in ("starts_with", "startswith"):
        return act_str.startswith(tar_str)

    if op_clean in ("ends_with", "endswith"):
        return act_str.endswith(tar_str)

    # Numeric comparisons
    try:
        num_act = float(actual_val)
        num_tar = float(target_val) if target_val is not None and target_val != "" else 0.0
        if op_clean in ("gt", "greater_than", ">"):
            return num_act > num_tar
        if op_clean in ("gte", "greater_equal", ">="):
            return num_act >= num_tar
        if op_clean in ("lt", "less_than", "<"):
            return num_act < num_tar
        if op_clean in ("lte", "less_equal", "<="):
            return num_act <= num_tar
        if op_clean in ("between", "range"):
            num_sec = float(second_val) if second_val is not None and second_val != "" else float("inf")
            return num_act >= num_tar and num_act <= num_sec
    except (ValueError, TypeError):
        pass

    # Date / Lexicographical comparisons
    if op_clean in ("after", "gt", ">"):
        return act_str > tar_str
    if op_clean in ("before", "lt", "<"):
        return act_str < tar_str
    if op_clean in ("gte", ">="):
        return act_str >= tar_str
    if op_clean in ("lte", "<="):
        return act_str <= tar_str
    if op_clean in ("between", "range"):
        sec_str = str(second_val).strip().lower() if second_val is not None else "zzz"
        return act_str >= tar_str and act_str <= sec_str

    return False


def filter_elements_by_config(
    elements: List[ArchimateElement],
    config: Dict[str, Any]
) -> List[ArchimateElement]:
    if not config:
        return elements

    layer = config.get("selectedLayer", "All")
    elem_type = config.get("selectedType", "All")
    search_text = (config.get("search") or "").strip().lower()
    search_in_props = config.get("searchInProps", False)
    rel_filter = config.get("relationshipFilter", "all")
    doc_filter = config.get("documentationFilter", "all")
    match_logic = config.get("matchLogic", "AND")
    rules = config.get("attributeFilterRules", [])

    filtered = []
    for el in elements:
        # Layer filter
        if layer and layer != "All" and el.layer != layer:
            continue

        # Type filter
        if elem_type and elem_type != "All" and el.type != elem_type:
            continue

        # Search text
        if search_text:
            match_name = bool(el.name and search_text in el.name.lower())
            match_id = bool(el.id and search_text in el.id.lower())
            match_doc = bool(el.documentation and search_text in el.documentation.lower())
            match_props = False
            if search_in_props and el.properties and isinstance(el.properties, dict):
                for v in el.properties.values():
                    if v is not None and search_text in str(v).lower():
                        match_props = True
                        break
            if not (match_name or match_id or match_doc or match_props):
                continue

        # Relationship filter
        in_count = len(el.incoming_relations) if el.incoming_relations else 0
        out_count = len(el.outgoing_relations) if el.outgoing_relations else 0
        is_orphan = (in_count == 0 and out_count == 0)
        if rel_filter == "orphan" and not is_orphan:
            continue
        if rel_filter == "connected" and is_orphan:
            continue

        # Documentation filter
        has_doc = bool(el.documentation and el.documentation.strip())
        if doc_filter == "with_doc" and not has_doc:
            continue
        if doc_filter == "no_doc" and has_doc:
            continue

        # Attribute Rules
        if rules:
            rule_results = []
            for r in rules:
                attr_name = r.get("attributeName")
                if not attr_name:
                    continue
                op = r.get("operator", "equals")
                target_val = r.get("value")
                second_val = r.get("secondValue")

                # Fetch actual val comprehensively
                actual_val = None
                if el.properties and isinstance(el.properties, dict):
                    actual_val = el.properties.get(attr_name)
                    if actual_val is None:
                        actual_val = el.properties.get(f"eea_{attr_name}")
                    if actual_val is None and attr_name.startswith("eea_"):
                        actual_val = el.properties.get(attr_name[4:])

                if actual_val is None and el.apm_attributes:
                    apm_key = attr_name.replace("eea_", "")
                    if hasattr(el.apm_attributes, apm_key):
                        actual_val = getattr(el.apm_attributes, apm_key)

                if actual_val is None and hasattr(el, attr_name):
                    actual_val = getattr(el, attr_name)

                r_match = evaluate_single_rule(actual_val, op, target_val, second_val)
                rule_results.append(r_match)

            if rule_results:
                if match_logic == "OR":
                    if not any(rule_results):
                        continue
                else:  # AND
                    if not all(rule_results):
                        continue

        filtered.append(el)
    return filtered


def clean_filename(name: str) -> str:
    return re.sub(r'[^a-zA-Z0-9_-]', '_', name.strip())


@router.get("/{view_id}/export")
def export_saved_view(
    view_id: str,
    format: str = Query("xlsx", pattern="^(xlsx|csv)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Exports a saved view into an Excel (.xlsx) or CSV package matching the exact import format.
    """
    v = db.query(SavedFilterView).filter(SavedFilterView.id == view_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Saved view not found")
    
    workspace = db.query(ModelWorkspace).filter(ModelWorkspace.id == v.model_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Model workspace not found")

    custom_attrs = db.query(CustomAttributeDefinition).filter(
        or_(CustomAttributeDefinition.model_id == v.model_id, CustomAttributeDefinition.model_id.is_(None))
    ).all()

    all_elements = db.query(ArchimateElement).filter(ArchimateElement.model_id == v.model_id).all()
    all_elements_map = {e.id: e.name for e in all_elements}
    matching_elements = filter_elements_by_config(all_elements, v.filter_config or {})

    # Collect all relationships connected to any of the matching elements
    element_id_set = {e.id for e in matching_elements}
    relationships: List[ArchimateRelationship] = []
    if element_id_set:
        relationships = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.model_id == v.model_id,
            or_(
                ArchimateRelationship.source_id.in_(element_id_set),
                ArchimateRelationship.target_id.in_(element_id_set)
            )
        ).all()

    safe_name = clean_filename(v.name) or "Saved_View"

    if format == "csv":
        zip_buf = generate_view_csv_zip(
            workspace,
            matching_elements,
            relationships,
            custom_attrs,
            view_name=v.name,
            all_elements_map=all_elements_map
        )
        return StreamingResponse(
            zip_buf,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="EasyEA_{safe_name}_export.zip"'}
        )

    excel_buf = generate_view_excel(
        workspace,
        matching_elements,
        relationships,
        custom_attrs,
        view_name=v.name,
        all_elements_map=all_elements_map
    )
    return StreamingResponse(
        excel_buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="EasyEA_{safe_name}_export.xlsx"'}
    )


@router.post("/export")
def export_view_or_selection(
    req: ViewExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Exports either a specific list of element IDs, a saved view, or an ad-hoc filter configuration.
    Output is in the exact format required by EasyEA Data Import for round-trip editing.
    """
    workspace = db.query(ModelWorkspace).filter(ModelWorkspace.id == req.model_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Model workspace not found")

    custom_attrs = db.query(CustomAttributeDefinition).filter(
        or_(CustomAttributeDefinition.model_id == req.model_id, CustomAttributeDefinition.model_id.is_(None))
    ).all()

    all_elements = db.query(ArchimateElement).filter(ArchimateElement.model_id == req.model_id).all()
    all_elements_map = {e.id: e.name for e in all_elements}
    target_elements: List[ArchimateElement] = []

    if req.element_ids is not None and len(req.element_ids) > 0:
        elem_map = {e.id: e for e in all_elements}
        target_elements = [elem_map[eid] for eid in req.element_ids if eid in elem_map]
    elif req.view_id:
        v = db.query(SavedFilterView).filter(SavedFilterView.id == req.view_id).first()
        if not v:
            raise HTTPException(status_code=404, detail="Saved view not found")
        target_elements = filter_elements_by_config(all_elements, v.filter_config or {})
        if not req.view_name or req.view_name == "Repository_Export":
            req.view_name = v.name
    elif req.filter_config:
        target_elements = filter_elements_by_config(all_elements, req.filter_config)
    else:
        # Export all elements in workspace
        target_elements = all_elements

    # Collect all relationships connected to target_elements
    relationships: List[ArchimateRelationship] = []
    if req.include_relationships and target_elements:
        element_id_set = {e.id for e in target_elements}
        relationships = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.model_id == req.model_id,
            or_(
                ArchimateRelationship.source_id.in_(element_id_set),
                ArchimateRelationship.target_id.in_(element_id_set)
            )
        ).all()

    safe_name = clean_filename(req.view_name or "Repository_Export")

    if req.format.lower() == "csv":
        zip_buf = generate_view_csv_zip(
            workspace,
            target_elements,
            relationships,
            custom_attrs,
            view_name=req.view_name,
            all_elements_map=all_elements_map
        )
        return StreamingResponse(
            zip_buf,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="EasyEA_{safe_name}.zip"'}
        )

    excel_buf = generate_view_excel(
        workspace,
        target_elements,
        relationships,
        custom_attrs,
        view_name=req.view_name,
        all_elements_map=all_elements_map
    )
    return StreamingResponse(
        excel_buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="EasyEA_{safe_name}.xlsx"'}
    )

