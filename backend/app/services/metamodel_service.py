import uuid
import re
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.archimate import (
    CustomAttributeDefinition,
    ModelWorkspace,
    AttributePackage,
    AttributePackageItem,
    WorkspaceAttributePackage,
    ArchimateElement,
    ElementStereotype,
    StereotypeAttributeLink
)

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
            },
            {
                "type": "BusinessEvent",
                "name": "Business Event",
                "description": "An organizational event or state change that triggers or results from business processes (e.g. Loan Application Received, Payment Settled).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Event Name", "data_type": "string", "is_required": True, "description": "Name of the business event"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Trigger conditions and business context"}
                ]
            },
            {
                "type": "BusinessInterface",
                "name": "Business Interface",
                "description": "A channel or point of access where a business service is made available to the environment (e.g. Branch Desk, Call Center, Mobile Banking Channel).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Interface Name", "data_type": "string", "is_required": True, "description": "Name of the business channel or interface"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Channel characteristics and target audience"}
                ]
            },
            {
                "type": "BusinessCollaboration",
                "name": "Business Collaboration",
                "description": "An aggregate of two or more business internal active structure elements working together to perform collective behavior.",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Collaboration Name", "data_type": "string", "is_required": True, "description": "Name of the business collaboration"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Participating roles and collaboration scope"}
                ]
            },
            {
                "type": "BusinessInteraction",
                "name": "Business Interaction",
                "description": "A unit of collective business behavior performed by a collaboration of two or more business roles or actors.",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Interaction Name", "data_type": "string", "is_required": True, "description": "Name of the business interaction"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Collective behavior description"}
                ]
            },
            {
                "type": "Contract",
                "name": "Contract",
                "description": "A formal or informal specification of an agreement between a provider and a consumer that specifies rights and obligations associated with a product.",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Contract Name", "data_type": "string", "is_required": True, "description": "Name of the contract or SLA"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Terms, obligations, and SLA clauses"}
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
                "type": "ApplicationFunction",
                "name": "Application Function",
                "description": "Automated behavior that an application component can perform (e.g. Interest Calculation, Fraud Scoring, Token Validation).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Application Function Name", "data_type": "string", "is_required": True, "description": "Name of the internal application function"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Functional logic and module scope"}
                ]
            },
            {
                "type": "ApplicationProcess",
                "name": "Application Process",
                "description": "A sequence of automated application behaviors that achieves a specific outcome (e.g. Nightly EOD Batch Settlement, ETL Synchronization).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Application Process Name", "data_type": "string", "is_required": True, "description": "Name of the automated application process"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Execution flow and schedule"}
                ]
            },
            {
                "type": "ApplicationEvent",
                "name": "Application Event",
                "description": "An application state change or message event (e.g. Kafka Transaction Published, Webhook Triggered).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Application Event Name", "data_type": "string", "is_required": True, "description": "Name of the application event"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Topic, payload, and trigger semantics"}
                ]
            },
            {
                "type": "ApplicationCollaboration",
                "name": "Application Collaboration",
                "description": "An aggregate of two or more application components working together to perform collective application behavior.",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Collaboration Name", "data_type": "string", "is_required": True, "description": "Name of the application collaboration"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Participating application components"}
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
                "type": "TechnologyInterface",
                "name": "Technology Interface",
                "description": "A point of access where technology services offered by a node can be accessed (e.g. JDBC Port 5432, HTTPS Load Balancer Endpoint).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Technology Interface Name", "data_type": "string", "is_required": True, "description": "Name of the infrastructure interface"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Protocol, port, and endpoint details"}
                ]
            },
            {
                "type": "TechnologyFunction",
                "name": "Technology Function",
                "description": "A collection of technology behavior that can be performed by a node (e.g. Container Orchestration, Identity Federation, Backup & Replication).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Technology Function Name", "data_type": "string", "is_required": True, "description": "Name of the technology function"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Infrastructure capability description"}
                ]
            },
            {
                "type": "Path",
                "name": "Path",
                "description": "A link between two or more technology nodes through which these nodes can exchange data or material.",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Path Name", "data_type": "string", "is_required": True, "description": "Name of the communication path"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Protocol, encryption, and latency"}
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
                "type": "Assessment",
                "name": "Assessment",
                "description": "The result of an analysis of the state of affairs of the enterprise with respect to some driver (e.g. SWOT Analysis Finding, Legacy Technical Debt Audit).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Assessment Name", "data_type": "string", "is_required": True, "description": "Title of the assessment finding"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Evidence and risk evaluation"}
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
                "type": "Outcome",
                "name": "Outcome",
                "description": "An end result that has been achieved (e.g. 99.95% Uptime Achieved, Instant Onboarding < 3 mins).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Outcome Name", "data_type": "string", "is_required": True, "description": "Measurable business or technical outcome"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "KPI metrics and verification"}
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
            },
            {
                "type": "Value",
                "name": "Value",
                "description": "The relative worth, utility, or importance of a core element or an outcome (e.g. Operational Efficiency, Customer Trust).",
                "standard_attributes": [
                    {"name": "id", "label": "Element ID", "data_type": "string", "is_required": True, "description": "Unique ArchiMate identifier"},
                    {"name": "name", "label": "Value Name", "data_type": "string", "is_required": True, "description": "Description of the delivered value"},
                    {"name": "documentation", "label": "Documentation", "data_type": "text", "is_required": False, "description": "Stakeholder value proposition"}
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
    Returns the full metamodel layers & element types with standard + custom attributes + active package attributes.
    If model_id is specified (and not '*'), includes global attributes, attributes scoped to that model,
    and attributes belonging to packages activated on that model workspace.
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
            "is_package": False,
            "package_code": None,
            "package_name": None,
            "created_at": ca.created_at.isoformat() if ca.created_at else None
        })

    # Integrate Attribute Packages
    if model_id and model_id != "*":
        active_links = db.query(WorkspaceAttributePackage).filter(
            WorkspaceAttributePackage.model_id == model_id
        ).all()
        active_pkg_ids = [link.package_id for link in active_links]
        if active_pkg_ids:
            pkg_items = db.query(AttributePackageItem, AttributePackage).join(
                AttributePackage, AttributePackageItem.package_id == AttributePackage.id
            ).filter(AttributePackageItem.package_id.in_(active_pkg_ids)).order_by(AttributePackageItem.sort_order).all()
            
            for item, pkg in pkg_items:
                key = item.element_type
                if key not in custom_map:
                    custom_map[key] = []
                custom_map[key].append({
                    "id": item.id,
                    "model_id": model_id,
                    "library_code": None,
                    "section": item.section or pkg.name,
                    "name": item.name,
                    "label": item.label,
                    "description": item.description,
                    "element_type": item.element_type,
                    "layer": item.layer,
                    "data_type": item.data_type,
                    "options": item.options or [],
                    "default_value": item.default_value,
                    "is_required": item.is_required,
                    "is_system": bool(pkg.is_system),
                    "is_package": True,
                    "package_id": pkg.id,
                    "package_code": pkg.code.upper(),
                    "package_name": pkg.name,
                    "created_at": item.created_at.isoformat() if item.created_at else None
                })
    else:
        # In global metamodel catalog view, include all package items
        all_pkg_items = db.query(AttributePackageItem, AttributePackage).join(
            AttributePackage, AttributePackageItem.package_id == AttributePackage.id
        ).order_by(AttributePackageItem.sort_order).all()
        for item, pkg in all_pkg_items:
            key = item.element_type
            if key not in custom_map:
                custom_map[key] = []
            custom_map[key].append({
                "id": item.id,
                "model_id": None,
                "library_code": None,
                "section": item.section or pkg.name,
                "name": item.name,
                "label": item.label,
                "description": item.description,
                "element_type": item.element_type,
                "layer": item.layer,
                "data_type": item.data_type,
                "options": item.options or [],
                "default_value": item.default_value,
                "is_required": item.is_required,
                "is_system": bool(pkg.is_system),
                "is_package": True,
                "package_id": pkg.id,
                "package_code": pkg.code.upper(),
                "package_name": pkg.name,
                "created_at": item.created_at.isoformat() if item.created_at else None
            })

    # Fetch available stereotypes per element type
    stereotype_query = db.query(ElementStereotype)
    if model_id and model_id != "*":
        stereotype_query = stereotype_query.filter(
            (ElementStereotype.model_id == None) | (ElementStereotype.model_id == model_id)
        )
    else:
        stereotype_query = stereotype_query.filter(ElementStereotype.model_id == None)

    all_stereotypes = stereotype_query.order_by(ElementStereotype.created_at.asc()).all()
    stereotype_map: Dict[str, List[Dict[str, Any]]] = {}
    for st in all_stereotypes:
        if st.base_type not in stereotype_map:
            stereotype_map[st.base_type] = []
        links_data = [
            {
                "id": link.id,
                "stereotype_id": link.stereotype_id,
                "attribute_name": link.attribute_name,
                "is_required": link.is_required,
                "default_value": link.default_value,
                "section_override": link.section_override,
                "sort_order": link.sort_order
            }
            for link in st.attribute_links
        ]
        stereotype_map[st.base_type].append({
            "id": st.id,
            "model_id": st.model_id,
            "base_type": st.base_type,
            "name": st.name,
            "label": st.label,
            "description": st.description,
            "icon_color": st.icon_color,
            "is_system": bool(st.is_system),
            "attribute_links": links_data
        })

    # Clone metamodel and attach custom attributes & stereotypes
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
                "custom_attributes": unique_custom,
                "stereotypes": stereotype_map.get(e_type, [])
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
    res = [
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
            "is_package": False,
            "package_code": None,
            "package_name": None,
            "created_at": ca.created_at.isoformat() if ca.created_at else None
        }
        for ca in items
    ]

    # Include active package items for the model
    if model_id and model_id != "*":
        active_links = db.query(WorkspaceAttributePackage).filter(
            WorkspaceAttributePackage.model_id == model_id
        ).all()
        active_pkg_ids = [link.package_id for link in active_links]
        if active_pkg_ids:
            p_query = db.query(AttributePackageItem, AttributePackage).join(
                AttributePackage, AttributePackageItem.package_id == AttributePackage.id
            ).filter(AttributePackageItem.package_id.in_(active_pkg_ids))
            if element_type:
                p_query = p_query.filter(
                    (AttributePackageItem.element_type == element_type) |
                    (AttributePackageItem.element_type == "*")
                )
            for item, pkg in p_query.order_by(AttributePackageItem.sort_order).all():
                res.append({
                    "id": item.id,
                    "model_id": model_id,
                    "library_code": None,
                    "section": item.section or pkg.name,
                    "name": item.name,
                    "label": item.label,
                    "description": item.description,
                    "element_type": item.element_type,
                    "layer": item.layer,
                    "data_type": item.data_type,
                    "options": item.options or [],
                    "default_value": item.default_value,
                    "is_required": item.is_required,
                    "is_system": bool(pkg.is_system),
                    "is_package": True,
                    "package_id": pkg.id,
                    "package_code": pkg.code.upper(),
                    "package_name": pkg.name,
                    "created_at": item.created_at.isoformat() if item.created_at else None
                })
    return res

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

        # Check if raw_name attempts to use a 3-character package prefix
        if len(raw_name) > 3 and raw_name[3] == "_":
            pkg_code = raw_name[:3]
            existing_pkg = db.query(AttributePackage).filter(AttributePackage.code == pkg_code).first()
            if existing_pkg:
                raise HTTPException(
                    status_code=400,
                    detail=f"Il prefisso a 3 caratteri '{pkg_code}_' è riservato al pacchetto di sistema/catalogo '{existing_pkg.name}'. Gli attributi specifici della libreria devono usare il prefisso a 4 lettere '{prefix}'."
                )

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
        existing_pkg_item = db.query(AttributePackageItem).filter(AttributePackageItem.name == name_clean).first()
        if existing_pkg_item:
            raise HTTPException(
                status_code=400,
                detail=f"Attribute identifier '{name_clean}' already exists in an attribute package."
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
        existing_pkg_item = db.query(AttributePackageItem).filter(AttributePackageItem.name == name_clean).first()
        if existing_pkg_item:
            raise HTTPException(
                status_code=400,
                detail=f"Attribute identifier '{name_clean}' already exists in an attribute package."
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

def seed_default_attribute_packages(db: Session):
    """Seed or update standard attribute packages (APM, TIME) and auto-migrate legacy eea_ values."""
    # 1. Package APM (Code: apm, 3 letters)
    apm_pkg = db.query(AttributePackage).filter(AttributePackage.id == "pkg-apm").first()
    if not apm_pkg:
        apm_pkg = AttributePackage(
            id="pkg-apm",
            code="apm",
            name="Application Portfolio Management",
            description="Attributi essenziali per APM, TCO, ownership, lifecycle, deployment e conformità applicativa.",
            icon_color="blue",
            is_default_active=True,
            is_system=True
        )
        db.add(apm_pkg)
        db.flush()
    else:
        apm_pkg.code = "apm"
        apm_pkg.is_system = True

    apm_items = [
        {
            "id": "item-apm-in-scope",
            "name": "apm_in_scope",
            "label": "In APM Scope (Include in TIME & TCO)",
            "description": "Indica se l'applicazione appartiene al perimetro APM attivo per TCO e matrice TIME.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "boolean",
            "options": [],
            "default_value": "true",
            "is_required": False,
            "section": "APM Portfolio",
            "sort_order": 1
        },
        {
            "id": "item-apm-annual-cost",
            "name": "apm_annual_cost",
            "label": "Annual Cost / TCO (€)",
            "description": "Costo totale annuo di possesso (licenze, infrastruttura, manutenzione).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "0",
            "is_required": True,
            "section": "APM Portfolio",
            "sort_order": 2
        },
        {
            "id": "item-apm-business-criticality",
            "name": "apm_business_criticality",
            "label": "Business Criticality",
            "description": "Livello di impatto sul business in caso di disservizio o indisponibilità applicativa.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Mission Critical", "Business Critical", "Business Operational", "Administrative"],
            "default_value": "Business Operational",
            "is_required": True,
            "section": "APM Portfolio",
            "sort_order": 3
        },
        {
            "id": "item-apm-lifecycle-status",
            "name": "apm_lifecycle_status",
            "label": "Lifecycle Status",
            "description": "Fase attuale del ciclo di vita dell'applicazione.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Plan", "Evaluation", "Live", "Phase-out", "Retired"],
            "default_value": "Live",
            "is_required": True,
            "section": "APM Portfolio",
            "sort_order": 4
        },
        {
            "id": "item-apm-business-owner",
            "name": "apm_business_owner",
            "label": "Business Owner",
            "description": "Responsabile business di riferimento per l'applicazione.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": False,
            "section": "APM Portfolio",
            "sort_order": 5
        },
        {
            "id": "item-apm-technical-owner",
            "name": "apm_technical_owner",
            "label": "Technical Owner",
            "description": "Architetto o responsabile tecnico del componente IT.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": False,
            "section": "APM Portfolio",
            "sort_order": 6
        },
        {
            "id": "item-apm-vendor",
            "name": "apm_vendor",
            "label": "Vendor / Supplier",
            "description": "Fornitore, software house o team di sviluppo interno.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": False,
            "section": "APM Portfolio",
            "sort_order": 7
        },
        {
            "id": "item-apm-hosting-type",
            "name": "apm_hosting_type",
            "label": "Hosting / Deployment Type",
            "description": "Modello di erogazione e hosting infrastrutturale.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["SaaS", "Public Cloud", "Private Cloud", "On-Premise"],
            "default_value": "Public Cloud",
            "is_required": True,
            "section": "APM Portfolio",
            "sort_order": 8
        },
        {
            "id": "item-apm-data-classification",
            "name": "apm_data_classification",
            "label": "Data Classification",
            "description": "Classificazione di riservatezza dei dati gestiti (GDPR / confidenzialità).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Public", "Internal", "Confidential", "Restricted/GDPR"],
            "default_value": "Internal",
            "is_required": False,
            "section": "APM Portfolio",
            "sort_order": 9
        },
        {
            "id": "item-apm-sla-level",
            "name": "apm_sla_level",
            "label": "SLA Service Level",
            "description": "Accordo sul livello di servizio contrattuale garantito.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Platinum (99.99%)", "Gold (99.9%)", "Silver (99.0%)", "Bronze (95.0%)"],
            "default_value": "Silver (99.0%)",
            "is_required": False,
            "section": "APM Portfolio",
            "sort_order": 10
        }
    ]

    for it in apm_items:
        existing_it = db.query(AttributePackageItem).filter(AttributePackageItem.id == it["id"]).first()
        if existing_it:
            for k, v in it.items():
                setattr(existing_it, k, v)
        else:
            db.add(AttributePackageItem(package_id=apm_pkg.id, **it))

    # 2. Package TIME (Code: tme, 3 letters)
    tme_pkg = db.query(AttributePackage).filter(AttributePackage.id == "pkg-tme").first()
    if not tme_pkg:
        tme_pkg = AttributePackage(
            id="pkg-tme",
            code="tme",
            name="TIME Portfolio Assessment",
            description="Attributi Gartner TIME per valutazione di adeguatezza aziendale (Business Fit) e tecnica (Technical Fit).",
            icon_color="indigo",
            is_default_active=True,
            is_system=True
        )
        db.add(tme_pkg)
        db.flush()
    else:
        tme_pkg.code = "tme"
        tme_pkg.is_system = True

    tme_items = [
        {
            "id": "item-tme-business-fit",
            "name": "tme_business_fit",
            "label": "Business Fit Score (1-5)",
            "description": "Allineamento strategico e valore di business percepito (punteggio 1-5).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "3",
            "is_required": True,
            "section": "TIME Assessment",
            "sort_order": 1
        },
        {
            "id": "item-tme-technical-fit",
            "name": "tme_technical_fit",
            "label": "Technical Fit Score (1-5)",
            "description": "Qualità tecnica, manutenibilità e assenza di debito tecnico (punteggio 1-5).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "3",
            "is_required": True,
            "section": "TIME Assessment",
            "sort_order": 2
        },
        {
            "id": "item-tme-quadrant",
            "name": "tme_quadrant",
            "label": "TIME Decision Quadrant",
            "description": "Quadrante di decisione Gartner (Invest, Migrate, Tolerate, Eliminate).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Invest", "Migrate", "Tolerate", "Eliminate"],
            "default_value": "Tolerate",
            "is_required": True,
            "section": "TIME Assessment",
            "sort_order": 3
        }
    ]

    for it in tme_items:
        existing_it = db.query(AttributePackageItem).filter(AttributePackageItem.id == it["id"]).first()
        if existing_it:
            for k, v in it.items():
                setattr(existing_it, k, v)
        else:
            db.add(AttributePackageItem(package_id=tme_pkg.id, **it))

    # 3. Ensure both packages are active on all existing model workspaces
    workspaces = db.query(ModelWorkspace).all()
    for ws in workspaces:
        for pkg_id in ["pkg-apm", "pkg-tme"]:
            has_link = db.query(WorkspaceAttributePackage).filter(
                WorkspaceAttributePackage.model_id == ws.id,
                WorkspaceAttributePackage.package_id == pkg_id
            ).first()
            if not has_link:
                db.add(WorkspaceAttributePackage(
                    id=f"wap-{uuid.uuid4().hex[:8]}",
                    model_id=ws.id,
                    package_id=pkg_id
                ))

    # 4. Data migration for ArchimateElement properties: eea_ -> apm_ / tme_
    key_mapping = {
        "eea_in_apm_scope": "apm_in_scope",
        "eea_annual_cost": "apm_annual_cost",
        "eea_business_criticality": "apm_business_criticality",
        "eea_lifecycle_status": "apm_lifecycle_status",
        "eea_business_owner": "apm_business_owner",
        "eea_technical_owner": "apm_technical_owner",
        "eea_vendor": "apm_vendor",
        "eea_hosting_type": "apm_hosting_type",
        "eea_data_classification": "apm_data_classification",
        "eea_sla_level": "apm_sla_level",
        "eea_business_fit": "tme_business_fit",
        "eea_technical_fit": "tme_technical_fit",
        "eea_time_quadrant": "tme_quadrant"
    }

    elements = db.query(ArchimateElement).all()
    for elem in elements:
        if isinstance(elem.properties, dict) and elem.properties:
            updated = False
            props = dict(elem.properties)
            for old_k, new_k in key_mapping.items():
                if old_k in props and new_k not in props:
                    props[new_k] = props[old_k]
                    updated = True
            if updated:
                elem.properties = props

    # 5. Remove legacy eea_ system custom attribute definitions to avoid duplicates
    db.query(CustomAttributeDefinition).filter(CustomAttributeDefinition.name.like("eea_%")).delete(synchronize_session=False)

    # 6. Ensure apm_ and tme_ items are assigned to their dedicated sections
    db.query(AttributePackageItem).filter(AttributePackageItem.name.like("apm_%")).update(
        {"section": "APM Portfolio"},
        synchronize_session=False
    )
    db.query(AttributePackageItem).filter(AttributePackageItem.name.like("tme_%")).update(
        {"section": "TIME Assessment"},
        synchronize_session=False
    )

    # 7. Delete any package items and custom attributes not belonging to apm_ or tme_
    db.query(AttributePackageItem).filter(
        ~AttributePackageItem.name.like("apm_%"),
        ~AttributePackageItem.name.like("tme_%")
    ).delete(synchronize_session=False)

    db.query(CustomAttributeDefinition).filter(
        ~CustomAttributeDefinition.name.like("apm_%"),
        ~CustomAttributeDefinition.name.like("tme_%")
    ).delete(synchronize_session=False)

    db.query(AttributePackage).filter(
        ~AttributePackage.id.in_(["pkg-apm", "pkg-tme"])
    ).delete(synchronize_session=False)

    db.commit()


