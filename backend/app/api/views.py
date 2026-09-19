from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.models.archimate import ArchimateView, ArchimateElement, ArchimateRelationship

router = APIRouter(prefix="/views", tags=["Diagram Views"])

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
            "type": rel.type if rel else "AssociationRelationship",
            "name": rel.name if rel else "",
            "source_node_id": c.get("source_node_id"),
            "target_node_id": c.get("target_node_id")
        })

    return {
        "id": v.id,
        "model_id": v.model_id,
        "name": v.name,
        "viewpoint": v.viewpoint,
        "documentation": v.documentation,
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

    db.commit()
    return {"message": "View updated successfully"}
