import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.archimate import CustomAttributeDefinition, ModelWorkspace

ARCHIMATE_METAMODEL = [
    {
        "layer": "Strategy",
        "color": "amber",
        "bg_color": "bg-amber-100",
        "border_color": "border-amber-400",
        "text_color": "text-amber-900",
        "description": "Defines the strategic direction, business capabilities, and resources required to achieve enterprise goals.",
        "element_types": [
            {
                "type": "Resource",
                "name": "Resource",
                "description": "An asset, capability, or resource owned or controlled by an organization (e.g. Specialized Staff, Financial Capital, Brand).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Resource Name", "data_type": "string", "is_required": True, "description": "Descriptive name of the strategic resource"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Detailed description of the resource"}
                ]
            },
            {
                "type": "Capability",
                "name": "Capability",
                "description": "An ability or fundamental capacity that an organization possesses or develops to achieve a business outcome (e.g. Payment Processing, Credit Risk Analysis).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Capability Name", "data_type": "string", "is_required": True, "description": "Name of the business capability"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Scope and definition of the capability"}
                ]
            },
            {
                "type": "ValueStream",
                "name": "Value Stream",
                "description": "A sequence of activities that creates an overall flow of value to a customer, stakeholder, or end user.",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Value Stream Name", "data_type": "string", "is_required": True, "description": "Name of the value stream"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Stages and description of value delivery"}
                ]
            },
            {
                "type": "CourseOfAction",
                "name": "Course of Action",
                "description": "An approach or strategic plan for configuring capabilities and resources to achieve goals (e.g. Digital Transformation, Cloud Migration).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Course of Action Name", "data_type": "string", "is_required": True, "description": "Name of the strategic course of action"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Objectives and implementation roadmap"}
                ]
            }
        ]
    },
    {
        "layer": "Business",
        "color": "yellow",
        "bg_color": "bg-yellow-100",
        "border_color": "border-yellow-400",
        "text_color": "text-yellow-900",
        "description": "Represents the business architecture, actors, roles, operational processes, functions, services, and business information.",
        "element_types": [
            {
                "type": "BusinessActor",
                "name": "Business Actor",
                "description": "An organizational entity, department, person, or group capable of performing behaviors (e.g. Retail Customer, Compliance Officer, Branch).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Actor Name", "data_type": "string", "is_required": True, "description": "Name of the individual or collective actor"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Role, responsibilities, and operational scope"}
                ]
            },
            {
                "type": "BusinessRole",
                "name": "Business Role",
                "description": "The responsibility for performing specific behavior, assigned to one or more actors (e.g. Account Manager, Cashier, Fraud Analyst).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Role Name", "data_type": "string", "is_required": True, "description": "Title or designation of the business role"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Competencies and associated responsibilities"}
                ]
            },
            {
                "type": "BusinessProcess",
                "name": "Business Process",
                "description": "A defined sequence of operational activities and decisions that produces a specific service or outcome (e.g. Account Opening, Wire Transfer).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Process Name", "data_type": "string", "is_required": True, "description": "Name of the operational business process"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Workflow steps and process description"}
                ]
            },
            {
                "type": "BusinessFunction",
                "name": "Business Function",
                "description": "A collection of business behaviors grouped on the basis of chosen criteria (e.g. Credit Department, Marketing Operations).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Function Name", "data_type": "string", "is_required": True, "description": "Name of the business function"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Purpose and organizational scope"}
                ]
            },
            {
                "type": "BusinessService",
                "name": "Business Service",
                "description": "An explicitly defined service exposed to internal or external customers (e.g. SEPA Payment Service, Personal Loan Underwriting).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Service Name", "data_type": "string", "is_required": True, "description": "Name of the provided business service"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Terms of service and delivered value"}
                ]
            },
            {
                "type": "BusinessObject",
                "name": "Business Object",
                "description": "A concept or information asset relevant from a business perspective (e.g. Account Agreement, Invoice, Payment Order).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Object Name", "data_type": "string", "is_required": True, "description": "Name of the business entity or information object"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Attributes, lifecycle, and information model"}
                ]
            },
            {
                "type": "Product",
                "name": "Product",
                "description": "A coherent package of services, contracts, and value propositions offered to market segments.",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Product Name", "data_type": "string", "is_required": True, "description": "Commercial product name"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Product composition and target market"}
                ]
            }
        ]
    },
    {
        "layer": "Application",
        "color": "cyan",
        "bg_color": "bg-cyan-100",
        "border_color": "border-cyan-400",
        "text_color": "text-cyan-900",
        "description": "Describes the architecture, behavior, structure, and interactions of application systems, software components, and data objects.",
        "element_types": [
            {
                "type": "ApplicationComponent",
                "name": "Application Component",
                "description": "An encapsulation of application functionality, modular software, microservice, or COTS/SaaS package (e.g. Core Banking Engine, CRM Salesforce, Payment Gateway).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Application Name", "data_type": "string", "is_required": True, "description": "Name of the system or application"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Architectural summary and documentation"}
                ]
            },
            {
                "type": "ApplicationInterface",
                "name": "Application Interface",
                "description": "A point of access where application services are made available to other systems or users (e.g. REST API /payments/v1, Web Portal UI).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Interface / API Name", "data_type": "string", "is_required": True, "description": "Name of the API or user interface"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Protocol (REST, gRPC, GraphQL) and Swagger/OpenAPI specifications"}
                ]
            },
            {
                "type": "ApplicationService",
                "name": "Application Service",
                "description": "An explicitly defined behavior exposed by an application component to support business processes (e.g. Payment Processing Service, Customer Verification Service).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Application Service Name", "data_type": "string", "is_required": True, "description": "Name of the provided application service"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Functional and technical service description"}
                ]
            },
            {
                "type": "DataObject",
                "name": "Data Object",
                "description": "Structured data accessible by software systems (e.g. Database Schema, Transaction Table, JSON Payload).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Data Object Name", "data_type": "string", "is_required": True, "description": "Name of the database table, entity, or schema"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Fields, schema relationships, and data structure"}
                ]
            }
        ]
    },
    {
        "layer": "Technology",
        "color": "emerald",
        "bg_color": "bg-emerald-100",
        "border_color": "border-emerald-400",
        "text_color": "text-emerald-900",
        "description": "Represents the underlying technology infrastructure, compute nodes, system software, cloud platforms, and communication networks.",
        "element_types": [
            {
                "type": "Node",
                "name": "Node",
                "description": "A computational resource or execution environment (e.g. Kubernetes Cluster, AWS EC2 Instance, Physical Server).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Node Name", "data_type": "string", "is_required": True, "description": "Hostname or compute cluster identifier"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Compute specifications, vCPU, RAM, and region"}
                ]
            },
            {
                "type": "Device",
                "name": "Device",
                "description": "A physical hardware apparatus with processing capability (e.g. Mainframe IBM z16, Server Rack, POS Terminal, Mobile Device).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Device Name", "data_type": "string", "is_required": True, "description": "Hardware device and model name"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Hardware specifications and serial information"}
                ]
            },
            {
                "type": "SystemSoftware",
                "name": "System Software",
                "description": "A software environment that supports execution of applications (e.g. PostgreSQL 16, Ubuntu Linux, Docker Engine, Redis Cache).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "System Software Name", "data_type": "string", "is_required": True, "description": "Name and version of operating system or middleware"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Version, license, and patch level"}
                ]
            },
            {
                "type": "CommunicationNetwork",
                "name": "Communication Network",
                "description": "A set of structures that connects nodes for data routing and communication (e.g. AWS VPC, Data Center LAN, SD-WAN).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Network Name", "data_type": "string", "is_required": True, "description": "Designation of network segment or subnet"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Subnet CIDR, topology, and bandwidth"}
                ]
            },
            {
                "type": "TechnologyService",
                "name": "Technology Service",
                "description": "An explicitly defined infrastructure service (e.g. Database-as-a-Service, S3 Object Storage, DNS Resolution).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Technology Service Name", "data_type": "string", "is_required": True, "description": "Name of the infrastructure service"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "SLA, reliability, and operational specifications"}
                ]
            },
            {
                "type": "Artifact",
                "name": "Artifact",
                "description": "A physical piece of data or compiled deployable unit (e.g. Docker Image, .jar File, SQL Migration Script).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Artifact Name", "data_type": "string", "is_required": True, "description": "Filename, binary, or image tag"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Repository location and build digest"}
                ]
            }
        ]
    },
    {
        "layer": "Motivation",
        "color": "purple",
        "bg_color": "bg-purple-100",
        "border_color": "border-purple-400",
        "text_color": "text-purple-900",
        "description": "Describes the motivations, drivers, strategic goals, principles, requirements, and constraints guiding architectural decisions.",
        "element_types": [
            {
                "type": "Stakeholder",
                "name": "Stakeholder",
                "description": "The role of an individual, team, or organization that has an interest in the architecture outcome (e.g. Board of Directors, Risk Committee, Regulatory Authority).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Stakeholder Name", "data_type": "string", "is_required": True, "description": "Name of the stakeholder or committee"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Primary interests and expectations"}
                ]
            },
            {
                "type": "Driver",
                "name": "Driver",
                "description": "An internal or external condition that motivates an organization to define its goals and initiate change (e.g. FinTech Market Competition, DORA / NIS2 Compliance).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Driver Name", "data_type": "string", "is_required": True, "description": "Title of the driving factor"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Business context and driver impact"}
                ]
            },
            {
                "type": "Goal",
                "name": "Goal",
                "description": "A high-level statement of intent or desired end state that an organization seeks to achieve (e.g. Reduce IT TCO by 25% by 2027).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Goal Name", "data_type": "string", "is_required": True, "description": "High-level goal description"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Target KPIs and measurement criteria"}
                ]
            },
            {
                "type": "Principle",
                "name": "Principle",
                "description": "A qualitative statement of intent defining general design rules (e.g. Cloud-Native First, Zero Trust Security, Single Source of Truth).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Principle Name", "data_type": "string", "is_required": True, "description": "Statement of the architectural principle"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Rationale and implementation implications"}
                ]
            },
            {
                "type": "Requirement",
                "name": "Requirement",
                "description": "A statement of need that must be met by the architecture (e.g. 99.99% Availability SLA, RTO < 2 hours, AES-256 Encryption).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Requirement Name", "data_type": "string", "is_required": True, "description": "Statement of the architecture requirement"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Acceptance criteria and MoSCoW priority"}
                ]
            },
            {
                "type": "Constraint",
                "name": "Constraint",
                "description": "An external or internal factor that restricts options in realizing goals (e.g. Maximum €500k Budget, GDPR Compliance, Legacy Mainframe Lock-in).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Constraint Name", "data_type": "string", "is_required": True, "description": "Constraint description"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Regulatory clause or budget constraints"}
                ]
            }
        ]
    },
    {
        "layer": "Implementation",
        "color": "rose",
        "bg_color": "bg-rose-100",
        "border_color": "border-rose-400",
        "text_color": "text-rose-900",
        "description": "Manages implementation programs, migration projects, work packages, deliverables, plateaus, and architecture gaps.",
        "element_types": [
            {
                "type": "WorkPackage",
                "name": "Work Package",
                "description": "A series of actions planned to achieve a goal or deliverable (e.g. Core Banking v3 Migration Project).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Work Package Name", "data_type": "string", "is_required": True, "description": "Project or sprint work package name"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Objectives, budget, and timeline"}
                ]
            },
            {
                "type": "Deliverable",
                "name": "Deliverable",
                "description": "A tangible output resulting from a Work Package (e.g. Architecture Blueprint Document, Software Release v2.1).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Deliverable Name", "data_type": "string", "is_required": True, "description": "Name of the deliverable output"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Delivery date, acceptance criteria, and status"}
                ]
            },
            {
                "type": "Plateau",
                "name": "Plateau",
                "description": "A relatively stable state of the architecture that exists during a limited period of time (e.g. Baseline 2025, Transition 2026, Target State 2028).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Plateau Name", "data_type": "string", "is_required": True, "description": "Temporal architecture baseline name"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Effective dates and baseline characteristics"}
                ]
            },
            {
                "type": "Gap",
                "name": "Gap",
                "description": "An outcome of a gap analysis representing a deficiency between two plateaux (e.g. Missing Enterprise API Gateway).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Gap Name", "data_type": "string", "is_required": True, "description": "Description of the architectural gap"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Business impact, urgency, and resolution plan"}
                ]
            }
        ]
    }
]

