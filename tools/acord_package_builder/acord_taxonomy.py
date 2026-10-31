"""
ACORD Insurance Framework Canonical Taxonomy
Classification of ACORD Capability Model, Information Model, Component Model,
and standard business lines (Property & Casualty, Life & Annuities, Reinsurance).
"""

from typing import Dict, List, Any

# 1. ACORD Macro Capability Domains (L1 Categories)
ACORD_DOMAINS = [
    {
        "code": "DOM-PRD",
        "name": "Product Management & Actuarial",
        "description": "Insurance product engineering, actuarial tariff calculation, regulatory filing, and underwriting guideline definition.",
        "capabilities_l2": [
            {"name": "Actuarial Loss Modeling & Pricing", "lob": "Cross-LOB", "description": "Statistical claims frequency/severity modeling, risk pricing, and loss cost calculations."},
            {"name": "Product Design & Tariff Configuration", "lob": "Cross-LOB", "description": "Definition of policy clauses, deductibles, endorsements, and commercial coverage limits."},
            {"name": "Regulatory Product Filing & Compliance", "lob": "Cross-LOB", "description": "Submission of insurance policy forms and rating rules to supervisory authorities (e.g. IVASS, EIOPA, NAIC)."}
        ]
    },
    {
        "code": "DOM-UND",
        "name": "Customer Acquisition & Underwriting",
        "description": "Risk assessment, medical/technical survey underwriting, automated scoring, quotation, and binding.",
        "capabilities_l2": [
            {"name": "Prospect Risk Evaluation & Profiling", "lob": "Cross-LOB", "description": "Assessment of insured subject risk profile (motor telematics, property survey, medical history)."},
            {"name": "Automated Rating & Quotation", "lob": "Cross-LOB", "description": "Real-time execution of actuarial rating algorithms to compute gross and net premium quotes."},
            {"name": "Underwriting Rule Enforcement & Binding", "lob": "Cross-LOB", "description": "Validation against underwriting authority limits, reinsurance treaties, and policy contract binding."}
        ]
    },
    {
        "code": "DOM-PAS",
        "name": "Policy Administration & Servicing",
        "description": "Policy issuance, mid-term adjustments (endorsements), annual renewals, cancellations, and statutory registry.",
        "capabilities_l2": [
            {"name": "Policy Inception & Document Issuance", "lob": "Cross-LOB", "description": "Generation of legal policy contract, insurance certificate, and green card / statutory documentation."},
            {"name": "Mid-Term Policy Adjustments (Endorsements)", "lob": "Cross-LOB", "description": "Handling contractual amendments, vehicle substitutions, beneficiary changes, and coverage expansions."},
            {"name": "Renewal Processing & Lapse Management", "lob": "Cross-LOB", "description": "Automated policy renewal notice dispatching, indexation adjustment, and cancellation for non-payment."}
        ]
    },
    {
        "code": "DOM-CLM",
        "name": "Claims Management & Settlement",
        "description": "First notice of loss (FNOL), fraud screening, loss adjustment, claims reserve management, and indemnification payout.",
        "capabilities_l2": [
            {"name": "First Notice of Loss (FNOL) Intake", "lob": "Cross-LOB", "description": "Multichannel capture of incident details, police reports, photos, and initial coverage verification."},
            {"name": "Claims Fraud Scoring & SIU Investigation", "lob": "Cross-LOB", "description": "Behavioral fraud detection, network graph fraud rings analysis, and referral to Special Investigation Unit."},
            {"name": "Loss Adjusting & Damage Assessment", "lob": "Property & Casualty", "description": "Technical appraisal, expert surveyor appointment, repair shop network coordination, and loss quantification."},
            {"name": "Claims Reserving & Solvency Provisioning", "lob": "Cross-LOB", "description": "Actuarial setting of case reserves (IBNR - Incurred But Not Reported) according to Solvency II / IFRS 17."},
            {"name": "Claim Indemnification & Settlement", "lob": "Cross-LOB", "description": "Payment authorization, deductible deduction, direct repair settlement, and beneficiary wire transfer."},
            {"name": "Subrogation, Salvage & Third-Party Recovery", "lob": "Property & Casualty", "description": "Recourse against liable third parties, CARD direct compensation settlement, and salvage asset disposal."}
        ]
    },
    {
        "code": "DOM-BIL",
        "name": "Billing, Collections & Premium Accounting",
        "description": "Premium installment invoicing, broker account reconciliation, direct debit collection, and commission payments.",
        "capabilities_l2": [
            {"name": "Premium Invoicing & Installment Scheduling", "lob": "Cross-LOB", "description": "Generation of installment payment schedules (annual, semi-annual, monthly via SEPA SDD)."},
            {"name": "Premium Collection & Dunning Management", "lob": "Cross-LOB", "description": "Automated bank reconciliation, payment gateway processing, late payment notices, and suspension."},
            {"name": "Intermediary & Broker Commission Accounting", "lob": "Cross-LOB", "description": "Calculation and disbursement of acquisition commissions, override fees, and agent statement reconciliation."}
        ]
    },
    {
        "code": "DOM-REI",
        "name": "Reinsurance & Risk Cession",
        "description": "Treaty reinsurance, facultative risk placements, ceded premium calculation, and reinsurance claims recovery.",
        "capabilities_l2": [
            {"name": "Treaty Reinsurance Allocation & Cession", "lob": "Reinsurance", "description": "Quota share, surplus, and excess of loss (XOL) treaty management and automatic capacity checking."},
            {"name": "Facultative Placement & Negotiation", "lob": "Reinsurance", "description": "Custom risk placement on global reinsurance markets for complex high-value industrial risks."},
            {"name": "Reinsurance Claims Recovery & Settlement", "lob": "Reinsurance", "description": "Identification of claim cessions, collection of recoveries from reinsurers, and bordereau generation."}
        ]
    },
    {
        "code": "DOM-GOV",
        "name": "Solvency, Risk Governance & IFRS 17",
        "description": "Solvency II capital requirements (SCR/MCR), actuarial balance sheet valuation, IFRS 17 CSM calculation, and supervisory reporting.",
        "capabilities_l2": [
            {"name": "Solvency II Capital Requirement (SCR) Calculation", "lob": "Cross-LOB", "description": "Standard Formula / Internal Model capital calculations for underwriting, market, and operational risks."},
            {"name": "IFRS 17 Insurance Contract Measurement", "lob": "Cross-LOB", "description": "Calculation of Contractual Service Margin (CSM), Best Estimate Liabilities (BEL), and Risk Adjustment."}
        ]
    }
]

