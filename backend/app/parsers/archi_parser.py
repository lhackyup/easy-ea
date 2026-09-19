import re
import xml.etree.ElementTree as ET
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
    def __init__(self, xml_content: str):
        self.xml_content = xml_content
        self.root = ET.fromstring(xml_content)
        # Determine format from XML header / namespaces / tags
        if "archimatetool.com" in xml_content or "archimate:" in xml_content:
            self.format_type = "archi_native"
        elif "opengroup.org" in xml_content:
            self.format_type = "open_exchange"
        elif any(clean_tag(child.tag) == "folder" for child in self.root):
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
                    child_id = child.attrib.get("id")
                    elem_ref = child.attrib.get("archimateElement") or child.attrib.get("elementRef")
                    
                    bounds_elem = child.find("{*}bounds") if child.find("{*}bounds") is not None else child.find("bounds")
                    x = int(bounds_elem.attrib.get("x", 0)) if bounds_elem is not None else 0
                    y = int(bounds_elem.attrib.get("y", 0)) if bounds_elem is not None else 0
                    w = int(bounds_elem.attrib.get("width", 120)) if bounds_elem is not None else 120
                    h = int(bounds_elem.attrib.get("height", 55)) if bounds_elem is not None else 55

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
                        conn_id = conn.attrib.get("id")
                        rel_ref = conn.attrib.get("archimateRelationship") or conn.attrib.get("relationshipRef")
                        target_conn_id = conn.attrib.get("target")
                        connections.append({
                            "id": conn_id,
                            "relationship_id": rel_ref,
                            "source_node_id": child_id,
                            "target_node_id": target_conn_id
                        })

                    # Recursively process nested children (e.g. grouped boxes)
                    traverse_diagram_children(child, parent_node_id=child_id)

        traverse_diagram_children(diag_elem)
        return {
            "nodes": nodes,
            "connections": connections
        }

    def _parse_open_exchange(self) -> Dict[str, Any]:
        name_elem = self.root.find("{*}name") or self.root.find("name")
        model_name = name_elem.text if name_elem is not None else "Open Exchange ArchiMate Model"
        doc_elem = self.root.find("{*}documentation") or self.root.find("documentation")
        model_desc = doc_elem.text if doc_elem is not None else ""

        elements = []
        relationships = []
        views = []

        # Parse Elements
        elems_parent = self.root.find("{*}elements") or self.root.find("elements")
        if elems_parent is not None:
            for elem in elems_parent:
                elem_id = elem.attrib.get("identifier") or elem.attrib.get("id")
                xsi_type = get_xsi_type(elem.attrib) or "ApplicationComponent"
                e_name_el = elem.find("{*}name") or elem.find("name")
                e_name = e_name_el.text if e_name_el is not None else elem.attrib.get("name", "")
                e_doc_el = elem.find("{*}documentation") or elem.find("documentation")
                e_doc = e_doc_el.text if e_doc_el is not None else ""

                layer = detect_layer(xsi_type)
                elements.append({
                    "id": elem_id,
                    "name": e_name or f"Unnamed {xsi_type}",
                    "type": xsi_type,
                    "layer": layer,
                    "documentation": e_doc,
                    "properties": {}
                })

        # Parse Relationships
        rels_parent = self.root.find("{*}relationships") or self.root.find("relationships")
        if rels_parent is not None:
            for rel in rels_parent:
                rel_id = rel.attrib.get("identifier") or rel.attrib.get("id")
                xsi_type = get_xsi_type(rel.attrib) or "Association"
                source_id = rel.attrib.get("source")
                target_id = rel.attrib.get("target")
                r_name_el = rel.find("{*}name") or rel.find("name")
                r_name = r_name_el.text if r_name_el is not None else ""
                r_doc_el = rel.find("{*}documentation") or rel.find("documentation")
                r_doc = r_doc_el.text if r_doc_el is not None else ""

                if source_id and target_id:
                    relationships.append({
                        "id": rel_id,
                        "name": r_name,
                        "type": xsi_type,
                        "source_id": source_id,
                        "target_id": target_id,
                        "documentation": r_doc,
                        "properties": {}
                    })

        # Parse Views
        views_parent = self.root.find("{*}views") or self.root.find("views")
        if views_parent is not None:
            diagrams_parent = views_parent.find("{*}diagrams") or views_parent.find("diagrams") or views_parent
            for view in diagrams_parent.findall("{*}view") + diagrams_parent.findall("view"):
                v_id = view.attrib.get("identifier") or view.attrib.get("id")
                v_name_el = view.find("{*}name") or view.find("name")
                v_name = v_name_el.text if v_name_el is not None else view.attrib.get("name", "View")
                v_doc_el = view.find("{*}documentation") or view.find("documentation")
                v_doc = v_doc_el.text if v_doc_el is not None else ""

                view_data = self._parse_archi_diagram(view)
                views.append({
                    "id": v_id,
                    "name": v_name,
                    "viewpoint": view.attrib.get("viewpoint", "Total"),
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
