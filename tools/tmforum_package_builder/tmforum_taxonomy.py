"""
TM Forum ODA & eTOM v23.5 Canonical Taxonomy
Classification of Business Process Framework (eTOM), Open Digital Architecture (ODA),
Information Framework (SID), and Open APIs.
"""

from typing import Dict, List, Any

# 1. eTOM Major Process Areas (L0 Categories)
ETOM_PROCESS_AREAS = [
    {
        "code": "AREA-OPS",
        "name": "Operations (OPS)",
        "description": "Core operational life-cycle management encompassing customer fulfillment, service assurance, network operations, and revenue billing.",
        "stream": "Operations",
        "processes_l1": [
            {
                "id": "1.4.1",
                "name": "Customer Management",
                "description": "Customer lifecycle interactions, inquiries, order handling, customer problem resolution, and retention.",
                "processes_l2": [
                    {"id": "1.4.1.1", "name": "Customer Interface Management", "stream": "Fulfillment"},
                    {"id": "1.4.1.2", "name": "Order Handling", "stream": "Fulfillment"},
                    {"id": "1.4.1.3", "name": "Problem Handling & Tickets", "stream": "Assurance"},
                    {"id": "1.4.1.4", "name": "Customer SLA Management", "stream": "Assurance"},
                    {"id": "1.4.1.5", "name": "Billing & Collections Inquiry", "stream": "Billing"},
                    {"id": "1.4.1.6", "name": "Customer Retention & Loyalty", "stream": "Fulfillment"}
                ]
            },
            {
                "id": "1.4.2",
                "name": "Service Management",
                "description": "Technical service design, service order dispatching, service configuration, quality monitoring, and problem management.",
                "processes_l2": [
                    {"id": "1.4.2.1", "name": "Service Configuration & Activation", "stream": "Fulfillment"},
                    {"id": "1.4.2.2", "name": "Service Order Orchestration", "stream": "Fulfillment"},
                    {"id": "1.4.2.3", "name": "Service Quality & Performance Monitoring", "stream": "Assurance"},
                    {"id": "1.4.2.4", "name": "Service Problem Management", "stream": "Assurance"},
                    {"id": "1.4.2.5", "name": "Service Usage Rating & Charging", "stream": "Billing"}
                ]
            },
            {
                "id": "1.4.3",
                "name": "Resource & Network Operations",
                "description": "Physical, virtualized, and cloud telecom infrastructure provisioning, performance, and network fault diagnosis.",
                "processes_l2": [
                    {"id": "1.4.3.1", "name": "Resource Provisioning & Allocation", "stream": "Fulfillment"},
                    {"id": "1.4.3.2", "name": "Resource Trouble Management & Alarms", "stream": "Assurance"},
                    {"id": "1.4.3.3", "name": "Network Performance Management", "stream": "Assurance"},
                    {"id": "1.4.3.4", "name": "Resource Data Collection & Mediation", "stream": "Billing"},
                    {"id": "1.4.3.5", "name": "Workforce & Field Dispatch Management", "stream": "Fulfillment"}
                ]
            },
            {
                "id": "1.4.4",
                "name": "Supplier & Partner Relationship Management",
                "description": "Interconnection settlement, wholesale billing, third-party content management, and supplier performance.",
                "processes_l2": [
                    {"id": "1.4.4.1", "name": "Partner Order Management", "stream": "Fulfillment"},
                    {"id": "1.4.4.2", "name": "Partner Problem & SLA Management", "stream": "Assurance"},
                    {"id": "1.4.4.3", "name": "Interconnect Settlement & Invoicing", "stream": "Billing"}
                ]
            }
        ]
    },
    {
        "code": "AREA-SIP",
        "name": "Strategy, Infrastructure & Product (SIP)",
        "description": "Long-term telco business strategy, commercial product portfolio lifecycle, network infrastructure planning, and capacity engineering.",
        "stream": "Strategy",
        "processes_l1": [
            {
                "id": "1.1",
                "name": "Strategy & Commit",
                "description": "Formulation of corporate digital strategy, market assessment, business architecture, and investment roadmaps.",
                "processes_l2": [
                    {"id": "1.1.1", "name": "Strategic Business Planning", "stream": "Strategy"},
                    {"id": "1.1.2", "name": "Technology & Network Architecture Strategy", "stream": "Strategy"},
                    {"id": "1.1.3", "name": "Digital Partner Ecosystem Strategy", "stream": "Strategy"}
                ]
            },
            {
                "id": "1.2",
                "name": "Infrastructure Lifecycle Management",
                "description": "Planning, engineering, roll-out, and continuous modernization of 5G, fiber optic, edge, and cloud networks.",
                "processes_l2": [
                    {"id": "1.2.1", "name": "Network Capacity Planning & Design", "stream": "Strategy"},
                    {"id": "1.2.2", "name": "Infrastructure Rollout & Commissioning", "stream": "Strategy"},
                    {"id": "1.2.3", "name": "Cloud & Virtual Infrastructure Lifecycle", "stream": "Strategy"}
                ]
            },
            {
                "id": "1.3",
                "name": "Product Lifecycle Management",
                "description": "Commercial proposition design, pricing modeling, commercial catalog publication, and service retirement.",
                "processes_l2": [
                    {"id": "1.3.1", "name": "Product Portfolio Strategy & Definition", "stream": "Strategy"},
                    {"id": "1.3.2", "name": "Commercial Product Offering Design", "stream": "Strategy"},
                    {"id": "1.3.3", "name": "Product Launch & Commercial Readiness", "stream": "Strategy"}
                ]
            }
        ]
    },
    {
        "code": "AREA-ENT",
        "name": "Enterprise Management (EM)",
        "description": "Corporate administration, regulatory compliance, financial accounting, human resources, brand, and security.",
        "stream": "Enterprise",
        "processes_l1": [
            {
                "id": "1.5.1",
                "name": "Financial & Asset Management",
                "description": "General accounting, corporate treasury, billing revenue assurance, tax, and CAPEX/OPEX governance.",
                "processes_l2": [
                    {"id": "1.5.1.1", "name": "Revenue Assurance & Fraud Prevention", "stream": "Enterprise"},
                    {"id": "1.5.1.2", "name": "Corporate Financial Accounting", "stream": "Enterprise"}
                ]
            },
            {
                "id": "1.5.2",
                "name": "Security & Privacy Governance",
                "description": "Telco cyber defense, lawful interception, privacy protection (GDPR), and regulatory compliance.",
                "processes_l2": [
                    {"id": "1.5.2.1", "name": "Cyber Defense & Threat Management", "stream": "Enterprise"},
                    {"id": "1.5.2.2", "name": "Regulatory Compliance & Lawful Intercept", "stream": "Enterprise"}
                ]
            }
        ]
    }
]

