import xml.etree.ElementTree as ET
import uuid
import re
import html
from datetime import datetime
from typing import Dict, List, Any, Optional, Set
from sqlalchemy.orm import Session

from app.models.archimate import (
    ModelWorkspace,
    ArchimateView,
    ArchimateElement,
    ArchimateRelationship,
    ArchiSchema
)
from app.parsers.archi_parser import LAYER_MAPPING, detect_layer

def clean_html_label(raw: Optional[str]) -> str:
    """Strips HTML formatting (e.g. <div>, <span>, <br>) and unescapes entities from Draw.io labels."""
    if not raw:
        return ""
    # Unescape entities (e.g. &lt;div&gt; -> <div>)
    unescaped = html.unescape(raw)
    # Strip HTML tags
    cleaned = re.sub(r"<[^>]+>", " ", unescaped)
    # Strip non-breaking spaces and collapse whitespace
    cleaned = re.sub(r"&nbsp;", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned

# ArchiMate Layer Color Standards for draw.io
LAYER_COLORS = {
    "Strategy": {"fill": "#F5DEAA", "stroke": "#C89234", "text": "#5C3806"},
    "Business": {"fill": "#FFFFB5", "stroke": "#C4B827", "text": "#4B4204"},
    "Application": {"fill": "#B5FFFF", "stroke": "#40A9C4", "text": "#053B47"},
    "Technology": {"fill": "#C9E7B7", "stroke": "#6EA84B", "text": "#1E430B"},
    "Physical": {"fill": "#C9E7B7", "stroke": "#6EA84B", "text": "#1E430B"},
    "Motivation": {"fill": "#CCCCFF", "stroke": "#7575C7", "text": "#1E1E5E"},
    "Implementation": {"fill": "#FFE0E0", "stroke": "#C77A7A", "text": "#531B1B"}
}

# Shape style templates per ArchiMate Type
SHAPE_STYLES = {
    "BusinessActor": "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;",
    "BusinessRole": "rounded=1;whiteSpace=wrap;html=1;arcSize=10;",
    "BusinessProcess": "shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;",
    "BusinessFunction": "rounded=1;whiteSpace=wrap;html=1;arcSize=10;",
    "BusinessService": "rounded=1;whiteSpace=wrap;html=1;arcSize=25;",
    "BusinessEvent": "shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;",
    "BusinessObject": "rounded=0;whiteSpace=wrap;html=1;",
    "ApplicationComponent": "rounded=1;whiteSpace=wrap;html=1;arcSize=10;",
    "ApplicationInterface": "ellipse;whiteSpace=wrap;html=1;",
    "ApplicationService": "rounded=1;whiteSpace=wrap;html=1;arcSize=25;",
    "ApplicationProcess": "shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;",
    "DataObject": "rounded=0;whiteSpace=wrap;html=1;",
    "Node": "shape=cube;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;darkOpacity=0.05;darkOpacity2=0.1;",
    "Device": "shape=cube;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;darkOpacity=0.05;darkOpacity2=0.1;",
    "SystemSoftware": "shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;",
    "TechnologyService": "rounded=1;whiteSpace=wrap;html=1;arcSize=25;",
    "Artifact": "shape=document;whiteSpace=wrap;html=1;boundedLbl=1;",
    "Goal": "shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;",
    "Principle": "rounded=1;whiteSpace=wrap;html=1;arcSize=10;",
    "Requirement": "shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;",
    "Constraint": "shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;",
    "WorkPackage": "rounded=1;whiteSpace=wrap;html=1;arcSize=10;",
    "Deliverable": "shape=document;whiteSpace=wrap;html=1;boundedLbl=1;",
    "Plateau": "rounded=1;whiteSpace=wrap;html=1;arcSize=10;"
}

# Relationship styles
RELATIONSHIP_STYLES = {
    "ServingRelationship": "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=open;endFill=0;strokeColor=#4F46E5;strokeWidth=2;",
    "RealizationRelationship": "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;endArrow=block;endFill=0;strokeColor=#0284C7;strokeWidth=2;",
    "AssignmentRelationship": "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=oval;endFill=1;startArrow=oval;startFill=1;strokeColor=#059669;strokeWidth=2;",
    "CompositionRelationship": "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;startArrow=diamond;startFill=1;endArrow=none;strokeColor=#1E293B;strokeWidth=2;",
    "AggregationRelationship": "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;startArrow=diamond;startFill=0;endArrow=none;strokeColor=#475569;strokeWidth=2;",
    "AccessRelationship": "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;endArrow=open;endFill=0;strokeColor=#D97706;strokeWidth=2;",
    "TriggeringRelationship": "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=classic;endFill=1;strokeColor=#DC2626;strokeWidth=2;",
    "FlowRelationship": "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;endArrow=classic;endFill=1;strokeColor=#7C3AED;strokeWidth=2;",
    "SpecializationRelationship": "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;endFill=0;strokeColor=#0F766E;strokeWidth=2;",
    "AssociationRelationship": "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=none;strokeColor=#64748B;strokeWidth=2;"
}


def _get_shape_style(elem_type: str, layer: str) -> str:
    base_style = SHAPE_STYLES.get(elem_type, "rounded=1;whiteSpace=wrap;html=1;arcSize=10;")
    colors = LAYER_COLORS.get(layer, LAYER_COLORS["Application"])
    return f"{base_style}fillColor={colors['fill']};strokeColor={colors['stroke']};fontColor={colors['text']};fontStyle=1;"


def _get_rel_style(rel_type: str) -> str:
    return RELATIONSHIP_STYLES.get(rel_type, "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=open;strokeColor=#4F46E5;strokeWidth=2;")


def build_diagram_xml_element(view: ArchimateView, db: Session) -> ET.Element:
    """Builds a single <diagram> XML element representing an ArchimateView."""
    diagram_el = ET.Element("diagram", {"id": view.id, "name": view.name or "View"})
    graph_model = ET.SubElement(
        diagram_el,
        "mxGraphModel",
        {
            "dx": "1200",
            "dy": "800",
            "grid": "1",
            "gridSize": "10",
            "guides": "1",
            "tooltips": "1",
            "connect": "1",
            "arrows": "1",
            "fold": "1",
            "page": "1",
            "pageScale": "1",
            "pageWidth": "1600",
            "pageHeight": "1200",
            "math": "0",
            "shadow": "0"
        }
    )
    root_el = ET.SubElement(graph_model, "root")
    ET.SubElement(root_el, "mxCell", {"id": "0"})
    ET.SubElement(root_el, "mxCell", {"id": "1", "parent": "0"})

    view_data = view.view_data or {}
    nodes = view_data.get("nodes", [])
    connections = view_data.get("connections", [])

    # Fetch referenced elements
    elem_ids = [n.get("element_id") for n in nodes if n.get("element_id")]
    elements_map = {e.id: e for e in db.query(ArchimateElement).filter(ArchimateElement.id.in_(elem_ids)).all()}

    # Fetch referenced relationships
    rel_ids = [c.get("relationship_id") for c in connections if c.get("relationship_id")]
    rels_map = {r.id: r for r in db.query(ArchimateRelationship).filter(ArchimateRelationship.id.in_(rel_ids)).all()}

    # Render nodes
    for n in nodes:
        elem_id = n.get("element_id")
        elem = elements_map.get(elem_id)

        node_id = str(n.get("id") or f"node-{uuid.uuid4().hex[:8]}")
        label = elem.name if elem else (n.get("name") or "Element")
        elem_type = elem.type if elem else n.get("type", "ApplicationComponent")
        layer = elem.layer if elem else n.get("layer", "Application")
        doc = elem.documentation if elem else (n.get("documentation") or "")
        x = str(n.get("x", 100))
        y = str(n.get("y", 100))
        width = str(n.get("width", 160))
        height = str(n.get("height", 65))
        parent = str(n.get("parent_id") or "1")

        obj = ET.SubElement(
            root_el,
            "object",
            {
                "id": node_id,
                "label": label,
                "easyea_id": elem_id or "",
                "archimate_type": elem_type,
                "layer": layer,
                "documentation": doc
            }
        )
        cell_style = _get_shape_style(elem_type, layer)
        cell = ET.SubElement(
            obj,
            "mxCell",
            {
                "style": cell_style,
                "vertex": "1",
                "parent": parent
            }
        )
        ET.SubElement(
            cell,
            "mxGeometry",
            {
                "x": x,
                "y": y,
                "width": width,
                "height": height,
                "as": "geometry"
            }
        )

    # Render connections
    for c in connections:
        rel_id = c.get("relationship_id")
        rel = rels_map.get(rel_id)

        conn_id = str(c.get("id") or f"edge-{uuid.uuid4().hex[:8]}")
        label = rel.name if (rel and rel.name) else (c.get("name") or "")
        rel_type = rel.type if rel else c.get("type", "ServingRelationship")
        source = str(c.get("source_node_id") or "")
        target = str(c.get("target_node_id") or "")

        if source and target:
            obj = ET.SubElement(
                root_el,
                "object",
                {
                    "id": conn_id,
                    "label": label,
                    "relationship_id": rel_id or "",
                    "archimate_rel_type": rel_type
                }
            )
            rel_style = _get_rel_style(rel_type)
            cell = ET.SubElement(
                obj,
                "mxCell",
                {
                    "style": rel_style,
                    "edge": "1",
                    "parent": "1",
                    "source": source,
                    "target": target
                }
            )
            ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})

    return diagram_el


