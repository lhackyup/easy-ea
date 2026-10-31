#!/usr/bin/env python3
"""
TM Forum ODA & eTOM v23.5 Package Builder for EasyEA
Compiles the complete TM Forum Open Digital Architecture and Business Process Framework
into a downloadable .eap bundle and updates the external package registry.
"""

import os
import io
import json
import zipfile
import hashlib
from typing import Dict, List, Any

from tmforum_taxonomy import (
    ETOM_PROCESS_AREAS,
    ODA_COMPONENTS,
    SID_INFORMATION_ENTITIES
)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TARGET_EAP_PATH = os.path.join(REPO_ROOT, "backend", "app", "packages_repository", "tmforum-oda-1.0.0.eap")
INDEX_JSON_PATH = os.path.join(REPO_ROOT, "backend", "app", "packages_repository", "index.json")

def build_tmforum_package():
    print("=" * 70)
    print("EasyEA TM Forum ODA & eTOM v23.5 Package Builder")
    print("=" * 70)

    # 1. Manifest
    manifest = {
        "$schema": "https://easyea.org/schemas/package-manifest-v1.json",
        "id": "pkg-tmforum-oda",
        "code": "tmforum",
        "name": "TM Forum ODA & eTOM Telecom Standard",
        "version": "1.0.0",
        "package_type": "framework",
        "standard_version": "v23.5",
        "description": "TM Forum Open Digital Architecture (ODA) & Business Process Framework (eTOM GB921 v23.5) - Standard canonical reference architecture for Telecommunications, 5G networks, cloud-native OSS/BSS, and Digital Service Providers.",
        "author": "TM Forum Open Architecture Program",
        "license": "Apache-2.0 / TM Forum Open Standard",
        "website_url": "https://www.tmforum.org/oda/",
        "icon_color": "violet",
        "is_default_active": False
    }

    # 2. Package Custom Attributes
    attributes = [
        {
            "name": "etom_id",
            "label": "eTOM Process ID",
            "description": "Canonical eTOM hierarchical code (e.g. 1.4.1.2).",
            "element_type": "BusinessProcess",
            "layer": "Business",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": False,
            "section": "eTOM Metadata",
            "sort_order": 1
        },
        {
            "name": "etom_level",
            "label": "eTOM Hierarchy Level",
            "description": "Hierarchy depth in the Business Process Framework.",
            "element_type": "BusinessProcess",
            "layer": "Business",
            "data_type": "select",
            "options": ["L1", "L2", "L3"],
            "default_value": "L2",
            "is_required": True,
            "section": "eTOM Metadata",
            "sort_order": 2
        },
        {
            "name": "etom_stream",
            "label": "eTOM Core Stream",
            "description": "Operational value stream (Fulfillment, Assurance, Billing, Strategy, Enterprise).",
            "element_type": "BusinessProcess",
            "layer": "Business",
            "data_type": "select",
            "options": ["Fulfillment", "Assurance", "Billing", "Strategy", "Enterprise", "Operations"],
            "default_value": "Fulfillment",
            "is_required": True,
            "section": "eTOM Metadata",
            "sort_order": 3
        },
        {
            "name": "oda_block",
            "label": "ODA Functional Block",
            "description": "Open Digital Architecture decoupled functional domain.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Party Management", "Core Commerce Management", "Production", "Engagement", "Intelligence"],
            "default_value": "Production",
            "is_required": True,
            "section": "ODA Metadata",
            "sort_order": 4
        },
        {
            "name": "oda_apis",
            "label": "Supported TM Forum Open APIs",
            "description": "Standard REST Open APIs exposed by this component (e.g. TMF620, TMF622, TMF641).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": False,
            "section": "ODA Metadata",
            "sort_order": 5
        },
        {
            "name": "sid_aggregate",
            "label": "SID Information Aggregate",
            "description": "Information Framework (SID) conceptual domain aggregate.",
            "element_type": "BusinessObject",
            "layer": "Business",
            "data_type": "select",
            "options": ["Party", "Product", "Service", "Resource", "Billing", "Common"],
            "default_value": "Common",
            "is_required": True,
            "section": "SID Metadata",
            "sort_order": 6
        }
    ]

    # 3. Stereotypes
    stereotypes = [
        {
            "base_type": "Grouping",
            "name": "eTOM Process Area",
            "label": "«eTOM Process Area»",
            "description": "Top-level process domain in the eTOM Business Process Framework.",
            "icon_color": "purple",
            "links": []
        },
        {
            "base_type": "BusinessProcess",
            "name": "eTOM Process",
            "label": "«eTOM Process»",
            "description": "Standard telecommunications business process defined in eTOM GB921.",
            "icon_color": "violet",
            "links": [
                {"attribute_name": "etom_id", "is_required": False, "section_override": "eTOM Process", "sort_order": 1},
                {"attribute_name": "etom_level", "is_required": True, "default_value": "L2", "section_override": "eTOM Process", "sort_order": 2},
                {"attribute_name": "etom_stream", "is_required": True, "default_value": "Fulfillment", "section_override": "eTOM Process", "sort_order": 3}
            ]
        },
        {
            "base_type": "ApplicationComponent",
            "name": "ODA Component",
            "label": "«ODA Component»",
            "description": "Cloud-native, decoupled software building block defined in TM Forum ODA.",
            "icon_color": "indigo",
            "links": [
                {"attribute_name": "oda_block", "is_required": True, "default_value": "Production", "section_override": "ODA Specification", "sort_order": 1},
                {"attribute_name": "oda_apis", "is_required": False, "section_override": "ODA Specification", "sort_order": 2}
            ]
        },
        {
            "base_type": "BusinessObject",
            "name": "SID Information Entity",
            "label": "«SID Information Entity»",
            "description": "Canonical business entity from the TM Forum Shared Information / Data (SID) model.",
            "icon_color": "cyan",
            "links": [
                {"attribute_name": "sid_aggregate", "is_required": True, "default_value": "Common", "section_override": "SID Model", "sort_order": 1}
            ]
        }
    ]

    # 4. Reference Elements & Relationships
    elements = []
    relationships = []

    # 4a. eTOM Process Areas & Hierarchies
    for area in ETOM_PROCESS_AREAS:
        area_id = f"elem-tmf-area-{area['code'].lower()}"
        elements.append({
            "id_alias": area_id,
            "name": area["name"],
            "type": "Grouping",
            "layer": "Business",
            "documentation": f"TM Forum eTOM Area: {area['description']}",
            "stereotype_name": "eTOM Process Area",
            "properties": {
                "tmforum_stream": area["stream"]
            }
        })

        for p_l1 in area["processes_l1"]:
            l1_id = f"elem-tmf-proc-{p_l1['id'].replace('.', '-')}"
            elements.append({
                "id_alias": l1_id,
                "name": f"{p_l1['id']} {p_l1['name']}",
                "type": "BusinessProcess",
                "layer": "Business",
                "documentation": f"eTOM Level 1 Process: {p_l1['description']}",
                "stereotype_name": "eTOM Process",
                "properties": {
                    "tmforum_etom_id": p_l1["id"],
                    "tmforum_etom_level": "L1",
                    "tmforum_etom_stream": area["stream"]
                }
            })

            # Area aggregates L1 Process
            relationships.append({
                "id_alias": f"rel-agg-{area['code'].lower()}-{p_l1['id'].replace('.', '-')}",
                "source_alias": area["name"],
                "target_alias": f"{p_l1['id']} {p_l1['name']}",
                "type": "AggregationRelationship",
                "name": "Contains Process",
                "documentation": f"{area['name']} includes {p_l1['name']}."
            })

            for p_l2 in p_l1.get("processes_l2", []):
                l2_id = f"elem-tmf-proc-{p_l2['id'].replace('.', '-')}"
                l2_full_name = f"{p_l2['id']} {p_l2['name']}"
                elements.append({
                    "id_alias": l2_id,
                    "name": l2_full_name,
                    "type": "BusinessProcess",
                    "layer": "Business",
                    "documentation": f"eTOM Level 2 Process in {p_l1['name']} ({p_l2['stream']} stream).",
                    "stereotype_name": "eTOM Process",
                    "properties": {
                        "tmforum_etom_id": p_l2["id"],
                        "tmforum_etom_level": "L2",
                        "tmforum_etom_stream": p_l2["stream"]
                    }
                })

                # L1 aggregates L2 Process
                relationships.append({
                    "id_alias": f"rel-agg-l1-l2-{p_l2['id'].replace('.', '-')}",
                    "source_alias": f"{p_l1['id']} {p_l1['name']}",
                    "target_alias": l2_full_name,
                    "type": "CompositionRelationship",
                    "name": "Decomposes To",
                    "documentation": f"{p_l1['name']} decomposes into sub-process {p_l2['name']}."
                })

    # 4b. ODA Components
    for comp in ODA_COMPONENTS:
        elements.append({
            "id_alias": comp["id"],
            "name": comp["name"],
            "type": "ApplicationComponent",
            "layer": "Application",
            "documentation": f"ODA Functional Component ({comp['block']}): {comp['description']}",
            "stereotype_name": "ODA Component",
            "properties": {
                "tmforum_oda_block": comp["block"],
                "tmforum_oda_apis": ", ".join(comp["apis"])
            }
        })

    # 4c. SID Information Entities
    for sid in SID_INFORMATION_ENTITIES:
        sid_id = f"elem-tmf-sid-{sid['name'].replace(' ', '-').lower()}"
        elements.append({
            "id_alias": sid_id,
            "name": sid["name"],
            "type": "BusinessObject",
            "layer": "Business",
            "documentation": f"TM Forum SID Canonical Entity ({sid['aggregate']}): {sid['description']}",
            "stereotype_name": "SID Information Entity",
            "properties": {
                "tmforum_sid_aggregate": sid["aggregate"]
            }
        })

    # 4d. Canonical End-to-End Interactions & Component Realizations
    core_interactions = [
        # ODA Components realizing eTOM Processes
        ("Product Order Capture & Orchestration Component", "1.4.1.2 Order Handling", "RealizationRelationship", "Automates Customer Order Decomposition"),
        ("Service Order Orchestration Component", "1.4.2.1 Service Configuration & Activation", "RealizationRelationship", "Orchestrates Multi-domain Service Activation"),
        ("Resource Provisioning & Inventory Component", "1.4.3.1 Resource Provisioning & Allocation", "RealizationRelationship", "Allocates Physical and Virtual Telecom Resources"),
        ("Customer Billing & Invoicing Component", "1.4.2.5 Service Usage Rating & Charging", "RealizationRelationship", "Charges and Invoices Customer Usage"),
        ("Service Problem & Incident Management Component", "1.4.2.4 Service Problem Management", "RealizationRelationship", "Manages Service Tickets and SLA Impacts"),
        ("Network Alarm & Fault Management Component", "1.4.3.2 Resource Trouble Management & Alarms", "RealizationRelationship", "Correlates Network Alarms & Root Causes"),
        ("Product Catalog Management Component", "1.3.2 Commercial Product Offering Design", "RealizationRelationship", "Publishes Commercial Tariffs"),
        # End-to-End Operational Flow (Order-to-Cash)
        ("1.4.1.1 Customer Interface Management", "1.4.1.2 Order Handling", "TriggeringRelationship", "Submits Validated Customer Order"),
        ("1.4.1.2 Order Handling", "1.4.2.2 Service Order Orchestration", "TriggeringRelationship", "Dispatches Technical Service Orders"),
        ("1.4.2.2 Service Order Orchestration", "1.4.2.1 Service Configuration & Activation", "TriggeringRelationship", "Activates Customer Facing Service"),
        ("1.4.2.1 Service Configuration & Activation", "1.4.3.1 Resource Provisioning & Allocation", "TriggeringRelationship", "Configures Network Resources"),
        ("1.4.2.1 Service Configuration & Activation", "1.4.2.5 Service Usage Rating & Charging", "FlowRelationship", "Signals Activated Service to Billing Engine"),
        # Assurance Flow
        ("1.4.3.2 Resource Trouble Management & Alarms", "1.4.2.4 Service Problem Management", "TriggeringRelationship", "Correlates Alarms into Service Impact"),
        ("1.4.2.4 Service Problem Management", "1.4.1.3 Problem Handling & Tickets", "TriggeringRelationship", "Generates Customer Notification Ticket")
    ]

    for src_name, tgt_name, rel_type, rel_doc in core_interactions:
        relationships.append({
            "id_alias": f"rel-tmf-{src_name.split()[0].lower()}-to-{tgt_name.split()[0].lower()}",
            "source_alias": src_name,
            "target_alias": tgt_name,
            "type": rel_type,
            "name": rel_doc.split()[0] if rel_type == "TriggeringRelationship" else "Implements",
            "documentation": f"TM Forum Canonical Alignment: {rel_doc}."
        })

    print(f"[*] Generated {len(elements)} ArchiMate elements and {len(relationships)} relationships.")

    # 5. Standard Views
    views = [
        {
            "id": "tmforum_etom_processes_catalog",
            "name": "eTOM Business Process Register",
            "description": "Comprehensive catalog of eTOM Level 1 and Level 2 processes categorized by Area and Stream.",
            "category": "eTOM Business Process Framework",
            "view_type": "table",
            "icon": "Workflow",
            "sort_order": 1,
            "target_hub": "business",
            "target_stereotypes": ["eTOM Process"],
            "columns": [
                {"field": "tmforum_etom_id", "label": "eTOM ID", "type": "badge", "sortable": True},
                {"field": "name", "label": "Process Name", "type": "string", "sortable": True},
                {"field": "tmforum_etom_level", "label": "Level", "type": "badge", "filterable": True},
                {"field": "tmforum_etom_stream", "label": "Stream", "type": "badge", "filterable": True},
                {"field": "documentation", "label": "Operational Scope", "type": "string", "sortable": False}
            ],
            "default_sort": {"field": "tmforum_etom_id", "direction": "asc"}
        },
        {
            "id": "tmforum_oda_components_catalog",
            "name": "ODA Components & Open APIs Portfolio",
            "description": "Inventory of cloud-native ODA components mapped to functional blocks and supported REST Open APIs.",
            "category": "Open Digital Architecture",
            "view_type": "table",
            "icon": "Cpu",
            "sort_order": 2,
            "target_hub": "business",
            "target_stereotypes": ["ODA Component"],
            "columns": [
                {"field": "name", "label": "Component Name", "type": "string", "sortable": True},
                {"field": "tmforum_oda_block", "label": "ODA Block", "type": "badge", "filterable": True},
                {"field": "tmforum_oda_apis", "label": "Supported Open APIs", "type": "string", "sortable": False},
                {"field": "documentation", "label": "Component Responsibility", "type": "string", "sortable": False}
            ],
            "default_sort": {"field": "name", "direction": "asc"}
        },
        {
            "id": "tmforum_order_to_cash_flow",
            "name": "Telco Order-to-Cash & Fulfillment Register",
            "description": "Operational register filtered on eTOM Fulfillment and Billing processes for telecom delivery.",
            "category": "Core Operations",
            "view_type": "table",
            "icon": "Zap",
            "sort_order": 3,
            "target_hub": "business",
            "target_stereotypes": ["eTOM Process"],
            "filter_config": {
                "tmforum_etom_stream": ["Fulfillment", "Billing"]
            },
            "columns": [
                {"field": "tmforum_etom_id", "label": "eTOM ID", "type": "badge", "sortable": True},
                {"field": "name", "label": "Process Name", "type": "string", "sortable": True},
                {"field": "tmforum_etom_stream", "label": "Stream", "type": "badge", "filterable": True},
                {"field": "documentation", "label": "Process Scope", "type": "string"}
            ]
        },
        {
            "id": "tmforum_architecture_analytics",
            "name": "TM Forum Architecture Analytics",
            "description": "Executive metrics on process stream coverage and ODA component distribution.",
            "category": "Analytics",
            "view_type": "kpi_dashboard",
            "icon": "PieChart",
            "sort_order": 4,
            "target_hub": "business",
            "target_stereotypes": ["eTOM Process"],
            "metrics": [
                {"id": "total_processes", "label": "Total eTOM Processes", "type": "count"},
                {"id": "fulfillment_count", "label": "Fulfillment Processes", "type": "count", "where": {"tmforum_etom_stream": "Fulfillment"}},
                {"id": "assurance_count", "label": "Assurance Processes", "type": "count", "where": {"tmforum_etom_stream": "Assurance"}},
                {"id": "billing_count", "label": "Billing Processes", "type": "count", "where": {"tmforum_etom_stream": "Billing"}}
            ],
            "charts": [
                {
                    "id": "chart_by_stream",
                    "title": "Processes by Operational Stream",
                    "type": "pie",
                    "group_by": "tmforum_etom_stream"
                },
                {
                    "id": "chart_by_level",
                    "title": "Processes by Hierarchy Level",
                    "type": "bar",
                    "group_by": "tmforum_etom_level"
                }
            ]
        }
    ]

    # 6. Package README
    readme_content = f"""# {manifest['name']}
Version: {manifest['version']}
Standard: {manifest['standard_version']}
Type: {manifest['package_type']}
License: {manifest['license']}

## Description
{manifest['description']}

## Architectural Metrics
- **eTOM Process Areas (L0)**: {len(ETOM_PROCESS_AREAS)}
- **Canonical eTOM Processes**: {len([el for el in elements if el['type'] == 'BusinessProcess'])}
- **ODA Decoupled Components**: {len(ODA_COMPONENTS)}
- **SID Information Entities**: {len(SID_INFORMATION_ENTITIES)}
- **Canonical Architecture Relationships**: {len(relationships)}
- **Preconfigured Business Views**: {len(views)}

## Compliance & Standards Alignment
- **eTOM (GB921 v23.5)**: Operations (Fulfillment, Assurance, Billing), Strategy, Enterprise.
- **ODA (Open Digital Architecture)**: Core Commerce, Production, Party, Engagement, Intelligence.
- **Open APIs**: Direct mapping to TMF620, TMF622, TMF632, TMF641, TMF652, TMF678.
- Compatible with ArchiMate 3.2 and TOGAF Digital Standards.
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

        existing_pkg = next((p for p in index_data.get("packages", []) if p.get("id") == "pkg-tmforum-oda"), None)
        pkg_entry_data = {
            "id": "pkg-tmforum-oda",
            "code": "tmforum",
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
            "bundle_url": "tmforum-oda-1.0.0.eap",
            "size_kb": round(file_size_kb, 1),
            "checksum_sha256": sha256_hash,
            "elements_count": len(elements),
            "relationships_count": len(relationships),
            "views_count": len(views),
            "release_notes": "First release of TM Forum ODA & eTOM v23.5 reference package: eTOM Operations/SIP/Enterprise processes, ODA components, TMF Open APIs and SID entities."
        }

        if existing_pkg:
            existing_pkg.update(pkg_entry_data)
        else:
            index_data["packages"].append(pkg_entry_data)

        with open(INDEX_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(index_data, f, indent=2, ensure_ascii=False)
        print(f"[SUCCESS] Updated {INDEX_JSON_PATH}")

if __name__ == "__main__":
    build_tmforum_package()
