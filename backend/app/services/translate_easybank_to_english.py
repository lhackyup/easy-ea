"""
Comprehensive database migration script to translate all Italian element names,
descriptions, properties, relationship documentation, schemas, and folders
in model 'sample-easybank-ea' (Easy Global Bank / EASY) to professional English.
"""

import sys
import os
import re
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
    SchemaFolder,
    ArchiSchema,
    ArchimateView,
    ApplicationBusinessAttributes
)

MODEL_ID = "sample-easybank-ea"

# --------------------------------------------------------------------------
# 1. TRANSLATION DICTIONARY FOR ELEMENTS
# --------------------------------------------------------------------------
ELEMENT_TRANSLATIONS: Dict[str, Dict[str, Any]] = {
    # 26 Business Processes
    "proc-sepa-instant": {
        "name": "SEPA Instant Credit Transfer Processing (TIPS / RT1)",
        "doc": "24/7 real-time settlement and execution of European instant credit transfers via the EPC SEPA Instant Credit Transfer scheme (TIPS / RT1).",
        "owner": "Payments & Interbank Clearing Directorate"
    },
    "proc-card-issuance": {
        "name": "Payment Card Issuance & Lifecycle Management",
        "doc": "Lifecycle management of physical and virtual debit and credit cards, Apple Pay / Google Wallet tokenization, and PIN dispatch.",
        "owner": "Retail Cards & Acquiring Unit"
    },
    "proc-mortgage-origination": {
        "name": "Residential Mortgage Origination & Credit Underwriting",
        "doc": "Creditworthiness assessment, LTV / DTI calculation, and automated and manual credit committee approval for primary residence mortgages.",
        "owner": "Retail Lending & Mortgage Division"
    },
    "proc-property-appraisal": {
        "name": "Real Estate Property Appraisal & Collateral Valuation",
        "doc": "Cadastral compliance verification, certified technical appraisal of collateral property, and liquidation value estimation.",
        "owner": "Technical Office & Collateral Valuation Unit"
    },
    "proc-mortgage-disbursement": {
        "name": "Mortgage Loan Disbursement & Notarial Deed Execution",
        "doc": "Notarial deed execution, first-degree mortgage registration, and funds release to borrower checking account.",
        "owner": "Mortgage Operations & Back Office"
    },
    "proc-corporate-credit-line": {
        "name": "Corporate Credit Facility & Overdraft Origination",
        "doc": "Underwriting of credit lines for corporate and SME clients, XBRL financial statement analysis, Central Credit Register check, and internal rating assignment.",
        "owner": "Corporate & Commercial Banking"
    },
    "proc-invoice-factoring": {
        "name": "Invoice Factoring & Working Capital Financing",
        "doc": "Commercial receivables assignment, debtor/assignor credit ceiling verification, and advance working capital funding against commercial invoices.",
        "owner": "Trade & Working Capital Solutions"
    },
    "proc-trade-finance-lc": {
        "name": "Commercial Letters of Credit Issuance & Negotiation",
        "doc": "Import/export documentary letter of credit issuance, shipping document verification, and UCP 600 international guarantee management.",
        "owner": "International Trade Finance"
    },
    "proc-cash-pooling": {
        "name": "Group Cash Pooling & Liquidity Management",
        "doc": "Multi-account and multi-currency liquidity centralization (Zero-Balancing / Notional Pooling) for multinational corporate clients.",
        "owner": "Treasury & Cash Management"
    },
    "proc-swift-crossborder": {
        "name": "SWIFT & Cross-Border Payments Clearing (ISO 20022)",
        "doc": "Routing of MT103 / pacs.008 messages over SWIFT GPI network with transaction tracking and real-time international sanctions screening.",
        "owner": "Global Clearing & Forex Operations"
    },
    "proc-sdd-clearing": {
        "name": "SEPA Direct Debit (SDD) Processing & Collection",
        "doc": "SEPA Direct Debit B2B and Core mandate management, bulk interbank clearing file processing, and chargeback/reversal handling.",
        "owner": "Domestic Clearing & Settlement"
    },
    "proc-mifid-profiling": {
        "name": "Client MiFID II Financial Profiling & ESG Questionnaire",
        "doc": "Periodic collection and assessment of investor suitability, risk tolerance, investment horizon, and ESG sustainability preferences.",
        "owner": "Wealth Management Compliance"
    },
    "proc-robo-advisory": {
        "name": "Automated Robo-Advisory & Portfolio Rebalancing",
        "doc": "Markowitz portfolio optimization algorithms, targeted investment proposal generation, and automated asset allocation rebalancing.",
        "owner": "Digital Wealth & Asset Management"
    },
    "proc-securities-trading": {
        "name": "Equities, Bonds & ETF Direct Market Trading",
        "doc": "Order reception on regulated markets (Borsa Italiana, Euronext, Xetra, NYSE), best execution compliance, and Direct Market Access (DMA) routing.",
        "owner": "Brokerage & Trading Operations"
    },
    "proc-securities-custody": {
        "name": "Securities Custody, Clearing & Corporate Actions",
        "doc": "Securities custody account management, dividend crediting, coupon detachment, corporate actions processing, and Monte Titoli / Euroclear settlement.",
        "owner": "Securities Settlement & Custody"
    },
    "proc-pos-acquiring": {
        "name": "Merchant POS & E-Commerce Acquiring Processing",
        "doc": "Authorization, capture, and settlement of physical and digital merchant card transactions (Visa, Mastercard, PagoBANCOMAT).",
        "owner": "Merchant Acquiring & Digital Solutions"
    },
    "proc-atm-cash-mgmt": {
        "name": "ATM / CSA Cash Replenishment & Balance Reconciliation",
        "doc": "ATM vault cash inventory monitoring, Cash-in-Transit (CIT) route scheduling, and daily general ledger cash balancing.",
        "owner": "Branch Operations & Cash Logistics"
    },
    "proc-instant-personal-loan": {
        "name": "Instant Digital Personal Loan Approval & Disbursement",
        "doc": "Instant credit scoring via PSD2 Open Banking data, certified digital signature, and immediate fund transfer within 3 minutes.",
        "owner": "Consumer Finance & Digital Channels"
    },
    "proc-aml-pep-screening": {
        "name": "AML Screening, Counter-Terrorism & PEP Watchlist Surveillance",
        "doc": "Real-time name screening against OFAC / EU / UN sanctions watchlists, Politically Exposed Persons (PEP) identification, and AML risk score computation.",
        "owner": "Anti-Money Laundering & Sanctions Office"
    },
    "proc-realtime-fraud-eval": {
        "name": "Real-Time Transactional Fraud Detection & Prevention",
        "doc": "Behavioral biometrics, IP geolocation, spending anomaly detection, and automated proactive blocking of suspicious transactions using machine learning.",
        "owner": "Fraud Prevention & Financial Cyber Crime"
    },
    "proc-supervisory-reporting": {
        "name": "Supervisory & Prudential Regulatory Reporting (PUMA / FINREP)",
        "doc": "Automated data extraction, accounting reconciliation, and submission of prudential reporting matrices (PUMA2, FINREP, COREP) to national and ECB supervisors.",
        "owner": "Regulatory & Supervisory Reporting"
    },
    "proc-basel-rwa-calc": {
        "name": "Basel IV Capital Adequacy, RWA Calculation & Stress Testing",
        "doc": "Determination of Risk-Weighted Assets (RWA) for credit, market, and operational risk; calculation of CET1 ratio, Leverage Ratio, and Liquidity Coverage Ratio (LCR).",
        "owner": "Enterprise Risk Management"
    },
    "proc-npl-recovery": {
        "name": "Non-Performing Loans (NPL/UTP) Recovery & Debt Workout",
        "doc": "Management of restructuring repayment plans, litigation claims, and portfolio sales of non-performing loans to securitization special purpose vehicles.",
        "owner": "Special Credit & Debt Recovery Unit"
    },
    "proc-general-ledger-close": {
        "name": "Monthly General Ledger Closing & Balance Sheet Reconciliation",
        "doc": "Sub-ledger consolidation, intercompany account balancing, suspense account clearance, and management financial statement close.",
        "owner": "Finance, Accounting & Tax Office"
    },
    "proc-electronic-invoicing": {
        "name": "Accounts Payable Processing & E-Invoicing (SDI)",
        "doc": "Automated XML electronic invoice reception via SDI exchange hub, 3-way purchase order matching, approval workflows, and vendor disbursements.",
        "owner": "Procurement & Accounts Payable"
    },
    "proc-digital-identity-spid": {
        "name": "Strong Authentication, Digital Signature & SPID/eID Verification",
        "doc": "National digital identity verification (SPID Level 2/3 / CIE / eID), mobile biometric authentication, and certified remote digital signature.",
        "owner": "Digital Identity & Trust Services"
    },

    # Auxiliary Viewpoint Elements
    "actor-pay-clearing": {
        "name": "Payments & Interbank Clearing Directorate",
        "doc": "Operational unit responsible for SEPA payment processing, interbank clearing, and RTGS settlement."
    },
    "actor-branch-advisor": {
        "name": "Retail Branch Financial Advisor",
        "doc": "Commercial branch relationship manager dedicated to consumer lending and retail onboarding."
    },
    "actor-appraiser": {
        "name": "Certified Real Estate Technical Appraiser",
        "doc": "Licensed professional for technical property appraisal, collateral inspection, and cadastral compliance."
    },
    "actor-credit-underwriter": {
        "name": "Credit Committee & Lending Underwriter",
        "doc": "Decisional underwriting committee for residential mortgages and corporate credit lines."
    },
    "actor-notary": {
        "name": "Notary Public Office",
        "doc": "Civil-law notary public executing mortgage deeds and registering first-degree real estate liens."
    },
    "actor-private-banker": {
        "name": "Private Banking Wealth Advisor",
        "doc": "Certified wealth advisor managing investment portfolios for High Net Worth Individuals."
    },
    "actor-hnw-client": {
        "name": "High Net Worth Individual (HNWI) Client",
        "doc": "Private banking client holding multi-asset portfolios and complex fiduciary mandates."
    },
    "event-mortgage-requested": {
        "name": "Mortgage Loan Application Submitted",
        "doc": "Event triggered by client or branch with financial and income documentation submission."
    },
    "event-appraisal-completed": {
        "name": "Property Appraisal Report Certified",
        "doc": "Filing of technical appraisal report establishing property fair market value and compliance."
    },
    "event-credit-approved": {
        "name": "Credit Underwriting Approved",
        "doc": "Favorable credit decision approved by underwriting committee."
    },
    "event-funds-disbursed": {
        "name": "Mortgage Loan Funds Disbursed",
        "doc": "Funds credited to applicant's checking account and notary deed registered."
    },
    "goal-dora-resilience": {
        "name": "Digital Operational Resilience (DORA Regulation)",
        "doc": "Full compliance with EU Regulation 2022/2554 on ICT risk management, operational resilience, and incident reporting."
    },
    "goal-open-finance": {
        "name": "Open Finance & PSD3 API Ecosystem Expansion",
        "doc": "Monetization of open banking data and third-party interoperability through standardized open APIs."
    },
    "goal-cost-rationalization": {
        "name": "IT Portfolio Rationalization & TCO Reduction",
        "doc": "Decommissioning redundant legacy systems and consolidating on target Invest applications from the APM matrix."
    },
    "data-cash-pool-order": {
        "name": "Cash Pooling Sweeping Instruction (camt.053)",
        "doc": "Intercompany cash sweeping and zero-balancing account statement and balance leveling instruction."
    },
    "data-swift-pacs008": {
        "name": "ISO 20022 Interbank Credit Transfer Message (pacs.008)",
        "doc": "Core financial credit transfer message exchanged across SWIFT GPI and RTGS payment rails."
    },
    "data-treasury-ledger": {
        "name": "Multi-Currency Treasury Position Ledger",
        "doc": "Real-time ledger of FX exposures, intraday liquidity, and sight balances."
    },
    "data-reconciliation-stmt": {
        "name": "Reconciled Interbank Nostro/Vostro Statement",
        "doc": "Automated statement reconciliation against correspondent banks and European Central Bank accounts."
    },
    "serv-biometric-auth": {
        "name": "Strong Customer Biometric Authentication (SCA)",
        "doc": "Two-factor biometric authentication service compliant with PSD2 RTS for mobile and digital channels."
    },
    "serv-digital-onboarding": {
        "name": "Digital Onboarding & e-KYC Identity Verification",
        "doc": "Full online account opening service with biometric video verification and real-time AML check."
    },
    "serv-qualified-sign": {
        "name": "Qualified Electronic Signature (QES) Service",
        "doc": "Legally binding digital contract signing service compliant with eIDAS regulation."
    },

    # 23 Applications (app-eb-68 to app-eb-90)
    "app-eb-68": {
        "doc": "Market execution platform, Direct Market Access (DMA), and visual order routing across European and US equity, fixed income, and derivatives markets."
    },
    "app-eb-69": {
        "doc": "Integrated suite for mortgage loan underwriting, digital property appraisals, amortization plan simulation, and credit scoring."
    },
    "app-eb-70": {
        "doc": "Merchant acquiring platform for merchant onboarding, POS terminal transaction monitoring, and fee clearing reconciliation."
    },
    "app-eb-71": {
        "doc": "Quantitative and qualitative counterparty credit rating engine, simulation of probability of default (PD) and loss given default (LGD)."
    },
    "app-eb-72": {
        "doc": "Hardware and application interface connecting to the SWIFTNet network for CBPR+ and MX ISO 20022 financial messaging."
    },
    "app-eb-73": {
        "doc": "Automated prudential regulatory reporting engine for the Bank of Italy and European Central Bank (PUMA Matrix, FINREP, COREP)."
    },
    "app-eb-74": {
        "doc": "Enterprise Data Catalog platform providing end-to-end data lineage, business data dictionary, and BCBS 239 compliance tracking."
    },
    "app-eb-75": {
        "doc": "Identity federation, OAuth2 / OIDC authentication with biometric MFA supporting 2.5 million retail and corporate banking clients."
    },
    "app-eb-76": {
        "doc": "Enterprise IT Service Management (ITSM), Configuration Management Database (CMDB), incident and change management platform."
    },
    "app-eb-77": {
        "doc": "Advanced transaction monitoring engine for detecting complex money laundering schemes, sanctions evasion, and trade-based AML."
    },
    "app-eb-78": {
        "doc": "Real-time B-PIPE market data connector for equity prices, EURIBOR/IRS interest rate yield curves, and master security reference data."
    },
    "app-eb-79": {
        "doc": "Private banking portfolio management, multi-asset class rebalancing, capital gains tax computation, and fiduciary wealth advisory."
    },
    "app-eb-80": {
        "doc": "Corporate deposit and checking account engine, commercial loan agreements, and complex overdraft interest calculation."
    },
    "app-eb-81": {
        "doc": "Daily Net Asset Value (NAV) fund accounting engine, collective investment fund valuation, and custodian bank reconciliation."
    },
    "app-eb-82": {
        "doc": "End-to-end management of international bank guarantees, digital surety bonds, and supply chain working capital finance."
    },
    "app-eb-83": {
        "doc": "Omnichannel contact center platform for voice routing, secure video banking consultations, and customer service conversational routing."
    },
    "app-eb-84": {
        "doc": "Tier-2 service desk ticketing portal for support requests from corporate clients, corporate treasurers, and brokers."
    },
    "app-eb-85": {
        "doc": "eIDAS-compliant Qualified Electronic Signature (QES) integration for remote execution of mortgage deeds and credit contracts."
    },
    "app-eb-86": {
        "doc": "Centralized fleet management and telemetry monitoring for 450 ATM terminals, cash level tracking, and NDC/DDC transaction switching."
    },
    "app-eb-87": {
        "doc": "Instant credit bureau connector (CRIF, Experian, CTC) and creditworthiness scoring engine for consumer loans."
    },
    "app-eb-88": {
        "doc": "Treasury position calculation, 30-day cash flow forecasting, and liquidity buffer optimization engine."
    },
    "app-eb-89": {
        "doc": "Automated invoice OCR and invoice capture for paper and PDF vendor accounting documents, preparing payment proposals."
    },
    "app-eb-90": {
        "doc": "Statutory and management financial consolidation engine, producing semi-annual and annual banking group balance sheet reporting."
    },

    # Simulated Applications (seed_easybank_apm_data.py)
    "app-mobile-retail": {
        "doc": "Omnichannel mobile banking platform for consumer clients, checking accounts, instant payments, trading, and personal financial management (PFM)."
    },
    "app-corporate-portal": {
        "doc": "Internet banking and treasury management for Large Corporate and Mid-Market clients (CBI, multi-banking, FX, and trade finance)."
    },
    "app-open-banking-psd2": {
        "doc": "PSD2 / RTS-compliant API gateway for AISP, PISP, and CBPII third-party providers based on Berlin Group standards."
    },

    # BPMN test elements
    "id-a5278b8a": {"name": "Credit Division", "doc": "Decisional business division evaluating mortgage and loan proposals."},
    "id-4ae71287": {"name": "Loan Request Evaluation", "doc": "BPMN loan evaluation and underwriting macro-process."},
    "id-59041e25": {"name": "Loan Officer", "doc": "Branch or digital customer relationship manager handling loan applications."},
    "id-6bc4136f": {"name": "Risk Assessment Office", "doc": "Risk evaluation and underwriting analyst committee."},
    "id-07f0ec48": {"name": "New Loan Application Received", "doc": "Initial business event triggered upon customer submission of loan application."},
    "id-e1553bf2": {"name": "Documentary Verification", "doc": "BPMN user task verifying borrower income documents, ID, and tax forms."},
    "id-e9901ab6": {"name": "Documents Valid?", "doc": "BPMN decision gateway checking documentation completeness."},
    "id-ccc1aa56": {"name": "Automated Credit Scoring", "doc": "Application service calculating automated credit risk score."},
    "id-5020059e": {"name": "Loan Application Approved", "doc": "Final business event marking loan approval and readiness for disbursement."},
    "id-5b6f6bf8": {"name": "Financial Income Dossier", "doc": "Business object containing pay slips, tax returns, and employer certifications."},

    # Additional Applications from APM Seed
    "app-legacy-esb-tibco": {
        "doc": "Legacy SOA integration middleware based on JMS queues and SOAP XML, being phased out towards Kafka."
    },
    "app-ai-copilot-wealth": {
        "doc": "LLM-based virtual assistant for Private Bankers providing corporate report synthesis, financial news summarization, and MiFID advisory drafting."
    },
    "app-aml-actimize": {
        "doc": "Suspicious activity detection (SAR), continuous transaction surveillance, and automated generation of anti-money laundering reporting files."
    },
    "app-apigee-gateway": {
        "doc": "Enterprise API catalog management, traffic rate limiting, mTLS zero-trust security, and external developer portal."
    },
    "app-archival-worm": {
        "doc": "Non-rewritable optical WORM storage appliance for 10-year regulatory archival of signed contracts and fiscal records."
    },
    "app-coupa-procure": {
        "doc": "Enterprise procurement management, vendor purchase orders, digital invoice approval, and IT supplier contract repository."
    },
    "app-fx-auto-pricing": {
        "doc": "Algorithmic pricing engine for foreign currencies, FX Forwards, and Plain Vanilla currency options."
    },
    "app-mortgage-calc": {
        "doc": "Document verification, identity fraud detection, and creditworthiness scoring engine for residential mortgages."
    },
    "app-powerbi-analytics": {
        "doc": "Self-service executive dashboards, branch profitability analytics, and commercial sales pipeline reporting."
    },
    "app-swift-alliance": {
        "doc": "International SWIFT connectivity gateway for cross-border messaging (ISO 20022 MX and MT103) with hardware security."
    },
    "app-talend-etl": {
        "doc": "Nightly batch ETL pipelines extracting data from transactional systems to populate data warehouse and supervisory data marts."
    },
    "app-target2-rtgs": {
        "doc": "Gateway to Eurosystem real-time gross settlement (RTGS) for high-value interbank euro transfers and central bank liquidity."
    },
    "app-treasury-reconciliation": {
        "doc": "Automated reconciliation of internal general ledger accounts and NOSTRO/VOSTRO correspondent bank statements."
    },
    "app-var-risk": {
        "doc": "Daily historical and parametric Value-at-Risk (VaR) calculation and trading desk market risk limit monitoring."
    },
    "app-wealth-advisory": {
        "doc": "Private banking wealth management and discretionary investment advisory suite with MiFID II investor profiling."
    },

    # Additional Capabilities
    "cap-wealth-portfolio": {
        "doc": "Financial planning, tailored asset allocation for Private Banking clients, and discretionary portfolio management."
    },
    "cap-treasury-cash": {
        "doc": "Corporate treasury liquidity management, multi-entity zero-balancing cash pooling, and intraday cash forecasting."
    },
    "cap-reg-reporting": {
        "doc": "Automated calculation, reconciliation, and filing of prudential regulatory reports for Bank of Italy and ECB (PUMA, FINREP, COREP)."
    },
    "cap-itsm-ops": {
        "doc": "ITIL incident, problem, and change management for banking IT infrastructure, service catalog, and SLA compliance monitoring."
    },
    "cap-swift-clearing": {
        "doc": "Cross-border financial messaging routing over SWIFT network (ISO 20022 MX and MT103), SWIFT GPI tracking, and sanctions checks."
    },
    "cap-cust-mgmt": {
        "doc": "Comprehensive 360-degree customer relationship management, sales pipeline, retail and corporate marketing campaigns, and omni-channel interaction history."
    },
    "cap-core-acc": {
        "doc": "Deposit and checking account administration, chart of accounts, real-time balance ledgers, and financial accounting under IFRS standards."
    },
    "cap-payments": {
        "doc": "Multi-channel payment transaction routing, validation, clearing, and settlement for SEPA transfers, payment cards, and direct debits."
    },
    "cap-fraud": {
        "doc": "Real-time AI/ML transactional monitoring and decisioning for card fraud, identity theft, and account takeover prevention."
    },
    "cap-doc": {
        "doc": "Compliant electronic archiving, indexing, and digital retention under eIDAS and WORM standards for contracts, statements, and formal correspondence."
    },
    "cap-hr": {
        "doc": "Human capital management, payroll processing, organizational modeling, benefits administration, mandatory banking compliance training, and performance reviews."
    },
    "cap-claims": {
        "doc": "Customer dispute resolution, legal litigation handling, non-performing loan (NPL/UTP) work-out, and debt restructuring plan tracking."
    },
    "cap-aml-screening": {
        "doc": "Anti-money laundering transaction surveillance, automated screening against PEP watchlists, and OFAC/EU counter-terrorism sanctions checks."
    },
    "cap-digital-signature": {
        "doc": "Advanced and Qualified Electronic Signatures (QES), cryptographic timestamping, and legally binding digital contract execution."
    },
    "cap-identity-mgmt": {
        "doc": "Strong customer authentication (SCA/PSD2), biometric login, Single Sign-On (SSO), OpenID Connect federation, and credential lifecycle management."
    },
    "cap-credit-scoring": {
        "doc": "Quantitative and qualitative credit scoring, automated credit bureau inquiry (CRIF/Experian), and real-time default probability (PD) calculation."
    },
    "cap-mortgage-orig": {
        "doc": "End-to-end mortgage origination, cadastral property checks, technical collateral appraisal, and notarial deed workflow management."
    },
    "cap-trade-finance": {
        "doc": "Documentary letters of credit, international bank guarantees, performance bonds, and supply chain working capital finance."
    },
    "cap-cash-mgmt": {
        "doc": "Corporate treasury liquidity pooling, zero-balancing sweeps, notional pooling, and cash position forecasting."
    },
    "cap-pos-acquiring": {
        "doc": "Merchant acquiring terminal fleet management, POS authorization routing, e-commerce payment gateway integration, and merchant settlement."
    },
    "cap-atm-fleet": {
        "doc": "Automated Teller Machine (ATM/CSA) fleet telemetry, remote key injection, cash replenishment logistics, and transaction switching."
    },
    "cap-wealth-mgmt": {
        "doc": "Private banking investment portfolio management, multi-asset allocation, tax optimization, and fiduciary advisory services."
    },
    "cap-robo-advisory": {
        "doc": "Algorithmic portfolio modeling, automated rebalancing, robo-advisory proposals, and risk-adjusted wealth management."
    },
    "cap-trading-exec": {
        "doc": "Direct Market Access (DMA) equity, bond, and derivatives trading execution, smart order routing, and exchange connectivity."
    },
    "cap-sec-custody": {
        "doc": "Securities custody account servicing, corporate actions administration, dividend clearing, and central depository settlement (Monte Titoli / Euroclear)."
    },
    "cap-supervisory-rep": {
        "doc": "Automated prudential reporting generation (PUMA, FINREP, COREP) and regulatory compliance data transmission to supervisory authorities."
    },
    "cap-risk-mgmt": {
        "doc": "Enterprise risk management, Basel IV RWA calculation, stress testing, VaR computation, and Liquidity Coverage Ratio (LCR) monitoring."
    },
    "cap-data-gov": {
        "doc": "Enterprise data catalog, end-to-end data lineage, BCBS 239 risk data aggregation, and business glossary management."
    },
    "cap-open-banking": {
        "doc": "Berlin Group standard PSD2 Open Banking API gateway, third-party provider (TPP) authorization, and open finance integration."
    },
    "cap-api-mgmt": {
        "doc": "API lifecycle management, developer portal, traffic throttling, OAuth2 token validation, and enterprise service mesh integration."
    },
    "cap-omnichannel-cx": {
        "doc": "Omnichannel contact center, conversational AI virtual assistant, secure video banking, and branch interaction management."
    },
    "cap-itsm-gov": {
        "doc": "IT service management (ITSM), Configuration Management Database (CMDB), incident, problem, and change management."
    },
    "cap-cyber-sec": {
        "doc": "Security Operations Center (SOC) telemetry, threat intelligence, endpoint detection and response (EDR), and privileged access management (PAM)."
    },
    "cap-cloud-infra": {
        "doc": "Hybrid multi-cloud infrastructure orchestration, Kubernetes container platform, and automated CI/CD deployment pipelines."
    },
    "cap-corp-portal": {
        "doc": "Corporate and SME digital banking portal, CBI multi-banking connectivity, and bulk payment file approval workflows."
    },
    "cap-consumer-lending": {
        "doc": "Digital instant personal loans, buy-now-pay-later (BNPL) checkout financing, and revolving credit line origination."
    },
    "cap-factoring": {
        "doc": "Commercial accounts receivable financing, factoring credit limit monitoring, and working capital invoice discounting."
    },
    "cap-gen-ledger": {
        "doc": "Consolidated general ledger accounting, multi-entity fiscal closing, intercompany elimination, and statutory financial reporting."
    },
    "cap-customer-support": {
        "doc": "Omnichannel customer care service, telephone and chat contact center, support ticketing, and physical branch queue routing."
    },
    "cap-fund-accounting": {
        "doc": "Daily fund valuation (NAV - Net Asset Value) calculation for mutual funds, UCITS fund accounting, and securities reconciliation."
    },
    "cap-integration-platform": {
        "doc": "Service decoupling, enterprise API gateway with rate-limiting and security policies, and enterprise asynchronous Kafka event bus."
    },
    "cap-cyber-defense": {
        "doc": "Security Operations Center (SOC), SIEM log and event correlation, EDR endpoint protection, and hardware cryptographic key protection via HSMs."
    },
    "cap-procurement": {
        "doc": "Vendor directory management, electronic procurement, purchase orders, and third-party vendor contract administration."
    },
    "cap-esg-scoring": {
        "doc": "Environmental, Social, and Governance (ESG) factor assessment for corporate borrowers and investment portfolio assets."
    },
    "cap-crypto-custody": {
        "doc": "Institutional digital asset and crypto custody utilizing multi-party computation (MPC) private keys under MiCA regulatory standards."
    },
    "cap-audit-risk": {
        "doc": "Third-line audit control planning, immutable audit trails, operational risk register, and regulatory findings tracking."
    },
    "cap-atm-switch": {
        "doc": "Operational monitoring of ATM and cash-in terminal fleets, remote telemetry diagnostics, withdrawal authorization, and cash balancing."
    },
    "cap-digital-channels": {
        "doc": "Omnichannel digital banking platforms for retail mobile/web clients and corporate banking cash management portals."
    },
    "cap-interbank-clearing": {
        "doc": "Bilateral and multilateral interbank clearing, TARGET2/T2S RTGS connectivity, and correspondent banking."
    },

    # All simulated applications (seed_easybank_apm_data.py)
    "app-atlassian-suite": {
        "doc": "Agile software project management, application vulnerability tracking, and enterprise engineering knowledge base."
    },
    "app-atm-switch": {
        "doc": "Network connectivity and telemetry management for ATM terminal fleet, handling cash withdrawals on Bancomat/Cirrus/Visa rails."
    },
    "app-branch-teller": {
        "name": "Branch Teller Counter System",
        "doc": "Client-server application for physical branch counter teller workstations (cash deposits, withdrawals, checks, branch ledger)."
    },
    "app-card-issuing-cms": {
        "doc": "Legacy Card Management System for PIN generation, physical card embossing, and debit card spending limits."
    },
    "app-cloud-archive-s3": {
        "doc": "Regulatory cloud WORM archive (SEC Rule 17a-4 / AgID compliant) replacing legacy Centera systems at low cost."
    },
    "app-credit-bureau": {
        "doc": "Real-time integration with credit bureau databases (EURISC CRIF, Experian, CTC) for credit inquiries and Crifscore checks."
    },
    "app-crypto-custody": {
        "doc": "Multi-Party Computation (MPC) infrastructure for institutional token and digital asset custody under MiCA."
    },
    "app-custody-settlement": {
        "doc": "Direct interface to central securities depositories Monte Titoli and Euroclear for Delivery Versus Payment (DVP) settlement."
    },
    "app-cyberark-pam": {
        "doc": "Privileged access credential vault, automated system password rotation, and audit session recording."
    },
    "app-docu-sign": {
        "doc": "Qualified and advanced electronic signature (QES/AES) platform for deposit, credit, and surety contracts."
    },
    "app-dynatrace-apm": {
        "doc": "Full-stack distributed tracing and automated root cause analysis powered by Davis AI."
    },
    "app-ekyc-onboarding": {
        "doc": "Biometric facial recognition, video identification, and anti-fraud ID document verification during digital onboarding."
    },
    "app-esg-scoring": {
        "doc": "ESG sustainability score calculation for corporate loans, investments, and Non-Financial CSRD reporting."
    },
    "app-factoring-suite": {
        "doc": "Corporate trade receivables management, non-recourse and recourse factoring with debtor credit rating."
    },
    "app-fatca-crs": {
        "doc": "Automated tax information reporting (Common Reporting Standard CRS and US FATCA) to tax authorities."
    },
    "app-ifrs9-impairment": {
        "doc": "IFRS 9 expected credit loss provisioning engine (PD, LGD, EAD across Stage 1, 2, and 3) and macroeconomic stress testing."
    },
    "app-kafka-streaming": {
        "doc": "High-speed asynchronous event backbone for propagating transaction events (balance updates, alerts, audit)."
    },
    "app-leasing-manager": {
        "doc": "Asset leasing management engine for equipment, commercial real estate, and automotive portfolios for SME clients."
    },
    "app-legacy-collateral": {
        "doc": "Historical database for real estate mortgages and collateral pledges securing corporate credit facilities."
    },
    "app-murex-treasury": {
        "doc": "Integrated front-to-back treasury platform for fixed-income trading, interest rate derivatives, FX, and cash management."
    },
    "app-npl-collection": {
        "doc": "Non-performing loan portfolio management, repayment restructuring plans, and legal litigation tracking."
    },
    "app-old-branch-archive": {
        "name": "Access DB Branch Records",
        "doc": "Legacy uncataloged local Microsoft Access database maintained for historical consumer loan agreements."
    },
    "app-ping-identity": {
        "doc": "Customer CIAM platform, Strong Customer Authentication (SCA), Single Sign-On, and OAuth2/OIDC token issuance."
    },
    "app-pos-acquiring": {
        "doc": "Authorization and transaction routing platform for in-store physical POS terminals and merchant e-commerce gateways."
    },
    "app-sanctions-firco": {
        "doc": "Real-time blocking filter against international sanctions watchlists (OFAC, EU, UN) for wire transfers."
    },
    "app-sap-s4hana": {
        "doc": "Enterprise ERP for general ledger accounting, corporate treasury, fixed assets, cost controlling, and financial reporting."
    },
    "app-sepa-instant": {
        "doc": "SEPA Instant Credit Transfer (SCT Inst) processing engine with sub-5-second clearing via TIPS and RT1 rails."
    },
    "app-branch-appointment": {
        "doc": "Branch appointment booking platform via mobile app, customer queuing, and advisory desk management."
    },
    "app-tableau-bi": {
        "doc": "Enterprise Business Intelligence reporting and interactive dashboard analytics for executive management."
    },
    "app-snowflake-dwh": {
        "doc": "Cloud data warehouse consolidating transactional, CRM, and financial data for business analytics."
    },
    "app-crowdstrike-edr": {
        "doc": "Enterprise Endpoint Detection and Response (EDR) platform protecting servers, containers, and branch workstations."
    },
    "app-tanium-endpoint": {
        "doc": "Unified endpoint management and real-time IT asset inventory for regulatory compliance."
    },
    "app-hashicorp-vault": {
        "doc": "Centralized secrets management, automated database credential rotation, and TLS certificate generation."
    },
    "app-confluent-kafka": {
        "doc": "Managed Apache Kafka platform powering real-time financial event streaming."
    },
    "app-redis-cluster": {
        "doc": "In-memory distributed caching tier for customer session management and high-speed token caching."
    },
    "app-postgres-aurora": {
        "doc": "Managed cloud relational database for transactional microservices with automated multi-AZ replication."
    },
    "app-oracle-rac": {
        "doc": "Mission-critical relational database hosting core customer balances and banking accounts."
    },
    "app-apigee-edge": {
        "doc": "Enterprise API gateway and developer portal for external open banking and internal service mesh."
    },
    "app-istio-mesh": {
        "doc": "Kubernetes service mesh managing zero-trust mTLS mutual authentication between microservices."
    },
    "app-diebold-vcp": {
        "doc": "Multi-vendor ATM terminal software managing dispensing hardware, receipt printing, and card reader."
    },
    "app-thales-hsm": {
        "doc": "Hardware Security Module providing PCI-certified encryption keys and payment PIN translation."
    },
    "app-genesys-cloud": {
        "doc": "Cloud contact center platform routing telephony, web chat, and conversational banking channels."
    },
    "app-f5-bigip": {
        "doc": "Hardware Application Delivery Controller providing L4-L7 load balancing and SSL acceleration."
    },
    "app-paloalto-ngfw": {
        "doc": "Next-generation perimeter firewall providing deep packet inspection, IPS, and application filtering."
    },
    "app-splunk-enterprise": {
        "doc": "Operational security analytics and log management platform for banking compliance audits."
    },
    "app-infoblox-dns": {
        "doc": "Enterprise DNS, DHCP, and IP address management (IPAM) infrastructure."
    },
    "app-commvault-backup": {
        "doc": "Enterprise backup and disaster recovery platform with immutable ransomware protection."
    },
    "app-servicenow-itsm": {
        "doc": "IT service management, CMDB configuration tracking, and ITIL incident/change management."
    },
    "app-qualys-guard": {
        "doc": "Continuous vulnerability management, compliance policy auditing, and container security scanning."
    },
    "app-camunda-bpm": {
        "doc": "Enterprise workflow automation engine executing BPMN business processes and DMN decision tables."
    }
}

