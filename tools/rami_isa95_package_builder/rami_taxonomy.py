"""
RAMI 4.0 (DIN SPEC 91345) & ISA-95 (IEC 62264) Canonical Taxonomy
Structured taxonomy for Smart Factory, Industrial IoT, OT/IT Convergence,
Asset Administration Shell (AAS), and Manufacturing Operations Management.
"""

from typing import Dict, List, Any

# 1. RAMI 4.0 Architectural Layers (Vertical Dimension)
RAMI_LAYERS = [
    {"code": "LAYER-ASSET", "name": "Asset Layer", "description": "The physical reality: machinery, parts, robots, materials, sensors, documents, and operators."},
    {"code": "LAYER-INTEGRATION", "name": "Integration Layer", "description": "Physical-to-digital transition: sensor digitization, actuators, human-machine interface (HMI), RFID, barcoding."},
    {"code": "LAYER-COMMUNICATION", "name": "Communication Layer", "description": "Standard industrial networking and protocols: Industrial Ethernet, OPC-UA, MQTT, PROFINET, TSN, private 5G."},
    {"code": "LAYER-INFORMATION", "name": "Information Layer", "description": "Semantic data models, Asset Administration Shell (AAS / IEC 63278), digital twin registers, time-series telemetry."},
    {"code": "LAYER-FUNCTIONAL", "name": "Functional Layer", "description": "Formal software logic, control algorithms, Manufacturing Execution Systems (MES), dispatching, quality gates."},
    {"code": "LAYER-BUSINESS", "name": "Business Layer", "description": "Commercial agreements, manufacturing orders, customer requirements, regulatory compliance, supply chain logistics."}
]

# 2. RAMI 4.0 & ISA-95 Hierarchy Levels (Horizontal Dimension)
HIERARCHY_LEVELS = [
    {"code": "HL-PRODUCT", "name": "Product", "isa95_level": "Level 0", "description": "The manufactured physical or digital product throughout its lifecycle (e.g. assembled vehicle, battery pack, pharmaceutical batch)."},
    {"code": "HL-FIELD", "name": "Field Device", "isa95_level": "Level 1", "description": "Sensors, smart transmitters, optical scanners, and actuators interacting directly with physical processes."},
    {"code": "HL-CONTROL", "name": "Control Device", "isa95_level": "Level 2", "description": "Programmable Logic Controllers (PLC), Distributed Control Systems (DCS), drives, and industrial motion controllers."},
    {"code": "HL-STATION", "name": "Station", "isa95_level": "Level 2", "description": "Autonomous manufacturing cell, individual machine tool, robotic welding station, packaging unit."},
    {"code": "HL-WORKCENTER", "name": "Work Center", "isa95_level": "Level 3", "description": "Assembly line, production department, manufacturing workshop managed by MES/MOM systems."},
    {"code": "HL-ENTERPRISE", "name": "Enterprise", "isa95_level": "Level 4", "description": "Entire factory, production plant, company-wide ERP planning, PLM design, supply chain and business management."},
    {"code": "HL-CONNECTED", "name": "Connected World", "isa95_level": "Level 5+", "description": "External industrial ecosystem, federated cloud services, collaborative supply networks, customer portals."}
]