# 2. ODA Functional Blocks & Canonical Application Components (TAM / ODA)
ODA_COMPONENTS = [
    {
        "id": "comp-oda-party-mgmt",
        "name": "Party Management Component",
        "block": "Party Management",
        "description": "Centralized directory for individuals, organizations, roles, authentication credentials, and consent records.",
        "apis": ["TMF632 Party Management", "TMF669 Party Role", "TMF680 Recommendation"],
        "sid_entities": ["Individual", "Organization", "Party Role"]
    },
    {
        "id": "comp-oda-product-catalog",
        "name": "Product Catalog Management Component",
        "block": "Core Commerce Management",
        "description": "Master commercial catalog defining product specifications, commercial offerings, pricing tariffs, and bundling rules.",
        "apis": ["TMF620 Product Catalog Management", "TMF663 Shopping Cart"],
        "sid_entities": ["ProductOffering", "ProductSpecification", "PriceAlteration"]
    },
    {
        "id": "comp-oda-product-order",
        "name": "Product Order Capture & Orchestration Component",
        "block": "Core Commerce Management",
        "description": "Omnichannel customer order capture, validation, commercial decomposition, and state tracking.",
        "apis": ["TMF622 Product Ordering Management", "TMF679 Product Offering Qualification"],
        "sid_entities": ["ProductOrder", "OrderItem", "CustomerAgreement"]
    },
    {
        "id": "comp-oda-customer-bill",
        "name": "Customer Billing & Invoicing Component",
        "block": "Core Commerce Management",
        "description": "Billing engine managing customer billing accounts, recurring cycle invoicing, bill formatting, and payments.",
        "apis": ["TMF678 Customer Bill Management", "TMF676 Payment Management", "TMF666 Account Management"],
        "sid_entities": ["CustomerBill", "BillingAccount", "PaymentMethod"]
    },
    {
        "id": "comp-oda-service-catalog",
        "name": "Service Catalog Management Component",
        "block": "Production",
        "description": "Technical service specifications catalog (Customer Facing Service - CFS, Resource Facing Service - RFS).",
        "apis": ["TMF633 Service Catalog Management"],
        "sid_entities": ["ServiceSpecification", "CFSSpecification", "RFSSpecification"]
    },
    {
        "id": "comp-oda-service-order",
        "name": "Service Order Orchestration Component",
        "block": "Production",
        "description": "Technical service activation, end-to-end service orchestration across network domains, and dependency dispatching.",
        "apis": ["TMF641 Service Ordering Management", "TMF640 Service Activation"],
        "sid_entities": ["ServiceOrder", "ServiceOrderItem", "ServiceInstance"]
    },
    {
        "id": "comp-oda-resource-order",
        "name": "Resource Provisioning & Inventory Component",
        "block": "Production",
        "description": "Physical/virtual network inventory tracking, IP address management, SIM lifecycle, and NFV/VNF orchestration.",
        "apis": ["TMF652 Resource Order Management", "TMF639 Resource Inventory Management"],
        "sid_entities": ["ResourceInstance", "LogicalResource", "PhysicalResource"]
    },
    {
        "id": "comp-oda-service-problem",
        "name": "Service Problem & Incident Management Component",
        "block": "Production",
        "description": "Trouble ticket creation, service impact analysis, incident correlation, and SLA tracking.",
        "apis": ["TMF656 Service Problem Management", "TMF621 Trouble Ticket"],
        "sid_entities": ["TroubleTicket", "ServiceProblem", "SLAThreshold"]
    },
    {
        "id": "comp-oda-alarm-mgmt",
        "name": "Network Alarm & Fault Management Component",
        "block": "Production",
        "description": "Real-time network telemetry alarm ingestion, root-cause analysis (RCA), deduplication, and automated healing.",
        "apis": ["TMF642 Alarm Management", "TMF628 Performance Management"],
        "sid_entities": ["AlarmRecord", "FaultIndicator", "PerformanceMetric"]
    },
    {
        "id": "comp-oda-engagement-portal",
        "name": "Decoupled Digital Experience Portal",
        "block": "Engagement",
        "description": "Omnichannel customer and agent self-service front-end communicating exclusively via TM Forum Open APIs.",
        "apis": ["TMF620 Product Catalog", "TMF622 Product Order", "TMF678 Customer Bill", "TMF621 Trouble Ticket"],
        "sid_entities": ["UserSession", "InteractionLog"]
    },
    {
        "id": "comp-oda-intelligence-analytics",
        "name": "AIOps & Telco Intelligence Engine",
        "block": "Intelligence",
        "description": "Machine learning engine for predictive maintenance, churn prediction, closed-loop network optimization, and next-best-action.",
        "apis": ["TMF681 Communication Management", "TMF702 Closed Loop Anomaly Management"],
        "sid_entities": ["AIModelSpec", "PredictionRecord", "AnomalyAlert"]
    }
]

