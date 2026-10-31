#!/usr/bin/env python3
"""
SGAM & IEC CIM Smart Grid Framework Package Builder for EasyEA
Compiles the complete Smart Grid Architecture Model and Common Information Model
into a downloadable .eap bundle and updates index.json.
"""

import os
import io
import json
import zipfile
import hashlib
import re
from typing import Dict, List, Any

from sgam_taxonomy import (
    SGAM_DOMAINS,
    SGAM_ZONES,
    GRID_CAPABILITIES,
    UTILITY_CORE_SYSTEMS,
    CIM_ENTITIES
)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TARGET_EAP_PATH = os.path.join(REPO_ROOT, "backend", "app", "packages_repository", "sgam-cim-1.0.0.eap")
INDEX_JSON_PATH = os.path.join(REPO_ROOT, "backend", "app", "packages_repository", "index.json")

def slugify(text: str) -> str:
    return re.sub(r'[^a-zA-Z0-9]+', '-', text).strip('-').lower()

def build_sgam_package():
    print("=" * 70)
    print("EasyEA SGAM & IEC CIM Smart Grid Framework Package Builder")
    print("=" * 70)

    # 1. Manifest
    manifest = {
        "$schema": "https://easyea.org/schemas/package-manifest-v1.json",
        "id": "pkg-sgam-cim",
        "code": "sgam",
        "name": "SGAM & IEC CIM Smart Grid Standard",
        "version": "1.0.0",
        "package_type": "framework",
        "standard_version": "v3.0 / IEC 61970/61968",
        "description": "Smart Grid Architecture Model (SGAM / CEN-CENELEC-ETSI) & Common Information Model (IEC CIM) - Canonical reference architecture for Power Utilities, Transmission (TSO), Distribution (DSO), Substation Automation (IEC 61850), Smart Metering (AMI), and DER Flexibility.",
        "author": "CEN-CENELEC-ETSI & IEC TC57",
        "license": "Open Standard / Community Reference",
        "website_url": "https://www.iec.ch",
        "icon_color": "amber",
        "is_default_active": False
    }

    # 2. Attributes
    attributes = [
        {
            "name": "sgam_domain",
            "label": "SGAM Electrical Domain",
            "description": "Physical electrical energy domain in the smart grid plane.",
            "element_type": "BusinessFunction",
            "layer": "Business",
            "data_type": "select",
            "options": ["Bulk Generation", "Transmission (TSO)", "Distribution (DSO)", "Distributed Energy Resources (DER)", "Customer Premises"],
            "default_value": "Distribution (DSO)",
            "is_required": True,
            "section": "SGAM Plane Coordinates",
            "sort_order": 1
        },
        {
            "name": "sgam_zone",
            "label": "SGAM Management Zone",
            "description": "Hierarchical spatial management zone from Process to Market.",
            "element_type": "BusinessFunction",
            "layer": "Business",
            "data_type": "select",
            "options": ["Process Zone", "Field Zone", "Station Zone", "Operation Zone", "Enterprise Zone", "Market Zone"],
            "default_value": "Operation Zone",
            "is_required": True,
            "section": "SGAM Plane Coordinates",
            "sort_order": 2
        },
        {
            "name": "cim_standard",
            "label": "IEC CIM Standard Package",
            "description": "Reference IEC Common Information Model standard specification.",
            "element_type": "DataObject",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "IEC 61970 Wires",
            "is_required": False,
            "section": "CIM Data Architecture",
            "sort_order": 3
        },
        {
            "name": "utility_protocols",
            "label": "Supported Utility & SCADA Protocols",
            "description": "Communication protocols (IEC 61850, IEC 60870-5-104, DNP3, DLMS/COSEM, OpenADR).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "IEC 60870-5-104",
            "is_required": False,
            "section": "OT/IT Protocol Interfaces",
            "sort_order": 4
        }
    ]

    # 3. Stereotypes
    stereotypes = [
        {
            "base_type": "Grouping",
            "name": "SGAM Electrical Domain",
            "label": "«SGAM Electrical Domain»",
            "description": "Physical electrical energy generation, transmission, or distribution sector.",
            "icon_color": "amber",
            "links": []
        },
        {
            "base_type": "Grouping",
            "name": "SGAM Management Zone",
            "label": "«SGAM Management Zone»",
            "description": "Hierarchical spatial management zone in the SGAM architecture plane.",
            "icon_color": "orange",
            "links": []
        },
        {
            "base_type": "BusinessFunction",
            "name": "Smart Grid Operation",
            "label": "«Smart Grid Operation»",
            "description": "Operational power grid function (FLISR, Volt/VAR, State Estimation, Meter Reading).",
            "icon_color": "yellow",
            "links": [
                {"attribute_name": "sgam_domain", "is_required": True, "default_value": "Distribution (DSO)", "section_override": "SGAM Coordinates", "sort_order": 1},
                {"attribute_name": "sgam_zone", "is_required": True, "default_value": "Operation Zone", "section_override": "SGAM Coordinates", "sort_order": 2}
            ]
        },
        {
            "base_type": "ApplicationComponent",
            "name": "Utility Software System",
            "label": "«Utility Software System»",
            "description": "Power utility enterprise software system (EMS, ADMS, OMS, GIS, MDMS, DERMS).",
            "icon_color": "sky",
            "links": [
                {"attribute_name": "utility_protocols", "is_required": False, "section_override": "Telemetry & Protocols", "sort_order": 1}
            ]
        },
        {
            "base_type": "DataObject",
            "name": "CIM Information Entity",
            "label": "«CIM Information Entity»",
            "description": "Canonical power system data object from the IEC Common Information Model (IEC 61970/61968).",
            "icon_color": "emerald",
            "links": [
                {"attribute_name": "cim_standard", "is_required": False, "section_override": "CIM Standards", "sort_order": 1}
            ]
        }
    ]

    # 4. Elements & Relationships
    elements = []
    relationships = []

    # 4a. Electrical Domains (Grouping)
    for dom in SGAM_DOMAINS:
        elements.append({
            "id_alias": f"elem-sgam-dom-{slugify(dom['code'])}",
            "name": dom["name"],
            "type": "Grouping",
            "layer": "Business",
            "documentation": f"SGAM Domain: {dom['description']}",
            "stereotype_name": "SGAM Electrical Domain",
            "properties": {"sgam_code": dom["code"]}
        })

    # 4b. Management Zones (Grouping)
    for zone in SGAM_ZONES:
        elements.append({
            "id_alias": f"elem-sgam-zone-{slugify(zone['code'])}",
            "name": zone["name"],
            "type": "Grouping",
            "layer": "Business",
            "documentation": f"SGAM Zone: {zone['description']}",
            "stereotype_name": "SGAM Management Zone",
            "properties": {"sgam_code": zone["code"]}
        })

    # 4c. Grid Capabilities (BusinessFunction)
    for cap in GRID_CAPABILITIES:
        elements.append({
            "id_alias": cap["id"],
            "name": cap["name"],
            "type": "BusinessFunction",
            "layer": "Business",
            "documentation": f"{cap['name']}: {cap['description']}",
            "stereotype_name": "Smart Grid Operation",
            "properties": {
                "sgam_domain": cap["domain"],
                "sgam_zone": cap["zone"]
            }
        })

        # Domain aggregates capability
        relationships.append({
            "id_alias": f"rel-agg-dom-{slugify(cap['domain'][:10])}-{slugify(cap['id'][:15])}",
            "source_alias": cap["domain"],
            "target_alias": cap["name"],
            "type": "AggregationRelationship",
            "name": "Operates In Domain",
            "documentation": f"{cap['domain']} encompasses {cap['name']}."
        })

    # 4d. Utility Software Systems (ApplicationComponent)
    for sys in UTILITY_CORE_SYSTEMS:
        elements.append({
            "id_alias": sys["id"],
            "name": sys["name"],
            "type": "ApplicationComponent",
            "layer": "Application",
            "documentation": f"{sys['name']}: {sys['description']}",
            "stereotype_name": "Utility Software System",
            "properties": {
                "sgam_zone": sys["zone"],
                "utility_protocols": ", ".join(sys["protocols"])
            }
        })

    # 4e. CIM Information Entities (DataObject)
    for cim in CIM_ENTITIES:
        cim_id = f"elem-cim-{slugify(cim['name'])}"
        elements.append({
            "id_alias": cim_id,
            "name": cim["name"],
            "type": "DataObject",
            "layer": "Application",
            "documentation": f"{cim['name']} ({cim['cim_package']}): {cim['description']}",
            "stereotype_name": "CIM Information Entity",
            "properties": {"cim_standard": cim["cim_package"]}
        })

    # 4f. Canonical Realization & OT/IT Control Relationships
    core_interactions = [
        # System Realizations
        ("Advanced Distribution Management System (ADMS)", "Fault Location, Isolation & Service Restoration (FLISR)", "RealizationRelationship", "Executes Self-Healing Automated Switching"),
        ("Advanced Distribution Management System (ADMS)", "Volt/VAR Optimization & Reactive Power Control (VVO)", "RealizationRelationship", "Optimizes Distribution Feeder Reactive Power"),
        ("Energy Management System (EMS / SCADA)", "State Estimation & Network Topology Analysis", "RealizationRelationship", "Computes N-1 Real-Time Transmission State"),
        ("Meter Data Management System (MDMS)", "Advanced Metering Infrastructure (AMI) & Reading", "RealizationRelationship", "Collects Smart Meter Load Curves"),
        ("Outage Management System (OMS)", "Work & Outage Management (OMS)", "RealizationRelationship", "Orchestrates Outage Trouble Calls & Crews"),
        ("Distributed Energy Resource Management (DERMS / VPP)", "Distributed Flexibility & Demand Response Dispatch", "RealizationRelationship", "Dispatches Aggregated Battery/Solar Fleets"),
        # OT/IT Serving & Communication
        ("Geographic Information System (GIS Network Model)", "Advanced Distribution Management System (ADMS)", "ServingRelationship", "Feeds As-Built Electrical Network Topology via CIM/XML"),
        ("Advanced Distribution Management System (ADMS)", "Outage Management System (OMS)", "ServingRelationship", "Shares Real-Time Feeder Trip Events via CIM/IEC 61968-3"),
        ("Meter Data Management System (MDMS)", "Outage Management System (OMS)", "ServingRelationship", "Pushes Smart Meter Last-Gasp Outage Alarms"),
        ("Distributed Energy Resource Management (DERMS / VPP)", "Electricity Market Settlement & Bidding Platform", "ServingRelationship", "Submits Flexibility Bids to Power Exchange via CIM Market"),
        # Data Object Management
        ("Advanced Distribution Management System (ADMS)", "Substation (CIM)", "AccessRelationship", "Maintains Real-Time Substation Status"),
        ("Meter Data Management System (MDMS)", "Meter Reading (CIM)", "AccessRelationship", "Validates and Stores Billing Interval Readings")
    ]

    for src_name, tgt_name, rel_type, rel_doc in core_interactions:
        src_slug = slugify(src_name)
        tgt_slug = slugify(tgt_name)
        relationships.append({
            "id_alias": f"rel-sgam-{src_slug[:20]}-to-{tgt_slug[:20]}",
            "source_alias": src_name,
            "target_alias": tgt_name,
            "type": rel_type,
            "name": rel_doc.split()[0] if rel_type == "RealizationRelationship" else "Connects",
            "documentation": f"SGAM/CIM Alignment: {rel_doc}."
        })

    print(f"[*] Generated {len(elements)} ArchiMate elements and {len(relationships)} relationships.")

    # 5. Standard Views
    views = [
        {
            "id": "sgam_grid_architecture_matrix",
            "name": "SGAM Smart Grid Architecture Matrix",
            "description": "Grid matrix positioning operational capabilities and systems across Electrical Domains (Generation to Customer) and Zones (Process to Market).",
            "category": "SGAM Architecture Plane",
            "view_type": "table",
            "icon": "Grid",
            "sort_order": 1,
            "target_hub": "business",
            "target_stereotypes": ["Smart Grid Operation"],
            "columns": [
                {"field": "name", "label": "Grid Operation Name", "type": "string", "sortable": True},
                {"field": "sgam_domain", "label": "Electrical Domain", "type": "badge", "filterable": True},
                {"field": "sgam_zone", "label": "Management Zone", "type": "badge", "filterable": True},
                {"field": "documentation", "label": "Operational Functionality", "type": "string", "sortable": False}
            ],
            "default_sort": {"field": "sgam_domain", "direction": "asc"}
        },
        {
            "id": "sgam_utility_systems_portfolio",
            "name": "Power Utility OT/IT Systems Portfolio",
            "description": "Application portfolio of core power grid platforms (EMS, ADMS, OMS, GIS, MDMS, DERMS) and supported SCADA protocols.",
            "category": "Utility IT/OT Landscape",
            "view_type": "table",
            "icon": "Cpu",
            "sort_order": 2,
            "target_hub": "business",
            "target_stereotypes": ["Utility Software System"],
            "columns": [
                {"field": "name", "label": "System Name", "type": "string", "sortable": True},
                {"field": "sgam_zone", "label": "Operating Zone", "type": "badge", "filterable": True},
                {"field": "utility_protocols", "label": "Supported Protocols", "type": "string", "sortable": False},
                {"field": "documentation", "label": "System Responsibility", "type": "string", "sortable": False}
            ],
            "default_sort": {"field": "name", "direction": "asc"}
        },
        {
            "id": "sgam_flisr_self_healing_flow",
            "name": "Distribution Self-Healing & Outage Flow (FLISR)",
            "description": "Operational register focused on Distribution Automation, fault detection, restoration, and outage management.",
            "category": "Distribution Automation",
            "view_type": "table",
            "icon": "Zap",
            "sort_order": 3,
            "target_hub": "business",
            "target_stereotypes": ["Smart Grid Operation"],
            "filter_config": {
                "sgam_domain": "Distribution (DSO)"
            },
            "columns": [
                {"field": "name", "label": "Operation Name", "type": "string", "sortable": True},
                {"field": "sgam_zone", "label": "Zone", "type": "badge", "filterable": True},
                {"field": "documentation", "label": "Automation Role", "type": "string"}
            ]
        },
        {
            "id": "sgam_smart_grid_analytics",
            "name": "Smart Grid Architecture Analytics",
            "description": "Executive metrics on capability coverage across Electrical Domains and Management Zones.",
            "category": "Analytics",
            "view_type": "kpi_dashboard",
            "icon": "PieChart",
            "sort_order": 4,
            "target_hub": "business",
            "target_stereotypes": ["Smart Grid Operation"],
            "metrics": [
                {"id": "total_operations", "label": "Total Grid Operations", "type": "count"},
                {"id": "dso_count", "label": "Distribution Operations", "type": "count", "where": {"sgam_domain": "Distribution (DSO)"}},
                {"id": "tso_count", "label": "Transmission Operations", "type": "count", "where": {"sgam_domain": "Transmission (TSO)"}}
            ],
            "charts": [
                {
                    "id": "chart_by_domain",
                    "title": "Operations by Electrical Domain",
                    "type": "pie",
                    "group_by": "sgam_domain"
                },
                {
                    "id": "chart_by_zone",
                    "title": "Operations by Management Zone",
                    "type": "bar",
                    "group_by": "sgam_zone"
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
- **SGAM Electrical Domains**: {len(SGAM_DOMAINS)}
- **SGAM Management Zones**: {len(SGAM_ZONES)}
- **Smart Grid Operations**: {len(GRID_CAPABILITIES)}
- **Utility OT/IT Core Systems**: {len(UTILITY_CORE_SYSTEMS)}
- **CIM Canonical Data Entities**: {len(CIM_ENTITIES)}
- **Canonical Architecture Relationships**: {len(relationships)}
- **Preconfigured Business Views**: {len(views)}

## Compliance & Standards Alignment
- **SGAM (CEN-CENELEC-ETSI M/490)**: Smart Grid Architecture Model.
- **IEC 61970 & IEC 61968**: Common Information Model (CIM) for Transmission and Distribution.
- **Substation Automation**: IEC 61850, IEC 60870-5-104 telecontrol protocols.
- Fully compatible with ArchiMate 3.2 Business, Application, and Technology layers.
"""

    # 7. Compile .eap ZIP archive
    print(f"[*] Compiling bundle into {TARGET_EAP_PATH}...")
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

        existing_pkg = next((p for p in index_data.get("packages", []) if p.get("id") == "pkg-sgam-cim"), None)
        pkg_entry_data = {
            "id": "pkg-sgam-cim",
            "code": "sgam",
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
            "bundle_url": "sgam-cim-1.0.0.eap",
            "size_kb": round(file_size_kb, 1),
            "checksum_sha256": sha256_hash,
            "elements_count": len(elements),
            "relationships_count": len(relationships),
            "views_count": len(views),
            "release_notes": "First release of SGAM & IEC CIM Smart Grid framework: 3D coordinates (Domains & Zones), Substation Automation (IEC 61850), ADMS/EMS systems, FLISR self-healing, and CIM data model."
        }

        if existing_pkg:
            existing_pkg.update(pkg_entry_data)
        else:
            index_data["packages"].append(pkg_entry_data)

        with open(INDEX_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(index_data, f, indent=2, ensure_ascii=False)
        print(f"[SUCCESS] Updated {INDEX_JSON_PATH}")

if __name__ == "__main__":
    build_sgam_package()
