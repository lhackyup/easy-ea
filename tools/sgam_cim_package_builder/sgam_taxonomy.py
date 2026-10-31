"""
SGAM (CEN-CENELEC-ETSI M/490) & IEC CIM (IEC 61968 / 61970) Taxonomy
Canonical taxonomy for Smart Grids, Power Utilities, Transmission & Distribution,
Substation Automation (IEC 61850), and Energy Market Flexibility.
"""

from typing import Dict, List, Any

# 1. SGAM Electrical Domains (Horizontal Physical Dimension)
SGAM_DOMAINS = [
    {"code": "DOM-GEN", "name": "Bulk Generation", "description": "Large-scale conventional, hydroelectric, nuclear, and offshore wind power plants feeding the high-voltage transmission grid."},
    {"code": "DOM-TRA", "name": "Transmission (TSO)", "description": "Extra-high and high-voltage transmission grid (220kV - 380kV) ensuring interregional power wheeling and grid stability."},
    {"code": "DOM-DIS", "name": "Distribution (DSO)", "description": "Medium-voltage (MV) and low-voltage (LV) distribution grid delivering electrical power to end-users."},
    {"code": "DOM-DER", "name": "Distributed Energy Resources (DER)", "description": "Decentralized renewable energy sources (rooftop PV, small wind, Battery Energy Storage Systems - BESS)."},
    {"code": "DOM-CUST", "name": "Customer Premises", "description": "Industrial manufacturing plants, commercial buildings, residential prosumers, and electric vehicle (EV) charging stations."}
]

# 2. SGAM Management Zones (Hierarchical Spatial Dimension)
SGAM_ZONES = [
    {"code": "ZONE-PROC", "name": "Process Zone", "description": "Physical transformation of electrical energy (transformers, circuit breakers, busbars, power lines)."},
    {"code": "ZONE-FIELD", "name": "Field Zone", "description": "Sensing and protection devices (Intelligent Electronic Devices - IEDs, current/voltage transformers, protection relays)."},
    {"code": "ZONE-STAT", "name": "Station Zone", "description": "Primary and secondary electrical substations, bay controllers, remote terminal units (RTUs), and local data concentrators."},
    {"code": "ZONE-OPER", "name": "Operation Zone", "description": "Control center supervisory management (SCADA, EMS, ADMS, Outage Management OMS, DERMS)."},
    {"code": "ZONE-ENT", "name": "Enterprise Zone", "description": "Corporate asset management, Geographic Information Systems (GIS), billing, meter data analytics, and customer care."},
    {"code": "ZONE-MKT", "name": "Market Zone", "description": "Wholesale electricity markets, spot/day-ahead trading, balancing markets, and flexibility exchange platforms."}
]

# 3. Grid Management Operational Capabilities & Functions (BusinessFunction / BusinessProcess)
GRID_CAPABILITIES = [
    {
        "id": "cap-grid-state-estimation",
        "name": "State Estimation & Network Topology Analysis",
        "domain": "Transmission (TSO)",
        "zone": "Operation Zone",
        "description": "Real-time calculation of complete bus voltages, active/reactive power flows, and contingency analysis (N-1 criterion)."
    },
    {
        "id": "cap-grid-voltage-var",
        "name": "Volt/VAR Optimization & Reactive Power Control (VVO)",
        "domain": "Distribution (DSO)",
        "zone": "Operation Zone",
        "description": "Automated coordination of tap changers, capacitor banks, and inverter reactive power to minimize technical line losses."
    },
    {
        "id": "cap-grid-flisr",
        "name": "Fault Location, Isolation & Service Restoration (FLISR)",
        "domain": "Distribution (DSO)",
        "zone": "Operation Zone",
        "description": "Self-healing smart grid automation: detects feeder faults, automatically trips sectionalizers, isolates faulted segment, and restores healthy areas in seconds."
    },
    {
        "id": "cap-grid-substation-auto",
        "name": "IEC 61850 Substation Automation & Teleprotection",
        "domain": "Distribution (DSO)",
        "zone": "Station Zone",
        "description": "Inter-bay communication using GOOSE and Sampled Measured Values (SMV) for ultra-fast fault clearing under 4 milliseconds."
    },
    {
        "id": "cap-grid-ami-metering",
        "name": "Advanced Metering Infrastructure (AMI) & Reading",
        "domain": "Customer Premises",
        "zone": "Enterprise Zone",
        "description": "Bidirectional smart meter communication for quarter-hourly load curves, remote connect/disconnect, and power quality monitoring."
    },
    {
        "id": "cap-grid-der-flexibility",
        "name": "Distributed Flexibility & Demand Response Dispatch",
        "domain": "Distributed Energy Resources (DER)",
        "zone": "Market Zone",
        "description": "Aggregation of residential batteries and industrial loads into Virtual Power Plants (VPP) to participate in frequency containment reserves."
    },
    {
        "id": "cap-grid-outage-mgmt",
        "name": "Work & Outage Management (OMS)",
        "domain": "Distribution (DSO)",
        "zone": "Operation Zone",
        "description": "Trouble call tracking, incident localization, crew field dispatching, and statutory SAIDI / SAIFI reliability reporting."
    }
]