def export_view_to_drawio(view_id: str, db: Session) -> str:
    """Exports a single ArchimateView as a .drawio XML string."""
    view = db.query(ArchimateView).filter(ArchimateView.id == view_id).first()
    if not view:
        raise ValueError("View not found")

    mxfile = ET.Element(
        "mxfile",
        {
            "host": "EasyEA Platform",
            "modified": "2026-09-27T00:00:00.000Z",
            "agent": "EasyEA Draw.io Service",
            "version": "21.0.0",
            "type": "embed"
        }
    )
    diagram_el = build_diagram_xml_element(view, db)
    mxfile.append(diagram_el)
    return ET.tostring(mxfile, encoding="utf-8", xml_declaration=True).decode("utf-8")


def export_model_to_drawio(model_id: str, db: Session) -> str:
    """Exports all views in a ModelWorkspace into a multi-page .drawio XML file."""
    workspace = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not workspace:
        raise ValueError("Model Workspace not found")

    mxfile = ET.Element(
        "mxfile",
        {
            "host": "EasyEA Platform",
            "modified": "2026-09-27T00:00:00.000Z",
            "agent": "EasyEA Draw.io Service",
            "version": "21.0.0",
            "type": "embed"
        }
    )

    views = db.query(ArchimateView).filter(ArchimateView.model_id == model_id).all()
    if not views:
        # Generate an empty default page
        dummy_view = ArchimateView(
            id=f"view-{uuid.uuid4().hex[:8]}",
            model_id=model_id,
            name=f"{workspace.name} Overview",
            view_data={"nodes": [], "connections": []}
        )
        diagram_el = build_diagram_xml_element(dummy_view, db)
        mxfile.append(diagram_el)
    else:
        for view in views:
            diagram_el = build_diagram_xml_element(view, db)
            mxfile.append(diagram_el)

    return ET.tostring(mxfile, encoding="utf-8", xml_declaration=True).decode("utf-8")