# Sub-role translations for 450 components
SUB_ROLE_DOCS = {
    "Web & Mobile UI Frontend": ("Web & Mobile UI Frontend", "Responsive graphical user interface for web, mobile, and branch workstation channels."),
    "API Gateway & BFF Service": ("API Gateway & BFF Service", "REST/GraphQL application gateway for request routing, JWT token validation, and rate limiting."),
    "Core Domain Logic Engine": ("Core Domain Logic Engine", "Business logic engine, domain rule execution, fee calculation, and workflow validation."),
    "Integration & Event Broker": ("Integration & Event Broker", "Kafka event streaming connector, MQ queue adapter, and batch integration to external systems."),
    "Data Access & Persistence Layer": ("Data Access & Persistence Layer", "Transactional persistence microservice, RDBMS/NoSQL access, and distributed cache management.")
}

# Technology Services translations (26)
TECH_SERVICES_TRANSLATIONS = {
    "svc-tech-aws-s3-vault": ("AWS S3 Glacier WORM Enterprise Archive Storage", "Guaranteed immutability storage (WORM) for 10-year regulatory retention compliant with banking laws."),
    "svc-tech-netapp-san-storage": ("NetApp All-Flash SAN Enterprise Storage Fabric", "NVMe over Fibre Channel SAN storage with sub-0.2ms latency for core banking database clusters."),
    "svc-tech-istio-mesh-fabric": ("Istio Service Mesh Zero-Trust Network Fabric", "Secure mTLS virtual mesh network with end-to-end transparent encryption for microservice pod communications."),
    "svc-tech-ddos-shield-cdn": ("Cloudflare Enterprise Banking DDoS & Edge CDN", "Volumetric DDoS attack protection, web application firewall, and malicious traffic scrubbing at global edge nodes."),
    "svc-tech-direct-connect-10g": ("Dedicated 10Gbps Multi-Cloud Private Interconnect", "Dedicated ultra-low latency optical fiber interconnect between on-premises datacenters and AWS/Azure clouds."),
    "svc-tech-sync-dr-mirroring": ("Synchronous Metro-Distance Disaster Recovery Replication Link", "Zero-latency real-time synchronous replication link between Milan and Turin datacenters (RPO=0)."),
    "svc-tech-pki-ca-service": ("Enterprise Public Key Infrastructure (PKI) CA Service", "Centralized certificate authority managing issuance, renewal, and revocation of internal X.509 server and API certificates."),
    "svc-tech-siem-audit-service": ("Centralized Security Information & Event Management (SIEM) Service", "Continuous access monitoring and AI-driven security event correlation platform."),
    "svc-tech-backup-commvault": ("Commvault Enterprise Immutable Backup & Recovery Service", "Enterprise backup platform featuring air-gapped immutable copies for ransomware defense."),
    "svc-tech-dns-infoblox": ("Infoblox High-Availability Anycast DNS & IPAM Service", "Internal enterprise DNS resolution and global Anycast traffic management."),
    "svc-tech-active-directory": ("Microsoft Active Directory Global Identity Service", "Kerberos and LDAP authentication service for enterprise workstations and administrative consoles."),
    "svc-tech-openbanking-aspsp": ("Berlin Group PSD2 Open Banking Gateway Service", "Secure API interface allowing authorized third-party providers (TTP/PISP/AISP) to access payment accounts."),
    "svc-tech-time-sync-ptp": ("Precision Time Protocol (PTP) IEEE 1588 Nanosecond Clock Sync", "Sub-microsecond precision time synchronization for transaction audit trails and MiFID II timestamping requirements."),
    "svc-tech-vault-secrets": ("HashiCorp Vault Enterprise Secrets Management Service", "Automated rotation of database credentials, dynamic TLS certificates, and API key custody."),
    "svc-tech-confluent-schema": ("Confluent Schema Registry & Event Governance Service", "Avro/Protobuf event schema validation and centralized governance across Kafka event streams."),
    "svc-tech-api-management": ("Apigee Enterprise API Management & Developer Portal", "Full lifecycle API management, monetization, and gateway policy enforcement for internal and external banking APIs."),
    "svc-tech-datadog-observability": ("Datadog Full-Stack APM & Distributed Tracing Service", "End-to-end distributed transaction tracing, metrics aggregation, and real-time anomaly alerting."),
    "svc-tech-splunk-logging": ("Splunk Enterprise Operational Log Analytics Service", "Centralized forensic log retention and SIEM analytics in compliance with supervisory circulars."),
    "svc-tech-dynatrace-davis": ("Dynatrace Davis AI Root Cause Analysis Service", "Predictive infrastructure anomaly diagnostics and automated performance remediation."),
    "svc-tech-cisco-sdwan": ("Cisco SD-WAN Secure Branch Interconnect Service", "IPsec-encrypted software-defined WAN connecting all 320 retail bank branches."),
    "svc-tech-nexi-clearing-gateway": ("Nexi National POS Clearing & Interchange Gateway", "Direct high-throughput interconnect to national PagoBANCOMAT and international card payment schemes."),
    "svc-tech-equinix-fabric": ("Equinix Cloud Exchange Fabric Software-Defined Port", "Software-defined low-latency direct interconnect to financial exchanges and enterprise SaaS providers."),
    "svc-tech-ibm-cics-ts": ("IBM CICS Transaction Server for z/OS", "Ultra-high volume ACID transactional runtime for core accounts and credit transfers."),
    "svc-tech-qualys-vm": ("Qualys Continuous Vulnerability Management Service", "Automated continuous CVE vulnerability scanning across nodes, containers, and network appliances."),
    "svc-tech-crowdstrike-falcon": ("CrowdStrike Falcon EDR Endpoint Protection Service", "Next-generation endpoint detection and response (EDR) preventing zero-day threats on servers and Kubernetes worker nodes."),
    "svc-tech-cyberark-pam": ("CyberArk Enterprise Privileged Access Management Service", "Enterprise security vault for managing, rotating, and session-recording administrative access to critical infrastructure.")
}

