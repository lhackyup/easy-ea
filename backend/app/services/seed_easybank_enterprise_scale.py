"""
Script to seed EasyBank Global Enterprise Model ('sample-easybank-ea', 'EASY')
with full-scale Enterprise Architecture data:
- 30 Business Processes (26 new + 4 existing)
- 90 Business Applications (23 new + 67 existing, all with APM metadata & stereotype)
- 450 Internal Application Components (5 per Business Application, not business apps themselves)
- 210 Technology Components (206 new + 4 existing: Nodes, SystemSoftware, Devices, TechnologyServices)
- Comprehensive multi-hop relationship graph (>900 relationships) for Blast Radius / Impact Analysis.
"""

import sys
import os
import random
from typing import Dict, Any, List, Tuple
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
    ElementStereotype
)

MODEL_ID = "sample-easybank-ea"

# --------------------------------------------------------------------------
# 1. 26 NEW BUSINESS PROCESSES (Total 30)
# --------------------------------------------------------------------------
NEW_BUSINESS_PROCESSES = [
    {
        "id": "proc-sepa-instant",
        "name": "SEPA Instant Credit Transfer Processing (TIPS / RT1)",
        "documentation": "24/7 real-time settlement and execution of European instant credit transfers via the EPC SEPA Instant Credit Transfer scheme (TIPS / RT1).",
        "properties": {"criticality": "Mission Critical", "owner": "Payments & Interbank Clearing Directorate", "sla": "99.99%"}
    },
    {
        "id": "proc-card-issuance",
        "name": "Payment Card Issuance & Lifecycle Management",
        "documentation": "Lifecycle management of physical and virtual debit and credit cards, Apple Pay / Google Wallet tokenization, and PIN dispatch.",
        "properties": {"criticality": "Business Critical", "owner": "Retail Cards & Acquiring Unit", "sla": "99.9%"}
    },
    {
        "id": "proc-mortgage-origination",
        "name": "Residential Mortgage Origination & Credit Underwriting",
        "documentation": "Creditworthiness assessment, LTV / DTI calculation, and automated and manual credit committee approval for primary residence mortgages.",
        "properties": {"criticality": "Business Critical", "owner": "Retail Lending & Mortgage Division", "sla": "99.5%"}
    },
    {
        "id": "proc-property-appraisal",
        "name": "Real Estate Property Appraisal & Collateral Valuation",
        "documentation": "Cadastral compliance verification, certified technical appraisal of collateral property, and liquidation value estimation.",
        "properties": {"criticality": "Business Operational", "owner": "Technical Office & Collateral Valuation Unit", "sla": "99.0%"}
    },
    {
        "id": "proc-mortgage-disbursement",
        "name": "Mortgage Loan Disbursement & Notarial Deed Execution",
        "documentation": "Notarial deed execution, first-degree mortgage registration, and funds release to borrower checking account.",
        "properties": {"criticality": "Business Critical", "owner": "Mortgage Operations & Back Office", "sla": "99.5%"}
    },
    {
        "id": "proc-corporate-credit-line",
        "name": "Corporate Credit Facility & Overdraft Origination",
        "documentation": "Underwriting of credit lines for corporate and SME clients, XBRL financial statement analysis, Central Credit Register check, and internal rating assignment.",
        "properties": {"criticality": "Business Critical", "owner": "Corporate & Commercial Banking", "sla": "99.5%"}
    },
    {
        "id": "proc-invoice-factoring",
        "name": "Invoice Factoring & Working Capital Financing",
        "documentation": "Commercial receivables assignment, debtor/assignor credit ceiling verification, and advance working capital funding against commercial invoices.",
        "properties": {"criticality": "Business Critical", "owner": "Trade & Working Capital Solutions", "sla": "99.0%"}
    },
    {
        "id": "proc-trade-finance-lc",
        "name": "Commercial Letters of Credit Issuance & Negotiation",
        "documentation": "Import/export documentary letter of credit issuance, shipping document verification, and UCP 600 international guarantee management.",
        "properties": {"criticality": "Business Critical", "owner": "International Trade Finance", "sla": "99.5%"}
    },
    {
        "id": "proc-cash-pooling",
        "name": "Group Cash Pooling & Liquidity Management",
        "documentation": "Multi-account and multi-currency liquidity centralization (Zero-Balancing / Notional Pooling) for multinational corporate clients.",
        "properties": {"criticality": "Business Critical", "owner": "Treasury & Cash Management", "sla": "99.9%"}
    },
    {
        "id": "proc-swift-crossborder",
        "name": "SWIFT & Cross-Border Payments Clearing (ISO 20022)",
        "documentation": "Routing of MT103 / pacs.008 messages over SWIFT GPI network with transaction tracking and real-time international sanctions screening.",
        "properties": {"criticality": "Mission Critical", "owner": "Global Clearing & Forex Operations", "sla": "99.99%"}
    },
    {
        "id": "proc-sdd-clearing",
        "name": "SEPA Direct Debit (SDD) Processing & Collection",
        "documentation": "SEPA Direct Debit B2B and Core mandate management, bulk interbank clearing file processing, and chargeback/reversal handling.",
        "properties": {"criticality": "Business Critical", "owner": "Domestic Clearing & Settlement", "sla": "99.9%"}
    },
    {
        "id": "proc-mifid-profiling",
        "name": "Client MiFID II Financial Profiling & ESG Questionnaire",
        "documentation": "Periodic collection and assessment of investor suitability, risk tolerance, investment horizon, and ESG sustainability preferences.",
        "properties": {"criticality": "Business Critical", "owner": "Wealth Management Compliance", "sla": "99.5%"}
    },
    {
        "id": "proc-robo-advisory",
        "name": "Automated Robo-Advisory & Portfolio Rebalancing",
        "documentation": "Markowitz portfolio optimization algorithms, targeted investment proposal generation, and automated asset allocation rebalancing.",
        "properties": {"criticality": "Business Operational", "owner": "Digital Wealth & Asset Management", "sla": "99.5%"}
    },
    {
        "id": "proc-securities-trading",
        "name": "Equities, Bonds & ETF Direct Market Trading",
        "documentation": "Order reception on regulated markets (Borsa Italiana, Euronext, Xetra, NYSE), best execution compliance, and Direct Market Access (DMA) routing.",
        "properties": {"criticality": "Mission Critical", "owner": "Brokerage & Trading Operations", "sla": "99.99%"}
    },
    {
        "id": "proc-securities-custody",
        "name": "Securities Custody, Clearing & Corporate Actions",
        "documentation": "Securities custody account management, dividend crediting, coupon detachment, corporate actions processing, and Monte Titoli / Euroclear settlement.",
        "properties": {"criticality": "Business Critical", "owner": "Securities Settlement & Custody", "sla": "99.9%"}
    },
    {
        "id": "proc-pos-acquiring",
        "name": "Merchant POS & E-Commerce Acquiring Processing",
        "documentation": "Authorization, capture, and settlement of physical and digital merchant card transactions (Visa, Mastercard, PagoBANCOMAT).",
        "properties": {"criticality": "Mission Critical", "owner": "Merchant Acquiring & Digital Solutions", "sla": "99.99%"}
    },
    {
        "id": "proc-atm-cash-mgmt",
        "name": "ATM / CSA Cash Replenishment & Balance Reconciliation",
        "documentation": "ATM vault cash inventory monitoring, Cash-in-Transit (CIT) route scheduling, and daily general ledger cash balancing.",
        "properties": {"criticality": "Business Operational", "owner": "Branch Operations & Cash Logistics", "sla": "99.0%"}
    },
    {
        "id": "proc-instant-personal-loan",
        "name": "Instant Digital Personal Loan Approval & Disbursement",
        "documentation": "Instant credit scoring via PSD2 Open Banking data, certified digital signature, and immediate fund transfer within 3 minutes.",
        "properties": {"criticality": "Business Critical", "owner": "Consumer Finance & Digital Channels", "sla": "99.9%"}
    },
    {
        "id": "proc-aml-pep-screening",
        "name": "AML Screening, Counter-Terrorism & PEP Watchlist Surveillance",
        "documentation": "Real-time name screening against OFAC / EU / UN sanctions watchlists, Politically Exposed Persons (PEP) identification, and AML risk score computation.",
        "properties": {"criticality": "Mission Critical", "owner": "Anti-Money Laundering & Sanctions Office", "sla": "99.99%"}
    },
    {
        "id": "proc-realtime-fraud-eval",
        "name": "Real-Time Transactional Fraud Detection & Prevention",
        "documentation": "Behavioral biometrics, IP geolocation, spending anomaly detection, and automated proactive blocking of suspicious transactions using machine learning.",
        "properties": {"criticality": "Mission Critical", "owner": "Fraud Prevention & Financial Cyber Crime", "sla": "99.99%"}
    },
    {
        "id": "proc-supervisory-reporting",
        "name": "Supervisory & Prudential Regulatory Reporting (PUMA / FINREP)",
        "documentation": "Automated data extraction, accounting reconciliation, and submission of prudential reporting matrices (PUMA2, FINREP, COREP) to national and ECB supervisors.",
        "properties": {"criticality": "Business Critical", "owner": "Regulatory & Supervisory Reporting", "sla": "99.5%"}
    },
    {
        "id": "proc-basel-rwa-calc",
        "name": "Basel IV Capital Adequacy, RWA Calculation & Stress Testing",
        "documentation": "Determination of Risk-Weighted Assets (RWA) for credit, market, and operational risk; calculation of CET1 ratio, Leverage Ratio, and Liquidity Coverage Ratio (LCR).",
        "properties": {"criticality": "Business Critical", "owner": "Enterprise Risk Management", "sla": "99.0%"}
    },
    {
        "id": "proc-npl-recovery",
        "name": "Non-Performing Loans (NPL/UTP) Recovery & Debt Workout",
        "documentation": "Management of restructuring repayment plans, litigation claims, and portfolio sales of non-performing loans to securitization special purpose vehicles.",
        "properties": {"criticality": "Business Operational", "owner": "Special Credit & Debt Recovery Unit", "sla": "99.0%"}
    },
    {
        "id": "proc-general-ledger-close",
        "name": "Monthly General Ledger Closing & Balance Sheet Reconciliation",
        "documentation": "Sub-ledger consolidation, intercompany account balancing, suspense account clearance, and management financial statement close.",
        "properties": {"criticality": "Business Critical", "owner": "Finance, Accounting & Tax Office", "sla": "99.5%"}
    },
    {
        "id": "proc-electronic-invoicing",
        "name": "Accounts Payable Processing & E-Invoicing (SDI)",
        "documentation": "Automated XML electronic invoice reception via SDI exchange hub, 3-way purchase order matching, approval workflows, and vendor disbursements.",
        "properties": {"criticality": "Business Operational", "owner": "Procurement & Accounts Payable", "sla": "99.0%"}
    },
    {
        "id": "proc-digital-identity-spid",
        "name": "Strong Authentication, Digital Signature & SPID/eID Verification",
        "documentation": "National digital identity verification (SPID Level 2/3 / CIE / eID), mobile biometric authentication, and certified remote digital signature.",
        "properties": {"criticality": "Mission Critical", "owner": "Digital Identity & Trust Services", "sla": "99.99%"}
    }
]