def parse_and_import_drawio(model_id: str, xml_content: str, db: Session) -> Dict[str, Any]:
    """
    Parses a .drawio XML file (single or multi-diagram) and imports/merges
    its elements, relationships, and views into the target ModelWorkspace.
    """
    workspace = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not workspace:
        raise ValueError("Model Workspace not found")

    try:
        root = ET.fromstring(xml_content)
    except Exception as e:
        raise ValueError(f"Invalid Draw.io XML format: {str(e)}")

    diagrams = root.findall(".//diagram")
    if not diagrams and root.tag == "diagram":
        diagrams = [root]

    imported_views = 0
    created_elements = 0
    created_relations = 0

    existing_elements = {e.id: e for e in db.query(ArchimateElement).filter(ArchimateElement.model_id == model_id).all()}
    existing_by_name = {e.name.lower(): e for e in existing_elements.values()}

    for diag in diagrams:
        view_name = diag.get("name") or f"Drawio View {imported_views + 1}"
        view_id = diag.get("id") or f"view-{uuid.uuid4().hex[:12]}"

        # Check if diagram contains direct mxGraphModel or if it's encoded
        graph_model = diag.find(".//mxGraphModel")
        if graph_model is None:
            continue

        nodes_list = []
        connections_list = []

        # Find all objects and direct mxCells
        root_elem = graph_model.find("root")
        if root_elem is None:
            continue

        objects = root_elem.findall("object")
        direct_cells = [c for c in root_elem.findall("mxCell") if c.get("id") not in ["0", "1"]]

        # Map to track cell ID to element ID
        cell_to_element_id: Dict[str, str] = {}

        # 1. Process vertex objects (Elements)
        for obj in objects:
            cell = obj.find("./mxCell")
            if cell is not None and cell.get("vertex") == "1":
                cell_id = obj.get("id") or cell.get("id") or str(uuid.uuid4().hex[:8])
                label = clean_html_label(obj.get("label") or obj.get("name") or "Unnamed")
                easyea_id = obj.get("easyea_id")
                arch_type = obj.get("archimate_type") or "ApplicationComponent"
                layer = obj.get("layer") or detect_layer(arch_type)
                doc = clean_html_label(obj.get("documentation") or "")

                geo = cell.find("./mxGeometry")
                x = float(geo.get("x", 0)) if geo is not None else 0
                y = float(geo.get("y", 0)) if geo is not None else 0
                w = float(geo.get("width", 160)) if geo is not None else 160
                h = float(geo.get("height", 65)) if geo is not None else 65
                parent = cell.get("parent") or "1"

                # Check if element exists in DB
                target_elem = None
                if easyea_id and easyea_id in existing_elements:
                    target_elem = existing_elements[easyea_id]
                elif label.lower() in existing_by_name:
                    target_elem = existing_by_name[label.lower()]
                else:
                    # Create new element in repo
                    new_elem_id = easyea_id or f"elem-{uuid.uuid4().hex[:12]}"
                    target_elem = ArchimateElement(
                        id=new_elem_id,
                        model_id=model_id,
                        name=label,
                        type=arch_type,
                        layer=layer,
                        documentation=doc,
                        properties={}
                    )
                    db.add(target_elem)
                    existing_elements[target_elem.id] = target_elem
                    existing_by_name[target_elem.name.lower()] = target_elem
                    created_elements += 1

                cell_to_element_id[cell_id] = target_elem.id
                nodes_list.append({
                    "id": cell_id,
                    "element_id": target_elem.id,
                    "name": label,
                    "x": x,
                    "y": y,
                    "width": w,
                    "height": h,
                    "parent_id": parent if parent != "1" else None
                })

        # Process standalone direct mxCells not inside <object>
        for cell in direct_cells:
            if cell.get("vertex") == "1":
                cell_id = cell.get("id") or str(uuid.uuid4().hex[:8])
                if cell_id in cell_to_element_id:
                    continue

                label = clean_html_label(cell.get("value") or "Element")
                arch_type = "ApplicationComponent"
                layer = "Application"
                geo = cell.find("./mxGeometry")
                x = float(geo.get("x", 0)) if geo is not None else 0
                y = float(geo.get("y", 0)) if geo is not None else 0
                w = float(geo.get("width", 160)) if geo is not None else 160
                h = float(geo.get("height", 65)) if geo is not None else 65

                if label.lower() in existing_by_name:
                    target_elem = existing_by_name[label.lower()]
                else:
                    new_elem_id = f"elem-{uuid.uuid4().hex[:12]}"
                    target_elem = ArchimateElement(
                        id=new_elem_id,
                        model_id=model_id,
                        name=label,
                        type=arch_type,
                        layer=layer,
                        documentation="",
                        properties={}
                    )
                    db.add(target_elem)
                    existing_elements[target_elem.id] = target_elem
                    existing_by_name[target_elem.name.lower()] = target_elem
                    created_elements += 1

                cell_to_element_id[cell_id] = target_elem.id
                nodes_list.append({
                    "id": cell_id,
                    "element_id": target_elem.id,
                    "name": label,
                    "x": x,
                    "y": y,
                    "width": w,
                    "height": h
                })

        # 2. Process edge objects/cells (Relationships)
        for obj in objects:
            cell = obj.find("./mxCell")
            if cell is not None and cell.get("edge") == "1":
                conn_id = obj.get("id") or cell.get("id") or str(uuid.uuid4().hex[:8])
                rel_id = obj.get("relationship_id")
                rel_type = obj.get("archimate_rel_type") or "ServingRelationship"
                label = clean_html_label(obj.get("label") or "")
                src_cell = cell.get("source")
                tgt_cell = cell.get("target")

                if src_cell and tgt_cell and src_cell in cell_to_element_id and tgt_cell in cell_to_element_id:
                    src_elem_id = cell_to_element_id[src_cell]
                    tgt_elem_id = cell_to_element_id[tgt_cell]

                    # Check if relationship already exists
                    existing_rel = db.query(ArchimateRelationship).filter(
                        ArchimateRelationship.model_id == model_id,
                        ArchimateRelationship.source_id == src_elem_id,
                        ArchimateRelationship.target_id == tgt_elem_id,
                        ArchimateRelationship.type == rel_type
                    ).first()

                    if not existing_rel:
                        new_rel_id = rel_id or f"rel-{uuid.uuid4().hex[:12]}"
                        existing_rel = ArchimateRelationship(
                            id=new_rel_id,
                            model_id=model_id,
                            source_id=src_elem_id,
                            target_id=tgt_elem_id,
                            type=rel_type,
                            name=label,
                            documentation="",
                            properties={}
                        )
                        db.add(existing_rel)
                        created_relations += 1

                    connections_list.append({
                        "id": conn_id,
                        "relationship_id": existing_rel.id,
                        "type": rel_type,
                        "name": label,
                        "source_node_id": src_cell,
                        "target_node_id": tgt_cell
                    })

        # Create or update ArchimateView
        existing_view = db.query(ArchimateView).filter(
            ArchimateView.model_id == model_id,
            ArchimateView.name == view_name
        ).first()

        view_data_payload = {
            "nodes": nodes_list,
            "connections": connections_list
        }

        if existing_view:
            existing_view.view_data = view_data_payload
        else:
            new_v = ArchimateView(
                id=view_id,
                model_id=model_id,
                name=view_name,
                viewpoint="Total",
                documentation="Imported from Draw.io",
                view_data=view_data_payload
            )
            db.add(new_v)
            imported_views += 1

    db.commit()

    return {
        "imported_views": imported_views,
        "created_elements": created_elements,
        "created_relations": created_relations,
        "message": f"Import completato con successo: {imported_views} viste, {created_elements} elementi, {created_relations} relazioni."
    }


