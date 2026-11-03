"""
EasyEA ArchiMate Standard Layer Packages & EASY Model Layer Views Seeder.

Implements the standard ArchiMate layer packages:
- Strategy Layer: pkg-bcm (Business Capability Maturity & Heatmap)
- Business Layer: pkg-bsc (Product & Business Service Catalog)
- Application Layer: pkg-alc (Application Architecture & Technical Health)
- Technology Layer: pkg-cld (Infrastructure & Cloud Topology) AND pkg-eol (Technology Obsolescence & Lifecycle)
- Motivation Layer: pkg-req (Requirements & Constraints Governance)
- Implementation Layer: pkg-ppm (Work Package & Roadmap Delivery)

All packages are created with `is_default_active = False` so administrators can activate them explicitly per library.
Also seeds/enriches the EASY model ('sample-easybank-ea') with active package links, multi-layer elements,
relationships, properties, package views, and dedicated visual diagram views for every layer.
"""

import json
import logging
import uuid
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.archimate import (
    AttributePackage,
    AttributePackageItem,
    PackageView,
    WorkspaceAttributePackage,
    ModelWorkspace,
    ArchimateElement,
    ArchimateRelationship,
    ArchimateView,
    ArchiSchema,
    SchemaFolder,
    SchemaVersionHistory
)

logger = logging.getLogger(__name__)

