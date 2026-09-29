import uuid
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from sqlalchemy.orm.attributes import flag_modified

from app.core.database import get_db
from app.models.archimate import ArchimateView, ArchimateElement, ArchimateRelationship
from app.services.drawio_service import export_view_to_drawio

router = APIRouter(prefix="/views", tags=["Diagram Views"])

class ViewCreate(BaseModel):
    name: str
    viewpoint: Optional[str] = "Total"
    documentation: Optional[str] = ""
    view_data: Optional[Dict[str, Any]] = None

class ViewUpdate(BaseModel):
    name: Optional[str] = None
    viewpoint: Optional[str] = None
    documentation: Optional[str] = None
    view_data: Optional[Dict[str, Any]] = None

@router.get("", response_model=List[Dict[str, Any]])
def list_views(model_id: str, db: Session = Depends(get_db)):
    """List all diagram views in the model."""
    views = db.query(ArchimateView).filter(ArchimateView.model_id == model_id).all()
    results = []
    for v in views:
        node_count = len(v.view_data.get("nodes", [])) if v.view_data else 0
        conn_count = len(v.view_data.get("connections", [])) if v.view_data else 0
        results.append({
            "id": v.id,
            "model_id": v.model_id,
            "name": v.name,
            "viewpoint": v.viewpoint,
            "documentation": v.documentation,
            "node_count": node_count,
            "connection_count": conn_count
        })
    return results

@router.get("/{view_id}")
def get_view(view_id: str, db: Session = Depends(get_db)):
    """
    Returns full diagram view structure ready for rendering (e.g., in React Flow),
    with populated element details (type, layer, documentation, APM info).
    """
    v = db.query(ArchimateView).filter(ArchimateView.id == view_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="View not found")

    view_data = v.view_data or {"nodes": [], "connections": []}
    nodes = view_data.get("nodes", [])
    connections = view_data.get("connections", [])

    # Enrich nodes with element details
    element_ids = [n.get("element_id") for n in nodes if n.get("element_id")]
    elements = {e.id: e for e in db.query(ArchimateElement).filter(ArchimateElement.id.in_(element_ids)).all()}

    enriched_nodes = []
    for n in nodes:
        elem = elements.get(n.get("element_id"))
        enriched_nodes.append({
            "id": n.get("id"),
            "element_id": n.get("element_id"),
            "name": elem.name if elem else n.get("name", "Node"),
            "type": elem.type if elem else "ApplicationComponent",
            "layer": elem.layer if elem else "Application",
            "documentation": elem.documentation if elem else "",
            "x": n.get("x", 0),
            "y": n.get("y", 0),
            "width": n.get("width", 160),
            "height": n.get("height", 65),
            "parent_id": n.get("parent_id")
        })

    # Enrich connections with relationship details
    rel_ids = [c.get("relationship_id") for c in connections if c.get("relationship_id")]
    relationships = {r.id: r for r in db.query(ArchimateRelationship).filter(ArchimateRelationship.id.in_(rel_ids)).all()}

    enriched_connections = []
    for c in connections:
        rel = relationships.get(c.get("relationship_id"))
        enriched_connections.append({
            "id": c.get("id"),
            "relationship_id": c.get("relationship_id"),
            "type": rel.type if rel else c.get("type", "AssociationRelationship"),
            "name": rel.name if (rel and rel.name) else c.get("name", ""),
            "source_node_id": c.get("source_node_id"),
            "target_node_id": c.get("target_node_id")
        })

    return {
        "id": v.id,
        "model_id": v.model_id,
        "name": v.name,
        "viewpoint": v.viewpoint,
        "documentation": v.documentation,
        "drawio_xml": view_data.get("drawio_xml"),
        "nodes": enriched_nodes,
        "connections": enriched_connections
    }

@router.put("/{view_id}")
def update_view(view_id: str, payload: ViewUpdate, db: Session = Depends(get_db)):
    """Update view details or visual layout."""
    v = db.query(ArchimateView).filter(ArchimateView.id == view_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="View not found")

    if payload.name is not None:
        v.name = payload.name
    if payload.viewpoint is not None:
        v.viewpoint = payload.viewpoint
    if payload.documentation is not None:
        v.documentation = payload.documentation
    if payload.view_data is not None:
        v.view_data = payload.view_data
        flag_modified(v, "view_data")

    db.commit()
    return {"message": "View updated successfully"}

@router.post("", response_model=Dict[str, Any])
def create_view(model_id: str, payload: ViewCreate, db: Session = Depends(get_db)):
    """Create a new diagram view."""
    view_id = f"view-{uuid.uuid4().hex[:12]}"
    new_view = ArchimateView(
        id=view_id,
        model_id=model_id,
        name=payload.name,
        viewpoint=payload.viewpoint,
        documentation=payload.documentation,
        view_data=payload.view_data or {"nodes": [], "connections": []}
    )
    db.add(new_view)
    db.commit()
    db.refresh(new_view)
    return {
        "id": new_view.id,
        "model_id": new_view.model_id,
        "name": new_view.name,
        "viewpoint": new_view.viewpoint,
        "documentation": new_view.documentation,
        "message": "View created successfully"
    }

@router.delete("/{view_id}")
def delete_view(view_id: str, db: Session = Depends(get_db)):
    """Delete a diagram view."""
    v = db.query(ArchimateView).filter(ArchimateView.id == view_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="View not found")
    db.delete(v)
    db.commit()
    return {"message": "View deleted successfully"}

@router.get("/{view_id}/drawio")
def export_view_drawio(view_id: str, db: Session = Depends(get_db)):
    """Export single view as .drawio XML file."""
    view = db.query(ArchimateView).filter(ArchimateView.id == view_id).first()
    if not view:
        raise HTTPException(status_code=404, detail="View not found")
    
    xml_content = export_view_to_drawio(view_id, db)
    filename = f"{view.name.replace(' ', '_')}.drawio"
    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


