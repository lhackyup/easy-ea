"""
BIAN Banking Starter Framework Seed
Banking Industry Architecture Network (BIAN Service Landscape v12.0)
Standard canonical reference architecture for financial institutions and core banking.
"""
from sqlalchemy.orm import Session
from app.models.archimate import (
    AttributePackage,
    AttributePackageItem,
    CustomAttributeDefinition,
    ElementStereotype,
    StereotypeAttributeLink,
    ArchimateElement,
    ArchimateRelationship
)

def seed_bian_framework(db: Session):
    """Seed or update the BIAN Banking Starter Framework package with stereotypes, attributes, and canonical reference elements."""
    pkg = db.query(AttributePackage).filter(AttributePackage.id == "pkg-bian").first()
    if not pkg:
        pkg = AttributePackage(
            id="pkg-bian",
            code="bian",
            name="BIAN Banking Framework",
            description="Banking Industry Architecture Network (BIAN Service Landscape v12.0) - Standard canonical reference architecture for financial institutions, core banking, and payment systems.",
            icon_color="emerald",
            is_default_active=False,
            is_system=True,
            package_type="framework",
            standard_version="v12.0",
            website_url="https://bian.org"
        )
        db.add(pkg)
        db.flush()
    else:
        pkg.code = "bian"
        pkg.name = "BIAN Banking Framework"
        pkg.description = "Banking Industry Architecture Network (BIAN Service Landscape v12.0) - Standard canonical reference architecture for financial institutions, core banking, and payment systems."
        pkg.is_system = True
        pkg.package_type = "framework"
        pkg.standard_version = "v12.0"
        pkg.website_url = "https://bian.org"
        pkg.icon_color = "emerald"

    # 1. Package Attributes
    bian_items = [
        {
            "id": "item-bian-pattern",
            "name": "bian_pattern",
            "label": "BIAN Action Term / Pattern",
            "description": "BIAN standard behavioral action term pattern (e.g. Execute, Fulfill, Operate, Agree, Manage, Design).",
            "element_type": "BusinessService",
            "layer": "Business",
            "data_type": "select",
            "options": ["Execute", "Fulfill", "Operate", "Agree", "Manage", "Design"],
            "default_value": "Fulfill",
            "is_required": True,
            "section": "BIAN Framework Metadata",
            "sort_order": 1
        },
        {
            "id": "item-bian-domain-type",
            "name": "bian_domain_type",
            "label": "BIAN Service Domain Type",
            "description": "Classification of the Service Domain according to the BIAN Service Landscape taxonomy.",
            "element_type": "BusinessService",
            "layer": "Business",
            "data_type": "select",
            "options": ["Core Banking", "Market Operations", "Channel", "Cross-Domain", "Generic"],
            "default_value": "Core Banking",
            "is_required": True,
            "section": "BIAN Framework Metadata",
            "sort_order": 2
        },
        {
            "id": "item-bian-asset-type",
            "name": "bian_asset_type",
            "label": "BIAN Functional Asset",
            "description": "Information asset or business entity governed by the Control Record or Service Domain.",
            "element_type": "BusinessObject",
            "layer": "Business",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": False,
            "section": "BIAN Framework Metadata",
            "sort_order": 3
        }
    ]

    for item_data in bian_items:
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

    # Clean up any legacy CustomAttributeDefinition duplicates with bian_ prefix
    db.query(CustomAttributeDefinition).filter(
        CustomAttributeDefinition.name.like("bian_%"),
        CustomAttributeDefinition.model_id == None
    ).delete(synchronize_session=False)

    db.flush()

    # 2. Stereotypes
    bian_stereotypes = [
        {
            "id": "stereo-bian-service-domain",
            "base_type": "BusinessService",
            "name": "Service Domain",
            "label": "«Service Domain»",
            "description": "BIAN Service Domain - Elementary and non-overlapping functional capability of the banking industry.",
            "icon_color": "emerald",
            "is_system": True,
            "package_id": pkg.id,
            "links": [
                {
                    "attribute_name": "bian_pattern",
                    "is_required": True,
                    "default_value": "Fulfill",
                    "section_override": "BIAN Service Domain",
                    "sort_order": 1
                },
                {
                    "attribute_name": "bian_domain_type",
                    "is_required": True,
                    "default_value": "Core Banking",
                    "section_override": "BIAN Service Domain",
                    "sort_order": 2
                }
            ]
        },
        {
            "id": "stereo-bian-control-record",
            "base_type": "BusinessObject",
            "name": "Control Record",
            "label": "«Control Record»",
            "description": "BIAN Control Record - Core informational entity tracking the state and lifecycle of the Service Domain.",
            "icon_color": "teal",
            "is_system": True,
            "package_id": pkg.id,
            "links": [
                {
                    "attribute_name": "bian_asset_type",
                    "is_required": True,
                    "default_value": "",
                    "section_override": "BIAN Control Record",
                    "sort_order": 1
                }
            ]
        }
    ]

    for st_data in bian_stereotypes:
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

    # 3. Canonical Reference Elements (is_reference=True, model_id=None, package_id="pkg-bian")
    ref_elements = [
        {
            "id": "elem-bian-sd-current-account",
            "name": "Current Account",
            "type": "BusinessService",
            "layer": "Business",
            "documentation": "BIAN SD: Governs opening, ledger accounting, balance management, and fund movements for deposit and checking accounts.",
            "properties": {"bian_pattern": "Fulfill", "bian_domain_type": "Core Banking", "bian_asset_type": "Current Account"},
            "stereotype_id": "stereo-bian-service-domain"
        },
        {
            "id": "elem-bian-sd-payment-execution",
            "name": "Payment Execution",
            "type": "BusinessService",
            "layer": "Business",
            "documentation": "BIAN SD: Orchestrates and clears interbank payment orders and settlements (SEPA, SWIFT, Fedwire, TARGET).",
            "properties": {"bian_pattern": "Execute", "bian_domain_type": "Core Banking", "bian_asset_type": "Payment Instruction"},
            "stereotype_id": "stereo-bian-service-domain"
        },
        {
            "id": "elem-bian-sd-party-data-mgmt",
            "name": "Party Data Management",
            "type": "BusinessService",
            "layer": "Business",
            "documentation": "BIAN SD: Central customer registry, Know Your Customer (KYC), anti-money laundering (AML), and legal relationships.",
            "properties": {"bian_pattern": "Manage", "bian_domain_type": "Generic", "bian_asset_type": "Party Reference"},
            "stereotype_id": "stereo-bian-service-domain"
        },
        {
            "id": "elem-bian-sd-customer-offer",
            "name": "Customer Offer",
            "type": "BusinessService",
            "layer": "Business",
            "documentation": "BIAN SD: Negotiation, credit underwriting, and finalization of customer product proposals and contractual agreements.",
            "properties": {"bian_pattern": "Agree", "bian_domain_type": "Channel", "bian_asset_type": "Customer Offer"},
            "stereotype_id": "stereo-bian-service-domain"
        },
        {
            "id": "elem-bian-sd-credit-facility",
            "name": "Credit Facility",
            "type": "BusinessService",
            "layer": "Business",
            "documentation": "BIAN SD: Manages credit limits, revolving loan facilities, collateral security, and committed facility utilization.",
            "properties": {"bian_pattern": "Fulfill", "bian_domain_type": "Core Banking", "bian_asset_type": "Credit Facility"},
            "stereotype_id": "stereo-bian-service-domain"
        },
        {
            "id": "elem-bian-sd-card-clearing",
            "name": "Card Clearing",
            "type": "BusinessService",
            "layer": "Business",
            "documentation": "BIAN SD: Settlement and clearing of card payment transactions across card networks (Visa, Mastercard, domestic schemes).",
            "properties": {"bian_pattern": "Execute", "bian_domain_type": "Core Banking", "bian_asset_type": "Card Settlement"},
            "stereotype_id": "stereo-bian-service-domain"
        },
        {
            "id": "elem-bian-sd-fraud-evaluation",
            "name": "Fraud Evaluation",
            "type": "BusinessService",
            "layer": "Business",
            "documentation": "BIAN SD: Real-time fraud detection and risk scoring using behavioral machine learning models.",
            "properties": {"bian_pattern": "Operate", "bian_domain_type": "Generic", "bian_asset_type": "Fraud Assessment"},
            "stereotype_id": "stereo-bian-service-domain"
        },
        {
            "id": "elem-bian-sd-financial-valuation",
            "name": "Financial Instrument Valuation",
            "type": "BusinessService",
            "layer": "Business",
            "documentation": "BIAN SD: Mark-to-market pricing, yield curve valuation, and portfolio appraisal of financial instruments.",
            "properties": {"bian_pattern": "Operate", "bian_domain_type": "Market Operations", "bian_asset_type": "Valuation Matrix"},
            "stereotype_id": "stereo-bian-service-domain"
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

    # 4. Canonical Reference Relationships between BIAN Service Domains
    ref_relationships = [
        {
            "id": "rel-bian-exec-to-fraud",
            "source_id": "elem-bian-sd-payment-execution",
            "target_id": "elem-bian-sd-fraud-evaluation",
            "type": "TriggeringRelationship",
            "name": "Evaluates Fraud Risk",
            "documentation": "BIAN Canonical: Payment execution triggers real-time fraud assessment and risk validation."
        },
        {
            "id": "rel-bian-exec-to-account",
            "source_id": "elem-bian-sd-payment-execution",
            "target_id": "elem-bian-sd-current-account",
            "type": "ServingRelationship",
            "name": "Posts Debits/Credits",
            "documentation": "BIAN Canonical: Payment execution posts authorized debits and credits to the current account ledger."
        },
        {
            "id": "rel-bian-card-to-account",
            "source_id": "elem-bian-sd-card-clearing",
            "target_id": "elem-bian-sd-current-account",
            "type": "ServingRelationship",
            "name": "Settles Card Transactions",
            "documentation": "BIAN Canonical: Card clearing settles net funds onto the merchant or cardholder account."
        },
        {
            "id": "rel-bian-account-to-party",
            "source_id": "elem-bian-sd-current-account",
            "target_id": "elem-bian-sd-party-data-mgmt",
            "type": "ServingRelationship",
            "name": "Validates Party & KYC",
            "documentation": "BIAN Canonical: Account management validates party identities and regulatory KYC status."
        },
        {
            "id": "rel-bian-offer-to-facility",
            "source_id": "elem-bian-sd-customer-offer",
            "target_id": "elem-bian-sd-credit-facility",
            "type": "TriggeringRelationship",
            "name": "Provisions Approved Facility",
            "documentation": "BIAN Canonical: Finalized customer offer provisions and opens the approved credit facility."
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

    db.commit()