STANDARD_LAYER_PACKAGES = [
    # 1. Strategy Layer: 1A (bcm)
    {
        "id": "pkg-bcm",
        "code": "bcm",
        "name": "Business Capability Maturity",
        "version": "1.0.0",
        "author": "Open Group ArchiMate / TOGAF Standards",
        "license": "Open Standard",
        "description": "Standard ArchiMate & TOGAF Capability Maturity, strategic alignment, target maturity, and investment stance framework.",
        "icon_color": "amber",
        "package_type": "attribute_only",
        "standard_version": "ArchiMate 3.2 / TOGAF",
        "is_default_active": False,
        "is_system": True,
        "items": [
            {
                "id": "item-bcm-maturity-level",
                "name": "bcm_maturity_level",
                "label": "Maturity Level (CMMI)",
                "description": "Current maturity level of the business capability from 1 (Initial) to 5 (Optimizing).",
                "element_type": "Capability",
                "layer": "Strategy",
                "data_type": "select",
                "options": ["1 - Initial/Ad-hoc", "2 - Repeatable", "3 - Defined", "4 - Managed", "5 - Optimizing"],
                "default_value": "3 - Defined",
                "is_required": False,
                "section": "Capability Assessment",
                "sort_order": 1
            },
            {
                "id": "item-bcm-strategic-fit",
                "name": "bcm_strategic_fit",
                "label": "Strategic Fit",
                "description": "Strategic positioning of the capability relative to the enterprise business model.",
                "element_type": "Capability",
                "layer": "Strategy",
                "data_type": "select",
                "options": ["Commodity", "Operational Support", "Business Core", "Strategic Differentiator"],
                "default_value": "Business Core",
                "is_required": False,
                "section": "Capability Assessment",
                "sort_order": 2
            },
            {
                "id": "item-bcm-target-maturity",
                "name": "bcm_target_maturity",
                "label": "Target Maturity (To-Be)",
                "description": "Expected target maturity level upon completion of the strategic transformation roadmap.",
                "element_type": "Capability",
                "layer": "Strategy",
                "data_type": "select",
                "options": ["1 - Initial/Ad-hoc", "2 - Repeatable", "3 - Defined", "4 - Managed", "5 - Optimizing"],
                "default_value": "4 - Managed",
                "is_required": False,
                "section": "Strategic Roadmap",
                "sort_order": 3
            },
            {
                "id": "item-bcm-investment-stance",
                "name": "bcm_investment_stance",
                "label": "Investment Stance",
                "description": "Budget and resource allocation guidance (Invest & Grow, Maintain, Sunset).",
                "element_type": "Capability",
                "layer": "Strategy",
                "data_type": "select",
                "options": ["Invest & Grow", "Maintain & Protect", "Rationalize / Consolidate", "Sunset / Divest"],
                "default_value": "Maintain & Protect",
                "is_required": False,
                "section": "Strategic Roadmap",
                "sort_order": 4
            }
        ],
        "views": [
            {
                "id": "pkv-bcm-capability-matrix",
                "view_key": "bcm_capability_matrix",
                "name": "Business Capability Maturity Matrix",
                "description": "Analysis of enterprise capabilities, CMMI maturity levels, strategic alignment, and investment stance.",
                "category": "Strategy & Capabilities",
                "view_type": "table",
                "icon": "Award",
                "target_hub": "business",
                "sort_order": 1,
                "target_types": ["Capability", "Resource"],
                "config": {
                    "columns": [
                        {"field": "name", "label": "Capability / Resource Name", "type": "string", "sortable": True, "filterable": True},
                        {"field": "type", "label": "Type", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "bcm_maturity_level", "label": "Current Maturity", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "bcm_target_maturity", "label": "Target Maturity", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "bcm_strategic_fit", "label": "Strategic Fit", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "bcm_investment_stance", "label": "Investment Stance", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "documentation", "label": "Documentation", "type": "string", "sortable": False, "filterable": False}
                    ],
                    "default_sort": {"field": "name", "direction": "asc"},
                    "filter_config": {"selectedLayer": "Strategy"}
                }
            }
        ]
    },

    # 2. Business Layer: 2B (bsc)
    {
        "id": "pkg-bsc",
        "code": "bsc",
        "name": "Business Service & Product Catalog",
        "version": "1.0.0",
        "author": "ITIL 4 / ArchiMate Business Standards",
        "license": "Open Standard",
        "description": "Standard ITIL 4 and ArchiMate 3.2 catalog for Business Services, Products, and Contracts tracking delivery channels, customer segments, lifecycle status, and SLAs.",
        "icon_color": "yellow",
        "package_type": "attribute_only",
        "standard_version": "ArchiMate 3.2 / ITIL 4",
        "is_default_active": False,
        "is_system": True,
        "items": [
            {
                "id": "item-bsc-delivery-channel",
                "name": "bsc_delivery_channel",
                "label": "Primary Delivery Channel",
                "description": "Physical or digital channel through which the service or product is delivered to the end user.",
                "element_type": "BusinessService",
                "layer": "Business",
                "data_type": "select",
                "options": ["Digital Web / Mobile", "Open API / Partner Portal", "Physical Branch / Store", "Contact Center / Assisted"],
                "default_value": "Digital Web / Mobile",
                "is_required": False,
                "section": "Service Delivery",
                "sort_order": 1
            },
            {
                "id": "item-bsc-customer-segment",
                "name": "bsc_customer_segment",
                "label": "Target Customer Segment",
                "description": "Market or user target segmentation (Retail B2C, Corporate B2B, Internal B2E, Public Admin B2G).",
                "element_type": "Product",
                "layer": "Business",
                "data_type": "select",
                "options": ["Retail / Consumer (B2C)", "Corporate / Enterprise (B2B)", "Internal Employees (B2E)", "Public Administration (B2G)"],
                "default_value": "Retail / Consumer (B2C)",
                "is_required": False,
                "section": "Service Delivery",
                "sort_order": 2
            },
            {
                "id": "item-bsc-lifecycle-status",
                "name": "bsc_lifecycle_status",
                "label": "Service Lifecycle Status",
                "description": "Operational lifecycle phase of the service within the enterprise catalog.",
                "element_type": "BusinessService",
                "layer": "Business",
                "data_type": "select",
                "options": ["Draft / In Design", "Pilot / Testing", "General Availability (GA)", "Phasing Out", "Retired"],
                "default_value": "General Availability (GA)",
                "is_required": False,
                "section": "Service Governance",
                "sort_order": 3
            },
            {
                "id": "item-bsc-contract-sla",
                "name": "bsc_contract_sla",
                "label": "Guaranteed Service SLA",
                "description": "Service level agreement contractually agreed for the product or service.",
                "element_type": "Contract",
                "layer": "Business",
                "data_type": "select",
                "options": ["Gold (99.99%)", "Silver (99.9%)", "Bronze (99.0%)", "Standard Business Hours"],
                "default_value": "Silver (99.9%)",
                "is_required": False,
                "section": "Service Governance",
                "sort_order": 4
            }
        ],
        "views": [
            {
                "id": "pkv-bsc-service-catalog",
                "view_key": "bsc_service_catalog",
                "name": "Product & Business Service Catalog",
                "description": "Official catalog of enterprise products, contracts, delivery channels, and agreed service levels.",
                "category": "Business Architecture",
                "view_type": "table",
                "icon": "Briefcase",
                "target_hub": "business",
                "sort_order": 2,
                "target_types": ["Product", "BusinessService", "Contract"],
                "config": {
                    "columns": [
                        {"field": "name", "label": "Product / Service Name", "type": "string", "sortable": True, "filterable": True},
                        {"field": "type", "label": "Type", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "bsc_delivery_channel", "label": "Channel", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "bsc_customer_segment", "label": "Target Segment", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "bsc_lifecycle_status", "label": "Lifecycle", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "bsc_contract_sla", "label": "Guaranteed SLA", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "documentation", "label": "Documentation", "type": "string", "sortable": False, "filterable": False}
                    ],
                    "default_sort": {"field": "name", "direction": "asc"},
                    "filter_config": {"selectedLayer": "Business"}
                }
            }
        ]
    },

    # 3. Application Layer: 3B (alc)
    {
        "id": "pkg-alc",
        "code": "alc",
        "name": "Application Architecture & Technical Health",
        "version": "1.0.0",
        "author": "ISO 25010 / TOGAF Application Standards",
        "license": "Open Standard",
        "description": "Standard ISO 25010 and TOGAF application architecture evaluation tracking hosting models, architecture patterns, technical debt, and code maintainability.",
        "icon_color": "blue",
        "package_type": "attribute_only",
        "standard_version": "ArchiMate 3.2 / ISO 25010",
        "is_default_active": False,
        "is_system": True,
        "items": [
            {
                "id": "item-alc-hosting-model",
                "name": "alc_hosting_model",
                "label": "Hosting Model",
                "description": "Target runtime execution infrastructure (Cloud SaaS, PaaS, IaaS, On-Premises, Mainframe).",
                "element_type": "ApplicationComponent",
                "layer": "Application",
                "data_type": "select",
                "options": ["Cloud SaaS", "Cloud PaaS / Containers", "Cloud IaaS (VM)", "On-Premises Private DC", "Legacy Mainframe"],
                "default_value": "Cloud PaaS / Containers",
                "is_required": False,
                "section": "Application Architecture",
                "sort_order": 1
            },
            {
                "id": "item-alc-architecture-pattern",
                "name": "alc_architecture_pattern",
                "label": "Architecture Pattern",
                "description": "Software architecture style (Microservices, Modular Monolith, Event-Driven, Serverless).",
                "element_type": "ApplicationComponent",
                "layer": "Application",
                "data_type": "select",
                "options": ["Microservices", "Modular Monolith", "Event-Driven Architecture (EDA)", "Traditional Monolith", "Serverless Functions"],
                "default_value": "Microservices",
                "is_required": False,
                "section": "Application Architecture",
                "sort_order": 2
            },
            {
                "id": "item-alc-tech-debt-level",
                "name": "alc_tech_debt_level",
                "label": "Technical Debt Level",
                "description": "Estimated severity of technical debt and refactoring complexity required.",
                "element_type": "ApplicationComponent",
                "layer": "Application",
                "data_type": "select",
                "options": ["Negligible / Modern", "Low / Manageable", "Medium / Planned Refactoring", "High / Urgent Attention", "Critical / Blocking"],
                "default_value": "Low / Manageable",
                "is_required": False,
                "section": "Technical Quality",
                "sort_order": 3
            },
            {
                "id": "item-alc-code-quality-grade",
                "name": "alc_code_quality_grade",
                "label": "Code Maintainability Grade",
                "description": "Maintainability, readability, and test coverage grade of the codebase (ISO 25010 standard).",
                "element_type": "ApplicationComponent",
                "layer": "Application",
                "data_type": "select",
                "options": ["A - High Maintainability", "B - Good Quality", "C - Mediocre / Needs Refactoring", "D - Hard to Maintain / Obsolete"],
                "default_value": "B - Good Quality",
                "is_required": False,
                "section": "Technical Quality",
                "sort_order": 4
            }
        ],
        "views": [
            {
                "id": "pkv-alc-tech-health",
                "view_key": "alc_tech_health",
                "name": "Application Architecture & Technical Debt Matrix",
                "description": "Evaluation of application component architectural patterns, hosting models, and technical debt health.",
                "category": "Application Architecture",
                "view_type": "table",
                "icon": "Cpu",
                "target_hub": "architecture",
                "sort_order": 3,
                "target_types": ["ApplicationComponent"],
                "config": {
                    "columns": [
                        {"field": "name", "label": "Application Component", "type": "string", "sortable": True, "filterable": True},
                        {"field": "alc_architecture_pattern", "label": "Architecture Pattern", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "alc_hosting_model", "label": "Hosting Model", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "alc_tech_debt_level", "label": "Tech Debt Level", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "alc_code_quality_grade", "label": "Code Quality", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "documentation", "label": "Documentation", "type": "string", "sortable": False, "filterable": False}
                    ],
                    "default_sort": {"field": "name", "direction": "asc"},
                    "filter_config": {"selectedLayer": "Application"}
                }
            }
        ]
    },

    # 4. Technology Layer: 4A (cld)
    {
        "id": "pkg-cld",
        "code": "cld",
        "name": "Infrastructure & Cloud Topology",
        "version": "1.0.0",
        "author": "Cloud Infrastructure Standards",
        "license": "Open Standard",
        "description": "Standard cloud infrastructure topology and tiering tracking runtime environments, cloud providers, high-availability redundancy, and compute forms.",
        "icon_color": "emerald",
        "package_type": "attribute_only",
        "standard_version": "ArchiMate 3.2 Technology Layer",
        "is_default_active": False,
        "is_system": True,
        "items": [
            {
                "id": "item-cld-environment-tier",
                "name": "cld_environment_tier",
                "label": "Environment / Tier",
                "description": "Operational staging tier (Production PRD, Disaster Recovery DR, Staging, QA, Development).",
                "element_type": "*",
                "layer": "Technology",
                "data_type": "select",
                "options": ["Production (PRD)", "Disaster Recovery (DR)", "Pre-Production / Staging", "Test / Quality Assurance (QA)", "Development (DEV)"],
                "default_value": "Production (PRD)",
                "is_required": False,
                "section": "Cloud & Environment",
                "sort_order": 1
            },
            {
                "id": "item-cld-cloud-provider",
                "name": "cld_cloud_provider",
                "label": "Cloud Provider / Platform",
                "description": "Cloud provider or hosting datacenter (AWS, Azure, GCP, Private Cloud On-Prem, Colocation).",
                "element_type": "*",
                "layer": "Technology",
                "data_type": "select",
                "options": ["Amazon Web Services (AWS)", "Microsoft Azure", "Google Cloud Platform (GCP)", "Private Cloud On-Prem (OpenStack/VMware)", "Bare Metal / Colocation"],
                "default_value": "Microsoft Azure",
                "is_required": False,
                "section": "Cloud & Environment",
                "sort_order": 2
            },
            {
                "id": "item-cld-ha-pattern",
                "name": "cld_ha_pattern",
                "label": "High Availability (HA) Pattern",
                "description": "Resilience topology pattern (Multi-Region Active-Active, Active-Passive Failover, Cold Standby, Standalone SPOF).",
                "element_type": "*",
                "layer": "Technology",
                "data_type": "select",
                "options": ["Multi-Region Active-Active", "Active-Passive Automatic Failover", "Cold Standby / Backup Restore", "Standalone / Single Point of Failure (SPOF)"],
                "default_value": "Active-Passive Automatic Failover",
                "is_required": False,
                "section": "Resilience & Topology",
                "sort_order": 3
            },
            {
                "id": "item-cld-compute-form",
                "name": "cld_compute_form",
                "label": "Compute Resource Form",
                "description": "Computational deployment form (Kubernetes Pod/Container, Virtual Machine, Serverless, Physical Dedicated Server).",
                "element_type": "*",
                "layer": "Technology",
                "data_type": "select",
                "options": ["Kubernetes Pod / Container Engine", "Virtual Machine (IaaS)", "Serverless / Managed Service", "Physical Dedicated Server"],
                "default_value": "Kubernetes Pod / Container Engine",
                "is_required": False,
                "section": "Resilience & Topology",
                "sort_order": 4
            }
        ],
        "views": [
            {
                "id": "pkv-cld-infra-topology",
                "view_key": "cld_infra_topology",
                "name": "Infrastructure & Cloud Deployment Landscape",
                "description": "Topology and classification of nodes, cloud environments, high availability patterns, and compute resources.",
                "category": "Technology Architecture",
                "view_type": "table",
                "icon": "Cloud",
                "target_hub": "architecture",
                "sort_order": 4,
                "target_types": ["Node", "Device", "SystemSoftware", "TechnologyService"],
                "config": {
                    "columns": [
                        {"field": "name", "label": "Infrastructure Element", "type": "string", "sortable": True, "filterable": True},
                        {"field": "type", "label": "Type", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "cld_environment_tier", "label": "Environment", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "cld_cloud_provider", "label": "Provider", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "cld_ha_pattern", "label": "HA Redundancy", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "cld_compute_form", "label": "Compute Form", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "documentation", "label": "Documentation", "type": "string", "sortable": False, "filterable": False}
                    ],
                    "default_sort": {"field": "name", "direction": "asc"},
                    "filter_config": {"selectedLayer": "Technology"}
                }
            }
        ]
    },

    # 5. Technology Layer: 4B (eol)
    {
        "id": "pkg-eol",
        "code": "eol",
        "name": "Technology Obsolescence & Lifecycle",
        "version": "1.0.0",
        "author": "ITIL / CIS Technology Controls",
        "license": "Open Standard",
        "description": "Standard configuration and obsolescence governance tracking software/hardware versions, vendor support status, End-of-Life (EoL) dates, and remediation strategies.",
        "icon_color": "teal",
        "package_type": "attribute_only",
        "standard_version": "ArchiMate 3.2 / ITIL / CIS Controls",
        "is_default_active": False,
        "is_system": True,
        "items": [
            {
                "id": "item-eol-vendor-name",
                "name": "eol_vendor_name",
                "label": "Vendor / Official Supplier",
                "description": "Official vendor or maintenance community for the technology component.",
                "element_type": "*",
                "layer": "Technology",
                "data_type": "string",
                "options": [],
                "default_value": "Open Source Community",
                "is_required": False,
                "section": "Vendor & Version",
                "sort_order": 1
            },
            {
                "id": "item-eol-installed-version",
                "name": "eol_installed_version",
                "label": "Deployed / Installed Version",
                "description": "Exact version identifier of software or firmware deployed in infrastructure.",
                "element_type": "*",
                "layer": "Technology",
                "data_type": "string",
                "options": [],
                "default_value": "1.0.0",
                "is_required": False,
                "section": "Vendor & Version",
                "sort_order": 2
            },
            {
                "id": "item-eol-support-status",
                "name": "eol_support_status",
                "label": "Official Support Status",
                "description": "Vendor-guaranteed support tier (Mainstream, Extended, EoS, EoL / Obsolete).",
                "element_type": "*",
                "layer": "Technology",
                "data_type": "select",
                "options": ["Mainstream Vendor Support", "Extended Paid Support", "End of Support (EoS)", "End of Life (EoL) / Unsupported"],
                "default_value": "Mainstream Vendor Support",
                "is_required": False,
                "section": "Obsolescence Governance",
                "sort_order": 3
            },
            {
                "id": "item-eol-end-date",
                "name": "eol_end_date",
                "label": "End of Life Date (EoL)",
                "description": "Official end-of-life date communicated by the vendor after which security patches cease.",
                "element_type": "*",
                "layer": "Technology",
                "data_type": "date",
                "options": [],
                "default_value": None,
                "is_required": False,
                "section": "Obsolescence Governance",
                "sort_order": 4
            },
            {
                "id": "item-eol-remediation-strategy",
                "name": "eol_remediation_strategy",
                "label": "Remediation / Upgrade Strategy",
                "description": "Strategic obsolescence risk remediation plan (In-Place Upgrade, Rehost, Replace).",
                "element_type": "*",
                "layer": "Technology",
                "data_type": "select",
                "options": ["In-Place Upgrade", "Platform Rehost / Replatform", "Retire & Replace", "Accept Risk (Waiver)"],
                "default_value": "In-Place Upgrade",
                "is_required": False,
                "section": "Remediation",
                "sort_order": 5
            }
        ],
        "views": [
            {
                "id": "pkv-eol-technology-lifecycle",
                "view_key": "eol_technology_lifecycle",
                "name": "Technology Obsolescence & EoL Roadmap",
                "description": "Inventory of software and hardware technology versions, EoL contract expirations, and remediation plans.",
                "category": "Technology Architecture",
                "view_type": "table",
                "icon": "AlertTriangle",
                "target_hub": "architecture",
                "sort_order": 5,
                "target_types": ["SystemSoftware", "Node", "Device", "Artifact"],
                "config": {
                    "columns": [
                        {"field": "name", "label": "Technology Element", "type": "string", "sortable": True, "filterable": True},
                        {"field": "type", "label": "Type", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "eol_vendor_name", "label": "Vendor", "type": "string", "sortable": True, "filterable": True},
                        {"field": "eol_installed_version", "label": "Version", "type": "string", "sortable": True, "filterable": True},
                        {"field": "eol_support_status", "label": "Support Status", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "eol_end_date", "label": "EoL Date", "type": "string", "sortable": True, "filterable": True},
                        {"field": "eol_remediation_strategy", "label": "Remediation", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "documentation", "label": "Documentation", "type": "string", "sortable": False, "filterable": False}
                    ],
                    "default_sort": {"field": "name", "direction": "asc"},
                    "filter_config": {"selectedLayer": "Technology"}
                }
            }
        ]
    },

    # 6. Motivation Layer: 5A (req)
    {
        "id": "pkg-req",
        "code": "req",
        "name": "Requirements & Constraints Governance",
        "version": "1.0.0",
        "author": "BABOK / ArchiMate Motivation Standards",
        "license": "Open Standard",
        "description": "Standard ArchiMate 3.2 and BABOK requirements engineering tracking MoSCoW priorities, compliance categories, approval lifecycle, and architecture verification methods.",
        "icon_color": "purple",
        "package_type": "attribute_only",
        "standard_version": "ArchiMate 3.2 / BABOK",
        "is_default_active": False,
        "is_system": True,
        "items": [
            {
                "id": "item-req-moscow-priority",
                "name": "req_moscow_priority",
                "label": "MoSCoW Priority",
                "description": "Formal priority level of the architectural requirement (Must Have, Should Have, Could Have, Won't Have).",
                "element_type": "Requirement",
                "layer": "Motivation",
                "data_type": "select",
                "options": ["Must Have (P1)", "Should Have (P2)", "Could Have (P3)", "Won't Have (Deferred)"],
                "default_value": "Must Have (P1)",
                "is_required": False,
                "section": "Priority & Category",
                "sort_order": 1
            },
            {
                "id": "item-req-category",
                "name": "req_category",
                "label": "Requirement Type",
                "description": "Functional or non-functional requirement classification (Security, Performance, Compliance, Constraint).",
                "element_type": "*",
                "layer": "Motivation",
                "data_type": "select",
                "options": ["Functional Requirement", "Non-Functional / Quality Attribute", "Security & Compliance", "Architectural Constraint", "Interoperability"],
                "default_value": "Non-Functional / Quality Attribute",
                "is_required": False,
                "section": "Priority & Category",
                "sort_order": 2
            },
            {
                "id": "item-req-approval-status",
                "name": "req_approval_status",
                "label": "Approval Status",
                "description": "Approval lifecycle state in the architecture review board (Draft, In Review, Approved, Rejected).",
                "element_type": "*",
                "layer": "Motivation",
                "data_type": "select",
                "options": ["Draft / Proposed", "Under Architecture Review", "Approved / Committed", "Rejected"],
                "default_value": "Approved / Committed",
                "is_required": False,
                "section": "Lifecycle & Verification",
                "sort_order": 3
            },
            {
                "id": "item-req-verification-method",
                "name": "req_verification_method",
                "label": "Compliance Verification Method",
                "description": "Technical methodology used to validate requirement compliance (Automated Test, Audit, Demo).",
                "element_type": "*",
                "layer": "Motivation",
                "data_type": "select",
                "options": ["Automated Test / CI", "Architecture Compliance Audit", "Demonstration / Walkthrough", "Contract Inspection"],
                "default_value": "Architecture Compliance Audit",
                "is_required": False,
                "section": "Lifecycle & Verification",
                "sort_order": 4
            }
        ],
        "views": [
            {
                "id": "pkv-req-requirements-matrix",
                "view_key": "req_requirements_matrix",
                "name": "Architecture Requirements & Constraints Registry",
                "description": "Official registry of architectural requirements and technical constraints with MoSCoW priorities and approval status.",
                "category": "Motivation Governance",
                "view_type": "table",
                "icon": "CheckSquare",
                "target_hub": "architecture",
                "sort_order": 6,
                "target_types": ["Requirement", "Constraint", "Goal", "Assessment"],
                "config": {
                    "columns": [
                        {"field": "name", "label": "Requirement / Constraint", "type": "string", "sortable": True, "filterable": True},
                        {"field": "type", "label": "Type", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "req_moscow_priority", "label": "MoSCoW Priority", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "req_category", "label": "Category", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "req_approval_status", "label": "Approval Status", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "req_verification_method", "label": "Verification Method", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "documentation", "label": "Documentation", "type": "string", "sortable": False, "filterable": False}
                    ],
                    "default_sort": {"field": "name", "direction": "asc"},
                    "filter_config": {"selectedLayer": "Motivation"}
                }
            }
        ]
    },

    # 7. Implementation Layer: 6A (ppm)
    {
        "id": "pkg-ppm",
        "code": "ppm",
        "name": "Work Package & Roadmap Delivery",
        "version": "1.0.0",
        "author": "TOGAF Phase F / ArchiMate PPM Standards",
        "license": "Open Standard",
        "description": "Standard ArchiMate 3.2 Phase F migration and PPM package tracking WorkPackages, Deliverables, RAG indicators, target quarters, and estimated effort.",
        "icon_color": "rose",
        "package_type": "attribute_only",
        "standard_version": "ArchiMate 3.2 / TOGAF Phase F",
        "is_default_active": False,
        "is_system": True,
        "items": [
            {
                "id": "item-ppm-initiative-type",
                "name": "ppm_initiative_type",
                "label": "Initiative Type",
                "description": "Strategic or tactical nature of the project initiative (Change the Business, Run, Regulatory, Tech Debt).",
                "element_type": "WorkPackage",
                "layer": "Implementation",
                "data_type": "select",
                "options": ["Change the Business (Strategic)", "Run the Business (Operational)", "Regulatory / Compliance (Mandatory)", "Technical Debt Remediation"],
                "default_value": "Change the Business (Strategic)",
                "is_required": False,
                "section": "Project Initiation",
                "sort_order": 1
            },
            {
                "id": "item-ppm-delivery-status",
                "name": "ppm_delivery_status",
                "label": "Execution Status",
                "description": "Operational delivery phase of the implementation work package (Backlog, In Execution, Testing, Completed).",
                "element_type": "*",
                "layer": "Implementation",
                "data_type": "select",
                "options": ["Backlog / Proposed", "In Execution", "In Verification / Rollout", "Completed", "Suspended / Cancelled"],
                "default_value": "In Execution",
                "is_required": False,
                "section": "Delivery Status",
                "sort_order": 2
            },
            {
                "id": "item-ppm-rag-status",
                "name": "ppm_rag_status",
                "label": "RAG Indicator (Health Status)",
                "description": "Traffic light delivery health status (Green On Track, Amber At Risk, Red Blocked).",
                "element_type": "*",
                "layer": "Implementation",
                "data_type": "select",
                "options": ["Green (On Track)", "Amber (At Risk / Needs Action)", "Red (Blocked / Delayed)"],
                "default_value": "Green (On Track)",
                "is_required": False,
                "section": "Delivery Status",
                "sort_order": 3
            },
            {
                "id": "item-ppm-target-quarter",
                "name": "ppm_target_quarter",
                "label": "Target Quarter",
                "description": "Target completion quarter or deliverable release milestone.",
                "element_type": "*",
                "layer": "Implementation",
                "data_type": "select",
                "options": ["Q1", "Q2", "Q3", "Q4"],
                "default_value": "Q1",
                "is_required": False,
                "section": "Schedule & Effort",
                "sort_order": 4
            },
            {
                "id": "item-ppm-effort-mandays",
                "name": "ppm_effort_mandays",
                "label": "Estimated Effort (Person-Days)",
                "description": "Estimated total effort in person-days for the package implementation.",
                "element_type": "WorkPackage",
                "layer": "Implementation",
                "data_type": "number",
                "options": [],
                "default_value": "30",
                "is_required": False,
                "section": "Schedule & Effort",
                "sort_order": 5
            }
        ],
        "views": [
            {
                "id": "pkv-ppm-delivery-roadmap",
                "view_key": "ppm_delivery_roadmap",
                "name": "Work Package Delivery & Transformation Roadmap",
                "description": "Delivery progress, RAG health, timeframes, and estimated effort for architectural transformation initiatives.",
                "category": "Implementation & Roadmap",
                "view_type": "table",
                "icon": "Milestone",
                "target_hub": "business",
                "sort_order": 7,
                "target_types": ["WorkPackage", "Deliverable", "Plateau", "Gap"],
                "config": {
                    "columns": [
                        {"field": "name", "label": "Work Package / Deliverable", "type": "string", "sortable": True, "filterable": True},
                        {"field": "type", "label": "Type", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "ppm_initiative_type", "label": "Initiative Type", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "ppm_delivery_status", "label": "Delivery Status", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "ppm_rag_status", "label": "RAG Health", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "ppm_target_quarter", "label": "Quarter", "type": "badge", "sortable": True, "filterable": True},
                        {"field": "ppm_effort_mandays", "label": "Effort (Days)", "type": "number", "sortable": True, "filterable": True},
                        {"field": "documentation", "label": "Documentation", "type": "string", "sortable": False, "filterable": False}
                    ],
                    "default_sort": {"field": "name", "direction": "asc"},
                    "filter_config": {"selectedLayer": "Implementation"}
                }
            }
        ]
    }
]


