import re
from defusedxml.ElementTree import fromstring as safe_xml_fromstring
from typing import Dict, List, Any, Optional, Tuple
import uuid

LAYER_MAPPING = {
    # Strategy
    "Resource": "Strategy",
    "Capability": "Strategy",
    "ValueStream": "Strategy",
    "CourseOfAction": "Strategy",
    
    # Business
    "BusinessActor": "Business",
    "BusinessRole": "Business",
    "BusinessCollaboration": "Business",
    "BusinessInterface": "Business",
    "BusinessProcess": "Business",
    "BusinessFunction": "Business",
    "BusinessInteraction": "Business",
    "BusinessEvent": "Business",
    "BusinessService": "Business",
    "BusinessObject": "Business",
    "Contract": "Business",
    "Representation": "Business",
    "Product": "Business",
    
    # Application
    "ApplicationComponent": "Application",
    "ApplicationCollaboration": "Application",
    "ApplicationInterface": "Application",
    "ApplicationFunction": "Application",
    "ApplicationInteraction": "Application",
    "ApplicationProcess": "Application",
    "ApplicationEvent": "Application",
    "ApplicationService": "Application",
    "DataObject": "Application",
    
    # Technology / Infrastructure
    "Node": "Technology",
    "Device": "Technology",
    "SystemSoftware": "Technology",
    "TechnologyCollaboration": "Technology",
    "TechnologyInterface": "Technology",
    "Path": "Technology",
    "CommunicationNetwork": "Technology",
    "TechnologyFunction": "Technology",
    "TechnologyProcess": "Technology",
    "TechnologyInteraction": "Technology",
    "TechnologyEvent": "Technology",
    "TechnologyService": "Technology",
    "Artifact": "Technology",
    
    # Physical
    "Equipment": "Physical",
    "Facility": "Physical",
    "DistributionNetwork": "Physical",
    "Material": "Physical",
    
    # Motivation
    "Stakeholder": "Motivation",
    "Driver": "Motivation",
    "Assessment": "Motivation",
    "Goal": "Motivation",
    "Outcome": "Motivation",
    "Principle": "Motivation",
    "Requirement": "Motivation",
    "Constraint": "Motivation",
    "Meaning": "Motivation",
    "Value": "Motivation",
    
    # Implementation & Migration
    "WorkPackage": "Implementation",
    "Deliverable": "Implementation",
    "ImplementationEvent": "Implementation",
    "Plateau": "Implementation",
    "Gap": "Implementation"
}

RELATIONSHIP_TYPES = [
    "CompositionRelationship", "AggregationRelationship", "AssignmentRelationship",
    "RealizationRelationship", "ServingRelationship", "AccessRelationship",
    "InfluenceRelationship", "TriggeringRelationship", "FlowRelationship",
    "SpecializationRelationship", "AssociationRelationship",
    # Open exchange short forms:
    "Composition", "Aggregation", "Assignment", "Realization", "Serving",
    "Access", "Influence", "Triggering", "Flow", "Specialization", "Association"
]

def clean_tag(tag: str) -> str:
    """Strip XML namespaces."""
    if '}' in tag:
        return tag.split('}', 1)[1]
    return tag

def find_child(elem, tag_name: str):
    if elem is None:
        return None
    child = elem.find(f"{{*}}{tag_name}")
    if child is not None:
        return child
    return elem.find(tag_name)

def get_xsi_type(attrib: Dict[str, str]) -> Optional[str]:
    for key, val in attrib.items():
        if "type" in key.lower():
            if ":" in val:
                return val.split(":", 1)[1]
            return val
    return None

def detect_layer(elem_type: str, folder_hint: Optional[str] = None) -> str:
    # Check exact or normalized type
    norm_type = elem_type.replace("archimate:", "")
    if norm_type in LAYER_MAPPING:
        return LAYER_MAPPING[norm_type]
    
    if folder_hint:
        f_lower = folder_hint.lower()
        for layer in ["strategy", "business", "application", "technology", "motivation", "implementation"]:
            if layer in f_lower:
                return layer.capitalize()
    return "Other"

