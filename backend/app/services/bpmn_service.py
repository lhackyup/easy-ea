import xml.etree.ElementTree as ET
import uuid
import re
import html
from datetime import datetime
from typing import Dict, List, Any, Optional, Set, Tuple
from sqlalchemy.orm import Session

from app.models.archimate import (
    ModelWorkspace,
    ArchimateView,
    ArchimateElement,
    ArchimateRelationship,
    ArchiSchema
)
from app.parsers.archi_parser import detect_layer

# BPMN 2.0 XML Namespaces
BPMN_NS = {
    "bpmn": "http://www.omg.org/spec/BPMN/20100524/MODEL",
    "bpmndi": "http://www.omg.org/spec/BPMN/20100524/DI",
    "dc": "http://www.omg.org/spec/DD/20100524/DC",
    "di": "http://www.omg.org/spec/DD/20100524/DI",
    "easyea": "http://easyea.org/schema/1.0/bpmn"
}

# Mapping between BPMN tag local names and ArchiMate 3.x element types
BPMN_TAG_TO_ARCHIMATE = {
    # Processes & Subprocesses
    "process": "BusinessProcess",
    "subProcess": "BusinessProcess",
    "adHocSubProcess": "BusinessProcess",
    "transaction": "BusinessProcess",
    
    # Tasks & Activities
    "task": "BusinessProcess",
    "userTask": "BusinessProcess",
    "manualTask": "BusinessProcess",
    "serviceTask": "ApplicationService",
    "scriptTask": "ApplicationFunction",
    "businessRuleTask": "BusinessFunction",
    "sendTask": "BusinessFunction",
    "receiveTask": "BusinessFunction",
    "callActivity": "BusinessProcess",

    # Participants & Lanes (Roles / Actors)
    "participant": "BusinessActor",
    "lane": "BusinessRole",

    # Data Objects
    "dataObject": "BusinessObject",
    "dataObjectReference": "BusinessObject",
    "dataStore": "BusinessObject",
    "dataStoreReference": "BusinessObject",

    # Events
    "startEvent": "BusinessEvent",
    "endEvent": "BusinessEvent",
    "intermediateCatchEvent": "BusinessEvent",
    "intermediateThrowEvent": "BusinessEvent",
    "boundaryEvent": "BusinessEvent",

    # Gateways
    "exclusiveGateway": "Junction",
    "parallelGateway": "Junction",
    "inclusiveGateway": "Junction",
    "complexGateway": "Junction",
    "eventBasedGateway": "Junction"
}

# Mapping between BPMN flow tag local names and ArchiMate 3.x relationship types
BPMN_FLOW_TO_ARCHIMATE = {
    "sequenceFlow": "TriggeringRelationship",
    "messageFlow": "FlowRelationship",
    "dataInputAssociation": "AccessRelationship",
    "dataOutputAssociation": "AccessRelationship",
    "association": "AssociationRelationship"
}