def get_full_metamodel_with_custom_attributes(db: Session, model_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Returns the full metamodel layers & element types with standard + custom attributes.
    If model_id is specified (and not '*'), includes global attributes plus attributes scoped to that model.
    """
    query = db.query(CustomAttributeDefinition)
    if model_id and model_id != "*":
        query = query.filter(
            (CustomAttributeDefinition.model_id == None) |
            (CustomAttributeDefinition.model_id == model_id)
        )
    elif not model_id:
        # Pure global metamodel
        query = query.filter(CustomAttributeDefinition.model_id == None)
    
    custom_attrs = query.all()
    
    # Organize custom attributes by element_type / layer
    custom_map: Dict[str, List[Dict[str, Any]]] = {}
    for ca in custom_attrs:
        key = ca.element_type
        if key not in custom_map:
            custom_map[key] = []
        custom_map[key].append({
            "id": ca.id,
            "model_id": ca.model_id,
            "library_code": ca.library_code,
            "section": ca.section or "Custom Attributes",
            "name": ca.name,
            "label": ca.label,
            "description": ca.description,
            "element_type": ca.element_type,
            "layer": ca.layer,
            "data_type": ca.data_type,
            "options": ca.options or [],
            "default_value": ca.default_value,
            "is_required": ca.is_required,
            "is_system": bool(ca.is_system),
            "created_at": ca.created_at.isoformat() if ca.created_at else None
        })

    # Clone metamodel and attach custom attributes
    result = []
    global_custom = custom_map.get("*", [])

    for layer_data in ARCHIMATE_METAMODEL:
        layer_name = layer_data["layer"]
        layer_custom = custom_map.get(f"layer:{layer_name}", [])
        
        types_list = []
        for elem in layer_data["element_types"]:
            e_type = elem["type"]
            elem_custom = custom_map.get(e_type, [])
            
            # Combine custom attributes relevant to this element
            attached_custom = global_custom + layer_custom + elem_custom
            
            # Remove duplicates by id
            seen = set()
            unique_custom = []
            for item in attached_custom:
                if item["id"] not in seen:
                    seen.add(item["id"])
                    unique_custom.append(item)

            types_list.append({
                **elem,
                "layer": layer_name,
                "custom_attributes": unique_custom
            })

        result.append({
            **layer_data,
            "element_types": types_list
        })

    return result

def list_custom_attributes(db: Session, model_id: Optional[str] = None, element_type: Optional[str] = None) -> List[Dict[str, Any]]:
    query = db.query(CustomAttributeDefinition)
    if model_id and model_id != "*":
        query = query.filter(
            (CustomAttributeDefinition.model_id == None) |
            (CustomAttributeDefinition.model_id == model_id)
        )
    elif not model_id:
        query = query.filter(CustomAttributeDefinition.model_id == None)
        
    if element_type:
        query = query.filter(
            (CustomAttributeDefinition.element_type == element_type) |
            (CustomAttributeDefinition.element_type == "*")
        )
    items = query.order_by(CustomAttributeDefinition.created_at.desc()).all()
    return [
        {
            "id": ca.id,
            "model_id": ca.model_id,
            "library_code": ca.library_code,
            "section": ca.section or "Custom Attributes",
            "name": ca.name,
            "label": ca.label,
            "description": ca.description,
            "element_type": ca.element_type,
            "layer": ca.layer,
            "data_type": ca.data_type,
            "options": ca.options or [],
            "default_value": ca.default_value,
            "is_required": ca.is_required,
            "is_system": bool(ca.is_system),
            "created_at": ca.created_at.isoformat() if ca.created_at else None
        }
        for ca in items
    ]

def create_custom_attribute(db: Session, data: Dict[str, Any]) -> Dict[str, Any]:
    attr_id = f"attr-{uuid.uuid4().hex[:8]}"
    model_id = data.get("model_id")
    raw_name = data["name"].strip().lower().replace(" ", "_").replace("-", "_")
    raw_name = "".join(c for c in raw_name if c.isalnum() or c == "_")
    
    lib_code = None
    if model_id:
        model = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
        if not model:
            raise HTTPException(status_code=404, detail=f"Model workspace '{model_id}' not found.")
        lib_code = (model.code or model.id[:4]).upper()
        prefix = f"{lib_code.lower()}_"
        if not raw_name.startswith(prefix):
            name_clean = f"{prefix}{raw_name}"
        else:
            name_clean = raw_name

        # Check duplicate in this model scope or global
        existing = db.query(CustomAttributeDefinition).filter(
            CustomAttributeDefinition.name == name_clean,
            (CustomAttributeDefinition.model_id == model_id) | (CustomAttributeDefinition.model_id == None)
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Attribute identifier '{name_clean}' already exists in this scope."
            )
    else:
        name_clean = raw_name
        # Check duplicate in global scope
        existing = db.query(CustomAttributeDefinition).filter(
            CustomAttributeDefinition.name == name_clean,
            CustomAttributeDefinition.model_id == None
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Global attribute identifier '{name_clean}' already exists."
            )

    section_name = (data.get("section") or "Custom Attributes").strip()
    if not section_name:
        section_name = "Custom Attributes"

    attr = CustomAttributeDefinition(
        id=attr_id,
        model_id=model_id,
        library_code=lib_code,
        section=section_name,
        name=name_clean,
        label=data["label"].strip(),
        description=data.get("description"),
        element_type=data.get("element_type", "*"),
        layer=data.get("layer", "All"),
        data_type=data.get("data_type", "string"),
        options=data.get("options", []),
        default_value=data.get("default_value"),
        is_required=data.get("is_required", False),
        is_system=False
    )
    db.add(attr)
    db.commit()
    db.refresh(attr)
    return {
        "id": attr.id,
        "model_id": attr.model_id,
        "library_code": attr.library_code,
        "section": attr.section,
        "name": attr.name,
        "label": attr.label,
        "description": attr.description,
        "element_type": attr.element_type,
        "layer": attr.layer,
        "data_type": attr.data_type,
        "options": attr.options or [],
        "default_value": attr.default_value,
        "is_required": attr.is_required,
        "is_system": bool(attr.is_system)
    }

def update_custom_attribute(db: Session, attr_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    attr = db.query(CustomAttributeDefinition).filter(CustomAttributeDefinition.id == attr_id).first()
    if not attr:
        raise HTTPException(status_code=404, detail=f"Custom attribute '{attr_id}' not found.")
    
    if "label" in data and data["label"]:
        attr.label = data["label"].strip()
    if "section" in data and data["section"] is not None:
        sec = data["section"].strip()
        attr.section = sec if sec else "Custom Attributes"
    if "description" in data:
        attr.description = data["description"]
    if "data_type" in data and data["data_type"] and not attr.is_system:
        attr.data_type = data["data_type"]
    if "options" in data:
        attr.options = data["options"] or []
    if "default_value" in data:
        attr.default_value = data["default_value"]
    if "is_required" in data and not attr.is_system:
        attr.is_required = bool(data["is_required"])
    
    db.commit()
    db.refresh(attr)
    return {
        "id": attr.id,
        "model_id": attr.model_id,
        "library_code": attr.library_code,
        "section": attr.section or "Custom Attributes",
        "name": attr.name,
        "label": attr.label,
        "description": attr.description,
        "element_type": attr.element_type,
        "layer": attr.layer,
        "data_type": attr.data_type,
        "options": attr.options or [],
        "default_value": attr.default_value,
        "is_required": attr.is_required,
        "is_system": bool(attr.is_system)
    }

def rename_custom_attributes_section(
    db: Session,
    old_section: str,
    new_section: str,
    model_id: Optional[str] = None,
    element_type: Optional[str] = None
) -> int:
    """Rename a section across all matching custom attributes."""
    new_sec = new_section.strip()
    if not new_sec:
        raise HTTPException(status_code=400, detail="New section name cannot be empty.")
    
    query = db.query(CustomAttributeDefinition).filter(CustomAttributeDefinition.section == old_section)
    if model_id and model_id != "*":
        query = query.filter(CustomAttributeDefinition.model_id == model_id)
    elif model_id == "global" or (model_id is not None and model_id == ""):
        query = query.filter(CustomAttributeDefinition.model_id == None)
    
    if element_type and element_type != "*":
        query = query.filter(CustomAttributeDefinition.element_type == element_type)
        
    matched = query.all()
    count = 0
    for attr in matched:
        attr.section = new_sec
        count += 1
    
    db.commit()
    return count

def delete_custom_attribute(db: Session, attr_id: str) -> bool:
    attr = db.query(CustomAttributeDefinition).filter(CustomAttributeDefinition.id == attr_id).first()
    if not attr:
        return False
    if attr.is_system or (attr.name and attr.name.startswith("eea_")):
        raise HTTPException(
            status_code=400,
            detail=f"Attribute '{attr.name}' is a built-in Easy-EA extension attribute and cannot be deleted."
        )
    db.delete(attr)
    db.commit()
    return True

def seed_default_custom_attributes(db: Session):
    """Seed or update initial Easy-EA extension attributes (with eea_ prefix) and sample custom attributes."""
    samples = [
        # Easy-EA APM & Business Portfolio System Extension Attributes
        {
            "id": "attr-eea-in-apm-scope",
            "name": "eea_in_apm_scope",
            "section": "APM & Business Portfolio",
            "label": "In APM Scope (Include in TIME & TCO)",
            "description": "Flag indicating whether this application is part of the active APM portfolio perimeter for TCO and TIME matrix calculations.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "boolean",
            "options": [],
            "default_value": "true",
            "is_required": False,
            "is_system": True
        },
        {
            "id": "attr-eea-business-fit",
            "name": "eea_business_fit",
            "section": "APM & Business Portfolio",
            "label": "Business Fit Score (1-5)",
            "description": "Strategic business alignment and value (Gartner TIME score 1 to 5).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "3",
            "is_required": True,
            "is_system": True
        },
        {
            "id": "attr-eea-technical-fit",
            "name": "eea_technical_fit",
            "section": "APM & Business Portfolio",
            "label": "Technical Fit Score (1-5)",
            "description": "Technical quality, maintainability, and absence of technical debt (Gartner TIME score 1 to 5).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "3",
            "is_required": True,
            "is_system": True
        },
        {
            "id": "attr-eea-time-quadrant",
            "name": "eea_time_quadrant",
            "section": "APM & Business Portfolio",
            "label": "TIME Decision Quadrant",
            "description": "Gartner portfolio decision quadrant (Invest, Migrate, Tolerate, Eliminate).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Invest", "Migrate", "Tolerate", "Eliminate"],
            "default_value": "Tolerate",
            "is_required": True,
            "is_system": True
        },
        {
            "id": "attr-eea-annual-cost",
            "name": "eea_annual_cost",
            "section": "APM & Business Portfolio",
            "label": "Annual Cost / TCO (€)",
            "description": "Total annual expenditure for software licenses, cloud hosting, and IT support.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "0",
            "is_required": True,
            "is_system": True
        },
        {
            "id": "attr-eea-business-criticality",
            "name": "eea_business_criticality",
            "section": "APM & Business Portfolio",
            "label": "Business Criticality",
            "description": "Level of operational impact in the event of an application outage.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Mission Critical", "Business Critical", "Business Operational", "Administrative"],
            "default_value": "Business Operational",
            "is_required": True,
            "is_system": True
        },
        {
            "id": "attr-eea-lifecycle-status",
            "name": "eea_lifecycle_status",
            "section": "APM & Business Portfolio",
            "label": "Lifecycle Status",
            "description": "Current architectural and operational lifecycle phase.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Plan", "Evaluation", "Live", "Phase-out", "Retired"],
            "default_value": "Live",
            "is_required": True,
            "is_system": True
        },
        {
            "id": "attr-eea-business-owner",
            "name": "eea_business_owner",
            "section": "APM & Business Portfolio",
            "label": "Business Owner",
            "description": "Business department lead accountable for the application.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": False,
            "is_system": True
        },
        {
            "id": "attr-eea-technical-owner",
            "name": "eea_technical_owner",
            "section": "APM & Business Portfolio",
            "label": "Technical Owner",
            "description": "Lead solution architect or IT component owner.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": False,
            "is_system": True
        },
        {
            "id": "attr-eea-vendor",
            "name": "eea_vendor",
            "section": "APM & Business Portfolio",
            "label": "Vendor / Supplier",
            "description": "Software provider, vendor, or internal development team.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": False,
            "is_system": True
        },
        {
            "id": "attr-eea-hosting-type",
            "name": "eea_hosting_type",
            "section": "APM & Business Portfolio",
            "label": "Hosting / Deployment Type",
            "description": "Infrastructure hosting and deployment model (SaaS, Cloud, On-Premise).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["SaaS", "Public Cloud", "Private Cloud", "On-Premise"],
            "default_value": "Public Cloud",
            "is_required": True,
            "is_system": True
        },
        {
            "id": "attr-eea-data-classification",
            "name": "eea_data_classification",
            "section": "APM & Business Portfolio",
            "label": "Data Classification",
            "description": "Confidentiality and sensitivity tier of managed business data.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Public", "Internal", "Confidential", "Restricted/GDPR"],
            "default_value": "Internal",
            "is_required": False,
            "is_system": True
        },
        # User Sample Custom Attributes
        {
            "id": "attr-rto-hours",
            "name": "rto_hours",
            "section": "Disaster Recovery & SLAs",
            "label": "RTO Target (Recovery Time in Hours)",
            "description": "Maximum tolerable downtime for application recovery during disaster scenarios (Disaster Recovery).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "4",
            "is_required": False,
            "is_system": False
        },
        {
            "id": "attr-gdpr-scope",
            "name": "gdpr_compliance_tier",
            "section": "Security & Compliance",
            "label": "GDPR & Privacy Compliance Tier",
            "description": "Classification of personal data processed by the application or process in compliance with GDPR regulations.",
            "element_type": "*",
            "layer": "All",
            "data_type": "select",
            "options": ["Tier 1 - No personal data", "Tier 2 - General personal data", "Tier 3 - Sensitive / financial data", "Tier 4 - High-risk / biometric data"],
            "default_value": "Tier 2 - General personal data",
            "is_required": False,
            "is_system": False
        },
        {
            "id": "attr-cost-center",
            "name": "cost_center_code",
            "section": "Financial Governance",
            "label": "Corporate Cost Center",
            "description": "SAP accounting code for operational and license cost allocation.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "CC-IT-1004",
            "is_required": False,
            "is_system": False
        }
    ]
    for s in samples:
        existing = db.query(CustomAttributeDefinition).filter(CustomAttributeDefinition.id == s["id"]).first()
        if existing:
            existing.name = s["name"]
            existing.label = s["label"]
            existing.description = s["description"]
            existing.options = s["options"]
            existing.default_value = s["default_value"]
            existing.is_system = s.get("is_system", False)
            if not existing.section:
                existing.section = s["section"]
        else:
            attr = CustomAttributeDefinition(
                id=s["id"],
                name=s["name"],
                section=s["section"],
                label=s["label"],
                description=s["description"],
                element_type=s["element_type"],
                layer=s["layer"],
                data_type=s["data_type"],
                options=s["options"],
                default_value=s["default_value"],
                is_required=s["is_required"],
                is_system=s.get("is_system", False)
            )
            db.add(attr)
    db.commit()

ARCHIMATE_RELATIONSHIP_TYPES = [
    {
        "type": "CompositionRelationship",
        "name": "Composition",
        "nature": "Structural",
        "category": "Structural",
        "symbol": "◆—",
        "strength": 10,
        "is_directed": True,
        "color": "rose",
        "badge_bg": "bg-rose-100",
        "badge_text": "text-rose-800",
        "border_color": "border-rose-300",
        "description": "Indicates that an element consists of one or more other concepts. The existence of parts depends entirely on the whole."
    },
    {
        "type": "AggregationRelationship",
        "name": "Aggregation",
        "nature": "Structural",
        "category": "Structural",
        "symbol": "◇—",
        "strength": 9,
        "is_directed": True,
        "color": "pink",
        "badge_bg": "bg-pink-100",
        "badge_text": "text-pink-800",
        "border_color": "border-pink-300",
        "description": "Indicates that an element groups or aggregates one or more concepts without controlling their lifecycle."
    },
    {
        "type": "AssignmentRelationship",
        "name": "Assignment",
        "nature": "Structural",
        "category": "Structural",
        "symbol": "●—",
        "strength": 8,
        "is_directed": True,
        "color": "purple",
        "badge_bg": "bg-purple-100",
        "badge_text": "text-purple-800",
        "border_color": "border-purple-300",
        "description": "Allocates responsibility, active behavior execution, or storage (e.g. Actor assigned to Role, Component assigned to Interface)."
    },
    {
        "type": "RealizationRelationship",
        "name": "Realization",
        "nature": "Structural",
        "category": "Structural",
        "symbol": "—▷",
        "strength": 7,
        "is_directed": True,
        "color": "emerald",
        "badge_bg": "bg-emerald-100",
        "badge_text": "text-emerald-800",
        "border_color": "border-emerald-300",
        "description": "Indicates that an entity plays a critical role in realizing or achieving a more abstract entity (e.g. Component realizes Service, Requirement realizes Goal)."
    },
    {
        "type": "ServingRelationship",
        "name": "Serving / Used By",
        "nature": "Dependency",
        "category": "Dependency",
        "symbol": "—▶",
        "strength": 6,
        "is_directed": True,
        "color": "blue",
        "badge_bg": "bg-blue-100",
        "badge_text": "text-blue-800",
        "border_color": "border-blue-300",
        "description": "Describes how the services or functionality of one element are consumed by or provide benefit to other elements."
    },
    {
        "type": "AccessRelationship",
        "name": "Access",
        "nature": "Dependency",
        "category": "Dependency",
        "symbol": "─ - ▶",
        "strength": 5,
        "is_directed": True,
        "color": "teal",
        "badge_bg": "bg-teal-100",
        "badge_text": "text-teal-800",
        "border_color": "border-teal-300",
        "description": "Models the ability of behavior and active elements to observe, create, read, write, or access data/passive objects."
    },
    {
        "type": "InfluenceRelationship",
        "name": "Influence",
        "nature": "Dependency",
        "category": "Dependency",
        "symbol": "⋯>",
        "strength": 4,
        "is_directed": True,
        "color": "indigo",
        "badge_bg": "bg-indigo-100",
        "badge_text": "text-indigo-800",
        "border_color": "border-indigo-300",
        "description": "Models the positive or negative impact that an element has on the realization of a goal, principle, or requirement."
    },
    {
        "type": "TriggeringRelationship",
        "name": "Triggering",
        "nature": "Dynamic",
        "category": "Dynamic",
        "symbol": "──>",
        "strength": 6,
        "is_directed": True,
        "color": "amber",
        "badge_bg": "bg-amber-100",
        "badge_text": "text-amber-800",
        "border_color": "border-amber-300",
        "description": "Describes temporal or causal sequence between behavior elements (e.g. Process A triggers Process B)."
    },
    {
        "type": "FlowRelationship",
        "name": "Flow",
        "nature": "Dynamic",
        "category": "Dynamic",
        "symbol": "~~>",
        "strength": 5,
        "is_directed": True,
        "color": "cyan",
        "badge_bg": "bg-cyan-100",
        "badge_text": "text-cyan-800",
        "border_color": "border-cyan-300",
        "description": "Describes transfer of information, data, currency, or physical value between entities."
    },
    {
        "type": "SpecializationRelationship",
        "name": "Specialization",
        "nature": "Other",
        "category": "Other",
        "symbol": "—▷",
        "strength": 9,
        "is_directed": True,
        "color": "slate",
        "badge_bg": "bg-slate-100",
        "badge_text": "text-slate-800",
        "border_color": "border-slate-300",
        "description": "Indicates that an element is a specific subtype or specialization of a more general concept (inheritance/is-a)."
    },
    {
        "type": "AssociationRelationship",
        "name": "Association",
        "nature": "Other",
        "category": "Other",
        "symbol": "—",
        "strength": 3,
        "is_directed": False,
        "color": "slate",
        "badge_bg": "bg-slate-100",
        "badge_text": "text-slate-700",
        "border_color": "border-slate-300",
        "description": "Models an unelaborated semantic or directional link between two elements when no specialized relationship applies."
    }
]

ARCHIMATE_RELATIONSHIP_RULES: Dict[str, Dict[str, List[str]]] = {
    "Resource": {
        "Resource": ["Composition", "Aggregation", "Flow", "Specialization", "Association"],
        "Capability": ["Assignment", "Realization", "Serving", "Association"],
        "ValueStream": ["Serving", "Association"],
        "CourseOfAction": ["Association", "Influence"],
        "Goal": ["Realization", "Influence", "Association"]
    },
    "Capability": {
        "Capability": ["Composition", "Aggregation", "Flow", "Specialization", "Association"],
        "Resource": ["Aggregation", "Association"],
        "ValueStream": ["Serving", "Realization", "Association"],
        "BusinessProcess": ["Realization", "Serving", "Association"],
        "BusinessFunction": ["Realization", "Serving", "Association"],
        "ApplicationComponent": ["Realization", "Association"],
        "Goal": ["Realization", "Influence", "Association"],
        "CourseOfAction": ["Realization", "Association"]
    },
    "ValueStream": {
        "ValueStream": ["Composition", "Aggregation", "Flow", "Triggering", "Specialization", "Association"],
        "Capability": ["Serving", "Association"],
        "BusinessProcess": ["Realization", "Association"],
        "Product": ["Realization", "Association"],
        "Goal": ["Realization", "Influence", "Association"]
    },
    "CourseOfAction": {
        "CourseOfAction": ["Composition", "Aggregation", "Flow", "Triggering", "Specialization", "Association"],
        "Capability": ["Realization", "Association"],
        "Resource": ["Realization", "Association"],
        "Goal": ["Realization", "Influence", "Association"]
    },
    "BusinessActor": {
        "BusinessActor": ["Composition", "Aggregation", "Flow", "Specialization", "Association"],
        "BusinessRole": ["Assignment", "Association"],
        "BusinessProcess": ["Assignment", "Association"],
        "BusinessFunction": ["Assignment", "Association"],
        "BusinessEvent": ["Triggering", "Association"]
    },
    "BusinessRole": {
        "BusinessRole": ["Composition", "Aggregation", "Specialization", "Association"],
        "BusinessProcess": ["Assignment", "Association"],
        "BusinessFunction": ["Assignment", "Association"],
        "BusinessService": ["Serving", "Assignment", "Association"],
        "BusinessActor": ["Assignment", "Association"]
    },
    "BusinessProcess": {
        "BusinessProcess": ["Composition", "Aggregation", "Flow", "Triggering", "Specialization", "Association"],
        "BusinessObject": ["Access", "Association"],
        "BusinessService": ["Realization", "Association"],
        "Product": ["Realization", "Association"],
        "ValueStream": ["Realization", "Association"]
    },
    "BusinessFunction": {
        "BusinessFunction": ["Composition", "Aggregation", "Specialization", "Association"],
        "BusinessProcess": ["Realization", "Assignment", "Association"],
        "BusinessObject": ["Access", "Association"],
        "BusinessService": ["Realization", "Association"]
    },
    "BusinessService": {
        "BusinessService": ["Composition", "Aggregation", "Specialization", "Association"],
        "BusinessProcess": ["Serving", "Association"],
        "BusinessFunction": ["Serving", "Association"],
        "BusinessRole": ["Serving", "Association"],
        "BusinessActor": ["Serving", "Association"],
        "BusinessObject": ["Access", "Association"]
    },
    "BusinessObject": {
        "BusinessObject": ["Composition", "Aggregation", "Specialization", "Association"],
        "DataObject": ["Realization", "Association"]
    },
    "Product": {
        "Product": ["Composition", "Aggregation", "Specialization", "Association"],
        "BusinessService": ["Aggregation", "Composition", "Association"],
        "ApplicationService": ["Aggregation", "Composition", "Association"],
        "BusinessObject": ["Aggregation", "Composition", "Association"]
    },
    "ApplicationComponent": {
        "ApplicationComponent": ["Composition", "Aggregation", "Flow", "Triggering", "Serving", "Specialization", "Association"],
        "ApplicationInterface": ["Composition", "Assignment", "Realization", "Serving", "Association"],
        "ApplicationService": ["Realization", "Serving", "Association"],
        "DataObject": ["Access", "Association"],
        "BusinessProcess": ["Serving", "Realization", "Association"],
        "BusinessFunction": ["Serving", "Realization", "Association"],
        "BusinessRole": ["Serving", "Association"],
        "BusinessActor": ["Serving", "Association"],
        "Capability": ["Realization", "Association"]
    },
    "ApplicationInterface": {
        "ApplicationInterface": ["Composition", "Aggregation", "Specialization", "Association"],
        "ApplicationService": ["Assignment", "Serving", "Association"],
        "ApplicationComponent": ["Serving", "Association"],
        "BusinessProcess": ["Serving", "Association"]
    },
    "ApplicationService": {
        "ApplicationService": ["Composition", "Aggregation", "Specialization", "Association"],
        "BusinessProcess": ["Serving", "Association"],
        "BusinessFunction": ["Serving", "Association"],
        "BusinessRole": ["Serving", "Association"],
        "ApplicationComponent": ["Serving", "Association"],
        "DataObject": ["Access", "Association"]
    },
    "DataObject": {
        "DataObject": ["Composition", "Aggregation", "Specialization", "Association"],
        "BusinessObject": ["Realization", "Association"]
    },
    "Node": {
        "Node": ["Composition", "Aggregation", "Flow", "Triggering", "Specialization", "Association"],
        "Device": ["Composition", "Assignment", "Association"],
        "SystemSoftware": ["Composition", "Assignment", "Association"],
        "TechnologyService": ["Realization", "Association"],
        "CommunicationNetwork": ["Association"],
        "Artifact": ["Assignment", "Association"],
        "ApplicationComponent": ["Assignment", "Serving", "Association"]
    },
    "Device": {
        "Device": ["Composition", "Aggregation", "Specialization", "Association"],
        "SystemSoftware": ["Assignment", "Composition", "Association"],
        "TechnologyService": ["Realization", "Association"],
        "CommunicationNetwork": ["Association"],
        "Artifact": ["Assignment", "Association"]
    },
    "SystemSoftware": {
        "SystemSoftware": ["Composition", "Aggregation", "Specialization", "Association"],
        "TechnologyService": ["Realization", "Association"],
        "ApplicationComponent": ["Serving", "Realization", "Association"],
        "Artifact": ["Assignment", "Association"]
    },
    "CommunicationNetwork": {
        "CommunicationNetwork": ["Composition", "Aggregation", "Specialization", "Association"],
        "Node": ["Association"],
        "Device": ["Association"],
        "TechnologyService": ["Realization", "Association"]
    },
    "TechnologyService": {
        "TechnologyService": ["Composition", "Aggregation", "Specialization", "Association"],
        "ApplicationComponent": ["Serving", "Association"],
        "ApplicationService": ["Serving", "Association"],
        "Node": ["Serving", "Association"],
        "SystemSoftware": ["Serving", "Association"],
        "DataObject": ["Access", "Association"]
    },
    "Artifact": {
        "Artifact": ["Composition", "Aggregation", "Specialization", "Association"],
        "ApplicationComponent": ["Realization", "Association"],
        "SystemSoftware": ["Realization", "Association"],
        "DataObject": ["Realization", "Association"]
    },
    "Stakeholder": {
        "Stakeholder": ["Composition", "Aggregation", "Specialization", "Association"],
        "Driver": ["Association"],
        "Goal": ["Association"]
    },
    "Driver": {
        "Driver": ["Composition", "Aggregation", "Influence", "Specialization", "Association"],
        "Goal": ["Influence", "Association"],
        "Stakeholder": ["Association"]
    },
    "Goal": {
        "Goal": ["Composition", "Aggregation", "Influence", "Specialization", "Association"],
        "Requirement": ["Realization", "Influence", "Association"],
        "Principle": ["Influence", "Association"]
    },
    "Principle": {
        "Principle": ["Composition", "Aggregation", "Influence", "Specialization", "Association"],
        "Requirement": ["Realization", "Influence", "Association"],
        "Goal": ["Influence", "Association"]
    },
    "Requirement": {
        "Requirement": ["Composition", "Aggregation", "Influence", "Specialization", "Association"],
        "Goal": ["Realization", "Influence", "Association"],
        "Constraint": ["Influence", "Association"],
        "BusinessActor": ["Realization", "Association"],
        "BusinessProcess": ["Realization", "Association"],
        "ApplicationComponent": ["Realization", "Association"],
        "SystemSoftware": ["Realization", "Association"],
        "Node": ["Realization", "Association"]
    },
    "Constraint": {
        "Constraint": ["Composition", "Aggregation", "Influence", "Specialization", "Association"],
        "Requirement": ["Influence", "Association"],
        "BusinessProcess": ["Realization", "Association"],
        "ApplicationComponent": ["Realization", "Association"]
    },
    "WorkPackage": {
        "WorkPackage": ["Composition", "Aggregation", "Flow", "Triggering", "Specialization", "Association"],
        "Deliverable": ["Realization", "Association"],
        "Plateau": ["Realization", "Association"],
        "Gap": ["Realization", "Association"],
        "Capability": ["Realization", "Association"]
    },
    "Deliverable": {
        "Deliverable": ["Composition", "Aggregation", "Specialization", "Association"],
        "ApplicationComponent": ["Realization", "Association"],
        "BusinessProcess": ["Realization", "Association"],
        "Node": ["Realization", "Association"],
        "Gap": ["Realization", "Association"]
    },
    "Plateau": {
        "Plateau": ["Composition", "Aggregation", "Triggering", "Specialization", "Association"],
        "Gap": ["Association"],
        "ApplicationComponent": ["Aggregation", "Composition", "Association"],
        "BusinessProcess": ["Aggregation", "Composition", "Association"],
        "Node": ["Aggregation", "Composition", "Association"]
    },
    "Gap": {
        "Gap": ["Composition", "Aggregation", "Specialization", "Association"],
        "Plateau": ["Association"],
        "WorkPackage": ["Association"]
    }
}

def get_relationships_matrix() -> Dict[str, Any]:
    """Returns the full ArchiMate 3.x permitted relationships matrix and relationship types."""
    # Build list of all element types with their layer and metadata
    all_elements = []
    for layer in ARCHIMATE_METAMODEL:
        for elem in layer["element_types"]:
            all_elements.append({
                "type": elem["type"],
                "name": elem["name"],
                "layer": layer["layer"],
                "color": layer["color"],
                "bg_color": layer["bg_color"],
                "text_color": layer["text_color"],
                "border_color": layer["border_color"]
            })

    return {
        "relationship_types": ARCHIMATE_RELATIONSHIP_TYPES,
        "rules": ARCHIMATE_RELATIONSHIP_RULES,
        "elements": all_elements,
        "layers": [l["layer"] for l in ARCHIMATE_METAMODEL]
    }

