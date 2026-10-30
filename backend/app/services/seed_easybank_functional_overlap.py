"""
Script to seed Business Capabilities and map them to Business Applications in
EasyBank Global Enterprise Model ('sample-easybank-ea', 'EASY').
Enables comprehensive Functional Overlap Analysis and Rationalization Clusters:
- 33 Banking Business Capabilities (Strategy layer)
- Full APM Attributes synchronization for all 90 Business Applications
- Overlapping application coverage across CRM, Core Banking, Payments, AML, CIAM,
  Document Archiving, POS Acquiring, Trading, Regulatory Reporting, and more
- Direct Realization relationships (App -> Capability) and Component lineage (Core Component -> Capability)
"""

import sys
import os
from typing import Dict, Any, List
from sqlalchemy.orm import Session

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.database import SessionLocal
from app.models.archimate import (
    ModelWorkspace,
    ArchimateElement,
    ArchimateRelationship,
    ApplicationBusinessAttributes
)

MODEL_ID = "sample-easybank-ea"

# --------------------------------------------------------------------------
# 1. 33 BANKING CAPABILITIES TAXONOMY
# --------------------------------------------------------------------------
BANKING_CAPABILITIES = [
    # 7 Pre-existing (enriched)
    {
        "id": "cap-cust-mgmt",
        "name": "Customer Relationship Management (CRM)",
        "documentation": "Comprehensive 360-degree customer relationship management, sales pipeline, retail and corporate marketing campaigns, and omni-channel interaction history.",
        "properties": {"domain": "Sales & Distribution", "level": "Level 1"}
    },
    {
        "id": "cap-core-acc",
        "name": "Core Account & General Ledger Management",
        "documentation": "Deposit and checking account administration, chart of accounts, real-time balance ledgers, and financial accounting under IFRS standards.",
        "properties": {"domain": "Core Banking", "level": "Level 1"}
    },
    {
        "id": "cap-payments",
        "name": "Payment & Transaction Processing",
        "documentation": "Multi-channel payment transaction routing, validation, clearing, and settlement for SEPA transfers, payment cards, and direct debits.",
        "properties": {"domain": "Payments & Clearing", "level": "Level 1"}
    },
    {
        "id": "cap-fraud",
        "name": "Fraud Detection & Anti-Financial Crime",
        "documentation": "Real-time AI/ML transactional monitoring and decisioning for card fraud, identity theft, and account takeover prevention.",
        "properties": {"domain": "Risk & Compliance", "level": "Level 1"}
    },
    {
        "id": "cap-doc",
        "name": "Document & Archive Management",
        "documentation": "Compliant electronic archiving, indexing, and digital retention under eIDAS and WORM standards for contracts, statements, and formal correspondence.",
        "properties": {"domain": "Corporate Operations", "level": "Level 1"}
    },
    {
        "id": "cap-hr",
        "name": "Human Capital & Payroll Management",
        "documentation": "Human capital management, payroll processing, organizational modeling, benefits administration, mandatory banking compliance training, and performance reviews.",
        "properties": {"domain": "Corporate Support", "level": "Level 1"}
    },
    {
        "id": "cap-claims",
        "name": "Claims, NPL & Credit Recovery Management",
        "documentation": "Customer dispute resolution, legal litigation handling, non-performing loan (NPL/UTP) work-out, and debt restructuring plan tracking.",
        "properties": {"domain": "Credit & Operations", "level": "Level 1"}
    },

    # 26 New Strategic Banking Capabilities
    {
        "id": "cap-aml-screening",
        "name": "Anti-Money Laundering (AML) & PEP Screening",
        "documentation": "Anti-money laundering transaction surveillance, automated screening against PEP watchlists, and OFAC/EU counter-terrorism sanctions checks.",
        "properties": {"domain": "Compliance & Security", "level": "Level 1"}
    },
    {
        "id": "cap-digital-signature",
        "name": "Digital Signature & Electronic Trust Services",
        "documentation": "Advanced and Qualified Electronic Signatures (QES), cryptographic timestamping, and legally binding digital contract execution.",
        "properties": {"domain": "Trust & Security", "level": "Level 1"}
    },
    {
        "id": "cap-identity-mgmt",
        "name": "Customer Identity & Access Management (CIAM)",
        "documentation": "Strong customer authentication (SCA/PSD2), biometric login, Single Sign-On (SSO), OpenID Connect federation, and credential lifecycle management.",
        "properties": {"domain": "Security & Architecture", "level": "Level 1"}
    },
    {
        "id": "cap-credit-scoring",
        "name": "Credit Bureau Scoring & Customer Creditworthiness",
        "documentation": "Quantitative and qualitative credit scoring, automated credit bureau inquiry (CRIF/Experian), and real-time default probability (PD) calculation.",
        "properties": {"domain": "Credit Risk", "level": "Level 1"}
    },
    {
        "id": "cap-mortgage-orig",
        "name": "Mortgage & Loan Origination / Underwriting",
        "documentation": "End-to-end mortgage origination, cadastral property checks, technical collateral appraisal, and notarial deed workflow management.",
        "properties": {"domain": "Retail Lending", "level": "Level 1"}
    },
    {
        "id": "cap-securities-trading",
        "name": "Securities Trading, OMS & Market Feeds",
        "documentation": "Direct Market Access (DMA) equity, bond, and derivatives trading execution, smart order routing, and exchange connectivity.",
        "properties": {"domain": "Capital Markets", "level": "Level 1"}
    },
    {
        "id": "cap-wealth-portfolio",
        "name": "Wealth Portfolio Management & Asset Allocation",
        "documentation": "Financial planning, tailored asset allocation for Private Banking clients, and discretionary portfolio management.",
        "properties": {"domain": "Wealth Management", "level": "Level 1"}
    },
    {
        "id": "cap-treasury-cash",
        "name": "Treasury Management, Liquidity & Cash Pooling",
        "documentation": "Corporate treasury liquidity management, multi-entity zero-balancing cash pooling, and intraday cash forecasting.",
        "properties": {"domain": "Corporate Treasury", "level": "Level 1"}
    },
    {
        "id": "cap-reg-reporting",
        "name": "Supervisory & Regulatory Reporting (BDI / EBA / ECB)",
        "documentation": "Automated calculation, reconciliation, and filing of prudential regulatory reports for Bank of Italy and ECB (PUMA, FINREP, COREP).",
        "properties": {"domain": "Regulatory Compliance", "level": "Level 1"}
    },
    {
        "id": "cap-pos-acquiring",
        "name": "Merchant POS Acquiring & Terminal Management",
        "documentation": "Merchant acquiring terminal fleet management, POS authorization routing, e-commerce payment gateway integration, and merchant settlement.",
        "properties": {"domain": "Merchant Payments", "level": "Level 1"}
    },
    {
        "id": "cap-atm-switch",
        "name": "ATM Switch & Self-Service Terminal Fleet Monitoring",
        "documentation": "Operational monitoring of ATM and cash-in terminal fleets, remote telemetry diagnostics, withdrawal authorization, and cash balancing.",
        "properties": {"domain": "Retail Channels", "level": "Level 1"}
    },
    {
        "id": "cap-bi-analytics",
        "name": "Enterprise Business Intelligence & Analytics",
        "documentation": "Enterprise Business Intelligence reporting and interactive dashboard analytics for executive management.",
        "properties": {"domain": "Data & Analytics", "level": "Level 1"}
    },
    {
        "id": "cap-itsm-ops",
        "name": "IT Service Management & Operational Governance",
        "documentation": "ITIL incident, problem, and change management for banking IT infrastructure, service catalog, and SLA compliance monitoring.",
        "properties": {"domain": "IT Operations", "level": "Level 1"}
    },
    {
        "id": "cap-swift-clearing",
        "name": "SWIFT Messaging & Interbank Clearing",
        "documentation": "Cross-border financial messaging routing over SWIFT network (ISO 20022 MX and MT103), SWIFT GPI tracking, and sanctions checks.",
        "properties": {"domain": "Payments & Clearing", "level": "Level 1"}
    },
    {
        "id": "cap-erp-accounting",
        "name": "Enterprise ERP, General Accounting & Consolidation",
        "documentation": "Enterprise ERP for general ledger accounting, corporate treasury, fixed assets, cost controlling, and financial reporting.",
        "properties": {"domain": "Corporate Finance", "level": "Level 1"}
    },
    {
        "id": "cap-customer-support",
        "name": "Customer Service, Contact Center & Branch Management",
        "documentation": "Omnichannel customer care service, telephone and chat contact center, support ticketing, and physical branch queue routing.",
        "properties": {"domain": "Customer Channels", "level": "Level 1"}
    },
    {
        "id": "cap-data-governance",
        "name": "Enterprise Data Governance & Catalog",
        "documentation": "Enterprise data catalog, end-to-end data lineage, BCBS 239 risk data aggregation, and business glossary management.",
        "properties": {"domain": "Data Management", "level": "Level 1"}
    },
    {
        "id": "cap-fund-accounting",
        "name": "Investment Fund Accounting & NAV Calculation",
        "documentation": "Daily fund valuation (NAV - Net Asset Value) calculation for mutual funds, UCITS fund accounting, and securities reconciliation.",
        "properties": {"domain": "Asset Management", "level": "Level 1"}
    },
    {
        "id": "cap-digital-channels",
        "name": "Digital Retail & Corporate Banking Channels",
        "documentation": "Omnichannel digital banking platforms for retail mobile/web clients and corporate banking cash management portals.",
        "properties": {"domain": "Digital Channels", "level": "Level 1"}
    },
    {
        "id": "cap-integration-platform",
        "name": "Integration Middleware & API Gateway",
        "documentation": "Service decoupling, enterprise API gateway with rate-limiting and security policies, and enterprise asynchronous Kafka event bus.",
        "properties": {"domain": "Integration Architecture", "level": "Level 1"}
    },
    {
        "id": "cap-cyber-defense",
        "name": "Cybersecurity, SIEM & Threat Detection",
        "documentation": "Security Operations Center (SOC), SIEM log and event correlation, EDR endpoint protection, and hardware cryptographic key protection via HSMs.",
        "properties": {"domain": "Cybersecurity", "level": "Level 1"}
    },
    {
        "id": "cap-procurement",
        "name": "Strategic Sourcing & Enterprise Procurement",
        "documentation": "Vendor directory management, electronic procurement, purchase orders, and third-party vendor contract administration.",
        "properties": {"domain": "Corporate Support", "level": "Level 1"}
    },
    {
        "id": "cap-esg-scoring",
        "name": "ESG Portfolio Risk & Sustainability Scoring",
        "documentation": "Environmental, Social, and Governance (ESG) factor assessment for corporate borrowers and investment portfolio assets.",
        "properties": {"domain": "Sustainable Finance", "level": "Level 1"}
    },
    {
        "id": "cap-crypto-custody",
        "name": "Digital Asset & Cryptocurrency Custody",
        "documentation": "Institutional digital asset and crypto custody utilizing multi-party computation (MPC) private keys under MiCA regulatory standards.",
        "properties": {"domain": "Digital Assets", "level": "Level 1"}
    },
    {
        "id": "cap-audit-risk",
        "name": "Internal Audit & Operational Risk Governance",
        "documentation": "Third-line audit control planning, immutable audit trails, operational risk register, and regulatory findings tracking.",
        "properties": {"domain": "Internal Audit", "level": "Level 1"}
    },
    {
        "id": "cap-trade-finance",
        "name": "Trade Finance & Working Capital Solutions",
        "documentation": "Documentary letters of credit, international bank guarantees, performance bonds, and supply chain working capital finance.",
        "properties": {"domain": "Commercial Banking", "level": "Level 1"}
    }
]