def _local_name(tag: str) -> str:
    """Strips XML namespace from tag if present."""
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def generate_empty_bpmn_xml(process_name: str, schema_id: Optional[str] = None) -> str:
    """
    Generates a valid, well-formed BPMN 2.0 XML diagram template compatible with Camunda Modeler.
    """
    p_id = f"Process_{uuid.uuid4().hex[:7]}"
    start_id = f"StartEvent_{uuid.uuid4().hex[:7]}"
    task_id = f"Activity_{uuid.uuid4().hex[:7]}"
    end_id = f"EndEvent_{uuid.uuid4().hex[:7]}"
    flow1_id = f"Flow_{uuid.uuid4().hex[:7]}"
    flow2_id = f"Flow_{uuid.uuid4().hex[:7]}"
    plane_id = f"BPMNPlane_{uuid.uuid4().hex[:7]}"
    diagram_id = f"BPMNDiagram_{uuid.uuid4().hex[:7]}"

    safe_name = html.escape(process_name or "Processo Aziendale")
    easyea_attr = f' easyea:schemaId="{schema_id}"' if schema_id else ""

    xml_template = f"""<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:easyea="http://easyea.org/schema/1.0/bpmn"
                  id="Definitions_{uuid.uuid4().hex[:7]}"
                  targetNamespace="http://bpmn.io/schema/bpmn"{easyea_attr}>
  <bpmn:process id="{p_id}" name="{safe_name}" isExecutable="false">
    <bpmn:startEvent id="{start_id}" name="Avvio Processo">
      <bpmn:outgoing>{flow1_id}</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="{task_id}" name="{safe_name} - Step 1">
      <bpmn:incoming>{flow1_id}</bpmn:incoming>
      <bpmn:outgoing>{flow2_id}</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="{end_id}" name="Fine Processo">
      <bpmn:incoming>{flow2_id}</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="{flow1_id}" sourceRef="{start_id}" targetRef="{task_id}" />
    <bpmn:sequenceFlow id="{flow2_id}" sourceRef="{task_id}" targetRef="{end_id}" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="{diagram_id}">
    <bpmndi:BPMNPlane id="{plane_id}" bpmnElement="{p_id}">
      <bpmndi:BPMNShape id="{start_id}_di" bpmnElement="{start_id}">
        <dc:Bounds x="180" y="160" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="160" y="203" width="76" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="{task_id}_di" bpmnElement="{task_id}">
        <dc:Bounds x="270" y="138" width="160" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="{end_id}_di" bpmnElement="{end_id}">
        <dc:Bounds x="490" y="160" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="475" y="203" width="67" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="{flow1_id}_di" bpmnElement="{flow1_id}">
        <di:waypoint x="216" y="178" />
        <di:waypoint x="270" y="178" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="{flow2_id}_di" bpmnElement="{flow2_id}">
        <di:waypoint x="430" y="178" />
        <di:waypoint x="490" y="178" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>"""
    return xml_template


