"""
SCOR Digital Standard (SCOR DS v14.0 - ASCM) Canonical Taxonomy
Structured taxonomy for Supply Chain, Omnichannel Logistics, Procurement,
Manufacturing Transformation, Distribution, and Circular Return.
"""

from typing import Dict, List, Any

# 1. SCOR DS Fundamental Processes (Level 1)
SCOR_L1_PROCESSES = [
    {
        "code": "sO",
        "name": "Orchestrate",
        "description": "Integration and alignment of supply chain strategy, governance, business rules, digital threads, and ESG circularity.",
        "processes_l2": [
            {"code": "sO1", "name": "Supply Chain Strategy & Network Design", "description": "Global footprint optimization, dual-sourcing strategy, and supply chain segmentation."},
            {"code": "sO2", "name": "Supply Chain Risk & Disruption Management", "description": "Vulnerability monitoring, supplier financial health, and business continuity readiness."},
            {"code": "sO3", "name": "Circular Economy & Sustainability (ESG)", "description": "Carbon footprint accounting (Scope 3), packaging recyclability, and zero-waste initiatives."}
        ]
    },
    {
        "code": "sP",
        "name": "Plan",
        "description": "Determining requirements and aggregating resources across demand, supply, inventory, and distribution.",
        "processes_l2": [
            {"code": "sP1", "name": "Demand Forecasting & Consensus Planning", "description": "Statistical demand sensing, promotion uplift modeling, and baseline sales forecasting."},
            {"code": "sP2", "name": "Sales & Operations Planning (S&OP / IBP)", "description": "Executive cross-functional alignment reconciling unconstrained demand with supply capacity."},
            {"code": "sP3", "name": "Master Production Scheduling (MPS)", "description": "Time-phased finished goods manufacturing schedule balancing capacity constraints."},
            {"code": "sP4", "name": "Multi-Echelon Inventory Optimization (MEIO)", "description": "Safety stock calculation and buffer placement across central and regional distribution centers."}
        ]
    },
    {
        "code": "sO_ORD",
        "name": "Order",
        "description": "Customer purchase order management, commercial terms, credit verification, order capture, and fulfillment routing.",
        "processes_l2": [
            {"code": "sORD1", "name": "Customer Quotation & Order Capture", "description": "Omnichannel intake of customer orders across EDI, B2B portals, and e-commerce."},
            {"code": "sORD2", "name": "Credit Check & Payment Authorization", "description": "Automated financial risk review, credit limit verification, and payment hold clearance."},
            {"code": "sORD3", "name": "Available-to-Promise (ATP) & Sourcing Routing", "description": "Dynamic inventory reservation and optimal fulfillment node allocation."}
        ]
    },
    {
        "code": "sS",
        "name": "Source",
        "description": "Procurement, purchase order issuance, receipt, inspection, and supplier payment authorization.",
        "processes_l2": [
            {"code": "sS1", "name": "Supplier Negotiation & Purchase Order Issuance", "description": "Contractual PO transmission to approved Tier-1 and Tier-2 suppliers."},
            {"code": "sS2", "name": "Inbound Logistics & Goods Receipt", "description": "Truck gate check-in, dock scheduling, container unloading, and ASN matching."},
            {"code": "sS3", "name": "Inbound Quality Inspection & Acceptance", "description": "Sampling incoming raw materials against technical tolerance specifications."},
            {"code": "sS4", "name": "3-Way Invoice Matching & Payment Approval", "description": "Automated reconciliation of Purchase Order, Goods Receipt, and Vendor Invoice."}
        ]
    },
    {
        "code": "sT",
        "name": "Transform",
        "description": "Conversion of raw materials into finished or semi-finished products through assembly, chemical reaction, or packaging.",
        "processes_l2": [
            {"code": "sT1", "name": "Shopfloor Production Dispatching & Staging", "description": "Kitting materials from line-side inventory to assembly workstations."},
            {"code": "sT2", "name": "Manufacturing Execution & Value-Add Processing", "description": "Machining, blending, assembly, or discrete fabrication of product batches."},
            {"code": "sT3", "name": "Final Quality Control & Product Packaging", "description": "End-of-line testing, secondary packaging, barcoding, and pallet serialization."}
        ]
    },
    {
        "code": "sD",
        "name": "Deliver",
        "description": "Order fulfillment, warehouse picking and packing, carrier transportation, customs clearance, and customer delivery.",
        "processes_l2": [
            {"code": "sD1", "name": "Warehouse Wave Picking & Order Packing", "description": "Automated warehouse pick wave routing, packing into shipping cartons, and labeling."},
            {"code": "sD2", "name": "Transportation Planning & Freight Consolidation", "description": "Load building, carrier rate shopping, route optimization, and cross-docking."},
            {"code": "sD3", "name": "Carrier Dispatch & In-Transit Tracking", "description": "Tendering shipments to 3PL logistics carriers and real-time GPS milestone tracking."},
            {"code": "sD4", "name": "Final Mile Delivery & Proof of Delivery (POD)", "description": "Customer drop-off, electronic signature capture, and delivery receipt confirmation."}
        ]
    },
    {
        "code": "sR",
        "name": "Return",
        "description": "Reverse logistics, return material authorization, defective product triage, repair, refurbishing, and recycling.",
        "processes_l2": [
            {"code": "sR1", "name": "Return Material Authorization (RMA) Issuance", "description": "Customer return approval, return label generation, and warranty coverage validation."},
            {"code": "sR2", "name": "Reverse Goods Receipt & Inspection Triage", "description": "Return item grading (like-new restock, minor defect repair, hazardous scrap)."},
            {"code": "sR3", "name": "MRO Repair, Refurbishment & Re-commerce", "description": "Factory re-certification, parts recovery, and secondary channel liquidation."}
        ]
    }
]

