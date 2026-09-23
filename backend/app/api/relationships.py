from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import uuid

from app.core.database import get_db
from app.models.archimate import ArchimateRelationship, ArchimateElement
from app.services.metamodel_service import ARCHIMATE_RELATIONSHIP_RULES, ARCHIMATE_RELATIONSHIP_TYPES

router = APIRouter(prefix="/relationships", tags=["ArchiMate Relationships"])

class RelationshipCreate(BaseModel):
    source_id: str
    target_id: str
    type: str
    name: Optional[str] = ""
    documentation: Optional[str] = ""

class RelationshipUpdate(BaseModel):
    type: Optional[str] = None
    name: Optional[str] = None
    documentation: Optional[str] = None

def get_allowed_rel_names_for_types(source_type: str, target_type: str) -> List[str]:
    """Returns list of allowed relationship names (short or full) between two ArchiMate element types."""
    allowed = []
    if source_type in ARCHIMATE_RELATIONSHIP_RULES:
        if target_type in ARCHIMATE_RELATIONSHIP_RULES[source_type]:
            allowed = list(ARCHIMATE_RELATIONSHIP_RULES[source_type][target_type])
    
    # Association is universally valid between any pair of ArchiMate concepts
    if "Association" not in allowed and "AssociationRelationship" not in allowed:
        allowed.append("Association")
        
    return allowed

def is_rel_type_allowed(source_type: str, target_type: str, rel_type: str) -> bool:
    """Checks if a relationship type (e.g. 'ServingRelationship' or 'Serving') is valid between source and target."""
    allowed_names = get_allowed_rel_names_for_types(source_type, target_type)
    # Match both short name ("Serving") and full type ("ServingRelationship")
    norm_rel = rel_type.replace("Relationship", "")
    for a in allowed_names:
        if a == rel_type or a == norm_rel or f"{a}Relationship" == rel_type:
            return True
    return False

@router.get("/allowed-types", response_model=List[Dict[str, Any]])
def get_allowed_relationship_types(source_type: str, target_type: str):
    """Returns the list of ArchiMate allowed relationship types for the given source and target element types."""
    allowed_names = get_allowed_rel_names_for_types(source_type, target_type)
    results = []
    for rel_meta in ARCHIMATE_RELATIONSHIP_TYPES:
        short_name = rel_meta["name"].split(" ")[0].replace("/", "")
        full_type = rel_meta["type"]
        is_match = False
        for a in allowed_names:
            if a in rel_meta["name"] or a == short_name or a == full_type or f"{a}Relationship" == full_type:
                is_match = True
                break
        if is_match:
            results.append(rel_meta)
    return results

@router.get("", response_model=List[Dict[str, Any]])
def list_relationships(
    model_id: Optional[str] = None,
    element_id: Optional[str] = None,
    type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List relationships for a model or element, optionally filtered by relationship type."""
    query = db.query(ArchimateRelationship)
    if model_id:
        query = query.filter(ArchimateRelationship.model_id == model_id)
    if element_id:
        query = query.filter(
            (ArchimateRelationship.source_id == element_id) | (ArchimateRelationship.target_id == element_id)
        )
    if type:
        query = query.filter(ArchimateRelationship.type == type)
    
    rels = query.all()
    results = []
    for r in rels:
        results.append({
            "id": r.id,
            "model_id": r.model_id,
            "type": r.type,
            "name": r.name,
            "source_id": r.source_id,
            "source_name": r.source_element.name if r.source_element else "",
            "source_type": r.source_element.type if r.source_element else "",
            "target_id": r.target_id,
            "target_name": r.target_element.name if r.target_element else "",
            "target_type": r.target_element.type if r.target_element else "",
            "documentation": r.documentation
        })
    return results

@router.post("")
def create_relationship(model_id: str, payload: RelationshipCreate, db: Session = Depends(get_db)):
    """Creates a relationship between two ArchiMate elements after validating ArchiMate constraints."""
    src = db.query(ArchimateElement).filter(ArchimateElement.id == payload.source_id, ArchimateElement.model_id == model_id).first()
    tgt = db.query(ArchimateElement).filter(ArchimateElement.id == payload.target_id, ArchimateElement.model_id == model_id).first()
    if not src or not tgt:
        raise HTTPException(status_code=400, detail="Source or target element does not exist in this model workspace.")

    # Validate ArchiMate Metamodel constraints
    if not is_rel_type_allowed(src.type, tgt.type, payload.type):
        allowed_list = get_allowed_rel_names_for_types(src.type, tgt.type)
        raise HTTPException(
            status_code=400,
            detail=f"Relationship type '{payload.type}' is not permitted by ArchiMate 3.x between '{src.type}' and '{tgt.type}'. Allowed types: {', '.join(allowed_list)}"
        )

    # Normalize relationship type to full name ending in 'Relationship' if needed
    normalized_type = payload.type if payload.type.endswith("Relationship") else f"{payload.type}Relationship"

    rel_id = f"rel-{uuid.uuid4().hex[:8]}"
    rel = ArchimateRelationship(
        id=rel_id,
        model_id=model_id,
        source_id=payload.source_id,
        target_id=payload.target_id,
        type=normalized_type,
        name=payload.name or "",
        documentation=payload.documentation or ""
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)
    return {
        "id": rel.id,
        "type": rel.type,
        "name": rel.name,
        "source_id": rel.source_id,
        "source_name": src.name,
        "source_type": src.type,
        "target_id": rel.target_id,
        "target_name": tgt.name,
        "target_type": tgt.type,
        "documentation": rel.documentation
    }

@router.put("/{relationship_id}")
def update_relationship(relationship_id: str, payload: RelationshipUpdate, db: Session = Depends(get_db)):
    """Updates an existing relationship while validating ArchiMate constraints."""
    rel = db.query(ArchimateRelationship).filter(ArchimateRelationship.id == relationship_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")

    if payload.type is not None:
        src = rel.source_element
        tgt = rel.target_element
        if src and tgt:
            if not is_rel_type_allowed(src.type, tgt.type, payload.type):
                allowed_list = get_allowed_rel_names_for_types(src.type, tgt.type)
                raise HTTPException(
                    status_code=400,
                    detail=f"Relationship type '{payload.type}' is not permitted by ArchiMate 3.x between '{src.type}' and '{tgt.type}'. Allowed types: {', '.join(allowed_list)}"
                )
        normalized_type = payload.type if payload.type.endswith("Relationship") else f"{payload.type}Relationship"
        rel.type = normalized_type

    if payload.name is not None:
        rel.name = payload.name
    if payload.documentation is not None:
        rel.documentation = payload.documentation

    db.commit()
    db.refresh(rel)
    return {
        "id": rel.id,
        "type": rel.type,
        "name": rel.name,
        "source_id": rel.source_id,
        "source_name": rel.source_element.name if rel.source_element else "",
        "target_id": rel.target_id,
        "target_name": rel.target_element.name if rel.target_element else "",
        "documentation": rel.documentation
    }

@router.delete("/{relationship_id}")
def delete_relationship(relationship_id: str, db: Session = Depends(get_db)):
    """Deletes a relationship."""
    rel = db.query(ArchimateRelationship).filter(ArchimateRelationship.id == relationship_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    db.delete(rel)
    db.commit()
    return {"message": "Relationship deleted", "id": relationship_id}
