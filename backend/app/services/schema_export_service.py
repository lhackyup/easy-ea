from defusedxml.ElementTree import fromstring as safe_xml_fromstring
from defusedxml.minidom import parseString as safe_minidom_parse_string
from xml.etree.ElementTree import Element, SubElement, tostring
import uuid
from typing import Dict, List, Any, Optional, Set
from sqlalchemy.orm import Session

from app.models.archimate import (
    ArchiSchema,
    ArchimateElement,
    ArchimateRelationship,
    ModelWorkspace
)
from app.parsers.archi_parser import LAYER_MAPPING


def _clean_str(val: Any) -> str:
    if val is None:
        return ""
    return str(val)


def _inject_easyea_root_properties(xml_str: str, schema: ArchiSchema, db: Session) -> str:
    """Ensures standard EasyEA tracking properties exist on the root <archimate:model> tag without namespace prefix corruption."""
    try:
        from defusedxml.minidom import parseString as safe_minidom_parse_string

        dom = safe_minidom_parse_string(
            xml_str.strip().encode("utf-8"),
            forbid_dtd=True,
            forbid_entities=True,
            forbid_external=True
        )
        root = dom.documentElement
        if root is None:
            return xml_str

        # Ensure standard namespaces are explicitly preserved
        if not root.getAttribute("xmlns:archimate"):
            root.setAttribute("xmlns:archimate", "http://www.archimatetool.com/archimate")
        if not root.getAttribute("xmlns:xsi"):
            root.setAttribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")

        ws = db.query(ModelWorkspace).filter(ModelWorkspace.id == schema.model_id).first() if db and schema.model_id else None
        lib_name = ws.name if ws else "Enterprise Architecture Library"
        lib_code = (ws.code or "") if ws else ""

        required_props = [
            ("EasyEA_Schema_ID", schema.id),
            ("EasyEA_Model_ID", schema.model_id or ""),
            ("EasyEA_Schema_Name", schema.name or "Schema"),
            ("EasyEA_Library_Name", lib_name),
            ("EasyEA_Library_Code", lib_code)
        ]

        # Find existing root properties
        existing_keys = set()
        for child in list(root.childNodes):
            if child.nodeType == child.ELEMENT_NODE and child.tagName.endswith("property"):
                pk = child.getAttribute("key")
                if pk:
                    existing_keys.add(pk)

        # Append missing properties
        for key, val in required_props:
            if key not in existing_keys and val:
                p_elem = dom.createElement("property")
                p_elem.setAttribute("key", key)
                p_elem.setAttribute("value", str(val))
                root.appendChild(p_elem)

        # Remove empty text nodes to prevent blank line accumulation
        def clean_whitespace_nodes(node):
            for child in list(node.childNodes):
                if child.nodeType == child.TEXT_NODE and child.data.strip() == "":
                    node.removeChild(child)
                elif child.nodeType == child.ELEMENT_NODE:
                    clean_whitespace_nodes(child)

        clean_whitespace_nodes(root)
        return dom.toprettyxml(indent="  ", encoding="utf-8").decode("utf-8")
    except Exception:
        return xml_str


