from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import uuid

from app.core.database import get_db
from app.models.archimate import (
    ArchimateElement,
    ApplicationBusinessAttributes,
    User,
    ElementStereotype,
    WorkspaceAttributePackage
)
from app.api.deps import get_current_user, require_library_permission
from app.parsers.archi_parser import detect_layer

router = APIRouter(prefix="/elements", tags=["ArchiMate Elements"])

class ElementCreate(BaseModel):
    name: str
    type: str
    layer: Optional[str] = None
    documentation: Optional[str] = ""
    properties: Optional[Dict[str, Any]] = {}
    stereotype_id: Optional[str] = None

class ElementUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    layer: Optional[str] = None
    documentation: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    stereotype_id: Optional[str] = None

def validate_and_apply_stereotype(
    db: Session,
    element_type: str,
    props: Dict[str, Any],
    stereotype_id: Optional[str]
) -> Optional[ElementStereotype]:
    if not stereotype_id:
        return None
    st = db.query(ElementStereotype).filter(ElementStereotype.id == stereotype_id).first()
    if not st:
        raise HTTPException(status_code=404, detail=f"Stereotype '{stereotype_id}' not found.")
    if st.base_type != element_type:
        raise HTTPException(
            status_code=400,
            detail=f"Lo stereotipo '{st.name}' è applicabile solo a elementi di tipo '{st.base_type}', non '{element_type}'."
        )
    # Validate required attribute links
    for link in st.attribute_links:
        if link.is_required:
            val = props.get(link.attribute_name)
            if val is None or (isinstance(val, str) and not val.strip()):
                raise HTTPException(
                    status_code=400,
                    detail=f"L'attributo '{link.attribute_name}' è obbligatorio per lo stereotipo {st.label}."
                )
    return st

def sync_apm_from_properties(apm: ApplicationBusinessAttributes, props: Dict[str, Any]):
    """Helper to update APM attributes from properties dict (supporting apm_ prefix, eea_ prefix or direct keys)."""
    if not apm or not props:
        return
    
    import re

    # Helper to get value from props with apm_ prefix, eea_ prefix, or direct key
    def get_val(key):
        if f"apm_{key}" in props:
            return props[f"apm_{key}"]
        if key in props:
            return props[key]
        eea_key = f"eea_{key}"
        if eea_key in props:
            return props[eea_key]
        return None

    def parse_score(val):
        if val is None or val == "":
            return None
        if isinstance(val, (int, float)):
            return int(val)
        m = re.search(r'\d+', str(val))
        return int(m.group(0)) if m else None

    raw_b = props.get("apm_functional_fit") or get_val("business_fit")
    b_fit = parse_score(raw_b)
    if b_fit is not None:
        apm.business_fit = b_fit

    raw_t = props.get("apm_technical_fit") or get_val("technical_fit")
    t_fit = parse_score(raw_t)
    if t_fit is not None:
        apm.technical_fit = t_fit

    time_q = props.get("apm_time_quadrant_override") or get_val("time_quadrant")
    if time_q is not None and str(time_q).strip() != "":
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
    stereotype_id: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List elements of a model filtered by Layer, Type, Stereotype, or Search query, including active framework elements."""
    active_links = db.query(WorkspaceAttributePackage.package_id).filter(
        WorkspaceAttributePackage.model_id == model_id
    ).all()
    active_pkg_ids = [r[0] for r in active_links]

    if active_pkg_ids:
        query = db.query(ArchimateElement).filter(
            (ArchimateElement.model_id == model_id) |
            ((ArchimateElement.is_reference == True) & (ArchimateElement.package_id.in_(active_pkg_ids)))
        )
    else:
        query = db.query(ArchimateElement).filter(ArchimateElement.model_id == model_id)

    if layer:
        query = query.filter(ArchimateElement.layer == layer)
    if type:
        query = query.filter(ArchimateElement.type == type)
    if stereotype_id:
        query = query.filter(ArchimateElement.stereotype_id == stereotype_id)
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
            "is_reference": bool(e.is_reference),
            "package_id": e.package_id,
            "package_code": e.package.code if e.package else None,
            "package_name": e.package.name if e.package else None,
            "name": e.name,
            "type": e.type,
            "layer": e.layer,
            "documentation": e.documentation,
            "properties": props,
            "stereotype_id": e.stereotype_id,
            "stereotype": {
                "id": e.stereotype.id,
                "name": e.stereotype.name,
                "label": e.stereotype.label,
                "icon_color": e.stereotype.icon_color
            } if e.stereotype else None,
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

@router.get("/search", response_model=List[Dict[str, Any]])
def search_elements(
    query: Optional[str] = Query(None, description="Search query string"),
    model_id: Optional[str] = Query(None, description="Filter by model ID"),
    layer: Optional[str] = Query(None, description="Filter by layer (e.g. Business, Application, Technology, Strategy)"),
    type: Optional[str] = Query(None, description="Filter by element type"),
    stereotype_id: Optional[str] = Query(None, description="Filter by stereotype ID"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search elements across models or within a model by name, documentation, type, or layer."""
    db_query = db.query(ArchimateElement)
    if model_id:
        active_links = db.query(WorkspaceAttributePackage.package_id).filter(
            WorkspaceAttributePackage.model_id == model_id
        ).all()
        active_pkg_ids = [r[0] for r in active_links]
        if active_pkg_ids:
            db_query = db_query.filter(
                (ArchimateElement.model_id == model_id) |
                ((ArchimateElement.is_reference == True) & (ArchimateElement.package_id.in_(active_pkg_ids)))
            )
        else:
            db_query = db_query.filter(ArchimateElement.model_id == model_id)
    if layer and layer.lower() != "all":
        db_query = db_query.filter(ArchimateElement.layer.ilike(layer))
    if type and type.lower() != "all":
        db_query = db_query.filter(ArchimateElement.type.ilike(type))
    if stereotype_id:
        db_query = db_query.filter(ArchimateElement.stereotype_id == stereotype_id)
    if query:
        term = f"%{query}%"
        db_query = db_query.filter(
            (ArchimateElement.name.ilike(term)) |
            (ArchimateElement.documentation.ilike(term)) |
            (ArchimateElement.type.ilike(term)) |
            (ArchimateElement.id.ilike(term))
        )

    db_query = db_query.order_by(ArchimateElement.layer.asc(), ArchimateElement.name.asc()).limit(limit)
    elements = db_query.all()

    results = []
    for e in elements:
        apm = e.apm_attributes
        props = dict(e.properties or {})
        results.append({
            "id": e.id,
            "model_id": e.model_id,
            "is_reference": bool(e.is_reference),
            "package_id": e.package_id,
            "package_code": e.package.code if e.package else None,
            "package_name": e.package.name if e.package else None,
            "name": e.name,
            "type": e.type,
            "layer": e.layer,
            "documentation": e.documentation,
            "properties": props,
            "stereotype_id": e.stereotype_id,
            "stereotype": {
                "id": e.stereotype.id,
                "name": e.stereotype.name,
                "label": e.stereotype.label,
                "icon_color": e.stereotype.icon_color
            } if e.stereotype else None
        })
    return results