def seed_default_custom_attributes(db: Session):
    """Seed standard attribute packages, default stereotypes, and clean up any non-package attributes."""
    # First seed attribute packages
    seed_default_attribute_packages(db)
    # Seed default stereotypes
    seed_default_stereotypes(db)

    # Purge any custom attribute definitions not part of apm_ or tme_ packages
    db.query(CustomAttributeDefinition).filter(
        ~CustomAttributeDefinition.name.like("apm_%"),
        ~CustomAttributeDefinition.name.like("tme_%")
    ).delete(synchronize_session=False)
    db.commit()


def seed_default_stereotypes(db: Session):
    """Seed canonical ArchiMate stereotypes with specialized attribute requirements and defaults."""
    default_stereotypes = [
        {
            "id": "stereo-microservice",
            "base_type": "ApplicationComponent",
            "name": "Microservice",
            "label": "«Microservice»",
            "description": "Componente applicativo a singolo perimetro funzionale, containerizzato ed esposto via REST/gRPC API.",
            "icon_color": "indigo",
            "is_system": True,
            "links": [
                {
                    "attribute_name": "apm_hosting_type",
                    "is_required": True,
                    "default_value": "Public Cloud",
                    "section_override": None,
                    "sort_order": 1
                },
                {
                    "attribute_name": "tme_technical_fit",
                    "is_required": True,
                    "default_value": "4",
                    "section_override": None,
                    "sort_order": 2
                }
            ]
        },
        {
            "id": "stereo-saas",
            "base_type": "ApplicationComponent",
            "name": "SaaS Application",
            "label": "«SaaS»",
            "description": "Software-as-a-service erogato e gestito interamente nel cloud da fornitore terzo.",
            "icon_color": "emerald",
            "is_system": True,
            "links": [
                {
                    "attribute_name": "apm_vendor",
                    "is_required": True,
                    "default_value": "",
                    "section_override": None,
                    "sort_order": 1
                },
                {
                    "attribute_name": "apm_hosting_type",
                    "is_required": True,
                    "default_value": "SaaS",
                    "section_override": None,
                    "sort_order": 2
                }
            ]
        },
        {
            "id": "stereo-mainframe",
            "base_type": "ApplicationComponent",
            "name": "Legacy Mainframe",
            "label": "«Legacy Mainframe»",
            "description": "Applicazione monolitica o sistema core legacy su mainframe on-premise.",
            "icon_color": "amber",
            "is_system": True,
            "links": [
                {
                    "attribute_name": "apm_hosting_type",
                    "is_required": True,
                    "default_value": "On-Premise",
                    "section_override": None,
                    "sort_order": 1
                },
                {
                    "attribute_name": "tme_quadrant",
                    "is_required": True,
                    "default_value": "Migrate",
                    "section_override": None,
                    "sort_order": 2
                }
            ]
        },
        {
            "id": "stereo-automated-process",
            "base_type": "BusinessProcess",
            "name": "Automated Process",
            "label": "«Automated»",
            "description": "Processo operativo completamente automatizzato da sistemi IT o workflow engine (BPMN/Camunda).",
            "icon_color": "purple",
            "is_system": True,
            "links": []
        },
        {
            "id": "stereo-manual-process",
            "base_type": "BusinessProcess",
            "name": "Manual Process",
            "label": "«Manual»",
            "description": "Processo di business eseguito manualmente da personale operativo senza automazione end-to-end.",
            "icon_color": "rose",
            "is_system": True,
            "links": []
        },
        {
            "id": "stereo-k8s",
            "base_type": "Node",
            "name": "Kubernetes Cluster",
            "label": "«K8s Cluster»",
            "description": "Piattaforma di orchestrazione container Kubernetes con nodi worker distribuiti.",
            "icon_color": "blue",
            "is_system": True,
            "links": []
        }
    ]

    for st_data in default_stereotypes:
        existing = db.query(ElementStereotype).filter(ElementStereotype.id == st_data["id"]).first()
        if not existing:
            st = ElementStereotype(
                id=st_data["id"],
                model_id=None,
                base_type=st_data["base_type"],
                name=st_data["name"],
                label=st_data["label"],
                description=st_data["description"],
                icon_color=st_data["icon_color"],
                is_system=True
            )
            db.add(st)
            db.flush()
            for l_data in st_data.get("links", []):
                link = StereotypeAttributeLink(
                    id=f"sal-{uuid.uuid4().hex[:8]}",
                    stereotype_id=st.id,
                    attribute_name=l_data["attribute_name"],
                    is_required=l_data.get("is_required", False),
                    default_value=l_data.get("default_value"),
                    section_override=l_data.get("section_override"),
                    sort_order=l_data.get("sort_order", 0)
                )
                db.add(link)
        else:
            existing.base_type = st_data["base_type"]
            existing.name = st_data["name"]
            existing.label = st_data["label"]
            existing.description = st_data["description"]
            existing.icon_color = st_data["icon_color"]
            existing.is_system = True

            # Ensure default links exist
            for l_data in st_data.get("links", []):
                existing_link = db.query(StereotypeAttributeLink).filter(
                    StereotypeAttributeLink.stereotype_id == existing.id,
                    StereotypeAttributeLink.attribute_name == l_data["attribute_name"]
                ).first()
                if not existing_link:
                    link = StereotypeAttributeLink(
                        id=f"sal-{uuid.uuid4().hex[:8]}",
                        stereotype_id=existing.id,
                        attribute_name=l_data["attribute_name"],
                        is_required=l_data.get("is_required", False),
                        default_value=l_data.get("default_value"),
                        section_override=l_data.get("section_override"),
                        sort_order=l_data.get("sort_order", 0)
                    )
                    db.add(link)
                else:
                    existing_link.is_required = l_data.get("is_required", False)
                    existing_link.default_value = l_data.get("default_value")
                    existing_link.section_override = l_data.get("section_override")
                    existing_link.sort_order = l_data.get("sort_order", 0)
    db.commit()