# 2. Canonical Supply Chain Software Platforms (ApplicationComponent)
SUPPLY_CHAIN_SYSTEMS = [
    {
        "id": "comp-scor-scp",
        "name": "Supply Chain Planning & S&OP Platform (SCP)",
        "scor_scope": "Plan",
        "description": "Advanced planning software executing demand sensing, multi-echelon inventory optimization (MEIO), and supply constraint simulation.",
        "capabilities": ["Demand Planning", "S&OP / IBP", "Inventory Optimization"]
    },
    {
        "id": "comp-scor-oms",
        "name": "Distributed Order Management System (DOM / OMS)",
        "scor_scope": "Order",
        "description": "Omnichannel order orchestrator with enterprise-wide inventory visibility, dynamic ATP routing, and payment validation.",
        "capabilities": ["Order Capture", "ATP Allocation", "Store Fulfillment Routing"]
    },
    {
        "id": "comp-scor-srm",
        "name": "Supplier Relationship & Procurement Portal (SRM)",
        "scor_scope": "Source",
        "description": "Supplier collaboration platform for e-sourcing, PO confirmation, ASN dispatch, and vendor scorecard ratings.",
        "capabilities": ["Vendor Management", "e-Procurement", "Contract Management"]
    },
    {
        "id": "comp-scor-wms",
        "name": "Warehouse Management System (WMS)",
        "scor_scope": "Deliver",
        "description": "Facility logistics execution system directing slotting, pick waves, cartonization, conveyor sorting, and dock staging.",
        "capabilities": ["Wave Picking", "Inventory Putaway", "Packing & Labeling"]
    },
    {
        "id": "comp-scor-tms",
        "name": "Transportation Management System (TMS)",
        "scor_scope": "Deliver",
        "description": "Logistics dispatching platform optimizing truckload routing, carrier rate tendering, freight audit, and real-time tracking.",
        "capabilities": ["Route Optimization", "Freight Settlement", "Carrier Tracking"]
    },
    {
        "id": "comp-scor-erp",
        "name": "Enterprise Resource Planning (ERP Logistics Backbone)",
        "scor_scope": "Enterprise",
        "description": "Central ledger recording general financial inventory valuation, material master records, and billing accounting.",
        "capabilities": ["Inventory Valuation", "Accounts Payable", "Financial Ledger"]
    },
    {
        "id": "comp-scor-reverse",
        "name": "Reverse Logistics & Warranty Management System",
        "scor_scope": "Return",
        "description": "RMA portal directing customer returns, automated refund crediting, and depot repair triage routing.",
        "capabilities": ["RMA Processing", "Warranty Claims", "Depot Repair Triage"]
    }
]

# 3. Canonical Supply Chain Business & Data Objects (BusinessObject / Deliverable)
SCOR_DATA_ENTITIES = [
    {"name": "Customer Sales Order", "type": "BusinessObject", "process": "Order", "description": "Commercial customer order document committing deliverables, pricing, and agreed SLA delivery dates."},
    {"name": "Supplier Purchase Order (PO)", "type": "BusinessObject", "process": "Source", "description": "Legally binding procurement order authorized to a vendor for raw materials or parts."},
    {"name": "Advanced Shipping Notice (ASN)", "type": "Deliverable", "process": "Source & Deliver", "description": "EDI/Electronic notification sent prior to physical delivery detailing carton contents and barcodes."},
    {"name": "Bill of Lading & Waybill (BOL)", "type": "Deliverable", "process": "Deliver", "description": "Legal contract between shipper and freight carrier detailing cargo quantity, consignee, and terms of carriage."},
    {"name": "Return Material Authorization (RMA)", "type": "BusinessObject", "process": "Return", "description": "Authorized transaction approving customer return of merchandise with tracking RMA number."},
    {"name": "Electronic Proof of Delivery (ePOD)", "type": "Deliverable", "process": "Deliver", "description": "Timestamped digital signature and GPS delivery receipt confirming completion of final mile shipment."}
]
