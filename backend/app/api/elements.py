from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import uuid

from app.core.database import get_db
from app.models.archimate import ArchimateElement, ApplicationBusinessAttributes
from app.parsers.archi_parser import detect_layer

router = APIRouter(prefix="/elements", tags=["ArchiMate Elements"])

class ElementCreate(BaseModel):
    name: str
    type: str
    layer: Optional[str] = None
    documentation: Optional[str] = ""
    properties: Optional[Dict[str, Any]] = {}

class ElementUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    layer: Optional[str] = None
    documentation: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None

@router.get("", response_model=List[Dict[str, Any]])
def list_elements(
    model_id: str,
    layer: Optional[str] = None,
    type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List elements of a model filtered by Layer, Type, or Search query."""
    query = db.query(ArchimateElement).filter(ArchimateElement.model_id == model_id)
    if layer:
        query = query.filter(ArchimateElement.layer == layer)
    if type:
        query = query.filter(ArchimateElement.type == type)
    if search:
        query = query.filter(ArchimateElement.name.ilike(f"%{search}%"))

    elements = query.all()
    results = []
    for e in elements:
        apm = e.apm_attributes
        results.append({
            "id": e.id,
            "model_id": e.model_id,
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
                "criticality": apm.business_criticality,
                "lifecycle_status": apm.lifecycle_status,
                "business_owner": apm.business_owner,
                "vendor": apm.vendor,
                "hosting_type": apm.hosting_type,
                "in_apm_scope": apm.in_apm_scope
            } if apm else None
        })
    return results

@router.get("/{element_id}")
def get_element(element_id: str, db: Session = Depends(get_db)):
    """Retrieve details for a specific element including incoming/outgoing relationships."""
    e = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Element not found")

    apm = e.apm_attributes
    return {
        "id": e.id,
        "model_id": e.model_id,
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
            "technical_owner": apm.technical_owner,
            "vendor": apm.vendor,
            "hosting_type": apm.hosting_type,
            "data_classification": apm.data_classification,
            "sla_level": apm.sla_level,
            "notes": apm.notes
        } if apm else None,
        "outgoing_relations": [
            {"id": r.id, "type": r.type, "name": r.name, "target_id": r.target_id, "target_name": r.target_element.name if r.target_element else ""}
            for r in e.outgoing_relations
        ],
        "incoming_relations": [
            {"id": r.id, "type": r.type, "name": r.name, "source_id": r.source_id, "source_name": r.source_element.name if r.source_element else ""}
            for r in e.incoming_relations
        ]
    }

@router.post("")
def create_element(model_id: str, payload: ElementCreate, db: Session = Depends(get_db)):
    """Manually creates a new ArchiMate element."""
    elem_id = f"elem-{uuid.uuid4().hex[:8]}"
    layer = payload.layer or detect_layer(payload.type)
    el = ArchimateElement(
        id=elem_id,
        model_id=model_id,
        name=payload.name,
        type=payload.type,
        layer=layer,
        documentation=payload.documentation,
        properties=payload.properties or {}
    )
    db.add(el)

    if payload.type == "ApplicationComponent":
        apm = ApplicationBusinessAttributes(
            element_id=elem_id,
            business_fit=3,
            technical_fit=3,
            time_quadrant="Tolerate",
            annual_cost=0.0
        )
        db.add(apm)

    db.commit()
    db.refresh(el)
    return {"id": el.id, "name": el.name, "type": el.type, "layer": el.layer}

@router.put("/{element_id}")
def update_element(element_id: str, payload: ElementUpdate, db: Session = Depends(get_db)):
    """Updates an existing ArchiMate element."""
    el = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
    if not el:
        raise HTTPException(status_code=404, detail="Element not found")

    if payload.name is not None:
        el.name = payload.name
    if payload.type is not None:
        el.type = payload.type
        el.layer = payload.layer or detect_layer(payload.type)
    elif payload.layer is not None:
        el.layer = payload.layer
    if payload.documentation is not None:
        el.documentation = payload.documentation
    if payload.properties is not None:
        el.properties = payload.properties

    db.commit()
    return {"message": "Element updated successfully"}

@router.delete("/{element_id}")
def delete_element(element_id: str, db: Session = Depends(get_db)):
    """Deletes an ArchiMate element and all its relationships."""
    el = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
    if not el:
        raise HTTPException(status_code=404, detail="Element not found")
    db.delete(el)
    db.commit()
    return {"message": "Element deleted"}