# Technology Nodes / Software generic doc translations
TECH_DOC_PATTERNS = [
    (r"Nodo di calcolo worker per cluster Kubernetes.*", "Worker compute node for production Kubernetes cluster with 16 vCPUs, 64GB RAM, and NVMe SSD storage."),
    (r"Control plane node ad alta affidabilit.*", "High-availability control plane node with distributed multi-Availability Zone etcd consensus."),
    (r"Nodo di calcolo per collaudo.*", "Staging compute node for QA, stress testing, and pre-production release validation."),
    (r"Infrastruttura on-premise OpenShift.*", "On-premises OpenShift Core Banking infrastructure bare-metal node with PCI-DSS isolation and hardware encryption."),
    (r"Macchina virtuale Linux Red Hat Enterprise.*", "Red Hat Enterprise Linux 9 virtual machine for financial microservices and batch integration."),
    (r"Host Windows Server per servizi.*", "Windows Server host for legacy application services, Active Directory, and specific banking gateways."),
    (r"Partizione logica z/OS per transazioni.*", "Logical partition (LPAR) running z/OS for core general ledger accounting transactions, 100,000 MIPS capacity."),
    (r"Server di calcolo accelerato con GPU.*", "GPU-accelerated compute server for real-time fraud scoring and predictive anti-money laundering ML models."),
    (r"Apparato di aggregazione del traffico filiali.*", "Regional edge gateway hub aggregating branch office traffic (North-West, North-East, Central, South)."),
    (r"Cluster di database relazionale mission-critical.*", "Mission-critical relational database cluster with synchronous Data Guard replication."),
    (r"Database open-source enterprise con failover.*", "Enterprise open-source relational database with Patroni automated failover and synchronous streaming replication."),
    (r"Cache distribuita ad altissima velocit.*", "Ultra-high-speed in-memory distributed cache (< 1ms) for user sessions, auth tokens, and live market quotes."),
    (r"Database documentale NoSQL per conservazione.*", "NoSQL document database cluster for immutable audit logs, electronic contracts, and audit trails."),
    (r"Broker di messaggistica ad alto throughput.*", "High-throughput financial event streaming broker (100k msg/sec) with Exactly-Once delivery semantics."),
    (r"Gestore code transazionali affidabile.*", "Reliable transactional message queue manager compliant with interbank clearing standards."),
    (r"Message broker leggero AMQP per eventi.*", "Lightweight AMQP message broker for asynchronous events and notifications to mobile banking and customer channels."),
    (r"Cluster di indicizzazione e ricerca istantanea.*", "Real-time log indexing and search cluster for application monitoring, audit records, and security anomaly detection."),
    (r"Reverse proxy avanzato con ispezione.*", "Advanced reverse proxy with OWASP Top 10 inspection, TLS 1.3 hardware offloading, and automated bot mitigation."),
    (r"Motore di esecuzione flussi BPMN 2\.0.*", "BPMN 2.0 and DMN workflow orchestration engine for complex banking process automation."),
    (r"Dispositivo crittografico certificato PCI-HSM.*", "PCI-HSM v3 certified cryptographic appliance for PIN generation, ZPK zone key protection, and tokenization."),
    (r"Appliance di crittografia per firma digitale.*", "General-purpose cryptographic appliance for high-volume remote digital signing and eIDAS certificates."),
    (r"Appliance fisica per bilanciamento del carico.*", "Hardware Application Delivery Controller (ADC) for L4-L7 load balancing and 100 Gbps SSL offloading."),
    (r"Firewall modulare di perimetro e data center.*", "Next-generation perimeter and datacenter modular firewall with deep packet inspection and zero-day threat prevention."),
    (r"Sportello bancomat evoluto con versamento.*", "Next-gen automated teller machine (ATM) featuring cash/check deposit and NFC contactless reader.")
]