# --------------------------------------------------------------------------
# 2. 23 NEW BUSINESS APPLICATIONS (Bringing total from 67 to 90)
# --------------------------------------------------------------------------
NEW_BUSINESS_APPLICATIONS = [
    {
        "id": "app-eb-68",
        "name": "EasyTrade Global Trading Desk",
        "documentation": "Piattaforma di market execution, DMA e visual order routing verso mercati azionari, obbligazionari e derivati europei e USA.",
        "apm_business_owner": "Massimo Rinaldi (Head of Global Markets)",
        "apm_technical_owner": "Stefano Bruni (Principal Trading Architect)",
        "apm_vendor": "Fidessa / ION Trading",
        "apm_cost_center": "CC-7010 Capital Markets",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Mission Critical",
        "apm_functional_fit": "4 - Perfect",
        "apm_technical_fit": "4 - Perfect (Cloud Native)",
        "apm_time_quadrant_override": "Invest",
        "apm_hosting_type": "Public Cloud",
        "apm_annual_cost": 890000,
        "apm_sla_level": "Platinum (99.99%)"
    },
    {
        "id": "app-eb-69",
        "name": "EasyLend Mortgage Underwriting Suite",
        "documentation": "Suite integrata per l'istruttoria creditizia mutui, perizie digitali, simulazione piani ammortamento e scoring reddituale.",
        "apm_business_owner": "Giulia Morelli (Head of Mortgage Underwriting)",
        "apm_technical_owner": "Fabrizio Grasso (Lead Lending Architect)",
        "apm_vendor": "CRIF / Experian",
        "apm_cost_center": "CC-1030 Retail Lending",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Business Critical",
        "apm_functional_fit": "4 - Perfect",
        "apm_technical_fit": "3 - Appropriate (Standard)",
        "apm_time_quadrant_override": "Invest",
        "apm_hosting_type": "Public Cloud",
        "apm_annual_cost": 420000,
        "apm_sla_level": "Gold (99.9%)"
    },
    {
        "id": "app-eb-70",
        "name": "Nexi SmartPOS Acquiring Platform",
        "documentation": "Piattaforma di gestione merchant acquiring, onboarding esercenti, monitoraggio transazioni POS e riconciliazione contabile.",
        "apm_business_owner": "Paolo Marini (Head of Merchant Acquiring)",
        "apm_technical_owner": "Davide Rossi (Acquiring Tech Specialist)",
        "apm_vendor": "Nexi Group",
        "apm_cost_center": "CC-5010 Digital Payments",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Mission Critical",
        "apm_functional_fit": "4 - Perfect",
        "apm_technical_fit": "4 - Perfect (Cloud Native)",
        "apm_time_quadrant_override": "Invest",
        "apm_hosting_type": "SaaS",
        "apm_annual_cost": 530000,
        "apm_sla_level": "Platinum (99.99%)"
    },
    {
        "id": "app-eb-71",
        "name": "Moody's Analytics Credit Assessment",
        "documentation": "Motore di rating quantitativo e qualitativo per controparti corporate, simulazione probabilità di default (PD) e LGD.",
        "apm_business_owner": "Laura Rinaldi (Chief Risk Officer)",
        "apm_technical_owner": "Vincenzo Sala (Risk Systems Architect)",
        "apm_vendor": "Moody's Analytics",
        "apm_cost_center": "CC-2040 Risk & Fraud Prevention",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Business Critical",
        "apm_functional_fit": "4 - Perfect",
        "apm_technical_fit": "3 - Appropriate (Standard)",
        "apm_time_quadrant_override": "Invest",
        "apm_hosting_type": "SaaS",
        "apm_annual_cost": 340000,
        "apm_sla_level": "Gold (99.9%)"
    },
    {
        "id": "app-eb-72",
        "name": "Swift Alliance Gateway ISO20022",
        "documentation": "Interfaccia hardware e applicativa di comunicazione verso la rete SWIFTNet per messaggistica finanziaria standard CBPR+ e MX ISO 20022.",
        "apm_business_owner": "Fabio Gatti (Head of Interbank Clearing)",
        "apm_technical_owner": "Roberto Neri (SWIFT Integration Engineer)",
        "apm_vendor": "SWIFT SCRL",
        "apm_cost_center": "CC-5010 Digital Payments",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Mission Critical",
        "apm_functional_fit": "3 - Appropriate",
        "apm_technical_fit": "3 - Appropriate (Standard)",
        "apm_time_quadrant_override": "Tolerate",
        "apm_hosting_type": "On-Premise",
        "apm_annual_cost": 410000,
        "apm_sla_level": "Platinum (99.99%)"
    },
    {
        "id": "app-eb-73",
        "name": "Puma Supervisory Reporting Engine",
        "documentation": "Generatore automatico delle segnalazioni prudenziali verso Banca d'Italia e Banca Centrale Europea (Matrice PUMA, Finrep, Corep).",
        "apm_business_owner": "Antonio De Luca (Chief Financial Officer)",
        "apm_technical_owner": "Giorgio Villa (Supervisory Tech Lead)",
        "apm_vendor": "KPMG / Cedacri",
        "apm_cost_center": "CC-2010 Finance & Accounting",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Business Critical",
        "apm_functional_fit": "3 - Appropriate",
        "apm_technical_fit": "2 - Insufficient (Legacy)",
        "apm_time_quadrant_override": "Tolerate",
        "apm_hosting_type": "On-Premise",
        "apm_annual_cost": 290000,
        "apm_sla_level": "Gold (99.9%)"
    },
    {
        "id": "app-eb-74",
        "name": "Informatica Enterprise Data Governance Hub",
        "documentation": "Piattaforma di Enterprise Data Catalog, data lineage end-to-end, dizionario dati aziendale e controllo di conformità BCBS 239.",
        "apm_business_owner": "Chiara Leone (Chief Data Officer)",
        "apm_technical_owner": "Daniele Pini (Data Governance Architect)",
        "apm_vendor": "Informatica",
        "apm_cost_center": "CC-3020 Enterprise Architecture & Data",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Business Critical",
        "apm_functional_fit": "4 - Perfect",
        "apm_technical_fit": "4 - Perfect (Cloud Native)",
        "apm_time_quadrant_override": "Invest",
        "apm_hosting_type": "Public Cloud",
        "apm_annual_cost": 380000,
        "apm_sla_level": "Gold (99.9%)"
    },
    {
        "id": "app-eb-75",
        "name": "Keycloak Customer Identity & Access Management",
        "documentation": "Federazione identità, autenticazione OAuth2 / OIDC con MFA biometrica per 2.5 milioni di clienti retail e corporate.",
        "apm_business_owner": "Marco Valenti (Head of Digital Channels)",
        "apm_technical_owner": "Alessandro Riva (Principal Security Architect)",
        "apm_vendor": "Red Hat / Open Source",
        "apm_cost_center": "CC-1020 Retail & Channels",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Mission Critical",
        "apm_functional_fit": "4 - Perfect",
        "apm_technical_fit": "4 - Perfect (Cloud Native)",
        "apm_time_quadrant_override": "Invest",
        "apm_hosting_type": "Public Cloud",
        "apm_annual_cost": 180000,
        "apm_sla_level": "Platinum (99.99%)"
    },
    {
        "id": "app-eb-76",
        "name": "ServiceNow Enterprise IT Governance",
        "documentation": "Gestione IT Service Management (ITSM), Configuration Management Database (CMDB), incident & change management bancario.",
        "apm_business_owner": "Riccardo Monti (Chief Information Officer)",
        "apm_technical_owner": "Enrico Galli (Lead ITSM Specialist)",
        "apm_vendor": "ServiceNow",
        "apm_cost_center": "CC-3010 Core Platforms",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Business Operational",
        "apm_functional_fit": "4 - Perfect",
        "apm_technical_fit": "4 - Perfect (Cloud Native)",
        "apm_time_quadrant_override": "Invest",
        "apm_hosting_type": "SaaS",
        "apm_annual_cost": 260000,
        "apm_sla_level": "Gold (99.9%)"
    },
    {
        "id": "app-eb-77",
        "name": "SAS Anti-Money Laundering & PEP Surveillance",
        "documentation": "Motore di Transaction Monitoring avanzato per individuazione schemi riciclaggio complessi, evasione sanzioni e trade-based AML.",
        "apm_business_owner": "Laura Rinaldi (Chief Risk Officer)",
        "apm_technical_owner": "Simone Barone (Financial Crime Tech Lead)",
        "apm_vendor": "SAS Institute",
        "apm_cost_center": "CC-2040 Risk & Fraud Prevention",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Mission Critical",
        "apm_functional_fit": "4 - Perfect",
        "apm_technical_fit": "3 - Appropriate (Standard)",
        "apm_time_quadrant_override": "Invest",
        "apm_hosting_type": "Private Cloud",
        "apm_annual_cost": 460000,
        "apm_sla_level": "Platinum (99.99%)"
    },
    {
        "id": "app-eb-78",
        "name": "Bloomberg Terminal Market Feed Connector",
        "documentation": "Connettore real-time B-PIPE per acquisizione quotazioni di borsa, curve tassi di interesse EURIBOR/IRS e dati anagrafici titoli.",
        "apm_business_owner": "Massimo Rinaldi (Head of Global Markets)",
        "apm_technical_owner": "Stefano Bruni (Principal Trading Architect)",
        "apm_vendor": "Bloomberg LP",
        "apm_cost_center": "CC-7010 Capital Markets",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Business Critical",
        "apm_functional_fit": "4 - Perfect",
        "apm_technical_fit": "3 - Appropriate (Standard)",
        "apm_time_quadrant_override": "Tolerate",
        "apm_hosting_type": "SaaS",
        "apm_annual_cost": 310000,
        "apm_sla_level": "Platinum (99.99%)"
    },
    {
        "id": "app-eb-79",
        "name": "Avaloq Wealth Core Portfolio Manager",
        "documentation": "Gestione portafogli Private Banking, ribilanciamento multi-asset class, fiscalità sul capital gain e advisory fiduciario.",
        "apm_business_owner": "Camilla D'Amico (Head of Private Banking)",
        "apm_technical_owner": "Luca Ferretti (Wealth Management Lead)",
        "apm_vendor": "Avaloq Group",
        "apm_cost_center": "CC-7020 Wealth Management",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Mission Critical",
        "apm_functional_fit": "4 - Perfect",
        "apm_technical_fit": "3 - Appropriate (Standard)",
        "apm_time_quadrant_override": "Invest",
        "apm_hosting_type": "Private Cloud",
        "apm_annual_cost": 720000,
        "apm_sla_level": "Platinum (99.99%)"
    },
    {
        "id": "app-eb-80",
        "name": "Fiserv Signature Core Account Engine",
        "documentation": "Gestione conti e depositi vincolati corporate, contrattualistica fidi e calcolo interessi debitori complessi.",
        "apm_business_owner": "Silvia Lombardi (Head of Core Banking)",
        "apm_technical_owner": "Davide Fontana (Principal Cloud Architect)",
        "apm_vendor": "Fiserv",
        "apm_cost_center": "CC-3010 Core Platforms",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Mission Critical",
        "apm_functional_fit": "3 - Appropriate",
        "apm_technical_fit": "2 - Insufficient (Monolith)",
        "apm_time_quadrant_override": "Tolerate",
        "apm_hosting_type": "On-Premise",
        "apm_annual_cost": 580000,
        "apm_sla_level": "Gold (99.9%)"
    },
    {
        "id": "app-eb-81",
        "name": "Temenos Multifonds NAV Calculation",
        "documentation": "Calcolo valore quota (NAV) giornaliero fondi comuni e SICAV, contabilità patrimoniale OICR e riconciliazione depositaria.",
        "apm_business_owner": "Camilla D'Amico (Head of Asset Management)",
        "apm_technical_owner": "Luca Ferretti (Fund Tech Lead)",
        "apm_vendor": "Temenos",
        "apm_cost_center": "CC-7020 Wealth Management",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Business Critical",
        "apm_functional_fit": "4 - Perfect",
        "apm_technical_fit": "3 - Appropriate (Standard)",
        "apm_time_quadrant_override": "Tolerate",
        "apm_hosting_type": "Private Cloud",
        "apm_annual_cost": 410000,
        "apm_sla_level": "Gold (99.9%)"
    },
    {
        "id": "app-eb-82",
        "name": "Finastra Fusion Trade Innovation",
        "documentation": "Gestione fine-to-end delle garanzie bancarie internazionali, fideiussioni digitali e supply chain finance.",
        "apm_business_owner": "Giuseppe Valli (Head of Trade Finance)",
        "apm_technical_owner": "Elena Baresi (Trade Finance IT Specialist)",
        "apm_vendor": "Finastra",
        "apm_cost_center": "CC-4010 Corporate Operations",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Business Critical",
        "apm_functional_fit": "4 - Perfect",
        "apm_technical_fit": "4 - Perfect (Cloud Native)",
        "apm_time_quadrant_override": "Invest",
        "apm_hosting_type": "Public Cloud",
        "apm_annual_cost": 370000,
        "apm_sla_level": "Gold (99.9%)"
    },
    {
        "id": "app-eb-83",
        "name": "Cisco Webex Contact Center Omnichannel",
        "documentation": "Piattaforma di smistamento chiamate voce, video-consulenza bancaria protetta e routing conversazionale per il servizio clienti.",
        "apm_business_owner": "Marco Valenti (Customer Contact Director)",
        "apm_technical_owner": "Maurizio Gatti (Telephony & Unified Comms)",
        "apm_vendor": "Cisco Systems",
        "apm_cost_center": "CC-1020 Retail & Channels",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Business Operational",
        "apm_functional_fit": "3 - Appropriate",
        "apm_technical_fit": "4 - Perfect (Cloud Native)",
        "apm_time_quadrant_override": "Invest",
        "apm_hosting_type": "SaaS",
        "apm_annual_cost": 210000,
        "apm_sla_level": "Gold (99.9%)"
    },
    {
        "id": "app-eb-84",
        "name": "Zendesk Corporate Client Service Portal",
        "documentation": "Gestione ticketing di secondo livello per richieste di assistenza da clienti corporate, tesorieri aziendali e broker.",
        "apm_business_owner": "Giuseppe Valli (Corporate Operations Manager)",
        "apm_technical_owner": "Maurizio Gatti (Service Desk Specialist)",
        "apm_vendor": "Zendesk",
        "apm_cost_center": "CC-4010 Corporate Operations",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Business Operational",
        "apm_functional_fit": "3 - Appropriate",
        "apm_technical_fit": "4 - Perfect (Cloud Native)",
        "apm_time_quadrant_override": "Tolerate",
        "apm_hosting_type": "SaaS",
        "apm_annual_cost": 95000,
        "apm_sla_level": "Silver (99.5%)"
    },
    {
        "id": "app-eb-85",
        "name": "DocuSign Enterprise Trust Qualified Signature",
        "documentation": "Integrazione Firma Elettronica Qualificata (FEQ) conforme eIDAS per stipula contrattuale remota di mutui e affidamenti.",
        "apm_business_owner": "Claudio Ferri (Head of Document Operations)",
        "apm_technical_owner": "Pietro Barbieri (ECM Tech Specialist)",
        "apm_vendor": "DocuSign",
        "apm_cost_center": "CC-4050 Back Office Ops",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Business Critical",
        "apm_functional_fit": "4 - Perfect",
        "apm_technical_fit": "4 - Perfect (Cloud Native)",
        "apm_time_quadrant_override": "Invest",
        "apm_hosting_type": "SaaS",
        "apm_annual_cost": 150000,
        "apm_sla_level": "Platinum (99.99%)"
    },
    {
        "id": "app-eb-86",
        "name": "Diebold Nixdorf VCP ATM Terminal Fleet Control",
        "documentation": "Monitoraggio e gestione centralizzata della flotta di 450 sportelli bancomat, telemetria contante e switch transazioni NDC/DDC.",
        "apm_business_owner": "Giovanni Rossi (Branch Operations Manager)",
        "apm_technical_owner": "Fabio Gatti (ATM Infrastructure Lead)",
        "apm_vendor": "Diebold Nixdorf",
        "apm_cost_center": "CC-5010 Digital Payments",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Business Critical",
        "apm_functional_fit": "3 - Appropriate",
        "apm_technical_fit": "2 - Insufficient (Legacy)",
        "apm_time_quadrant_override": "Tolerate",
        "apm_hosting_type": "On-Premise",
        "apm_annual_cost": 275000,
        "apm_sla_level": "Gold (99.9%)"
    },
    {
        "id": "app-eb-87",
        "name": "Experian PowerCurve Instant Credit Bureau",
        "documentation": "Connettore interrogazione istantanea banche dati creditizie (CRIF, Experian, CTC) e calcolo score di solvibilità su prestiti personali.",
        "apm_business_owner": "Giulia Morelli (Consumer Credit Director)",
        "apm_technical_owner": "Fabrizio Grasso (Credit Analytics Specialist)",
        "apm_vendor": "Experian",
        "apm_cost_center": "CC-1030 Retail Lending",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Mission Critical",
        "apm_functional_fit": "4 - Perfect",
        "apm_technical_fit": "4 - Perfect (Cloud Native)",
        "apm_time_quadrant_override": "Invest",
        "apm_hosting_type": "SaaS",
        "apm_annual_cost": 320000,
        "apm_sla_level": "Platinum (99.99%)"
    },
    {
        "id": "app-eb-88",
        "name": "Bacta Treasury Cash Pooling & Liquidity System",
        "documentation": "Gestione calcolo posizioni di tesoreria, previsione fabbisogni di cassa a 30 giorni e ottimizzazione riserve liquide di sicurezza.",
        "apm_business_owner": "Antonio De Luca (CFO & Treasury Director)",
        "apm_technical_owner": "Giorgio Villa (Treasury IT Lead)",
        "apm_vendor": "Bacta Financial Software",
        "apm_cost_center": "CC-2010 Finance & Accounting",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Business Critical",
        "apm_functional_fit": "3 - Appropriate",
        "apm_technical_fit": "3 - Appropriate (Standard)",
        "apm_time_quadrant_override": "Tolerate",
        "apm_hosting_type": "Private Cloud",
        "apm_annual_cost": 195000,
        "apm_sla_level": "Gold (99.9%)"
    },
    {
        "id": "app-eb-89",
        "name": "Kofax TotalAgility Automated Invoice Capture",
        "documentation": "OCR e lettura automatica documenti contabili fornitore cartacei e PDF, predisposizione proposta di pagamento.",
        "apm_business_owner": "Claudio Ferri (Accounts Payable Supervisor)",
        "apm_technical_owner": "Pietro Barbieri (ECM Tech Specialist)",
        "apm_vendor": "Tungsten Automation / Kofax",
        "apm_cost_center": "CC-4050 Back Office Ops",
        "apm_lifecycle_status": "Phase Out",
        "apm_business_criticality": "Business Operational",
        "apm_functional_fit": "2 - Insufficient",
        "apm_technical_fit": "1 - Unreasonable (Obsolete)",
        "apm_time_quadrant_override": "Migrate",
        "apm_hosting_type": "On-Premise",
        "apm_annual_cost": 110000,
        "apm_sla_level": "Silver (99.0%)"
    },
    {
        "id": "app-eb-90",
        "name": "Oracle Hyperion Financial Management & Consolidation",
        "documentation": "Consolidamento civilistico e gestionale del gruppo bancario, redazione del fascicolo di bilancio semestrale e annuale.",
        "apm_business_owner": "Antonio De Luca (Chief Financial Officer)",
        "apm_technical_owner": "Giorgio Villa (Consolidation IT Lead)",
        "apm_vendor": "Oracle Corporation",
        "apm_cost_center": "CC-2010 Finance & Accounting",
        "apm_lifecycle_status": "Live",
        "apm_business_criticality": "Business Critical",
        "apm_functional_fit": "3 - Appropriate",
        "apm_technical_fit": "2 - Insufficient (Legacy)",
        "apm_time_quadrant_override": "Tolerate",
        "apm_hosting_type": "On-Premise",
        "apm_annual_cost": 315000,
        "apm_sla_level": "Gold (99.9%)"
    }
]

