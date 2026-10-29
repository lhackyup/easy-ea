"""
EasyEA Schema-as-Code (SaC) Service
Handles bidirectional transformation:
1. SaC (.eac DSL) -> Canonical Model & ArchiMate XML (.archimate)
2. ArchiMate Model (DB or XML) -> SaC (.eac DSL)
"""

import re
import uuid
from typing import Dict, List, Any, Optional, Tuple, Set
from sqlalchemy.orm import Session
from xml.etree.ElementTree import Element, SubElement, tostring
from defusedxml.minidom import parseString as safe_minidom_parse_string

from app.parsers.sac_parser import SaCParser, SaCModel, SaCParseError, TYPE_TO_LAYER
from app.parsers.archi_parser import ArchiModelParser, LAYER_MAPPING
from app.models.archimate import ArchiSchema, ArchimateElement, ArchimateRelationship, ModelWorkspace


def _sanitize_alias(name: str, used_aliases: Set[str]) -> str:
    """Generate a clean identifier/alias from a name."""
    clean = re.sub(r'[^a-zA-Z0-9_]', '', name.replace(' ', '_').replace('-', '_'))
    if not clean or clean[0].isdigit():
        clean = f"elem_{clean}"
    base = clean
    counter = 1
    while clean.lower() in used_aliases:
        clean = f"{base}_{counter}"
        counter += 1
    used_aliases.add(clean.lower())
    return clean


def _clean_str(val: Any) -> str:
    return "" if val is None else str(val)


