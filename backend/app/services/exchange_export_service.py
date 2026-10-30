import re
import uuid
from xml.etree.ElementTree import Element, SubElement, register_namespace, tostring as xml_tostring
from defusedxml.minidom import parseString as safe_minidom_parse_string
from typing import Dict, List, Any, Optional, Set, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.archimate import (
    ModelWorkspace,
    ArchimateElement,
    ArchimateRelationship,
    ArchimateView
)

OPEN_EXCHANGE_NS = "http://www.opengroup.org/xsd/archimate/3.0/"
XSI_NS = "http://www.w3.org/2001/XMLSchema-instance"
XML_NS = "http://www.w3.org/XML/1998/namespace"

# Mapping from internal type (e.g. ServingRelationship) to Open Exchange xsi:type (Serving)
RELATIONSHIP_TYPE_NORMALIZE = {
    "CompositionRelationship": "Composition",
    "AggregationRelationship": "Aggregation",
    "AssignmentRelationship": "Assignment",
    "RealizationRelationship": "Realization",
    "ServingRelationship": "Serving",
    "AccessRelationship": "Access",
    "InfluenceRelationship": "Influence",
    "TriggeringRelationship": "Triggering",
    "FlowRelationship": "Flow",
    "SpecializationRelationship": "Specialization",
    "AssociationRelationship": "Association",
    # Pass-throughs
    "Composition": "Composition",
    "Aggregation": "Aggregation",
    "Assignment": "Assignment",
    "Realization": "Realization",
    "Serving": "Serving",
    "Access": "Access",
    "Influence": "Influence",
    "Triggering": "Triggering",
    "Flow": "Flow",
    "Specialization": "Specialization",
    "Association": "Association"
}


def _clean_str(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, (dict, list)):
        import json
        return json.dumps(val, ensure_ascii=False)
    return str(val).strip()