def seed_archimate_standard_packages(db: Session):
    """
    Seeds standard ArchiMate layer packages (1A bcm, 2B bsc, 3B alc, 4A cld, 4B eol, 5A req, 6A ppm)
    into the database with is_default_active = False and is_system = True.
    """
    logger.info("Seeding ArchiMate standard layer packages...")
    for pkg_def in STANDARD_LAYER_PACKAGES:
        pkg_id = pkg_def["id"]
        pkg = db.query(AttributePackage).filter(AttributePackage.id == pkg_id).first()
        if not pkg:
            pkg = AttributePackage(
                id=pkg_id,
                code=pkg_def["code"],
                name=pkg_def["name"],
                version=pkg_def["version"],
                author=pkg_def["author"],
                license=pkg_def["license"],
                description=pkg_def["description"],
                icon_color=pkg_def["icon_color"],
                package_type=pkg_def["package_type"],
                standard_version=pkg_def["standard_version"],
                is_default_active=pkg_def["is_default_active"], # Explicitly False
                is_system=pkg_def["is_system"]
            )
            db.add(pkg)
            db.flush()
        else:
            pkg.code = pkg_def["code"]
            pkg.name = pkg_def["name"]
            pkg.version = pkg_def["version"]
            pkg.author = pkg_def["author"]
            pkg.license = pkg_def["license"]
            pkg.description = pkg_def["description"]
            pkg.icon_color = pkg_def["icon_color"]
            pkg.package_type = pkg_def["package_type"]
            pkg.standard_version = pkg_def["standard_version"]
            pkg.is_default_active = pkg_def["is_default_active"]
            pkg.is_system = pkg_def["is_system"]

        # Upsert items
        for item_def in pkg_def.get("items", []):
            item_id = item_def["id"]
            item = db.query(AttributePackageItem).filter(AttributePackageItem.id == item_id).first()
            if not item:
                item = AttributePackageItem(
                    id=item_id,
                    package_id=pkg.id,
                    name=item_def["name"],
                    label=item_def["label"],
                    description=item_def["description"],
                    element_type=item_def["element_type"],
                    layer=item_def["layer"],
                    data_type=item_def["data_type"],
                    options=item_def.get("options", []),
                    default_value=item_def.get("default_value"),
                    is_required=item_def.get("is_required", False),
                    section=item_def.get("section", "General"),
                    sort_order=item_def.get("sort_order", 0)
                )
                db.add(item)
            else:
                item.name = item_def["name"]
                item.label = item_def["label"]
                item.description = item_def["description"]
                item.element_type = item_def["element_type"]
                item.layer = item_def["layer"]
                item.data_type = item_def["data_type"]
                item.options = item_def.get("options", [])
                item.default_value = item_def.get("default_value")
                item.is_required = item_def.get("is_required", False)
                item.section = item_def.get("section", "General")
                item.sort_order = item_def.get("sort_order", 0)

        # Upsert views
        for v_def in pkg_def.get("views", []):
            v_id = v_def["id"]
            view = db.query(PackageView).filter(PackageView.id == v_id).first()
            if not view:
                view = PackageView(
                    id=v_id,
                    package_id=pkg.id,
                    model_id=None,
                    view_key=v_def["view_key"],
                    name=v_def["name"],
                    description=v_def["description"],
                    category=v_def["category"],
                    view_type=v_def["view_type"],
                    icon=v_def["icon"],
                    target_hub=v_def.get("target_hub", "business"),
                    sort_order=v_def.get("sort_order", 0),
                    target_types=v_def.get("target_types", []),
                    target_stereotypes=[],
                    config=v_def["config"],
                    is_global=True,
                    is_active=True,
                    author="Lead Enterprise Architect"
                )
                db.add(view)
            else:
                view.package_id = pkg.id
                view.view_key = v_def["view_key"]
                view.name = v_def["name"]
                view.description = v_def["description"]
                view.category = v_def["category"]
                view.view_type = v_def["view_type"]
                view.icon = v_def["icon"]
                view.target_hub = v_def.get("target_hub", "business")
                view.sort_order = v_def.get("sort_order", 0)
                view.target_types = v_def.get("target_types", [])
                view.config = v_def["config"]
                view.is_global = True

    db.commit()
    logger.info("Standard ArchiMate layer packages seeded successfully.")