def build_diagram_xml_element_from_schema(schema: ArchiSchema, db: Session) -> ET.Element:
    """Builds a single <diagram> XML element representing an ArchiSchema."""
    diagram_el = ET.Element("diagram", {"id": schema.id, "name": schema.name or "Schema"})
    graph_model = ET.SubElement(
        diagram_el,
        "mxGraphModel",
        {
            "dx": "1200",
            "dy": "800",
            "grid": "1",
            "gridSize": "10",
            "guides": "1",
            "tooltips": "1",
            "connect": "1",
            "arrows": "1",
            "fold": "1",
            "page": "1",
            "pageScale": "1",
            "pageWidth": "1600",
            "pageHeight": "1200",
            "math": "0",
            "shadow": "0"
        }
    )
    root_el = ET.SubElement(graph_model, "root")
    ET.SubElement(root_el, "mxCell", {"id": "0"})
    ET.SubElement(root_el, "mxCell", {"id": "1", "parent": "0"})

    view_data = schema.view_data or {}
    nodes = view_data.get("nodes", [])
    connections = view_data.get("connections", [])

    # Fetch referenced elements
    elem_ids = [n.get("element_id") for n in nodes if n.get("element_id")]
    elements_map = {e.id: e for e in db.query(ArchimateElement).filter(ArchimateElement.id.in_(elem_ids)).all()}

    # Fetch referenced relationships
    rel_ids = [c.get("relationship_id") for c in connections if c.get("relationship_id")]
    rels_map = {r.id: r for r in db.query(ArchimateRelationship).filter(ArchimateRelationship.id.in_(rel_ids)).all()}

    # Render nodes
    for n in nodes:
        elem_id = n.get("element_id")
        elem = elements_map.get(elem_id)

        node_id = str(n.get("id") or f"node-{uuid.uuid4().hex[:8]}")
        label = elem.name if elem else (n.get("name") or "Element")
        elem_type = elem.type if elem else n.get("type", "ApplicationComponent")
        layer = elem.layer if elem else n.get("layer", "Application")
        doc = elem.documentation if elem else (n.get("documentation") or "")
        x = str(n.get("x", 100))
        y = str(n.get("y", 100))
        width = str(n.get("width", 160))
        height = str(n.get("height", 65))
        parent = str(n.get("parent_id") or "1")

        obj = ET.SubElement(
            root_el,
            "object",
            {
                "id": node_id,
                "label": label,
                "easyea_id": elem_id or "",
                "archimate_type": elem_type,
                "layer": layer,
                "documentation": doc
            }
        )
        cell_style = _get_shape_style(elem_type, layer)
        cell = ET.SubElement(
            obj,
            "mxCell",
            {
                "style": cell_style,
                "vertex": "1",
                "parent": parent
            }
        )
        ET.SubElement(
            cell,
            "mxGeometry",
            {
                "x": x,
                "y": y,
                "width": width,
                "height": height,
                "as": "geometry"
            }
        )

    # Render connections
    for c in connections:
        rel_id = c.get("relationship_id")
        rel = rels_map.get(rel_id)

        conn_id = str(c.get("id") or f"edge-{uuid.uuid4().hex[:8]}")
        label = rel.name if (rel and rel.name) else (c.get("name") or "")
        rel_type = rel.type if rel else c.get("type", "ServingRelationship")
        source = str(c.get("source_node_id") or "")
        target = str(c.get("target_node_id") or "")

        if source and target:
            obj = ET.SubElement(
                root_el,
                "object",
                {
                    "id": conn_id,
                    "label": label,
                    "relationship_id": rel_id or "",
                    "archimate_rel_type": rel_type
                }
            )
            rel_style = _get_rel_style(rel_type)
            cell = ET.SubElement(
                obj,
                "mxCell",
                {
                    "style": rel_style,
                    "edge": "1",
                    "parent": "1",
                    "source": source,
                    "target": target
                }
            )
            ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})

    return diagram_el


