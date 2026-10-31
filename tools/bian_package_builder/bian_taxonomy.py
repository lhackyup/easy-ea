"""
BIAN Service Landscape v12.0 Taxonomy Definition
Canonical classification of Banking Industry Architecture Network structural layers:
Business Areas, Business Domains, and Service Domains.
"""

from typing import Dict, List, Any

# 1. BIAN Business Areas (Top Level Functional Taxonomy)
BIAN_BUSINESS_AREAS = [
    {
        "code": "BA-ENT",
        "name": "Enterprise Management",
        "description": "Enterprise-wide strategy, corporate governance, organizational design, financial planning, and portfolio management.",
        "domains": [
            {"code": "BD-ENT-GOV", "name": "Corporate Governance & Strategy", "description": "Board management, corporate planning, policies and business architecture."},
            {"code": "BD-ENT-FIN", "name": "Corporate Finance & Capital", "description": "Capital allocation, treasury strategy, statutory accounting and dividend management."},
            {"code": "BD-ENT-HR", "name": "Human Resources Management", "description": "Talent acquisition, employee lifecycle, payroll and compensation administration."}
        ]
    },
    {
        "code": "BA-BDM",
        "name": "Business Development & Marketing",
        "description": "Market intelligence, brand promotion, product portfolio design, advertising, and strategic commercial partnerships.",
        "domains": [
            {"code": "BD-BDM-MKT", "name": "Marketing & Communications", "description": "Brand management, customer market research, media planning, and advertising campaigns."},
            {"code": "BD-BDM-PRD", "name": "Product Design & Innovation", "description": "Financial product lifecycle management, proposition engineering, and pricing models."}
        ]
    },
    {
        "code": "BA-SLS",
        "name": "Sales & Service",
        "description": "Omnichannel customer engagement, customer relationship management, sales origination, customer servicing, and contact management.",
        "domains": [
            {"code": "BD-SLS-CHN", "name": "Channel Operations & Delivery", "description": "Branch network, ATM fleet, mobile banking, internet portal, and contact center operations."},
            {"code": "BD-SLS-CRM", "name": "Customer Relationship & Care", "description": "Customer inquiry handling, customer experience, customer profile dialogue, and case servicing."},
            {"code": "BD-SLS-ORG", "name": "Sales Origination & Onboarding", "description": "Lead management, sales pipeline, product matching, quotation, and contract signing."}
        ]
    },
    {
        "code": "BA-OPS",
        "name": "Operations & Execution",
        "description": "Core product fulfillment, trade execution, transaction processing, clearing, settlement, payments, and account ledger management.",
        "domains": [
            {"code": "BD-OPS-ACC", "name": "Accounts & Deposits Operations", "description": "Current accounts, savings, term deposits, deposit ledger, and interest calculation."},
            {"code": "BD-OPS-PAY", "name": "Payment & Cash Operations", "description": "Payment execution, ACH transfers, wire clearing, SEPA, SWIFT, and cash vault operations."},
            {"code": "BD-OPS-CRD", "name": "Card Systems & Clearing", "description": "Card issuance, card authorization, transaction capture, merchant acquiring, and clearing."},
            {"code": "BD-OPS-LEN", "name": "Loans & Credit Facilities", "description": "Consumer loans, corporate credit facilities, mortgages, revolving credit, and debt collection."},
            {"code": "BD-OPS-TRD", "name": "Trade Banking & Guarantees", "description": "Letters of credit, documentary collections, bank guarantees, and export financing."}
        ]
    },
    {
        "code": "BA-MKT",
        "name": "Market Operations & Treasury",
        "description": "Wholesale market execution, liquidity management, treasury trading desks, foreign exchange, and portfolio asset custody.",
        "domains": [
            {"code": "BD-MKT-TRS", "name": "Treasury & Liquidity", "description": "Asset and liability management (ALM), interbank money market, and intraday liquidity."},
            {"code": "BD-MKT-SEC", "name": "Securities & Custody Operations", "description": "Securities clearing, global custody, corporate actions, and dividend reconciliation."},
            {"code": "BD-MKT-VAL", "name": "Financial Instrument Valuation", "description": "Mark-to-market pricing, yield curve valuation, and derivatives appraisal."}
        ]
    },
    {
        "code": "BA-RSK",
        "name": "Risk & Compliance",
        "description": "Enterprise risk control, regulatory compliance, credit underwriting risk, market risk models, fraud detection, and financial crime prevention.",
        "domains": [
            {"code": "BD-RSK-FRD", "name": "Fraud Detection & Financial Crime", "description": "Real-time fraud scoring, behavioral transaction monitoring, anti-money laundering (AML)."},
            {"code": "BD-RSK-CRD", "name": "Credit & Market Risk Control", "description": "Counterparty credit risk, default probability, Value at Risk (VaR), and stress testing."},
            {"code": "BD-RSK-REG", "name": "Regulatory Compliance & Audit", "description": "Statutory reporting, prudential supervisory audit (Basel IV/EBA), and sanction screening."}
        ]
    },
    {
        "code": "BA-REF",
        "name": "Reference Data & Directories",
        "description": "Enterprise master data management, counterparty directories, product catalog, customer identity registers, and geographical location data.",
        "domains": [
            {"code": "BD-REF-PTY", "name": "Party & Customer Master Data", "description": "Master registry for individual and legal entity counterparties, KYC dossiers, and relationships."},
            {"code": "BD-REF-CAT", "name": "Product & Service Directory", "description": "Canonical reference catalog of banking services, standard tariffs, and terms."},
            {"code": "BD-REF-LOC", "name": "Location & Currency Master Data", "description": "Geographical locations, branch registries, BIC/SWIFT directories, and currency codes."}
        ]
    },
    {
        "code": "BA-COR",
        "name": "Corporate Shared Services",
        "description": "Shared administrative operations, procurement, physical security, document archiving, and legal advisory.",
        "domains": [
            {"code": "BD-COR-DOC", "name": "Document & Archive Services", "description": "Electronic document archive, paper records custody, OCR indexing, and retention management."},
            {"code": "BD-COR-PRC", "name": "Procurement & Vendor Management", "description": "Vendor contracts, third-party risk management (TPRM), and purchase order settlement."},
            {"code": "BD-COR-ITG", "name": "Information Technology Governance", "description": "IT services management, API gateway management, system integration and cyber defense."}
        ]
    }
]