# ==========================================
# STEREOTYPES MANAGEMENT SERVICES
# ==========================================

def list_stereotypes(
    db: Session,
    base_type: Optional[str] = None,
    model_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """List stereotypes filtered by base_type and scope."""
    query = db.query(ElementStereotype)
    if model_id and model_id != "*":
        query = query.filter(
            (ElementStereotype.model_id == None) | (ElementStereotype.model_id == model_id)
        )
    elif not model_id:
        query = query.filter(ElementStereotype.model_id == None)

    if base_type and base_type != "*":
        query = query.filter(ElementStereotype.base_type == base_type)

    stereotypes = query.order_by(ElementStereotype.base_type.asc(), ElementStereotype.name.asc()).all()
    results = []
    for st in stereotypes:
        links_data = [
            {
                "id": link.id,
                "stereotype_id": link.stereotype_id,
                "attribute_name": link.attribute_name,
                "is_required": link.is_required,
                "default_value": link.default_value,
                "section_override": link.section_override,
                "sort_order": link.sort_order
            }
            for link in st.attribute_links
        ]
        results.append({
            "id": st.id,
            "model_id": st.model_id,
            "base_type": st.base_type,
            "name": st.name,
            "label": st.label,
            "description": st.description,
            "icon_color": st.icon_color,
            "is_system": bool(st.is_system),
            "attribute_links": links_data,
            "created_at": st.created_at.isoformat() if st.created_at else None
        })
    return results


def get_stereotype(db: Session, stereotype_id: str) -> Dict[str, Any]:
    """Retrieve details and attribute links for a specific stereotype."""
    st = db.query(ElementStereotype).filter(ElementStereotype.id == stereotype_id).first()
    if not st:
        raise HTTPException(status_code=404, detail=f"Stereotype '{stereotype_id}' not found.")

    links_data = [
        {
            "id": link.id,
            "stereotype_id": link.stereotype_id,
            "attribute_name": link.attribute_name,
            "is_required": link.is_required,
            "default_value": link.default_value,
            "section_override": link.section_override,
            "sort_order": link.sort_order
        }
        for link in st.attribute_links
    ]
    return {
        "id": st.id,
        "model_id": st.model_id,
        "base_type": st.base_type,
        "name": st.name,
        "label": st.label,
        "description": st.description,
        "icon_color": st.icon_color,
        "is_system": bool(st.is_system),
        "attribute_links": links_data,
        "created_at": st.created_at.isoformat() if st.created_at else None
    }


def create_stereotype(db: Session, data: Dict[str, Any]) -> Dict[str, Any]:
    """Creates a new stereotype for an ArchiMate concept."""
    base_type = (data.get("base_type") or "").strip()
    name = (data.get("name") or "").strip()
    if not base_type or not name:
        raise HTTPException(status_code=400, detail="Base type and stereotype name are required.")

    model_id = data.get("model_id")
    label = (data.get("label") or "").strip()
    if not label:
        label = f"«{name}»"
    elif not (label.startswith("«") and label.endswith("»")):
        label = f"«{label}»"

    st_id = f"stereo-{uuid.uuid4().hex[:8]}"
    st = ElementStereotype(
        id=st_id,
        model_id=model_id,
        base_type=base_type,
        name=name,
        label=label,
        description=data.get("description"),
        icon_color=data.get("icon_color", "indigo"),
        is_system=False
    )
    db.add(st)
    db.flush()

    for l_data in data.get("attribute_links", []):
        link = StereotypeAttributeLink(
            id=f"sal-{uuid.uuid4().hex[:8]}",
            stereotype_id=st.id,
            attribute_name=l_data["attribute_name"],
            is_required=bool(l_data.get("is_required", False)),
            default_value=l_data.get("default_value"),
            section_override=l_data.get("section_override"),
            sort_order=int(l_data.get("sort_order", 0))
        )
        db.add(link)

    db.commit()
    db.refresh(st)
    return get_stereotype(db, st.id)


def update_stereotype(db: Session, stereotype_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Updates stereotype metadata."""
    st = db.query(ElementStereotype).filter(ElementStereotype.id == stereotype_id).first()
    if not st:
        raise HTTPException(status_code=404, detail=f"Stereotype '{stereotype_id}' not found.")

    if data.get("name"):
        st.name = data["name"].strip()
    if data.get("label"):
        lbl = data["label"].strip()
        st.label = lbl if (lbl.startswith("«") and lbl.endswith("»")) else f"«{lbl}»"
    if "description" in data:
        st.description = data["description"]
    if data.get("icon_color"):
        st.icon_color = data["icon_color"]

    db.commit()
    db.refresh(st)
    return get_stereotype(db, st.id)


def delete_stereotype(db: Session, stereotype_id: str) -> bool:
    """Deletes a custom stereotype."""
    st = db.query(ElementStereotype).filter(ElementStereotype.id == stereotype_id).first()
    if not st:
        return False
    if st.is_system:
        raise HTTPException(
            status_code=400,
            detail=f"Lo stereotipo predefinito di sistema '{st.name}' non può essere eliminato."
        )

    db.delete(st)
    db.commit()
    return True


def add_stereotype_attribute_link(db: Session, stereotype_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Links an attribute to a stereotype with mandatory/optional rules and default value."""
    st = db.query(ElementStereotype).filter(ElementStereotype.id == stereotype_id).first()
    if not st:
        raise HTTPException(status_code=404, detail=f"Stereotype '{stereotype_id}' not found.")

    attr_name = data.get("attribute_name", "").strip()
    if not attr_name:
        raise HTTPException(status_code=400, detail="Attribute name is required.")

    # Check if already linked
    existing = db.query(StereotypeAttributeLink).filter(
        StereotypeAttributeLink.stereotype_id == stereotype_id,
        StereotypeAttributeLink.attribute_name == attr_name
    ).first()
    if existing:
        existing.is_required = bool(data.get("is_required", existing.is_required))
        existing.default_value = data.get("default_value", existing.default_value)
        existing.section_override = data.get("section_override", existing.section_override)
        existing.sort_order = int(data.get("sort_order", existing.sort_order))
        db.commit()
        db.refresh(existing)
        link = existing
    else:
        link = StereotypeAttributeLink(
            id=f"sal-{uuid.uuid4().hex[:8]}",
            stereotype_id=stereotype_id,
            attribute_name=attr_name,
            is_required=bool(data.get("is_required", False)),
            default_value=data.get("default_value"),
            section_override=data.get("section_override"),
            sort_order=int(data.get("sort_order", len(st.attribute_links) + 1))
        )
        db.add(link)
        db.commit()
        db.refresh(link)

    return {
        "id": link.id,
        "stereotype_id": link.stereotype_id,
        "attribute_name": link.attribute_name,
        "is_required": link.is_required,
        "default_value": link.default_value,
        "section_override": link.section_override,
        "sort_order": link.sort_order
    }


def delete_stereotype_attribute_link(db: Session, stereotype_id: str, link_id: str) -> bool:
    """Removes an attribute link from a stereotype."""
    link = db.query(StereotypeAttributeLink).filter(
        StereotypeAttributeLink.id == link_id,
        StereotypeAttributeLink.stereotype_id == stereotype_id
    ).first()
    if not link:
        return False
    db.delete(link)
    db.commit()
    return True


# ==========================================
# ATTRIBUTE PACKAGES MANAGEMENT SERVICES
# ==========================================

def list_attribute_packages(db: Session, model_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """List all attribute packages in the global catalog, with active status if model_id is provided."""
    packages = db.query(AttributePackage).order_by(AttributePackage.created_at.asc()).all()
    active_pkg_ids = set()
    if model_id and model_id != "*":
        active_links = db.query(WorkspaceAttributePackage).filter(
            WorkspaceAttributePackage.model_id == model_id
        ).all()
        active_pkg_ids = {l.package_id for l in active_links}

    result = []
    for pkg in packages:
        items_data = [
            {
                "id": it.id,
                "package_id": it.package_id,
                "name": it.name,
                "label": it.label,
                "description": it.description,
                "element_type": it.element_type,
                "layer": it.layer,
                "data_type": it.data_type,
                "options": it.options or [],
                "default_value": it.default_value,
                "is_required": it.is_required,
                "section": it.section,
                "sort_order": it.sort_order,
                "created_at": it.created_at.isoformat() if it.created_at else None
            }
            for it in pkg.items
        ]
        result.append({
            "id": pkg.id,
            "code": pkg.code,
            "name": pkg.name,
            "description": pkg.description,
            "icon_color": pkg.icon_color,
            "is_default_active": pkg.is_default_active,
            "is_system": bool(pkg.is_system),
            "is_active": pkg.id in active_pkg_ids if model_id and model_id != "*" else None,
            "item_count": len(items_data),
            "items": items_data,
            "created_at": pkg.created_at.isoformat() if pkg.created_at else None
        })
    return result


def get_attribute_package(db: Session, package_id: str) -> Dict[str, Any]:
    """Get package details and its items."""
    pkg = db.query(AttributePackage).filter(AttributePackage.id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail=f"Attribute package '{package_id}' not found.")
    
    return {
        "id": pkg.id,
        "code": pkg.code,
        "name": pkg.name,
        "description": pkg.description,
        "icon_color": pkg.icon_color,
        "is_default_active": pkg.is_default_active,
        "is_system": bool(pkg.is_system),
        "items": [
            {
                "id": it.id,
                "package_id": it.package_id,
                "name": it.name,
                "label": it.label,
                "description": it.description,
                "element_type": it.element_type,
                "layer": it.layer,
                "data_type": it.data_type,
                "options": it.options or [],
                "default_value": it.default_value,
                "is_required": it.is_required,
                "section": it.section,
                "sort_order": it.sort_order,
                "created_at": it.created_at.isoformat() if it.created_at else None
            }
            for it in pkg.items
        ],
        "created_at": pkg.created_at.isoformat() if pkg.created_at else None
    }


def create_attribute_package(db: Session, data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new attribute package in the global catalog. Enforces a 3-character unique code."""
    raw_code = (data.get("code") or "").strip().lower()
    if not re.match(r"^[a-z0-9]{3}$", raw_code):
        raise HTTPException(
            status_code=400,
            detail="Il codice del pacchetto deve essere composto esattamente da 3 caratteri alfanumerici (es. 'apm', 'tme', 'sec')."
        )
    
    existing = db.query(AttributePackage).filter(AttributePackage.code == raw_code).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Un pacchetto con codice '{raw_code}' esiste già ('{existing.name}')."
        )

    pkg_name = (data.get("name") or "").strip()
    if not pkg_name:
        raise HTTPException(status_code=400, detail="Il nome del pacchetto è obbligatorio.")

    pkg_id = f"pkg-{raw_code}"
    pkg = AttributePackage(
        id=pkg_id,
        code=raw_code,
        name=pkg_name,
        description=data.get("description"),
        icon_color=data.get("icon_color", "blue"),
        is_default_active=bool(data.get("is_default_active", True)),
        is_system=False
    )
    db.add(pkg)
    db.commit()
    db.refresh(pkg)
    return get_attribute_package(db, pkg.id)


def update_attribute_package(db: Session, package_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Update metadata of an attribute package."""
    pkg = db.query(AttributePackage).filter(AttributePackage.id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail=f"Attribute package '{package_id}' not found.")

    if "name" in data and data["name"]:
        pkg.name = data["name"].strip()
    if "description" in data:
        pkg.description = data["description"]
    if "icon_color" in data and data["icon_color"]:
        pkg.icon_color = data["icon_color"]
    if "is_default_active" in data:
        pkg.is_default_active = bool(data["is_default_active"])

    db.commit()
    db.refresh(pkg)
    return get_attribute_package(db, pkg.id)


def delete_attribute_package(db: Session, package_id: str) -> bool:
    """Delete an attribute package if not system and not populated with data."""
    pkg = db.query(AttributePackage).filter(AttributePackage.id == package_id).first()
    if not pkg:
        return False
    if pkg.is_system:
        raise HTTPException(
            status_code=400,
            detail=f"Il pacchetto '{pkg.name}' è un pacchetto predefinito di sistema e non può essere eliminato."
        )

    # Check if any library has populated attributes from this package
    usage = audit_package_usage(db, package_id)
    if usage["total_populated_elements"] > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Impossibile eliminare il pacchetto '{pkg.name}': sono presenti {usage['total_populated_elements']} elementi in varie librerie con dati valorizzati per gli attributi del pacchetto."
        )

    db.delete(pkg)
    db.commit()
    return True


def create_package_item(db: Session, package_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Add an attribute item to a package. Enforces package code prefix (3 letters)."""
    pkg = db.query(AttributePackage).filter(AttributePackage.id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail=f"Attribute package '{package_id}' not found.")

    raw_name = data.get("name", "").strip().lower().replace(" ", "_").replace("-", "_")
    raw_name = "".join(c for c in raw_name if c.isalnum() or c == "_")

    prefix = f"{pkg.code}_"
    if not raw_name.startswith(prefix):
        name_clean = f"{prefix}{raw_name}"
    else:
        name_clean = raw_name

    existing_item = db.query(AttributePackageItem).filter(AttributePackageItem.name == name_clean).first()
    if existing_item:
        raise HTTPException(status_code=400, detail=f"L'attributo '{name_clean}' esiste già in un pacchetto.")

    item_id = f"item-{pkg.code}-{uuid.uuid4().hex[:6]}"
    item = AttributePackageItem(
        id=item_id,
        package_id=pkg.id,
        name=name_clean,
        label=data["label"].strip(),
        description=data.get("description"),
        element_type=data.get("element_type", "ApplicationComponent"),
        layer=data.get("layer", "Application"),
        data_type=data.get("data_type", "string"),
        options=data.get("options", []),
        default_value=data.get("default_value"),
        is_required=bool(data.get("is_required", False)),
        section=data.get("section") or pkg.name,
        sort_order=int(data.get("sort_order", len(pkg.items) + 1))
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "id": item.id,
        "package_id": item.package_id,
        "name": item.name,
        "label": item.label,
        "description": item.description,
        "element_type": item.element_type,
        "layer": item.layer,
        "data_type": item.data_type,
        "options": item.options or [],
        "default_value": item.default_value,
        "is_required": item.is_required,
        "section": item.section,
        "sort_order": item.sort_order
    }


def update_package_item(db: Session, package_id: str, item_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Update an attribute item in a package."""
    item = db.query(AttributePackageItem).filter(
        AttributePackageItem.id == item_id,
        AttributePackageItem.package_id == package_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Package attribute item not found.")

    if "label" in data and data["label"]:
        item.label = data["label"].strip()
    if "description" in data:
        item.description = data["description"]
    if "section" in data and data["section"]:
        item.section = data["section"].strip()
    if "element_type" in data and data["element_type"]:
        item.element_type = data["element_type"]
    if "layer" in data and data["layer"]:
        item.layer = data["layer"]
    if "data_type" in data and data["data_type"]:
        item.data_type = data["data_type"]
    if "options" in data:
        item.options = data["options"] or []
    if "default_value" in data:
        item.default_value = data["default_value"]
    if "is_required" in data:
        item.is_required = bool(data["is_required"])
    if "sort_order" in data:
        item.sort_order = int(data["sort_order"])

    db.commit()
    db.refresh(item)
    return {
        "id": item.id,
        "package_id": item.package_id,
        "name": item.name,
        "label": item.label,
        "description": item.description,
        "element_type": item.element_type,
        "layer": item.layer,
        "data_type": item.data_type,
        "options": item.options or [],
        "default_value": item.default_value,
        "is_required": item.is_required,
        "section": item.section,
        "sort_order": item.sort_order
    }


def delete_package_item(db: Session, package_id: str, item_id: str) -> bool:
    """Delete an item from a package if no elements in any library populate it."""
    item = db.query(AttributePackageItem).filter(
        AttributePackageItem.id == item_id,
        AttributePackageItem.package_id == package_id
    ).first()
    if not item:
        return False

    # Check if elements in any library populate this attribute
    populated_count = 0
    elements = db.query(ArchimateElement).all()
    for elem in elements:
        if isinstance(elem.properties, dict):
            val = elem.properties.get(item.name)
            if val is not None and val != "" and val != [] and val != {}:
                populated_count += 1

    if populated_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Impossibile eliminare l'attributo '{item.name}': è attualmente valorizzato in {populated_count} elementi."
        )

    db.delete(item)
    db.commit()
    return True


def toggle_library_package(
    db: Session,
    model_id: str,
    package_id: str,
    active: Optional[bool] = None,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Activate or deactivate an attribute package on a library.
    STRICT GUARD: Impossible to deactivate if even a single element has a populated value
    for any attribute in the package.
    """
    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"Libreria '{model_id}' non trovata.")

    pkg = db.query(AttributePackage).filter(AttributePackage.id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail=f"Pacchetto '{package_id}' non trovato.")

    existing_link = db.query(WorkspaceAttributePackage).filter(
        WorkspaceAttributePackage.model_id == model_id,
        WorkspaceAttributePackage.package_id == package_id
    ).first()

    should_activate = not bool(existing_link) if active is None else bool(active)

    if should_activate:
        if not existing_link:
            link = WorkspaceAttributePackage(
                id=f"wap-{uuid.uuid4().hex[:8]}",
                model_id=model_id,
                package_id=package_id,
                activated_by=user_id
            )
            db.add(link)
            db.commit()
        return {
            "status": "success",
            "package_id": package_id,
            "package_name": pkg.name,
            "is_active": True,
            "message": f"Pacchetto '{pkg.name}' attivato per la libreria '{model.name}'."
        }
    else:
        # STRICT DEACTIVATION GUARD
        if existing_link:
            pkg_attr_names = [it.name for it in pkg.items]
            elements = db.query(ArchimateElement).filter(ArchimateElement.model_id == model_id).all()
            
            populated_elements = []
            for elem in elements:
                props = elem.properties if isinstance(elem.properties, dict) else {}
                populated_attrs = []
                for attr_name in pkg_attr_names:
                    val = props.get(attr_name)
                    if val is not None and val != "" and val != [] and val != {}:
                        populated_attrs.append(attr_name)
                if populated_attrs:
                    populated_elements.append({
                        "id": elem.id,
                        "name": elem.name,
                        "type": elem.type,
                        "populated_attributes": populated_attrs
                    })

            if populated_elements:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": "package_deactivation_blocked",
                        "message": f"Impossibile disattivare il pacchetto '{pkg.name}': ci sono {len(populated_elements)} elementi nella libreria che hanno uno o più attributi del pacchetto valorizzati.",
                        "populated_count": len(populated_elements),
                        "affected_elements": populated_elements[:20]
                    }
                )

            db.delete(existing_link)
            db.commit()

        return {
            "status": "success",
            "package_id": package_id,
            "package_name": pkg.name,
            "is_active": False,
            "message": f"Pacchetto '{pkg.name}' disattivato per la libreria '{model.name}'."
        }


def audit_package_usage(db: Session, package_id: str) -> Dict[str, Any]:
    """Audit which libraries have the package active and which populate attributes of this package."""
    pkg = db.query(AttributePackage).filter(AttributePackage.id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail=f"Pacchetto '{package_id}' non trovato.")

    pkg_attr_map = {it.name: it.label for it in pkg.items}
    workspaces = db.query(ModelWorkspace).all()
    active_links = {
        l.model_id: l for l in db.query(WorkspaceAttributePackage).filter(
            WorkspaceAttributePackage.package_id == package_id
        ).all()
    }

    libraries_analysis = []
    total_populated_elements_all = 0

    for ws in workspaces:
        is_active = ws.id in active_links
        elements = db.query(ArchimateElement).filter(ArchimateElement.model_id == ws.id).all()
        
        populated_for_ws = []
        attr_counts = {name: 0 for name in pkg_attr_map}

        for elem in elements:
            props = elem.properties if isinstance(elem.properties, dict) else {}
            elem_pop_attrs = []
            for attr_name in pkg_attr_map:
                val = props.get(attr_name)
                if val is not None and val != "" and val != [] and val != {}:
                    attr_counts[attr_name] += 1
                    elem_pop_attrs.append(attr_name)
            
            if elem_pop_attrs:
                populated_for_ws.append({
                    "id": elem.id,
                    "name": elem.name,
                    "type": elem.type,
                    "populated_attributes": elem_pop_attrs
                })

        total_populated_elements_all += len(populated_for_ws)

        libraries_analysis.append({
            "model_id": ws.id,
            "model_code": ws.code,
            "model_name": ws.name,
            "is_active": is_active,
            "total_elements": len(elements),
            "populated_elements_count": len(populated_for_ws),
            "populated_elements_sample": populated_for_ws[:10],
            "attribute_counts": attr_counts
        })

    return {
        "package_id": pkg.id,
        "package_code": pkg.code,
        "package_name": pkg.name,
        "is_system": bool(pkg.is_system),
        "total_active_libraries": len(active_links),
        "total_populated_elements": total_populated_elements_all,
        "libraries": libraries_analysis
    }


def activate_default_packages_for_workspace(db: Session, model_id: str):
    """Automatically activates default packages on a newly created workspace."""
    default_pkgs = db.query(AttributePackage).filter(AttributePackage.is_default_active == True).all()
    for pkg in default_pkgs:
        existing = db.query(WorkspaceAttributePackage).filter(
            WorkspaceAttributePackage.model_id == model_id,
            WorkspaceAttributePackage.package_id == pkg.id
        ).first()
        if not existing:
            db.add(WorkspaceAttributePackage(
                id=f"wap-{uuid.uuid4().hex[:8]}",
                model_id=model_id,
                package_id=pkg.id
            ))
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
        "BusinessCollaboration": ["Aggregation", "Assignment", "Association"],
        "BusinessInterface": ["Composition", "Assignment", "Serving", "Association"],
        "BusinessProcess": ["Assignment", "Serving", "Association"],
        "BusinessFunction": ["Assignment", "Serving", "Association"],
        "BusinessInteraction": ["Assignment", "Association"],
        "BusinessEvent": ["Triggering", "Association"]
    },
    "BusinessRole": {
        "BusinessRole": ["Composition", "Aggregation", "Specialization", "Association"],
        "BusinessCollaboration": ["Aggregation", "Association"],
        "BusinessInterface": ["Composition", "Assignment", "Serving", "Association"],
        "BusinessProcess": ["Assignment", "Serving", "Association"],
        "BusinessFunction": ["Assignment", "Serving", "Association"],
        "BusinessInteraction": ["Assignment", "Association"],
        "BusinessEvent": ["Triggering", "Association"],
        "BusinessService": ["Serving", "Assignment", "Association"],
        "BusinessActor": ["Assignment", "Association"]
    },
    "BusinessCollaboration": {
        "BusinessCollaboration": ["Composition", "Aggregation", "Specialization", "Association"],
        "BusinessRole": ["Aggregation", "Composition", "Association"],
        "BusinessActor": ["Aggregation", "Association"],
        "BusinessInteraction": ["Assignment", "Association"],
        "BusinessProcess": ["Assignment", "Association"],
        "BusinessFunction": ["Assignment", "Association"],
        "BusinessInterface": ["Composition", "Assignment", "Association"]
    },
    "BusinessInterface": {
        "BusinessInterface": ["Composition", "Aggregation", "Specialization", "Association"],
        "BusinessService": ["Assignment", "Serving", "Association"],
        "BusinessRole": ["Serving", "Association"],
        "BusinessActor": ["Serving", "Association"],
        "BusinessProcess": ["Serving", "Association"]
    },
    "BusinessProcess": {
        "BusinessProcess": ["Composition", "Aggregation", "Flow", "Triggering", "Specialization", "Association"],
        "BusinessFunction": ["Composition", "Aggregation", "Flow", "Triggering", "Association"],
        "BusinessInteraction": ["Flow", "Triggering", "Association"],
        "BusinessEvent": ["Triggering", "Access", "Association"],
        "BusinessObject": ["Access", "Association"],
        "Contract": ["Access", "Association"],
        "BusinessService": ["Realization", "Serving", "Association"],
        "Product": ["Realization", "Association"],
        "ValueStream": ["Realization", "Association"],
        "Capability": ["Realization", "Association"]
    },
    "BusinessFunction": {
        "BusinessFunction": ["Composition", "Aggregation", "Flow", "Triggering", "Specialization", "Association"],
        "BusinessProcess": ["Realization", "Assignment", "Flow", "Triggering", "Serving", "Association"],
        "BusinessObject": ["Access", "Association"],
        "BusinessService": ["Realization", "Serving", "Association"],
        "Capability": ["Realization", "Association"]
    },
    "BusinessInteraction": {
        "BusinessInteraction": ["Composition", "Aggregation", "Flow", "Triggering", "Specialization", "Association"],
        "BusinessProcess": ["Flow", "Triggering", "Association"],
        "BusinessService": ["Realization", "Association"],
        "BusinessObject": ["Access", "Association"]
    },
    "BusinessEvent": {
        "BusinessEvent": ["Composition", "Aggregation", "Triggering", "Specialization", "Association"],
        "BusinessProcess": ["Triggering", "Flow", "Association"],
        "BusinessFunction": ["Triggering", "Flow", "Association"],
        "BusinessInteraction": ["Triggering", "Flow", "Association"],
        "BusinessObject": ["Access", "Association"]
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
        "Contract": ["Specialization", "Realization", "Association"],
        "DataObject": ["Realization", "Association"]
    },
    "Contract": {
        "Contract": ["Composition", "Aggregation", "Specialization", "Association"],
        "BusinessObject": ["Specialization", "Association"],
        "Product": ["Aggregation", "Composition", "Association"],
        "BusinessProcess": ["Access", "Association"]
    },
    "Product": {
        "Product": ["Composition", "Aggregation", "Specialization", "Association"],
        "BusinessService": ["Aggregation", "Composition", "Association"],
        "ApplicationService": ["Aggregation", "Composition", "Association"],
        "BusinessObject": ["Aggregation", "Composition", "Association"],
        "Contract": ["Aggregation", "Composition", "Association"]
    },
    "ApplicationComponent": {
        "ApplicationComponent": ["Composition", "Aggregation", "Flow", "Triggering", "Serving", "Specialization", "Association"],
        "ApplicationCollaboration": ["Aggregation", "Composition", "Association"],
        "ApplicationInterface": ["Composition", "Assignment", "Realization", "Serving", "Association"],
        "ApplicationFunction": ["Assignment", "Composition", "Realization", "Serving", "Association"],
        "ApplicationProcess": ["Assignment", "Realization", "Serving", "Association"],
        "ApplicationEvent": ["Assignment", "Triggering", "Association"],
        "ApplicationService": ["Realization", "Serving", "Assignment", "Association"],
        "DataObject": ["Access", "Association"],
        "BusinessProcess": ["Serving", "Realization", "Association"],
        "BusinessFunction": ["Serving", "Realization", "Association"],
        "BusinessRole": ["Serving", "Association"],
        "BusinessActor": ["Serving", "Association"],
        "Capability": ["Realization", "Serving", "Association"]
    },
    "ApplicationCollaboration": {
        "ApplicationCollaboration": ["Composition", "Aggregation", "Specialization", "Association"],
        "ApplicationComponent": ["Aggregation", "Composition", "Association"],
        "ApplicationProcess": ["Assignment", "Association"],
        "ApplicationFunction": ["Assignment", "Association"],
        "ApplicationService": ["Realization", "Association"]
    },
    "ApplicationInterface": {
        "ApplicationInterface": ["Composition", "Aggregation", "Specialization", "Association"],
        "ApplicationService": ["Assignment", "Serving", "Association"],
        "ApplicationComponent": ["Serving", "Association"],
        "BusinessProcess": ["Serving", "Association"],
        "BusinessRole": ["Serving", "Association"]
    },
    "ApplicationFunction": {
        "ApplicationFunction": ["Composition", "Aggregation", "Flow", "Triggering", "Serving", "Specialization", "Association"],
        "ApplicationProcess": ["Realization", "Flow", "Triggering", "Serving", "Association"],
        "ApplicationService": ["Realization", "Serving", "Association"],
        "DataObject": ["Access", "Association"],
        "BusinessProcess": ["Serving", "Realization", "Association"],
        "BusinessFunction": ["Serving", "Realization", "Association"],
        "Capability": ["Realization", "Serving", "Association"]
    },
    "ApplicationProcess": {
        "ApplicationProcess": ["Composition", "Aggregation", "Flow", "Triggering", "Specialization", "Association"],
        "ApplicationFunction": ["Flow", "Triggering", "Association"],
        "ApplicationEvent": ["Triggering", "Association"],
        "ApplicationService": ["Realization", "Serving", "Association"],
        "DataObject": ["Access", "Association"],
        "BusinessProcess": ["Serving", "Realization", "Association"]
    },
    "ApplicationEvent": {
        "ApplicationEvent": ["Composition", "Aggregation", "Triggering", "Specialization", "Association"],
        "ApplicationProcess": ["Triggering", "Flow", "Association"],
        "ApplicationFunction": ["Triggering", "Flow", "Association"],
        "DataObject": ["Access", "Association"]
    },
    "ApplicationService": {
        "ApplicationService": ["Composition", "Aggregation", "Flow", "Triggering", "Specialization", "Association"],
        "BusinessProcess": ["Serving", "Association"],
        "BusinessFunction": ["Serving", "Association"],
        "BusinessRole": ["Serving", "Association"],
        "ApplicationComponent": ["Serving", "Association"],
        "ApplicationFunction": ["Serving", "Association"],
        "ApplicationProcess": ["Serving", "Association"],
        "DataObject": ["Access", "Association"]
    },
    "DataObject": {
        "DataObject": ["Composition", "Aggregation", "Specialization", "Association"],
        "BusinessObject": ["Realization", "Association"]
    },
    "Node": {
        "Node": ["Composition", "Aggregation", "Flow", "Triggering", "Serving", "Specialization", "Association"],
        "Device": ["Composition", "Assignment", "Association"],
        "SystemSoftware": ["Composition", "Assignment", "Association"],
        "TechnologyInterface": ["Composition", "Assignment", "Association"],
        "TechnologyFunction": ["Assignment", "Realization", "Association"],
        "TechnologyService": ["Realization", "Serving", "Association"],
        "CommunicationNetwork": ["Association"],
        "Path": ["Association"],
        "Artifact": ["Assignment", "Association"],
        "ApplicationComponent": ["Assignment", "Serving", "Realization", "Association"]
    },
    "Device": {
        "Device": ["Composition", "Aggregation", "Specialization", "Association"],
        "SystemSoftware": ["Assignment", "Composition", "Association"],
        "TechnologyInterface": ["Composition", "Assignment", "Association"],
        "TechnologyFunction": ["Assignment", "Association"],
        "TechnologyService": ["Realization", "Serving", "Association"],
        "CommunicationNetwork": ["Association"],
        "Artifact": ["Assignment", "Association"],
        "ApplicationComponent": ["Serving", "Assignment", "Association"]
    },
    "SystemSoftware": {
        "SystemSoftware": ["Composition", "Aggregation", "Specialization", "Association"],
        "TechnologyFunction": ["Assignment", "Realization", "Association"],
        "TechnologyService": ["Realization", "Serving", "Association"],
        "ApplicationComponent": ["Serving", "Realization", "Assignment", "Association"],
        "DataObject": ["Access", "Realization", "Association"],
        "Artifact": ["Assignment", "Association"]
    },
    "TechnologyInterface": {
        "TechnologyInterface": ["Composition", "Aggregation", "Specialization", "Association"],
        "TechnologyService": ["Assignment", "Serving", "Association"],
        "Node": ["Serving", "Association"],
        "ApplicationComponent": ["Serving", "Association"]
    },
    "TechnologyFunction": {
        "TechnologyFunction": ["Composition", "Aggregation", "Flow", "Triggering", "Specialization", "Association"],
        "TechnologyService": ["Realization", "Serving", "Association"],
        "Artifact": ["Access", "Association"],
        "ApplicationComponent": ["Serving", "Association"]
    },
    "CommunicationNetwork": {
        "CommunicationNetwork": ["Composition", "Aggregation", "Specialization", "Association"],
        "Path": ["Realization", "Aggregation", "Association"],
        "Node": ["Association", "Serving"],
        "Device": ["Association", "Serving"],
        "TechnologyService": ["Realization", "Association"]
    },
    "Path": {
        "Path": ["Composition", "Aggregation", "Specialization", "Association"],
        "Node": ["Association", "Serving"],
        "Device": ["Association", "Serving"],
        "CommunicationNetwork": ["Realization", "Association"]
    },
    "TechnologyService": {
        "TechnologyService": ["Composition", "Aggregation", "Specialization", "Association"],
        "ApplicationComponent": ["Serving", "Realization", "Association"],
        "ApplicationService": ["Serving", "Association"],
        "ApplicationFunction": ["Serving", "Association"],
        "Node": ["Serving", "Association"],
        "SystemSoftware": ["Serving", "Association"],
        "BusinessProcess": ["Serving", "Association"],
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
        "Driver": ["Association", "Influence"],
        "Assessment": ["Association", "Influence"],
        "Goal": ["Association", "Influence"],
        "Outcome": ["Association"],
        "Value": ["Association"]
    },
    "Driver": {
        "Driver": ["Composition", "Aggregation", "Influence", "Specialization", "Association"],
        "Assessment": ["Influence", "Association"],
        "Goal": ["Influence", "Association"],
        "Stakeholder": ["Association"]
    },
    "Assessment": {
        "Assessment": ["Composition", "Aggregation", "Influence", "Specialization", "Association"],
        "Goal": ["Influence", "Association"],
        "Driver": ["Influence", "Association"],
        "Requirement": ["Influence", "Association"]
    },
    "Goal": {
        "Goal": ["Composition", "Aggregation", "Influence", "Specialization", "Association"],
        "Outcome": ["Realization", "Influence", "Association"],
        "Requirement": ["Realization", "Influence", "Association"],
        "Principle": ["Influence", "Association"],
        "Value": ["Influence", "Association"]
    },
    "Outcome": {
        "Outcome": ["Composition", "Aggregation", "Influence", "Specialization", "Association"],
        "Goal": ["Realization", "Influence", "Association"],
        "Value": ["Influence", "Realization", "Association"]
    },
    "Principle": {
        "Principle": ["Composition", "Aggregation", "Influence", "Specialization", "Association"],
        "Requirement": ["Realization", "Influence", "Association"],
        "Goal": ["Realization", "Influence", "Association"]
    },
    "Requirement": {
        "Requirement": ["Composition", "Aggregation", "Influence", "Specialization", "Association"],
        "Goal": ["Realization", "Influence", "Association"],
        "Outcome": ["Realization", "Influence", "Association"],
        "Constraint": ["Influence", "Association"],
        "BusinessActor": ["Realization", "Association"],
        "BusinessProcess": ["Realization", "Association"],
        "ApplicationComponent": ["Realization", "Association"],
        "ApplicationService": ["Realization", "Association"],
        "SystemSoftware": ["Realization", "Association"],
        "Node": ["Realization", "Association"]
    },
    "Constraint": {
        "Constraint": ["Composition", "Aggregation", "Influence", "Specialization", "Association"],
        "Requirement": ["Influence", "Association"],
        "Goal": ["Influence", "Association"],
        "BusinessProcess": ["Realization", "Association"],
        "ApplicationComponent": ["Realization", "Association"]
    },
    "Value": {
        "Value": ["Composition", "Aggregation", "Influence", "Specialization", "Association"],
        "Stakeholder": ["Association"],
        "Product": ["Association"],
        "BusinessService": ["Association"]
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


def get_allowed_rel_names_for_types(source_type: str, target_type: str) -> List[str]:
    """Returns list of allowed relationship names between two ArchiMate element types."""
    allowed = []
    if source_type in ARCHIMATE_RELATIONSHIP_RULES:
        if target_type in ARCHIMATE_RELATIONSHIP_RULES[source_type]:
            allowed = list(ARCHIMATE_RELATIONSHIP_RULES[source_type][target_type])
    
    # Association is universally valid between any pair of ArchiMate concepts
    if "Association" not in allowed and "AssociationRelationship" not in allowed:
        allowed.append("Association")
        
    return allowed


def is_rel_type_allowed(source_type: str, target_type: str, rel_type: str) -> bool:
    """Checks if a relationship type (e.g. 'ServingRelationship' or 'Serving') is valid between source and target."""
    allowed_names = get_allowed_rel_names_for_types(source_type, target_type)
    norm_rel = rel_type.replace("Relationship", "")
    for a in allowed_names:
        if a == rel_type or a == norm_rel or f"{a}Relationship" == rel_type:
            return True
    return False


REL_STRENGTH_MAP: Dict[str, int] = {
    "Composition": 10, "CompositionRelationship": 10,
    "Aggregation": 9, "AggregationRelationship": 9,
    "Assignment": 8, "AssignmentRelationship": 8,
    "Realization": 7, "RealizationRelationship": 7,
    "Serving": 6, "ServingRelationship": 6,
    "Access": 5, "AccessRelationship": 5,
    "Influence": 4, "InfluenceRelationship": 4,
    "Triggering": 3, "TriggeringRelationship": 3,
    "Flow": 3, "FlowRelationship": 3,
    "Specialization": 2, "SpecializationRelationship": 2,
    "Association": 1, "AssociationRelationship": 1,
}

STRENGTH_TO_TYPE: Dict[int, str] = {
    10: "CompositionRelationship",
    9: "AggregationRelationship",
    8: "AssignmentRelationship",
    7: "RealizationRelationship",
    6: "ServingRelationship",
    5: "AccessRelationship",
    4: "InfluenceRelationship",
    3: "FlowRelationship",
    2: "SpecializationRelationship",
    1: "AssociationRelationship",
}


def compute_archimate_derivation(
    elements: List[Any],
    relationships: List[Any],
    source_id: Optional[str] = None,
    target_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Computes derived relationships according to ArchiMate 3.2 §5.7 Derivation Rules.
    When elements A and C are connected through an intermediate element B (A -> B -> C),
    a relationship A -> C can be derived. The derived relationship type is governed by
    the weakest link in the chain (min strength).
    """
    elem_by_id = {e.id: e for e in elements}

    # Map direct edges: (src, tgt) -> list of rel types
    direct_edges: Set[tuple[str, str]] = set()
    outgoing: Dict[str, List[Any]] = {}

    for r in relationships:
        direct_edges.add((r.source_id, r.target_id))
        outgoing.setdefault(r.source_id, []).append(r)

    derived_results: List[Dict[str, Any]] = []
    seen_derived_pairs: Set[tuple[str, str]] = set()

    # Scope of sources
    candidate_sources = [source_id] if source_id else list(outgoing.keys())

    for s_id in candidate_sources:
        if s_id not in elem_by_id:
            continue
        elem_a = elem_by_id[s_id]

        for r1 in outgoing.get(s_id, []):
            b_id = r1.target_id
            if b_id not in elem_by_id or b_id == s_id:
                continue
            elem_b = elem_by_id[b_id]
            r1_str = REL_STRENGTH_MAP.get(r1.type, 1)

            for r2 in outgoing.get(b_id, []):
                c_id = r2.target_id
                if c_id not in elem_by_id or c_id == s_id or c_id == b_id:
                    continue
                if target_id and c_id != target_id:
                    continue

                elem_c = elem_by_id[c_id]
                pair = (s_id, c_id)

                # Skip if direct relationship already exists or already derived
                if pair in direct_edges or pair in seen_derived_pairs:
                    continue

                r2_str = REL_STRENGTH_MAP.get(r2.type, 1)
                chain_strength = min(r1_str, r2_str)
                candidate_type = STRENGTH_TO_TYPE.get(chain_strength, "AssociationRelationship")

                # Check if candidate type is allowed between element_a and element_c
                if not is_rel_type_allowed(elem_a.type, elem_c.type, candidate_type):
                    # Pick highest allowed relationship type by descending strength
                    allowed_names = get_allowed_rel_names_for_types(elem_a.type, elem_c.type)
                    best_type = "AssociationRelationship"
                    best_str = 1
                    for an in allowed_names:
                        astr = REL_STRENGTH_MAP.get(an, 1)
                        if astr <= chain_strength and astr > best_str:
                            best_str = astr
                            best_type = an if an.endswith("Relationship") else f"{an}Relationship"
                    candidate_type = best_type

                seen_derived_pairs.add(pair)
                derived_results.append({
                    "id": f"derived-{elem_a.id[:6]}-{elem_c.id[:6]}",
                    "source_id": elem_a.id,
                    "source_name": elem_a.name,
                    "source_type": elem_a.type,
                    "target_id": elem_c.id,
                    "target_name": elem_c.name,
                    "target_type": elem_c.type,
                    "type": candidate_type,
                    "is_derived": True,
                    "strength": chain_strength,
                    "chain": [
                        {
                            "source_name": elem_a.name,
                            "rel_type": r1.type,
                            "target_name": elem_b.name
                        },
                        {
                            "source_name": elem_b.name,
                            "rel_type": r2.type,
                            "target_name": elem_c.name
                        }
                    ]
                })

    return derived_results


def get_plateau_roadmap(elements: List[Any], relationships: List[Any]) -> Dict[str, Any]:
    """
    Summarizes architectural plateaus, work packages, and lifecycle transition horizons (As-Is vs To-Be).
    """
    elem_by_id = {e.id: e for e in elements}

    plateaus = [e for e in elements if e.type == "Plateau"]
    work_packages = [e for e in elements if e.type == "WorkPackage"]

    # If explicit Plateau elements are present in the model
    if plateaus:
        plateau_items = []
        for pl in plateaus:
            # find elements aggregated or composed by this plateau
            composed_elements = []
            for r in relationships:
                if r.source_id == pl.id and r.type in ["AggregationRelationship", "CompositionRelationship"]:
                    target = elem_by_id.get(r.target_id)
                    if target:
                        composed_elements.append({
                            "id": target.id,
                            "name": target.name,
                            "type": target.type,
                            "layer": target.layer
                        })
            plateau_items.append({
                "id": pl.id,
                "name": pl.name,
                "documentation": pl.documentation,
                "element_count": len(composed_elements),
                "elements": composed_elements
            })
        return {
            "has_explicit_plateaus": True,
            "plateaus": plateau_items,
            "work_packages": [{"id": wp.id, "name": wp.name, "doc": wp.documentation} for wp in work_packages]
        }

    # Otherwise construct dynamic EA Transition Horizons from lifecycle & APM data
    apps = [e for e in elements if e.type == "ApplicationComponent"]
    as_is_apps = []
    transition_apps = []
    to_be_apps = []

    for a in apps:
        props = a.properties if isinstance(a.properties, dict) else {}
        apm = a.apm_attributes
        quadrant = apm.time_quadrant if apm else "Tolerate"
        status = props.get("eea_lifecycle_status", "Live")

        app_summary = {
            "id": a.id,
            "name": a.name,
            "time_quadrant": quadrant,
            "lifecycle_status": status,
            "cost": apm.annual_cost if apm else 0.0
        }

        if status in ["Live", "Phase-out"] and quadrant in ["Tolerate", "Eliminate"]:
            as_is_apps.append(app_summary)
        if status in ["Evaluation", "Plan"] or quadrant == "Migrate":
            transition_apps.append(app_summary)
        if quadrant == "Invest" or status in ["Plan", "Evaluation"]:
            to_be_apps.append(app_summary)

    return {
        "has_explicit_plateaus": False,
        "horizons": [
            {
                "horizon": "Baseline / As-Is (Corrente)",
                "description": "Applicazioni attualmente Live o in dismissione/Tolerate.",
                "app_count": len(as_is_apps),
                "applications": as_is_apps
            },
            {
                "horizon": "Transition Plateau (Transitorio)",
                "description": "Applicazioni in fase di migrazione o valutazione architetturale.",
                "app_count": len(transition_apps),
                "applications": transition_apps
            },
            {
                "horizon": "Target Architecture / To-Be (Futuro)",
                "description": "Sistemi target strategici (Invest) e nuove iniziative.",
                "app_count": len(to_be_apps),
                "applications": to_be_apps
            }
        ],
        "work_packages": [{"id": wp.id, "name": wp.name, "doc": wp.documentation} for wp in work_packages]
    }