class SaCService:

    @staticmethod
    def compile_sac(
        sac_text: str,
        db: Optional[Session] = None,
        model_id: Optional[str] = None,
        schema_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Parses SaC code and produces:
        - parsed schema metadata
        - canonical elements (matched with central DB catalog if db & model_id provided)
        - canonical relationships
        - visual view_data (nodes and connections with layout)
        """
        parser = SaCParser(sac_text)
        sac_model = parser.parse()

        target_model_id = sac_model.model_id or model_id or "sample-easybank-ea"

        # Catalog lookup if db session is present
        existing_elements_by_name: Dict[str, ArchimateElement] = {}
        if db and target_model_id:
            db_elems = db.query(ArchimateElement).filter(ArchimateElement.model_id == target_model_id).all()
            for de in db_elems:
                if de.name:
                    existing_elements_by_name[de.name.strip().lower()] = de
                    if de.id:
                        existing_elements_by_name[de.id.strip().lower()] = de

        # 1. Process Elements
        alias_to_id: Dict[str, str] = {}
        alias_to_node_id: Dict[str, str] = {}
        canonical_elements: List[Dict[str, Any]] = []
        canonical_nodes: List[Dict[str, Any]] = []

        # Default layout computation state
        layer_order = ["Strategy", "Business", "Application", "Technology", "Motivation", "Implementation", "Other"]
        layer_elements: Dict[str, List[Dict[str, Any]]] = {l: [] for l in layer_order}

        for elem in sac_model.elements:
            alias = elem["alias"]
            name = elem["name"]
            el_type = elem["type"]
            props = elem["properties"]
            forced_id = elem.get("id")

            matched_db_elem: Optional[ArchimateElement] = None
            if forced_id and forced_id.strip().lower() in existing_elements_by_name:
                matched_db_elem = existing_elements_by_name[forced_id.strip().lower()]
            elif name and name.strip().lower() in existing_elements_by_name:
                matched_db_elem = existing_elements_by_name[name.strip().lower()]

            if matched_db_elem:
                elem_id = matched_db_elem.id
                is_catalog_match = True
                layer = matched_db_elem.layer or elem.get("layer") or "Application"
                # Merge properties
                combined_props = dict(matched_db_elem.properties or {})
                combined_props.update(props)
                props = combined_props
            else:
                elem_id = forced_id or f"elem-{uuid.uuid4().hex[:12]}"
                is_catalog_match = False
                layer = elem.get("layer") or TYPE_TO_LAYER.get(el_type, "Application")

            alias_to_id[alias] = elem_id
            node_id = f"node-{uuid.uuid4().hex[:8]}"
            alias_to_node_id[alias] = node_id

            elem_record = {
                "id": elem_id,
                "alias": alias,
                "node_id": node_id,
                "name": name,
                "type": el_type,
                "layer": layer,
                "properties": props,
                "is_catalog_match": is_catalog_match
            }
            canonical_elements.append(elem_record)
            
            # Group by layer for auto-layout if needed
            target_layer_bucket = layer if layer in layer_elements else "Other"
            layer_elements[target_layer_bucket].append(elem_record)

        # 2. Compute Layout (Nodes)
        ELEMENT_WIDTH = 160
        ELEMENT_HEIGHT = 65
        SPACING_X = 40
        SPACING_Y = 30
        LAYER_MARGIN_Y = 60
        MAX_COLS = 5

        # Build normalized layout lookup map
        layout_lookup: Dict[str, Dict[str, int]] = {}
        for l_key, l_pos in sac_model.layout.items():
            layout_lookup[l_key] = l_pos
            layout_lookup[l_key.lower()] = l_pos
            clean_k = re.sub(r'[^a-zA-Z0-9]', '', l_key).lower()
            layout_lookup[clean_k] = l_pos

        def find_pos_for_elem(al: str, el_id: str) -> Optional[Dict[str, int]]:
            if al in layout_lookup:
                return layout_lookup[al]
            if al.lower() in layout_lookup:
                return layout_lookup[al.lower()]
            clean = re.sub(r'[^a-zA-Z0-9]', '', al).lower()
            if clean in layout_lookup:
                return layout_lookup[clean]
            if el_id and el_id in layout_lookup:
                return layout_lookup[el_id]
            if el_id and el_id.lower() in layout_lookup:
                return layout_lookup[el_id.lower()]
            return None

        # Pre-calculate base Y per layer to avoid stacking elements on top of each other
        layer_base_y = {
            "Strategy": 40,
            "Business": 140,
            "Application": 280,
            "Technology": 440,
            "Physical": 580,
            "Motivation": 720,
            "Implementation": 860,
            "Other": 1000
        }

        # Track maximum Y occupied to safely position unmapped elements
        max_y_seen = 40
        for pos in sac_model.layout.values():
            if pos.get("y", 0) > max_y_seen:
                max_y_seen = pos["y"]

        fallback_y_cursor = max_y_seen + ELEMENT_HEIGHT + LAYER_MARGIN_Y

        for layer_name in layer_order:
            elems_in_layer = layer_elements[layer_name]
            if not elems_in_layer:
                continue

            col = 0
            row = 0
            base_layer_y = layer_base_y.get(layer_name, 50)

            for el_rec in elems_in_layer:
                alias = el_rec["alias"]
                matched_pos = find_pos_for_elem(alias, el_rec["id"])

                if matched_pos is not None:
                    x = matched_pos["x"]
                    y = matched_pos["y"]
                    w = matched_pos.get("width", ELEMENT_WIDTH)
                    h = matched_pos.get("height", ELEMENT_HEIGHT)
                else:
                    # Place using intelligent layer grid
                    x = 50 + col * (ELEMENT_WIDTH + SPACING_X)
                    y = base_layer_y + row * (ELEMENT_HEIGHT + SPACING_Y)
                    w = ELEMENT_WIDTH
                    h = ELEMENT_HEIGHT
                    col += 1
                    if col >= MAX_COLS:
                        col = 0
                        row += 1

                canonical_nodes.append({
                    "id": el_rec["node_id"],
                    "element_id": el_rec["id"],
                    "alias": alias,
                    "name": el_rec["name"],
                    "type": el_rec["type"],
                    "layer": el_rec["layer"],
                    "x": x,
                    "y": y,
                    "width": w,
                    "height": h,
                    "properties": el_rec["properties"]
                })

        # 3. Process Relationships
        canonical_relationships: List[Dict[str, Any]] = []
        canonical_connections: List[Dict[str, Any]] = []

        for rel in sac_model.relationships:
            src_alias = rel["source"]
            tgt_alias = rel["target"]

            if src_alias not in alias_to_id:
                raise SaCParseError(f"Relationship references unknown source element alias '{src_alias}'.", line=rel.get("line", 1))
            if tgt_alias not in alias_to_id:
                raise SaCParseError(f"Relationship references unknown target element alias '{tgt_alias}'.", line=rel.get("line", 1))

            src_elem_id = alias_to_id[src_alias]
            tgt_elem_id = alias_to_id[tgt_alias]
            src_node_id = alias_to_node_id[src_alias]
            tgt_node_id = alias_to_node_id[tgt_alias]

            # Try to preserve explicit id or existing DB relationship ID
            rel_props = rel.get("properties", {})
            explicit_rel_id = rel_props.get("id") or rel_props.get("relationship_id")
            rel_id = explicit_rel_id

            rel_type = rel["type"]
            clean_rel_type = rel_type if rel_type.startswith("archimate:") else f"archimate:{rel_type}"
            if not clean_rel_type.endswith("Relationship") and not clean_rel_type.endswith("Association"):
                clean_rel_type = f"{clean_rel_type}Relationship"

            if not rel_id and db and target_model_id:
                # Query DB to find matching relationship between these two elements
                existing_rel = db.query(ArchimateRelationship).filter(
                    ArchimateRelationship.model_id == target_model_id,
                    ArchimateRelationship.source_id == src_elem_id,
                    ArchimateRelationship.target_id == tgt_elem_id
                ).first()
                if existing_rel:
                    rel_id = existing_rel.id

            if not rel_id:
                rel_id = f"rel-{uuid.uuid4().hex[:12]}"

            conn_id = f"conn-{uuid.uuid4().hex[:8]}"

            rel_data = {
                "id": rel_id,
                "type": rel["type"],
                "name": rel.get("name", ""),
                "source_id": src_elem_id,
                "target_id": tgt_elem_id,
                "source_alias": src_alias,
                "target_alias": tgt_alias,
                "properties": rel_props
            }
            canonical_relationships.append(rel_data)

            canonical_connections.append({
                "id": conn_id,
                "relationship_id": rel_id,
                "source_node_id": src_node_id,
                "target_node_id": tgt_node_id,
                "source": src_node_id,
                "target": tgt_node_id,
                "type": rel["type"],
                "name": rel.get("name", "")
            })

        view_data = {
            "nodes": canonical_nodes,
            "connections": canonical_connections
        }

        return {
            "name": sac_model.name,
            "schema_id": schema_id,
            "model_id": target_model_id,
            "version": sac_model.version,
            "documentation": sac_model.documentation,
            "viewpoint": sac_model.viewpoint,
            "elements": canonical_elements,
            "relationships": canonical_relationships,
            "view_data": view_data
        }

    @staticmethod
    def compile_sac_to_archimate_xml(
        sac_text: str,
        db: Optional[Session] = None,
        model_id: Optional[str] = None,
        schema_id: Optional[str] = None
    ) -> str:
        """Compiles SaC code directly to a complete, standalone .archimate XML."""
        compiled = SaCService.compile_sac(sac_text, db=db, model_id=model_id, schema_id=schema_id)
        return SaCService.canonical_to_archimate_xml(compiled, db=db)

    @staticmethod
    def canonical_to_archimate_xml(compiled_data: Dict[str, Any], db: Optional[Session] = None) -> str:
        """Converts compiled SaC canonical data to standard EMF ArchiMate 5.x XML."""
        schema_name = compiled_data.get("name", "EasyEA Schema")
        schema_id = f"id-{uuid.uuid4().hex[:8]}"

        root = Element(
            "archimate:model",
            {
                "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
                "xmlns:archimate": "http://www.archimatetool.com/archimate",
                "name": schema_name,
                "id": schema_id,
                "version": "5.0.0"
            }
        )

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

        # Elements
        for elem in compiled_data.get("elements", []):
            layer = elem.get("layer", "Application")
            layer_lower = layer.lower()
            target_f = "other"
            for k in ["strategy", "business", "application", "technology", "motivation", "implementation"]:
                if k in layer_lower:
                    target_f = k
                    break

            parent = folder_elems.get(target_f, folder_elems["other"])
            el_type = elem.get("type", "ApplicationComponent")
            clean_type = el_type if el_type.startswith("archimate:") else f"archimate:{el_type}"

            el_node = SubElement(
                parent,
                "element",
                {
                    "xsi:type": clean_type,
                    "id": elem["id"],
                    "name": elem.get("name", "")
                }
            )

            # Properties
            props = elem.get("properties", {})
            if isinstance(props, dict):
                for pk, pv in props.items():
                    if pv is not None and str(pv).strip() != "":
                        SubElement(el_node, "property", {"key": str(pk), "value": str(pv)})

        # Relationships
        elem_id_to_xml_id = {e["id"]: e["id"] for e in compiled_data.get("elements", [])}
        rel_folder = folder_elems["relations"]

        for rel in compiled_data.get("relationships", []):
            rel_type = rel.get("type", "AssociationRelationship")
            clean_rel_type = rel_type if rel_type.startswith("archimate:") else f"archimate:{rel_type}"
            if not clean_rel_type.endswith("Relationship") and not clean_rel_type.endswith("Association"):
                clean_rel_type = f"{clean_rel_type}Relationship"

            rel_node = SubElement(
                rel_folder,
                "element",
                {
                    "xsi:type": clean_rel_type,
                    "id": rel["id"],
                    "source": rel["source_id"],
                    "target": rel["target_id"],
                    "name": rel.get("name", "")
                }
            )
            props = rel.get("properties", {})
            if isinstance(props, dict):
                for pk, pv in props.items():
                    if pv is not None and str(pv).strip() != "":
                        SubElement(rel_node, "property", {"key": str(pk), "value": str(pv)})

        # Diagram View
        views_folder = folder_elems["diagrams"]
        view_id = f"view-{uuid.uuid4().hex[:8]}"
        view_node = SubElement(
            views_folder,
            "element",
            {
                "xsi:type": "archimate:ArchimateDiagramModel",
                "id": view_id,
                "name": schema_name
            }
        )

        nodes = compiled_data.get("view_data", {}).get("nodes", [])
        connections = compiled_data.get("view_data", {}).get("connections", [])

        # Filter valid connections and build target connection mapping
        valid_node_ids = {n["id"] for n in nodes if "id" in n}
        valid_connections = []
        for c in connections:
            s_id = c.get("source_node_id") or c.get("source")
            t_id = c.get("target_node_id") or c.get("target")
            if s_id in valid_node_ids and t_id in valid_node_ids:
                c_copy = dict(c)
                if not c_copy.get("id"):
                    c_copy["id"] = f"conn-{uuid.uuid4().hex[:8]}"
                valid_connections.append(c_copy)

        # Map target connections: Node ID -> list of connection IDs targeting this node
        target_conns_map: Dict[str, List[str]] = {}
        for c in valid_connections:
            t_id = c.get("target_node_id") or c.get("target")
            c_id = c["id"]
            target_conns_map.setdefault(t_id, []).append(c_id)

        # Build Diagram Objects with targetConnections
        node_elem_map = {}
        for n in nodes:
            node_id = n["id"]
            child_attribs = {
                "xsi:type": "archimate:DiagramObject",
                "id": node_id,
                "archimateElement": n["element_id"]
            }
            if node_id in target_conns_map:
                child_attribs["targetConnections"] = " ".join(target_conns_map[node_id])

            d_obj = SubElement(view_node, "child", child_attribs)
            
            SubElement(
                d_obj,
                "bounds",
                {
                    "x": str(n.get("x", 50)),
                    "y": str(n.get("y", 50)),
                    "width": str(n.get("width", 160)),
                    "height": str(n.get("height", 65))
                }
            )
            node_elem_map[node_id] = d_obj

        # Add sourceConnection on each source DiagramObject
        for c in valid_connections:
            s_node_id = c.get("source_node_id") or c.get("source")
            t_node_id = c.get("target_node_id") or c.get("target")
            src_obj = node_elem_map.get(s_node_id)
            if src_obj is not None:
                SubElement(
                    src_obj,
                    "sourceConnection",
                    {
                        "xsi:type": "archimate:Connection",
                        "id": c["id"],
                        "source": s_node_id,
                        "target": t_node_id,
                        "archimateRelationship": c.get("relationship_id")
                    }
                )

        # Root model properties for EasyEA integration
        schema_db_id = compiled_data.get("schema_id")
        model_db_id = compiled_data.get("model_id")
        if schema_db_id:
            SubElement(root, "property", {"key": "EasyEA_Schema_ID", "value": str(schema_db_id)})
        if model_db_id:
            SubElement(root, "property", {"key": "EasyEA_Model_ID", "value": str(model_db_id)})
        SubElement(root, "property", {"key": "EasyEA_Schema_Name", "value": schema_name})

        if db and model_db_id:
            ws = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_db_id).first()
            if ws:
                SubElement(root, "property", {"key": "EasyEA_Library_Name", "value": str(ws.name or "")})
                if ws.code:
                    SubElement(root, "property", {"key": "EasyEA_Library_Code", "value": str(ws.code)})

        raw_xml = tostring(root, encoding="utf-8")
        parsed = safe_minidom_parse_string(raw_xml)
        return parsed.toprettyxml(indent="  ", encoding="utf-8").decode("utf-8")

    @staticmethod
    def decompile_schema_to_sac(
        schema: Optional[ArchiSchema] = None,
        raw_xml: Optional[str] = None,
        db: Optional[Session] = None,
        include_layout: bool = True
    ) -> str:
        """
        De-compiles an ArchiSchema or raw ArchiMate XML into human-friendly '.eac' code.
        Preserves all elements, relationships, APM properties, and visual layout.
        """
        # Parse XML or DB schema
        elements = []
        relationships = []
        schema_name = "Exported Schema"
        viewpoint = "Total"
        documentation = ""
        model_id = ""
        node_bounds: Dict[str, Dict[str, int]] = {}

        if schema:
            schema_name = schema.name or "Exported Schema"
            viewpoint = schema.viewpoint or "Total"
            documentation = schema.documentation or ""
            model_id = schema.model_id or ""

            # Check if raw_xml is available
            if schema.raw_xml and ("<archimate:model" in schema.raw_xml or "<model" in schema.raw_xml):
                parser = ArchiModelParser(schema.raw_xml)
                parsed = parser.parse()
                elements = parsed.get("elements", [])
                relationships = parsed.get("relationships", [])
                
                # Extract visual bounds directly from raw_xml diagrams
                for v in parsed.get("views", []):
                    v_data = v.get("view_data", {})
                    for n in v_data.get("nodes", []):
                        eid = n.get("element_id")
                        if eid:
                            node_bounds[eid] = {
                                "x": int(n.get("x", 50)),
                                "y": int(n.get("y", 50)),
                                "width": int(n.get("width", 160)),
                                "height": int(n.get("height", 65))
                            }
            else:
                view_data = schema.view_data if isinstance(schema.view_data, dict) else {}
                nodes = view_data.get("nodes", [])
                elem_ids = [n.get("element_id") for n in nodes if n.get("element_id")]
                
                if db and elem_ids:
                    elements = db.query(ArchimateElement).filter(ArchimateElement.id.in_(elem_ids)).all()
                    elements = [{
                        "id": e.id, "name": e.name, "type": e.type, "layer": e.layer,
                        "properties": e.properties or {}, "documentation": e.documentation or ""
                    } for e in elements]
                
                conns = view_data.get("connections", [])
                rel_ids = [c.get("relationship_id") for c in conns if c.get("relationship_id")]
                if db and rel_ids:
                    rels = db.query(ArchimateRelationship).filter(ArchimateRelationship.id.in_(rel_ids)).all()
                    relationships = [{
                        "id": r.id, "name": r.name, "type": r.type, "source": r.source_id,
                        "target": r.target_id, "properties": r.properties or {}, "documentation": r.documentation or ""
                    } for r in rels]

            # Merge or enrich visual bounds from schema.view_data
            if isinstance(schema.view_data, dict):
                for n in schema.view_data.get("nodes", []):
                    eid = n.get("element_id")
                    if eid:
                        node_bounds[eid] = {
                            "x": int(n.get("x", 50)),
                            "y": int(n.get("y", 50)),
                            "width": int(n.get("width", 160)),
                            "height": int(n.get("height", 65))
                        }

        elif raw_xml:
            parser = ArchiModelParser(raw_xml)
            parsed = parser.parse()
            schema_name = parsed.get("name") or "Archi Model"
            elements = parsed.get("elements", [])
            relationships = parsed.get("relationships", [])

            # Extract visual bounds from raw_xml diagrams
            for v in parsed.get("views", []):
                v_data = v.get("view_data", {})
                for n in v_data.get("nodes", []):
                    eid = n.get("element_id")
                    if eid:
                        node_bounds[eid] = {
                            "x": int(n.get("x", 50)),
                            "y": int(n.get("y", 50)),
                            "width": int(n.get("width", 160)),
                            "height": int(n.get("height", 65))
                        }

        # Assign clean aliases to each element
        elem_id_to_alias: Dict[str, str] = {}
        used_aliases: Set[str] = set()

        for el in elements:
            el_id = el.get("id") or str(uuid.uuid4())[:8]
            name = el.get("name") or f"Component_{el_id[:6]}"
            alias = _sanitize_alias(name, used_aliases)
            elem_id_to_alias[el_id] = alias

        # Group elements by ArchiMate layer
        layer_groups: Dict[str, List[Dict[str, Any]]] = {
            "strategy": [],
            "business": [],
            "application": [],
            "technology": [],
            "motivation": [],
            "implementation": [],
            "other": []
        }

        for el in elements:
            layer = (el.get("layer") or TYPE_TO_LAYER.get(el.get("type", ""), "Other")).lower()
            placed = False
            for k in ["strategy", "business", "application", "technology", "motivation", "implementation"]:
                if k in layer:
                    layer_groups[k].append(el)
                    placed = True
                    break
            if not placed:
                layer_groups["other"].append(el)

        # Build SaC Code Lines
        lines = []
        lines.append(f'schema "{schema_name}" {{')
        if model_id:
            lines.append(f'    model_id: "{model_id}"')
        if viewpoint and viewpoint != "Total":
            lines.append(f'    viewpoint: "{viewpoint}"')
        if documentation:
            lines.append(f'    documentation: "{documentation}"')
        lines.append('')

        # Function to format properties
        def format_props(props: Dict[str, Any], elem_id: Optional[str] = None) -> str:
            p_items = []
            if elem_id:
                p_items.append(f'id: "{elem_id}"')
            if isinstance(props, dict):
                for k, v in props.items():
                    if k.lower() not in ("id", "easy_id", "easyea_element_id") and v is not None and str(v).strip() != "":
                        val_str = str(v).replace('"', '\\"')
                        p_items.append(f'{k}: "{val_str}"')
            if p_items:
                return f" [{', '.join(p_items)}]"
            return ""

        # Function to get simplified keyword for type
        def get_type_keyword(archi_type: str) -> str:
            clean = archi_type.replace("archimate:", "").replace("Relationship", "")
            reverse_map = {
                "ApplicationComponent": "component",
                "ApplicationService": "service",
                "DataObject": "data",
                "BusinessActor": "actor",
                "BusinessRole": "role",
                "BusinessProcess": "process",
                "BusinessFunction": "function",
                "BusinessService": "service",
                "BusinessEvent": "event",
                "Node": "node",
                "Device": "device",
                "SystemSoftware": "system_software",
                "Capability": "capability",
                "Goal": "goal",
                "Requirement": "requirement",
                "WorkPackage": "work_package"
            }
            return reverse_map.get(clean, clean)

        # Output Layers
        for layer_key, layer_elements in layer_groups.items():
            if not layer_elements:
                continue

            lines.append(f'    {layer_key} {{')
            for el in layer_elements:
                alias = elem_id_to_alias[el["id"]]
                name = el.get("name", alias)
                kw = get_type_keyword(el.get("type", "ApplicationComponent"))
                props_str = format_props(el.get("properties", {}), el["id"])
                
                # Format: keyword Alias "Display Name" [props]
                lines.append(f'        {kw} {alias} "{name}"{props_str}')
            lines.append('    }')
            lines.append('')

        # Output Relationships
        if relationships:
            lines.append('    relationships {')
            for rel in relationships:
                s_id = rel.get("source") or rel.get("source_id")
                t_id = rel.get("target") or rel.get("target_id")

                s_alias = elem_id_to_alias.get(s_id, f"src_{str(s_id)[:6]}")
                t_alias = elem_id_to_alias.get(t_id, f"tgt_{str(t_id)[:6]}")

                raw_rel_type = rel.get("type", "AssociationRelationship").replace("archimate:", "")
                clean_rel_kw = raw_rel_type.lower().replace("relationship", "")
                
                label = rel.get("name", "").strip()
                label_str = f' "{label}"' if label else ""
                props_str = format_props(rel.get("properties", {}))

                lines.append(f'        {s_alias} -> {t_alias} : {clean_rel_kw}{label_str}{props_str}')
            lines.append('    }')
            lines.append('')

        # Output Layout Block if requested and bounds available
        if include_layout and node_bounds:
            lines.append('    layout {')
            for el in elements:
                el_id = el.get("id")
                if el_id in node_bounds and el_id in elem_id_to_alias:
                    alias = elem_id_to_alias[el_id]
                    b = node_bounds[el_id]
                    lines.append(f'        {alias}: @pos({b["x"]}, {b["y"]}, {b["width"]}, {b["height"]})')
            lines.append('    }')
            lines.append('')

        lines.append('}')
        return '\n'.join(lines)
