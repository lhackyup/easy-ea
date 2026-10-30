import re
import uuid
from typing import Dict, List, Any, Optional, Set, Tuple
from xml.etree.ElementTree import Element, SubElement, tostring
from defusedxml.minidom import parseString as safe_minidom_parse_string
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.archimate import (
    ModelWorkspace,
    ArchimateElement,
    ArchimateRelationship,
    ArchimateView
)
from app.parsers.archi_parser import LAYER_MAPPING


def _clean_str(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


def export_model_to_archimate_xml(
    model_id: str,
    db: Session,
    view_id: Optional[str] = None
) -> Tuple[str, str]:
    """
    Exports a complete model workspace (or specific view) as a valid Archi native
    model file (.archimate format) with full element, relationship, property,
    and diagram view preservation.
    """
    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model workspace not found")

    target_view = None
    if view_id:
        target_view = db.query(ArchimateView).filter(
            ArchimateView.id == view_id,
            ArchimateView.model_id == model_id
        ).first()
        if not target_view:
            raise HTTPException(status_code=404, detail="Diagram view not found in this model")

    # Fetch elements, relationships, and views
    if target_view and target_view.view_data:
        v_data = target_view.view_data or {}
        v_nodes = v_data.get("nodes", [])
        v_conns = v_data.get("connections", [])
        
        referenced_elem_ids = set()
        for n in v_nodes:
            e_id = n.get("element_id") or n.get("id")
            if e_id:
                referenced_elem_ids.add(e_id)
        
        referenced_rel_ids = set()
        for c in v_conns:
            r_id = c.get("relationship_id")
            if r_id:
                referenced_rel_ids.add(r_id)

        relationships = []
        if referenced_rel_ids:
            relationships = db.query(ArchimateRelationship).filter(
                ArchimateRelationship.model_id == model_id,
                ArchimateRelationship.id.in_(referenced_rel_ids)
            ).all()

        for r in relationships:
            if r.source_id:
                referenced_elem_ids.add(r.source_id)
            if r.target_id:
                referenced_elem_ids.add(r.target_id)

        elements = []
        if referenced_elem_ids:
            elements = db.query(ArchimateElement).filter(
                ArchimateElement.model_id == model_id,
                ArchimateElement.id.in_(referenced_elem_ids)
            ).all()

        views = [target_view]
    else:
        elements = db.query(ArchimateElement).filter(ArchimateElement.model_id == model_id).all()
        relationships = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == model_id).all()
        views = db.query(ArchimateView).filter(ArchimateView.model_id == model_id).all()

    # Build XML Root
    root = Element(
        "archimate:model",
        {
            "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "xmlns:archimate": "http://www.archimatetool.com/archimate",
            "name": (target_view.name if target_view else model.name) or "ArchiMate Model",
            "id": f"id-{target_view.id if target_view else model.id}",
            "version": "5.0.0"
        }
    )

    # Model Documentation
    doc_text = (target_view.documentation if target_view else model.description) or ""
    if doc_text:
        doc_elem = SubElement(root, "documentation")
        doc_elem.text = doc_text

    # Standard Folder definitions
    folders_meta = [
        ("Strategy", "strategy", "id-folder-strategy"),
        ("Business", "business", "id-folder-business"),
        ("Application", "application", "id-folder-application"),
        ("Technology & Physical", "technology", "id-folder-technology"),
        ("Motivation", "motivation", "id-folder-motivation"),
        ("Implementation & Migration", "implementation_migration", "id-folder-implementation"),
        ("Other", "other", "id-folder-other"),
        ("Relations", "relations", "id-folder-relations"),
        ("Views", "diagrams", "id-folder-views"),
    ]

    folder_elems = {}
    for f_name, f_type, f_id in folders_meta:
        f_el = SubElement(root, "folder", {"name": f_name, "id": f_id, "type": f_type})
        folder_elems[f_type] = f_el

    # Add Elements to matching layer folder
    elem_ids = set()
    for el in elements:
        elem_ids.add(el.id)
        layer = el.layer or LAYER_MAPPING.get(el.type, "Other")
        layer_lower = layer.lower()
        target_f_type = "other"
        for k in ["strategy", "business", "application", "technology", "motivation", "implementation"]:
            if k in layer_lower:
                target_f_type = "implementation_migration" if k == "implementation" else k
                break

        parent_folder = folder_elems.get(target_f_type, folder_elems["other"])
        clean_type = el.type if el.type.startswith("archimate:") else f"archimate:{el.type}"
        
        el_node = SubElement(
            parent_folder,
            "element",
            {
                "xsi:type": clean_type,
                "id": el.id,
                "name": el.name or ""
            }
        )
        if el.documentation:
            doc_el = SubElement(el_node, "documentation")
            doc_el.text = el.documentation

        # Export properties
        props_to_write: Dict[str, Any] = {}
        if isinstance(el.properties, dict):
            props_to_write.update(el.properties)
        
        # Include APM metrics if present
        if hasattr(el, "apm_attributes") and el.apm_attributes:
            apm = el.apm_attributes
            if apm.business_fit is not None:
                props_to_write["apm_business_fit"] = apm.business_fit
            if apm.technical_fit is not None:
                props_to_write["apm_technical_fit"] = apm.technical_fit
            if apm.time_quadrant:
                props_to_write["apm_time_quadrant"] = apm.time_quadrant
            if apm.annual_cost is not None:
                props_to_write["apm_annual_cost"] = apm.annual_cost
            if apm.business_criticality:
                props_to_write["apm_business_criticality"] = apm.business_criticality
            if apm.lifecycle_status:
                props_to_write["apm_lifecycle_status"] = apm.lifecycle_status
            if apm.business_owner:
                props_to_write["apm_business_owner"] = apm.business_owner
            if apm.vendor:
                props_to_write["apm_vendor"] = apm.vendor
            if apm.hosting_type:
                props_to_write["apm_hosting_type"] = apm.hosting_type

        for p_key, p_val in props_to_write.items():
            if p_val is not None and str(p_val) != "":
                SubElement(el_node, "property", {"key": str(p_key), "value": str(p_val)})

    # Add Relationships to Relations folder
    rel_ids = set()
    for rel in relationships:
        rel_ids.add(rel.id)
        rel_folder = folder_elems["relations"]
        raw_type = rel.type.replace("archimate:", "")
        if not raw_type.endswith("Relationship") and not raw_type.endswith("Association"):
            raw_type = f"{raw_type}Relationship"
        clean_rel_type = f"archimate:{raw_type}"

        rel_node = SubElement(
            rel_folder,
            "element",
            {
                "xsi:type": clean_rel_type,
                "id": rel.id,
                "source": rel.source_id,
                "target": rel.target_id,
                "name": rel.name or ""
            }
        )
        if rel.documentation:
            doc_el = SubElement(rel_node, "documentation")
            doc_el.text = rel.documentation
        if isinstance(rel.properties, dict):
            for p_key, p_val in rel.properties.items():
                if p_val is not None and str(p_val) != "":
                    SubElement(rel_node, "property", {"key": str(p_key), "value": str(p_val)})

    # Add Diagram Views in Views folder
    views_folder = folder_elems["diagrams"]
    for v in views:
        diag_node = SubElement(
            views_folder,
            "element",
            {
                "xsi:type": "archimate:ArchimateDiagramModel",
                "id": v.id,
                "name": v.name or "Diagram View",
                "viewpoint": v.viewpoint or "Total"
            }
        )
        if v.documentation:
            doc_el = SubElement(diag_node, "documentation")
            doc_el.text = v.documentation

        v_data = v.view_data or {}
        nodes = v_data.get("nodes", [])
        connections = v_data.get("connections", [])

        # Filter valid connections whose source and target exist among diagram nodes
        node_id_set = {n.get("id") for n in nodes if n.get("id")}
        valid_connections = []
        for c in connections:
            s_id = c.get("source_node_id") or c.get("source")
            t_id = c.get("target_node_id") or c.get("target")
            if s_id in node_id_set and t_id in node_id_set:
                c_copy = dict(c)
                if not c_copy.get("id"):
                    c_copy["id"] = f"conn-{v.id}-{uuid.uuid4().hex[:6]}"
                valid_connections.append(c_copy)

        # Map target connections: Node ID -> List of connection IDs targeting this node
        target_conns_map: Dict[str, List[str]] = {}
        for c in valid_connections:
            t_id = c.get("target_node_id") or c.get("target")
            c_id = c["id"]
            target_conns_map.setdefault(t_id, []).append(c_id)

        # Render diagram child objects (nodes)
        for n in nodes:
            node_id = n.get("id") or f"node-{uuid.uuid4().hex[:8]}"
            elem_id = n.get("element_id")

            child_attrs = {
                "xsi:type": "archimate:DiagramObject",
                "id": node_id
            }
            if elem_id and elem_id in elem_ids:
                child_attrs["archimateElement"] = elem_id

            if node_id in target_conns_map:
                child_attrs["targetConnections"] = " ".join(target_conns_map[node_id])

            child_el = SubElement(diag_node, "child", child_attrs)

            # Node bounds
            x = int(n.get("x", n.get("position", {}).get("x", 100)))
            y = int(n.get("y", n.get("position", {}).get("y", 100)))
            w = int(n.get("width", n.get("style", {}).get("width", 140)))
            h = int(n.get("height", n.get("style", {}).get("height", 60)))
            SubElement(child_el, "bounds", {
                "x": str(x),
                "y": str(y),
                "width": str(w),
                "height": str(h)
            })

            # Source connections on this node
            for c in valid_connections:
                s_id = c.get("source_node_id") or c.get("source")
                if s_id == node_id:
                    conn_id = c["id"]
                    t_node_id = c.get("target_node_id") or c.get("target")
                    rel_id = c.get("relationship_id")

                    conn_attrs = {
                        "xsi:type": "archimate:Connection",
                        "id": conn_id,
                        "source": node_id,
                        "target": str(t_node_id)
                    }
                    if rel_id and rel_id in rel_ids:
                        conn_attrs["archimateRelationship"] = rel_id
                    SubElement(child_el, "sourceConnection", conn_attrs)

    # Root metadata properties for traceability
    lib_name = model.name or "Enterprise Architecture Library"
    lib_code = model.code or ""
    SubElement(root, "property", {"key": "EasyEA_Model_ID", "value": str(model.id)})
    SubElement(root, "property", {"key": "EasyEA_Library_Name", "value": str(lib_name)})
    if lib_code:
        SubElement(root, "property", {"key": "EasyEA_Library_Code", "value": str(lib_code)})
    if model.version:
        SubElement(root, "property", {"key": "EasyEA_Version", "value": str(model.version)})

    # Format pretty XML
    rough_str = tostring(root, encoding="utf-8")
    reparsed = safe_minidom_parse_string(
        rough_str,
        forbid_dtd=True,
        forbid_entities=True,
        forbid_external=True,
    )
    pretty_xml = reparsed.toprettyxml(indent="  ", encoding="UTF-8").decode("utf-8")

    safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', (target_view.name if target_view else model.name) or "archimate_model")
    filename = f"{safe_name}.archimate"

    return pretty_xml, filename