def seed_easybank_layer_elements_and_views(db: Session, model_id: str = "sample-easybank-ea"):
    """
    Enriches the EASY model ('sample-easybank-ea') with:
    1. Active links to all standard packages (bcm, bsc, alc, cld, eol, req, ppm).
    2. Comprehensive elements and relationships across all 6 ArchiMate layers, with rich properties.
    3. Dedicated graphical diagram views in ArchimateView and ArchiSchema for every layer.
    """
    model = db.query(ModelWorkspace).filter(
        (ModelWorkspace.id == model_id) | (ModelWorkspace.code == "EASY")
    ).first()
    if not model:
        logger.warning(f"Model {model_id} / EASY not found; skipping EASY enrichment.")
        return

    m_id = model.id
    logger.info(f"Enriching model {m_id} (code={model.code}) with ArchiMate layers and packages...")

    # 1. Activate the 7 standard packages on EASY
    pkg_ids = [p["id"] for p in STANDARD_LAYER_PACKAGES]
    for p_id in pkg_ids:
        link = db.query(WorkspaceAttributePackage).filter(
            WorkspaceAttributePackage.model_id == m_id,
            WorkspaceAttributePackage.package_id == p_id
        ).first()
        if not link:
            db.add(WorkspaceAttributePackage(
                id=f"wap-{m_id}-{p_id.replace('pkg-', '')}",
                model_id=m_id,
                package_id=p_id
            ))
    db.commit()

    # 2. Enrich & Add Elements across all 6 Layers
    # Helper to upsert element
    def upsert_elem(elem_id: str, name: str, elem_type: str, layer: str, doc: str, props: Dict[str, Any]):
        el = db.query(ArchimateElement).filter(
            ArchimateElement.id == elem_id,
            ArchimateElement.model_id == m_id
        ).first()
        if not el:
            el = ArchimateElement(
                id=elem_id,
                model_id=m_id,
                name=name,
                type=elem_type,
                layer=layer,
                documentation=doc,
                properties=props
            )
            db.add(el)
        else:
            el.name = name
            el.type = elem_type
            el.layer = layer
            el.documentation = doc
            existing_p = dict(el.properties or {})
            existing_p.update(props)
            el.properties = existing_p
        return el

    # Helper to upsert relationship
    def upsert_rel(rel_id: str, source_id: str, target_id: str, rel_type: str, name: str = "", doc: str = ""):
        rel = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.id == rel_id,
            ArchimateRelationship.model_id == m_id
        ).first()
        if not rel:
            rel = ArchimateRelationship(
                id=rel_id,
                model_id=m_id,
                source_id=source_id,
                target_id=target_id,
                type=rel_type,
                name=name,
                documentation=doc
            )
            db.add(rel)
        else:
            rel.source_id = source_id
            rel.target_id = target_id
            rel.type = rel_type
            rel.name = name
            rel.documentation = doc
        return rel

    # --- LAYER 1: STRATEGY (bcm) ---
    upsert_elem("cap-cust-mgmt", "Customer Relationship Management", "Capability", "Strategy",
                "Comprehensive 360-degree customer relationship and master data management.",
                {"bcm_maturity_level": "4 - Managed", "bcm_target_maturity": "5 - Optimizing",
                 "bcm_strategic_fit": "Strategic Differentiator", "bcm_investment_stance": "Invest & Grow"})

    upsert_elem("cap-payments", "Payment & Transaction Processing", "Capability", "Strategy",
                "Execution and reconciliation of instant payments and SEPA credit transfers.",
                {"bcm_maturity_level": "4 - Managed", "bcm_target_maturity": "5 - Optimizing",
                 "bcm_strategic_fit": "Strategic Differentiator", "bcm_investment_stance": "Invest & Grow"})

    upsert_elem("cap-claims", "Claims & Dispute Management", "Capability", "Strategy",
                "Management of insurance claims, customer disputes, and card chargebacks.",
                {"bcm_maturity_level": "3 - Defined", "bcm_target_maturity": "4 - Managed",
                 "bcm_strategic_fit": "Business Core", "bcm_investment_stance": "Maintain & Protect"})

    upsert_elem("cap-fraud", "Fraud Detection & Prevention", "Capability", "Strategy",
                "Real-time transactional analysis using machine learning anti-fraud models.",
                {"bcm_maturity_level": "4 - Managed", "bcm_target_maturity": "5 - Optimizing",
                 "bcm_strategic_fit": "Strategic Differentiator", "bcm_investment_stance": "Invest & Grow"})

    upsert_elem("cap-core-acc", "Core Account & Ledger Management", "Capability", "Strategy",
                "General ledger, chart of accounts, and current account management.",
                {"bcm_maturity_level": "2 - Repeatable", "bcm_target_maturity": "4 - Managed",
                 "bcm_strategic_fit": "Business Core", "bcm_investment_stance": "Rationalize / Consolidate"})

    upsert_elem("cap-hr", "Human Capital & Payroll", "Capability", "Strategy",
                "Human resources management, employee payroll, and talent recruitment.",
                {"bcm_maturity_level": "3 - Defined", "bcm_target_maturity": "3 - Defined",
                 "bcm_strategic_fit": "Commodity", "bcm_investment_stance": "Maintain & Protect"})

    upsert_elem("cap-doc", "Document & Archive Management", "Capability", "Strategy",
                "Regulatory digital archiving, electronic signatures, and contract management.",
                {"bcm_maturity_level": "3 - Defined", "bcm_target_maturity": "4 - Managed",
                 "bcm_strategic_fit": "Operational Support", "bcm_investment_stance": "Maintain & Protect"})

    upsert_elem("res-cloud-talent", "Cloud Architecture Competence Center", "Resource", "Strategy",
                "Specialized technical staff and certified enterprise cloud solution architects.",
                {"bcm_maturity_level": "4 - Managed", "bcm_target_maturity": "5 - Optimizing",
                 "bcm_strategic_fit": "Strategic Differentiator", "bcm_investment_stance": "Invest & Grow"})

    upsert_elem("res-tier4-dc", "Tier-IV Dual Resilient Datacenter", "Resource", "Strategy",
                "High-availability physical and virtualized computing facility with 99.995% uptime availability.",
                {"bcm_maturity_level": "4 - Managed", "bcm_target_maturity": "4 - Managed",
                 "bcm_strategic_fit": "Business Core", "bcm_investment_stance": "Maintain & Protect"})

    upsert_elem("vst-retail-journey", "End-to-End Retail Customer Value Stream", "ValueStream", "Strategy",
                "Seamless digital onboarding, payment processing, and account management experience for banking consumers.",
                {})

    # --- LAYER 2: BUSINESS (bsc) ---
    upsert_elem("prod-smart-checking", "EasyBank Smart Checking Account", "Product", "Business",
                "Complete consumer checking account bundle including digital card, IBAN, and instant payments.",
                {"bsc_customer_segment": "Retail / Consumer (B2C)", "bsc_lifecycle_status": "General Availability (GA)",
                 "bsc_delivery_channel": "Digital Web / Mobile", "bsc_contract_sla": "Gold (99.99%)"})

    upsert_elem("prod-green-mortgage", "Green Energy Residential Mortgage", "Product", "Business",
                "Subsidized long-term residential mortgage for energy-efficient homes.",
                {"bsc_customer_segment": "Retail / Consumer (B2C)", "bsc_lifecycle_status": "General Availability (GA)",
                 "bsc_delivery_channel": "Physical Branch / Store", "bsc_contract_sla": "Silver (99.9%)"})

    upsert_elem("prod-merchant-pay", "Omnichannel Merchant Payment Gateway", "Product", "Business",
                "Enterprise payment acquiring platform for digital e-commerce merchants and POS terminals.",
                {"bsc_customer_segment": "Corporate / Enterprise (B2B)", "bsc_lifecycle_status": "General Availability (GA)",
                 "bsc_delivery_channel": "Open API / Partner Portal", "bsc_contract_sla": "Gold (99.99%)"})

    upsert_elem("bsrv-digital-onboarding", "Customer Digital Onboarding Service", "BusinessService", "Business",
                "Automated digital identity verification, KYC, and AML compliance checking for new customers.",
                {"bsc_delivery_channel": "Digital Web / Mobile", "bsc_customer_segment": "Retail / Consumer (B2C)",
                 "bsc_lifecycle_status": "General Availability (GA)", "bsc_contract_sla": "Silver (99.9%)"})

    upsert_elem("bsrv-instant-payment", "SEPA Instant Payment Processing Service", "BusinessService", "Business",
                "Real-time round-the-clock payment clearance and interbank settlement under 5 seconds.",
                {"bsc_delivery_channel": "Open API / Partner Portal", "bsc_customer_segment": "Retail / Consumer (B2C)",
                 "bsc_lifecycle_status": "General Availability (GA)", "bsc_contract_sla": "Gold (99.99%)"})

    upsert_elem("bsrv-fraud-shield", "Real-Time AI Fraud Prevention Service", "BusinessService", "Business",
                "Automated transaction scoring and proactive fraud alerting across card and wire payment rails.",
                {"bsc_delivery_channel": "Open API / Partner Portal", "bsc_customer_segment": "Corporate / Enterprise (B2B)",
                 "bsc_lifecycle_status": "General Availability (GA)", "bsc_contract_sla": "Gold (99.99%)"})

    upsert_elem("cnt-account-agreement", "General Banking Terms & Conditions Agreement", "Contract", "Business",
                "Governing legal contract and standard banking disclosure for retail checking accounts.",
                {"bsc_contract_sla": "Silver (99.9%)", "bsc_customer_segment": "Retail / Consumer (B2C)",
                 "bsc_lifecycle_status": "General Availability (GA)"})

    # --- LAYER 3: APPLICATION (alc) ---
    upsert_elem("app-cloud-core", "Thought Machine Vault Core", "ApplicationComponent", "Application",
                "Cloud-native core banking engine for real-time accounts and balance processing.",
                {"alc_hosting_model": "Cloud PaaS / Containers", "alc_architecture_pattern": "Microservices",
                 "alc_tech_debt_level": "Negligible / Modern", "alc_code_quality_grade": "A - High Maintainability"})

    upsert_elem("app-salesforce", "Salesforce Financial Services Cloud", "ApplicationComponent", "Application",
                "Cloud CRM platform for financial advisors, customer support, and lead tracking.",
                {"alc_hosting_model": "Cloud SaaS", "alc_architecture_pattern": "Modular Monolith",
                 "alc_tech_debt_level": "Low / Manageable", "alc_code_quality_grade": "A - High Maintainability"})

    upsert_elem("app-stripe-engine", "Stripe Modern Payment Gateway", "ApplicationComponent", "Application",
                "Modern payment gateway for card acquiring and digital commerce transactions.",
                {"alc_hosting_model": "Cloud SaaS", "alc_architecture_pattern": "Microservices",
                 "alc_tech_debt_level": "Negligible / Modern", "alc_code_quality_grade": "A - High Maintainability"})

    upsert_elem("app-feedzai-fraud", "Feedzai Real-time Fraud Engine", "ApplicationComponent", "Application",
                "AI/ML real-time transaction scoring and fraud prevention system.",
                {"alc_hosting_model": "Cloud PaaS / Containers", "alc_architecture_pattern": "Event-Driven Architecture (EDA)",
                 "alc_tech_debt_level": "Low / Manageable", "alc_code_quality_grade": "A - High Maintainability"})

    upsert_elem("app-legacy-ledger", "Mainframe AS400 Ledger", "ApplicationComponent", "Application",
                "Historical core general ledger running on IBM AS400 mainframe.",
                {"alc_hosting_model": "Legacy Mainframe", "alc_architecture_pattern": "Traditional Monolith",
                 "alc_tech_debt_level": "Critical / Blocking", "alc_code_quality_grade": "D - Hard to Maintain / Obsolete"})

    upsert_elem("app-legacy-crm", "Legacy Oracle CRM 10g", "ApplicationComponent", "Application",
                "Internal legacy CRM retained for corporate customer historical records.",
                {"alc_hosting_model": "On-Premises Private DC", "alc_architecture_pattern": "Traditional Monolith",
                 "alc_tech_debt_level": "High / Urgent Attention", "alc_code_quality_grade": "C - Mediocre / Needs Refactoring"})

    upsert_elem("app-workday", "Workday HCM & Payroll", "ApplicationComponent", "Application",
                "Human capital management, employee self-service, and payroll system.",
                {"alc_hosting_model": "Cloud SaaS", "alc_architecture_pattern": "Modular Monolith",
                 "alc_tech_debt_level": "Low / Manageable", "alc_code_quality_grade": "B - Good Quality"})

    upsert_elem("app-alfresco-doc", "Alfresco Enterprise Content", "ApplicationComponent", "Application",
                "Enterprise document repository for digitally signed contracts and records.",
                {"alc_hosting_model": "Cloud PaaS / Containers", "alc_architecture_pattern": "Modular Monolith",
                 "alc_tech_debt_level": "Medium / Planned Refactoring", "alc_code_quality_grade": "B - Good Quality"})

    # --- LAYER 4: TECHNOLOGY (cld & eol) ---
    upsert_elem("tech-aws-cluster", "AWS EKS Kubernetes Cluster (eu-west-1)", "Node", "Technology",
                "Managed cloud Kubernetes cluster hosting core application microservices.",
                {"cld_environment_tier": "Production (PRD)", "cld_cloud_provider": "Amazon Web Services (AWS)",
                 "cld_ha_pattern": "Multi-Region Active-Active", "cld_compute_form": "Kubernetes Pod / Container Engine",
                 "eol_vendor_name": "Amazon Web Services", "eol_installed_version": "v1.30",
                 "eol_support_status": "Mainstream Vendor Support", "eol_remediation_strategy": "In-Place Upgrade"})

    upsert_elem("tech-rds-postgres", "AWS Aurora PostgreSQL Enterprise", "SystemSoftware", "Technology",
                "High-availability managed relational database cluster with cross-region replication.",
                {"cld_environment_tier": "Production (PRD)", "cld_cloud_provider": "Amazon Web Services (AWS)",
                 "cld_ha_pattern": "Multi-Region Active-Active", "cld_compute_form": "Serverless / Managed Service",
                 "eol_vendor_name": "PostgreSQL Community / AWS", "eol_installed_version": "16.2",
                 "eol_support_status": "Mainstream Vendor Support", "eol_remediation_strategy": "In-Place Upgrade"})

    upsert_elem("tech-ibm-z15", "IBM z15 Enterprise Mainframe", "Node", "Technology",
                "Headquarters on-premise mainframe infrastructure hosting legacy core banking batch processing.",
                {"cld_environment_tier": "Production (PRD)", "cld_cloud_provider": "Bare Metal / Colocation",
                 "cld_ha_pattern": "Active-Passive Automatic Failover", "cld_compute_form": "Physical Dedicated Server",
                 "eol_vendor_name": "IBM Corporation", "eol_installed_version": "z/OS v2.4",
                 "eol_support_status": "Extended Paid Support", "eol_end_date": "2026-12-31",
                 "eol_remediation_strategy": "Retire & Replace"})

    upsert_elem("tech-vmware-dc", "VMware vSphere On-Prem Datacenter", "Node", "Technology",
                "Private datacenter server virtualization platform for internal corporate workloads.",
                {"cld_environment_tier": "Production (PRD)", "cld_cloud_provider": "Private Cloud On-Prem (OpenStack/VMware)",
                 "cld_ha_pattern": "Active-Passive Automatic Failover", "cld_compute_form": "Virtual Machine (IaaS)",
                 "eol_vendor_name": "Broadcom / VMware", "eol_installed_version": "vSphere 7.0u3",
                 "eol_support_status": "End of Support (EoS)", "eol_end_date": "2025-10-02",
                 "eol_remediation_strategy": "Platform Rehost / Replatform"})

    upsert_elem("tech-kafka-eventmesh", "Apache Kafka Confluent Enterprise", "SystemSoftware", "Technology",
                "High-throughput distributed event streaming platform connecting payments and fraud scoring.",
                {"cld_environment_tier": "Production (PRD)", "cld_cloud_provider": "Amazon Web Services (AWS)",
                 "cld_ha_pattern": "Multi-Region Active-Active", "cld_compute_form": "Kubernetes Pod / Container Engine",
                 "eol_vendor_name": "Confluent / Apache", "eol_installed_version": "3.7.0",
                 "eol_support_status": "Mainstream Vendor Support", "eol_remediation_strategy": "In-Place Upgrade"})

    upsert_elem("tech-redis-cache", "Redis Enterprise In-Memory Cache", "SystemSoftware", "Technology",
                "Sub-millisecond latency in-memory data store for live session state and idempotency keys.",
                {"cld_environment_tier": "Production (PRD)", "cld_cloud_provider": "Amazon Web Services (AWS)",
                 "cld_ha_pattern": "Multi-Region Active-Active", "cld_compute_form": "Kubernetes Pod / Container Engine",
                 "eol_vendor_name": "Redis Ltd", "eol_installed_version": "7.2.4",
                 "eol_support_status": "Mainstream Vendor Support", "eol_remediation_strategy": "In-Place Upgrade"})

    # --- LAYER 5: MOTIVATION (req) ---
    upsert_elem("goal-cloud-resilience", "Achieve 99.99% Cloud Resilience & High Availability", "Goal", "Motivation",
                "Enterprise strategic goal to eliminate single points of failure across all tier-1 banking systems.",
                {})

    upsert_elem("goal-realtime-banking", "Instant Sub-Second Payments Processing", "Goal", "Motivation",
                "Strategic mandate to enable real-time payment settlement and balance updates for all customers.",
                {})

    upsert_elem("goal-regulatory-compliance", "Zero-Deficiency Regulatory & DORA Compliance", "Goal", "Motivation",
                "Complete operational compliance with European Banking Authority, DORA, and PSD2 regulatory frameworks.",
                {})

    upsert_elem("req-dora-dr-rto", "DORA Mission-Critical Recovery Time Objective (RTO < 2h)", "Requirement", "Motivation",
                "Mandatory maximum recovery time objective under 2 hours with automated cross-region failover.",
                {"req_moscow_priority": "Must Have (P1)", "req_category": "Security & Compliance",
                 "req_approval_status": "Approved / Committed", "req_verification_method": "Automated Test / CI"})

    upsert_elem("req-psd2-sca", "PSD2 Strong Customer Authentication & Dynamic Linking", "Requirement", "Motivation",
                "Multi-factor biometrics and dynamic transaction linking compliant with RTS PSD2.",
                {"req_moscow_priority": "Must Have (P1)", "req_category": "Security & Compliance",
                 "req_approval_status": "Approved / Committed", "req_verification_method": "Architecture Compliance Audit"})

    upsert_elem("req-sepa-instant-lat", "SEPA Instant Processing Latency Under 5 Seconds", "Requirement", "Motivation",
                "End-to-end clearing and notification latency guaranteed below 5 seconds for 99.9% of transactions.",
                {"req_moscow_priority": "Must Have (P1)", "req_category": "Non-Functional / Quality Attribute",
                 "req_approval_status": "Approved / Committed", "req_verification_method": "Automated Test / CI"})

    upsert_elem("con-iso20022-pacs", "Strict ISO 20022 pacs.008 XML Message Format", "Constraint", "Motivation",
                "Mandatory compliance with EPC SEPA Instant Credit Transfer Scheme Rulebook pacs.008 schema.",
                {"req_moscow_priority": "Must Have (P1)", "req_category": "Architectural Constraint",
                 "req_approval_status": "Approved / Committed", "req_verification_method": "Architecture Compliance Audit"})

    upsert_elem("ass-legacy-mtbf", "Mainframe AS400 Outage Risk & Maintenance Assessment", "Assessment", "Motivation",
                "Technical risk assessment highlighting unacceptable incident MTTR and escalating license fees.",
                {"req_moscow_priority": "Must Have (P1)", "req_category": "Architectural Constraint",
                 "req_approval_status": "Approved / Committed", "req_verification_method": "Contract Inspection"})

    # --- LAYER 6: IMPLEMENTATION & MIGRATION (ppm) ---
    upsert_elem("wp-vaultcore-migration", "Core Banking Cloud Migration & Thought Machine Rollout", "WorkPackage", "Implementation",
                "Strategic transformation program migrating account balances and real-time ledger to Vault Core.",
                {"ppm_initiative_type": "Change the Business (Strategic)", "ppm_delivery_status": "In Execution",
                 "ppm_rag_status": "Green (On Track)", "ppm_target_quarter": "Q3", "ppm_effort_mandays": 180})

    upsert_elem("wp-instant-pay-sepa", "SEPA Instant Payments ISO 20022 Gateway Implementation", "WorkPackage", "Implementation",
                "Deployment of real-time event-driven gateway connecting to interbank TIPS and RT1 payment rails.",
                {"ppm_initiative_type": "Regulatory / Compliance (Mandatory)", "ppm_delivery_status": "In Execution",
                 "ppm_rag_status": "Green (On Track)", "ppm_target_quarter": "Q2", "ppm_effort_mandays": 90})

    upsert_elem("wp-dora-resilience", "DORA Operational Resilience & Disaster Recovery Hardening", "WorkPackage", "Implementation",
                "Full-stack multi-region disaster recovery simulation and continuous chaos engineering testing.",
                {"ppm_initiative_type": "Regulatory / Compliance (Mandatory)", "ppm_delivery_status": "In Execution",
                 "ppm_rag_status": "Amber (At Risk / Needs Action)", "ppm_target_quarter": "Q4", "ppm_effort_mandays": 120})

    upsert_elem("wp-as400-sunset", "Mainframe AS400 Decommissioning & Archiving", "WorkPackage", "Implementation",
                "Regulatory cold data purge, legal document archive export, and hardware power-down.",
                {"ppm_initiative_type": "Technical Debt Remediation", "ppm_delivery_status": "Backlog / Proposed",
                 "ppm_rag_status": "Green (On Track)", "ppm_target_quarter": "Q4", "ppm_effort_mandays": 60})

    upsert_elem("del-vaultcore-golive", "Thought Machine Vault Core Production Release v2.0", "Deliverable", "Implementation",
                "Production-ready operational cloud-native banking engine handling live retail transaction accounts.",
                {"ppm_delivery_status": "In Execution", "ppm_rag_status": "Green (On Track)",
                 "ppm_target_quarter": "Q3", "ppm_initiative_type": "Change the Business (Strategic)"})

    upsert_elem("del-kafka-mesh-prod", "Enterprise Event Streaming Backbone & Gateway", "Deliverable", "Implementation",
                "Multi-AZ Kafka event cluster in production handling SEPA transaction streams.",
                {"ppm_delivery_status": "Completed", "ppm_rag_status": "Green (On Track)",
                 "ppm_target_quarter": "Q1", "ppm_initiative_type": "Change the Business (Strategic)"})

    upsert_elem("plt-baseline-2024", "Hybrid Banking Baseline 2024 (As-Is)", "Plateau", "Implementation",
                "Current enterprise architectural state with dual-core hybrid on-premise mainframe and cloud apps.",
                {})

    upsert_elem("plt-target-2026", "Cloud-Native Enterprise Banking 2026 (To-Be)", "Plateau", "Implementation",
                "Target fully automated cloud architecture with complete mainframe decommissioning and real-time APIs.",
                {})

    upsert_elem("gap-core-legacy", "Legacy Monolithic Mainframe Dependency Gap", "Gap", "Implementation",
                "Architectural gap between monolithic batch ledger and real-time cloud-native microservices.",
                {})

    # 3. Create Key Relationships
    # Strategy -> Business / App Realization
    upsert_rel("rel-strat-1", "cap-payments", "vst-retail-journey", "AggregationRelationship", "Payment Stage")
    upsert_rel("rel-strat-2", "res-cloud-talent", "cap-core-acc", "AssignmentRelationship", "Architectural Team")
    upsert_rel("rel-strat-3", "app-cloud-core", "cap-core-acc", "RealizationRelationship", "Cloud Core Realization")
    upsert_rel("rel-strat-4", "app-stripe-engine", "cap-payments", "RealizationRelationship", "Gateway Realization")
    upsert_rel("rel-strat-5", "app-feedzai-fraud", "cap-fraud", "RealizationRelationship", "AI Fraud Realization")

    # Business Products & Services Realization
    upsert_rel("rel-biz-1", "prod-smart-checking", "bsrv-digital-onboarding", "AggregationRelationship", "Includes Onboarding")
    upsert_rel("rel-biz-2", "prod-smart-checking", "bsrv-instant-payment", "AggregationRelationship", "Includes Instant Pay")
    upsert_rel("rel-biz-3", "cnt-account-agreement", "prod-smart-checking", "AssociationRelationship", "Account Contract")
    upsert_rel("rel-biz-4", "proc-onboarding", "bsrv-digital-onboarding", "RealizationRelationship", "Realizes Digital KYC")
    upsert_rel("rel-biz-5", "proc-send-payment", "bsrv-instant-payment", "RealizationRelationship", "Realizes Clearing")
    upsert_rel("rel-biz-6", "bsrv-instant-payment", "actor-client", "ServingRelationship", "Serves Bank Customer")

    # App -> Tech Realization & Deployment
    upsert_rel("rel-tech-1", "tech-aws-cluster", "app-cloud-core", "RealizationRelationship", "Hosts Container Pods")
    upsert_rel("rel-tech-2", "tech-rds-postgres", "app-cloud-core", "ServingRelationship", "Provides Ledger DB")
    upsert_rel("rel-tech-3", "tech-kafka-eventmesh", "app-stripe-engine", "ServingRelationship", "Publishes Events")
    upsert_rel("rel-tech-4", "tech-kafka-eventmesh", "app-feedzai-fraud", "ServingRelationship", "Consumes Event Stream")
    upsert_rel("rel-tech-5", "tech-ibm-z15", "app-legacy-ledger", "RealizationRelationship", "Hosts AS400 Batch")

    # Motivation Realization
    upsert_rel("rel-mot-1", "req-sepa-instant-lat", "goal-realtime-banking", "RealizationRelationship", "Enables Sub-second Goal")
    upsert_rel("rel-mot-2", "req-dora-dr-rto", "goal-cloud-resilience", "RealizationRelationship", "Satisfies Resiliency Mandate")
    upsert_rel("rel-mot-3", "req-psd2-sca", "goal-regulatory-compliance", "RealizationRelationship", "Complies with PSD2")
    upsert_rel("rel-mot-4", "app-cloud-core", "req-sepa-instant-lat", "RealizationRelationship", "Meets Latency SLA")
    upsert_rel("rel-mot-5", "tech-aws-cluster", "req-dora-dr-rto", "RealizationRelationship", "Multi-AZ Resilience")
    upsert_rel("rel-mot-6", "con-iso20022-pacs", "app-stripe-engine", "AssociationRelationship", "XML Schema Constraint")
    upsert_rel("rel-mot-7", "ass-legacy-mtbf", "app-legacy-ledger", "AssociationRelationship", "Mainframe Outage Risk")

    # Implementation & Migration Delivery
    upsert_rel("rel-ppm-1", "wp-vaultcore-migration", "del-vaultcore-golive", "RealizationRelationship", "Delivers Production Release")
    upsert_rel("rel-ppm-2", "wp-instant-pay-sepa", "del-kafka-mesh-prod", "RealizationRelationship", "Delivers Streaming Infrastructure")
    upsert_rel("rel-ppm-3", "del-vaultcore-golive", "app-cloud-core", "RealizationRelationship", "Deploys Vault Core")
    upsert_rel("rel-ppm-4", "wp-vaultcore-migration", "wp-as400-sunset", "TriggeringRelationship", "Triggers Mainframe Sunset")
    upsert_rel("rel-ppm-5", "wp-vaultcore-migration", "gap-core-legacy", "AssociationRelationship", "Closes Core Banking Gap")
    upsert_rel("rel-ppm-6", "plt-baseline-2024", "app-legacy-ledger", "AggregationRelationship", "Includes Baseline Mainframe")
    upsert_rel("rel-ppm-7", "plt-target-2026", "app-cloud-core", "AggregationRelationship", "Includes Target Cloud Core")

    db.commit()

    # 4. Create Dedicated Layer Diagram Views in ArchimateView & ArchiSchema
    logger.info("Generating dedicated visual diagram views for every layer in EASY...")

    # Folder for schemas
    folder = db.query(SchemaFolder).filter(
        SchemaFolder.model_id == m_id,
        SchemaFolder.name == "Standard Layer Viewpoints"
    ).first()
    if not folder:
        folder = SchemaFolder(
            id=f"folder-layer-viewpoints-{m_id}",
            model_id=m_id,
            name="Standard Layer Viewpoints",
            order_index=10
        )
        db.add(folder)
        db.commit()

    layer_views_def = [
        # Strategy View
        {
            "id": "view-strategy-capability-map",
            "name": "1. Strategy Layer — Capability Maturity & Strategic Alignment",
            "viewpoint": "Strategy / Capability Map",
            "doc": "Strategy layer viewpoint displaying enterprise capabilities, CMMI maturity ratings, strategic fit, resources, and value stream.",
            "nodes": [
                {"id": "n-vst", "element_id": "vst-retail-journey", "name": "End-to-End Retail Customer Value Stream", "x": 100, "y": 40, "width": 780, "height": 65},
                {"id": "n-cap-pmt", "element_id": "cap-payments", "name": "Payment & Transaction Processing", "x": 100, "y": 140, "width": 240, "height": 75},
                {"id": "n-cap-frd", "element_id": "cap-fraud", "name": "Fraud Detection & Prevention", "x": 370, "y": 140, "width": 240, "height": 75},
                {"id": "n-cap-acc", "element_id": "cap-core-acc", "name": "Core Account & Ledger Management", "x": 640, "y": 140, "width": 240, "height": 75},
                {"id": "n-cap-crm", "element_id": "cap-cust-mgmt", "name": "Customer Relationship Management", "x": 100, "y": 240, "width": 240, "height": 75},
                {"id": "n-cap-clm", "element_id": "cap-claims", "name": "Claims & Dispute Management", "x": 370, "y": 240, "width": 240, "height": 75},
                {"id": "n-cap-doc", "element_id": "cap-doc", "name": "Document & Archive Management", "x": 640, "y": 240, "width": 240, "height": 75},
                {"id": "n-res-talent", "element_id": "res-cloud-talent", "name": "Cloud Architecture Competence Center", "x": 230, "y": 350, "width": 250, "height": 70},
                {"id": "n-res-dc", "element_id": "res-tier4-dc", "name": "Tier-IV Dual Resilient Datacenter", "x": 510, "y": 350, "width": 250, "height": 70}
            ],
            "connections": [
                {"id": "c-s1", "relationship_id": "rel-strat-1", "source_node_id": "n-cap-pmt", "target_node_id": "n-vst"},
                {"id": "c-s2", "relationship_id": "rel-strat-2", "source_node_id": "n-res-talent", "target_node_id": "n-cap-acc"}
            ]
        },

        # Business View
        {
            "id": "view-business-service-product-catalog",
            "name": "2. Business Layer — Product & Business Service Catalog",
            "viewpoint": "Service Realization Viewpoint",
            "doc": "Business layer catalog showing products, contracts, omnichannel business services, and realization by business processes.",
            "nodes": [
                {"id": "n-prod-chk", "element_id": "prod-smart-checking", "name": "EasyBank Smart Checking Account", "x": 100, "y": 50, "width": 260, "height": 75},
                {"id": "n-prod-pay", "element_id": "prod-merchant-pay", "name": "Omnichannel Merchant Payment Gateway", "x": 400, "y": 50, "width": 260, "height": 75},
                {"id": "n-cnt-agr", "element_id": "cnt-account-agreement", "name": "General Banking Terms Agreement", "x": 700, "y": 50, "width": 240, "height": 75},
                {"id": "n-bsrv-onb", "element_id": "bsrv-digital-onboarding", "name": "Customer Digital Onboarding Service", "x": 100, "y": 160, "width": 260, "height": 70},
                {"id": "n-bsrv-pmt", "element_id": "bsrv-instant-payment", "name": "SEPA Instant Payment Service", "x": 400, "y": 160, "width": 260, "height": 70},
                {"id": "n-bsrv-frd", "element_id": "bsrv-fraud-shield", "name": "Real-Time AI Fraud Prevention Service", "x": 700, "y": 160, "width": 240, "height": 70},
                {"id": "n-proc-onb", "element_id": "proc-onboarding", "name": "Customer Digital Onboarding", "x": 100, "y": 270, "width": 260, "height": 65},
                {"id": "n-proc-pmt", "element_id": "proc-send-payment", "name": "Process SEPA Payment", "x": 400, "y": 270, "width": 260, "height": 65},
                {"id": "n-act-client", "element_id": "actor-client", "name": "Bank Customer", "x": 700, "y": 270, "width": 240, "height": 65}
            ],
            "connections": [
                {"id": "c-b1", "relationship_id": "rel-biz-1", "source_node_id": "n-prod-chk", "target_node_id": "n-bsrv-onb"},
                {"id": "c-b2", "relationship_id": "rel-biz-2", "source_node_id": "n-prod-chk", "target_node_id": "n-bsrv-pmt"},
                {"id": "c-b3", "relationship_id": "rel-biz-3", "source_node_id": "n-cnt-agr", "target_node_id": "n-prod-chk"},
                {"id": "c-b4", "relationship_id": "rel-biz-4", "source_node_id": "n-proc-onb", "target_node_id": "n-bsrv-onb"},
                {"id": "c-b5", "relationship_id": "rel-biz-5", "source_node_id": "n-proc-pmt", "target_node_id": "n-bsrv-pmt"},
                {"id": "c-b6", "relationship_id": "rel-biz-6", "source_node_id": "n-bsrv-pmt", "target_node_id": "n-act-client"}
            ]
        },

        # Application View
        {
            "id": "view-application-architecture-health",
            "name": "3. Application Layer — Architecture Patterns & Technical Health",
            "viewpoint": "Application Cooperation Viewpoint",
            "doc": "Application layer viewpoint showing cloud-native microservices, legacy mainframe monoliths, and technical debt assessments.",
            "nodes": [
                {"id": "n-app-core", "element_id": "app-cloud-core", "name": "Thought Machine Vault Core", "x": 100, "y": 50, "width": 240, "height": 75},
                {"id": "n-app-sfdc", "element_id": "app-salesforce", "name": "Salesforce Financial Services Cloud", "x": 380, "y": 50, "width": 240, "height": 75},
                {"id": "n-app-strp", "element_id": "app-stripe-engine", "name": "Stripe Modern Payment Gateway", "x": 660, "y": 50, "width": 240, "height": 75},
                {"id": "n-app-frd", "element_id": "app-feedzai-fraud", "name": "Feedzai Real-time Fraud Engine", "x": 100, "y": 170, "width": 240, "height": 75},
                {"id": "n-app-doc", "element_id": "app-alfresco-doc", "name": "Alfresco Enterprise Content", "x": 380, "y": 170, "width": 240, "height": 75},
                {"id": "n-app-wday", "element_id": "app-workday", "name": "Workday HCM & Payroll", "x": 660, "y": 170, "width": 240, "height": 75},
                {"id": "n-app-as400", "element_id": "app-legacy-ledger", "name": "Mainframe AS400 Ledger", "x": 240, "y": 290, "width": 240, "height": 75},
                {"id": "n-app-crm10", "element_id": "app-legacy-crm", "name": "Legacy Oracle CRM 10g", "x": 520, "y": 290, "width": 240, "height": 75}
            ],
            "connections": [
                {"id": "c-a1", "relationship_id": "rel-3", "source_node_id": "n-app-sfdc", "target_node_id": "n-app-core"},
                {"id": "c-a2", "relationship_id": "rel-6", "source_node_id": "n-app-strp", "target_node_id": "n-app-core"}
            ]
        },

        # Technology View
        {
            "id": "view-technology-cloud-lifecycle",
            "name": "4. Technology Layer — Cloud Topology & Obsolescence Lifecycle",
            "viewpoint": "Technology Viewpoint",
            "doc": "Technology layer viewpoint showing managed cloud clusters, message brokers, on-premise mainframes, and EoL dates.",
            "nodes": [
                {"id": "n-tech-eks", "element_id": "tech-aws-cluster", "name": "AWS EKS Kubernetes Cluster", "x": 100, "y": 50, "width": 250, "height": 80},
                {"id": "n-tech-rds", "element_id": "tech-rds-postgres", "name": "AWS Aurora PostgreSQL Enterprise", "x": 390, "y": 50, "width": 250, "height": 80},
                {"id": "n-tech-kafka", "element_id": "tech-kafka-eventmesh", "name": "Apache Kafka Confluent Enterprise", "x": 680, "y": 50, "width": 250, "height": 80},
                {"id": "n-tech-z15", "element_id": "tech-ibm-z15", "name": "IBM z15 Enterprise Mainframe", "x": 100, "y": 180, "width": 250, "height": 80},
                {"id": "n-tech-vmw", "element_id": "tech-vmware-dc", "name": "VMware vSphere Datacenter", "x": 390, "y": 180, "width": 250, "height": 80},
                {"id": "n-tech-redis", "element_id": "tech-redis-cache", "name": "Redis Enterprise Cache", "x": 680, "y": 180, "width": 250, "height": 80}
            ],
            "connections": [
                {"id": "c-t1", "relationship_id": "rel-tech-1", "source_node_id": "n-tech-eks", "target_node_id": "n-tech-rds"},
                {"id": "c-t2", "relationship_id": "rel-tech-3", "source_node_id": "n-tech-kafka", "target_node_id": "n-tech-eks"}
            ]
        },

        # Motivation View
        {
            "id": "view-motivation-requirements-governance",
            "name": "5. Motivation Layer — Requirements & Constraints Governance",
            "viewpoint": "Requirements Realization Viewpoint",
            "doc": "Motivation layer viewpoint showing strategic goals, architectural requirements (MoSCoW P1), constraints, and assessments.",
            "nodes": [
                {"id": "n-goal-res", "element_id": "goal-cloud-resilience", "name": "Achieve 99.99% Cloud Resilience", "x": 100, "y": 50, "width": 250, "height": 70},
                {"id": "n-goal-rt", "element_id": "goal-realtime-banking", "name": "Instant Sub-Second Payments", "x": 390, "y": 50, "width": 250, "height": 70},
                {"id": "n-goal-reg", "element_id": "goal-regulatory-compliance", "name": "DORA & PSD2 Compliance", "x": 680, "y": 50, "width": 250, "height": 70},
                {"id": "n-req-dora", "element_id": "req-dora-dr-rto", "name": "DORA RTO < 2h DR Requirement", "x": 100, "y": 160, "width": 250, "height": 75},
                {"id": "n-req-sepa", "element_id": "req-sepa-instant-lat", "name": "SEPA Latency < 5s Requirement", "x": 390, "y": 160, "width": 250, "height": 75},
                {"id": "n-req-psd2", "element_id": "req-psd2-sca", "name": "PSD2 SCA Dynamic Linking", "x": 680, "y": 160, "width": 250, "height": 75},
                {"id": "n-con-iso", "element_id": "con-iso20022-pacs", "name": "ISO 20022 pacs.008 XML Format", "x": 240, "y": 280, "width": 250, "height": 70},
                {"id": "n-ass-mtbf", "element_id": "ass-legacy-mtbf", "name": "Mainframe AS400 Outage Risk", "x": 530, "y": 280, "width": 250, "height": 70}
            ],
            "connections": [
                {"id": "c-m1", "relationship_id": "rel-mot-1", "source_node_id": "n-req-sepa", "target_node_id": "n-goal-rt"},
                {"id": "c-m2", "relationship_id": "rel-mot-2", "source_node_id": "n-req-dora", "target_node_id": "n-goal-res"},
                {"id": "c-m3", "relationship_id": "rel-mot-3", "source_node_id": "n-req-psd2", "target_node_id": "n-goal-reg"}
            ]
        },

        # Implementation & Migration View
        {
            "id": "view-implementation-roadmap-transition",
            "name": "6. Implementation Layer — Transformation Roadmap & Work Packages",
            "viewpoint": "Migration Viewpoint",
            "doc": "Implementation layer viewpoint displaying baseline and target plateaus, work packages with RAG health, deliverables, and gaps.",
            "nodes": [
                {"id": "n-plt-base", "element_id": "plt-baseline-2024", "name": "Hybrid Banking Baseline 2024 (As-Is)", "x": 100, "y": 50, "width": 260, "height": 75},
                {"id": "n-plt-targ", "element_id": "plt-target-2026", "name": "Cloud-Native Banking 2026 (To-Be)", "x": 680, "y": 50, "width": 260, "height": 75},
                {"id": "n-wp-core", "element_id": "wp-vaultcore-migration", "name": "Core Banking Cloud Migration (Vault Core)", "x": 100, "y": 170, "width": 260, "height": 80},
                {"id": "n-wp-sepa", "element_id": "wp-instant-pay-sepa", "name": "SEPA Instant ISO 20022 Gateway", "x": 390, "y": 170, "width": 260, "height": 80},
                {"id": "n-wp-dora", "element_id": "wp-dora-resilience", "name": "DORA DR Hardening Program", "x": 680, "y": 170, "width": 260, "height": 80},
                {"id": "n-del-core", "element_id": "del-vaultcore-golive", "name": "Vault Core Production Go-Live", "x": 100, "y": 290, "width": 260, "height": 75},
                {"id": "n-del-kafka", "element_id": "del-kafka-mesh-prod", "name": "Enterprise Event Mesh Backbone", "x": 390, "y": 290, "width": 260, "height": 75},
                {"id": "n-wp-as400", "element_id": "wp-as400-sunset", "name": "Mainframe AS400 Decommissioning", "x": 680, "y": 290, "width": 260, "height": 75}
            ],
            "connections": [
                {"id": "c-p1", "relationship_id": "rel-ppm-1", "source_node_id": "n-wp-core", "target_node_id": "n-del-core"},
                {"id": "c-p2", "relationship_id": "rel-ppm-2", "source_node_id": "n-wp-sepa", "target_node_id": "n-del-kafka"},
                {"id": "c-p3", "relationship_id": "rel-ppm-4", "source_node_id": "n-wp-core", "target_node_id": "n-wp-as400"}
            ]
        }
    ]

    for lv in layer_views_def:
        v_id = lv["id"]
        v_data = {
            "nodes": lv["nodes"],
            "connections": lv["connections"]
        }

        # 1. Upsert ArchimateView
        av = db.query(ArchimateView).filter(
            ArchimateView.id == v_id,
            ArchimateView.model_id == m_id
        ).first()
        if not av:
            av = ArchimateView(
                id=v_id,
                model_id=m_id,
                name=lv["name"],
                viewpoint=lv["viewpoint"],
                documentation=lv["doc"],
                view_data=v_data
            )
            db.add(av)
        else:
            av.name = lv["name"]
            av.viewpoint = lv["viewpoint"]
            av.documentation = lv["doc"]
            av.view_data = v_data

        # 2. Upsert ArchiSchema
        schema = db.query(ArchiSchema).filter(
            ArchiSchema.id == v_id,
            ArchiSchema.model_id == m_id
        ).first()
        if not schema:
            schema = ArchiSchema(
                id=v_id,
                model_id=m_id,
                folder_id=folder.id,
                name=lv["name"],
                viewpoint=lv["viewpoint"],
                documentation=lv["doc"],
                status="available",
                current_version="v1.0",
                format="archi",
                view_data=v_data
            )
            db.add(schema)
            db.flush()

            ver = SchemaVersionHistory(
                id=f"ver-{v_id}-v10",
                schema_id=v_id,
                version_number=1,
                version_label="v1.0",
                commit_message=f"Official layer view creation: {lv['name']}",
                author_name="Lead Enterprise Architect",
                view_data_snapshot=v_data
            )
            db.add(ver)
        else:
            schema.name = lv["name"]
            schema.viewpoint = lv["viewpoint"]
            schema.documentation = lv["doc"]
            schema.view_data = v_data

    db.commit()
    logger.info(f"Model {m_id} successfully populated with all 6 layer elements, relationships, and diagrams.")