# 2. ACORD Insurance Core Software Systems (ApplicationComponent)
INSURANCE_CORE_SYSTEMS = [
    {
        "id": "comp-acord-pas",
        "name": "Policy Administration System (PAS)",
        "category": "Core Insurance Platform",
        "description": "Core insurance backbone managing policy lifecycle, endorsements, documents, and insured party registries.",
        "standards": ["ACORD TxLife", "ACORD P&C XML", "REST API"]
    },
    {
        "id": "comp-acord-cms",
        "name": "Claims Management System (CMS)",
        "category": "Core Insurance Platform",
        "description": "End-to-end claims handling engine governing FNOL, investigation, loss appraisal, reserving, and settlement.",
        "standards": ["ACORD Claims Service", "REST API", "OpenClaim"]
    },
    {
        "id": "comp-acord-rating",
        "name": "Rating & Pricing Calculation Engine",
        "category": "Underwriting & Analytics",
        "description": "Centralized actuarial rule engine calculating insurance premiums, risk adjustments, and commercial discounts.",
        "standards": ["ACORD Rate Table Specification", "REST API"]
    },
    {
        "id": "comp-acord-uw-workbench",
        "name": "Underwriter Decision Workbench",
        "category": "Underwriting & Analytics",
        "description": "Digital workspace for specialized underwriters to inspect corporate risks, analyze telematics, and authorize bound policies.",
        "standards": ["ACORD eSignature", "REST API"]
    },
    {
        "id": "comp-acord-billing",
        "name": "Insurance Billing & Premium Collections Engine",
        "category": "Financial Operations",
        "description": "Management of customer billing accounts, SEPA SDD payment mandates, broker commissions, and dunning.",
        "standards": ["ISO 20022 SEPA", "ACORD Billing Standard"]
    },
    {
        "id": "comp-acord-reinsurance",
        "name": "Reinsurance Management System",
        "category": "Risk Management",
        "description": "System managing proportional/non-proportional treaties, facultative placements, and reinsurer bordereaux.",
        "standards": ["ACORD Reinsurance & Large Commercial (RLC)", "eBordereau"]
    },
    {
        "id": "comp-acord-fraud-siu",
        "name": "Claims Fraud Detection & SIU System",
        "category": "Risk Management",
        "description": "Real-time AI behavioral fraud detection, claim ring correlation, social media analysis, and investigator case management.",
        "standards": ["REST API", "Graph Analytics"]
    },
    {
        "id": "comp-acord-actuarial-solvency",
        "name": "Actuarial Valuation & Solvency II / IFRS 17 Engine",
        "category": "Financial Operations",
        "description": "Enterprise calculation platform for Solvency II SCR/MCR metrics, actuarial cash-flow projections, and IFRS 17 CSM.",
        "standards": ["EIOPA QRT Templates", "IFRS 17 Standard"]
    },
    {
        "id": "comp-acord-portal",
        "name": "Omnichannel Broker & Customer Digital Portal",
        "category": "Digital Engagement",
        "description": "Self-service portal and mobile app for policy quotation, instant policy purchase, FNOL reporting, and claim tracking.",
        "standards": ["ACORD Open APIs", "OAuth 2.0 / OpenID Connect"]
    }
]

# 3. Canonical ACORD Information Entities (BusinessObject)
ACORD_INFORMATION_ENTITIES = [
    {"name": "Insurance Policy Contract", "category": "Policy", "description": "Legally binding agreement defining terms, coverage limits, premiums, exclusions, and statutory clauses."},
    {"name": "Insurance Coverage Item", "category": "Policy", "description": "Specific peril or financial protection covered under the policy (e.g. Third-Party Liability, Fire & Theft, Medical Expenses)."},
    {"name": "Insured Subject (Risk Asset)", "category": "Risk Asset", "description": "The physical property, vehicle, individual life, or legal liability exposed to loss."},
    {"name": "Insurance Claim Record", "category": "Claim", "description": "Formal notice of an occurrence alleging a loss covered by the policy, tracking investigation and litigation."},
    {"name": "Claim Loss Reserve", "category": "Claim", "description": "Actuarial liability provision set aside on balance sheet to settle anticipated indemnification and legal defense costs."},
    {"name": "Premium Invoicing Schedule", "category": "Financial", "description": "Installment payment schedule, banking coordinates, and payment status for the insurance policy."},
    {"name": "Reinsurance Treaty Contract", "category": "Reinsurance", "description": "Contractual agreement ceding defined tranches of insurance exposure to professional reinsurers."},
    {"name": "Claim Settlement Payment", "category": "Claim", "description": "Liquidated indemnification disbursement authorized to the claimant, hospital, or approved repairer network."}
]