def generate_standalone_archi_xml(schema: ArchiSchema, db: Session) -> str:
    """
    Generates a valid, complete standalone Archi XML model (.archimate format)
    containing the specific diagram view, its nodes/connections, and the definitions
    for all referenced elements and relationships.
    """
    # 1. If raw_xml is already present, valid and non-empty, enrich with EasyEA properties and use it
    if schema.raw_xml and schema.raw_xml.strip().startswith("<?xml") or (schema.raw_xml and "<archimate:model" in schema.raw_xml):
        try:
            # Validate it's well-formed XML and safe against DTD/entity expansion
            safe_xml_fromstring(
                schema.raw_xml.strip(),
                forbid_dtd=True,
                forbid_entities=True,
                forbid_external=True,
            )
            return _inject_easyea_root_properties(schema.raw_xml.strip(), schema, db)
        except Exception:
            pass

    view_data = schema.view_data if isinstance(schema.view_data, dict) else {}
    nodes = view_data.get("nodes", [])
    connections = view_data.get("connections", [])

    # Collect element IDs and relationship IDs
    referenced_elem_ids: Set[str] = set()
    node_id_to_elem_id: Dict[str, str] = {}
    valid_node_ids: Set[str] = set()

    for n in nodes:
        n_id = n.get("id") or f"node-{uuid.uuid4().hex[:8]}"
        valid_node_ids.add(n_id)
        elem_id = n.get("element_id")
        if elem_id:
            referenced_elem_ids.add(elem_id)
            node_id_to_elem_id[n_id] = elem_id

    referenced_rel_ids: Set[str] = set()
    for c in connections:
        rel_id = c.get("relationship_id")
        if rel_id:
            referenced_rel_ids.add(rel_id)

    # Query DB relationships first to discover all connected elements
    relationships_list = []
    if referenced_rel_ids:
        relationships_list = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.model_id == schema.model_id,
            ArchimateRelationship.id.in_(referenced_rel_ids)
        ).all()

    found_rel_ids = {r.id for r in relationships_list}

    # CRITICAL: Archi requires all endpoints (source & target) of all relationships
    # in the XML model to have a corresponding element definition.
    for rel in relationships_list:
        if rel.source_id:
            referenced_elem_ids.add(rel.source_id)
        if rel.target_id:
            referenced_elem_ids.add(rel.target_id)

    # Query DB elements (covering both visual diagram nodes AND relationship endpoints)
    elements_list = []
    if referenced_elem_ids:
        elements_list = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == schema.model_id,
            ArchimateElement.id.in_(referenced_elem_ids)
        ).all()

    found_elem_ids = {e.id for e in elements_list}

    # Build XML Root
    root = Element(
        "archimate:model",
        {
            "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "xmlns:archimate": "http://www.archimatetool.com/archimate",
            "name": schema.name or "EasyEA Schema",
            "id": f"id-{schema.id}",
            "version": "5.0.0"
        }
    )

    # Standard Folder definitions
    folders_meta = [
        ("Strategy", "strategy", "id-folder-strategy"),
        ("Business", "business", "id-folder-business"),
        ("Application", "application", "id-folder-application"),
        ("Technology & Physical", "technology", "id-folder-technology"),
        ("Motivation", "motivation", "id-folder-motivation"),
        ("Implementation & Migration", "implementation", "id-folder-implementation"),
        ("Other", "other", "id-folder-other"),
        ("Relations", "relations", "id-folder-relations"),
        ("Views", "diagrams", "id-folder-views"),
    ]

    folder_elems = {}
    for f_name, f_type, f_id in folders_meta:
        f_el = SubElement(root, "folder", {"name": f_name, "id": f_id, "type": f_type})
        folder_elems[f_type] = f_el

    # Add Elements to matching layer folder
    for el in elements_list:
        layer = el.layer or LAYER_MAPPING.get(el.type, "Other")
        layer_lower = layer.lower()
        target_f_type = "other"
        for k in ["strategy", "business", "application", "technology", "motivation", "implementation"]:
            if k in layer_lower:
                target_f_type = k
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

        # Export properties if present
        if isinstance(el.properties, dict):
            for p_key, p_val in el.properties.items():
                if p_val is not None and str(p_val) != "":
                    SubElement(el_node, "property", {"key": str(p_key), "value": str(p_val)})

    # SAFETY NET: For any referenced elem_id not found in DB, synthesize element to prevent Archi unresolved proxy error
    for ref_id in referenced_elem_ids:
        if ref_id not in found_elem_ids:
            parent_folder = folder_elems["application"]
            SubElement(
                parent_folder,
                "element",
                {
                    "xsi:type": "archimate:ApplicationComponent",
                    "id": ref_id,
                    "name": f"Component {ref_id[:8]}"
                }
            )
            found_elem_ids.add(ref_id)

    # Add Relationships to Relations folder
    for rel in relationships_list:
        rel_folder = folder_elems["relations"]
        clean_rel_type = rel.type if rel.type.startswith("archimate:") else f"archimate:{rel.type}"
        if not clean_rel_type.endswith("Relationship") and not clean_rel_type.endswith("Association"):
            clean_rel_type = f"{clean_rel_type}Relationship"
        
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

    # SAFETY NET: For any referenced rel_id in connections not found in DB, synthesize relationship
    for c in connections:
        r_id = c.get("relationship_id")
        s_node = c.get("source_node_id") or c.get("source")
        t_node = c.get("target_node_id") or c.get("target")
        s_elem = node_id_to_elem_id.get(s_node, s_node)
        t_elem = node_id_to_elem_id.get(t_node, t_node)

        if r_id and r_id not in found_rel_ids and s_elem and t_elem:
            rel_folder = folder_elems["relations"]
            SubElement(
                rel_folder,
                "element",
                {
                    "xsi:type": "archimate:AssociationRelationship",
                    "id": r_id,
                    "source": str(s_elem),
                    "target": str(t_elem),
                    "name": c.get("name", "")
                }
            )
            found_rel_ids.add(r_id)

    # Add Diagram View in Views folder
    views_folder = folder_elems["diagrams"]
    diag_node = SubElement(
        views_folder,
        "element",
        {
            "xsi:type": "archimate:ArchimateDiagramModel",
            "id": f"diag-{schema.id}",
            "name": schema.name or "Diagram View",
            "viewpoint": schema.viewpoint or "Total"
        }
    )
    if schema.documentation:
        doc_el = SubElement(diag_node, "documentation")
        doc_el.text = schema.documentation

    # Filter connections that have both source and target in valid_node_ids
    valid_connections = []
    for c in connections:
        s_id = c.get("source_node_id") or c.get("source")
        t_id = c.get("target_node_id") or c.get("target")
        if s_id in valid_node_ids and t_id in valid_node_ids:
            c_copy = dict(c)
            if not c_copy.get("id"):
                c_copy["id"] = f"conn-{uuid.uuid4().hex[:8]}"
            valid_connections.append(c_copy)

    # Map target connections: Node ID -> List of connection IDs targeting this node
    target_conns_map: Dict[str, List[str]] = {}
    for c in valid_connections:
        t_id = c.get("target_node_id") or c.get("target")
        c_id = c["id"]
        target_conns_map.setdefault(t_id, []).append(c_id)

    # Render diagram child objects
    for n in nodes:
        node_id = n.get("id") or f"node-{uuid.uuid4().hex[:8]}"
        elem_id = n.get("element_id")
        
        child_attrs = {
            "xsi:type": "archimate:DiagramObject",
            "id": node_id
        }
        if elem_id and elem_id in found_elem_ids:
            child_attrs["archimateElement"] = elem_id
        
        # Add targetConnections if any
        if node_id in target_conns_map:
            child_attrs["targetConnections"] = " ".join(target_conns_map[node_id])

        child_el = SubElement(diag_node, "child", child_attrs)
        
        # Bounds
        x = int(n.get("x", 100))
        y = int(n.get("y", 100))
        w = int(n.get("width", 140))
        h = int(n.get("height", 60))
        SubElement(child_el, "bounds", {
            "x": str(x),
            "y": str(y),
            "width": str(w),
            "height": str(h)
        })

        # Find connections where this node is source
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
                if rel_id and rel_id in found_rel_ids:
                    conn_attrs["archimateRelationship"] = rel_id
                SubElement(child_el, "sourceConnection", conn_attrs)

    # Root model tracking properties for EasyEA integration
    ws = db.query(ModelWorkspace).filter(ModelWorkspace.id == schema.model_id).first() if db and schema.model_id else None
    lib_name = ws.name if ws else "Enterprise Architecture Library"
    lib_code = (ws.code or "") if ws else ""
    SubElement(root, "property", {"key": "EasyEA_Schema_ID", "value": str(schema.id)})
    if schema.model_id:
        SubElement(root, "property", {"key": "EasyEA_Model_ID", "value": str(schema.model_id)})
    SubElement(root, "property", {"key": "EasyEA_Schema_Name", "value": str(schema.name or "Schema")})
    SubElement(root, "property", {"key": "EasyEA_Library_Name", "value": str(lib_name)})
    if lib_code:
        SubElement(root, "property", {"key": "EasyEA_Library_Code", "value": str(lib_code)})

    # Format pretty XML
    rough_str = tostring(root, encoding="utf-8")
    reparsed = safe_minidom_parse_string(
        rough_str,
        forbid_dtd=True,
        forbid_entities=True,
        forbid_external=True,
    )
    return reparsed.toprettyxml(indent="  ", encoding="UTF-8").decode("utf-8")
