#!/usr/bin/env python3
"""
RAMI 4.0 & ISA-95 Package Builder for EasyEA
Compiles the complete Industrie 4.0, Smart Factory, and Manufacturing Operations
Management reference model into a downloadable .eap bundle and registers it in index.json.
"""

import os
import io
import json
import zipfile
import hashlib
import re
from typing import Dict, List, Any

from rami_taxonomy import (
    RAMI_LAYERS,
    HIERARCHY_LEVELS,
    ISA95_MOM_OPERATIONS,
    INDUSTRIAL_SOFTWARE_COMPONENTS,
    PHYSICAL_ASSETS,
    INDUSTRIAL_DATA_ENTITIES
)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TARGET_EAP_PATH = os.path.join(REPO_ROOT, "backend", "app", "packages_repository", "rami-isa95-1.0.0.eap")
INDEX_JSON_PATH = os.path.join(REPO_ROOT, "backend", "app", "packages_repository", "index.json")

def build_rami_package():
    print("=" * 70)
    print("EasyEA RAMI 4.0 & ISA-95 Industrie 4.0 Package Builder")
    print("=" * 70)

    # 1. Manifest
    manifest = {
        "$schema": "https://easyea.org/schemas/package-manifest-v1.json",
        "id": "pkg-rami-isa95",
        "code": "rami",
        "name": "RAMI 4.0 & ISA-95 Smart Manufacturing Standard",
        "version": "1.0.0",
        "package_type": "framework",
        "standard_version": "v4.0 / IEC 62264",
        "description": "Reference Architectural Model Industrie 4.0 (RAMI 4.0 - DIN SPEC 91345) & ISA-95 (IEC 62264) - Standard canonical reference architecture for Smart Factory, OT/IT convergence, Asset Administration Shell (AAS Digital Twin), and Manufacturing Operations Management (MOM/MES).",
        "author": "Plattform Industrie 4.0 & MESA International",
        "license": "Open Standard / Apache-2.0",
        "website_url": "https://www.plattform-i40.de",
        "icon_color": "amber",
        "is_default_active": False
    }

    # 2. Attributes
    attributes = [
        {
            "name": "isa95_level",
            "label": "ISA-95 Functional Level",
            "description": "Hierarchical level in the industrial automation pyramid (IEC 62264).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": [
                "Level 0 - Physical Process",
                "Level 1 - Sensing & Actuation",
                "Level 2 - Control & SCADA",
                "Level 3 - Operations & MES/MOM",
                "Level 4 - Enterprise & ERP",
                "Level 5+ - Connected World & Cloud"
            ],
            "default_value": "Level 3 - Operations & MES/MOM",
            "is_required": True,
            "section": "ISA-95 Hierarchy",
            "sort_order": 1
        },
        {
            "name": "rami_layer",
            "label": "RAMI 4.0 Architectural Layer",
            "description": "Vertical layer dimension of the RAMI 4.0 reference model (DIN SPEC 91345).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Asset Layer", "Integration Layer", "Communication Layer", "Information Layer", "Functional Layer", "Business Layer"],
            "default_value": "Functional Layer",
            "is_required": True,
            "section": "RAMI 4.0 Coordinates",
            "sort_order": 2
        },
        {
            "name": "rami_hierarchy",
            "label": "RAMI 4.0 Hierarchy Level",
            "description": "Horizontal hierarchy axis from Product to Connected World.",
            "element_type": "Equipment",
            "layer": "Physical",
            "data_type": "select",
            "options": ["Product", "Field Device", "Control Device", "Station", "Work Center", "Enterprise", "Connected World"],
            "default_value": "Station",
            "is_required": True,
            "section": "RAMI 4.0 Coordinates",
            "sort_order": 3
        },
        {
            "name": "industrial_protocols",
            "label": "Industrial Field & Telemetry Protocols",
            "description": "Standard communication protocols (e.g. OPC-UA, MQTT Sparkplug B, PROFINET, Modbus TCP).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "OPC-UA",
            "is_required": False,
            "section": "Industrial OT/IT Connectivity",
            "sort_order": 4
        },
        {
            "name": "aas_ready",
            "label": "Asset Administration Shell (AAS) Compliance",
            "description": "Indicates whether the asset exposes a standardized IEC 63278 Digital Twin envelope.",
            "element_type": "Equipment",
            "layer": "Physical",
            "data_type": "select",
            "options": ["Yes - Fully Compliant", "Partial - Digital Nameplate Only", "No - Legacy Asset", "Planned"],
            "default_value": "Yes - Fully Compliant",
            "is_required": True,
            "section": "Industrie 4.0 Digital Twin",
            "sort_order": 5
        }
    ]

    # 3. Stereotypes
    stereotypes = [
        {
            "base_type": "Grouping",
            "name": "RAMI Architectural Layer",
            "label": "«RAMI Architectural Layer»",
            "description": "RAMI 4.0 structural architectural layer dimension (Asset to Business).",
            "icon_color": "amber",
            "links": []
        },
        {
            "base_type": "Grouping",
            "name": "Shopfloor Hierarchy Level",
            "label": "«Shopfloor Hierarchy Level»",
            "description": "ISA-95 / RAMI 4.0 hierarchical organizational level.",
            "icon_color": "orange",
            "links": []
        },
        {
            "base_type": "BusinessProcess",
            "name": "Manufacturing Operation",
            "label": "«Manufacturing Operation»",
            "description": "ISA-95 Level 3 MOM operational activity (Production, Quality, Maintenance, Inventory).",
            "icon_color": "yellow",
            "links": []
        },
        {
            "base_type": "ApplicationComponent",
            "name": "Industrial Software Component",
            "label": "«Industrial Software Component»",
            "description": "Manufacturing IT/OT application (ERP, MES, SCADA, CMMS, QMS, IoT Edge Gateway).",
            "icon_color": "sky",
            "links": [
                {"attribute_name": "isa95_level", "is_required": True, "default_value": "Level 3 - Operations & MES/MOM", "section_override": "ISA-95", "sort_order": 1},
                {"attribute_name": "rami_layer", "is_required": True, "default_value": "Functional Layer", "section_override": "RAMI 4.0", "sort_order": 2},
                {"attribute_name": "industrial_protocols", "is_required": False, "section_override": "Connectivity", "sort_order": 3}
            ]
        },
        {
            "base_type": "Equipment",
            "name": "Industrial Physical Asset",
            "label": "«Industrial Physical Asset»",
            "description": "Physical machine, CNC, robot, AGV, instrument, or field equipment.",
            "icon_color": "emerald",
            "links": [
                {"attribute_name": "rami_hierarchy", "is_required": True, "default_value": "Station", "section_override": "Shopfloor Hierarchy", "sort_order": 1},
                {"attribute_name": "aas_ready", "is_required": True, "default_value": "Yes - Fully Compliant", "section_override": "Digital Twin", "sort_order": 2}
            ]
        },
        {
            "base_type": "Facility",
            "name": "Manufacturing Work Center",
            "label": "«Manufacturing Work Center»",
            "description": "Physical production hall, assembly line, cleanroom, or plant site.",
            "icon_color": "teal",
            "links": [
                {"attribute_name": "rami_hierarchy", "is_required": True, "default_value": "Work Center", "section_override": "Shopfloor Hierarchy", "sort_order": 1}
            ]
        },
        {
            "base_type": "DataObject",
            "name": "Asset Administration Shell (AAS)",
            "label": "«Asset Administration Shell (AAS)»",
            "description": "Standardized digital twin metadata and submodel envelope defined in IEC 63278.",
            "icon_color": "indigo",
            "links": []
        }
    ]

    # 4. Elements & Relationships
    elements = []
    relationships = []

    # 4a. RAMI Layers (Grouping)
    for layer in RAMI_LAYERS:
        elements.append({
            "id_alias": f"elem-rami-layer-{layer['code'].lower()}",
            "name": layer["name"],
            "type": "Grouping",
            "layer": "Business",
            "documentation": f"RAMI 4.0 Layer: {layer['description']}",
            "stereotype_name": "RAMI Architectural Layer",
            "properties": {"rami_code": layer["code"]}
        })

    # 4b. Hierarchy Levels (Grouping)
    for hl in HIERARCHY_LEVELS:
        elements.append({
            "id_alias": f"elem-rami-hl-{hl['code'].lower()}",
            "name": f"{hl['isa95_level']} - {hl['name']}",
            "type": "Grouping",
            "layer": "Business",
            "documentation": f"Hierarchy Level: {hl['description']}",
            "stereotype_name": "Shopfloor Hierarchy Level",
            "properties": {"isa95_level": hl["isa95_level"]}
        })

    # 4c. ISA-95 MOM Operations (BusinessProcess)
    for mom in ISA95_MOM_OPERATIONS:
        mom_parent_id = f"elem-isa95-mom-{mom['code'].lower()}"
        elements.append({
            "id_alias": mom_parent_id,
            "name": mom["name"],
            "type": "BusinessProcess",
            "layer": "Business",
            "documentation": f"ISA-95 Level 3 MOM Pillar: {mom['description']}",
            "stereotype_name": "Manufacturing Operation",
            "properties": {"isa95_category": mom["code"]}
        })

        for sub_op in mom["sub_operations"]:
            sub_slug = re.sub(r'[^a-zA-Z0-9]+', '-', sub_op).strip('-').lower()
            sub_id = f"elem-isa95-op-{sub_slug}"
            elements.append({
                "id_alias": sub_id,
                "name": sub_op,
                "type": "BusinessProcess",
                "layer": "Business",
                "documentation": f"Manufacturing operation within {mom['name']}.",
                "stereotype_name": "Manufacturing Operation",
                "properties": {"isa95_category": mom["code"]}
            })

            # Composition
            relationships.append({
                "id_alias": f"rel-comp-{mom['code'].lower()}-{sub_slug}",
                "source_alias": mom["name"],
                "target_alias": sub_op,
                "type": "CompositionRelationship",
                "name": "Includes Operation",
                "documentation": f"{mom['name']} decomposes into {sub_op}."
            })


    # 4d. Industrial Software Components (ApplicationComponent)
    for comp in INDUSTRIAL_SOFTWARE_COMPONENTS:
        elements.append({
            "id_alias": comp["id"],
            "name": comp["name"],
            "type": "ApplicationComponent",
            "layer": "Application",
            "documentation": f"{comp['name']}: {comp['description']}",
            "stereotype_name": "Industrial Software Component",
            "properties": {
                "isa95_level": comp["isa95_level"],
                "rami_layer": comp["rami_layer"],
                "industrial_protocols": ", ".join(comp["protocols"])
            }
        })

    # 4e. Physical Assets & Equipment (Equipment / Facility)
    for asset in PHYSICAL_ASSETS:
        elements.append({
            "id_alias": asset["id"],
            "name": asset["name"],
            "type": asset["type"],
            "layer": "Physical",
            "documentation": f"{asset['name']}: {asset['description']}",
            "stereotype_name": "Industrial Physical Asset" if asset["type"] == "Equipment" else "Manufacturing Work Center",
            "properties": {
                "rami_hierarchy": asset["hierarchy"],
                "isa95_level": asset["isa95_level"],
                "aas_ready": "Yes - Fully Compliant"
            }
        })

    # 4f. Data Entities & AAS (DataObject / BusinessObject)
    for dent in INDUSTRIAL_DATA_ENTITIES:
        dent_slug = re.sub(r'[^a-zA-Z0-9]+', '-', dent['name']).strip('-').lower()
        dent_id = f"elem-rami-data-{dent_slug}"
        elements.append({
            "id_alias": dent_id,
            "name": dent["name"],
            "type": dent["type"],
            "layer": "Application" if dent["type"] == "DataObject" else "Business",
            "documentation": f"{dent['name']} ({dent['level']}): {dent['description']}",
            "stereotype_name": "Asset Administration Shell (AAS)" if "AAS" in dent["name"] else None,
            "properties": {"isa95_level": dent["level"]}
        })

    # 4g. Canonical Realization & OT/IT Serving Relationships
    core_interactions = [
        # Software realizing Manufacturing Operations
        ("Enterprise Resource Planning (ERP)", "Production Operations Management", "RealizationRelationship", "Schedules Master Production Orders"),
        ("Manufacturing Execution System (MES/MOM)", "Production Order Scheduling & Dispatching", "RealizationRelationship", "Dispatches Detailed Shopfloor Orders"),
        ("Manufacturing Execution System (MES/MOM)", "Detailed Routing & Batch Execution", "RealizationRelationship", "Tracks Real-time Step Execution"),
        ("Manufacturing Execution System (MES/MOM)", "Production Performance & OEE Calculation", "RealizationRelationship", "Calculates Real-time OEE"),
        ("Quality Management & LIMS System", "Statistical Process Control (SPC) Monitoring", "RealizationRelationship", "Monitors In-line Quality Gates"),
        ("Computerized Maintenance Management System (CMMS)", "Predictive Vibration & Thermographic Monitoring", "RealizationRelationship", "Analyzes Machine Degradation"),
        # OT / IT Serving & Protocol Connections
        ("5-Axis High Precision CNC Machining Center", "PLC / DCS Real-Time Automation Runtime", "AssignmentRelationship", "Controlled by Industrial Automation Logic"),
        ("Collaborative Robotic Welding Cell", "PLC / DCS Real-Time Automation Runtime", "AssignmentRelationship", "Controlled by Industrial Robot Controller"),
        ("PLC / DCS Real-Time Automation Runtime", "SCADA & Supervisory Control Platform", "ServingRelationship", "Feeds Real-time Sensor Values via PROFINET"),
        ("5-Axis High Precision CNC Machining Center", "Industrial IoT Edge Gateway", "ServingRelationship", "Streams Telemetry via High-Speed Edge Bus"),
        ("Industrial IoT Edge Gateway", "Asset Administration Shell (AAS) Repository", "ServingRelationship", "Pushes AAS Telemetry via MQTT Sparkplug B"),
        ("SCADA & Supervisory Control Platform", "Manufacturing Execution System (MES/MOM)", "ServingRelationship", "Transfers Machine States via OPC-UA"),
        ("Manufacturing Execution System (MES/MOM)", "Enterprise Resource Planning (ERP)", "ServingRelationship", "Reports Finished Goods & Actual Labor via REST B2MML"),
        # Digital Twin Mapping
        ("5-Axis High Precision CNC Machining Center", "Asset Administration Shell (AAS)", "AssociationRelationship", "Represented by Standardized Digital Twin")
    ]

    for src_name, tgt_name, rel_type, rel_doc in core_interactions:
        src_slug = re.sub(r'[^a-zA-Z0-9]+', '-', src_name).strip('-').lower()
        tgt_slug = re.sub(r'[^a-zA-Z0-9]+', '-', tgt_name).strip('-').lower()
        relationships.append({
            "id_alias": f"rel-rami-{src_slug[:20]}-to-{tgt_slug[:20]}",
            "source_alias": src_name,
            "target_alias": tgt_name,
            "type": rel_type,
            "name": rel_doc.split()[0] if rel_type == "AssignmentRelationship" else "Connects",
            "documentation": f"RAMI/ISA-95 Alignment: {rel_doc}."
        })


    print(f"[*] Generated {len(elements)} ArchiMate elements and {len(relationships)} relationships.")

    # 5. Standard Views
    views = [
        {
            "id": "rami_isa95_pyramid_register",
            "name": "ISA-95 Automation Pyramid Register",
            "description": "Shopfloor-to-topfloor inventory of software systems and equipment aligned with ISA-95 levels (L1 Sensing to L4 ERP).",
            "category": "ISA-95 Enterprise Architecture",
            "view_type": "table",
            "icon": "Layers",
            "sort_order": 1,
            "target_hub": "business",
            "target_stereotypes": ["Industrial Software Component", "Industrial Physical Asset"],
            "columns": [
                {"field": "name", "label": "Component / Asset Name", "type": "string", "sortable": True},
                {"field": "isa95_level", "label": "ISA-95 Level", "type": "badge", "filterable": True},
                {"field": "rami_layer", "label": "RAMI Layer", "type": "badge", "filterable": True},
                {"field": "industrial_protocols", "label": "Protocols", "type": "string", "sortable": False},
                {"field": "documentation", "label": "Operational Role", "type": "string", "sortable": False}
            ],
            "default_sort": {"field": "isa95_level", "direction": "asc"}
        },
        {
            "id": "rami_manufacturing_operations_catalog",
            "name": "MOM Manufacturing Operations Register",
            "description": "Catalog of ISA-95 Level 3 operational processes across Production, Quality, Maintenance, and Logistics.",
            "category": "Manufacturing Operations (MOM)",
            "view_type": "table",
            "icon": "Settings",
            "sort_order": 2,
            "target_hub": "business",
            "target_stereotypes": ["Manufacturing Operation"],
            "columns": [
                {"field": "name", "label": "Manufacturing Operation", "type": "string", "sortable": True},
                {"field": "isa95_category", "label": "MOM Pillar", "type": "badge", "filterable": True},
                {"field": "documentation", "label": "Scope & Objectives", "type": "string", "sortable": False}
            ],
            "default_sort": {"field": "name", "direction": "asc"}
        },
        {
            "id": "rami_digital_twin_aas_register",
            "name": "Industrie 4.0 Equipment & Digital Twin Register",
            "description": "Master register of physical machines, CNCs, and robotics with Asset Administration Shell (AAS) compliance.",
            "category": "Industrie 4.0 & Digital Twin",
            "view_type": "table",
            "icon": "Cpu",
            "sort_order": 3,
            "target_hub": "business",
            "target_stereotypes": ["Industrial Physical Asset"],
            "columns": [
                {"field": "name", "label": "Physical Asset Name", "type": "string", "sortable": True},
                {"field": "rami_hierarchy", "label": "Hierarchy Axis", "type": "badge", "filterable": True},
                {"field": "aas_ready", "label": "AAS Digital Twin Status", "type": "badge", "filterable": True},
                {"field": "documentation", "label": "Equipment Specification", "type": "string"}
            ]
        },
        {
            "id": "rami_smart_factory_analytics",
            "name": "Smart Factory OT/IT Architecture Analytics",
            "description": "Executive metrics on ISA-95 pyramid coverage, RAMI 4.0 layers, and digital twin readiness.",
            "category": "Analytics",
            "view_type": "kpi_dashboard",
            "icon": "PieChart",
            "sort_order": 4,
            "target_hub": "business",
            "target_stereotypes": ["Industrial Software Component"],
            "metrics": [
                {"id": "total_systems", "label": "Total Industrial Systems", "type": "count"},
                {"id": "mes_mom_count", "label": "Level 3 MOM/MES Systems", "type": "count", "where": {"isa95_level": "Level 3 - Operations & MES/MOM"}},
                {"id": "control_scada_count", "label": "Level 2 Control & SCADA", "type": "count", "where": {"isa95_level": "Level 2 - Control & SCADA"}}
            ],
            "charts": [
                {
                    "id": "chart_by_isa95",
                    "title": "Systems by ISA-95 Pyramid Level",
                    "type": "pie",
                    "group_by": "isa95_level"
                },
                {
                    "id": "chart_by_rami_layer",
                    "title": "Systems by RAMI 4.0 Layer",
                    "type": "bar",
                    "group_by": "rami_layer"
                }
            ]
        }
    ]

    # 6. README
    readme_content = f"""# {manifest['name']}
Version: {manifest['version']}
Standard: {manifest['standard_version']}
Type: {manifest['package_type']}
License: {manifest['license']}

## Description
{manifest['description']}

## Architectural Metrics
- **RAMI 4.0 Layers**: {len(RAMI_LAYERS)}
- **Hierarchy Levels (ISA-95)**: {len(HIERARCHY_LEVELS)}
- **Manufacturing Operations (MOM)**: {len([e for e in elements if e['stereotype_name'] == 'Manufacturing Operation'])}
- **Industrial Software Components**: {len(INDUSTRIAL_SOFTWARE_COMPONENTS)}
- **Physical Equipment & Facilities**: {len(PHYSICAL_ASSETS)}
- **Digital Twin & AAS Entities**: {len(INDUSTRIAL_DATA_ENTITIES)}
- **Canonical OT/IT Relationships**: {len(relationships)}
- **Preconfigured Architecture Views**: {len(views)}

## Compliance & Standards Alignment
- **RAMI 4.0 (DIN SPEC 91345)**: 3-dimensional architecture model.
- **ISA-95 / IEC 62264**: Enterprise Control System Integration.
- **Asset Administration Shell (AAS / IEC 63278)**: Industry 4.0 Digital Twin metadata.
- Compatible with ArchiMate 3.2 Physical and Application layers.
"""

    # 7. Compile .eap ZIP archive
    print(f"[*] Packaging into {TARGET_EAP_PATH}...")
    os.makedirs(os.path.dirname(TARGET_EAP_PATH), exist_ok=True)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))
        zf.writestr("attributes.json", json.dumps(attributes, indent=2, ensure_ascii=False))
        zf.writestr("stereotypes.json", json.dumps(stereotypes, indent=2, ensure_ascii=False))
        zf.writestr("reference_model/elements.json", json.dumps(elements, indent=2, ensure_ascii=False))
        zf.writestr("reference_model/relationships.json", json.dumps(relationships, indent=2, ensure_ascii=False))
        zf.writestr("views.json", json.dumps(views, indent=2, ensure_ascii=False))
        zf.writestr("README.md", readme_content)

    zip_bytes = buf.getvalue()
    with open(TARGET_EAP_PATH, "wb") as f:
        f.write(zip_bytes)

    file_size_kb = len(zip_bytes) / 1024
    sha256_hash = hashlib.sha256(zip_bytes).hexdigest()
    print(f"[SUCCESS] Generated {TARGET_EAP_PATH}")
    print(f"          Size: {file_size_kb:.1f} KB | SHA-256: {sha256_hash}")

    # 8. Register in Package Repository index.json
    if os.path.exists(INDEX_JSON_PATH):
        with open(INDEX_JSON_PATH, "r", encoding="utf-8") as f:
            index_data = json.load(f)

        existing_pkg = next((p for p in index_data.get("packages", []) if p.get("id") == "pkg-rami-isa95"), None)
        pkg_entry_data = {
            "id": "pkg-rami-isa95",
            "code": "rami",
            "name": manifest["name"],
            "version": manifest["version"],
            "package_type": "framework",
            "category": "Industry Framework",
            "standard_version": manifest["standard_version"],
            "description": manifest["description"],
            "author": manifest["author"],
            "license": manifest["license"],
            "website_url": manifest["website_url"],
            "icon_color": manifest["icon_color"],
            "min_easyea_version": "1.0.0",
            "release_date": "2026-10-31",
            "bundle_url": "rami-isa95-1.0.0.eap",
            "size_kb": round(file_size_kb, 1),
            "checksum_sha256": sha256_hash,
            "elements_count": len(elements),
            "relationships_count": len(relationships),
            "views_count": len(views),
            "release_notes": "First release of RAMI 4.0 & ISA-95 reference framework: 3D coordinates, MOM operations, OT/IT integration, Asset Administration Shell (AAS) Digital Twin, and Smart Factory views."
        }

        if existing_pkg:
            existing_pkg.update(pkg_entry_data)
        else:
            index_data["packages"].append(pkg_entry_data)

        with open(INDEX_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(index_data, f, indent=2, ensure_ascii=False)
        print(f"[SUCCESS] Updated {INDEX_JSON_PATH}")

if __name__ == "__main__":
    build_rami_package()