# --------------------------------------------------------------------------
# 2. APPLICATION TO CAPABILITY REALIZATION MAPPINGS
# Demonstrating strategic overlaps (Target Invest vs Candidates to Rationalize)
# --------------------------------------------------------------------------
APP_CAPABILITY_MAPPINGS = [
    # 1. CRM Overlap: Salesforce (Invest) vs Legacy Oracle CRM (Eliminate)
    ("app-salesforce", "cap-cust-mgmt"),
    ("app-legacy-crm", "cap-cust-mgmt"),

    # 2. Core Account Ledger Overlap: Thought Machine (Invest) vs Fiserv Signature (Migrate) vs AS400 Ledger (Eliminate)
    ("app-cloud-core", "cap-core-acc"),
    ("app-eb-80", "cap-core-acc"),
    ("app-legacy-ledger", "cap-core-acc"),

    # 3. Payment Processing Overlap: Stripe Modern (Invest) vs SIA/Nexi Hub (Migrate) vs RT1 TIPS (Invest)
    ("app-stripe-engine", "cap-payments"),
    ("app-legacy-pay", "cap-payments"),
    ("app-sepa-instant", "cap-payments"),

    # 4. Fraud Detection Overlap: Feedzai (Invest) vs Experian Hunter (Tolerate)
    ("app-feedzai-fraud", "cap-fraud"),
    ("app-mortgage-calc", "cap-fraud"),

    # 5. AML Screening Overlap: SAS AML (Invest) vs NICE Actimize (Tolerate) vs Fircosoft (Invest)
    ("app-eb-77", "cap-aml-screening"),
    ("app-aml-actimize", "cap-aml-screening"),
    ("app-sanctions-firco", "cap-aml-screening"),

    # 6. Document & Archive Overlap: Alfresco (Invest) vs SharePoint Legacy (Eliminate) vs EMC Centera (Eliminate) vs Glacier (Invest)
    ("app-alfresco-doc", "cap-doc"),
    ("app-old-intranet-sharepoint", "cap-doc"),
    ("app-archival-worm", "cap-doc"),
    ("app-cloud-archive-s3", "cap-doc"),

    # 7. Digital Signature Overlap: DocuSign Enterprise Trust (Invest) vs DocuSign eSignature Legacy (Migrate)
    ("app-eb-85", "cap-digital-signature"),
    ("app-docu-sign", "cap-digital-signature"),

    # 8. CIAM Overlap: Keycloak CIAM (Invest) vs PingFederate (Migrate) vs CyberArk (Invest)
    ("app-eb-75", "cap-identity-mgmt"),
    ("app-ping-identity", "cap-identity-mgmt"),
    ("app-cyberark-pam", "cap-identity-mgmt"),

    # 9. Credit Scoring Overlap: Experian PowerCurve (Invest) vs CRIF Connector (Tolerate) vs Moody's Credit (Invest)
    ("app-eb-87", "cap-credit-scoring"),
    ("app-credit-bureau", "cap-credit-scoring"),
    ("app-eb-71", "cap-credit-scoring"),

    # 10. Mortgage Origination Overlap: EasyLend Underwriting (Invest) vs Temenos Loan Orig (Tolerate) vs Legacy Collateral (Eliminate)
    ("app-eb-69", "cap-mortgage-orig"),
    ("app-loan-origination", "cap-mortgage-orig"),
    ("app-legacy-collateral", "cap-mortgage-orig"),

    # 11. Securities Trading Overlap: EasyTrade Desk (Invest) vs Fidessa OMS (Tolerate) vs Bloomberg Feed (Tolerate) vs Refinitiv (Tolerate)
    ("app-eb-68", "cap-securities-trading"),
    ("app-trading-oms", "cap-securities-trading"),
    ("app-eb-78", "cap-securities-trading"),
    ("app-market-data-refinitiv", "cap-securities-trading"),

    # 12. Wealth Management Overlap: Avaloq Wealth Core (Invest) vs Avaloq Advisory Legacy (Migrate) vs AI Copilot (Invest)
    ("app-eb-79", "cap-wealth-portfolio"),
    ("app-wealth-advisory", "cap-wealth-portfolio"),
    ("app-ai-copilot-wealth", "cap-wealth-portfolio"),

    # 13. Treasury & Cash Pooling Overlap: Bacta Treasury (Invest) vs Murex MX.3 (Invest) vs SmartStream Corona (Tolerate) vs TARGET2 (Invest)
    ("app-eb-88", "cap-treasury-cash"),
    ("app-murex-treasury", "cap-treasury-cash"),
    ("app-treasury-reconciliation", "cap-treasury-cash"),
    ("app-target2-rtgs", "cap-treasury-cash"),

    # 14. Regulatory Reporting Overlap: Puma Supervisory (Invest) vs Puma BDI Legacy (Migrate) vs KPMG Tax FATCA (Tolerate) vs Moody's IFRS9 (Invest)
    ("app-eb-73", "cap-reg-reporting"),
    ("app-reg-reporting-bdi", "cap-reg-reporting"),
    ("app-fatca-crs", "cap-reg-reporting"),
    ("app-ifrs9-impairment", "cap-reg-reporting"),

    # 15. POS Acquiring Overlap: Nexi SmartPOS (Invest) vs Worldline POS (Migrate) vs CardTech Legacy (Eliminate)
    ("app-eb-70", "cap-pos-acquiring"),
    ("app-pos-acquiring", "cap-pos-acquiring"),
    ("app-card-issuing-cms", "cap-pos-acquiring"),

    # 16. ATM Switch Overlap: Diebold Nixdorf VCP (Invest) vs Diebold Nixdorf Switch (Tolerate)
    ("app-eb-86", "cap-atm-switch"),
    ("app-atm-switch", "cap-atm-switch"),

    # 17. Business Intelligence Overlap: Snowflake DWH (Invest) vs IBM Cognos 10 (Eliminate) vs Power BI (Invest)
    ("app-snowflake-dwh", "cap-bi-analytics"),
    ("app-legacy-cognos", "cap-bi-analytics"),
    ("app-powerbi-analytics", "cap-bi-analytics"),

    # 18. ITSM & IT Ops Overlap: ServiceNow ITOM (Invest) vs ServiceNow Governance (Invest) vs Jira Confluence (Tolerate)
    ("app-servicenow-itsm", "cap-itsm-ops"),
    ("app-eb-76", "cap-itsm-ops"),
    ("app-atlassian-suite", "cap-itsm-ops"),

    # 19. SWIFT Gateway Overlap: Swift Alliance ISO20022 (Invest) vs SWIFT Alliance AMH (Migrate)
    ("app-eb-72", "cap-swift-clearing"),
    ("app-swift-alliance", "cap-swift-clearing"),

    # 20. Enterprise ERP Overlap: SAP S/4HANA (Invest) vs Oracle Hyperion (Tolerate) vs Kofax Invoice (Tolerate)
    ("app-sap-s4hana", "cap-erp-accounting"),
    ("app-eb-90", "cap-erp-accounting"),
    ("app-eb-89", "cap-erp-accounting"),

    # 21. Claims & Recovery Overlap: Soprasteria Factoring (Tolerate) vs Legacy NPL Tool (Eliminate) vs Cassiopae Leasing (Tolerate)
    ("app-factoring-suite", "cap-claims"),
    ("app-npl-collection", "cap-claims"),
    ("app-leasing-manager", "cap-claims"),

    # 22. Customer Support Overlap: Zendesk Portal (Invest) vs Cisco Webex (Invest) vs Qmatic Branch (Tolerate) vs Branch Teller (Tolerate)
    ("app-eb-84", "cap-customer-support"),
    ("app-eb-83", "cap-customer-support"),
    ("app-branch-appointment", "cap-customer-support"),
    ("app-branch-teller", "cap-customer-support"),

    # 23. Data Governance Overlap: Informatica Hub (Invest) vs Talend ETL (Tolerate) vs Access DB Filiali (Eliminate)
    ("app-eb-74", "cap-data-governance"),
    ("app-talend-etl", "cap-data-governance"),
    ("app-old-branch-archive", "cap-data-governance"),

    # 24. Integration Platform Overlap: Apigee Gateway (Invest) vs Confluent Kafka (Invest) vs TIBCO ActiveMatrix (Eliminate)
    ("app-apigee-gateway", "cap-integration-platform"),
    ("app-kafka-streaming", "cap-integration-platform"),
    ("app-legacy-esb-tibco", "cap-integration-platform"),

    # 25. Fund Accounting: Temenos Multifonds (Invest) vs Monte Titoli (Invest) vs SuperDerivatives (Tolerate)
    ("app-eb-81", "cap-fund-accounting"),
    ("app-custody-settlement", "cap-fund-accounting"),
    ("app-fx-auto-pricing", "cap-fund-accounting"),

    # 26. Digital Channels: EasyBank Mobile (Invest) vs EasyCorporate Portal (Invest) vs Open Banking PSD2 (Invest)
    ("app-mobile-retail", "cap-digital-channels"),
    ("app-corporate-portal", "cap-digital-channels"),
    ("app-open-banking-psd2", "cap-digital-channels"),

    # 27. Cybersecurity & SOC: Splunk SIEM (Invest) vs CrowdStrike EDR (Invest) vs Thales HSM (Invest)
    ("app-splunk-siem", "cap-cyber-defense"),
    ("app-crowdstrike-edr", "cap-cyber-defense"),
    ("app-thales-hsm", "cap-cyber-defense"),

    # 28. Human Capital & HR: Workday HCM (Invest) [Non-redundant, optimal]
    ("app-workday", "cap-hr"),

    # 29. Procurement & Strategic Sourcing: Coupa Sourcing (Invest) [Non-redundant, optimal]
    ("app-coupa-procure", "cap-procurement"),

    # 30. ESG Scoring: Clarity AI ESG (Invest) [Non-redundant, optimal]
    ("app-esg-scoring", "cap-esg-scoring"),

    # 31. Crypto Custody: Fireblocks Hub (Invest) [Non-redundant, optimal]
    ("app-crypto-custody", "cap-crypto-custody"),

    # 32. Internal Audit & Risk: TeamMate Audit (Invest) vs RiskMetrics VaR (Invest)
    ("app-internal-audit-teammate", "cap-audit-risk"),
    ("app-var-risk", "cap-audit-risk"),

    # 33. Trade Finance: Finastra Trade Innovation (Invest) vs Soprasteria Factoring (Tolerate)
    ("app-eb-82", "cap-trade-finance"),
    ("app-factoring-suite", "cap-trade-finance")
]