def export_schema_to_drawio_xml(schema: ArchiSchema, db: Session) -> str:
    """Exports a single ArchiSchema as a .drawio XML string for Draw.io Desktop."""
    if schema.raw_xml and ("<mxfile" in schema.raw_xml or "<mxGraphModel" in schema.raw_xml):
        if "<mxfile" in schema.raw_xml:
            return schema.raw_xml
        # Wrap raw mxGraphModel
        mxfile = ET.Element(
            "mxfile",
            {
                "host": "EasyEA Platform",
                "modified": datetime.now().isoformat(),
                "agent": "EasyEA Draw.io Desktop Service",
                "version": "21.0.0",
                "type": "embed"
            }
        )
        diag_el = ET.SubElement(mxfile, "diagram", {"id": schema.id, "name": schema.name or "Schema"})
        try:
            gm = ET.fromstring(schema.raw_xml)
            diag_el.append(gm)
            return ET.tostring(mxfile, encoding="utf-8", xml_declaration=True).decode("utf-8")
        except Exception:
            pass

    mxfile = ET.Element(
        "mxfile",
        {
            "host": "EasyEA Platform",
            "modified": datetime.now().isoformat(),
            "agent": "EasyEA Draw.io Desktop Service",
            "version": "21.0.0",
            "type": "embed"
        }
    )
    diagram_el = build_diagram_xml_element_from_schema(schema, db)
    mxfile.append(diagram_el)
    return ET.tostring(mxfile, encoding="utf-8", xml_declaration=True).decode("utf-8")