# Mapping rules from Service Domain Name keyword / pattern to Business Domain & Area
SERVICE_DOMAIN_TAXONOMY_RULES = [
    # Card Operations
    (lambda name: "card" in name.lower(), "BD-OPS-CRD", "Core Banking", "Execute", "Card Transaction"),
    # Payment Operations
    (lambda name: any(w in name.lower() for w in ["payment", "ach", "wire", "clearing", "settlement", "bankdraft"]), "BD-OPS-PAY", "Core Banking", "Execute", "Payment Instruction"),
    # Account & Deposit Operations
    (lambda name: any(w in name.lower() for w in ["account", "deposit", "savings", "reconciliation"]), "BD-OPS-ACC", "Core Banking", "Fulfill", "Account Ledger"),
    # Loans & Credit
    (lambda name: any(w in name.lower() for w in ["loan", "credit", "mortgage", "facility", "leasing", "underwriting"]), "BD-OPS-LEN", "Core Banking", "Fulfill", "Credit Agreement"),
    # Trade Banking
    (lambda name: any(w in name.lower() for w in ["guarantee", "letterofcredit", "tradebanking", "export"]), "BD-OPS-TRD", "Core Banking", "Fulfill", "Trade Instrument"),
    # Treasury & Valuation
    (lambda name: any(w in name.lower() for w in ["valuation", "treasury", "liquidity", "yield", "assetandliability", "securitization"]), "BD-MKT-VAL", "Market Operations", "Operate", "Market Portfolio"),
    # Fraud & Crime
    (lambda name: any(w in name.lower() for w in ["fraud", "anti-money", "aml", "compliance", "sanction", "financialcrime"]), "BD-RSK-FRD", "Generic", "Operate", "Risk Assessment"),
    # Credit Risk & Risk Models
    (lambda name: any(w in name.lower() for w in ["risk", "audit", "regulatory", "basel"]), "BD-RSK-CRD", "Generic", "Manage", "Risk Metric"),
    # Party & KYC
    (lambda name: any(w in name.lower() for w in ["party", "customer", "kyc", "identity", "authentication"]), "BD-REF-PTY", "Generic", "Manage", "Party Dossier"),
    # Channel Delivery
    (lambda name: any(w in name.lower() for w in ["branch", "atm", "contactcenter", "voice", "mobile", "channel", "pos", "terminal"]), "BD-SLS-CHN", "Channel", "Operate", "Channel Session"),
    # Sales & CRM
    (lambda name: any(w in name.lower() for w in ["sales", "lead", "quotation", "offer", "prospect", "servicing", "care"]), "BD-SLS-CRM", "Channel", "Agree", "Customer Interaction"),
    # Marketing & Brand
    (lambda name: any(w in name.lower() for w in ["marketing", "brand", "advertising", "campaign", "development"]), "BD-BDM-MKT", "Generic", "Design", "Campaign Asset"),
    # Document & Corporate
    (lambda name: any(w in name.lower() for w in ["archive", "document", "procurement", "vendor", "facility"]), "BD-COR-DOC", "Generic", "Operate", "Corporate Record"),
]

def classify_service_domain(name: str) -> Dict[str, str]:
    """Classifies a Service Domain into its Business Domain, Domain Type, Behavior Pattern and Asset Type."""
    for rule, bd_code, domain_type, pattern, asset_type in SERVICE_DOMAIN_TAXONOMY_RULES:
        if rule(name):
            return {
                "business_domain_code": bd_code,
                "domain_type": domain_type,
                "pattern": pattern,
                "asset_type": asset_type
            }
    # Default fallback
    return {
        "business_domain_code": "BD-OPS-ACC",
        "domain_type": "Core Banking",
        "pattern": "Fulfill",
        "asset_type": f"{name} Record"
    }
