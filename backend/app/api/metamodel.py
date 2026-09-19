from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.core.database import get_db
from app.services.metamodel_service import (
    get_full_metamodel_with_custom_attributes,
    list_custom_attributes,
    create_custom_attribute,
    update_custom_attribute,
    rename_custom_attributes_section,
    delete_custom_attribute,
    get_relationships_matrix
)

router = APIRouter(prefix="/metamodel", tags=["metamodel"])

class CustomAttributeCreate(BaseModel):
    name: str
    label: str
    section: Optional[str] = "Custom Attributes"
    model_id: Optional[str] = None # Optional: target specific model workspace
    description: Optional[str] = None
    element_type: str = "*" # e.g. "ApplicationComponent", "BusinessProcess", or "*"
    layer: str = "All" # "Strategy", "Business", "Application", "Technology", "Motivation", "Implementation", or "All"
    data_type: str = "string" # "string", "number", "boolean", "date", "select"
    options: Optional[List[str]] = []
    default_value: Optional[str] = None
    is_required: bool = False

class CustomAttributeUpdate(BaseModel):
    label: Optional[str] = None
    section: Optional[str] = None
    description: Optional[str] = None
    data_type: Optional[str] = None
    options: Optional[List[str]] = None
    default_value: Optional[str] = None
    is_required: Optional[bool] = None

class SectionRenameRequest(BaseModel):
    old_section: str
    new_section: str
    model_id: Optional[str] = None
    element_type: Optional[str] = None

@router.get("/types")
def get_metamodel_types(
    model_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Returns the ArchiMate 3.x metamodel structure with standard and custom attributes."""
    return get_full_metamodel_with_custom_attributes(db, model_id=model_id)

@router.get("/relationships-matrix")
def get_metamodel_relationships_matrix():
    """Returns the official ArchiMate 3.x allowed relationships matrix and relationship metadata."""
    return get_relationships_matrix()

@router.get("/attributes")
def get_custom_attributes(
    model_id: Optional[str] = Query(None),
    element_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Returns custom attribute definitions."""
    return list_custom_attributes(db, model_id=model_id, element_type=element_type)

@router.post("/attributes")
def add_custom_attribute(
    payload: CustomAttributeCreate,
    db: Session = Depends(get_db)
):
    """Creates a new custom attribute definition for an element type."""
    if not payload.name.strip() or not payload.label.strip():
        raise HTTPException(status_code=400, detail="Attribute name and label are required.")
    
    return create_custom_attribute(db, payload.model_dump())

@router.put("/attributes/{attr_id}")
def edit_custom_attribute(
    attr_id: str,
    payload: CustomAttributeUpdate,
    db: Session = Depends(get_db)
):
    """Updates an existing custom attribute definition."""
    return update_custom_attribute(db, attr_id, payload.model_dump(exclude_unset=True))

@router.put("/sections/rename")
def rename_section(
    payload: SectionRenameRequest,
    db: Session = Depends(get_db)
):
    """Renames an attribute section across all matching attributes."""
    count = rename_custom_attributes_section(
        db,
        old_section=payload.old_section,
        new_section=payload.new_section,
        model_id=payload.model_id,
        element_type=payload.element_type
    )
    return {"status": "success", "updated_count": count, "new_section": payload.new_section}

@router.delete("/attributes/{attr_id}")
def remove_custom_attribute(
    attr_id: str,
    db: Session = Depends(get_db)
):
    """Deletes a custom attribute definition."""
    success = delete_custom_attribute(db, attr_id)
    if not success:
        raise HTTPException(status_code=404, detail="Attribute definition not found.")
    return {"status": "success", "message": f"Attribute {attr_id} deleted."}