def parse_drawio_file_to_canonical_model(xml_content: str) -> Dict[str, Any]:
    """
    Parses a Draw.io XML file into the canonical dictionary structure
    expected by compute_schema_diff: { "elements": [...], "relationships": [...], "views": [...] }
    """
    try:
        root = ET.fromstring(xml_content)
    except Exception as e:
        raise ValueError(f"Formato Draw.io XML non valido: {str(e)}")

    diagrams = root.findall(".//diagram")
    if not diagrams and root.tag == "diagram":
        diagrams = [root]

    all_elements: Dict[str, Dict[str, Any]] = {}
    all_relationships: List[Dict[str, Any]] = []
    views_list: List[Dict[str, Any]] = []

    for diag in diagrams:
        view_name = diag.get("name") or "Drawio View"
        view_id = diag.get("id") or f"view-{uuid.uuid4().hex[:8]}"

        graph_model = diag.find(".//mxGraphModel")
        if graph_model is None and diag.tag == "mxGraphModel":
            graph_model = diag
        if graph_model is None:
            continue

        root_elem = graph_model.find("root")
        if root_elem is None:
            continue

        objects = root_elem.findall("object")
        direct_cells = [c for c in root_elem.findall("mxCell") if c.get("id") not in ["0", "1"]]

        nodes_list = []
        connections_list = []
        cell_to_elem_id: Dict[str, str] = {}

        # 1. Elements (<object> vertex)
        for obj in objects:
            cell = obj.find("./mxCell")
            if cell is not None and cell.get("vertex") == "1":
                cell_id = obj.get("id") or cell.get("id") or str(uuid.uuid4().hex[:8])
                label = clean_html_label(obj.get("label") or obj.get("name") or "Unnamed")
                easyea_id = obj.get("easyea_id") or obj.get("id") or f"el-{uuid.uuid4().hex[:8]}"
                arch_type = obj.get("archimate_type") or "ApplicationComponent"
                layer = obj.get("layer") or detect_layer(arch_type)
                doc = clean_html_label(obj.get("documentation") or "")

                geo = cell.find("./mxGeometry")
                x = float(geo.get("x", 0)) if geo is not None else 0
                y = float(geo.get("y", 0)) if geo is not None else 0
                w = float(geo.get("width", 160)) if geo is not None else 160
                h = float(geo.get("height", 65)) if geo is not None else 65
                parent = cell.get("parent") or "1"

                elem_record = {
                    "id": cell_id,
                    "name": label,
                    "type": arch_type,
                    "layer": layer,
                    "documentation": doc,
                    "properties": {}
                }
                all_elements[cell_id] = elem_record
                cell_to_elem_id[cell_id] = cell_id

                nodes_list.append({
                    "id": cell_id,
                    "element_id": easyea_id if easyea_id.startswith("elem-") or easyea_id.startswith("id-") else None,
                    "name": label,
                    "type": arch_type,
                    "layer": layer,
                    "documentation": doc,
                    "x": x,
                    "y": y,
                    "width": w,
                    "height": h,
                    "parent_id": parent if parent != "1" else None
                })

        # Process direct mxCells (without <object>)
        for cell in direct_cells:
            if cell.get("vertex") == "1":
                cell_id = cell.get("id") or str(uuid.uuid4().hex[:8])
                if cell_id in cell_to_elem_id:
                    continue

                label = clean_html_label(cell.get("value") or "Element")
                arch_type = "ApplicationComponent"
                layer = "Application"
                geo = cell.find("./mxGeometry")
                x = float(geo.get("x", 0)) if geo is not None else 0
                y = float(geo.get("y", 0)) if geo is not None else 0
                w = float(geo.get("width", 160)) if geo is not None else 160
                h = float(geo.get("height", 65)) if geo is not None else 65

                elem_record = {
                    "id": cell_id,
                    "name": label,
                    "type": arch_type,
                    "layer": layer,
                    "documentation": "",
                    "properties": {}
                }
                all_elements[cell_id] = elem_record
                cell_to_elem_id[cell_id] = cell_id

                nodes_list.append({
                    "id": cell_id,
                    "element_id": None,
                    "name": label,
                    "type": arch_type,
                    "layer": layer,
                    "documentation": "",
                    "x": x,
                    "y": y,
                    "width": w,
                    "height": h
                })

        # 2. Relationships (<object> edge or <mxCell> edge)
        for obj in objects:
            cell = obj.find("./mxCell")
            if cell is not None and cell.get("edge") == "1":
                conn_id = obj.get("id") or cell.get("id") or str(uuid.uuid4().hex[:8])
                rel_id = obj.get("relationship_id")
                rel_type = obj.get("archimate_rel_type") or "ServingRelationship"
                label = clean_html_label(obj.get("label") or "")
                src_cell = cell.get("source") or ""
                tgt_cell = cell.get("target") or ""

                if src_cell and tgt_cell:
                    rel_record = {
                        "id": conn_id,
                        "source_id": src_cell,
                        "target_id": tgt_cell,
                        "type": rel_type,
                        "name": label,
                        "documentation": "",
                        "properties": {}
                    }
                    all_relationships.append(rel_record)
                    connections_list.append({
                        "id": conn_id,
                        "relationship_id": rel_id,
                        "type": rel_type,
                        "name": label,
                        "source_node_id": src_cell,
                        "target_node_id": tgt_cell
                    })

        for cell in direct_cells:
            if cell.get("edge") == "1":
                conn_id = cell.get("id") or str(uuid.uuid4().hex[:8])
                label = clean_html_label(cell.get("value") or "")
                rel_type = "ServingRelationship"
                src_cell = cell.get("source") or ""
                tgt_cell = cell.get("target") or ""

                if src_cell and tgt_cell:
                    all_relationships.append({
                        "id": conn_id,
                        "source_id": src_cell,
                        "target_id": tgt_cell,
                        "type": rel_type,
                        "name": label,
                        "documentation": "",
                        "properties": {}
                    })
                    connections_list.append({
                        "id": conn_id,
                        "type": rel_type,
                        "name": label,
                        "source_node_id": src_cell,
                        "target_node_id": tgt_cell
                    })

        views_list.append({
            "id": view_id,
            "name": view_name,
            "view_data": {
                "nodes": nodes_list,
                "connections": connections_list
            }
        })

    return {
        "elements": list(all_elements.values()),
        "relationships": all_relationships,
        "views": views_list
    }


