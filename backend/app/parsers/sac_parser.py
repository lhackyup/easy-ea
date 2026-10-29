"""
EasyEA Schema-as-Code (SaC) Parser & AST Engine
Parses '.eac' (EasyEA Architecture Code) declarative DSL into a canonical structured representation
and handles validation with precise line/column reporting.
"""

import re
from typing import Dict, List, Any, Optional, Tuple

# Keyword and ArchiMate Type Mappings
KEYWORD_TO_ARCHIMATE_TYPE = {
    # Strategy
    "resource": "Resource",
    "capability": "Capability",
    "valuestream": "ValueStream",
    "value_stream": "ValueStream",
    "courseofaction": "CourseOfAction",
    "course_of_action": "CourseOfAction",

    # Business
    "actor": "BusinessActor",
    "business_actor": "BusinessActor",
    "role": "BusinessRole",
    "business_role": "BusinessRole",
    "collaboration": "BusinessCollaboration",
    "business_collaboration": "BusinessCollaboration",
    "business_interface": "BusinessInterface",
    "process": "BusinessProcess",
    "business_process": "BusinessProcess",
    "function": "BusinessFunction",
    "business_function": "BusinessFunction",
    "interaction": "BusinessInteraction",
    "business_interaction": "BusinessInteraction",
    "business_event": "BusinessEvent",
    "business_service": "BusinessService",
    "business_object": "BusinessObject",
    "contract": "Contract",
    "representation": "Representation",
    "product": "Product",

    # Application
    "component": "ApplicationComponent",
    "app_component": "ApplicationComponent",
    "application_component": "ApplicationComponent",
    "app_collaboration": "ApplicationCollaboration",
    "application_collaboration": "ApplicationCollaboration",
    "app_interface": "ApplicationInterface",
    "application_interface": "ApplicationInterface",
    "app_function": "ApplicationFunction",
    "application_function": "ApplicationFunction",
    "app_interaction": "ApplicationInteraction",
    "application_interaction": "ApplicationInteraction",
    "app_process": "ApplicationProcess",
    "application_process": "ApplicationProcess",
    "app_event": "ApplicationEvent",
    "application_event": "ApplicationEvent",
    "app_service": "ApplicationService",
    "application_service": "ApplicationService",
    "service": "ApplicationService",
    "data": "DataObject",
    "data_object": "DataObject",

    # Technology
    "node": "Node",
    "device": "Device",
    "system_software": "SystemSoftware",
    "systemsoftware": "SystemSoftware",
    "technology_service": "TechnologyService",
    "technology_interface": "TechnologyInterface",
    "technology_process": "TechnologyProcess",
    "technology_function": "TechnologyFunction",
    "path": "Path",
    "network": "CommunicationNetwork",
    "communication_network": "CommunicationNetwork",
    "artifact": "Artifact",
    "db": "DataObject",  # convenience

    # Motivation & Strategy
    "stakeholder": "Stakeholder",
    "driver": "Driver",
    "assessment": "Assessment",
    "goal": "Goal",
    "outcome": "Outcome",
    "principle": "Principle",
    "requirement": "Requirement",
    "constraint": "Constraint",
    "meaning": "Meaning",
    "value": "Value",

    # Implementation
    "work_package": "WorkPackage",
    "workpackage": "WorkPackage",
    "deliverable": "Deliverable",
    "plateau": "Plateau",
    "gap": "Gap",
    "implementation_event": "ImplementationEvent",

    # Composite & Other
    "grouping": "Grouping",
    "location": "Location",
    "junction": "Junction",
    "and_junction": "AndJunction",
    "or_junction": "OrJunction",
}

