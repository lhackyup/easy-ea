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

def sync_apm_from_properties(apm: ApplicationBusinessAttributes, props: Dict[str, Any]):
    """Helper to update APM attributes from properties dict (supporting eea_ prefix or direct keys)."""
    if not apm or not props:
        return
    
    # Helper to get value from props with or without eea_ prefix
    def get_val(key):
        if key in props:
            return props[key]
        eea_key = f"eea_{key}"
        if eea_key in props:
            return props[eea_key]
        return None

    b_fit = get_val("business_fit")
    if b_fit is not None:
        try:
            apm.business_fit = int(b_fit)
        except (ValueError, TypeError):
            pass

    t_fit = get_val("technical_fit")
    if t_fit is not None:
        try:
            apm.technical_fit = int(t_fit)
        except (ValueError, TypeError):
            pass

    time_q = get_val("time_quadrant")
    if time_q is not None:
        apm.time_quadrant = str(time_q)

    ann_cost = get_val("annual_cost")
    if ann_cost is not None:
        try:
            apm.annual_cost = float(ann_cost)
        except (ValueError, TypeError):
            pass

    b_crit = get_val("business_criticality")
    if b_crit is not None:
        apm.business_criticality = str(b_crit)

    l_stat = get_val("lifecycle_status")
    if l_stat is not None:
        apm.lifecycle_status = str(l_stat)

    b_owner = get_val("business_owner")
    if b_owner is not None:
        apm.business_owner = str(b_owner)

    t_owner = get_val("technical_owner")
    if t_owner is not None:
        apm.technical_owner = str(t_owner)

    vendor = get_val("vendor")
    if vendor is not None:
        apm.vendor = str(vendor)

    hosting = get_val("hosting_type")
    if hosting is not None:
        apm.hosting_type = str(hosting)

    data_class = get_val("data_classification")
    if data_class is not None:
        apm.data_classification = str(data_class)

    sla = get_val("sla_level")
    if sla is not None:
        apm.sla_level = str(sla)

    in_scope = get_val("in_apm_scope")
    if in_scope is not None:
        if isinstance(in_scope, bool):
            apm.in_apm_scope = in_scope
        elif isinstance(in_scope, str):
            apm.in_apm_scope = in_scope.lower() in ("true", "1", "yes")

    notes = get_val("notes")
    if notes is not None:
        apm.notes = str(notes)


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
        props = dict(e.properties or {})
        # Merge APM fields into props for seamless view if e.apm_attributes exists
        if apm:
            apm_map = {
                "eea_in_apm_scope": apm.in_apm_scope,
                "eea_business_fit": apm.business_fit,
                "eea_technical_fit": apm.technical_fit,
                "eea_time_quadrant": apm.time_quadrant,
                "eea_annual_cost": apm.annual_cost,
                "eea_business_criticality": apm.business_criticality,
                "eea_lifecycle_status": apm.lifecycle_status,
                "eea_business_owner": apm.business_owner,
                "eea_technical_owner": apm.technical_owner,
                "eea_vendor": apm.vendor,
                "eea_hosting_type": apm.hosting_type,
                "eea_data_classification": apm.data_classification,
            }
            for k, v in apm_map.items():
                if k not in props and v is not None:
                    props[k] = v

        results.append({
            "id": e.id,
            "model_id": e.model_id,
            "name": e.name,
            "type": e.type,
            "layer": e.layer,
            "documentation": e.documentation,
            "properties": props,
            "incoming_count": len(e.incoming_relations or []),
            "outgoing_count": len(e.outgoing_relations or []),
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
    props = dict(e.properties or {})
    if apm:
        apm_map = {
            "eea_in_apm_scope": apm.in_apm_scope,
            "eea_business_fit": apm.business_fit,
            "eea_technical_fit": apm.technical_fit,
            "eea_time_quadrant": apm.time_quadrant,
            "eea_annual_cost": apm.annual_cost,
            "eea_business_criticality": apm.business_criticality,
            "eea_lifecycle_status": apm.lifecycle_status,
            "eea_business_owner": apm.business_owner,
            "eea_technical_owner": apm.technical_owner,
            "eea_vendor": apm.vendor,
            "eea_hosting_type": apm.hosting_type,
            "eea_data_classification": apm.data_classification,
        }
        for k, v in apm_map.items():
            if k not in props and v is not None:
                props[k] = v

    return {
        "id": e.id,
        "model_id": e.model_id,
        "name": e.name,
        "type": e.type,
        "layer": e.layer,
        "documentation": e.documentation,
        "properties": props,
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
            {
                "id": r.id,
                "type": r.type,
                "name": r.name,
                "target_id": r.target_id,
                "target_name": r.target_element.name if r.target_element else "",
                "target_type": r.target_element.type if r.target_element else "ApplicationComponent",
                "target_layer": r.target_element.layer if r.target_element else ""
            }
            for r in e.outgoing_relations
        ],
        "incoming_relations": [
            {
                "id": r.id,
                "type": r.type,
                "name": r.name,
                "source_id": r.source_id,
                "source_name": r.source_element.name if r.source_element else "",
                "source_type": r.source_element.type if r.source_element else "ApplicationComponent",
                "source_layer": r.source_element.layer if r.source_element else ""
            }
            for r in e.incoming_relations
        ]
    }

@router.post("")
def create_element(model_id: str, payload: ElementCreate, db: Session = Depends(get_db)):
    """Manually creates a new ArchiMate element."""
    elem_id = f"elem-{uuid.uuid4().hex[:8]}"
    layer = payload.layer or detect_layer(payload.type)
    props = payload.properties or {}
    el = ArchimateElement(
        id=elem_id,
        model_id=model_id,
        name=payload.name,
        type=payload.type,
        layer=layer,
        documentation=payload.documentation,
        properties=props
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
        sync_apm_from_properties(apm, props)
        db.add(apm)

    db.commit()
    db.refresh(el)
    return {"id": el.id, "name": el.name, "type": el.type, "layer": el.layer, "properties": el.properties}

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
        if el.type == "ApplicationComponent":
            if not el.apm_attributes:
                apm = ApplicationBusinessAttributes(
                    element_id=el.id,
                    business_fit=3,
                    technical_fit=3,
                    time_quadrant="Tolerate",
                    annual_cost=0.0
                )
                db.add(apm)
                el.apm_attributes = apm
            sync_apm_from_properties(el.apm_attributes, payload.properties)

    db.commit()
    return {"message": "Element updated successfully", "id": el.id}

@router.delete("/{element_id}")
def delete_element(element_id: str, db: Session = Depends(get_db)):
    """Deletes an ArchiMate element and all its relationships."""
    el = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
    if not el:
        raise HTTPException(status_code=404, detail="Element not found")
    db.delete(el)
    db.commit()
    return {"message": "Element deleted"}