# 3. ISA-95 Level 3 MOM Operations Categories (Manufacturing Operations Management)
ISA95_MOM_OPERATIONS = [
    {
        "code": "MOM-PROD",
        "name": "Production Operations Management",
        "description": "Production order scheduling, dispatching, detailed batch routing, execution tracking, and yield analysis.",
        "sub_operations": [
            "Production Order Scheduling & Dispatching",
            "Detailed Routing & Batch Execution",
            "WIP (Work In Progress) Tracking",
            "Production Performance & OEE Calculation"
        ]
    },
    {
        "code": "MOM-MAINT",
        "name": "Maintenance Operations Management",
        "description": "Corrective, preventive, and predictive equipment maintenance, tool calibration, and MTBF/MTTR tracking.",
        "sub_operations": [
            "Predictive Vibration & Thermographic Monitoring",
            "Preventive Tool Calibration & Setup",
            "Emergency Breakdown Dispatching & Work Orders",
            "Equipment Health & Wear Tracking"
        ]
    },
    {
        "code": "MOM-QUAL",
        "name": "Quality Operations Management",
        "description": "In-process quality gates, statistical process control (SPC), non-conformance quarantine, and certificate of analysis (CoA).",
        "sub_operations": [
            "In-Line Optical Inspection & Vision Quality",
            "Statistical Process Control (SPC) Monitoring",
            "Non-Conformance Defect Isolation & Quarantine",
            "Electronic Batch Release & CoA Generation"
        ]
    },
    {
        "code": "MOM-INV",
        "name": "Inventory & Material Operations Management",
        "description": "Shopfloor raw material staging, line-side buffer replenishment, scrap accounting, and finished goods transfer.",
        "sub_operations": [
            "Line-Side Raw Material Staging & Kitting",
            "Automated Guided Vehicle (AGV) Dispatching",
            "Kanban Replenishment & Bin Management",
            "Finished Goods Packaging & Pallet Serialization"
        ]
    }
]

# 4. Canonical OT/IT Software Components (ApplicationComponent)
INDUSTRIAL_SOFTWARE_COMPONENTS = [
    {
        "id": "comp-rami-erp",
        "name": "Enterprise Resource Planning (ERP)",
        "isa95_level": "Level 4 - Enterprise",
        "rami_layer": "Business Layer",
        "description": "Master manufacturing master data, sales order processing, MRP capacity planning, financial cost accounting.",
        "protocols": ["REST API", "OData", "IDoc/RFC"]
    },
    {
        "id": "comp-rami-plm",
        "name": "Product Lifecycle Management (PLM)",
        "isa95_level": "Level 4 - Enterprise",
        "rami_layer": "Information Layer",
        "description": "CAD/CAM engineering drawings, engineering bill of materials (eBOM), manufacturing bill of materials (mBOM).",
        "protocols": ["STEP AP242", "JT Open", "REST API"]
    },
    {
        "id": "comp-rami-mes",
        "name": "Manufacturing Execution System (MES/MOM)",
        "isa95_level": "Level 3 - Operations",
        "rami_layer": "Functional Layer",
        "description": "Real-time production dispatching, work order tracking, electronic batch record (eBR), Overall Equipment Effectiveness (OEE).",
        "protocols": ["OPC-UA", "B2MML (Business to Manufacturing)", "REST API"]
    },
    {
        "id": "comp-rami-qms",
        "name": "Quality Management & LIMS System",
        "isa95_level": "Level 3 - Operations",
        "rami_layer": "Functional Layer",
        "description": "Laboratory Information Management (LIMS), sampling plans, Defect Tracking, inspection results validation.",
        "protocols": ["REST API", "B2MML", "CSV/ASTM"]
    },
    {
        "id": "comp-rami-cmms",
        "name": "Computerized Maintenance Management System (CMMS)",
        "isa95_level": "Level 3 - Operations",
        "rami_layer": "Functional Layer",
        "description": "Predictive maintenance scheduling, spare parts inventory, equipment work orders, mean time to repair (MTTR).",
        "protocols": ["REST API", "OPC-UA Alerts", "MQTT"]
    },
    {
        "id": "comp-rami-scada",
        "name": "SCADA & Supervisory Control Platform",
        "isa95_level": "Level 2 - Control",
        "rami_layer": "Integration Layer",
        "description": "Supervisory data acquisition, alarm summary, plant mimic display, recipe download to PLC controllers.",
        "protocols": ["OPC-UA Server", "Modbus TCP", "PROFINET", "EtherNet/IP"]
    },
    {
        "id": "comp-rami-plc-runtime",
        "name": "PLC / DCS Real-Time Automation Runtime",
        "isa95_level": "Level 2 - Control",
        "rami_layer": "Integration Layer",
        "description": "Deterministic cyclic logic execution (IEC 61131-3: Ladder, Structured Text), safety interlocks, closed-loop PID control.",
        "protocols": ["PROFINET IO", "EtherCAT", "OPC-UA Embedded"]
    },
    {
        "id": "comp-rami-edge-gateway",
        "name": "Industrial IoT Edge Gateway",
        "isa95_level": "Level 2 - Control",
        "rami_layer": "Communication Layer",
        "description": "On-premise edge computing device collecting high-frequency vibration/temperature telemetry, filtering, and publishing to cloud.",
        "protocols": ["MQTT Sparkplug B", "OPC-UA Publisher", "HTTPS"]
    },
    {
        "id": "comp-rami-aas-server",
        "name": "Asset Administration Shell (AAS) Repository",
        "isa95_level": "Level 3 - Operations",
        "rami_layer": "Information Layer",
        "description": "Standardized digital twin repository hosting AAS packages (Digital Nameplate, Technical Specs, Carbon Footprint PCF).",
        "protocols": ["AAS REST API (IEC 63278)", "OPC-UA for AAS"]
    }
]