def seed_functional_overlap(db: Session):
    print("=" * 70)
    print("STARTING EASYBANK FUNCTIONAL OVERLAP SEEDING (EASY)")
    print("=" * 70)

    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == MODEL_ID).first()
    if not model:
        print(f"Error: Model {MODEL_ID} not found!")
        return

    # ----------------------------------------------------------------------
    # STEP 1: Insert / Update 33 Banking Capabilities
    # ----------------------------------------------------------------------
    print("\n--> [1/4] Censimento 33 Business Capabilities bancarie...")
    caps_created = 0
    caps_updated = 0

    for cap_data in BANKING_CAPABILITIES:
        cap_id = cap_data["id"]
        existing = db.query(ArchimateElement).filter(
            ArchimateElement.id == cap_id,
            ArchimateElement.model_id == MODEL_ID
        ).first()

        if not existing:
            elem = ArchimateElement(
                id=cap_id,
                model_id=MODEL_ID,
                name=cap_data["name"],
                type="Capability",
                layer="Strategy",
                documentation=cap_data["documentation"],
                properties=cap_data["properties"],
                stereotype_id=None,
                package_id=None,
                is_reference=False
            )
            db.add(elem)
            caps_created += 1
        else:
            existing.name = cap_data["name"]
            existing.documentation = cap_data["documentation"]
            if not existing.properties:
                existing.properties = cap_data["properties"]
            caps_updated += 1

    db.commit()
    print(f"✓ Capabilities censite: {caps_created} nuove, {caps_updated} aggiornate. Totale: {caps_created + caps_updated}")

    # ----------------------------------------------------------------------
    # STEP 2: Sync APM Attributes for all 90 Business Applications
    # ----------------------------------------------------------------------
    print("\n--> [2/4] Sincronizzazione attributi APM (Costi TCO e Quadranti TIME)...")
    all_biz_apps = db.query(ArchimateElement).filter(
        ArchimateElement.model_id == MODEL_ID,
        ArchimateElement.type == "ApplicationComponent",
        ArchimateElement.stereotype_id.isnot(None)
    ).all()

    apm_synced = 0
    for app in all_biz_apps:
        props = app.properties if isinstance(app.properties, dict) else {}
        apm = app.apm_attributes

        # Parse cost
        raw_cost = props.get("apm_annual_cost") or props.get("eea_annual_cost") or (apm.annual_cost if apm else None)
        if raw_cost is None:
            # Assign realistic banking TCO based on name/importance
            if "Core" in app.name or "Ledger" in app.name or "Trading" in app.name or "Treasury" in app.name or "S/4HANA" in app.name:
                cost = 450000.0
            elif "Payment" in app.name or "Card" in app.name or "POS" in app.name or "AML" in app.name or "Fraud" in app.name:
                cost = 250000.0
            elif "Legacy" in app.name or "10g" in app.name or "AS400" in app.name:
                cost = 180000.0
            else:
                cost = 95000.0
        else:
            try:
                cost = float(raw_cost)
            except (ValueError, TypeError):
                cost = 100000.0

        # Parse TIME quadrant
        time_override = props.get("apm_time_quadrant_override") or props.get("eea_time_quadrant") or (apm.time_quadrant if apm else None)
        if not time_override or time_override not in ("Invest", "Migrate", "Tolerate", "Eliminate"):
            if "Legacy" in app.name or "Old" in app.name or "10g" in app.name or "AS400" in app.name or "Centera" in app.name:
                time_q = "Eliminate"
            elif "Migrate" in str(props) or "Legacy" in str(props):
                time_q = "Migrate"
            elif "Cloud" in app.name or "Modern" in app.name or "Invest" in str(props) or "Snowflake" in app.name:
                time_q = "Invest"
            else:
                time_q = "Tolerate"
        else:
            time_q = time_override

        # Parse fits
        raw_bfit = props.get("apm_functional_fit") or 3
        raw_tfit = props.get("apm_technical_fit") or 3
        try:
            bfit = int(str(raw_bfit).split("-")[0].strip())
        except (ValueError, TypeError):
            bfit = 4 if time_q in ("Invest", "Tolerate") else 2
        try:
            tfit = int(str(raw_tfit).split("-")[0].strip())
        except (ValueError, TypeError):
            tfit = 4 if time_q == "Invest" else 2 if time_q in ("Migrate", "Eliminate") else 3

        crit = props.get("apm_business_criticality") or ("Mission Critical" if cost > 300000 else "Business Critical")
        l_stat = "Phase-out" if time_q == "Eliminate" else "Live"
        b_owner = props.get("apm_business_owner") or "Enterprise Architecture & Governance Unit"
        t_owner = props.get("apm_technical_owner") or "IT Systems Operation"
        vendor = props.get("apm_vendor") or "Enterprise Software Vendor"
        hosting = props.get("apm_hosting_type") or "Public Cloud"
        sla = props.get("apm_sla_level") or "Gold (99.9%)"

        if not apm:
            apm_record = ApplicationBusinessAttributes(
                element_id=app.id,
                business_fit=bfit,
                technical_fit=tfit,
                time_quadrant=time_q,
                annual_cost=cost,
                business_criticality=crit,
                lifecycle_status=l_stat,
                business_owner=b_owner,
                technical_owner=t_owner,
                vendor=vendor,
                hosting_type=hosting,
                sla_level=sla,
                in_apm_scope=True
            )
            db.add(apm_record)
        else:
            if not apm.annual_cost or apm.annual_cost == 0.0:
                apm.annual_cost = cost
            if not apm.time_quadrant:
                apm.time_quadrant = time_q
            apm.in_apm_scope = True

        # Ensure properties also match
        props["apm_annual_cost"] = cost
        props["apm_time_quadrant_override"] = time_q
        props["eea_in_apm_scope"] = "true"
        app.properties = props
        apm_synced += 1

    db.commit()
    print(f"✓ Sincronizzazione APM completata per {apm_synced} Business Applications.")

    # ----------------------------------------------------------------------
    # STEP 3: Tag internal components as not in APM scope
    # ----------------------------------------------------------------------
    print("\n--> [3/4] Esclusione 450 componenti interni dallo scope APM (is_internal_component)...")
    internal_comps = db.query(ArchimateElement).filter(
        ArchimateElement.model_id == MODEL_ID,
        ArchimateElement.type == "ApplicationComponent",
        ArchimateElement.stereotype_id.is_(None)
    ).all()

    for comp in internal_comps:
        c_props = comp.properties if isinstance(comp.properties, dict) else {}
        c_props["is_internal_component"] = True
        c_props["eea_in_apm_scope"] = "false"
        comp.properties = c_props

    db.commit()
    print(f"✓ {len(internal_comps)} componenti applicativi interni contrassegnati correttamente.")

    # ----------------------------------------------------------------------
    # STEP 4: Create Realization Relationships (App -> Capability & Sub-component -> Capability)
    # ----------------------------------------------------------------------
    print("\n--> [4/4] Creazione relazioni di Realizzazione Funzionalità per analisi Overlapping...")
    rels_created = 0

    all_apps_map = {a.id: a for a in all_biz_apps}
    all_caps_map = {c.id: c for c in db.query(ArchimateElement).filter(ArchimateElement.model_id == MODEL_ID, ArchimateElement.type == "Capability").all()}

    for app_id, cap_id in APP_CAPABILITY_MAPPINGS:
        app = all_apps_map.get(app_id)
        cap = all_caps_map.get(cap_id)
        if not app or not cap:
            continue

        # 1. Direct Realization Relationship: App -> Capability
        rel_id = f"rel-cap-realize-{app_id}-{cap_id}"[:60]
        existing_rel = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.id == rel_id,
            ArchimateRelationship.model_id == MODEL_ID
        ).first()

        if not existing_rel:
            db.add(ArchimateRelationship(
                id=rel_id,
                model_id=MODEL_ID,
                source_id=app_id,
                target_id=cap_id,
                type="RealizationRelationship",
                name="Realizes Functionality",
                documentation=f"Business application '{app.name}' implements and realizes strategic business capability '{cap.name}'."
            ))
            rels_created += 1

        # 2. Lineage Realization Relationship: Subcomponent (Core) -> Capability
        core_comp_id = f"comp-{app_id}-core"
        existing_core_comp = db.query(ArchimateElement).filter(
            ArchimateElement.id == core_comp_id,
            ArchimateElement.model_id == MODEL_ID
        ).first()

        if existing_core_comp:
            rel_comp_id = f"rel-cap-sub-{core_comp_id}-{cap_id}"[:60]
            existing_comp_rel = db.query(ArchimateRelationship).filter(
                ArchimateRelationship.id == rel_comp_id,
                ArchimateRelationship.model_id == MODEL_ID
            ).first()

            if not existing_comp_rel:
                db.add(ArchimateRelationship(
                    id=rel_comp_id,
                    model_id=MODEL_ID,
                    source_id=core_comp_id,
                    target_id=cap_id,
                    type="RealizationRelationship",
                    name="Supports Functional Domain Logic",
                    documentation=f"The core component of {app.name} executes application logic supporting business capability '{cap.name}'."
                ))
                rels_created += 1

    db.commit()
    print(f"✓ Nuove relazioni di realizzazione create: {rels_created}")

    # Final Verification Stats
    final_caps = db.query(ArchimateElement).filter(ArchimateElement.model_id == MODEL_ID, ArchimateElement.type == "Capability").count()
    final_rels = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == MODEL_ID).count()

    print("\n" + "=" * 70)
    print("RIEPILOGO ANALISI OVERLAPPING FUNZIONALE (EASY):")
    print(f"  * Business Capabilities Censite:     {final_caps}")
    print(f"  * Business Applications Collegate:   {len(all_biz_apps)}")
    print(f"  * Relazioni Totali nel Modello:      {final_rels}")
    print("=" * 70)

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_functional_overlap(db)
    finally:
        db.close()