# --------------------------------------------------------------------------
# 2. VIEWPOINT CONNECTION NAMES & DOCS TRANSLATION
# --------------------------------------------------------------------------
REL_NAME_MAP = {
    "Eseguiti di Mercato": "Market Executed Fills",
    "Esegue Istanza RAC": "Executes RAC Instance",
    "Esegue VM Postgres": "Executes Postgres VM",
    "Esegue Sopralluogo": "Performs Property Inspection",
    "Delibera Favorevole": "Favorable Credit Decision",
    "Elabora Zero-Balancing": "Processes Zero-Balancing Sweep",
    "Abilita API Banking": "Enables Banking APIs",
    "Aggiorna Posizioni Contabili": "Updates Accounting Positions",
    "Allineamento Posizioni FX": "FX Position Alignment",
    "Apertura Conto Online in App": "Online In-App Account Opening",
    "Assegna Rating Fidi": "Assigns Credit Rating",
    "Audit Trail Conformità": "Compliance Audit Trail",
    "Autenticazione OIDC & MFA": "OIDC & MFA Authentication",
    "Avvia Istruttoria": "Initiates Underwriting",
    "Avvio Pratica Notarile": "Initiates Notary Deed",
    "Bilanciamento del Carico": "Load Balancing",
    "Certificati QES eIDAS": "eIDAS QES Certificates",
    "Cifratura PIN & Chiavi": "PIN & Key Encryption",
    "Compila Domanda": "Fills Application",
    "Conformità ICT Risk": "ICT Risk Compliance",
    "Consegna Perizia": "Delivers Appraisal Report",
    "Consolidamento Core Cloud": "Cloud Core Consolidation",
    "Dismissione Legacy SIA Hub": "Decommissions Legacy SIA Hub",
    "Firma Contratti Fidi & Garanzie": "Signs Credit & Collateral Contracts",
    "Firma Elettronica Qualificata": "Qualified Electronic Signature",
    "Firma Questionario": "Signs Questionnaire",
    "Flusso Rendicontazione Nostro/Loro": "Nostro/Vostro Reporting Stream",
    "Flusso Segnalazioni S.O.S.": "Suspicious Activity Reporting (SAR) Stream",
    "Genera Ordine Girofondo": "Generates Cash Sweep Order",
    "Inoltra Istruzione di Regolamento": "Forwards Settlement Instruction",
    "Inoltro a Delibera": "Forward for Underwriting Decision",
    "Invocazione REST/GraphQL": "REST/GraphQL Invocation",
    "Ispezione Traffico Ingress": "Ingress Traffic Inspection",
    "Liquidazione Lorda TARGET2": "TARGET2 Gross Settlement",
    "Liste Sanzioni & Blocco Bonifici": "Sanctions Watchlists & Transfer Block",
    "Log Allarmi Frode (SIEM)": "SIEM Fraud Alert Log",
    "Mutazioni Saldo": "Balance Mutation Events",
    "Offload Cifratura Hardware": "Hardware Cryptographic Offload",
    "Ordine Compravendita": "Buy/Sell Order",
    "Ospita Broker": "Hosts Message Broker",
    "Ospita Cache In-Memory": "Hosts In-Memory Cache",
    "Persistenza Ordine": "Persists Order",
    "Pianifica Investimenti": "Plans Investments",
    "Posizioni Derivati": "Derivatives Positions",
    "Prenotazione Appuntamento Filiale": "Branch Appointment Booking",
    "Protegge Accesso Mobile": "Protects Mobile Access",
    "Protegge Accesso Web Corporate": "Protects Corporate Web Access",
    "Protezione Password Amministrative": "Administrative Password Protection",
    "Quadratura Contabile Automatica": "Automated Accounting Reconciliation",
    "Quadratura Controlli AML": "AML Controls Balancing",
    "Rating Sostenibilità SFDR": "SFDR Sustainability Rating",
    "Realizza Funzionalità": "Realizes Functionality",
    "Realizza OIDC / FIDO2 Token": "Realizes OIDC / FIDO2 Tokens",
    "Realizza Transato Contabile": "Realizes Accounting Transaction",
    "Regole di Conto": "Account Rules",
    "Replicazione Dati Storici": "Historical Data Replication",
    "Richiede Perizia": "Requests Property Appraisal",
    "Riconoscimento AI Documenti": "AI Document Recognition",
    "Robo-Advisory Integrato": "Integrated Robo-Advisory",
    "Rogito e Ipoteca": "Mortgage Deed Execution",
    "Routing & Rate Limiting": "Routing & Rate Limiting",
    "Scrittura Snapshot Saldi": "Writes Balance Snapshot",
    "Segnalazione Incidenti EBA": "EBA Major Incident Reporting",
    "Suggerimenti Portafoglio AI": "AI Portfolio Recommendations",
    "Supporta Logica Funzionale": "Supports Functional Domain Logic",
    "Supporto Chat & Videochiamata in App": "In-App Chat & Video Support",
    "Svincolo Saldo": "Disburses Loan Balance",
    "Tick Data & Prezzi": "Tick Data & Prices",
    "Underwriting Automatico": "Automated Underwriting",
    "Validazione Limiti Fidi": "Credit Limit Validation",
    "Valorizzazione NAV": "NAV Valuation",
    "Verifica Adeguatezza Proposta": "Proposal Suitability Check",
    "Volumi NVMe Fibra Canale": "Fibre Channel NVMe Volumes",
    "Assegnato a Esecuzione": "Assigned to Execution",
    "Eroga Servizio TIPS": "Provides SCT Inst Service",
    "Gateway Bonifici": "Payment Routing Gateway",
    "Comprende Gateway": "Composes API Gateway",
    "Comprende Core": "Composes Core Logic",
    "Comprende Broker": "Composes Event Broker",
    "Comprende Data": "Composes Data Layer",
    "Inoltro Richiesta SCT Inst": "Forward SCT Inst Request",
    "Notifica Evento Kafka": "Publish Kafka Event",
    "Scrittura Transazione": "Persist Transaction Record",
    "Esegue Container": "Executes Container Workload",
    "Streaming Eventi SEPA": "SEPA Event Streaming",
    "Persistenza Transazioni": "Hosts Transactional Storage",
    "Cifratura PIN e Token": "HSM PIN & Token Protection",
    "Realizza Core Accounts": "Realizes Core Accounts",
    "Realizza General Ledger": "Realizes General Ledger",
    "Realizza Cash Management": "Realizes Cash Management",
    "Realizza Open Banking": "Realizes Open Banking",
    "Realizza API Platform": "Realizes API Platform",
    "Invocazione REST Core": "REST API Core Invocation",
    "Event Streaming Kafka": "Kafka Event Streaming",
    "Persistenza Dati Core": "Core Data Persistence",
    "Persistenza Cache": "Cache Layer Persistence",
    "Esecuzione Pod Core": "Executes Core Pod Workload",
    "Esecuzione Pod Gateway": "Executes Gateway Pod Workload",
    "Connessione B-PIPE Feed": "B-PIPE Market Data Feed",
    "Connessione Avaloq Wealth": "Avaloq Wealth Integration",
    "Connessione Keycloak Auth": "Keycloak SSO Auth Verification",
    "Connessione Trade Settle": "Trade Settlement Confirmation",
    "Richiesta Quote Mercato": "Market Quote Request",
    "Inoltro Ordine Eseguito": "Forward Executed Order",
    "Verifica Token Trader": "Verify Trader JWT Token",
    "Infrastruttura OCP Milano": "Hosts OCP Bare-Metal Cluster",
    "Hosting DB Relazionale": "Hosts Oracle Relational Database",
    "Routing Fibra Ottica": "Fiber Optic Routing",
    "Protezione Perimetrale": "Perimeter Security Inspection",
    "Cifratura Transazioni": "Cryptographic HSM Encryption",
    "Richiesta Cliente": "Mortgage Request Initiated",
    "Assegnazione Pratica": "Assigns Loan Application",
    "Invio Pratica a Perizia": "Dispatches Property Appraisal",
    "Esecuzione Perizia": "Executes On-Site Appraisal",
    "Deposito Perizia Asseverata": "Files Certified Appraisal Report",
    "Invio Pratica a Delibera": "Submits for Underwriting Decision",
    "Delibera Comitato Fidi": "Issues Credit Decision",
    "Notifica Approvazione": "Notifies Loan Approval",
    "Predisposizione Atto": "Prepares Notary Mortgage Deed",
    "Stipula Atto Notarile": "Executes Notary Mortgage Deed",
    "Erogazione Importo": "Disburses Loan Principal",
    "Accredito Conto Corrente": "Credits Customer Checking Account",
    "Analisi Frode Real-Time": "Real-Time Fraud Evaluation",
    "Segnalazione Flusso Sospetto": "Streams Suspicious Activity Event",
    "Screening Liste Sanzioni": "Sanctions & PEP Watchlist Check",
    "Alimentazione Audit Lineage": "Feeds Data Lineage Audit",
    "Estrazione Dati Segnaletici": "Extracts Supervisory Data",
    "Generazione Matrice PUMA": "Generates PUMA Reporting Matrix",
    "Tracciamento Flussi DORA": "DORA Compliance Flow Audit",
    "Servizio SCA Mobile": "Provides Mobile SCA Service",
    "Servizio e-KYC Onboarding": "Provides e-KYC Onboarding Service",
    "Servizio Firma FEQ": "Provides Qualified Signature Service",
    "Integrazione DocuSign FEQ": "DocuSign QES Contract Flow",
    "Integrazione Keycloak CIAM": "Keycloak CIAM Auth Flow",
    "Integrazione Piattaforma Core": "Vault Core Account Creation",
    "Routing Filiale": "Branch Routing Call",
    "Routing Corporate": "Corporate Portal API Call",
    "Routing Mobile": "Mobile App API Call",
    "Dispositivo Cash Pooling": "Initiates Cash Pooling Order",
    "Trasmissione SWIFT Pacs.008": "Transmits SWIFT pacs.008 Message",
    "Aggiornamento Registro FX": "Updates Multi-Currency Ledger",
    "Esecuzione Riconciliazione": "Executes Statement Reconciliation",
    "Flusso Saldi Giroconto": "Intercompany Balance Sweeping",
    "Istruzione Bonifico SWIFT": "Issues SWIFT Payment Instruction",
    "Allineamento Saldi Finanziari": "Reconciles Nostro/Vostro Balances",
    "Quadratura Contabile": "General Ledger Balancing",
    "Consulenza Private Banking": "Private Banking Investment Advisory",
    "Verifica Profilo MiFID II": "MiFID II Suitability Verification",
    "Generazione Proposta Robo": "Generates Robo-Advisory Proposal",
    "Firma Digitale Mandato": "Digital Signature of Mandate",
    "Valutazione Rating ESG": "ESG Rating Evaluation",
    "Esecuzione Ordine Trading": "Executes Trading Order DMA",
    "Ribilanciamento Automatico": "Automates Portfolio Rebalancing",
    "Archiviazione Contratto": "Archives Signed Investment Contract",
    "Supporta Resilienza DORA": "Supports DORA Operational Resilience",
    "Supporta Open Finance": "Supports Open Finance Strategy",
    "Supporta Razionalizzazione": "Supports Portfolio Rationalization",
    "Allineamento Strategico": "Strategic Capability Realization",
    "Allineamento Servizi": "Strategic Service Alignment"
}