# Standard layer for each ArchiMate type
TYPE_TO_LAYER = {
    "Resource": "Strategy", "Capability": "Strategy", "ValueStream": "Strategy", "CourseOfAction": "Strategy",
    "BusinessActor": "Business", "BusinessRole": "Business", "BusinessCollaboration": "Business",
    "BusinessInterface": "Business", "BusinessProcess": "Business", "BusinessFunction": "Business",
    "BusinessInteraction": "Business", "BusinessEvent": "Business", "BusinessService": "Business",
    "BusinessObject": "Business", "Contract": "Business", "Representation": "Business", "Product": "Business",
    "ApplicationComponent": "Application", "ApplicationCollaboration": "Application",
    "ApplicationInterface": "Application", "ApplicationFunction": "Application",
    "ApplicationInteraction": "Application", "ApplicationProcess": "Application",
    "ApplicationEvent": "Application", "ApplicationService": "Application", "DataObject": "Application",
    "Node": "Technology", "Device": "Technology", "SystemSoftware": "Technology",
    "TechnologyService": "Technology", "TechnologyInterface": "Technology",
    "TechnologyProcess": "Technology", "TechnologyFunction": "Technology",
    "Path": "Technology", "CommunicationNetwork": "Technology", "Artifact": "Technology",
    "Equipment": "Physical", "Facility": "Physical", "DistributionNetwork": "Physical", "Material": "Physical",
    "Stakeholder": "Motivation", "Driver": "Motivation", "Assessment": "Motivation", "Goal": "Motivation",
    "Outcome": "Motivation", "Principle": "Motivation", "Requirement": "Motivation", "Constraint": "Motivation",
    "Meaning": "Motivation", "Value": "Motivation",
    "WorkPackage": "Implementation", "Deliverable": "Implementation", "Plateau": "Implementation",
    "Gap": "Implementation", "ImplementationEvent": "Implementation"
}

RELATIONSHIP_ALIASES = {
    "serving": "ServingRelationship",
    "serves": "ServingRelationship",
    "realizes": "RealizationRelationship",
    "realization": "RealizationRelationship",
    "assignment": "AssignmentRelationship",
    "assigned_to": "AssignmentRelationship",
    "assigned-to": "AssignmentRelationship",
    "composition": "CompositionRelationship",
    "composes": "CompositionRelationship",
    "aggregation": "AggregationRelationship",
    "aggregates": "AggregationRelationship",
    "access": "AccessRelationship",
    "accesses": "AccessRelationship",
    "influence": "InfluenceRelationship",
    "influences": "InfluenceRelationship",
    "triggering": "TriggeringRelationship",
    "triggers": "TriggeringRelationship",
    "flow": "FlowRelationship",
    "flows": "FlowRelationship",
    "specialization": "SpecializationRelationship",
    "specializes": "SpecializationRelationship",
    "association": "AssociationRelationship",
    "associates": "AssociationRelationship",
}


class SaCParseError(Exception):
    def __init__(self, message: str, line: int = 1, column: int = 1):
        super().__init__(f"Line {line}, Col {column}: {message}")
        self.message = message
        self.line = line
        self.column = column

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error": self.message,
            "line": self.line,
            "column": self.column
        }


class SaCModel:
    """Represents the parsed AST of a Schema-as-Code document."""
    def __init__(self):
        self.name: str = "Untitled Schema"
        self.model_id: Optional[str] = None
        self.version: str = "1.0"
        self.documentation: str = ""
        self.viewpoint: str = "Total"
        self.elements: List[Dict[str, Any]] = []
        self.relationships: List[Dict[str, Any]] = []
        self.layout: Dict[str, Dict[str, int]] = {}  # alias -> {x, y, width, height}
        self.alias_to_element: Dict[str, Dict[str, Any]] = {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "model_id": self.model_id,
            "version": self.version,
            "documentation": self.documentation,
            "viewpoint": self.viewpoint,
            "elements": self.elements,
            "relationships": self.relationships,
            "layout": self.layout
        }