def generate_drawio_archimate_library_xml() -> str:
    """
    Generates a downloadable .xml Draw.io custom library containing
    the full ArchiMate 3.x metamodel shape palette and connection types.
    Can be imported into Draw.io Desktop via File -> Open Library from -> Device.
    """
    import json
    entries = []
    for shape_type, style_def in SHAPE_STYLES.items():
        layer = detect_layer(shape_type)
        colors = LAYER_COLORS.get(layer, LAYER_COLORS["Application"])
        full_style = f"{style_def}fillColor={colors['fill']};strokeColor={colors['stroke']};fontColor={colors['text']};fontStyle=1;"
        w = 160
        h = 65
        if "Actor" in shape_type or "Stakeholder" in shape_type:
            w, h = 40, 70
        elif "Interface" in shape_type:
            w, h = 60, 60
        elif "Node" in shape_type or "Device" in shape_type:
            w, h = 170, 75

        clean_type_title = re.sub(r'([A-Z])', r' \1', shape_type).strip()
        cell_xml = f'<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><object label="{clean_type_title}" archimate_type="{shape_type}" layer="{layer}" id="elem"><mxCell style="{full_style}" vertex="1" parent="1"><mxGeometry width="{w}" height="{h}" as="geometry"/></mxCell></object></root></mxGraphModel>'
        entries.append({
            "xml": cell_xml,
            "w": w,
            "h": h,
            "title": f"{clean_type_title} ({layer})"
        })

    json_str = json.dumps(entries)
    return f"<mxlibrary>{json_str}</mxlibrary>"

