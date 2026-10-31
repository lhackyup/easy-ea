#!/usr/bin/env python3
"""
ACORD Insurance Standard Framework Package Builder for EasyEA
Compiles the complete ACORD Capability Model, Information Model, Component Model,
and Insurance Core Systems into a downloadable .eap bundle and updates index.json.
"""

import os
import io
import json
import zipfile
import hashlib
import re
from typing import Dict, List, Any

from acord_taxonomy import (
    ACORD_DOMAINS,
    INSURANCE_CORE_SYSTEMS,
    ACORD_INFORMATION_ENTITIES
)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TARGET_EAP_PATH = os.path.join(REPO_ROOT, "backend", "app", "packages_repository", "acord-framework-1.0.0.eap")
INDEX_JSON_PATH = os.path.join(REPO_ROOT, "backend", "app", "packages_repository", "index.json")

def slugify(text: str) -> str:
    return re.sub(r'[^a-zA-Z0-9]+', '-', text).strip('-').lower()

def build_acord_package():
    print("=" * 70)
    print("EasyEA ACORD Insurance Framework Package Builder")
    print("=" * 70)

    # 1. Manifest
    manifest = {
        "$schema": "https://easyea.org/schemas/package-manifest-v1.json",
        "id": "pkg-acord-framework",
        "code": "acord",
        "name": "ACORD Insurance Standard Framework",
        "version": "1.0.0",
        "package_type": "framework",
        "standard_version": "v2024 / ACORD Standards",
        "description": "ACORD Capability Model, Component Model & Information Framework - Standard canonical reference architecture for Property & Casualty (P&C), Life & Annuities, Underwriting, Claims FNOL-to-Settlement, and Solvency II / IFRS 17 compliance.",
        "author": "ACORD Association",
        "license": "Open Standard / Community Reference",
        "website_url": "https://www.acord.org",
        "icon_color": "blue",
        "is_default_active": False
    }

    # 2. Package Custom Attributes
    attributes = [
        {
            "name": "acord_domain",
            "label": "ACORD Capability Domain",
            "description": "Top-level insurance capability domain in the ACORD framework.",
            "element_type": "Capability",
            "layer": "Strategy",
            "data_type": "string",
            "options": [],
            "default_value": "Policy Administration",
            "is_required": True,
            "section": "ACORD Metadata",
            "sort_order": 1
        },
        {
            "name": "acord_lob",
            "label": "Insurance Line of Business (LOB)",
            "description": "Target insurance vertical segment.",
            "element_type": "Capability",
            "layer": "Strategy",
            "data_type": "select",
            "options": ["Cross-LOB", "Property & Casualty", "Life & Annuities", "Health", "Reinsurance"],
            "default_value": "Cross-LOB",
            "is_required": True,
            "section": "ACORD Metadata",
            "sort_order": 2
        },
        {
            "name": "acord_category",
            "label": "Application System Category",
            "description": "Classification of the insurance system within the enterprise application landscape.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Core Insurance Platform", "Underwriting & Analytics", "Financial Operations", "Risk Management", "Digital Engagement"],
            "default_value": "Core Insurance Platform",
            "is_required": True,
            "section": "System Landscape",
            "sort_order": 3
        },
        {
            "name": "acord_standards",
            "label": "Supported ACORD & Industry Standards",
            "description": "Standard messaging formats (e.g. ACORD TxLife, ACORD P&C XML, EIOPA QRT, IFRS 17).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "ACORD XML",
            "is_required": False,
            "section": "System Landscape",
            "sort_order": 4
        }
    ]

    # 3. Stereotypes
    stereotypes = [
        {
            "base_type": "Grouping",
            "name": "ACORD Capability Domain",
            "label": "«ACORD Capability Domain»",
            "description": "Top-level operational insurance domain in the ACORD Capability Framework.",
            "icon_color": "blue",
            "links": []
        },
        {
            "base_type": "Capability",
            "name": "ACORD Capability",
            "label": "«ACORD Capability»",
            "description": "Canonical business capability defined in the ACORD Insurance Model.",
            "icon_color": "sky",
            "links": [
                {"attribute_name": "acord_domain", "is_required": True, "default_value": "Policy Administration", "section_override": "ACORD Capability", "sort_order": 1},
                {"attribute_name": "acord_lob", "is_required": True, "default_value": "Cross-LOB", "section_override": "ACORD Capability", "sort_order": 2}
            ]
        },
        {
            "base_type": "ApplicationComponent",
            "name": "Insurance Core System",
            "label": "«Insurance Core System»",
            "description": "Key application backbone system supporting insurance operations (PAS, CMS, Rating, Billing).",
            "icon_color": "teal",
            "links": [
                {"attribute_name": "acord_category", "is_required": True, "default_value": "Core Insurance Platform", "section_override": "Insurance System", "sort_order": 1},
                {"attribute_name": "acord_standards", "is_required": False, "section_override": "Insurance System", "sort_order": 2}
            ]
        },
        {
            "base_type": "BusinessObject",
            "name": "ACORD Information Asset",
            "label": "«ACORD Information Asset»",
            "description": "Canonical data or contract entity from the ACORD Information Framework (Policy, Claim, Treaty).",
            "icon_color": "emerald",
            "links": []
        }
    ]

    # 4. Reference Elements & Relationships
    elements = []
    relationships = []

    # 4a. ACORD Domains (Grouping) & Capabilities (Capability)
    for dom in ACORD_DOMAINS:
        dom_id = f"elem-acord-dom-{slugify(dom['code'])}"
        elements.append({
            "id_alias": dom_id,
            "name": dom["name"],
            "type": "Grouping",
            "layer": "Strategy",
            "documentation": f"ACORD Domain: {dom['description']}",
            "stereotype_name": "ACORD Capability Domain",
            "properties": {"acord_code": dom["code"]}
        })

        for cap in dom["capabilities_l2"]:
            cap_id = f"elem-acord-cap-{slugify(cap['name'])}"
            elements.append({
                "id_alias": cap_id,
                "name": cap["name"],
                "type": "Capability",
                "layer": "Strategy",
                "documentation": f"{cap['name']} ({cap['lob']}): {cap['description']}",
                "stereotype_name": "ACORD Capability",
                "properties": {
                    "acord_domain": dom["name"],
                    "acord_lob": cap["lob"]
                }
            })

            # Domain aggregates Capability
            relationships.append({
                "id_alias": f"rel-agg-{slugify(dom['code'])}-{slugify(cap['name'])}",
                "source_alias": dom["name"],
                "target_alias": cap["name"],
                "type": "AggregationRelationship",
                "name": "Includes Capability",
                "documentation": f"{dom['name']} encompasses the capability {cap['name']}."
            })

    # 4b. Insurance Core Systems (ApplicationComponent)
    for sys in INSURANCE_CORE_SYSTEMS:
        elements.append({
            "id_alias": sys["id"],
            "name": sys["name"],
            "type": "ApplicationComponent",
            "layer": "Application",
            "documentation": f"{sys['name']}: {sys['description']}",
            "stereotype_name": "Insurance Core System",
            "properties": {
                "acord_category": sys["category"],
                "acord_standards": ", ".join(sys["standards"])
            }
        })

    # 4c. ACORD Information Entities (BusinessObject)
    for ent in ACORD_INFORMATION_ENTITIES:
        ent_id = f"elem-acord-data-{slugify(ent['name'])}"
        elements.append({
            "id_alias": ent_id,
            "name": ent["name"],
            "type": "BusinessObject",
            "layer": "Business",
            "documentation": f"{ent['name']} ({ent['category']}): {ent['description']}",
            "stereotype_name": "ACORD Information Asset",
            "properties": {"acord_data_category": ent["category"]}
        })

    # 4d. Canonical System Realizations & End-to-End Operational Flows
    core_interactions = [
        # System realizing Capability
        ("Policy Administration System (PAS)", "Policy Inception & Document Issuance", "RealizationRelationship", "Automates Policy Issuance and Generation"),
        ("Policy Administration System (PAS)", "Mid-Term Policy Adjustments (Endorsements)", "RealizationRelationship", "Manages Contract Endorsements"),
        ("Claims Management System (CMS)", "First Notice of Loss (FNOL) Intake", "RealizationRelationship", "Captures Multichannel Claims Reports"),
        ("Claims Management System (CMS)", "Loss Adjusting & Damage Assessment", "RealizationRelationship", "Coordinates Surveyors and Repairers"),
        ("Claims Management System (CMS)", "Claim Indemnification & Settlement", "RealizationRelationship", "Authorizes Settlement Disbursements"),
        ("Rating & Pricing Calculation Engine", "Automated Rating & Quotation", "RealizationRelationship", "Executes Actuarial Tariff Algorithms"),
        ("Underwriter Decision Workbench", "Underwriting Rule Enforcement & Binding", "RealizationRelationship", "Enforces Risk Limits & Sanctions"),
        ("Insurance Billing & Premium Collections Engine", "Premium Invoicing & Installment Scheduling", "RealizationRelationship", "Generates Installment Invoices"),
        ("Insurance Billing & Premium Collections Engine", "Premium Collection & Dunning Management", "RealizationRelationship", "Processes Direct Debits & Dunning"),
        ("Reinsurance Management System", "Treaty Reinsurance Allocation & Cession", "RealizationRelationship", "Allocates Cessions across Treaties"),
        ("Reinsurance Management System", "Reinsurance Claims Recovery & Settlement", "RealizationRelationship", "Calculates Reinsurance Recoveries"),
        ("Claims Fraud Detection & SIU System", "Claims Fraud Scoring & SIU Investigation", "RealizationRelationship", "Real-Time AI Fraud Scoring"),
        ("Actuarial Valuation & Solvency II / IFRS 17 Engine", "Solvency II Capital Requirement (SCR) Calculation", "RealizationRelationship", "Calculates SCR & MCR Capital"),
        ("Actuarial Valuation & Solvency II / IFRS 17 Engine", "IFRS 17 Insurance Contract Measurement", "RealizationRelationship", "Measures CSM & Best Estimate Liabilities"),
        # Operational End-to-End Policy Lifecycle (Quote-to-Bind)
        ("Prospect Risk Evaluation & Profiling", "Automated Rating & Quotation", "TriggeringRelationship", "Feeds Insured Risk Data to Rating Engine"),
        ("Automated Rating & Quotation", "Underwriting Rule Enforcement & Binding", "TriggeringRelationship", "Submits Calculated Quote for Underwriting Validation"),
        ("Underwriting Rule Enforcement & Binding", "Policy Inception & Document Issuance", "TriggeringRelationship", "Binds Accepted Quote into Active Policy"),
        ("Policy Inception & Document Issuance", "Premium Invoicing & Installment Scheduling", "TriggeringRelationship", "Initiates Installment Billing Schedule"),
        # Operational End-to-End Claims Journey (FNOL-to-Payout)
        ("First Notice of Loss (FNOL) Intake", "Claims Fraud Scoring & SIU Investigation", "TriggeringRelationship", "Triggers Real-time Fraud Screening"),
        ("Claims Fraud Scoring & SIU Investigation", "Loss Adjusting & Damage Assessment", "TriggeringRelationship", "Routes Valid Claim to Technical Loss Appraisal"),
        ("Loss Adjusting & Damage Assessment", "Claims Reserving & Solvency Provisioning", "TriggeringRelationship", "Estimates Expected Loss and Sets Solvency Reserves"),
        ("Claims Reserving & Solvency Provisioning", "Claim Indemnification & Settlement", "TriggeringRelationship", "Liquidates Authorized Indemnification"),
        ("Claim Indemnification & Settlement", "Subrogation, Salvage & Third-Party Recovery", "TriggeringRelationship", "Initiates Recourse against Responsible Third Parties")
    ]

    for src_name, tgt_name, rel_type, rel_doc in core_interactions:
        src_slug = slugify(src_name)
        tgt_slug = slugify(tgt_name)
        relationships.append({
            "id_alias": f"rel-acord-{src_slug[:20]}-to-{tgt_slug[:20]}",
            "source_alias": src_name,
            "target_alias": tgt_name,
            "type": rel_type,
            "name": rel_doc.split()[0] if rel_type == "TriggeringRelationship" else "Implements",
            "documentation": f"ACORD Framework Alignment: {rel_doc}."
        })

    print(f"[*] Generated {len(elements)} ArchiMate elements and {len(relationships)} relationships.")

    # 5. Standard Views
    views = [
        {
            "id": "acord_capability_matrix_register",
            "name": "ACORD Insurance Capability Register",
            "description": "Comprehensive catalog of insurance business capabilities mapped across Product, Underwriting, Policy, Claims, and Solvency.",
            "category": "ACORD Capability Model",
            "view_type": "table",
            "icon": "Layers",
            "sort_order": 1,
            "target_hub": "business",
            "target_stereotypes": ["ACORD Capability"],
            "columns": [
                {"field": "name", "label": "Capability Name", "type": "string", "sortable": True},
                {"field": "acord_domain", "label": "Capability Domain", "type": "badge", "filterable": True},
                {"field": "acord_lob", "label": "Line of Business (LOB)", "type": "badge", "filterable": True},
                {"field": "documentation", "label": "Operational Scope", "type": "string", "sortable": False}
            ],
            "default_sort": {"field": "acord_domain", "direction": "asc"}
        },
        {
            "id": "acord_core_systems_portfolio",
            "name": "Insurance Core Systems Portfolio",
            "description": "Application portfolio of core insurance platforms (PAS, CMS, Rating, Billing, Reinsurance) and supported standards.",
            "category": "Insurance Application Landscape",
            "view_type": "table",
            "icon": "Server",
            "sort_order": 2,
            "target_hub": "business",
            "target_stereotypes": ["Insurance Core System"],
            "columns": [
                {"field": "name", "label": "Core System Name", "type": "string", "sortable": True},
                {"field": "acord_category", "label": "System Category", "type": "badge", "filterable": True},
                {"field": "acord_standards", "label": "Messaging Standards", "type": "string", "sortable": False},
                {"field": "documentation", "label": "System Responsibility", "type": "string", "sortable": False}
            ],
            "default_sort": {"field": "name", "direction": "asc"}
        },
        {
            "id": "acord_claims_settlement_journey",
            "name": "Claims Processing & Settlement Register (FNOL to Payout)",
            "description": "Operational register focused on the end-to-end claims lifecycle, fraud screening, loss appraisal, and reserving.",
            "category": "Claims Operations",
            "view_type": "table",
            "icon": "ShieldAlert",
            "sort_order": 3,
            "target_hub": "business",
            "target_stereotypes": ["ACORD Capability"],
            "filter_config": {
                "acord_domain": "Claims Management & Settlement"
            },
            "columns": [
                {"field": "name", "label": "Claims Capability", "type": "string", "sortable": True},
                {"field": "acord_lob", "label": "Target LOB", "type": "badge", "filterable": True},
                {"field": "documentation", "label": "Execution Role", "type": "string", "sortable": False}
            ]
        },
        {
            "id": "acord_insurance_analytics",
            "name": "ACORD Insurance Architecture Analytics",
            "description": "Executive metrics on capability coverage by Line of Business and Core System distribution.",
            "category": "Analytics",
            "view_type": "kpi_dashboard",
            "icon": "PieChart",
            "sort_order": 4,
            "target_hub": "business",
            "target_stereotypes": ["ACORD Capability"],
            "metrics": [
                {"id": "total_capabilities", "label": "Total ACORD Capabilities", "type": "count"},
                {"id": "cross_lob_count", "label": "Cross-LOB Capabilities", "type": "count", "where": {"acord_lob": "Cross-LOB"}},
                {"id": "claims_count", "label": "Claims Capabilities", "type": "count", "where": {"acord_domain": "Claims Management & Settlement"}}
            ],
            "charts": [
                {
                    "id": "chart_by_domain",
                    "title": "Capabilities by Domain",
                    "type": "pie",
                    "group_by": "acord_domain"
                },
                {
                    "id": "chart_by_lob",
                    "title": "Capabilities by Line of Business",
                    "type": "bar",
                    "group_by": "acord_lob"
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
- **ACORD Domains (L1)**: {len(ACORD_DOMAINS)}
- **Canonical Capabilities (L2)**: {len([e for e in elements if e['type'] == 'Capability'])}
- **Insurance Core Systems**: {len(INSURANCE_CORE_SYSTEMS)}
- **Canonical Information Assets**: {len(ACORD_INFORMATION_ENTITIES)}
- **Canonical Architecture Relationships**: {len(relationships)}
- **Preconfigured Business Views**: {len(views)}

## Compliance & Standards Alignment
- **ACORD Capability Model**: Underwriting, Policy, Claims, Billing, Reinsurance, Solvency.
- **ACORD Information Model**: Standardized Policy, Coverage, Claim, and Loss Reserve objects.
- **Regulatory Alignment**: Solvency II (SCR/MCR), IFRS 17 (CSM calculation).
- Fully compatible with ArchiMate 3.2 Strategy, Business, and Application layers.
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

        existing_pkg = next((p for p in index_data.get("packages", []) if p.get("id") == "pkg-acord-framework"), None)
        pkg_entry_data = {
            "id": "pkg-acord-framework",
            "code": "acord",
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
            "bundle_url": "acord-framework-1.0.0.eap",
            "size_kb": round(file_size_kb, 1),
            "checksum_sha256": sha256_hash,
            "elements_count": len(elements),
            "relationships_count": len(relationships),
            "views_count": len(views),
            "release_notes": "First release of ACORD Insurance Framework: Underwriting, Policy Administration, Claims FNOL-to-Settlement, Billing, Reinsurance, and Solvency II / IFRS 17 views."
        }

        if existing_pkg:
            existing_pkg.update(pkg_entry_data)
        else:
            index_data["packages"].append(pkg_entry_data)

        with open(INDEX_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(index_data, f, indent=2, ensure_ascii=False)
        print(f"[SUCCESS] Updated {INDEX_JSON_PATH}")

if __name__ == "__main__":
    build_acord_package()