# 4. Canonical Utility Software Systems (ApplicationComponent)
UTILITY_CORE_SYSTEMS = [
    {
        "id": "comp-sgam-ems",
        "name": "Energy Management System (EMS / SCADA)",
        "zone": "Operation Zone",
        "description": "High-voltage transmission grid control platform executing real-time AGC (Automatic Generation Control) and state estimation.",
        "protocols": ["IEC 60870-5-104", "ICCP (TASE.2)", "CIM/IEC 61970"]
    },
    {
        "id": "comp-sgam-adms",
        "name": "Advanced Distribution Management System (ADMS)",
        "zone": "Operation Zone",
        "description": "Integrated distribution control system combining SCADA, network power flow, FLISR self-healing, and switching order management.",
        "protocols": ["IEC 60870-5-104", "DNP3", "CIM/IEC 61968"]
    },
    {
        "id": "comp-sgam-oms",
        "name": "Outage Management System (OMS)",
        "zone": "Operation Zone",
        "description": "Emergency storm center managing network fault outages, customer notifications, and field technician dispatch.",
        "protocols": ["CIM/IEC 61968-3", "REST API"]
    },
    {
        "id": "comp-sgam-gis",
        "name": "Geographic Information System (GIS Network Model)",
        "zone": "Enterprise Zone",
        "description": "Enterprise geospatial single source of truth for physical power poles, underground cables, substations, and customer delivery points.",
        "protocols": ["CIM/XML GML", "OGC WFS/WMS", "GeoJSON"]
    },
    {
        "id": "comp-sgam-mdms",
        "name": "Meter Data Management System (MDMS)",
        "zone": "Enterprise Zone",
        "description": "Big data ingestion platform executing VEE (Validation, Estimation, and Editing) on millions of smart meter reading intervals.",
        "protocols": ["DLMS/COSEM", "CIM/IEC 61968-9", "REST API"]
    },
    {
        "id": "comp-sgam-derms",
        "name": "Distributed Energy Resource Management (DERMS / VPP)",
        "zone": "Operation Zone",
        "description": "Control platform managing aggregated fleets of solar inverters, battery storage, and EV chargers for grid services.",
        "protocols": ["OpenADR 2.0b", "IEEE 2030.5", "MQTT"]
    },
    {
        "id": "comp-sgam-market-platform",
        "name": "Electricity Market Settlement & Bidding Platform",
        "zone": "Market Zone",
        "description": "Trading platform interfacing power exchanges (EPEX SPOT, Nord Pool, GME) and settlement of balancing energy.",
        "protocols": ["IEC 62325 CIM Market", "ENTSO-E EDI"]
    }
]

# 5. Canonical Common Information Model Entities (CIM - DataObject / BusinessObject)
CIM_ENTITIES = [
    {"name": "Substation (CIM)", "type": "DataObject", "cim_package": "IEC 61970 Wires", "description": "Collection of equipment located in a designated area to switch, step up, or step down electrical power voltage."},
    {"name": "Power Transformer (CIM)", "type": "DataObject", "cim_package": "IEC 61970 Wires", "description": "Electrical machine that transfers electrical energy between circuits through electromagnetic induction."},
    {"name": "AC Line Segment (CIM)", "type": "DataObject", "cim_package": "IEC 61970 Wires", "description": "A wire or combination of wires conducting electric current with specified electrical impedance and resistance."},
    {"name": "Energy Consumer / Load (CIM)", "type": "DataObject", "cim_package": "IEC 61970 Wires", "description": "Generic user of energy - a point of consumption on the transmission or distribution power grid."},
    {"name": "Meter Reading (CIM)", "type": "DataObject", "cim_package": "IEC 61968 Metering", "description": "Measured quantity recorded by an electricity smart meter over a specific time interval (active kWh, reactive kVARh)."},
    {"name": "Outage Work Order (CIM)", "type": "DataObject", "cim_package": "IEC 61968 Work", "description": "Work order document specifying planned maintenance or emergency power restoration tasks."},
    {"name": "Flexibility Bid / Offer (CIM)", "type": "DataObject", "cim_package": "IEC 62325 Market", "description": "Market transaction offering upward or downward power adjustments for grid balancing services."}
]
