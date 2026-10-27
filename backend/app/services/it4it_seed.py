"""
IT4IT Standard Reference Architecture Seed
The Open Group IT4IT™ Standard v3.0
Open industry standard for the IT Operating Model, digital product value stream (Digital Product Backbone, DevOps, CI/CD, and Service Management).
"""
from sqlalchemy.orm import Session
from app.models.archimate import (
    AttributePackage,
    AttributePackageItem,
    CustomAttributeDefinition,
    ElementStereotype,
    StereotypeAttributeLink,
    ArchimateElement,
    ArchimateRelationship,
    PackageView
)

def seed_it4it_framework(db: Session):
    """Seed or update The Open Group IT4IT Standard v3.0 reference framework."""
    pkg = db.query(AttributePackage).filter(AttributePackage.id == "pkg-it4it").first()
    if not pkg:
        pkg = AttributePackage(
            id="pkg-it4it",
            code="it4it",
            name="IT4IT™ Reference Architecture",
            description="The Open Group IT4IT Standard v3.0 - Open industry standard for the IT Operating Model and digital product value streams (Digital Product Backbone, DevOps, CI/CD, Service Management).",
            icon_color="indigo",
            is_default_active=False,
            is_system=True,
            package_type="framework",
            standard_version="v3.0",
            website_url="https://www.opengroup.org/it4it"
        )
        db.add(pkg)
        db.flush()
    else:
        pkg.code = "it4it"
        pkg.name = "IT4IT™ Reference Architecture"
        pkg.description = "The Open Group IT4IT Standard v3.0 - Open industry standard for the IT Operating Model and digital product value streams (Digital Product Backbone, DevOps, CI/CD, Service Management)."
        pkg.is_system = True
        pkg.package_type = "framework"
        pkg.standard_version = "v3.0"
        pkg.website_url = "https://www.opengroup.org/it4it"
        pkg.icon_color = "indigo"

    # 1. Custom Attributes & Package Items
    it4it_items = [
        {
            "id": "item-it4it-value-stream",
            "name": "it4it_value_stream",
            "label": "IT4IT Value Stream",
            "description": "The 4 core value streams of the IT4IT standard (Strategy to Portfolio, Requirement to Deploy, Request to Fulfill, Detect to Correct).",
            "element_type": "*",
            "layer": "All",
            "data_type": "select",
            "options": [
                "Strategy to Portfolio (S2P)",
                "Requirement to Deploy (R2D)",
                "Request to Fulfill (R2F)",
                "Detect to Correct (D2C)"
            ],
            "default_value": "Strategy to Portfolio (S2P)",
            "is_required": True,
            "section": "IT4IT Framework Metadata",
            "sort_order": 1
        },
        {
            "id": "item-it4it-component-type",
            "name": "it4it_component_type",
            "label": "IT4IT Functional Role",
            "description": "Architectural role of the functional component in the IT4IT Reference Architecture.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": [
                "Primary Functional Component",
                "Supporting Functional Component",
                "Integration Gateway"
            ],
            "default_value": "Primary Functional Component",
            "is_required": True,
            "section": "IT4IT Framework Metadata",
            "sort_order": 2
        },
        {
            "id": "item-it4it-sor-tier",
            "name": "it4it_sor_tier",
            "label": "IT4IT Record Classification",
            "description": "Functional record classification of the component: System of Record (SoR), System of Engagement (SoE), or System of Insight (SoI).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": [
                "System of Record (SoR)",
                "System of Engagement (SoE)",
                "System of Insight (SoI)"
            ],
            "default_value": "System of Record (SoR)",
            "is_required": True,
            "section": "IT4IT Framework Metadata",
            "sort_order": 3
        },
        {
            "id": "item-it4it-lifecycle-phase",
            "name": "it4it_lifecycle_phase",
            "label": "IT4IT Lifecycle Phase",
            "description": "Digital product lifecycle phase according to the IT4IT standard (Plan, Build, Deliver, Run).",
            "element_type": "*",
            "layer": "All",
            "data_type": "select",
            "options": ["Plan", "Build", "Deliver", "Run"],
            "default_value": "Plan",
            "is_required": False,
            "section": "IT4IT Framework Metadata",
            "sort_order": 4
        }
    ]

    for item_data in it4it_items:
        it = db.query(AttributePackageItem).filter(AttributePackageItem.id == item_data["id"]).first()
        if not it:
            it = AttributePackageItem(
                id=item_data["id"],
                package_id=pkg.id,
                name=item_data["name"],
                label=item_data["label"],
                description=item_data["description"],
                element_type=item_data["element_type"],
                layer=item_data["layer"],
                data_type=item_data["data_type"],
                options=item_data["options"],
                default_value=item_data["default_value"],
                is_required=item_data["is_required"],
                section=item_data["section"],
                sort_order=item_data["sort_order"]
            )
            db.add(it)
        else:
            it.label = item_data["label"]
            it.description = item_data["description"]
            it.options = item_data["options"]
            it.default_value = item_data["default_value"]
            it.is_required = item_data["is_required"]
            it.section = item_data["section"]
            it.sort_order = item_data["sort_order"]

    # Clean up any legacy CustomAttributeDefinition duplicates with it4it_ prefix
    db.query(CustomAttributeDefinition).filter(
        CustomAttributeDefinition.name.like("it4it_%"),
        CustomAttributeDefinition.model_id == None
    ).delete(synchronize_session=False)

    db.flush()

    # 2. Stereotypes
    it4it_stereotypes = [
        {
            "id": "stereo-it4it-value-stream",
            "base_type": "BusinessProcess",
            "name": "IT4IT Value Stream",
            "label": "«IT4IT Value Stream»",
            "description": "Continuous end-to-end value stream managing the digital product lifecycle (S2P, R2D, R2F, D2C).",
            "icon_color": "indigo",
            "is_system": True,
            "package_id": pkg.id,
            "links": [
                {
                    "attribute_name": "it4it_value_stream",
                    "is_required": True,
                    "default_value": "Strategy to Portfolio (S2P)",
                    "section_override": "IT4IT Value Stream",
                    "sort_order": 1
                },
                {
                    "attribute_name": "it4it_lifecycle_phase",
                    "is_required": True,
                    "default_value": "Plan",
                    "section_override": "IT4IT Value Stream",
                    "sort_order": 2
                }
            ]
        },
        {
            "id": "stereo-it4it-functional-component",
            "base_type": "ApplicationComponent",
            "name": "IT4IT Functional Component",
            "label": "«IT4IT Functional Component»",
            "description": "Canonical application component (SoR / SoE) responsible for managing a dedicated IT value artifact.",
            "icon_color": "blue",
            "is_system": True,
            "package_id": pkg.id,
            "links": [
                {
                    "attribute_name": "it4it_value_stream",
                    "is_required": True,
                    "default_value": "Strategy to Portfolio (S2P)",
                    "section_override": "IT4IT Functional Component",
                    "sort_order": 1
                },
                {
                    "attribute_name": "it4it_component_type",
                    "is_required": True,
                    "default_value": "Primary Functional Component",
                    "section_override": "IT4IT Functional Component",
                    "sort_order": 2
                },
                {
                    "attribute_name": "it4it_sor_tier",
                    "is_required": True,
                    "default_value": "System of Record (SoR)",
                    "section_override": "IT4IT Functional Component",
                    "sort_order": 3
                }
            ]
        },
        {
            "id": "stereo-it4it-data-object",
            "base_type": "DataObject",
            "name": "IT4IT Key Data Object",
            "label": "«IT4IT Key Data Object»",
            "description": "Canonical key data object (SoR) tracking flow integrity and governance across the IT value stream.",
            "icon_color": "purple",
            "is_system": True,
            "package_id": pkg.id,
            "links": [
                {
                    "attribute_name": "it4it_value_stream",
                    "is_required": True,
                    "default_value": "Strategy to Portfolio (S2P)",
                    "section_override": "IT4IT Key Data Object",
                    "sort_order": 1
                },
                {
                    "attribute_name": "it4it_lifecycle_phase",
                    "is_required": False,
                    "default_value": "Plan",
                    "section_override": "IT4IT Key Data Object",
                    "sort_order": 2
                }
            ]
        }
    ]

    for st_data in it4it_stereotypes:
        st = db.query(ElementStereotype).filter(ElementStereotype.id == st_data["id"]).first()
        if not st:
            st = ElementStereotype(
                id=st_data["id"],
                base_type=st_data["base_type"],
                name=st_data["name"],
                label=st_data["label"],
                description=st_data["description"],
                icon_color=st_data["icon_color"],
                is_system=st_data["is_system"],
                package_id=st_data["package_id"],
                model_id=None
            )
            db.add(st)
            db.flush()
        else:
            st.name = st_data["name"]
            st.label = st_data["label"]
            st.description = st_data["description"]
            st.icon_color = st_data["icon_color"]
            st.package_id = st_data["package_id"]

        for l_data in st_data["links"]:
            existing_link = db.query(StereotypeAttributeLink).filter(
                StereotypeAttributeLink.stereotype_id == st.id,
                StereotypeAttributeLink.attribute_name == l_data["attribute_name"]
            ).first()
            if not existing_link:
                link = StereotypeAttributeLink(
                    id=f"link-{st.id}-{l_data['attribute_name']}",
                    stereotype_id=st.id,
                    attribute_name=l_data["attribute_name"],
                    is_required=l_data["is_required"],
                    default_value=l_data.get("default_value"),
                    section_override=l_data.get("section_override"),
                    sort_order=l_data.get("sort_order", 0)
                )
                db.add(link)
            else:
                existing_link.is_required = l_data["is_required"]
                existing_link.default_value = l_data.get("default_value")
                existing_link.section_override = l_data.get("section_override")
                existing_link.sort_order = l_data.get("sort_order", 0)

    db.flush()

    # 3. Canonical Reference Elements
    ref_elements = [
        # Value Streams
        {
            "id": "elem-it4it-vs-s2p",
            "name": "Strategy to Portfolio (S2P)",
            "type": "BusinessProcess",
            "layer": "Business",
            "documentation": "IT4IT Value Stream: Aligns enterprise strategic roadmap, product portfolios, and IT budgets with business demand.",
            "properties": {"it4it_value_stream": "Strategy to Portfolio (S2P)", "it4it_lifecycle_phase": "Plan"},
            "stereotype_id": "stereo-it4it-value-stream"
        },
        {
            "id": "elem-it4it-vs-r2d",
            "name": "Requirement to Deploy (R2D)",
            "type": "BusinessProcess",
            "layer": "Business",
            "documentation": "IT4IT Value Stream: Transforms requirements and user stories into validated, deployable software release artifacts via DevOps pipelines.",
            "properties": {"it4it_value_stream": "Requirement to Deploy (R2D)", "it4it_lifecycle_phase": "Build"},
            "stereotype_id": "stereo-it4it-value-stream"
        },
        {
            "id": "elem-it4it-vs-r2f",
            "name": "Request to Fulfill (R2F)",
            "type": "BusinessProcess",
            "layer": "Business",
            "documentation": "IT4IT Value Stream: Publishes and operates the digital service catalog, enabling automated service consumption, approval, and provisioning.",
            "properties": {"it4it_value_stream": "Request to Fulfill (R2F)", "it4it_lifecycle_phase": "Deliver"},
            "stereotype_id": "stereo-it4it-value-stream"
        },
        {
            "id": "elem-it4it-vs-d2c",
            "name": "Detect to Correct (D2C)",
            "type": "BusinessProcess",
            "layer": "Business",
            "documentation": "IT4IT Value Stream: Proactively detects operational production events, telemetry, and service anomalies, handling incidents and remediation.",
            "properties": {"it4it_value_stream": "Detect to Correct (D2C)", "it4it_lifecycle_phase": "Run"},
            "stereotype_id": "stereo-it4it-value-stream"
        },

        # Functional Components
        {
            "id": "elem-it4it-fc-ea",
            "name": "Enterprise Architecture Management",
            "type": "ApplicationComponent",
            "layer": "Application",
            "documentation": "IT4IT FC: Maintains architectural models, technology standards, and digital transformation roadmaps (SoR).",
            "properties": {
                "it4it_value_stream": "Strategy to Portfolio (S2P)",
                "it4it_component_type": "Primary Functional Component",
                "it4it_sor_tier": "System of Record (SoR)"
            },
            "stereotype_id": "stereo-it4it-functional-component"
        },
        {
            "id": "elem-it4it-fc-portfolio",
            "name": "Portfolio & Demand Management",
            "type": "ApplicationComponent",
            "layer": "Application",
            "documentation": "IT4IT FC: Captures business demand, prioritizes capital investments, and approves product initiatives.",
            "properties": {
                "it4it_value_stream": "Strategy to Portfolio (S2P)",
                "it4it_component_type": "Primary Functional Component",
                "it4it_sor_tier": "System of Record (SoR)"
            },
            "stereotype_id": "stereo-it4it-functional-component"
        },
        {
            "id": "elem-it4it-fc-backlog",
            "name": "Requirement & Product Backlog",
            "type": "ApplicationComponent",
            "layer": "Application",
            "documentation": "IT4IT FC: Defines and manages functional and non-functional requirements, epics, and user stories for delivery squads.",
            "properties": {
                "it4it_value_stream": "Requirement to Deploy (R2D)",
                "it4it_component_type": "Primary Functional Component",
                "it4it_sor_tier": "System of Record (SoR)"
            },
            "stereotype_id": "stereo-it4it-functional-component"
        },
        {
            "id": "elem-it4it-fc-cicd",
            "name": "Build & Continuous Delivery (CI/CD)",
            "type": "ApplicationComponent",
            "layer": "Application",
            "documentation": "IT4IT FC: Builds source code, runs automated continuous delivery pipelines, and produces verified release packages.",
            "properties": {
                "it4it_value_stream": "Requirement to Deploy (R2D)",
                "it4it_component_type": "Primary Functional Component",
                "it4it_sor_tier": "System of Record (SoR)"
            },
            "stereotype_id": "stereo-it4it-functional-component"
        },
        {
            "id": "elem-it4it-fc-test",
            "name": "Test & Quality Management",
            "type": "ApplicationComponent",
            "layer": "Application",
            "documentation": "IT4IT FC: Plans and executes functional test suites, performance benchmarks, and automated security gates (SAST/DAST).",
            "properties": {
                "it4it_value_stream": "Requirement to Deploy (R2D)",
                "it4it_component_type": "Primary Functional Component",
                "it4it_sor_tier": "System of Record (SoR)"
            },
            "stereotype_id": "stereo-it4it-functional-component"
        },
        {
            "id": "elem-it4it-fc-catalog",
            "name": "Digital Service Catalog",
            "type": "ApplicationComponent",
            "layer": "Application",
            "documentation": "IT4IT FC: Publishes and organizes the catalog of digital services, APIs, and IT resources requestable by enterprise consumers.",
            "properties": {
                "it4it_value_stream": "Request to Fulfill (R2F)",
                "it4it_component_type": "Primary Functional Component",
                "it4it_sor_tier": "System of Engagement (SoE)"
            },
            "stereotype_id": "stereo-it4it-functional-component"
        },
        {
            "id": "elem-it4it-fc-cmdb",
            "name": "Configuration Management (CMS / CMDB)",
            "type": "ApplicationComponent",
            "layer": "Application",
            "documentation": "IT4IT FC: Tracks Configuration Items (CIs), versions, and topological runtime dependency graphs in production (SoR).",
            "properties": {
                "it4it_value_stream": "Detect to Correct (D2C)",
                "it4it_component_type": "Primary Functional Component",
                "it4it_sor_tier": "System of Record (SoR)"
            },
            "stereotype_id": "stereo-it4it-functional-component"
        },
        {
            "id": "elem-it4it-fc-incident",
            "name": "Incident & Problem Management",
            "type": "ApplicationComponent",
            "layer": "Application",
            "documentation": "IT4IT FC: Manages registration, escalation, resolution, and post-mortem analysis of service incidents.",
            "properties": {
                "it4it_value_stream": "Detect to Correct (D2C)",
                "it4it_component_type": "Primary Functional Component",
                "it4it_sor_tier": "System of Record (SoR)"
            },
            "stereotype_id": "stereo-it4it-functional-component"
        },
        {
            "id": "elem-it4it-fc-telemetry",
            "name": "Event & Telemetry Monitoring",
            "type": "ApplicationComponent",
            "layer": "Application",
            "documentation": "IT4IT FC: Collects distributed metrics, logs, and APM traces, correlating critical operational events.",
            "properties": {
                "it4it_value_stream": "Detect to Correct (D2C)",
                "it4it_component_type": "Primary Functional Component",
                "it4it_sor_tier": "System of Insight (SoI)"
            },
            "stereotype_id": "stereo-it4it-functional-component"
        },

        # Key Data Objects
        {
            "id": "elem-it4it-do-blueprint",
            "name": "Digital Product Blueprint",
            "type": "DataObject",
            "layer": "Business",
            "documentation": "IT4IT Key Data Object: Authoritative conceptual blueprint specifying requirements, SLAs, and digital product contracts.",
            "properties": {"it4it_value_stream": "Strategy to Portfolio (S2P)", "it4it_lifecycle_phase": "Plan"},
            "stereotype_id": "stereo-it4it-data-object"
        },
        {
            "id": "elem-it4it-do-release",
            "name": "Release Package",
            "type": "DataObject",
            "layer": "Application",
            "documentation": "IT4IT Key Data Object: Immutable software artifact (binary, container image, or IaC bundle), signed and verified.",
            "properties": {"it4it_value_stream": "Requirement to Deploy (R2D)", "it4it_lifecycle_phase": "Build"},
            "stereotype_id": "stereo-it4it-data-object"
        },
        {
            "id": "elem-it4it-do-ci",
            "name": "Configuration Item (CI)",
            "type": "DataObject",
            "layer": "Technology",
            "documentation": "IT4IT Key Data Object: Configuration baseline state of an infrastructure, software, or cloud asset.",
            "properties": {"it4it_value_stream": "Detect to Correct (D2C)", "it4it_lifecycle_phase": "Run"},
            "stereotype_id": "stereo-it4it-data-object"
        },
        {
            "id": "elem-it4it-do-incident",
            "name": "Incident Ticket",
            "type": "DataObject",
            "layer": "Business",
            "documentation": "IT4IT Key Data Object: Authoritative incident record tracking service outage, business impact, and resolution timeline.",
            "properties": {"it4it_value_stream": "Detect to Correct (D2C)", "it4it_lifecycle_phase": "Run"},
            "stereotype_id": "stereo-it4it-data-object"
        }
    ]

    for elem_data in ref_elements:
        el = db.query(ArchimateElement).filter(ArchimateElement.id == elem_data["id"]).first()
        if not el:
            el = ArchimateElement(
                id=elem_data["id"],
                model_id=None,
                name=elem_data["name"],
                type=elem_data["type"],
                layer=elem_data["layer"],
                documentation=elem_data["documentation"],
                properties=elem_data["properties"],
                stereotype_id=elem_data["stereotype_id"],
                is_reference=True,
                package_id=pkg.id
            )
            db.add(el)
        else:
            el.model_id = None
            el.name = elem_data["name"]
            el.type = elem_data["type"]
            el.layer = elem_data["layer"]
            el.documentation = elem_data["documentation"]
            el.properties = elem_data["properties"]
            el.stereotype_id = elem_data["stereotype_id"]
            el.is_reference = True
            el.package_id = pkg.id

    db.flush()

    # 4. Canonical Reference Relationships
    ref_relationships = [
        # Process Triggering flow
        {
            "id": "rel-it4it-s2p-to-r2d",
            "source_id": "elem-it4it-vs-s2p",
            "target_id": "elem-it4it-vs-r2d",
            "type": "TriggeringRelationship",
            "name": "Grooms Backlog from Strategy",
            "documentation": "IT4IT Canonical: Strategy to Portfolio grooms backlog and activates initiatives into Requirement to Deploy."
        },
        {
            "id": "rel-it4it-r2d-to-r2f",
            "source_id": "elem-it4it-vs-r2d",
            "target_id": "elem-it4it-vs-r2f",
            "type": "TriggeringRelationship",
            "name": "Publishes to Service Catalog",
            "documentation": "IT4IT Canonical: Requirement to Deploy publishes verified release packages into the digital service catalog."
        },
        {
            "id": "rel-it4it-r2f-to-d2c",
            "source_id": "elem-it4it-vs-r2f",
            "target_id": "elem-it4it-vs-d2c",
            "type": "TriggeringRelationship",
            "name": "Transitions to Live Run",
            "documentation": "IT4IT Canonical: Fulfilled service provisions transition into runtime operations under Detect to Correct."
        },

        # Functional Component Collaborations
        {
            "id": "rel-it4it-ea-to-portfolio",
            "source_id": "elem-it4it-fc-ea",
            "target_id": "elem-it4it-fc-portfolio",
            "type": "ServingRelationship",
            "name": "Guides with Architecture Standards",
            "documentation": "IT4IT Canonical: Enterprise Architecture provides standards, blueprints, and guardrails to Portfolio Management."
        },
        {
            "id": "rel-it4it-portfolio-to-backlog",
            "source_id": "elem-it4it-fc-portfolio",
            "target_id": "elem-it4it-fc-backlog",
            "type": "ServingRelationship",
            "name": "Allocates Approved Epics",
            "documentation": "IT4IT Canonical: Portfolio Management allocates approved epics and budgets to the product delivery backlog."
        },
        {
            "id": "rel-it4it-backlog-to-cicd",
            "source_id": "elem-it4it-fc-backlog",
            "target_id": "elem-it4it-fc-cicd",
            "type": "ServingRelationship",
            "name": "Supplies User Stories",
            "documentation": "IT4IT Canonical: Product backlog supplies user stories to automated CI/CD pipelines."
        },
        {
            "id": "rel-it4it-cicd-to-test",
            "source_id": "elem-it4it-fc-cicd",
            "target_id": "elem-it4it-fc-test",
            "type": "TriggeringRelationship",
            "name": "Triggers Automated Testing Suites",
            "documentation": "IT4IT Canonical: Build phase automatically triggers automated quality and security testing suites."
        },
        {
            "id": "rel-it4it-cicd-to-cmdb",
            "source_id": "elem-it4it-fc-cicd",
            "target_id": "elem-it4it-fc-cmdb",
            "type": "ServingRelationship",
            "name": "Registers Deployed Releases",
            "documentation": "IT4IT Canonical: Deployment stages register updated release versions and configuration changes into CMDB."
        },
        {
            "id": "rel-it4it-catalog-to-cmdb",
            "source_id": "elem-it4it-fc-catalog",
            "target_id": "elem-it4it-fc-cmdb",
            "type": "ServingRelationship",
            "name": "Correlates Offerings to CIs",
            "documentation": "IT4IT Canonical: Service catalog maps service offerings to underlying Configuration Items."
        },
        {
            "id": "rel-it4it-cmdb-to-incident",
            "source_id": "elem-it4it-fc-cmdb",
            "target_id": "elem-it4it-fc-incident",
            "type": "ServingRelationship",
            "name": "Provides Topology for RCA",
            "documentation": "IT4IT Canonical: CMDB provides dependency topology for root cause analysis (RCA)."
        },
        {
            "id": "rel-it4it-telemetry-to-incident",
            "source_id": "elem-it4it-fc-telemetry",
            "target_id": "elem-it4it-fc-incident",
            "type": "TriggeringRelationship",
            "name": "Raises Automated Incidents",
            "documentation": "IT4IT Canonical: Telemetry and observability monitoring automatically raise incident tickets when SLA thresholds breach."
        },

        # Component to Data Object Relationships
        {
            "id": "rel-it4it-portfolio-blueprint",
            "source_id": "elem-it4it-fc-portfolio",
            "target_id": "elem-it4it-do-blueprint",
            "type": "AccessRelationship",
            "name": "Governs Digital Product Definition",
            "documentation": "IT4IT Canonical: Portfolio Management defines and updates the authoritative Digital Product Blueprint."
        },
        {
            "id": "rel-it4it-cicd-realizes-release",
            "source_id": "elem-it4it-fc-cicd",
            "target_id": "elem-it4it-do-release",
            "type": "RealizationRelationship",
            "name": "Builds Immutable Release Artifact",
            "documentation": "IT4IT Canonical: CI/CD build pipeline compiles and realizes the immutable Release Package."
        },
        {
            "id": "rel-it4it-cmdb-accesses-ci",
            "source_id": "elem-it4it-fc-cmdb",
            "target_id": "elem-it4it-do-ci",
            "type": "AccessRelationship",
            "name": "Stores Authoritative CI State",
            "documentation": "IT4IT Canonical: CMDB maintains authoritative runtime configuration state of the CI."
        },
        {
            "id": "rel-it4it-incident-accesses-ticket",
            "source_id": "elem-it4it-fc-incident",
            "target_id": "elem-it4it-do-incident",
            "type": "AccessRelationship",
            "name": "Manages Incident Record",
            "documentation": "IT4IT Canonical: Incident Management manages the lifecycle of the Incident Ticket."
        },
        {
            "id": "rel-it4it-incident-accesses-ci",
            "source_id": "elem-it4it-fc-incident",
            "target_id": "elem-it4it-do-ci",
            "type": "AccessRelationship",
            "name": "Associates Affected CIs",
            "documentation": "IT4IT Canonical: Incident management correlates affected Configuration Items impacted by the outage."
        }
    ]

    for rel_data in ref_relationships:
        r = db.query(ArchimateRelationship).filter(ArchimateRelationship.id == rel_data["id"]).first()
        if not r:
            r = ArchimateRelationship(
                id=rel_data["id"],
                model_id=None,
                source_id=rel_data["source_id"],
                target_id=rel_data["target_id"],
                type=rel_data["type"],
                name=rel_data["name"],
                documentation=rel_data["documentation"],
                is_reference=True,
                package_id=pkg.id
            )
            db.add(r)
        else:
            r.model_id = None
            r.source_id = rel_data["source_id"]
            r.target_id = rel_data["target_id"]
            r.type = rel_data["type"]
            r.name = rel_data["name"]
            r.documentation = rel_data["documentation"]
            r.is_reference = True
            r.package_id = pkg.id

    # 5. Default Business Views for IT4IT
    it4it_views = [
        {
            "id": "pkv-it4it-components-portfolio",
            "view_key": "it4it_components_portfolio",
            "name": "IT4IT Components Portfolio",
            "description": "Enterprise application and system mapping aligned with IT4IT standard by Value Stream and functional role.",
            "category": "Portfolio Governance",
            "view_type": "table",
            "icon": "Layers",
            "sort_order": 1,
            "target_stereotypes": ["IT4IT Functional Component", "stereo-it4it-functional-component"],
            "config": {
                "columns": [
                    { "field": "name", "label": "Component Name", "type": "string", "sortable": True },
                    { "field": "type", "label": "ArchiMate Type", "type": "string", "sortable": True },
                    { "field": "it4it_value_stream", "label": "Value Stream", "type": "enum", "filterable": True },
                    { "field": "it4it_component_type", "label": "Functional Role", "type": "enum", "filterable": True },
                    { "field": "it4it_sor_tier", "label": "Record Classification", "type": "badge", "filterable": True }
                ],
                "default_sort": { "field": "name", "direction": "asc" },
                "filters": []
            }
        },
        {
            "id": "pkv-it4it-stream-kpi",
            "view_key": "it4it_stream_kpi",
            "name": "Value Stream Coverage Dashboard",
            "description": "Executive portfolio analytics tracking IT4IT Value Stream coverage and System of Record resilience.",
            "category": "Analytics",
            "view_type": "kpi_dashboard",
            "icon": "BarChart3",
            "sort_order": 2,
            "target_stereotypes": ["IT4IT Functional Component", "stereo-it4it-functional-component"],
            "config": {
                "metrics": [
                    { "id": "total_components", "label": "Total IT4IT Components", "type": "count" },
                    { "id": "total_sor", "label": "System of Record (SoR)", "type": "count", "where": { "it4it_sor_tier": "System of Record (SoR)" } }
                ],
                "charts": [
                    {
                        "id": "chart_by_stream",
                        "title": "Distribution by Value Stream",
                        "type": "bar",
                        "group_by": "it4it_value_stream"
                    },
                    {
                        "id": "chart_by_role",
                        "title": "Functional Role",
                        "type": "pie",
                        "group_by": "it4it_component_type"
                    }
                ]
            }
        }
    ]

    for v_data in it4it_views:
        v = db.query(PackageView).filter(PackageView.id == v_data["id"]).first()
        if not v:
            v = PackageView(
                id=v_data["id"],
                package_id=pkg.id,
                view_key=v_data["view_key"],
                name=v_data["name"],
                description=v_data["description"],
                category=v_data["category"],
                view_type=v_data["view_type"],
                icon=v_data["icon"],
                sort_order=v_data.get("sort_order", 0),
                target_stereotypes=v_data["target_stereotypes"],
                config=v_data["config"]
            )
            db.add(v)
        else:
            v.name = v_data["name"]
            v.description = v_data["description"]
            v.category = v_data["category"]
            v.view_type = v_data["view_type"]
            v.icon = v_data["icon"]
            v.sort_order = v_data.get("sort_order", 0)
            v.target_stereotypes = v_data["target_stereotypes"]
            v.config = v_data["config"]

    db.commit()