# 3. Canonical SID Information Entities (BusinessObject)
SID_INFORMATION_ENTITIES = [
    {"name": "Customer", "aggregate": "Party", "description": "Legal or individual entity engaging commercially with the communications provider."},
    {"name": "Product Offering", "aggregate": "Product", "description": "Commercial tariff, bundle, or proposition available for customer subscription."},
    {"name": "Product Order", "aggregate": "Product", "description": "Legally binding agreement to purchase, modify, or terminate telecom products."},
    {"name": "Customer Bill", "aggregate": "Billing", "description": "Periodic statement of telecom charges, taxes, and applied credits."},
    {"name": "Customer Facing Service (CFS)", "aggregate": "Service", "description": "Abstract technical telecom capability perceived by the customer (e.g. 5G Broadband, Fixed Voice)."},
    {"name": "Resource Facing Service (RFS)", "aggregate": "Service", "description": "Technical configuration of network and IT resources required to realize a CFS (e.g. APN, VLAN, SIP Trunk)."},
    {"name": "Resource Instance", "aggregate": "Resource", "description": "Physical, logical, or virtual component of the network (e.g. 5G Base Station, Optical Fiber, Router, SIM card)."},
    {"name": "Trouble Ticket", "aggregate": "Common", "description": "Formal record tracking an operational fault, outage, or customer reported incident."}
]