# 5. Canonical Physical Equipment & Work Centers (Equipment / Facility)
PHYSICAL_ASSETS = [
    {
        "id": "equip-cnc-workcenter",
        "name": "5-Axis High Precision CNC Machining Center",
        "type": "Equipment",
        "hierarchy": "Station",
        "isa95_level": "Level 1 / Level 2",
        "description": "Automated computerized milling and lathe center with tool magazine, spindle temperature sensors, and Sinumerik/Heidenhain CNC."
    },
    {
        "id": "equip-robotic-cell",
        "name": "Collaborative Robotic Welding Cell",
        "type": "Equipment",
        "hierarchy": "Station",
        "isa95_level": "Level 1 / Level 2",
        "description": "6-Axis articulated industrial robot equipped with laser welding head, protective safety enclosure, and integrated vision system."
    },
    {
        "id": "equip-agv-fleet",
        "name": "Autonomous Mobile Robot (AMR / AGV)",
        "type": "Equipment",
        "hierarchy": "Work Center",
        "isa95_level": "Level 1 / Level 2",
        "description": "Automated material handling vehicle navigating shopfloor corridors with LiDAR sensors to deliver raw materials line-side."
    },
    {
        "id": "equip-assembly-line",
        "name": "Final Product Assembly Line #1",
        "type": "Facility",
        "hierarchy": "Work Center",
        "isa95_level": "Level 3 - Operations",
        "description": "Discrete manufacturing work center grouping 8 automated assembly stations, conveyor transfer lines, and end-of-line test benches."
    },
    {
        "id": "equip-factory-plant",
        "name": "Smart Factory Production Plant",
        "type": "Facility",
        "hierarchy": "Enterprise",
        "isa95_level": "Level 4 - Enterprise",
        "description": "Physical industrial manufacturing site encompassing raw material warehouses, production cleanrooms, testing labs, and dispatch docks."
    }
]

# 6. Canonical Industrial Data Objects & Digital Twin Assets (BusinessObject / DataObject)
INDUSTRIAL_DATA_ENTITIES = [
    {"name": "Production Order (PO)", "type": "BusinessObject", "level": "Level 4", "description": "Commercial manufacturing order from ERP specifying finished goods quantity, delivery due date, and customer link."},
    {"name": "Electronic Batch Record (eBR)", "type": "DataObject", "level": "Level 3", "description": "Complete digital audit trail recording operator sign-offs, machine parameters, lot numbers, and quality release data."},
    {"name": "Manufacturing Bill of Materials (mBOM)", "type": "DataObject", "level": "Level 3", "description": "Hierarchical recipe or parts list consumed step-by-step along the assembly line stations."},
    {"name": "Asset Administration Shell (AAS)", "type": "DataObject", "level": "Level 3", "description": "Standardized digital twin metadata envelope containing the Digital Nameplate, Product Carbon Footprint (PCF), and telemetry links."},
    {"name": "Work Order Dispatch Ticket", "type": "DataObject", "level": "Level 3", "description": "Discrete operational task assigned to a specific machine station or operator shift."},
    {"name": "Quality Inspection Certificate (CoA)", "type": "DataObject", "level": "Level 3", "description": "Official laboratory certificate of analysis certifying product conformity against technical tolerance limits."}
]