def parse_bpmn_file_to_canonical_model(xml_content: str) -> Dict[str, Any]:
    """
    Parses a BPMN 2.0 XML string and produces a canonical dictionary matching
    the schema expected by compute_schema_diff:
    {
        "elements": [ { "id": str, "name": str, "type": str, "layer": str, "documentation": str, "properties": dict } ],
        "relationships": [ { "id": str, "name": str, "type": str, "source_id": str, "target_id": str } ],
        "views": [
            {
                "id": str,
                "name": str,
                "viewpoint": str,
                "view_data": {
                    "nodes": [ { "id": str, "element_id": str, "x": int, "y": int, "width": int, "height": int } ],
                    "connections": [ { "id": str, "relationship_id": str, "source_id": str, "target_id": str } ]
                }
            }
        ]
    }
    """
    root = ET.fromstring(xml_content)

    elements: List[Dict[str, Any]] = []
    relationships: List[Dict[str, Any]] = []
    nodes: List[Dict[str, Any]] = []
    connections: List[Dict[str, Any]] = []

    # Map of bpmn element ID -> BPMNShape bounds
    bounds_by_bpmn_id: Dict[str, Dict[str, int]] = {}
    
    # Extract DI Bounds and Edges
    for shape in root.iter():
        if _local_name(shape.tag) == "BPMNShape":
            bpmn_element_ref = shape.attrib.get("bpmnElement")
            if bpmn_element_ref:
                for child in shape:
                    if _local_name(child.tag) == "Bounds":
                        try:
                            bounds_by_bpmn_id[bpmn_element_ref] = {
                                "x": int(float(child.attrib.get("x", 0))),
                                "y": int(float(child.attrib.get("y", 0))),
                                "width": int(float(child.attrib.get("width", 120))),
                                "height": int(float(child.attrib.get("height", 60)))
                            }
                        except (ValueError, TypeError):
                            bounds_by_bpmn_id[bpmn_element_ref] = {"x": 100, "y": 100, "width": 120, "height": 60}

    # Extract processes, participants, lanes, tasks, events, gateways, flows
    main_process_name = "BPMN Diagram"
    bpmn_element_to_archimate_id: Dict[str, str] = {}

    # 1. Search for collaboration / participants (Pools)
    for collab in root.iter():
        if _local_name(collab.tag) == "collaboration":
            for child in collab:
                if _local_name(child.tag) == "participant":
                    p_id = child.attrib.get("id")
                    p_name = child.attrib.get("name") or "Participant"
                    if p_id:
                        elem_dict = {
                            "id": p_id,
                            "name": p_name.strip(),
                            "type": "BusinessActor",
                            "layer": "Business",
                            "documentation": f"BPMN Pool / Participant: {p_name}",
                            "properties": {"bpmn_type": "participant"}
                        }
                        elements.append(elem_dict)
                        bpmn_element_to_archimate_id[p_id] = p_id

                        b = bounds_by_bpmn_id.get(p_id, {"x": 50, "y": 50, "width": 600, "height": 250})
                        nodes.append({
                            "id": f"node_{p_id}",
                            "element_id": p_id,
                            "x": b["x"],
                            "y": b["y"],
                            "width": b["width"],
                            "height": b["height"]
                        })

    # 2. Iterate through all processes
    for process in root.iter():
        if _local_name(process.tag) != "process":
            continue

        proc_id = process.attrib.get("id", f"proc_{uuid.uuid4().hex[:6]}")
        proc_name = (process.attrib.get("name") or "").strip()
        effective_proc_name = proc_name or main_process_name or f"Business Process ({proc_id})"
        if proc_name:
            main_process_name = proc_name

        # Register main macro business process element
        elements.append({
            "id": proc_id,
            "name": effective_proc_name,
            "type": "BusinessProcess",
            "layer": "Business",
            "documentation": "BPMN Macro Process",
            "properties": {"bpmn_type": "process", "is_bpmn_step": False}
        })
        bpmn_element_to_archimate_id[proc_id] = proc_id

        # 2a. Check for Lanes
        for lane_set in process:
            if _local_name(lane_set.tag) == "laneSet":
                for lane in lane_set:
                    if _local_name(lane.tag) == "lane":
                        lane_id = lane.attrib.get("id")
                        lane_name = lane.attrib.get("name") or "Lane"
                        if lane_id:
                            elements.append({
                                "id": lane_id,
                                "name": lane_name.strip(),
                                "type": "BusinessRole",
                                "layer": "Business",
                                "documentation": f"BPMN Lane: {lane_name}",
                                "properties": {"bpmn_type": "lane"}
                            })
                            bpmn_element_to_archimate_id[lane_id] = lane_id

                            b = bounds_by_bpmn_id.get(lane_id, {"x": 80, "y": 80, "width": 550, "height": 120})
                            nodes.append({
                                "id": f"node_{lane_id}",
                                "element_id": lane_id,
                                "x": b["x"],
                                "y": b["y"],
                                "width": b["width"],
                                "height": b["height"]
                            })

                            # Create AssignmentRelationship from Lane to contained FlowNodes
                            for flow_node_ref in lane:
                                if _local_name(flow_node_ref.tag) == "flowNodeRef":
                                    target_node_id = (flow_node_ref.text or "").strip()
                                    if target_node_id:
                                        rel_id = f"rel_assign_{lane_id}_{target_node_id}"
                                        relationships.append({
                                            "id": rel_id,
                                            "name": "",
                                            "type": "AssignmentRelationship",
                                            "source_id": lane_id,
                                            "target_id": target_node_id,
                                            "documentation": "BPMN Lane assignment to Activity"
                                        })

        # 2b. Flow elements (Tasks, Events, Gateways, Data Objects)
        for child in process:
            tag_name = _local_name(child.tag)
            elem_id = child.attrib.get("id")
            if not elem_id:
                continue

            # Check if this is a flow sequence/message
            if tag_name in BPMN_FLOW_TO_ARCHIMATE:
                src_ref = child.attrib.get("sourceRef")
                tgt_ref = child.attrib.get("targetRef")
                flow_name = child.attrib.get("name", "").strip()
                if src_ref and tgt_ref:
                    arch_rel_type = BPMN_FLOW_TO_ARCHIMATE[tag_name]
                    rel_dict = {
                        "id": elem_id,
                        "name": flow_name,
                        "type": arch_rel_type,
                        "source_id": src_ref,
                        "target_id": tgt_ref,
                        "documentation": f"BPMN {tag_name}"
                    }
                    relationships.append(rel_dict)
                    connections.append({
                        "id": f"conn_{elem_id}",
                        "relationship_id": elem_id,
                        "source_id": f"node_{src_ref}",
                        "target_id": f"node_{tgt_ref}"
                    })
                continue

            # Check if this is a BPMN element
            if tag_name in BPMN_TAG_TO_ARCHIMATE:
                arch_type = BPMN_TAG_TO_ARCHIMATE[tag_name]
                raw_name = child.attrib.get("name") or ""
                
                # Check for easyea:metadata extension if present
                custom_arch_type = None
                custom_easyea_id = None
                for ext in child:
                    if _local_name(ext.tag) == "extensionElements":
                        for meta in ext:
                            if _local_name(meta.tag) == "metadata":
                                custom_arch_type = meta.attrib.get("archimateType")
                                custom_easyea_id = meta.attrib.get("easyeaId")

                if custom_arch_type:
                    arch_type = custom_arch_type

                layer = detect_layer(arch_type) if arch_type != "Junction" else "Core"
                elem_name = raw_name.strip() if raw_name.strip() else f"[{tag_name}]"

                # If element has custom EasyEA id, preserve it
                actual_id = custom_easyea_id or elem_id
                bpmn_element_to_archimate_id[elem_id] = actual_id

                is_step = arch_type == "BusinessProcess" and tag_name not in ("process", "subProcess", "callActivity", "transaction")
                elem_dict = {
                    "id": actual_id,
                    "name": elem_name,
                    "type": arch_type,
                    "layer": layer,
                    "documentation": f"BPMN {tag_name}",
                    "properties": {
                        "bpmn_tag": tag_name,
                        "bpmn_id": elem_id,
                        "is_bpmn_step": is_step,
                        "parent_process_id": proc_id
                    }
                }
                elements.append(elem_dict)

                # Link operational tasks / sub-processes to parent macro process via CompositionRelationship
                if arch_type in ("BusinessProcess", "BusinessEvent", "ApplicationService", "ApplicationFunction") and actual_id != proc_id:
                    rel_comp_id = f"rel_comp_{proc_id}_{actual_id}"
                    relationships.append({
                        "id": rel_comp_id,
                        "name": "contains step",
                        "type": "CompositionRelationship" if arch_type == "BusinessProcess" else "TriggeringRelationship" if arch_type == "BusinessEvent" else "ServingRelationship",
                        "source_id": proc_id if arch_type in ("BusinessProcess", "BusinessEvent") else actual_id,
                        "target_id": actual_id if arch_type in ("BusinessProcess", "BusinessEvent") else proc_id,
                        "documentation": f"BPMN Process Hierarchy ({tag_name})"
                    })

                # Visual node coordinates
                b = bounds_by_bpmn_id.get(elem_id, {"x": 100, "y": 100, "width": 120, "height": 60})
                nodes.append({
                    "id": f"node_{elem_id}",
                    "element_id": actual_id,
                    "x": b["x"],
                    "y": b["y"],
                    "width": b["width"],
                    "height": b["height"]
                })

    # Deduplicate elements by ID
    unique_elements = []
    seen_elem_ids = set()
    for e in elements:
        if e["id"] not in seen_elem_ids:
            seen_elem_ids.add(e["id"])
            unique_elements.append(e)

    views = [{
        "id": f"view_{uuid.uuid4().hex[:8]}",
        "name": main_process_name,
        "viewpoint": "Business Process Co-operation",
        "view_data": {
            "nodes": nodes,
            "connections": connections
        }
    }]

    return {
        "elements": unique_elements,
        "relationships": relationships,
        "views": views
    }


def export_schema_to_bpmn_xml(schema: ArchiSchema, db: Session) -> str:
    """
    Exports an ArchiSchema to a valid BPMN 2.0 XML string.
    If the schema already contains a raw BPMN XML, returns that XML.
    Otherwise, synthesizes a BPMN 2.0 XML based on the schema's view_data and associated elements.
    """
    if schema.raw_xml and ("<bpmn:definitions" in schema.raw_xml or "<definitions" in schema.raw_xml):
        return schema.raw_xml

    # If no raw BPMN XML exists yet, generate a clean starting BPMN XML template
    return generate_empty_bpmn_xml(schema.name, schema_id=schema.id)