class ArchiModelParser:
    def __init__(self, xml_content: str | bytes):
        if isinstance(xml_content, bytes):
            xml_content = xml_content.decode("utf-8")
        self.xml_content = xml_content
        self.root = safe_xml_fromstring(
            xml_content,
            forbid_dtd=True,
            forbid_entities=True,
            forbid_external=True,
        )
        # Determine format from XML header / namespaces / tags
        root_tag = clean_tag(self.root.tag).lower()
        if any(clean_tag(child.tag).lower() == "folder" for child in self.root):
            self.format_type = "archi_native"
        elif "opengroup.org" in xml_content or root_tag == "model":
            self.format_type = "open_exchange"
        elif "archimatetool.com" in xml_content or "archimate:" in xml_content:
            self.format_type = "archi_native"
        else:
            self.format_type = "open_exchange"

    def parse(self) -> Dict[str, Any]:
        """Parses the XML model into standard EasyEA schema."""
        if self.format_type == "archi_native":
            return self._parse_archi_native()
        else:
            return self._parse_open_exchange()

    def _parse_archi_native(self) -> Dict[str, Any]:
        model_name = self.root.attrib.get("name", "ArchiMate Model")
        model_desc = ""
        
        # Check for model documentation
        for child in self.root:
            if clean_tag(child.tag) == "documentation":
                model_desc = child.text or ""

        elements: List[Dict[str, Any]] = []
        relationships: List[Dict[str, Any]] = []
        views: List[Dict[str, Any]] = []

        def traverse_folder(folder_elem, parent_type=None):
            f_type = folder_elem.attrib.get("type", parent_type)
            f_name = folder_elem.attrib.get("name", "")

            for child in folder_elem:
                tag = clean_tag(child.tag)
                if tag == "folder":
                    traverse_folder(child, f_type)
                elif tag == "element":
                    xsi_type = get_xsi_type(child.attrib) or ""
                    elem_id = child.attrib.get("id") or f"id-{uuid.uuid4().hex[:8]}"
                    elem_name = child.attrib.get("name", "")
                    doc_elem = child.find("{*}documentation") if child.find("{*}documentation") is not None else child.find("documentation")
                    documentation = doc_elem.text if doc_elem is not None else child.attrib.get("documentation", "")

                    props = {}
                    for prop in child.findall("{*}property"):
                        p_key = prop.attrib.get("key")
                        p_val = prop.attrib.get("value")
                        if p_key:
                            props[p_key] = p_val
                    for prop in child.findall("property"):
                        p_key = prop.attrib.get("key")
                        p_val = prop.attrib.get("value")
                        if p_key:
                            props[p_key] = p_val

                    # Check if relationship
                    if "relationship" in xsi_type.lower() or f_type == "relations" or "source" in child.attrib:
                        source_id = child.attrib.get("source")
                        target_id = child.attrib.get("target")
                        if source_id and target_id:
                            clean_rel_type = xsi_type.replace("archimate:", "")
                            relationships.append({
                                "id": elem_id,
                                "name": elem_name,
                                "type": clean_rel_type or "AssociationRelationship",
                                "source_id": source_id,
                                "target_id": target_id,
                                "documentation": documentation,
                                "properties": props
                            })
                    # Check if diagram view
                    elif "diagram" in xsi_type.lower() or f_type == "diagrams":
                        view_data = self._parse_archi_diagram(child)
                        views.append({
                            "id": elem_id,
                            "name": elem_name or "Diagram View",
                            "viewpoint": child.attrib.get("viewpoint", "Total"),
                            "documentation": documentation,
                            "view_data": view_data
                        })
                    else:
                        clean_elem_type = xsi_type.replace("archimate:", "")
                        layer = detect_layer(clean_elem_type, f_type or f_name)
                        elements.append({
                            "id": elem_id,
                            "name": elem_name or f"Unnamed {clean_elem_type}",
                            "type": clean_elem_type or "ApplicationComponent",
                            "layer": layer,
                            "documentation": documentation,
                            "properties": props
                        })

        for child in self.root:
            if clean_tag(child.tag) == "folder":
                traverse_folder(child)

        return {
            "name": model_name,
            "description": model_desc,
            "source_format": "archi_native",
            "elements": elements,
            "relationships": relationships,
            "views": views
        }

    def _parse_archi_diagram(self, diag_elem) -> Dict[str, Any]:
        nodes = []
        connections = []

        def traverse_diagram_children(parent, parent_node_id=None):
            for child in parent:
                c_tag = clean_tag(child.tag)
                if c_tag in ["child", "node"]:
                    child_id = child.attrib.get("id") or child.attrib.get("identifier") or f"node-{uuid.uuid4().hex[:8]}"
                    elem_ref = child.attrib.get("archimateElement") or child.attrib.get("elementRef")
                    
                    bounds_elem = child.find("{*}bounds") if child.find("{*}bounds") is not None else child.find("bounds")
                    if bounds_elem is not None:
                        x = int(bounds_elem.attrib.get("x", 0))
                        y = int(bounds_elem.attrib.get("y", 0))
                        w = int(bounds_elem.attrib.get("width") or bounds_elem.attrib.get("w", 120))
                        h = int(bounds_elem.attrib.get("height") or bounds_elem.attrib.get("h", 55))
                    else:
                        x = int(child.attrib.get("x", 0))
                        y = int(child.attrib.get("y", 0))
                        w = int(child.attrib.get("width") or child.attrib.get("w", 120))
                        h = int(child.attrib.get("height") or child.attrib.get("h", 55))

                    nodes.append({
                        "id": child_id,
                        "element_id": elem_ref,
                        "x": x,
                        "y": y,
                        "width": w,
                        "height": h,
                        "parent_id": parent_node_id,
                        "name": child.attrib.get("name", "")
                    })

                    # Look for source connections
                    for conn in child.findall("{*}sourceConnection") + child.findall("sourceConnection") + child.findall("{*}connection") + child.findall("connection"):
                        conn_id = conn.attrib.get("id") or conn.attrib.get("identifier") or f"conn-{uuid.uuid4().hex[:8]}"
                        rel_ref = conn.attrib.get("archimateRelationship") or conn.attrib.get("relationshipRef")
                        target_conn_id = conn.attrib.get("target") or conn.attrib.get("targetConnection")
                        connections.append({
                            "id": conn_id,
                            "relationship_id": rel_ref,
                            "source_node_id": child_id,
                            "target_node_id": target_conn_id
                        })

                    # Recursively process nested children (e.g. grouped boxes)
                    traverse_diagram_children(child, parent_node_id=child_id)

                elif c_tag in ["connection", "sourceConnection"]:
                    conn_id = child.attrib.get("id") or child.attrib.get("identifier") or f"conn-{uuid.uuid4().hex[:8]}"
                    rel_ref = child.attrib.get("archimateRelationship") or child.attrib.get("relationshipRef")
                    source_conn_id = child.attrib.get("source") or child.attrib.get("sourceConnection") or parent_node_id
                    target_conn_id = child.attrib.get("target") or child.attrib.get("targetConnection")
                    connections.append({
                        "id": conn_id,
                        "relationship_id": rel_ref,
                        "source_node_id": source_conn_id,
                        "target_node_id": target_conn_id
                    })

        traverse_diagram_children(diag_elem)
        return {
            "nodes": nodes,
            "connections": connections
        }

    def _parse_open_exchange(self) -> Dict[str, Any]:
        def get_elem_text(parent, tag_name: str) -> str:
            if parent is None:
                return ""
            child = find_child(parent, tag_name)
            if child is not None and child.text and child.text.strip():
                return child.text.strip()
            items = parent.findall(f"{{*}}{tag_name}") + parent.findall(tag_name)
            for it in items:
                if it.text and it.text.strip():
                    return it.text.strip()
            return parent.attrib.get(tag_name, "")

        model_name = get_elem_text(self.root, "name") or "Open Exchange ArchiMate Model"
        model_desc = get_elem_text(self.root, "documentation")

        # Parse Property Definitions
        prop_defs: Dict[str, str] = {}
        prop_defs_parent = find_child(self.root, "propertyDefinitions")
        if prop_defs_parent is not None:
            for pdef in prop_defs_parent.findall("{*}propertyDefinition") + prop_defs_parent.findall("propertyDefinition"):
                p_id = pdef.attrib.get("identifier") or pdef.attrib.get("id")
                p_name = get_elem_text(pdef, "name") or p_id
                if p_id:
                    prop_defs[p_id] = p_name

        def extract_properties(item_elem) -> Dict[str, Any]:
            props: Dict[str, Any] = {}
            # Check Open Exchange <properties><property propertyDefinitionRef="...">
            props_elem = find_child(item_elem, "properties")
            if props_elem is not None:
                for p in props_elem.findall("{*}property") + props_elem.findall("property"):
                    p_ref = p.attrib.get("propertyDefinitionRef") or p.attrib.get("propertyRef")
                    val_elem = find_child(p, "value")
                    val = val_elem.text.strip() if (val_elem is not None and val_elem.text) else p.attrib.get("value", "")
                    prop_key = prop_defs.get(p_ref, p_ref)
                    if prop_key:
                        props[prop_key] = val
            # Check native <property key="..." value="..."> if present
            for p in item_elem.findall("{*}property") + item_elem.findall("property"):
                k = p.attrib.get("key")
                v = p.attrib.get("value")
                if k:
                    props[k] = v
            return props

        elements = []
        relationships = []
        views = []

        # Parse Elements
        elems_parent = find_child(self.root, "elements")
        if elems_parent is not None:
            for elem in elems_parent.findall("{*}element") + elems_parent.findall("element"):
                elem_id = elem.attrib.get("identifier") or elem.attrib.get("id") or f"elem-{uuid.uuid4().hex[:8]}"
                raw_type = get_xsi_type(elem.attrib) or elem.attrib.get("type", "ApplicationComponent")
                clean_type = raw_type.replace("archimate:", "").strip()
                
                e_name = get_elem_text(elem, "name") or elem.attrib.get("name", "")
                e_doc = get_elem_text(elem, "documentation")
                props = extract_properties(elem)

                layer = detect_layer(clean_type)
                elements.append({
                    "id": elem_id,
                    "name": e_name or f"Unnamed {clean_type}",
                    "type": clean_type or "ApplicationComponent",
                    "layer": layer,
                    "documentation": e_doc,
                    "properties": props
                })

        # Parse Relationships
        rels_parent = find_child(self.root, "relationships")
        if rels_parent is not None:
            for rel in rels_parent.findall("{*}relationship") + rels_parent.findall("relationship"):
                rel_id = rel.attrib.get("identifier") or rel.attrib.get("id") or f"rel-{uuid.uuid4().hex[:8]}"
                raw_type = get_xsi_type(rel.attrib) or rel.attrib.get("type", "Association")
                clean_type = raw_type.replace("archimate:", "").strip()
                
                # Normalize Open Exchange short relationship names (e.g. "Serving" -> "ServingRelationship")
                if not clean_type.endswith("Relationship"):
                    norm_rel_type = f"{clean_type}Relationship"
                else:
                    norm_rel_type = clean_type

                source_id = rel.attrib.get("source")
                target_id = rel.attrib.get("target")
                r_name = get_elem_text(rel, "name") or rel.attrib.get("name", "")
                r_doc = get_elem_text(rel, "documentation")
                props = extract_properties(rel)

                if source_id and target_id:
                    relationships.append({
                        "id": rel_id,
                        "name": r_name,
                        "type": norm_rel_type,
                        "source_id": source_id,
                        "target_id": target_id,
                        "documentation": r_doc,
                        "properties": props
                    })

        # Parse Views
        views_parent = find_child(self.root, "views")
        if views_parent is not None:
            diagrams_parent = find_child(views_parent, "diagrams")
            target_container = diagrams_parent if diagrams_parent is not None else views_parent
            for view in target_container.findall("{*}view") + target_container.findall("view"):
                v_id = view.attrib.get("identifier") or view.attrib.get("id") or f"view-{uuid.uuid4().hex[:8]}"
                v_name = get_elem_text(view, "name") or view.attrib.get("name", "View")
                v_doc = get_elem_text(view, "documentation")
                viewpoint = view.attrib.get("viewpoint", "Total")

                view_data = self._parse_archi_diagram(view)
                views.append({
                    "id": v_id,
                    "name": v_name,
                    "viewpoint": viewpoint,
                    "documentation": v_doc,
                    "view_data": view_data
                })

        return {
            "name": model_name,
            "description": model_desc,
            "source_format": "open_exchange",
            "elements": elements,
            "relationships": relationships,
            "views": views
        }