# --------------------------------------------------------------------------
# 3. MIGRATION RUNNER
# --------------------------------------------------------------------------
def run_translation_migration(db: Session):
    print("=" * 70)
    print("STARTING EASYBANK ENGLISH TRANSLATION MIGRATION (EASY)")
    print("=" * 70)

    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == MODEL_ID).first()
    if not model:
        print(f"Error: Model {MODEL_ID} not found!")
        return

    # 1. Update Schema Folders
    print("\n--> [1/6] Updating Schema Folders to English...")
    folder = db.query(SchemaFolder).filter(SchemaFolder.id == "folder-ea-viewpoints-arch").first()
    if folder:
        folder.name = "Reference Architectures & ArchiMate Viewpoints"
        print("  ✓ Updated folder-ea-viewpoints-arch -> 'Reference Architectures & ArchiMate Viewpoints'")

    # 2. Update Archi Schemas (10 Viewpoints)
    print("\n--> [2/6] Updating Archi Schemas metadata and view_data to English...")
    SCHEMA_DOCS = {
        "schema-tech-infra-hybrid": (
            "Hybrid Cloud Enterprise Infrastructure Topology",
            "Enterprise hybrid cloud infrastructure topology (AWS Public Cloud + On-Premises Private Datacenter). Displays Kubernetes compute nodes, VMware ESXi hypervisors, Oracle RAC Exadata and PostgreSQL HA database engines, Kafka message brokers, PureStorage all-flash SAN fabrics, Palo Alto perimeter firewalls, and hardware security modules (HSMs)."
        ),
        "schema-app-cooperation-easytrade": (
            "Global Trading Desk Inter-Application Mesh & Dependencies",
            "Application cooperation and integration mesh centered on EasyTrade Global Trading Desk. Demonstrates how internal application sub-components interact with external market feeds, wealth management, settlement platforms, and identity providers."
        ),
        "schema-layered-sepa-instant": (
            "E2E SEPA Instant Payment & Clearing Full-Stack",
            "End-to-end layered architecture for SEPA Instant Credit Transfer processing (TIPS/RT1). Traces flows from business actors and processes through application channels and internal microservices down to technology nodes, Kafka brokers, PostgreSQL HA, and banking HSM appliances."
        ),
        "schema-data-flow-treasury": (
            "Corporate Treasury, Cash Pooling & Interbank Settlement",
            "Information and transactional data flow architecture for group treasury, cash pooling, and liquidity management. Traces ISO 20022 messages (camt.053, pacs.008), real-time multicurrency position ledgers, and automated Nostro/Vostro balance reconciliation."
        ),
        "schema-app-usage-wealth": (
            "Private Banking & Wealth Management Advisory Ecosystem",
            "Application usage and advisory ecosystem supporting Private Banking and Wealth Management. Illustrates how portfolio management platforms, AI Copilot, ESG suitability scoring, and qualified digital signature serve advisors and high-net-worth clients under MiFID II compliance."
        ),
        "schema-cap-realization-vault": (
            "Core Banking Platform Functional Realization",
            "Functional realization and capability mapping for Thought Machine Vault Core banking platform. Highlights modular sub-component decomposition and direct realization links to core banking strategic capabilities."
        ),
        "schema-bp-coop-mortgage": (
            "Residential Mortgage Origination & Underwriting Lineage",
            "End-to-end business process cooperation for residential mortgage origination, credit underwriting, and fund disbursement. Details chronological process sequences, business events, and multi-party actor collaboration."
        ),
        "schema-sec-risk-compliance": (
            "Financial Crime, AML & Compliance Surveillance Mesh",
            "Financial crime, AML, and regulatory compliance surveillance architecture (DORA, ECB, Bank of Italy). Depicts real-time fraud transaction scoring engines, PEP/sanctions screening systems, and supervisory reporting generation."
        ),
        "schema-service-realization-omnichannel": (
            "Omnichannel Customer Engagement & Digital Identity Access",
            "Service realization architecture for omnichannel customer engagement (Mobile Retail App, Corporate Portal, Cisco Webex Contact Center, and Retail Branches). Shows how business services like biometric strong authentication (SCA), digital onboarding, and qualified digital signatures are realized by underlying core security and application systems."
        ),
        "schema-strategy-capability-map": (
            "Enterprise Banking Capability Map & Strategic Alignment",
            "Strategic banking capability map of EasyBank Global aligned with strategic transformation goals and regulatory drivers (DORA digital resilience, PSD3 open finance, and TCO portfolio rationalization)."
        ),
        "test-bpmn-schema-01": (
            "Loan Request Evaluation",
            "End-to-end loan evaluation and credit scoring workflow."
        )
    }

    schemas = db.query(ArchiSchema).filter(ArchiSchema.model_id == MODEL_ID).all()
    for sch in schemas:
        if sch.id in SCHEMA_DOCS:
            new_title, new_doc = SCHEMA_DOCS[sch.id]
            sch.name = new_title
            sch.documentation = new_doc
            print(f"  ✓ Updated schema: {sch.id} -> '{new_title}'")

        # Update view_data connections labels if present
        if sch.view_data and isinstance(sch.view_data, dict):
            vd = dict(sch.view_data)
            changed = False
            if "connections" in vd and isinstance(vd["connections"], list):
                for conn in vd["connections"]:
                    old_name = conn.get("name")
                    if old_name and old_name in REL_NAME_MAP:
                        conn["name"] = REL_NAME_MAP[old_name]
                        changed = True
            if "nodes" in vd and isinstance(vd["nodes"], list):
                for n in vd["nodes"]:
                    el_id = n.get("element_id")
                    if el_id in ELEMENT_TRANSLATIONS and "name" in ELEMENT_TRANSLATIONS[el_id]:
                        n["name"] = ELEMENT_TRANSLATIONS[el_id]["name"]
                        changed = True
            if changed:
                sch.view_data = vd

    db.commit()

    # 3. Update Elements (Processes, Applications, Capabilities, Auxiliary, Tech)
    print("\n--> [3/6] Translating Archimate Elements (names, documentation, properties)...")
    elements = db.query(ArchimateElement).filter(ArchimateElement.model_id == MODEL_ID).all()
    elem_count = 0

    for elem in elements:
        # Check explicit dictionary
        if elem.id in ELEMENT_TRANSLATIONS:
            trans = ELEMENT_TRANSLATIONS[elem.id]
            if "name" in trans:
                elem.name = trans["name"]
            if "doc" in trans:
                elem.documentation = trans["doc"]
            if "owner" in trans and elem.properties:
                props = dict(elem.properties)
                props["owner"] = trans["owner"]
                elem.properties = props
            elem_count += 1
            continue

        # Check sub-components (comp-app-*-ui/gw/core/broker/data)
        if elem.properties and elem.properties.get("is_internal_component"):
            role_key = elem.properties.get("component_role")
            parent_name = elem.properties.get("parent_application_name", "Application")
            for r_key, (r_label, r_doc) in [
                ("ui", ("Web & Mobile UI Frontend", "Responsive graphical user interface for web, mobile, and branch workstation channels.")),
                ("gw", ("API Gateway & BFF Service", "REST/GraphQL application gateway for request routing, JWT token validation, and rate limiting.")),
                ("core", ("Core Domain Logic Engine", "Business logic engine, domain rule execution, fee calculation, and workflow validation.")),
                ("broker", ("Integration & Event Broker", "Kafka event streaming connector, MQ queue adapter, and batch integration to external systems.")),
                ("data", ("Data Access & Persistence Layer", "Transactional persistence microservice, RDBMS/NoSQL access, and distributed cache management."))
            ]:
                if role_key == r_key:
                    elem.documentation = f"Dedicated {r_label} for {parent_name}. {r_doc}"
                    elem_count += 1
                    break
            continue

        # Check Technology Services
        if elem.id in TECH_SERVICES_TRANSLATIONS:
            svc_name, svc_doc = TECH_SERVICES_TRANSLATIONS[elem.id]
            elem.name = svc_name
            elem.documentation = svc_doc
            elem_count += 1
            continue

        # Check Technology Nodes / System Software / Devices regex docs
        if elem.layer == "Technology" and elem.documentation:
            for pattern, repl in TECH_DOC_PATTERNS:
                if re.search(pattern, elem.documentation, re.IGNORECASE):
                    elem.documentation = repl
                    elem_count += 1
                    break

        # Check simulated applications documentation from seed_easybank_apm_data
        if elem.documentation and "Piattaforma" in elem.documentation:
            elem.documentation = re.sub(r"Piattaforma di", "Platform for", elem.documentation)
            elem.documentation = re.sub(r"Piattaforma per", "Platform for", elem.documentation)
            elem_count += 1

    db.commit()
    print(f"  ✓ Processed and translated {elem_count} elements.")

    # 4. Update Relationships
    print("\n--> [4/6] Translating Archimate Relationships (names and documentation)...")
    rels = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == MODEL_ID).all()
    rel_count = 0

    for r in rels:
        modified = False
        # Translate relationship name if in map
        if r.name and r.name in REL_NAME_MAP:
            r.name = REL_NAME_MAP[r.name]
            modified = True

        # Translate documentation patterns
        doc = r.documentation or ""
        if "Relazione strutturale di composizione tra l'applicazione" in doc:
            # "Relazione strutturale di composizione tra l'applicazione {app} e il suo modulo {role}."
            m = re.search(r"tra l'applicazione (.*?) e il suo modulo (.*?)\.", doc)
            if m:
                app_n, mod_n = m.group(1), m.group(2)
                r.documentation = f"Structural composition relationship: {app_n} composes its {mod_n} component."
            else:
                r.documentation = "Structural composition relationship between application and sub-component."
            modified = True

        elif "supporta direttamente l'operatività del processo di business" in doc:
            # "L'applicazione {app_id} supporta direttamente l'operatività del processo di business {proc_id}."
            r.documentation = f"Application {r.source_id} directly supports and realizes business process {r.target_id}."
            modified = True

        elif "Relazione operativa tra componenti:" in doc:
            r.documentation = doc.replace("Relazione operativa tra componenti:", "Operational component interaction flow:")
            modified = True

        elif "ospita e persiste i dati del componente" in doc:
            r.documentation = f"System software {r.source_id} hosts and persists transactional data for component {r.target_id}."
            modified = True

        elif "esegue il container/processo di" in doc:
            r.documentation = f"Compute node {r.source_id} executes container runtime workload for {r.target_id}."
            modified = True

        elif "fornisce servizi hardware di cifratura delle chiavi a" in doc:
            r.documentation = f"Hardware Security Module {r.source_id} provides cryptographic key protection and tokenization for {r.target_id}."
            modified = True

        elif "Relazione creata per lo schema" in doc:
            r.documentation = doc.replace("Relazione creata per lo schema", "Architectural relationship defined for viewpoint schema")
            modified = True

        elif "Relazione architetturale dello schema" in doc:
            r.documentation = re.sub(
                r"Relazione architetturale dello schema '(.*?)'(\.?)",
                r"Architectural relationship defined for schema '\1'.",
                doc
            )
            modified = True

        elif "esegue la logica applicativa a supporto della capability" in doc:
            r.documentation = re.sub(
                r"Il componente core di (.*?) esegue la logica applicativa a supporto della capability (.*?)(\.?)",
                r"The core component of \1 executes application logic supporting business capability \2.",
                doc
            )
            modified = True

        elif "L'applicazione di business" in doc:
            r.documentation = re.sub(
                r"L'applicazione di business '(.*?)' implementa e realizza la capacit[àa] di business '(.*?)'(\.?)",
                r"Business application '\1' implements and realizes strategic business capability '\2'.",
                doc
            )
            modified = True

        # Specific Italian docs in viewpoints
        if "Assegnazione operativa" in doc:
            r.documentation = "Operational assignment of payment clearing unit to instant transfer execution."
            modified = True
        elif "Routing e validazione" in doc:
            r.documentation = "Payment routing and validation via instant SCT gateway."
            modified = True
        elif "Regolamento e archiviazione" in doc:
            r.documentation = "Instant settlement and archival of interbank credit transfer."
            modified = True
        elif "Esecuzione e storage" in doc:
            r.documentation = "Execution and transactional storage of payment records."
            modified = True
        elif "Protezione delle chiavi" in doc:
            r.documentation = "Cryptographic protection of private keys and session tokens."
            modified = True

        if modified:
            rel_count += 1

    db.commit()
    print(f"  ✓ Processed and translated {rel_count} relationships.")

    # 5. Update APM Attributes in ApplicationBusinessAttributes and ArchimateElement properties
    print("\n--> [5/6] Normalizing APM metadata terms to standard English...")
    # Normalize common Italian APM property values
    apm_replacements = {
        "4 - Perfect (Eccellente)": "4 - Perfect",
        "3 - Appropriate (Adeguata)": "3 - Appropriate",
        "3 - Appropriate (Stabile/Standard)": "3 - Appropriate (Standard)",
        "2 - Insufficient (Lacunosa)": "2 - Insufficient",
        "2 - Insufficient (Legacy On-Prem)": "2 - Insufficient (Legacy)",
        "2 - Insufficient (Architettura Monolitica)": "2 - Insufficient (Monolith)",
        "2 - Insufficient (Legacy Architecture)": "2 - Insufficient (Legacy)",
        "1 - Unreasonable (Inadeguata)": "1 - Unreasonable",
        "1 - Unreasonable (Obsoleta)": "1 - Unreasonable (Obsolete)",
        "OPEX (SaaS / Canone Cloud)": "OPEX (Cloud / SaaS)",
        "CAPEX (Licenza Perpetua)": "CAPEX (Perpetual License)",
        "Internal (Sviluppo Interno)": "Internal (Custom Build)",
        "< 1 ora": "< 1 hour",
        "< 4 ore": "< 4 hours",
        "< 24 ore": "< 24 hours",
        "> 24 ore / Best Effort": "> 24 hours (Best Effort)",
        "Massimo Rinaldi (Head of Global Markets)": "Massimo Rinaldi (Head of Global Markets)",
        "Giulia Morelli (Head of Mortgage Underwriting)": "Giulia Morelli (Head of Mortgage Underwriting)"
    }

    apps = db.query(ArchimateElement).filter(ArchimateElement.model_id == MODEL_ID, ArchimateElement.type == "ApplicationComponent").all()
    for app in apps:
        if app.properties:
            props = dict(app.properties)
            changed = False
            for k, v in list(props.items()):
                if isinstance(v, str) and v in apm_replacements:
                    props[k] = apm_replacements[v]
                    changed = True
            if changed:
                app.properties = props

    # ApplicationBusinessAttributes table
    app_attrs = db.query(ApplicationBusinessAttributes).join(
        ArchimateElement, ApplicationBusinessAttributes.element_id == ArchimateElement.id
    ).filter(ArchimateElement.model_id == MODEL_ID).all()
    for attr in app_attrs:
        if attr.business_criticality and "Critico" in attr.business_criticality:
            attr.business_criticality = "Business Critical"
        if attr.hosting_type == "On-Premise":
            attr.hosting_type = "On-Premises"

    db.commit()
    print("  ✓ APM metadata successfully normalized.")

    # 6. Final Verification Query
    print("\n--> [6/6] Verifying translations...")
    it_elements = db.query(ArchimateElement).filter(
        ArchimateElement.model_id == MODEL_ID,
        (
            ArchimateElement.documentation.ilike('%dedicato per l%') |
            ArchimateElement.documentation.ilike('%processo di business%') |
            ArchimateElement.name.ilike('%Elaborazione%') |
            ArchimateElement.name.ilike('%Istruttoria%') |
            ArchimateElement.name.ilike('%Gestione%')
        )
    ).count()

    it_rels = db.query(ArchimateRelationship).filter(
        ArchimateRelationship.model_id == MODEL_ID,
        (
            ArchimateRelationship.documentation.ilike('%relazione strutturale%') |
            ArchimateRelationship.documentation.ilike('%supporta direttamente%') |
            ArchimateRelationship.documentation.ilike('%ospita e persiste%') |
            ArchimateRelationship.name.ilike('%Assegnato%') |
            ArchimateRelationship.name.ilike('%Comprende%') |
            ArchimateRelationship.name.ilike('%Eroga%')
        )
    ).count()

    print(f"Remaining Italian elements flagged by audit: {it_elements}")
    print(f"Remaining Italian relationships flagged by audit: {it_rels}")
    print("=" * 70)
    print("TRANSLATION COMPLETED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    db = SessionLocal()
    try:
        run_translation_migration(db)
    finally:
        db.close()