def export_model_to_exchange_xml(
    model_id: str,
    db: Session,
    view_id: Optional[str] = None
) -> Tuple[str, str]:
    """
    Exports a model workspace (or a single diagram view) into the official
    The Open Group ArchiMate Model Exchange File Format XML (v3.0 / 3.1).
    Returns (xml_string, filename).
    """
    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model workspace not found")

    target_view: Optional[ArchimateView] = None
    if view_id:
        target_view = db.query(ArchimateView).filter(
            ArchimateView.id == view_id,
            ArchimateView.model_id == model_id
        ).first()
        if not target_view:
            raise HTTPException(status_code=404, detail=f"Diagram view '{view_id}' not found in model.")

    # Determine elements, relationships, and views to export
    if target_view:
        view_data = target_view.view_data if isinstance(target_view.view_data, dict) else {}
        nodes = view_data.get("nodes", [])
        connections = view_data.get("connections", [])

        ref_elem_ids = {n.get("element_id") for n in nodes if n.get("element_id")}
        ref_conn_ids = {c.get("relationship_id") for c in connections if c.get("relationship_id")}

        # Also collect source/target element IDs of connections
        for c in connections:
            if c.get("source_element_id"):
                ref_elem_ids.add(c["source_element_id"])
            if c.get("target_element_id"):
                ref_elem_ids.add(c["target_element_id"])

        elements = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == model_id,
            ArchimateElement.id.in_(ref_elem_ids)
        ).all() if ref_elem_ids else []

        relationships = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.model_id == model_id,
            ArchimateRelationship.id.in_(ref_conn_ids)
        ).all() if ref_conn_ids else []

        # If some relationships connecting the nodes were not explicitly listed in connections
        if elements:
            elem_ids_set = {e.id for e in elements}
            extra_rels = db.query(ArchimateRelationship).filter(
                ArchimateRelationship.model_id == model_id,
                ArchimateRelationship.source_id.in_(elem_ids_set),
                ArchimateRelationship.target_id.in_(elem_ids_set)
            ).all()
            rel_dict = {r.id: r for r in relationships}
            for er in extra_rels:
                rel_dict[er.id] = er
            relationships = list(rel_dict.values())

        views = [target_view]
    else:
        elements = db.query(ArchimateElement).filter(ArchimateElement.model_id == model_id).all()
        relationships = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == model_id).all()
        views = db.query(ArchimateView).filter(ArchimateView.model_id == model_id).all()

    # Collect property keys across elements and relationships to build PropertyDefinitions
    prop_defs: Dict[str, str] = {} # prop_name -> prop_id

    def register_prop(name: str):
        if not name or name in prop_defs:
            return
        slug = re.sub(r'[^a-zA-Z0-9_-]', '_', name.strip())
        prop_id = f"propid-{slug}"
        prop_defs[name] = prop_id

    for el in elements:
        props = el.properties if isinstance(el.properties, dict) else {}
        for k, v in props.items():
            if v is not None and v != "":
                register_prop(k)
        if el.stereotype:
            register_prop("stereotype")
        if el.apm_attributes:
            apm = el.apm_attributes
            for field in [
                "annual_cost", "business_fit", "technical_fit", "time_quadrant",
                "business_criticality", "lifecycle_status", "business_owner",
                "technical_owner", "vendor", "hosting_type", "data_classification", "sla_level"
            ]:
                if getattr(apm, field, None) is not None:
                    register_prop(f"apm_{field}")

    for rel in relationships:
        r_props = rel.properties if isinstance(rel.properties, dict) else {}
        for k, v in r_props.items():
            if v is not None and v != "":
                register_prop(k)

    # Build XML Document Root with official Open Group ArchiMate 3.0 schema attributes
    register_namespace("", OPEN_EXCHANGE_NS)
    register_namespace("xsi", XSI_NS)

    root = Element(f"{{{OPEN_EXCHANGE_NS}}}model", {
        f"{{{XSI_NS}}}schemaLocation": f"{OPEN_EXCHANGE_NS} http://www.opengroup.org/xsd/archimate/3.0/archimate3_Diagram.xsd",
        "identifier": f"id-{model.code or model.id}",
        "version": "3.0"
    })

    # Model Name & Documentation
    model_name_tag = SubElement(root, f"{{{OPEN_EXCHANGE_NS}}}name", {f"{{{XML_NS}}}lang": "en"})
    model_name_tag.text = model.name or "EasyEA Enterprise Model"

    if model.description:
        doc_tag = SubElement(root, f"{{{OPEN_EXCHANGE_NS}}}documentation", {f"{{{XML_NS}}}lang": "en"})
        doc_tag.text = model.description

    # 1. Property Definitions
    if prop_defs:
        prop_defs_elem = SubElement(root, f"{{{OPEN_EXCHANGE_NS}}}propertyDefinitions")
        for p_name, p_id in sorted(prop_defs.items(), key=lambda x: x[0]):
            p_def = SubElement(prop_defs_elem, f"{{{OPEN_EXCHANGE_NS}}}propertyDefinition", {
                "identifier": p_id,
                "type": "string"
            })
            p_def_name = SubElement(p_def, f"{{{OPEN_EXCHANGE_NS}}}name", {f"{{{XML_NS}}}lang": "en"})
            p_def_name.text = p_name

    # Helper to serialize properties block
    def serialize_properties(parent_elem, prop_dict: Dict[str, Any]):
        if not prop_dict:
            return
        valid_items = [(k, v) for k, v in prop_dict.items() if v is not None and v != "" and k in prop_defs]
        if not valid_items:
            return
        props_container = SubElement(parent_elem, f"{{{OPEN_EXCHANGE_NS}}}properties")
        for k, v in sorted(valid_items, key=lambda x: x[0]):
            p_elem = SubElement(props_container, f"{{{OPEN_EXCHANGE_NS}}}property", {
                "propertyDefinitionRef": prop_defs[k]
            })
            val_elem = SubElement(p_elem, f"{{{OPEN_EXCHANGE_NS}}}value", {f"{{{XML_NS}}}lang": "en"})
            val_elem.text = _clean_str(v)

    # 2. Elements
    elems_elem = SubElement(root, f"{{{OPEN_EXCHANGE_NS}}}elements")
    for el in sorted(elements, key=lambda x: (x.layer or "", x.type or "", x.name or "")):
        clean_type = el.type.replace("archimate:", "").strip() if el.type else "ApplicationComponent"
        el_tag = SubElement(elems_elem, f"{{{OPEN_EXCHANGE_NS}}}element", {
            "identifier": el.id,
            f"{{{XSI_NS}}}type": clean_type
        })
        el_name = SubElement(el_tag, f"{{{OPEN_EXCHANGE_NS}}}name", {f"{{{XML_NS}}}lang": "en"})
        el_name.text = el.name or f"Unnamed {clean_type}"

        if el.documentation:
            el_doc = SubElement(el_tag, f"{{{OPEN_EXCHANGE_NS}}}documentation", {f"{{{XML_NS}}}lang": "en"})
            el_doc.text = el.documentation

        # Prepare properties
        el_props = dict(el.properties) if isinstance(el.properties, dict) else {}
        if el.stereotype:
            el_props["stereotype"] = el.stereotype.label or el.stereotype.name
        if el.apm_attributes:
            apm = el.apm_attributes
            for field in [
                "annual_cost", "business_fit", "technical_fit", "time_quadrant",
                "business_criticality", "lifecycle_status", "business_owner",
                "technical_owner", "vendor", "hosting_type", "data_classification", "sla_level"
            ]:
                v = getattr(apm, field, None)
                if v is not None and f"apm_{field}" not in el_props:
                    el_props[f"apm_{field}"] = v

        serialize_properties(el_tag, el_props)

    # 3. Relationships
    rels_elem = SubElement(root, f"{{{OPEN_EXCHANGE_NS}}}relationships")
    for rel in sorted(relationships, key=lambda x: (x.type or "", x.id or "")):
        raw_type = rel.type.replace("archimate:", "").strip() if rel.type else "AssociationRelationship"
        norm_type = RELATIONSHIP_TYPE_NORMALIZE.get(raw_type, raw_type.replace("Relationship", ""))

        rel_tag = SubElement(rels_elem, f"{{{OPEN_EXCHANGE_NS}}}relationship", {
            "identifier": rel.id,
            "source": rel.source_id,
            "target": rel.target_id,
            f"{{{XSI_NS}}}type": norm_type
        })
        if rel.name:
            r_name = SubElement(rel_tag, f"{{{OPEN_EXCHANGE_NS}}}name", {f"{{{XML_NS}}}lang": "en"})
            r_name.text = rel.name
        if rel.documentation:
            r_doc = SubElement(rel_tag, f"{{{OPEN_EXCHANGE_NS}}}documentation", {f"{{{XML_NS}}}lang": "en"})
            r_doc.text = rel.documentation

        r_props = dict(rel.properties) if isinstance(rel.properties, dict) else {}
        serialize_properties(rel_tag, r_props)

    # 4. Views / Diagrams
    if views:
        views_elem = SubElement(root, f"{{{OPEN_EXCHANGE_NS}}}views")
        diagrams_elem = SubElement(views_elem, f"{{{OPEN_EXCHANGE_NS}}}diagrams")

        for v in views:
            v_tag = SubElement(diagrams_elem, f"{{{OPEN_EXCHANGE_NS}}}view", {
                "identifier": v.id,
                f"{{{XSI_NS}}}type": "Diagram"
            })
            v_name = SubElement(v_tag, f"{{{OPEN_EXCHANGE_NS}}}name", {f"{{{XML_NS}}}lang": "en"})
            v_name.text = v.name or "Diagram View"

            if getattr(v, "documentation", None):
                v_doc = SubElement(v_tag, f"{{{OPEN_EXCHANGE_NS}}}documentation", {f"{{{XML_NS}}}lang": "en"})
                v_doc.text = v.documentation

            v_data = v.view_data if isinstance(v.view_data, dict) else {}
            v_nodes = v_data.get("nodes", [])
            v_conns = v_data.get("connections", [])

            # Map nodes
            for idx, n in enumerate(v_nodes):
                n_id = n.get("id") or f"node-{v.id}-{idx}"
                elem_ref = n.get("element_id") or n.get("id")
                x = str(int(n.get("x", 100)))
                y = str(int(n.get("y", 100)))
                w = str(int(n.get("width") or n.get("w") or 180))
                h = str(int(n.get("height") or n.get("h") or 80))

                node_tag = SubElement(v_tag, f"{{{OPEN_EXCHANGE_NS}}}node", {
                    "identifier": n_id,
                    "elementRef": elem_ref,
                    "x": x,
                    "y": y,
                    "w": w,
                    "h": h,
                    f"{{{XSI_NS}}}type": "Element"
                })
                # Style background color if present
                bg_color = n.get("fill") or n.get("fillColor")
                if bg_color and bg_color.startswith("#"):
                    r_c = int(bg_color[1:3], 16)
                    g_c = int(bg_color[3:5], 16)
                    b_c = int(bg_color[5:7], 16)
                    style_tag = SubElement(node_tag, f"{{{OPEN_EXCHANGE_NS}}}style")
                    color_tag = SubElement(style_tag, f"{{{OPEN_EXCHANGE_NS}}}fillColor", {
                        "r": str(r_c),
                        "g": str(g_c),
                        "b": str(b_c)
                    })

            # Map connections
            for idx, c in enumerate(v_conns):
                c_id = c.get("id") or f"conn-{v.id}-{idx}"
                rel_ref = c.get("relationship_id") or c.get("id")
                src = c.get("source_node_id") or c.get("source") or ""
                tgt = c.get("target_node_id") or c.get("target") or ""
                if src and tgt:
                    conn_tag = SubElement(v_tag, f"{{{OPEN_EXCHANGE_NS}}}connection", {
                        "identifier": c_id,
                        "relationshipRef": rel_ref,
                        "source": src,
                        "target": tgt,
                        f"{{{XSI_NS}}}type": "Relationship"
                    })

    # Serialize and format pretty XML
    raw_xml_bytes = xml_tostring(root, encoding="utf-8")
    parsed_dom = safe_minidom_parse_string(raw_xml_bytes)
    pretty_xml = parsed_dom.toprettyxml(indent="  ", encoding="utf-8").decode("utf-8")

    # Sanitize multiple blank lines generated by minidom
    lines = [l for l in pretty_xml.split("\n") if l.strip()]
    final_xml = "\n".join(lines) + "\n"

    safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', (target_view.name if target_view else model.name) or "archimate_model")
    filename = f"{safe_name}_archimate_exchange.xml"

    return final_xml, filename