class SaCParser:
    """Parser for EasyEA Schema-as-Code (.eac) files."""

    def __init__(self, text: str):
        self.raw_text = text
        self.lines = text.splitlines()

    def parse(self) -> SaCModel:
        model = SaCModel()
        
        # Preprocessing: remove block comments /* ... */ and strip trailing whitespace
        clean_text = re.sub(r'/\*[\s\S]*?\*/', '', self.raw_text)
        lines = clean_text.splitlines()

        # Check for top-level schema declaration
        # schema "Name" { ... }
        in_schema = False
        current_block: Optional[str] = None
        block_brace_depth = 0
        brace_depth = 0

        # We'll parse line by line
        for line_idx, line in enumerate(lines):
            line_no = line_idx + 1
            stripped = line.strip()

            # Skip empty lines and full line comments
            if not stripped or stripped.startswith("//") or stripped.startswith("#"):
                continue

            # Strip inline comments (outside quotes)
            stripped = self._strip_inline_comment(stripped)
            if not stripped:
                continue

            # Check for schema header
            schema_match = re.match(r'^schema\s+["\']([^"\']+)["\']\s*\{?$', stripped, re.IGNORECASE)
            if schema_match:
                model.name = schema_match.group(1).strip()
                in_schema = True
                brace_depth += line.count('{') - line.count('}')
                continue

            # Count braces in this line
            open_b = line.count('{')
            close_b = line.count('}')

            # Check if entering a named layer or section block
            # e.g., business { ... }, application { ... }, relationships { ... }, layout { ... }
            block_match = re.match(r'^([a-zA-Z_0-9\-]+)\s*\{$', stripped)
            if block_match:
                b_name = block_match.group(1).lower()
                current_block = b_name
                block_brace_depth = 1
                brace_depth += (open_b - close_b)
                continue

            # Handle block exits
            if stripped == '}':
                if current_block is not None:
                    block_brace_depth -= 1
                    if block_brace_depth <= 0:
                        current_block = None
                brace_depth -= 1
                continue

            # Track inside block braces
            brace_depth += (open_b - close_b)

            # Metadata properties inside schema header: model_id: "...", version: "...", etc.
            meta_match = re.match(r'^(model_id|version|documentation|viewpoint)\s*:\s*["\']([^"\']*)["\']', stripped, re.IGNORECASE)
            if meta_match and current_block is None:
                prop_name = meta_match.group(1).lower()
                prop_val = meta_match.group(2).strip()
                if prop_name == "model_id":
                    model.model_id = prop_val
                elif prop_name == "version":
                    model.version = prop_val
                elif prop_name == "documentation":
                    model.documentation = prop_val
                elif prop_name == "viewpoint":
                    model.viewpoint = prop_val
                continue

            # SECTION: Relationships
            if current_block == "relationships":
                rel = self._parse_relationship_line(stripped, line_no)
                if rel:
                    model.relationships.append(rel)
                continue

            # SECTION: Layout
            if current_block == "layout":
                layout_item = self._parse_layout_line(stripped, line_no)
                if layout_item:
                    alias, bounds = layout_item
                    model.layout[alias] = bounds
                continue

            # If inside relationships or layout was not explicitly grouped, check if it's a relationship line anyway
            # e.g. A -> B : type
            if "->" in stripped or "-->" in stripped or "..>" in stripped or "--*" in stripped or "--o" in stripped:
                rel = self._parse_relationship_line(stripped, line_no)
                if rel:
                    model.relationships.append(rel)
                    continue

            # Otherwise, it must be an element declaration
            elem = self._parse_element_line(stripped, current_block, line_no)
            if elem:
                alias = elem["alias"]
                if alias in model.alias_to_element:
                    raise SaCParseError(f"Duplicate element alias '{alias}' defined.", line=line_no)
                model.elements.append(elem)
                model.alias_to_element[alias] = elem

        return model

    def _strip_inline_comment(self, line: str) -> str:
        """Strip // or # comments outside of quotes."""
        in_quotes = False
        quote_char = None
        for i, ch in enumerate(line):
            if ch in ('"', "'"):
                if not in_quotes:
                    in_quotes = True
                    quote_char = ch
                elif ch == quote_char:
                    in_quotes = False
            elif not in_quotes:
                if ch == '#' or (ch == '/' and i + 1 < len(line) and line[i+1] == '/'):
                    return line[:i].strip()
        return line.strip()

    def _parse_element_line(self, line: str, current_block: Optional[str], line_no: int) -> Optional[Dict[str, Any]]:
        """
        Parses an element line:
        <type_or_keyword> <alias> ["Display Name"] [[prop1: "val", prop2: "val", ...]]
        Example: component CheckoutApp "Mobile Checkout" [time: "Invest", hosting: "Cloud - AWS"]
        """
        # Match type keyword and alias
        # Regex: ^([a-zA-Z_0-9\-]+)\s+([a-zA-Z_0-9\-]+)(.*)$
        match = re.match(r'^([a-zA-Z_0-9\-]+)\s+([a-zA-Z_0-9\-]+)(.*)$', line)
        if not match:
            # Check if line contains properties or is empty
            if line.startswith('[') or line.startswith('}'):
                return None
            raise SaCParseError(f"Invalid syntax for element declaration: '{line}'", line=line_no)

        raw_type = match.group(1).lower()
        alias = match.group(2)
        rest = match.group(3).strip()

        # Resolve ArchiMate type
        archi_type = None
        if raw_type in KEYWORD_TO_ARCHIMATE_TYPE:
            archi_type = KEYWORD_TO_ARCHIMATE_TYPE[raw_type]
        else:
            # Check PascalCase or exact match
            for k_type in TYPE_TO_LAYER.keys():
                if k_type.lower() == raw_type or k_type.lower() == raw_type.replace('_', ''):
                    archi_type = k_type
                    break

        if not archi_type:
            raise SaCParseError(f"Unknown element type '{raw_type}'. Supported keywords include component, process, actor, service, node, data, etc.", line=line_no)

        # Special contextual adjustments:
        # e.g., if inside business block, "service" should map to BusinessService
        if raw_type == "service" and current_block == "business":
            archi_type = "BusinessService"
        elif raw_type == "service" and current_block == "technology":
            archi_type = "TechnologyService"
        elif raw_type == "event" and current_block == "business":
            archi_type = "BusinessEvent"
        elif raw_type == "interface" and current_block == "business":
            archi_type = "BusinessInterface"
        elif raw_type == "interface" and current_block == "application":
            archi_type = "ApplicationInterface"
        elif raw_type == "interface" and current_block == "technology":
            archi_type = "TechnologyInterface"

        # Layer determination
        layer = TYPE_TO_LAYER.get(archi_type, "Application")
        if current_block in ["business", "application", "technology", "strategy", "motivation", "implementation", "physical"]:
            layer = current_block.capitalize()

        # Parse display name and bracketed attributes
        display_name = alias
        name_match = re.search(r'["\']([^"\']+)["\']', rest)
        if name_match:
            display_name = name_match.group(1).strip()
            rest = rest[:name_match.start()] + rest[name_match.end():]

        # Parse properties inside [ ... ]
        props: Dict[str, str] = {}
        props_match = re.search(r'\[(.*)\]', rest)
        if props_match:
            props_str = props_match.group(1)
            props = self._parse_properties_string(props_str, line_no)

        elem_id = props.pop("id", None) or props.pop("repo_id", None)

        return {
            "alias": alias,
            "id": elem_id,
            "name": display_name,
            "type": archi_type,
            "layer": layer,
            "properties": props,
            "line": line_no
        }

    def _parse_relationship_line(self, line: str, line_no: int) -> Optional[Dict[str, Any]]:
        """
        Parses a relationship line:
        <SourceAlias> <Arrow> <TargetAlias> : <Type> ["Label"] [[props]]
        Example: CheckoutApp -> PaymentGW : flow "REST API" [protocol: "HTTPS"]
        """
        # Supported arrows: ->, -->, ..>, --*, --o, -.-
        arrow_pattern = r'(-->|->|\.\.>|--\*|--o|-o|-\*|-)'
        match = re.match(r'^([a-zA-Z_0-9\-]+)\s*' + arrow_pattern + r'\s*([a-zA-Z_0-9\-]+)\s*(.*)$', line)
        if not match:
            return None

        src_alias = match.group(1)
        arrow = match.group(2)
        tgt_alias = match.group(3)
        rest = match.group(4).strip()

        rel_type = "AssociationRelationship"
        name = ""
        props: Dict[str, str] = {}

        # Look for colon separator : <Type> ...
        if rest.startswith(':'):
            rest = rest[1:].strip()
            # Extract relationship type keyword
            type_match = re.match(r'^([a-zA-Z_0-9\-]+)(.*)$', rest)
            if type_match:
                raw_rel_type = type_match.group(1).lower().replace('-', '_')
                rest = type_match.group(2).strip()

                if raw_rel_type in RELATIONSHIP_ALIASES:
                    rel_type = RELATIONSHIP_ALIASES[raw_rel_type]
                else:
                    # Check PascalCase forms
                    for k in [
                        "ServingRelationship", "RealizationRelationship", "AssignmentRelationship",
                        "CompositionRelationship", "AggregationRelationship", "AccessRelationship",
                        "InfluenceRelationship", "TriggeringRelationship", "FlowRelationship",
                        "SpecializationRelationship", "AssociationRelationship"
                    ]:
                        if k.lower() == raw_rel_type or k.lower().replace("relationship", "") == raw_rel_type:
                            rel_type = k
                            break

        # If no explicit type was provided after colon, deduce from arrow
        elif arrow == "--o" or arrow == "-o":
            rel_type = "AggregationRelationship"
        elif arrow == "--*" or arrow == "-*":
            rel_type = "CompositionRelationship"
        elif arrow == "..>":
            rel_type = "AssociationRelationship"
        else:
            rel_type = "ServingRelationship"

        # Extract optional label in quotes
        label_match = re.search(r'["\']([^"\']+)["\']', rest)
        if label_match:
            name = label_match.group(1).strip()
            rest = rest[:label_match.start()] + rest[label_match.end():]

        # Extract optional props [ ... ]
        props_match = re.search(r'\[(.*)\]', rest)
        if props_match:
            props = self._parse_properties_string(props_match.group(1), line_no)

        return {
            "source": src_alias,
            "target": tgt_alias,
            "type": rel_type,
            "name": name,
            "properties": props,
            "line": line_no
        }

    def _parse_layout_line(self, line: str, line_no: int) -> Optional[Tuple[str, Dict[str, int]]]:
        """
        Parses a layout line:
        <Alias>: @pos(x, y, width, height) or @pos(x, y)
        Example: CheckoutApp: @pos(60, 180, 160, 65)
        """
        match = re.match(r'^([a-zA-Z_0-9\-]+)\s*:\s*@pos\s*\(\s*([0-9\-]+)\s*,\s*([0-9\-]+)(?:\s*,\s*([0-9]+)\s*,\s*([0-9]+))?\s*\)', line)
        if not match:
            return None

        alias = match.group(1)
        x = int(match.group(2))
        y = int(match.group(3))
        w = int(match.group(4)) if match.group(4) else 160
        h = int(match.group(5)) if match.group(5) else 65

        return (alias, {"x": x, "y": y, "width": w, "height": h})

    def _parse_properties_string(self, text: str, line_no: int) -> Dict[str, str]:
        """Parses key-value pairs inside brackets, e.g. time: 'Invest', hosting: 'AWS'."""
        props = {}
        # Pattern: key: "value" or key: value
        matches = re.finditer(r'([a-zA-Z_0-9\-]+)\s*:\s*(?:["\']([^"\']*)["\']|([^,\]\s]+))', text)
        for m in matches:
            k = m.group(1).strip()
            v = (m.group(2) if m.group(2) is not None else m.group(3)).strip()
            
            # Normalize APM property keys if typed informally
            k_lower = k.lower().replace("-", "_")
            if k_lower in ("time", "time_quadrant"):
                k = "TIME_Quadrant"
            elif k_lower in ("lifecycle", "lifecycle_status"):
                k = "Lifecycle_Status"
            elif k_lower in ("criticality", "business_criticality"):
                k = "Business_Criticality"
            elif k_lower in ("hosting", "hosting_type"):
                k = "Hosting_Type"
            elif k_lower in ("owner", "business_owner"):
                k = "Business_Owner"
            elif k_lower in ("tech_owner", "technical_owner"):
                k = "Technical_Owner"
            elif k_lower in ("cost", "annual_cost", "annual_cost_eur"):
                k = "Annual_Cost_EUR"
            elif k_lower in ("sla", "sla_level"):
                k = "SLA_Level"
            elif k_lower in ("data_classification", "classification"):
                k = "Data_Classification"

            props[k] = v
        return props