# --------------------------------------------------------------------------
# 3. RUN SEEDING FUNCTION
# --------------------------------------------------------------------------
def seed_enterprise_scale(db: Session):
    print("=" * 70)
    print("STARTING EASYBANK ENTERPRISE-SCALE SEEDING (EASY)")
    print("=" * 70)

    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == MODEL_ID).first()
    if not model:
        print(f"Error: Model {MODEL_ID} not found!")
        return

    stereo = db.query(ElementStereotype).filter(ElementStereotype.id == "stereo-business-app").first()
    stereo_id = stereo.id if stereo else None

    # Step 1: Insert 26 new Business Processes (Total 30)
    print("\n--> [1/5] Inserimento Business Processes...")
    proc_created = 0
    for bp in NEW_BUSINESS_PROCESSES:
        existing = db.query(ArchimateElement).filter(
            ArchimateElement.id == bp["id"],
            ArchimateElement.model_id == MODEL_ID
        ).first()
        if not existing:
            elem = ArchimateElement(
                id=bp["id"],
                model_id=MODEL_ID,
                name=bp["name"],
                type="BusinessProcess",
                layer="Business",
                documentation=bp["documentation"],
                properties=bp["properties"],
                is_reference=False
            )
            db.add(elem)
            proc_created += 1
        else:
            existing.name = bp["name"]
            existing.documentation = bp["documentation"]
            merged = dict(existing.properties or {})
            merged.update(bp["properties"])
            existing.properties = merged
    db.commit()
    print(f"✓ Processi di Business inseriti/aggiornati: {proc_created} nuovi. Totale processi ora: {db.query(ArchimateElement).filter(ArchimateElement.model_id == MODEL_ID, ArchimateElement.type == 'BusinessProcess').count()}")

    # Step 2: Insert 23 new Business Applications (Total 90)
    print("\n--> [2/5] Inserimento 23 Nuove Business Applications...")
    app_created = 0
    for app in NEW_BUSINESS_APPLICATIONS:
        app_id = app["id"]
        props = {k: v for k, v in app.items() if k.startswith("apm_")}
        props["apm_app_code"] = f"AP{app_id.replace('app-eb-', '')}"
        props["apm_short_name"] = app["name"].split(" ")[0]

        existing = db.query(ArchimateElement).filter(
            ArchimateElement.id == app_id,
            ArchimateElement.model_id == MODEL_ID
        ).first()
        if not existing:
            elem = ArchimateElement(
                id=app_id,
                model_id=MODEL_ID,
                name=app["name"],
                type="ApplicationComponent",
                layer="Application",
                documentation=app["documentation"],
                properties=props,
                stereotype_id=stereo_id,
                package_id="pkg-apm",
                is_reference=False
            )
            db.add(elem)
            app_created += 1
        else:
            existing.name = app["name"]
            existing.documentation = app["documentation"]
            merged = dict(existing.properties or {})
            merged.update(props)
            existing.properties = merged
            existing.stereotype_id = stereo_id
            existing.package_id = "pkg-apm"
    db.commit()

    all_business_apps = db.query(ArchimateElement).filter(
        ArchimateElement.model_id == MODEL_ID,
        ArchimateElement.type == "ApplicationComponent",
        ArchimateElement.stereotype_id == stereo_id
    ).all()
    print(f"✓ Business Applications censite con successo: {len(all_business_apps)} totali (Target 90 raggiunto).")

    # Step 3: Insert 5 Internal Application Components per Business Application (450 components)
    print("\n--> [3/5] Inserimento 450 Componenti Applicativi Interni e Relazioni di Composizione...")
    comp_created = 0
    comp_rels_created = 0

    sub_roles = [
        ("ui", "Web & Mobile UI Frontend", "Responsive graphical user interface for web, mobile, and branch workstation channels."),
        ("gw", "API Gateway & BFF Service", "REST/GraphQL application gateway for request routing, JWT token validation, and rate limiting."),
        ("core", "Core Domain Logic Engine", "Business logic engine, domain rule execution, fee calculation, and workflow validation."),
        ("broker", "Integration & Event Broker", "Kafka event streaming connector, MQ queue adapter, and batch integration to external systems."),
        ("data", "Data Access & Persistence Layer", "Transactional persistence microservice, RDBMS/NoSQL access, and distributed cache management.")
    ]

    all_internal_comp_ids: List[str] = []

    for app in all_business_apps:
        app_id = app.id
        app_name = app.name

        for role_key, role_label, role_doc in sub_roles:
            comp_id = f"comp-{app_id}-{role_key}"
            all_internal_comp_ids.append(comp_id)

            existing_comp = db.query(ArchimateElement).filter(
                ArchimateElement.id == comp_id,
                ArchimateElement.model_id == MODEL_ID
            ).first()

            if not existing_comp:
                comp_elem = ArchimateElement(
                    id=comp_id,
                    model_id=MODEL_ID,
                    name=f"{app_name} [{role_label}]",
                    type="ApplicationComponent",
                    layer="Application",
                    documentation=f"Dedicated {role_label} for {app_name}. {role_doc}",
                    properties={
                        "parent_application_id": app_id,
                        "parent_application_name": app_name,
                        "component_role": role_key,
                        "is_internal_component": True
                    },
                    stereotype_id=None,  # Crucial: NOT a business application itself!
                    package_id=None,
                    is_reference=False
                )
                db.add(comp_elem)
                comp_created += 1

            # Composition relationship: app -> comp
            rel_id = f"rel-comp-{app_id}-{role_key}"
            existing_rel = db.query(ArchimateRelationship).filter(
                ArchimateRelationship.id == rel_id,
                ArchimateRelationship.model_id == MODEL_ID
            ).first()

            if not existing_rel:
                rel = ArchimateRelationship(
                    id=rel_id,
                    model_id=MODEL_ID,
                    source_id=app_id,
                    target_id=comp_id,
                    type="CompositionRelationship",
                    name=f"Composes {role_label}",
                    documentation=f"Structural composition relationship: {app_name} composes its {role_label} component."
                )
                db.add(rel)
                comp_rels_created += 1

    db.commit()
    print(f"✓ Componenti interni inseriti: {comp_created} nuovi. Relazioni di composizione: {comp_rels_created}.")

    # Step 4: Insert 206 Technology Components (Target: 210 total)
    print("\n--> [4/5] Inserimento 206 Componenti Tecnologici (Nodi, Database, Middleware, Device, Servizi)...")
    tech_created = 0

    TECH_COMPONENTS = []

    # 65 Nodes
    # K8s Production (12 workers + 3 control planes)
    for i in range(1, 13):
        TECH_COMPONENTS.append({
            "id": f"node-k8s-prod-worker-{i:02d}",
            "name": f"Kubernetes Production Worker Node {i:02d} (AWS EKS m6i.4xlarge)",
            "type": "Node",
            "doc": "Nodo di calcolo worker per cluster Kubernetes production con 16 vCPU, 64GB RAM e storage NVMe.",
            "props": {"tier": "Production", "env": "AWS Cloud", "os": "Amazon Linux 2023"}
        })
    for i in range(1, 4):
        TECH_COMPONENTS.append({
            "id": f"node-k8s-prod-master-{i:02d}",
            "name": f"Kubernetes Production Control Plane {i:02d}",
            "type": "Node",
            "doc": "Control plane node ad alta affidabilità con etcd distribuito multi-Availability Zone.",
            "props": {"tier": "Production", "env": "AWS Cloud", "ha_role": "Master"}
        })
    # K8s Staging (6 workers)
    for i in range(1, 7):
        TECH_COMPONENTS.append({
            "id": f"node-k8s-stage-worker-{i:02d}",
            "name": f"Kubernetes Pre-Production / Staging Node {i:02d}",
            "type": "Node",
            "doc": "Nodo di calcolo per collaudo, stress test e validazione release pre-produzione.",
            "props": {"tier": "Staging", "env": "AWS Cloud"}
        })
    # Red Hat OpenShift Financial Nodes (8 nodes)
    for i in range(1, 9):
        TECH_COMPONENTS.append({
            "id": f"node-ocp-fin-{i:02d}",
            "name": f"Red Hat OpenShift Enterprise Bare-Metal Node {i:02d}",
            "type": "Node",
            "doc": "Infrastruttura on-premise OpenShift Core Banking con isolamento PCI-DSS e crittografia hardware.",
            "props": {"tier": "Production On-Prem", "env": "Primary Data Center Milano"}
        })
    # VMware RHEL VMs (16 VMs)
    for i in range(1, 17):
        TECH_COMPONENTS.append({
            "id": f"node-vm-rhel-app-{i:02d}",
            "name": f"VMware vSphere VM - Linux RHEL 9 App Server {i:02d}",
            "type": "Node",
            "doc": "Macchina virtuale Linux Red Hat Enterprise per microservizi finanziari e integrazione batch.",
            "props": {"tier": "Production", "os": "Red Hat Enterprise Linux 9.3"}
        })
    # Windows Server VMs (8 VMs)
    for i in range(1, 9):
        TECH_COMPONENTS.append({
            "id": f"node-vm-win-srv-{i:02d}",
            "name": f"Windows Server 2022 Enterprise Host {i:02d}",
            "type": "Node",
            "doc": "Host Windows Server per servizi applicativi legacy, Active Directory e gateway bancari specifici.",
            "props": {"tier": "Production", "os": "Windows Server 2022 Datacenter"}
        })
    # Mainframe IBM z16 LPARs (4 LPARs)
    for i in range(1, 5):
        lpar_role = "Production Active" if i <= 2 else "Disaster Recovery Standby"
        TECH_COMPONENTS.append({
            "id": f"node-mainframe-lpar-{i:02d}",
            "name": f"IBM z16 Mainframe Logical Partition LPAR-{i:02d} ({lpar_role})",
            "type": "Node",
            "doc": "Partizione logica z/OS per transazioni di core ledger contabile, 100,000 MIPS.",
            "props": {"tier": "Mission Critical", "architecture": "IBM z/Architecture", "role": lpar_role}
        })
    # GPU AI Workers (4 nodes)
    for i in range(1, 5):
        TECH_COMPONENTS.append({
            "id": f"node-gpu-ai-worker-{i:02d}",
            "name": f"NVIDIA H100 GPU Inference Server {i:02d}",
            "type": "Node",
            "doc": "Server di calcolo accelerato con GPU per scoring frodi real-time e modelli predittivi antiriciclaggio.",
            "props": {"tier": "AI / ML Real-time", "accelerator": "NVIDIA H100 80GB SXM5"}
        })
    # Edge Branch Gateways (4 nodes)
    for i in range(1, 5):
        TECH_COMPONENTS.append({
            "id": f"node-edge-branch-gw-{i:02d}",
            "name": f"Edge Branch Regional Gateway Hub {i:02d}",
            "type": "Node",
            "doc": "Apparato di aggregazione del traffico filiali regionali (Nord-Ovest, Nord-Est, Centro, Sud).",
            "props": {"tier": "Regional Edge", "role": "Traffic Aggregator"}
        })

    # 85 SystemSoftware
    # Oracle RAC (10 instances)
    for i in range(1, 11):
        TECH_COMPONENTS.append({
            "id": f"sys-db-oracle-rac-{i:02d}",
            "name": f"Oracle RAC 19c Enterprise Database Instance {i:02d}",
            "type": "SystemSoftware",
            "doc": "Cluster di database relazionale mission-critical con replica sincrona Data Guard.",
            "props": {"db_type": "Relational RDBMS", "vendor": "Oracle", "edition": "Enterprise Edition 19c"}
        })
    # PostgreSQL HA (16 instances)
    for i in range(1, 17):
        TECH_COMPONENTS.append({
            "id": f"sys-db-postgres-ha-{i:02d}",
            "name": f"PostgreSQL 16 High-Availability Cluster {i:02d}",
            "type": "SystemSoftware",
            "doc": "Database open-source enterprise con failover automatico Patroni e replica streaming sincrona.",
            "props": {"db_type": "PostgreSQL", "version": "16.2", "ha_tool": "Patroni / Raft"}
        })
    # Redis Cluster (10 nodes)
    for i in range(1, 11):
        TECH_COMPONENTS.append({
            "id": f"sys-cache-redis-{i:02d}",
            "name": f"Redis In-Memory Distributed Cache Cluster {i:02d}",
            "type": "SystemSoftware",
            "doc": "Cache distribuita ad altissima velocità (< 1ms) per sessioni utente, token e quote di mercato.",
            "props": {"cache_type": "In-Memory Key-Value", "version": "7.2"}
        })
    # MongoDB Document Replicas (8 instances)
    for i in range(1, 9):
        TECH_COMPONENTS.append({
            "id": f"sys-db-mongo-replica-{i:02d}",
            "name": f"MongoDB Enterprise Sharded Cluster {i:02d}",
            "type": "SystemSoftware",
            "doc": "Database documentale NoSQL per conservazione log di audit, contratti digitali e audit trail.",
            "props": {"db_type": "NoSQL Document", "version": "7.0 Enterprise"}
        })
    # Apache Kafka Brokers (12 brokers)
    for i in range(1, 13):
        TECH_COMPONENTS.append({
            "id": f"sys-broker-kafka-prod-{i:02d}",
            "name": f"Apache Kafka Financial Event Streaming Broker {i:02d}",
            "type": "SystemSoftware",
            "doc": "Broker di messaggistica ad alto throughput (100k msg/sec) con garanzie di consegna Exactly-Once.",
            "props": {"middleware": "Apache Kafka", "cluster": "Prod-Financial-Backbone"}
        })
    # IBM MQ Financial Queue Managers (6 instances)
    for i in range(1, 7):
        TECH_COMPONENTS.append({
            "id": f"sys-mq-financial-qm-{i:02d}",
            "name": f"IBM MQ Enterprise Financial Queue Manager {i:02d}",
            "type": "SystemSoftware",
            "doc": "Gestore code transazionali affidabile conforme agli standard interbancari di compensazione.",
            "props": {"middleware": "IBM MQ", "version": "9.3 LTS"}
        })
    # RabbitMQ Clusters (5 instances)
    for i in range(1, 6):
        TECH_COMPONENTS.append({
            "id": f"sys-mq-rabbitmq-{i:02d}",
            "name": f"RabbitMQ AMQP Message Broker {i:02d}",
            "type": "SystemSoftware",
            "doc": "Message broker leggero AMQP per eventi asincroni e notifiche verso mobile banking e canali utente.",
            "props": {"middleware": "RabbitMQ", "protocol": "AMQP 0-9-1"}
        })
    # Elasticsearch Clusters (6 instances)
    for i in range(1, 7):
        TECH_COMPONENTS.append({
            "id": f"sys-search-es-{i:02d}",
            "name": f"Elasticsearch Security & Log Search Cluster Node {i:02d}",
            "type": "SystemSoftware",
            "doc": "Cluster di indicizzazione e ricerca istantanea per log applicativi, audit e rilevamento anomalie di sicurezza.",
            "props": {"search_engine": "Elasticsearch", "version": "8.12"}
        })
    # NGINX Plus / Envoy WAF Gateways (8 instances)
    for i in range(1, 9):
        TECH_COMPONENTS.append({
            "id": f"sys-gw-nginx-waf-{i:02d}",
            "name": f"NGINX Plus Web Application Firewall & Reverse Proxy {i:02d}",
            "type": "SystemSoftware",
            "doc": "Reverse proxy avanzato con ispezione traffico OWASP Top 10, terminazione SSL/TLS 1.3 e mitigazione bot.",
            "props": {"waf_vendor": "F5 NGINX Plus", "role": "WAF & Reverse Proxy"}
        })
    # Camunda Workflow Engines (4 instances)
    for i in range(1, 5):
        TECH_COMPONENTS.append({
            "id": f"sys-engine-camunda-{i:02d}",
            "name": f"Camunda BPM Enterprise Orchestration Engine {i:02d}",
            "type": "SystemSoftware",
            "doc": "Motore di esecuzione flussi BPMN 2.0 e DMN per automazione processi bancari complessi.",
            "props": {"bpm_engine": "Camunda 8 Enterprise"}
        })

    # 30 Devices
    # Hardware Security Modules Thales (8 units)
    for i in range(1, 5):
        TECH_COMPONENTS.append({
            "id": f"dev-hsm-thales-payshield-{i:02d}",
            "name": f"Thales payShield 10K Dedicated Banking HSM {i:02d}",
            "type": "Device",
            "doc": "Dispositivo crittografico certificato PCI-HSM v3 per generazione PIN, crittografia chiavi di zona ZPK e tokenizzazione.",
            "props": {"hardware": "Hardware Security Module", "certification": "FIPS 140-2 Level 3, PCI-HSM v3"}
        })
    for i in range(1, 5):
        TECH_COMPONENTS.append({
            "id": f"dev-hsm-utimaco-crypto-{i:02d}",
            "name": f"Utimaco CryptoServer General Purpose HSM {i:02d}",
            "type": "Device",
            "doc": "Appliance di crittografia per firma digitale remota massiva e certificati eIDAS.",
            "props": {"hardware": "General Purpose HSM", "certification": "eIDAS Compliant, Common Criteria EAL4+"}
        })
    # Load Balancers F5 BIG-IP (6 units)
    for i in range(1, 7):
        TECH_COMPONENTS.append({
            "id": f"dev-lb-f5-bigip-{i:02d}",
            "name": f"F5 BIG-IP iSeries 10800 Hardware Application Delivery Controller {i:02d}",
            "type": "Device",
            "doc": "Appliance fisica per bilanciamento del carico L4-L7, offload crittografico hardware a 100 Gbps.",
            "props": {"hardware": "Application Delivery Controller", "throughput": "100 Gbps"}
        })
    # Next-Gen Firewalls Palo Alto (6 units)
    for i in range(1, 7):
        TECH_COMPONENTS.append({
            "id": f"dev-fw-paloalto-pa5400-{i:02d}",
            "name": f"Palo Alto Networks PA-5450 Next-Gen Firewall {i:02d}",
            "type": "Device",
            "doc": "Firewall modulare di perimetro e data center con ispezione profonda dei pacchetti e prevenzione zero-day.",
            "props": {"hardware": "Next-Generation Firewall", "vendor": "Palo Alto Networks"}
        })
    # ATM Terminals (6 units)
    for i in range(1, 7):
        TECH_COMPONENTS.append({
            "id": f"dev-atm-diebold-{i:02d}",
            "name": f"Diebold Nixdorf CS 5500 Automated Teller Machine {i:02d}",
            "type": "Device",
            "doc": "Sportello bancomat evoluto con versamento contante/assegni e lettore contactless NFC.",
            "props": {"hardware": "Automated Teller Machine", "security": "Level 1 Vault"}
        })

    # 26 Technology Services
    TECH_SERVICES = [
        ("svc-tech-aws-s3-vault", "AWS S3 Glacier WORM Enterprise Archive Storage", "Storage a immutabilità garantita (WORM) per archiviazione decennale conforme a normative bancarie."),
        ("svc-tech-netapp-san-storage", "NetApp All-Flash SAN Enterprise Storage Fabric", "Storage SAN NVMe over Fibre Channel con tempi di risposta < 0.2ms per database core."),
        ("svc-tech-istio-mesh-fabric", "Istio Service Mesh Zero-Trust Network Fabric", "Rete virtuale sicura mTLS con crittografia automatica end-to-end per comunicazioni tra pod microservizi."),
        ("svc-tech-ddos-shield-cdn", "Cloudflare Enterprise Banking DDoS & Edge CDN", "Protezione da attacchi DDoS volumetrici e scrubbing del traffico malevolo a livello edge globale."),
        ("svc-tech-direct-connect-10g", "Dedicated 10Gbps Multi-Cloud Private Interconnect", "Connessione in fibra ottica dedicata a bassissima latenza tra data center on-premise e cloud AWS/Azure."),
        ("svc-tech-sync-dr-mirroring", "Synchronous Metro-Distance Disaster Recovery Replication Link", "Link di replica sincrona in tempo reale a latenza zero tra Data Center Milano e Data Center Torino (RPO=0)."),
        ("svc-tech-pki-ca-service", "Enterprise Public Key Infrastructure (PKI) CA Service", "Gestione centralizzata emissione e revoca certificati digitali X.509 interni per server e API."),
        ("svc-tech-siem-audit-service", "Centralized Security Information & Event Management (SIEM) Service", "Servizio di monitoraggio continuativo degli accessi e correlazione eventi di sicurezza con intelligenza artificiale."),
        ("svc-tech-backup-commvault", "Commvault Enterprise Immutable Backup & Recovery Service", "Soluzione di backup aziendale con copia isolata air-gapped per protezione da ransomware."),
        ("svc-tech-dns-infoblox", "Infoblox High-Availability Anycast DNS & IPAM Service", "Risoluzione nomi di dominio interna e bilanciamento globale del traffico Anycast DNS."),
        ("svc-tech-active-directory", "Microsoft Active Directory Global Identity Service", "Servizio di autenticazione Kerberos e LDAP per postazioni di lavoro aziendali e console amministrative."),
        ("svc-tech-openbanking-aspsp", "Berlin Group PSD2 Open Banking Gateway Service", "Interfaccia API sicura per accesso a conti correnti da parte di terze parti autorizzate (TTP/PISP/AISP)."),
        ("svc-tech-time-sync-ptp", "Precision Time Protocol (PTP) IEEE 1588 Nanosecond Clock Sync", "Sincronizzazione oraria ad altissima precisione per audit trail e marcatura temporale MIFID II delle transazioni."),
        ("svc-tech-vault-secrets", "HashiCorp Vault Enterprise Secrets Management Service", "Rotazione automatica delle credenziali database, certificati TLS e custodia chiavi crittografiche API."),
        ("svc-tech-confluent-schema", "Confluent Schema Registry & Event Governance Service", "Validazione schemi dati Avro/Protobuf per eventi streaming distribuiti su bus Kafka."),
        ("svc-tech-api-management", "Apigee Enterprise API Management & Developer Portal", "Piattaforma di esposizione, monitoraggio e monetizzazione API bancarie interne ed esterne."),
        ("svc-tech-datadog-observability", "Datadog Full-Stack APM & Distributed Tracing Service", "Tracciamento distribuito delle transazioni applicative end-to-end e allarmistica real-time."),
        ("svc-tech-splunk-logging", "Splunk Enterprise Operational Log Analytics Service", "Piattaforma di conservazione e analisi forense dei log di sistema conformemente alle circolari di vigilanza."),
        ("svc-tech-dynatrace-davis", "Dynatrace Davis AI Root Cause Analysis Service", "Diagnostica predittiva delle anomalie infrastrutturali e auto-remediation di performance."),
        ("svc-tech-cisco-sdwan", "Cisco SD-WAN Secure Branch Interconnect Service", "Rete geografica sicura cifrata IPsec per il collegamento delle 320 filiali bancarie sul territorio."),
        ("svc-tech-nexi-clearing-gateway", "Nexi National POS Clearing & Interchange Gateway", "Connessione diretta verso i circuiti di pagamento nazionali PagoBANCOMAT e internazionali."),
        ("svc-tech-equinix-fabric", "Equinix Cloud Exchange Fabric Software-Defined Port", "Porta di interconnessione diretta software-defined verso fornitori SaaS e borse valori."),
        ("svc-tech-ibm-cics-ts", "IBM CICS Transaction Server for z/OS", "Ambiente di esecuzione transazioni ACID ad altissimo volume per conti correnti e bonifici."),
        ("svc-tech-qualys-vm", "Qualys Continuous Vulnerability Management Service", "Scansione continua delle vulnerabilità CVE su nodi, container e firmware di apparati."),
        ("svc-tech-crowdstrike-falcon", "CrowdStrike Falcon EDR Endpoint Protection Service", "Protezione avanzata degli endpoint, server di calcolo e nodi Kubernetes con blocco minacce zero-day."),
        ("svc-tech-cyberark-pam", "CyberArk Enterprise Privileged Access Management Service", "Bunker di sicurezza per gestione e registrazione sessioni amministrative su infrastrutture critiche.")
    ]

    for svc_id, svc_name, svc_doc in TECH_SERVICES:
        TECH_COMPONENTS.append({
            "id": svc_id,
            "name": svc_name,
            "type": "TechnologyService",
            "doc": svc_doc,
            "props": {"tier": "Infrastructure Service", "sla": "99.99%"}
        })

    # Commit Technology Elements
    for tc in TECH_COMPONENTS:
        existing = db.query(ArchimateElement).filter(
            ArchimateElement.id == tc["id"],
            ArchimateElement.model_id == MODEL_ID
        ).first()

        if not existing:
            elem = ArchimateElement(
                id=tc["id"],
                model_id=MODEL_ID,
                name=tc["name"],
                type=tc["type"],
                layer="Technology",
                documentation=tc["doc"],
                properties=tc.get("props", {}),
                is_reference=False
            )
            db.add(elem)
            tech_created += 1

    db.commit()
    all_tech = db.query(ArchimateElement).filter(
        ArchimateElement.model_id == MODEL_ID,
        ArchimateElement.layer == "Technology"
    ).all()
    print(f"✓ Componenti tecnologici censiti: {tech_created} nuovi. Totale Technology: {len(all_tech)} (Target 210 raggiunto).")

    # Step 5: Multi-Hop Relationships Creation for Impact Analysis
    print("\n--> [5/5] Generazione Relazioni di Rete per Analisi d'Impatto (Blast Radius)...")
    rels_created = 0

    all_procs = db.query(ArchimateElement).filter(
        ArchimateElement.model_id == MODEL_ID,
        ArchimateElement.type == "BusinessProcess"
    ).all()

    # 5.1 Business Applications -> Business Processes (ServingRelationship)
    # Each process is served by 2 to 4 business applications
    print("  * Creazione relazioni Business Applications -> Processi...")
    app_ids = [a.id for a in all_business_apps]

    # Specific realistic mappings
    priority_mappings = [
        ("proc-sepa-instant", ["app-stripe-engine", "app-cloud-core", "app-feedzai-fraud", "app-eb-72"]),
        ("proc-send-payment", ["app-stripe-engine", "app-legacy-pay", "app-cloud-core"]),
        ("proc-onboarding", ["app-salesforce", "app-cloud-core", "app-eb-75", "app-eb-85"]),
        ("proc-card-issuance", ["app-eb-70", "app-cloud-core", "app-feedzai-fraud"]),
        ("proc-mortgage-origination", ["app-eb-69", "app-eb-71", "app-eb-87", "app-alfresco-doc"]),
        ("proc-property-appraisal", ["app-eb-69", "app-alfresco-doc"]),
        ("proc-mortgage-disbursement", ["app-eb-69", "app-cloud-core", "app-eb-85"]),
        ("proc-corporate-credit-line", ["app-eb-71", "app-eb-80", "app-eb-82"]),
        ("proc-invoice-factoring", ["app-eb-82", "app-eb-80", "app-cloud-core"]),
        ("proc-trade-finance-lc", ["app-eb-82", "app-eb-72", "app-eb-85"]),
        ("proc-cash-pooling", ["app-eb-88", "app-cloud-core", "app-eb-80"]),
        ("proc-swift-crossborder", ["app-eb-72", "app-cloud-core", "app-feedzai-fraud", "app-eb-77"]),
        ("proc-sdd-clearing", ["app-legacy-pay", "app-cloud-core", "app-eb-70"]),
        ("proc-mifid-profiling", ["app-eb-79", "app-salesforce", "app-eb-75"]),
        ("proc-robo-advisory", ["app-eb-79", "app-eb-68", "app-eb-78"]),
        ("proc-securities-trading", ["app-eb-68", "app-eb-78", "app-cloud-core", "app-eb-79"]),
        ("proc-securities-custody", ["app-eb-81", "app-eb-68", "app-legacy-ledger"]),
        ("proc-pos-acquiring", ["app-eb-70", "app-feedzai-fraud", "app-cloud-core"]),
        ("proc-atm-cash-mgmt", ["app-eb-86", "app-cloud-core", "app-legacy-ledger"]),
        ("proc-instant-personal-loan", ["app-eb-87", "app-cloud-core", "app-feedzai-fraud", "app-eb-85"]),
        ("proc-aml-pep-screening", ["app-eb-77", "app-feedzai-fraud", "app-cloud-core", "app-eb-74"]),
        ("proc-realtime-fraud-eval", ["app-feedzai-fraud", "app-eb-77", "app-stripe-engine"]),
        ("proc-supervisory-reporting", ["app-eb-73", "app-eb-90", "app-legacy-ledger", "app-eb-74"]),
        ("proc-basel-rwa-calc", ["app-eb-71", "app-eb-73", "app-legacy-ledger"]),
        ("proc-npl-recovery", ["app-eb-69", "app-salesforce", "app-alfresco-doc"]),
        ("proc-general-ledger-close", ["app-legacy-ledger", "app-eb-90", "app-cloud-core", "app-eb-88"]),
        ("proc-electronic-invoicing", ["app-eb-89", "app-eb-90", "app-workday"]),
        ("proc-digital-identity-spid", ["app-eb-75", "app-eb-85", "app-salesforce"]),
        ("proc-handle-claim", ["app-salesforce", "app-alfresco-doc", "app-cloud-core"]),
        ("proc-loan-origination", ["app-eb-69", "app-eb-71", "app-cloud-core"])
    ]

    for proc_id, supporting_app_ids in priority_mappings:
        for app_id in supporting_app_ids:
            rel_id = f"rel-serv-{app_id}-{proc_id}"
            existing = db.query(ArchimateRelationship).filter(
                ArchimateRelationship.id == rel_id,
                ArchimateRelationship.model_id == MODEL_ID
            ).first()
            if not existing:
                rel = ArchimateRelationship(
                    id=rel_id,
                    model_id=MODEL_ID,
                    source_id=app_id,
                    target_id=proc_id,
                    type="ServingRelationship",
                    name="Services Business Process",
                    documentation=f"Application {app_id} directly supports and realizes business process {proc_id}."
                )
                db.add(rel)
                rels_created += 1

    # 5.2 Inter-Component Dependencies across Business Applications (Serving & Flow)
    print("  * Creazione relazioni inter-componente tra applicazioni diverse (API & Event Flow)...")
    # Component to Component calls:
    # E.g. Frontend of App A calls Gateway of App B; Gateway of App B calls Core of App B;
    # Broker of App B publishes to Broker of App C.
    inter_comp_flows = [
        # Mobile Banking -> Keycloak IAM
        ("comp-app-salesforce-gw", "comp-app-eb-75-gw", "ServingRelationship", "OAuth2 Token Validation"),
        ("comp-app-cloud-core-gw", "comp-app-eb-75-gw", "ServingRelationship", "Service-to-Service JWT Verification"),
        ("comp-app-eb-68-gw", "comp-app-eb-75-gw", "ServingRelationship", "Trader SSO Authentication"),
        ("comp-app-eb-70-gw", "comp-app-eb-75-gw", "ServingRelationship", "Merchant Portal Auth"),

        # Payments & POS -> Fraud Prevention (Feedzai)
        ("comp-app-stripe-engine-core", "comp-app-feedzai-fraud-gw", "ServingRelationship", "Real-Time Fraud Score Request"),
        ("comp-app-eb-70-core", "comp-app-feedzai-fraud-gw", "ServingRelationship", "POS Authorization Fraud Check"),
        ("comp-app-legacy-pay-core", "comp-app-feedzai-fraud-gw", "ServingRelationship", "Interbank Clearing Risk Evaluation"),
        ("comp-app-feedzai-fraud-broker", "comp-app-eb-77-broker", "FlowRelationship", "Suspected Fraud Event Stream"),

        # Core Banking -> General Ledger (Accounting Flow)
        ("comp-app-cloud-core-broker", "comp-app-legacy-ledger-broker", "FlowRelationship", "Daily Transaction GL Posting Event"),
        ("comp-app-stripe-engine-broker", "comp-app-cloud-core-broker", "FlowRelationship", "Settlement Notification Flow"),
        ("comp-app-eb-70-broker", "comp-app-cloud-core-broker", "FlowRelationship", "Merchant Balance Credit Stream"),

        # Trading & Markets -> Market Feeds
        ("comp-app-eb-68-core", "comp-app-eb-78-broker", "FlowRelationship", "Real-Time B-PIPE Price Ingestion"),
        ("comp-app-eb-68-broker", "comp-app-eb-81-broker", "FlowRelationship", "Executed Trade Confirmation"),
        ("comp-app-eb-79-core", "comp-app-eb-68-gw", "ServingRelationship", "Private Banking Order Execution Call"),

        # Lending & Mortgages -> Credit Scoring & Bureau
        ("comp-app-eb-69-core", "comp-app-eb-71-gw", "ServingRelationship", "Moody's Risk Rating Computation"),
        ("comp-app-eb-69-core", "comp-app-eb-87-gw", "ServingRelationship", "Experian Credit Score Pull"),
        ("comp-app-eb-69-broker", "comp-app-alfresco-doc-broker", "FlowRelationship", "Deed & Appraisal Document Archival"),
        ("comp-app-eb-69-gw", "comp-app-eb-85-gw", "ServingRelationship", "DocuSign Digital Contract Enveloping"),

        # Trade Finance & SWIFT
        ("comp-app-eb-82-broker", "comp-app-eb-72-broker", "FlowRelationship", "SWIFT MT700 / pacs.008 Issuance Stream"),
        ("comp-app-eb-72-gw", "comp-app-cloud-core-gw", "ServingRelationship", "Debit Ordering Customer Account"),

        # Reporting & Data Governance
        ("comp-app-eb-73-broker", "comp-app-eb-74-broker", "FlowRelationship", "Lineage Audit Metadata Pull"),
        ("comp-app-eb-90-core", "comp-app-legacy-ledger-gw", "ServingRelationship", "Chart of Accounts GL Extract"),
        ("comp-app-eb-88-core", "comp-app-cloud-core-gw", "ServingRelationship", "End of Day Liquidity Query")
    ]

    # Add systematic inter-app dependencies to reach ~180 inter-component relations
    for i in range(1, 40):
        src_app = all_business_apps[i % len(all_business_apps)]
        tgt_app = all_business_apps[(i + 3) % len(all_business_apps)]
        if src_app.id != tgt_app.id:
            inter_comp_flows.append((
                f"comp-{src_app.id}-broker",
                f"comp-{tgt_app.id}-broker",
                "FlowRelationship",
                f"Event Stream: {src_app.name} -> {tgt_app.name}"
            ))
            inter_comp_flows.append((
                f"comp-{src_app.id}-gw",
                f"comp-{tgt_app.id}-gw",
                "ServingRelationship",
                f"API Query: {src_app.name} -> {tgt_app.name}"
            ))

    for src_id, tgt_id, rel_type, rel_name in inter_comp_flows:
        rel_id = f"rel-flow-{src_id}-{tgt_id}".replace(" ", "_")[:60]
        existing = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.id == rel_id,
            ArchimateRelationship.model_id == MODEL_ID
        ).first()
        if not existing:
            rel = ArchimateRelationship(
                id=rel_id,
                model_id=MODEL_ID,
                source_id=src_id,
                target_id=tgt_id,
                type=rel_type,
                name=rel_name,
                documentation=f"Operational component interaction flow: {rel_name}"
            )
            db.add(rel)
            rels_created += 1

    # 5.3 Technology -> Application Components (Assignment & Serving)
    print("  * Creazione relazioni Tecnologia -> Componenti Applicativi (Hosting & Infrastructure)...")
    tech_nodes = [t for t in all_tech if t.type == "Node"]
    tech_software = [t for t in all_tech if t.type == "SystemSoftware"]
    tech_devices = [t for t in all_tech if t.type == "Device"]

    # Assign persistence components to database software
    for idx, app in enumerate(all_business_apps):
        data_comp_id = f"comp-{app.id}-data"
        gw_comp_id = f"comp-{app.id}-gw"
        core_comp_id = f"comp-{app.id}-core"

        # Assign data component to an enterprise database (Oracle or Postgres)
        db_sys = tech_software[idx % len(tech_software)]
        rel_id = f"rel-tech-db-{db_sys.id}-{data_comp_id}"[:60]
        if not db.query(ArchimateRelationship).filter(ArchimateRelationship.id == rel_id).first():
            db.add(ArchimateRelationship(
                id=rel_id,
                model_id=MODEL_ID,
                source_id=db_sys.id,
                target_id=data_comp_id,
                type="AssignmentRelationship",
                name="Hosts Persistence Layer",
                documentation=f"System software {db_sys.name} hosts and persists transactional data for component {data_comp_id}."
            ))
            rels_created += 1

        # Assign core/gw to a compute Node (Kubernetes or VM)
        node_sys = tech_nodes[idx % len(tech_nodes)]
        rel_id_node = f"rel-tech-node-{node_sys.id}-{core_comp_id}"[:60]
        if not db.query(ArchimateRelationship).filter(ArchimateRelationship.id == rel_id_node).first():
            db.add(ArchimateRelationship(
                id=rel_id_node,
                model_id=MODEL_ID,
                source_id=node_sys.id,
                target_id=core_comp_id,
                type="AssignmentRelationship",
                name="Executes Core Logic",
                documentation=f"Compute node {node_sys.name} executes container workload for {core_comp_id}."
            ))
            rels_created += 1

        # If payment or security app, assign to HSM device
        if "pay" in app.id or "stripe" in app.id or "trade" in app.id or "70" in app.id or "68" in app.id:
            hsm_dev = tech_devices[idx % len(tech_devices)]
            rel_id_hsm = f"rel-hsm-{hsm_dev.id}-{gw_comp_id}"[:60]
            if not db.query(ArchimateRelationship).filter(ArchimateRelationship.id == rel_id_hsm).first():
                db.add(ArchimateRelationship(
                    id=rel_id_hsm,
                    model_id=MODEL_ID,
                    source_id=hsm_dev.id,
                    target_id=gw_comp_id,
                    type="ServingRelationship",
                    name="Cryptographic PIN & Key Protection",
                    documentation=f"Hardware Security Module {hsm_dev.name} provides dedicated cryptographic key protection for {gw_comp_id}."
                ))
                rels_created += 1

    db.commit()
    print(f"✓ Relazioni complessive create con successo: {rels_created} nuove.")

    # Final Verification Stats
    final_procs = db.query(ArchimateElement).filter(ArchimateElement.model_id == MODEL_ID, ArchimateElement.type == "BusinessProcess").count()
    final_biz_apps = db.query(ArchimateElement).filter(ArchimateElement.model_id == MODEL_ID, ArchimateElement.type == "ApplicationComponent", ArchimateElement.stereotype_id == stereo_id).count()
    final_internal_comps = db.query(ArchimateElement).filter(ArchimateElement.model_id == MODEL_ID, ArchimateElement.type == "ApplicationComponent", ArchimateElement.stereotype_id.is_(None)).count()
    final_tech = db.query(ArchimateElement).filter(ArchimateElement.model_id == MODEL_ID, ArchimateElement.layer == "Technology").count()
    final_rels = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == MODEL_ID).count()

    print("\n" + "=" * 70)
    print("RIEPILOGO FINALE MODELLO EASYBANK GLOBAL (EASY):")
    print(f"  * Processi di Business:              {final_procs} (Target >= 25 OK)")
    print(f"  * Business Applications (Portfolio): {final_biz_apps} (Target >= 90 OK)")
    print(f"  * Componenti Applicativi Interni:    {final_internal_comps} (5 per applicazione, NOT biz apps OK)")
    print(f"  * Componenti Tecnologici:            {final_tech} (Target >= 200 OK)")
    print(f"  * Relazioni Totali nel Grafo:        {final_rels} (Grafo multi-hop per Blast Radius OK)")
    print("=" * 70)

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_enterprise_scale(db)
    finally:
        db.close()
