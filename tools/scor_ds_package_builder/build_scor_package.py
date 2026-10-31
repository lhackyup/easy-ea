#!/usr/bin/env python3
"""
SCOR Digital Standard (SCOR DS v14.0) Package Builder for EasyEA
Compiles the complete Supply Chain Operations Reference model, 7 Core Processes,
Supply Chain Software Platforms, and Deliverables into a downloadable .eap bundle.
"""

import os
import io
import json
import zipfile
import hashlib
import re
from typing import Dict, List, Any

from scor_taxonomy import (
    SCOR_L1_PROCESSES,
    SUPPLY_CHAIN_SYSTEMS,
    SCOR_DATA_ENTITIES
)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TARGET_EAP_PATH = os.path.join(REPO_ROOT, "backend", "app", "packages_repository", "scor-ds-1.0.0.eap")
INDEX_JSON_PATH = os.path.join(REPO_ROOT, "backend", "app", "packages_repository", "index.json")

def slugify(text: str) -> str:
    return re.sub(r'[^a-zA-Z0-9]+', '-', text).strip('-').lower()

def build_scor_package():
    print("=" * 70)
    print("EasyEA SCOR Digital Standard (SCOR DS v14.0) Package Builder")
    print("=" * 70)

    # 1. Manifest
    manifest = {
        "$schema": "https://easyea.org/schemas/package-manifest-v1.json",
        "id": "pkg-scor-ds",
        "code": "scor",
        "name": "SCOR Digital Standard (ASCM)",
        "version": "1.0.0",
        "package_type": "framework",
        "standard_version": "v14.0 / SCOR DS",
        "description": "Supply Chain Operations Reference Digital Standard (SCOR DS - ASCM) - Canonical reference architecture for End-to-End Supply Chain, Orchestrate, Plan, Order, Source, Transform, Deliver, and Return operations.",
        "author": "Association for Supply Chain Management (ASCM)",
        "license": "Open Standard / Community Reference",
        "website_url": "https://www.ascm.org",
        "icon_color": "rose",
        "is_default_active": False
    }

    # 2. Attributes
    attributes = [
        {
            "name": "scor_process_pillar",
            "label": "SCOR Fundamental Process",
            "description": "Top-level SCOR process pillar (Orchestrate, Plan, Order, Source, Transform, Deliver, Return).",
            "element_type": "BusinessProcess",
            "layer": "Business",
            "data_type": "select",
            "options": ["Orchestrate", "Plan", "Order", "Source", "Transform", "Deliver", "Return"],
            "default_value": "Plan",
            "is_required": True,
            "section": "SCOR Process Hierarchy",
            "sort_order": 1
        },
        {
            "name": "scor_level",
            "label": "SCOR Hierarchy Level",
            "description": "Process decomposition depth in the SCOR framework.",
            "element_type": "BusinessProcess",
            "layer": "Business",
            "data_type": "select",
            "options": ["L1", "L2", "L3"],
            "default_value": "L2",
            "is_required": True,
            "section": "SCOR Process Hierarchy",
            "sort_order": 2
        },
        {
            "name": "scor_metric_category",
            "label": "SCOR Performance Metric Category",
            "description": "Standard performance attribute (Reliability, Responsiveness, Agility, Cost, Asset Management).",
            "element_type": "BusinessProcess",
            "layer": "Business",
            "data_type": "select",
            "options": ["Reliability (OTIF)", "Responsiveness (Cycle Time)", "Agility (Adaptability)", "Cost (COGS)", "Asset Management (Cash-to-Cash)"],
            "default_value": "Reliability (OTIF)",
            "is_required": False,
            "section": "SCOR Performance Metrics",
            "sort_order": 3
        },
        {
            "name": "scor_system_scope",
            "label": "Supply Chain Functional Scope",
            "description": "Primary process area served by this software system.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Plan", "Order", "Source", "Deliver", "Return", "Enterprise"],
            "default_value": "Deliver",
            "is_required": True,
            "section": "Application Landscape",
            "sort_order": 4
        }
    ]

    # 3. Stereotypes
    stereotypes = [
        {
            "base_type": "Grouping",
            "name": "SCOR Process Pillar",
            "label": "«SCOR Process Pillar»",
            "description": "Fundamental high-level process group defined in SCOR DS (Plan, Order, Source, Transform, Deliver, Return).",
            "icon_color": "rose",
            "links": []
        },
        {
            "base_type": "BusinessProcess",
            "name": "SCOR Business Process",
            "label": "«SCOR Business Process»",
            "description": "Standard supply chain operational process defined in the ASCM SCOR model.",
            "icon_color": "red",
            "links": [
                {"attribute_name": "scor_process_pillar", "is_required": True, "default_value": "Plan", "section_override": "SCOR Hierarchy", "sort_order": 1},
                {"attribute_name": "scor_level", "is_required": True, "default_value": "L2", "section_override": "SCOR Hierarchy", "sort_order": 2},
                {"attribute_name": "scor_metric_category", "is_required": False, "section_override": "Metrics", "sort_order": 3}
            ]
        },
        {
            "base_type": "ApplicationComponent",
            "name": "Supply Chain Platform",
            "label": "«Supply Chain Platform»",
            "description": "Enterprise logistics or supply chain application software (SCP, WMS, TMS, SRM, OMS).",
            "icon_color": "purple",
            "links": [
                {"attribute_name": "scor_system_scope", "is_required": True, "default_value": "Deliver", "section_override": "System Scope", "sort_order": 1}
            ]
        },
        {
            "base_type": "BusinessObject",
            "name": "Supply Chain Deliverable",
            "label": "«Supply Chain Deliverable»",
            "description": "Transactional document or shipment artifact tracking goods through the supply chain.",
            "icon_color": "emerald",
            "links": []
        }
    ]

    # 4. Elements & Relationships
    elements = []
    relationships = []

    # 4a. SCOR L1 Process Pillars (Grouping) & L2 Processes (BusinessProcess)
    for p_l1 in SCOR_L1_PROCESSES:
        pillar_id = f"elem-scor-pillar-{slugify(p_l1['name'])}"
        elements.append({
            "id_alias": pillar_id,
            "name": f"Pillar: {p_l1['name']}",
            "type": "Grouping",
            "layer": "Business",
            "documentation": f"SCOR DS Pillar {p_l1['name']}: {p_l1['description']}",
            "stereotype_name": "SCOR Process Pillar",
            "properties": {"scor_code": p_l1["code"]}
        })

        for p_l2 in p_l1["processes_l2"]:
            proc_id = f"elem-scor-proc-{slugify(p_l2['name'])}"
            elements.append({
                "id_alias": proc_id,
                "name": p_l2["name"],
                "type": "BusinessProcess",
                "layer": "Business",
                "documentation": f"SCOR L2 Process: {p_l2['description']}",
                "stereotype_name": "SCOR Business Process",
                "properties": {
                    "scor_process_pillar": p_l1["name"],
                    "scor_level": "L2",
                    "scor_metric_category": "Reliability (OTIF)" if "Deliver" in p_l1["name"] or "Order" in p_l1["name"] else "Responsiveness (Cycle Time)"
                }
            })

            # Pillar aggregates process
            relationships.append({
                "id_alias": f"rel-agg-pillar-{slugify(p_l1['name'])}-{slugify(p_l2['code'])}",
                "source_alias": f"Pillar: {p_l1['name']}",
                "target_alias": p_l2["name"],
                "type": "AggregationRelationship",
                "name": "Includes Process",
                "documentation": f"{p_l1['name']} encompasses {p_l2['name']}."
            })

    # 4b. Supply Chain Systems (ApplicationComponent)
    for sys in SUPPLY_CHAIN_SYSTEMS:
        elements.append({
            "id_alias": sys["id"],
            "name": sys["name"],
            "type": "ApplicationComponent",
            "layer": "Application",
            "documentation": f"{sys['name']}: {sys['description']}",
            "stereotype_name": "Supply Chain Platform",
            "properties": {
                "scor_system_scope": sys["scor_scope"]
            }
        })

    # 4c. Data Entities & Deliverables (BusinessObject)
    for dent in SCOR_DATA_ENTITIES:
        dent_id = f"elem-scor-data-{slugify(dent['name'])}"
        elements.append({
            "id_alias": dent_id,
            "name": dent["name"],
            "type": "BusinessObject",
            "layer": "Business",
            "documentation": f"{dent['name']} ({dent['process']}): {dent['description']}",
            "stereotype_name": "Supply Chain Deliverable",
            "properties": {"scor_process_scope": dent["process"]}
        })

    # 4d. Canonical System Realizations & End-to-End Operational Supply Chain Flows
    core_interactions = [
        # Systems realizing processes
        ("Supply Chain Planning & S&OP Platform (SCP)", "Demand Forecasting & Consensus Planning", "RealizationRelationship", "Executes AI-Driven Demand Sensing"),
        ("Supply Chain Planning & S&OP Platform (SCP)", "Sales & Operations Planning (S&OP / IBP)", "RealizationRelationship", "Simulates S&OP Supply Scenarios"),
        ("Distributed Order Management System (DOM / OMS)", "Customer Quotation & Order Capture", "RealizationRelationship", "Captures Multichannel Orders"),
        ("Distributed Order Management System (DOM / OMS)", "Available-to-Promise (ATP) & Sourcing Routing", "RealizationRelationship", "Calculates Real-Time ATP and Route Allocation"),
        ("Supplier Relationship & Procurement Portal (SRM)", "Supplier Negotiation & Purchase Order Issuance", "RealizationRelationship", "Dispatches POs to Vendors"),
        ("Warehouse Management System (WMS)", "Warehouse Wave Picking & Order Packing", "RealizationRelationship", "Directs Slotting & Wave Picking"),
        ("Transportation Management System (TMS)", "Transportation Planning & Freight Consolidation", "RealizationRelationship", "Optimizes Carrier Routes and Load Consolidation"),
        ("Transportation Management System (TMS)", "Final Mile Delivery & Proof of Delivery (POD)", "RealizationRelationship", "Captures Electronic Proof of Delivery"),
        ("Reverse Logistics & Warranty Management System", "Return Material Authorization (RMA) Issuance", "RealizationRelationship", "Authorizes Customer Returns"),
        # End-to-End Operational Order-to-Delivery Pipeline
        ("Demand Forecasting & Consensus Planning", "Master Production Scheduling (MPS)", "TriggeringRelationship", "Feeds Demand Plan to Production Scheduling"),
        ("Customer Quotation & Order Capture", "Available-to-Promise (ATP) & Sourcing Routing", "TriggeringRelationship", "Validates Order and Allocates Inventory Node"),
        ("Available-to-Promise (ATP) & Sourcing Routing", "Warehouse Wave Picking & Order Packing", "TriggeringRelationship", "Releases Order to Warehouse Fulfillment"),
        ("Warehouse Wave Picking & Order Packing", "Transportation Planning & Freight Consolidation", "TriggeringRelationship", "Stages Packed Cartons for Freight Consolidation"),
        ("Transportation Planning & Freight Consolidation", "Carrier Dispatch & In-Transit Tracking", "TriggeringRelationship", "Tenders Consolidated Load to Freight Carrier"),
        ("Carrier Dispatch & In-Transit Tracking", "Final Mile Delivery & Proof of Delivery (POD)", "TriggeringRelationship", "Completes Final Mile Customer Drop-Off"),
        ("Final Mile Delivery & Proof of Delivery (POD)", "Return Material Authorization (RMA) Issuance", "TriggeringRelationship", "Handles Post-Delivery Customer Returns")
    ]

    for src_name, tgt_name, rel_type, rel_doc in core_interactions:
        src_slug = slugify(src_name)
        tgt_slug = slugify(tgt_name)
        relationships.append({
            "id_alias": f"rel-scor-{src_slug[:20]}-to-{tgt_slug[:20]}",
            "source_alias": src_name,
            "target_alias": tgt_name,
            "type": rel_type,
            "name": rel_doc.split()[0] if rel_type == "RealizationRelationship" else "Flows To",
            "documentation": f"SCOR DS Alignment: {rel_doc}."
        })

    print(f"[*] Generated {len(elements)} ArchiMate elements and {len(relationships)} relationships.")

    # 5. Standard Views
    views = [
        {
            "id": "scor_process_hierarchy_register",
            "name": "SCOR Business Process Framework Register",
            "description": "Comprehensive catalog of supply chain operational processes categorized by SCOR pillar (Plan, Order, Source, Transform, Deliver, Return).",
            "category": "SCOR Process Architecture",
            "view_type": "table",
            "icon": "Workflow",
            "sort_order": 1,
            "target_hub": "business",
            "target_stereotypes": ["SCOR Business Process"],
            "columns": [
                {"field": "name", "label": "Process Name", "type": "string", "sortable": True},
                {"field": "scor_process_pillar", "label": "SCOR Pillar", "type": "badge", "filterable": True},
                {"field": "scor_metric_category", "label": "Key Metric Attribute", "type": "badge", "filterable": True},
                {"field": "documentation", "label": "Process Scope", "type": "string", "sortable": False}
            ],
            "default_sort": {"field": "scor_process_pillar", "direction": "asc"}
        },
        {
            "id": "scor_systems_architecture_portfolio",
            "name": "Supply Chain Platforms & Systems Portfolio",
            "description": "Inventory of supply chain software platforms (SCP, WMS, TMS, SRM, OMS) and functional scopes.",
            "category": "Supply Chain IT Landscape",
            "view_type": "table",
            "icon": "Truck",
            "sort_order": 2,
            "target_hub": "business",
            "target_stereotypes": ["Supply Chain Platform"],
            "columns": [
                {"field": "name", "label": "Platform Name", "type": "string", "sortable": True},
                {"field": "scor_system_scope", "label": "Primary SCOR Scope", "type": "badge", "filterable": True},
                {"field": "documentation", "label": "System Responsibility", "type": "string", "sortable": False}
            ],
            "default_sort": {"field": "name", "direction": "asc"}
        },
        {
            "id": "scor_order_to_delivery_pipeline",
            "name": "Order-to-Delivery & Fulfillment Pipeline (Order & Deliver)",
            "description": "Operational register focused on customer order capture, warehouse picking, transportation, and final mile delivery.",
            "category": "Logistics & Fulfillment",
            "view_type": "table",
            "icon": "Package",
            "sort_order": 3,
            "target_hub": "business",
            "target_stereotypes": ["SCOR Business Process"],
            "filter_config": {
                "scor_process_pillar": ["Order", "Deliver"]
            },
            "columns": [
                {"field": "name", "label": "Fulfillment Process", "type": "string", "sortable": True},
                {"field": "scor_process_pillar", "label": "Pillar", "type": "badge", "filterable": True},
                {"field": "documentation", "label": "Operational Role", "type": "string"}
            ]
        },
        {
            "id": "scor_supply_chain_analytics",
            "name": "SCOR Supply Chain Architecture Analytics",
            "description": "Executive metrics on process coverage across SCOR pillars and performance attributes (OTIF, Cycle Time, Cost).",
            "category": "Analytics",
            "view_type": "kpi_dashboard",
            "icon": "PieChart",
            "sort_order": 4,
            "target_hub": "business",
            "target_stereotypes": ["SCOR Business Process"],
            "metrics": [
                {"id": "total_processes", "label": "Total SCOR Processes", "type": "count"},
                {"id": "deliver_count", "label": "Deliver & Logistics Processes", "type": "count", "where": {"scor_process_pillar": "Deliver"}},
                {"id": "plan_count", "label": "Planning & S&OP Processes", "type": "count", "where": {"scor_process_pillar": "Plan"}}
            ],
            "charts": [
                {
                    "id": "chart_by_pillar",
                    "title": "Processes by SCOR Pillar",
                    "type": "pie",
                    "group_by": "scor_process_pillar"
                },
                {
                    "id": "chart_by_metric",
                    "title": "Processes by Target Metric Category",
                    "type": "bar",
                    "group_by": "scor_metric_category"
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
- **SCOR Fundamental Pillars (L1)**: {len(SCOR_L1_PROCESSES)}
- **Canonical SCOR Processes (L2)**: {len([e for e in elements if e['stereotype_name'] == 'SCOR Business Process'])}
- **Supply Chain Platforms (WMS, TMS, SCP, OMS, SRM)**: {len(SUPPLY_CHAIN_SYSTEMS)}
- **Canonical Deliverables & Data Objects**: {len(SCOR_DATA_ENTITIES)}
- **Canonical Architecture Relationships**: {len(relationships)}
- **Preconfigured Business Views**: {len(views)}

## Compliance & Standards Alignment
- **ASCM SCOR DS v14.0**: Orchestrate, Plan, Order, Source, Transform, Deliver, Return.
- Standard Supply Chain Performance Metrics: OTIF, Cycle Time, Cash-to-Cash (C2C).
- Fully compatible with ArchiMate 3.2 Strategy, Business, Application, and Physical layers.
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

        existing_pkg = next((p for p in index_data.get("packages", []) if p.get("id") == "pkg-scor-ds"), None)
        pkg_entry_data = {
            "id": "pkg-scor-ds",
            "code": "scor",
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
            "bundle_url": "scor-ds-1.0.0.eap",
            "size_kb": round(file_size_kb, 1),
            "checksum_sha256": sha256_hash,
            "elements_count": len(elements),
            "relationships_count": len(relationships),
            "views_count": len(views),
            "release_notes": "First release of SCOR Digital Standard (SCOR DS): 7 fundamental pillars (Plan, Order, Source, Transform, Deliver, Return, Orchestrate), WMS/TMS/SCP systems, OTIF metrics, and Order-to-Delivery pipeline."
        }

        if existing_pkg:
            existing_pkg.update(pkg_entry_data)
        else:
            index_data["packages"].append(pkg_entry_data)

        with open(INDEX_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(index_data, f, indent=2, ensure_ascii=False)
        print(f"[SUCCESS] Updated {INDEX_JSON_PATH}")

if __name__ == "__main__":
    build_scor_package()
