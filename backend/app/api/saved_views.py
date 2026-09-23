from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import uuid

from app.core.database import get_db
from app.models.archimate import SavedFilterView, ModelWorkspace, utc_now

router = APIRouter(prefix="/saved-views", tags=["saved-views"])

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
    db: Session = Depends(get_db)
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
    db: Session = Depends(get_db)
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
    db: Session = Depends(get_db)
):
    """Create a new saved filter view."""
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
    db: Session = Depends(get_db)
):
    """Update an existing saved filter view."""
    v = db.query(SavedFilterView).filter(SavedFilterView.id == view_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Saved view not found")

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
    db: Session = Depends(get_db)
):
    """Delete a saved filter view."""
    v = db.query(SavedFilterView).filter(SavedFilterView.id == view_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Saved view not found")
    
    db.delete(v)
    db.commit()
    return {"status": "deleted", "id": view_id}

@router.post("/{view_id}/duplicate", status_code=201)
def duplicate_saved_view(
    view_id: str,
    db: Session = Depends(get_db)
):
    """Duplicate an existing saved filter view."""
    orig = db.query(SavedFilterView).filter(SavedFilterView.id == view_id).first()
    if not orig:
        raise HTTPException(status_code=404, detail="Saved view not found")
    
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
