from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import uuid

from app.core.database import get_db
from app.models.archimate import ArchimateRelationship, ArchimateElement

router = APIRouter(prefix="/relationships", tags=["ArchiMate Relationships"])

class RelationshipCreate(BaseModel):
    source_id: str
    target_id: str
    type: str
    name: Optional[str] = ""
    documentation: Optional[str] = ""

@router.get("", response_model=List[Dict[str, Any]])
def list_relationships(model_id: str, type: Optional[str] = None, db: Session = Depends(get_db)):
    """List relationships for a model, optionally filtered by relationship type."""
    query = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == model_id)
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
    """Creates a relationship between two ArchiMate elements."""
    src = db.query(ArchimateElement).filter(ArchimateElement.id == payload.source_id, ArchimateElement.model_id == model_id).first()
    tgt = db.query(ArchimateElement).filter(ArchimateElement.id == payload.target_id, ArchimateElement.model_id == model_id).first()
    if not src or not tgt:
        raise HTTPException(status_code=400, detail="Source or target element does not exist in this model")

    rel_id = f"rel-{uuid.uuid4().hex[:8]}"
    rel = ArchimateRelationship(
        id=rel_id,
        model_id=model_id,
        source_id=payload.source_id,
        target_id=payload.target_id,
        type=payload.type,
        name=payload.name,
        documentation=payload.documentation
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)
    return {"id": rel.id, "type": rel.type, "source_id": rel.source_id, "target_id": rel.target_id}

@router.delete("/{relationship_id}")
def delete_relationship(relationship_id: str, db: Session = Depends(get_db)):
    """Deletes a relationship."""
    rel = db.query(ArchimateRelationship).filter(ArchimateRelationship.id == relationship_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    db.delete(rel)
    db.commit()
    return {"message": "Relationship deleted"}