@router.get("/{element_id}")
def get_element(
    element_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
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
        "is_reference": bool(e.is_reference),
        "package_id": e.package_id,
        "package_code": e.package.code if e.package else None,
        "package_name": e.package.name if e.package else None,
        "name": e.name,
        "type": e.type,
        "layer": e.layer,
        "documentation": e.documentation,
        "properties": props,
        "stereotype_id": e.stereotype_id,
        "stereotype": {
            "id": e.stereotype.id,
            "name": e.stereotype.name,
            "label": e.stereotype.label,
            "icon_color": e.stereotype.icon_color
        } if e.stereotype else None,
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
def create_element(
    model_id: str,
    payload: ElementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually creates a new ArchiMate element."""
    require_library_permission(db, current_user, "create_element", model_id)
    elem_id = f"elem-{uuid.uuid4().hex[:8]}"
    layer = payload.layer or detect_layer(payload.type)
    props = payload.properties or {}

    st = None
    if payload.stereotype_id:
        st = validate_and_apply_stereotype(db, payload.type, props, payload.stereotype_id)

    el = ArchimateElement(
        id=elem_id,
        model_id=model_id,
        name=payload.name,
        type=payload.type,
        layer=layer,
        documentation=payload.documentation,
        properties=props,
        stereotype_id=st.id if st else None
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
    return {
        "id": el.id,
        "name": el.name,
        "type": el.type,
        "layer": el.layer,
        "properties": el.properties,
        "stereotype_id": el.stereotype_id,
        "stereotype": {
            "id": el.stereotype.id,
            "name": el.stereotype.name,
            "label": el.stereotype.label,
            "icon_color": el.stereotype.icon_color
        } if el.stereotype else None
    }

@router.put("/{element_id}")
def update_element(
    element_id: str,
    payload: ElementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates an existing ArchiMate element."""
    el = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
    if not el:
        raise HTTPException(status_code=404, detail="Element not found")
    if el.is_reference:
        raise HTTPException(
            status_code=403,
            detail="Gli elementi canonici di riferimento forniti da uno standard industriale non possono essere modificati direttamente."
        )
    require_library_permission(db, current_user, "edit_element", el.model_id)

    target_type = payload.type or el.type
    props = dict(payload.properties if payload.properties is not None else (el.properties or {}))

    # Stereotype change or validation
    if payload.stereotype_id is not None:
        if payload.stereotype_id == "" or payload.stereotype_id is False:
            el.stereotype_id = None
        else:
            st = validate_and_apply_stereotype(db, target_type, props, payload.stereotype_id)
            el.stereotype_id = st.id if st else None
    elif el.stereotype_id and (payload.properties is not None or payload.type is not None):
        # Stereotype didn't change, but properties or type did; re-validate
        validate_and_apply_stereotype(db, target_type, props, el.stereotype_id)

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
    db.refresh(el)
    return {
        "message": "Element updated successfully",
        "id": el.id,
        "stereotype_id": el.stereotype_id,
        "stereotype": {
            "id": el.stereotype.id,
            "name": el.stereotype.name,
            "label": el.stereotype.label,
            "icon_color": el.stereotype.icon_color
        } if el.stereotype else None
    }

@router.delete("/{element_id}")
def delete_element(
    element_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes an ArchiMate element and all its relationships."""
    el = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
    if not el:
        raise HTTPException(status_code=404, detail="Element not found")
    if el.is_reference:
        raise HTTPException(
            status_code=403,
            detail="Gli elementi canonici di riferimento forniti da uno standard industriale non possono essere eliminati."
        )
    require_library_permission(db, current_user, "delete_element", el.model_id)
    db.delete(el)
    db.commit()
    return {"message": "Element deleted"}
