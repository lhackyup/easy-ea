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
    ArchimateRelationship,
    ElementStereotype,
    StereotypeAttributeLink,
    PackageView
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
    is_easy = False
    if model_id and model_id != "*":
        model_ws = db.query(ModelWorkspace).filter(
            (ModelWorkspace.id == model_id) | (ModelWorkspace.code == model_id)
        ).first()
        if model_ws and ((model_ws.code and model_ws.code.upper() == "EASY") or model_ws.id == "sample-easybank-ea"):
            is_easy = True

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
        sec = ca.section or "Custom Attributes"
        if is_easy and (ca.element_type in ("ApplicationComponent", "*") or ca.layer in ("Application", "All")):
            sec = "Attributi Generici"
        custom_map[key].append({
            "id": ca.id,
            "model_id": ca.model_id,
            "library_code": ca.library_code,
            "section": sec,
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
                sec = item.section or pkg.name
                if is_easy and (item.element_type in ("ApplicationComponent", "*") or item.layer in ("Application", "All")):
                    if pkg.code.lower() == "apm":
                        sec = "Package APM"
                    elif pkg.code.lower() == "resilience":
                        sec = "Package Resilience"
                    elif pkg.code.lower() == "bian":
                        sec = "Package BIAN"
                    elif pkg.code.lower() == "it4it":
                        sec = "Package IT4IT"
                    elif pkg.code.lower() == "adr":
                        sec = "Package ADR"
                    else:
                        sec = f"Package {pkg.code.upper()}"
                custom_map[key].append({
                    "id": item.id,
                    "model_id": model_id,
                    "library_code": None,
                    "section": sec,
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
    is_easy = False
    if model_id and model_id != "*":
        model_ws = db.query(ModelWorkspace).filter(
            (ModelWorkspace.id == model_id) | (ModelWorkspace.code == model_id)
        ).first()
        if model_ws and ((model_ws.code and model_ws.code.upper() == "EASY") or model_ws.id == "sample-easybank-ea"):
            is_easy = True

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
            "section": "Attributi Generici" if (is_easy and (ca.element_type in ("ApplicationComponent", "*") or ca.layer in ("Application", "All"))) else (ca.section or "Custom Attributes"),
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
                sec = item.section or pkg.name
                if is_easy and (item.element_type in ("ApplicationComponent", "*") or item.layer in ("Application", "All")):
                    if pkg.code.lower() == "apm":
                        sec = "Package APM"
                    elif pkg.code.lower() == "resilience":
                        sec = "Package Resilience"
                    elif pkg.code.lower() == "bian":
                        sec = "Package BIAN"
                    elif pkg.code.lower() == "it4it":
                        sec = "Package IT4IT"
                    elif pkg.code.lower() == "adr":
                        sec = "Package ADR"
                    else:
                        sec = f"Package {pkg.code.upper()}"
                res.append({
                    "id": item.id,
                    "model_id": model_id,
                    "library_code": None,
                    "section": sec,
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
    """Seed or update standard APM attribute package according to LeanIX/TOGAF standards and purge deprecated tme_ attributes and pkg-tme."""
    # 1. Package APM (Code: apm, 3 letters)
    apm_pkg = db.query(AttributePackage).filter(AttributePackage.id == "pkg-apm").first()
    if not apm_pkg:
        apm_pkg = AttributePackage(
            id="pkg-apm",
            code="apm",
            name="Application Portfolio Management",
            description="Essential APM framework and attributes for TCO, governance, Business Application stereotypes, lifecycle tracking, and Gartner TIME model aligned with LeanIX and TOGAF standards.",
            icon_color="indigo",
            package_type="framework",
            standard_version="LeanIX / TOGAF / Gartner TIME",
            is_default_active=True,
            is_system=True
        )
        db.add(apm_pkg)
        db.flush()
    else:
        apm_pkg.code = "apm"
        apm_pkg.name = "Application Portfolio Management"
        apm_pkg.description = "Essential APM framework and attributes for TCO, governance, Business Application stereotypes, lifecycle tracking, and Gartner TIME model aligned with LeanIX and TOGAF standards."
        apm_pkg.icon_color = "indigo"
        apm_pkg.package_type = "framework"
        apm_pkg.standard_version = "LeanIX / TOGAF / Gartner TIME"
        apm_pkg.is_system = True

    apm_items = [
        # Section 1: Governance & Ownership
        {
            "id": "item-apm-app-code",
            "name": "apm_app_code",
            "label": "Application Code",
            "description": "Unique alphanumeric application identifier (exactly 6 characters, e.g. APP001, CRMB01).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": True,
            "section": "Governance & Ownership",
            "sort_order": 1
        },
        {
            "id": "item-apm-short-name",
            "name": "apm_short_name",
            "label": "Short Name",
            "description": "Concise name of the application for visual diagrams and matrices (maximum 12 characters, e.g. VaultCore).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": True,
            "section": "Governance & Ownership",
            "sort_order": 2
        },
        {
            "id": "item-apm-business-owner",
            "name": "apm_business_owner",
            "label": "Business Owner",
            "description": "Business executive or process owner accountable for the application.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": False,
            "section": "Governance & Ownership",
            "sort_order": 3
        },
        {
            "id": "item-apm-technical-owner",
            "name": "apm_technical_owner",
            "label": "Technical Owner",
            "description": "Lead architect or IT engineering manager responsible for the application.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": False,
            "section": "Governance & Ownership",
            "sort_order": 2
        },
        {
            "id": "item-apm-vendor",
            "name": "apm_vendor",
            "label": "Vendor / Provider",
            "description": "Software vendor, commercial software house, or in-house development team.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": False,
            "section": "Governance & Ownership",
            "sort_order": 3
        },
        {
            "id": "item-apm-cost-center",
            "name": "apm_cost_center",
            "label": "Cost Center",
            "description": "Corporate cost center code to which application expenses are allocated.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": False,
            "section": "Governance & Ownership",
            "sort_order": 4
        },

        # Section 2: Lifecycle
        {
            "id": "item-apm-lifecycle-status",
            "name": "apm_lifecycle_status",
            "label": "Lifecycle Status",
            "description": "Current phase of the application lifecycle compliant with LeanIX / TOGAF.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Plan", "Phase In", "Live", "Phase Out", "Retired"],
            "default_value": "Live",
            "is_required": True,
            "section": "Lifecycle",
            "sort_order": 5
        },
        {
            "id": "item-apm-live-date",
            "name": "apm_live_date",
            "label": "Go-Live Date",
            "description": "Actual or planned date of production deployment.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "date",
            "options": [],
            "default_value": None,
            "is_required": False,
            "section": "Lifecycle",
            "sort_order": 6
        },
        {
            "id": "item-apm-retirement-date",
            "name": "apm_retirement_date",
            "label": "Planned Retirement Date",
            "description": "Target date for decommissioning or end-of-support.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "date",
            "options": [],
            "default_value": None,
            "is_required": False,
            "section": "Lifecycle",
            "sort_order": 7
        },

        # Section 3: Business Fit & Criticality
        {
            "id": "item-apm-business-criticality",
            "name": "apm_business_criticality",
            "label": "Business Criticality",
            "description": "Level of operational or financial business impact in case of application outage.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Mission Critical", "Business Critical", "Business Operational", "Administrative"],
            "default_value": "Business Operational",
            "is_required": True,
            "section": "Business Fit & Criticality",
            "sort_order": 8
        },
        {
            "id": "item-apm-functional-fit",
            "name": "apm_functional_fit",
            "label": "Business / Functional Fit",
            "description": "Assessment of functional adequacy and alignment with business requirements (LeanIX 1-4 scale).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": [
                "1 - Unreasonable",
                "2 - Insufficient",
                "3 - Appropriate",
                "4 - Perfect"
            ],
            "default_value": "3 - Appropriate",
            "is_required": True,
            "section": "Business Fit & Criticality",
            "sort_order": 9
        },
        {
            "id": "item-apm-time-override",
            "name": "apm_time_quadrant_override",
            "label": "TIME Recommendation (Override)",
            "description": "Optional override of the Gartner TIME quadrant (calculated automatically if blank).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["", "Invest", "Tolerate", "Migrate", "Eliminate"],
            "default_value": "",
            "is_required": False,
            "section": "Business Fit & Criticality",
            "sort_order": 10
        },

        # Section 4: Technical Architecture & Fit
        {
            "id": "item-apm-technical-fit",
            "name": "apm_technical_fit",
            "label": "Technical Fit",
            "description": "Architectural quality, maintainability, and absence of technical debt (LeanIX 1-4 scale).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": [
                "1 - Unreasonable",
                "2 - Insufficient",
                "3 - Appropriate",
                "4 - Perfect"
            ],
            "default_value": "3 - Appropriate",
            "is_required": True,
            "section": "Technical Architecture & Fit",
            "sort_order": 11
        },
        {
            "id": "item-apm-hosting-type",
            "name": "apm_hosting_type",
            "label": "Hosting / Delivery Model",
            "description": "Infrastructure hosting and deployment model.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["SaaS", "Public Cloud", "Private Cloud", "On-Premise", "Hybrid"],
            "default_value": "Public Cloud",
            "is_required": True,
            "section": "Technical Architecture & Fit",
            "sort_order": 12
        },
        {
            "id": "item-apm-architecture-type",
            "name": "apm_architecture_type",
            "label": "Architectural Pattern",
            "description": "Primary software pattern and architectural paradigm.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["SaaS Standard", "Microservices / Cloud Native", "3-Tier Web App", "Monolith / Client-Server", "Legacy Mainframe"],
            "default_value": "3-Tier Web App",
            "is_required": False,
            "section": "Technical Architecture & Fit",
            "sort_order": 13
        },

        # Section 5: Financials & TCO
        {
            "id": "item-apm-annual-cost",
            "name": "apm_annual_cost",
            "label": "Total Annual Cost / TCO (€)",
            "description": "Total annual cost of ownership (sum of licenses, cloud, maintenance, and internal labor).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "0",
            "is_required": True,
            "section": "Financials & TCO",
            "sort_order": 14
        },
        {
            "id": "item-apm-cost-software-licenses",
            "name": "apm_cost_software_licenses",
            "label": "Software Licenses & SaaS (€)",
            "description": "Annual expenses for software licenses, SaaS recurring subscriptions, and vendor packaging.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "0",
            "is_required": False,
            "section": "Financials & TCO",
            "sort_order": 15
        },
        {
            "id": "item-apm-cost-cloud-infrastructure",
            "name": "apm_cost_cloud_infrastructure",
            "label": "Cloud & Hosting Infrastructure (€)",
            "description": "Annual costs for IaaS, PaaS, database instances, storage, egress, and on-premise compute hosting.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "0",
            "is_required": False,
            "section": "Financials & TCO",
            "sort_order": 16
        },
        {
            "id": "item-apm-cost-vendor-maintenance",
            "name": "apm_cost_vendor_maintenance",
            "label": "Vendor Maintenance & AMS (€)",
            "description": "Third-party vendor maintenance contracts, Application Management Services (AMS), and external support SLAs.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "0",
            "is_required": False,
            "section": "Financials & TCO",
            "sort_order": 17
        },
        {
            "id": "item-apm-cost-internal-labor",
            "name": "apm_cost_internal_labor",
            "label": "Internal Operations & FTE Labor (€)",
            "description": "Estimated cost of internal IT personnel, DevOps, DBA, and application engineers allocated to this system.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "0",
            "is_required": False,
            "section": "Financials & TCO",
            "sort_order": 18
        },
        {
            "id": "item-apm-active-users",
            "name": "apm_active_users",
            "label": "Active Users Count",
            "description": "Number of regular active business or customer users accessing the application (used for unit cost per user).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "0",
            "is_required": False,
            "section": "Financials & TCO",
            "sort_order": 19
        },
        {
            "id": "item-apm-capex-ratio",
            "name": "apm_capex_ratio",
            "label": "CAPEX Ratio (%)",
            "description": "Percentage of application spending classified as Capital Expenditure (CAPEX) vs Operating Expense (OPEX).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "0",
            "is_required": False,
            "section": "Financials & TCO",
            "sort_order": 20
        },
        {
            "id": "item-apm-cost-type",
            "name": "apm_cost_type",
            "label": "Cost Model",
            "description": "Primary nature of application expenditure.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["OPEX (SaaS / Cloud Subscription)", "CAPEX (Perpetual License)", "Internal (In-house Development)"],
            "default_value": "OPEX (SaaS / Cloud Subscription)",
            "is_required": False,
            "section": "Financials & TCO",
            "sort_order": 21
        },

        # Section 6: Risk, Security & Compliance
        {
            "id": "item-apm-data-classification",
            "name": "apm_data_classification",
            "label": "Data Classification",
            "description": "Confidentiality classification of data processed by the application.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Public", "Internal", "Confidential", "Restricted / GDPR PII"],
            "default_value": "Internal",
            "is_required": False,
            "section": "Risk, Security & Compliance",
            "sort_order": 16
        },
        {
            "id": "item-apm-personal-data",
            "name": "apm_personal_data",
            "label": "Personal Data Processing (GDPR)",
            "description": "Indicates whether the application collects or processes personally identifiable information (PII) subject to GDPR.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "boolean",
            "options": [],
            "default_value": "false",
            "is_required": False,
            "section": "Risk, Security & Compliance",
            "sort_order": 17
        },
        {
            "id": "item-apm-sla-level",
            "name": "apm_sla_level",
            "label": "Service Level Agreement (SLA)",
            "description": "Contractually guaranteed service availability level.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Platinum (99.99%)", "Gold (99.9%)", "Silver (99.0%)", "Bronze (95.0%)"],
            "default_value": "Silver (99.0%)",
            "is_required": False,
            "section": "Risk, Security & Compliance",
            "sort_order": 18
        },
        {
            "id": "item-apm-rto-hours",
            "name": "apm_rto_hours",
            "label": "Recovery Time Objective (RTO)",
            "description": "Maximum tolerable downtime before application outage causes unacceptable business damage.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["< 1 hour", "< 4 hours", "< 24 hours", "> 24 hours / Best Effort"],
            "default_value": "< 4 hours",
            "is_required": False,
            "section": "Risk, Security & Compliance",
            "sort_order": 19
        },

        # Section 7: Technology Stack & Obsolescence (Target: Technology Layer)
        {
            "id": "item-apm-tech-vendor",
            "name": "tech_vendor",
            "label": "Technology Vendor / Provider",
            "description": "Hardware or software provider (e.g. Oracle, IBM, Red Hat, Microsoft, Apache Foundation, AWS, Google Cloud).",
            "element_type": "*",
            "layer": "Technology",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": False,
            "section": "Technology Lifecycle & Obsolescence",
            "sort_order": 20
        },
        {
            "id": "item-apm-tech-version",
            "name": "tech_version",
            "label": "Release / Version",
            "description": "Official software release or firmware version (e.g. 10.2.0.5, 8u202, 11g, 17 LTS, 3.6.1).",
            "element_type": "*",
            "layer": "Technology",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": False,
            "section": "Technology Lifecycle & Obsolescence",
            "sort_order": 21
        },
        {
            "id": "item-apm-tech-category",
            "name": "tech_category",
            "label": "Technology Category",
            "description": "Architectural classification of the technology component.",
            "element_type": "*",
            "layer": "Technology",
            "data_type": "select",
            "options": [
                "Database / RDBMS",
                "Runtime & Programming Language",
                "Middleware & Messaging",
                "Operating System",
                "Container & Kubernetes",
                "Application Server / Web Server",
                "Mainframe Software & OS",
                "Cloud Platform Service",
                "In-Memory Cache & NoSQL",
                "Virtualization & Cloud"
            ],
            "default_value": "Database / RDBMS",
            "is_required": False,
            "section": "Technology Lifecycle & Obsolescence",
            "sort_order": 22
        },
        {
            "id": "item-apm-tech-lifecycle-status",
            "name": "tech_lifecycle_status",
            "label": "Obsolescence Status",
            "description": "Current lifecycle support status from the technology vendor.",
            "element_type": "*",
            "layer": "Technology",
            "data_type": "select",
            "options": [
                "Supported",
                "Approaching EOL",
                "Extended Support",
                "End of Life / Obsolete"
            ],
            "default_value": "Supported",
            "is_required": False,
            "section": "Technology Lifecycle & Obsolescence",
            "sort_order": 23
        },
        {
            "id": "item-apm-tech-eol-date",
            "name": "tech_eol_date",
            "label": "End of Life Date (EOL)",
            "description": "Official date when regular vendor support, maintenance, and security patches ended or will end.",
            "element_type": "*",
            "layer": "Technology",
            "data_type": "date",
            "options": [],
            "default_value": None,
            "is_required": False,
            "section": "Technology Lifecycle & Obsolescence",
            "sort_order": 24
        },
        {
            "id": "item-apm-tech-eoes-date",
            "name": "tech_eoes_date",
            "label": "End of Extended Support (EOES)",
            "description": "Date when extended or custom support terminates completely.",
            "element_type": "*",
            "layer": "Technology",
            "data_type": "date",
            "options": [],
            "default_value": None,
            "is_required": False,
            "section": "Technology Lifecycle & Obsolescence",
            "sort_order": 25
        },
        {
            "id": "item-apm-tech-cve-risk",
            "name": "tech_cve_risk",
            "label": "Vulnerability / CVE Severity",
            "description": "Known security vulnerabilities or CVE exposure level due to obsolescence.",
            "element_type": "*",
            "layer": "Technology",
            "data_type": "select",
            "options": [
                "Low / Negligible",
                "Medium",
                "High",
                "Critical / Active Exploits"
            ],
            "default_value": "Low / Negligible",
            "is_required": False,
            "section": "Technology Lifecycle & Obsolescence",
            "sort_order": 26
        }
    ]

    for it in apm_items:
        existing_it = db.query(AttributePackageItem).filter(AttributePackageItem.id == it["id"]).first()
        if existing_it:
            for k, v in it.items():
                setattr(existing_it, k, v)
        else:
            db.add(AttributePackageItem(package_id=apm_pkg.id, **it))

    # Delete deprecated item-apm-in-scope if present
    db.query(AttributePackageItem).filter(AttributePackageItem.id == "item-apm-in-scope").delete(synchronize_session=False)

    # 2. Complete removal of deprecated pkg-tme and all tme_ attributes
    db.query(AttributePackageItem).filter(AttributePackageItem.name.like("tme_%")).delete(synchronize_session=False)
    db.query(WorkspaceAttributePackage).filter(WorkspaceAttributePackage.package_id == "pkg-tme").delete(synchronize_session=False)
    db.query(AttributePackage).filter(AttributePackage.id == "pkg-tme").delete(synchronize_session=False)

    # 2b. Clean up any package attributes erroneously duplicated in global CustomAttributeDefinition
    db.query(CustomAttributeDefinition).filter(
        (CustomAttributeDefinition.name.like("it4it_%")) |
        (CustomAttributeDefinition.name.like("bian_%")) |
        (CustomAttributeDefinition.name.like("apm_%")) |
        (CustomAttributeDefinition.name.like("tme_%")),
        CustomAttributeDefinition.model_id == None
    ).delete(synchronize_session=False)

    # 3. Ensure APM package is active on all existing model workspaces
    workspaces = db.query(ModelWorkspace).all()
    newly_linked_ws_ids = set()
    for ws in workspaces:
        has_link = db.query(WorkspaceAttributePackage).filter(
            WorkspaceAttributePackage.model_id == ws.id,
            WorkspaceAttributePackage.package_id == apm_pkg.id
        ).first()
        if not has_link:
            newly_linked_ws_ids.add(ws.id)
            db.add(WorkspaceAttributePackage(
                id=f"wap-{uuid.uuid4().hex[:8]}",
                model_id=ws.id,
                package_id=apm_pkg.id
            ))

    # 4. Data migration for ArchimateElement properties: tme_ / eea_ -> apm_
    def map_fit_score(val):
        if val is None or val == "":
            return "3 - Appropriate (Adeguata)"
        s = str(val).strip()
        if s.startswith("1"):
            return "1 - Unreasonable (Inadeguata)"
        elif s.startswith("2"):
            return "2 - Insufficient (Lacunosa)"
        elif s.startswith("4") or s.startswith("5"):
            return "4 - Perfect (Eccellente)"
        return "3 - Appropriate (Adeguata)"

    def map_tech_fit_score(val):
        if val is None or val == "":
            return "3 - Appropriate (Stabile/Standard)"
        s = str(val).strip()
        if s.startswith("1"):
            return "1 - Unreasonable (Obsoleta)"
        elif s.startswith("2"):
            return "2 - Insufficient (Debito Tecnico)"
        elif s.startswith("4") or s.startswith("5"):
            return "4 - Perfect (Cloud Native)"
        return "3 - Appropriate (Stabile/Standard)"

    elements = db.query(ArchimateElement).all()
    for elem in elements:
        if isinstance(elem.properties, dict) and elem.properties:
            updated = False
            props = dict(elem.properties)

            # Functional Fit migration
            old_b = props.pop("tme_business_fit", None) or props.pop("eea_business_fit", None)
            if old_b is not None and "apm_functional_fit" not in props:
                props["apm_functional_fit"] = map_fit_score(old_b)
                updated = True

            # Technical Fit migration
            old_t = props.pop("tme_technical_fit", None) or props.pop("eea_technical_fit", None)
            if old_t is not None and "apm_technical_fit" not in props:
                props["apm_technical_fit"] = map_tech_fit_score(old_t)
                updated = True

            # TIME Quadrant migration
            old_q = props.pop("tme_quadrant", None) or props.pop("eea_time_quadrant", None)
            if old_q is not None and "apm_time_quadrant_override" not in props:
                props["apm_time_quadrant_override"] = str(old_q)
                updated = True

            # Purge deprecated in_scope from properties
            if "apm_in_scope" in props:
                props.pop("apm_in_scope")
                updated = True
            if "eea_in_apm_scope" in props:
                props.pop("eea_in_apm_scope")
                updated = True

            # Other direct eea_ -> apm_ mappings
            for k in ["annual_cost", "business_criticality", "lifecycle_status", "business_owner", "technical_owner", "vendor", "hosting_type", "data_classification", "sla_level"]:
                eea_k = f"eea_{k}"
                apm_k = f"apm_{k}"
                if eea_k in props:
                    val = props.pop(eea_k)
                    if apm_k not in props:
                        props[apm_k] = val
                    updated = True

            if updated:
                elem.properties = props

        # If element is an ApplicationComponent with legacy in_apm_scope == True and no stereotype, assign stereo-business-app
        if elem.type == "ApplicationComponent":
            if not elem.stereotype_id or elem.stereotype_id == "stereo-enterprise-app":
                apm_rel = elem.apm_attributes
                if (apm_rel and apm_rel.in_apm_scope) or (elem.properties and elem.properties.get("apm_annual_cost")):
                    elem.stereotype_id = "stereo-business-app"
            elif elem.stereotype_id == "stereo-enterprise-app":
                elem.stereotype_id = "stereo-business-app"

    # 5. Remove legacy eea_ and tme_ system custom attribute definitions
    db.query(CustomAttributeDefinition).filter(
        (CustomAttributeDefinition.name.like("eea_%")) | (CustomAttributeDefinition.name.like("tme_%"))
    ).delete(synchronize_session=False)

    # 6. Default Business Views for APM (Application Portfolio Catalog, Lifecycle, Resilience, KPI)
    apm_views = [
        {
            "id": "pkv-apm-business-applications-catalog",
            "view_key": "apm_business_applications_catalog",
            "name": "Business Applications Catalog",
            "description": "Comprehensive enterprise business application portfolio inventory, covering ownership, lifecycle status, business criticality, delivery model, and TCO.",
            "category": "Portfolio Governance",
            "view_type": "table",
            "icon": "Layers",
            "sort_order": 1,
            "target_stereotypes": ["Business Application", "stereo-business-app"],
            "config": {
                "columns": [
                    { "field": "name", "label": "Application Name", "type": "string", "sortable": True },
                    { "field": "apm_app_code", "label": "App Code", "type": "badge", "filterable": True },
                    { "field": "apm_short_name", "label": "Short Name", "type": "string", "sortable": True },
                    { "field": "apm_lifecycle_status", "label": "Lifecycle Status", "type": "badge", "filterable": True },
                    { "field": "apm_business_criticality", "label": "Business Criticality", "type": "badge", "filterable": True },
                    { "field": "apm_functional_fit", "label": "Functional Fit", "type": "badge", "filterable": True },
                    { "field": "apm_technical_fit", "label": "Technical Fit", "type": "badge", "filterable": True },
                    { "field": "apm_annual_cost", "label": "Annual Cost (€)", "type": "currency", "sortable": True },
                    { "field": "apm_hosting_type", "label": "Hosting Model", "type": "enum", "filterable": True },
                    { "field": "apm_business_owner", "label": "Business Owner", "type": "string", "sortable": True },
                    { "field": "apm_technical_owner", "label": "Technical Owner", "type": "string", "sortable": True },
                    { "field": "apm_vendor", "label": "Vendor", "type": "string", "sortable": True }
                ],
                "default_sort": { "field": "name", "direction": "asc" },
                "filters": []
            }
        },
        {
            "id": "pkv-apm-executive-kpi",
            "view_key": "apm_executive_kpi",
            "name": "Executive Portfolio & TCO Dashboard",
            "description": "Aggregated governance KPIs, total application TCO, and distribution breakdowns by lifecycle status, business criticality, and hosting model.",
            "category": "Analytics & TCO",
            "view_type": "kpi_dashboard",
            "icon": "BarChart3",
            "sort_order": 2,
            "target_stereotypes": ["Business Application", "stereo-business-app"],
            "config": {
                "metrics": [
                    { "id": "total_apps", "label": "Total Business Applications", "type": "count" },
                    { "id": "total_tco", "label": "Total Annual TCO (€)", "type": "sum", "field": "apm_annual_cost" },
                    { "id": "mission_critical_count", "label": "Mission Critical Systems", "type": "count", "where": { "apm_business_criticality": "Mission Critical" } },
                    { "id": "cloud_hosted_count", "label": "Cloud & SaaS Solutions", "type": "count", "where": { "apm_hosting_type": ["SaaS", "Public Cloud"] } }
                ],
                "charts": [
                    { "id": "chart_by_lifecycle", "title": "Lifecycle Distribution", "type": "pie", "group_by": "apm_lifecycle_status" },
                    { "id": "chart_by_criticality", "title": "Business Criticality", "type": "bar", "group_by": "apm_business_criticality" },
                    { "id": "chart_by_hosting", "title": "Delivery Model", "type": "pie", "group_by": "apm_hosting_type" },
                    { "id": "chart_by_vendor", "title": "Top Vendors by Spend (€)", "type": "bar", "group_by": "apm_vendor", "metric": "sum", "metric_field": "apm_annual_cost" }
                ]
            }
        },
        {
            "id": "pkv-apm-time-matrix",
            "view_key": "apm_time_matrix",
            "name": "Gartner TIME Rationalization Matrix",
            "description": "Strategic 2x2 matrix of Gartner TIME quadrants (Invest, Tolerate, Migrate, Eliminate) for application rationalization, cost optimization, and technical debt reduction.",
            "category": "Portfolio Rationalization",
            "view_type": "matrix",
            "icon": "Grid",
            "sort_order": 3,
            "target_stereotypes": ["Business Application", "stereo-business-app"],
            "config": {
                "columns": [
                    { "field": "name", "label": "Application", "type": "string", "sortable": True },
                    { "field": "apm_app_code", "label": "Code", "type": "badge", "filterable": True },
                    { "field": "apm_short_name", "label": "Short Name", "type": "string", "sortable": True },
                    { "field": "computed_time_quadrant", "label": "TIME Quadrant", "type": "badge", "filterable": True },
                    { "field": "apm_functional_fit", "label": "Functional Fit", "type": "badge", "filterable": True },
                    { "field": "apm_technical_fit", "label": "Technical Fit", "type": "badge", "filterable": True },
                    { "field": "apm_annual_cost", "label": "TCO Cost (€)", "type": "currency", "sortable": True },
                    { "field": "apm_business_criticality", "label": "Criticality", "type": "badge", "filterable": True },
                    { "field": "apm_lifecycle_status", "label": "Lifecycle Status", "type": "badge", "filterable": True },
                    { "field": "apm_business_owner", "label": "Business Owner", "type": "string", "sortable": True }
                ],
                "default_sort": { "field": "apm_annual_cost", "direction": "desc" },
                "filters": []
            }
        },
        {
            "id": "pkv-apm-resilience-compliance",
            "view_key": "apm_resilience_compliance",
            "name": "Operational Resilience & Compliance (DORA/GDPR)",
            "description": "Regulatory compliance posture, disaster recovery SLA/RTO benchmarks, and data classification governance for security audits.",
            "category": "Risk & Compliance",
            "view_type": "table",
            "icon": "ShieldCheck",
            "sort_order": 4,
            "target_stereotypes": ["Business Application", "stereo-business-app"],
            "config": {
                "columns": [
                    { "field": "name", "label": "Application", "type": "string", "sortable": True },
                    { "field": "apm_business_criticality", "label": "Business Criticality", "type": "badge", "filterable": True },
                    { "field": "apm_data_classification", "label": "Data Classification", "type": "badge", "filterable": True },
                    { "field": "apm_personal_data", "label": "GDPR Personal Data", "type": "badge", "filterable": True },
                    { "field": "apm_sla_level", "label": "Target SLA", "type": "badge", "filterable": True },
                    { "field": "apm_rto_hours", "label": "Target RTO", "type": "badge", "filterable": True },
                    { "field": "apm_hosting_type", "label": "Hosting Model", "type": "enum", "filterable": True }
                ],
                "default_sort": { "field": "apm_business_criticality", "direction": "asc" },
                "filters": []
            }
        },
        {
            "id": "pkv-apm-lifecycle-roadmap",
            "view_key": "apm_lifecycle_roadmap",
            "name": "Lifecycle & Obsolescence Roadmap",
            "description": "Timeline tracking of production applications, retirement scheduling, and technical debt governance to mitigate end-of-support risks.",
            "category": "Lifecycle & Roadmap",
            "view_type": "table",
            "icon": "Clock",
            "sort_order": 5,
            "target_stereotypes": ["Business Application", "stereo-business-app"],
            "config": {
                "columns": [
                    { "field": "name", "label": "Application", "type": "string", "sortable": True },
                    { "field": "apm_app_code", "label": "Code", "type": "badge", "filterable": True },
                    { "field": "apm_short_name", "label": "Short Name", "type": "string", "sortable": True },
                    { "field": "apm_lifecycle_status", "label": "Current Status", "type": "badge", "filterable": True },
                    { "field": "obsolescence_risk", "label": "Obsolescence Risk", "type": "badge", "filterable": True },
                    { "field": "apm_live_date", "label": "Go-Live Date", "type": "string", "sortable": True },
                    { "field": "apm_retirement_date", "label": "Planned Retirement", "type": "string", "sortable": True },
                    { "field": "apm_technical_fit", "label": "Technical Quality / Fit", "type": "badge", "filterable": True },
                    { "field": "apm_time_quadrant_override", "label": "TIME Strategy", "type": "badge", "filterable": True },
                    { "field": "apm_vendor", "label": "Vendor / Maintainer", "type": "string", "sortable": True }
                ],
                "default_sort": { "field": "apm_retirement_date", "direction": "asc" },
                "filters": []
            }
        }
    ]

    for v_data in apm_views:
        existing_v = db.query(PackageView).filter(PackageView.id == v_data["id"]).first()
        if not existing_v:
            v = PackageView(
                id=v_data["id"],
                package_id=apm_pkg.id,
                view_key=v_data["view_key"],
                name=v_data["name"],
                description=v_data["description"],
                category=v_data["category"],
                view_type=v_data["view_type"],
                icon=v_data["icon"],
                sort_order=v_data.get("sort_order", 0),
                target_hub=v_data.get("target_hub", "business"),
                target_stereotypes=v_data["target_stereotypes"],
                config=v_data["config"]
            )
            db.add(v)
        else:
            existing_v.name = v_data["name"]
            existing_v.description = v_data["description"]
            existing_v.category = v_data["category"]
            existing_v.view_type = v_data["view_type"]
            existing_v.icon = v_data["icon"]
            existing_v.sort_order = v_data.get("sort_order", 0)
            if not getattr(existing_v, "target_hub", None):
                existing_v.target_hub = v_data.get("target_hub", "business")
            existing_v.target_stereotypes = v_data["target_stereotypes"]
            existing_v.config = v_data["config"]

    # 6b. Architecture Decision Records (ADR) System Package (pkg-adr)
    adr_pkg = db.query(AttributePackage).filter(AttributePackage.id == "pkg-adr").first()
    created_adr_pkg = False
    if not adr_pkg:
        adr_pkg = AttributePackage(
            id="pkg-adr",
            code="adr",
            name="Architecture Decision Records (ADR)",
            version="1.0.0",
            author="EasyEA Governance",
            license="Open Standard (MADR 3.0)",
            description="Standard MADR 3.0 Architecture Decision Records package providing the «Architecture Decision» Motivation stereotype, governance attributes, and ADR views.",
            icon_color="indigo",
            package_type="attribute_only",
            standard_version="MADR 3.0",
            is_default_active=True,
            is_system=True
        )
        db.add(adr_pkg)
        db.flush()
        created_adr_pkg = True
    else:
        adr_pkg.code = "adr"
        adr_pkg.name = "Architecture Decision Records (ADR)"
        adr_pkg.version = "1.0.0"
        adr_pkg.author = "EasyEA Governance"
        adr_pkg.license = "Open Standard (MADR 3.0)"
        adr_pkg.description = "Standard MADR 3.0 Architecture Decision Records package providing the «Architecture Decision» Motivation stereotype, governance attributes, and ADR views."
        adr_pkg.icon_color = "indigo"
        adr_pkg.package_type = "attribute_only"
        adr_pkg.standard_version = "MADR 3.0"
        adr_pkg.is_default_active = True
        adr_pkg.is_system = True

    adr_items = [
        {
            "id": "item-adr-code",
            "name": "adr_code",
            "label": "ADR Code",
            "description": "Unique sequential Architecture Decision Record identifier (e.g. ADR-0001).",
            "element_type": "Assessment",
            "layer": "Motivation",
            "data_type": "string",
            "options": [],
            "default_value": None,
            "is_required": True,
            "section": "ADR Identification",
            "sort_order": 1
        },
        {
            "id": "item-adr-status",
            "name": "adr_status",
            "label": "Decision Status",
            "description": "Lifecycle status of the Architecture Decision Record.",
            "element_type": "Assessment",
            "layer": "Motivation",
            "data_type": "select",
            "options": ["Draft", "Proposed", "Accepted", "Rejected", "Deprecated", "Superseded"],
            "default_value": "Draft",
            "is_required": True,
            "section": "ADR Identification",
            "sort_order": 2
        },
        {
            "id": "item-adr-domain",
            "name": "adr_domain",
            "label": "Architectural Domain",
            "description": "Primary enterprise architecture domain impacted by the decision.",
            "element_type": "Assessment",
            "layer": "Motivation",
            "data_type": "select",
            "options": ["Strategy", "Business", "Application", "Data", "Technology", "Security", "Integration", "Governance"],
            "default_value": "Application",
            "is_required": True,
            "section": "ADR Identification",
            "sort_order": 3
        },
        {
            "id": "item-adr-deciders",
            "name": "adr_deciders",
            "label": "Deciders / Architecture Board",
            "description": "Stakeholders, architects, or governance boards responsible for the decision.",
            "element_type": "Assessment",
            "layer": "Motivation",
            "data_type": "string",
            "options": [],
            "default_value": None,
            "is_required": False,
            "section": "ADR Governance",
            "sort_order": 4
        },
        {
            "id": "item-adr-decided-at",
            "name": "adr_decided_at",
            "label": "Decision Date",
            "description": "Date when the decision was formally accepted or ratified.",
            "element_type": "Assessment",
            "layer": "Motivation",
            "data_type": "date",
            "options": [],
            "default_value": None,
            "is_required": False,
            "section": "ADR Governance",
            "sort_order": 5
        },
        {
            "id": "item-adr-outcome",
            "name": "adr_decision_outcome",
            "label": "Decision Outcome",
            "description": "Chosen architectural option and core justification.",
            "element_type": "Assessment",
            "layer": "Motivation",
            "data_type": "string",
            "options": [],
            "default_value": None,
            "is_required": False,
            "section": "ADR Rationale",
            "sort_order": 6
        },
        {
            "id": "item-adr-compliance",
            "name": "adr_compliance_impact",
            "label": "Compliance & Security Impact",
            "description": "Regulatory, security, or operational resilience impact (e.g. DORA, GDPR, ISO 27001).",
            "element_type": "Assessment",
            "layer": "Motivation",
            "data_type": "string",
            "options": [],
            "default_value": None,
            "is_required": False,
            "section": "ADR Governance",
            "sort_order": 7
        },
        {
            "id": "item-adr-superseded-by",
            "name": "adr_superseded_by",
            "label": "Superseded By ADR",
            "description": "Code of the newer ADR that supersedes this decision.",
            "element_type": "Assessment",
            "layer": "Motivation",
            "data_type": "string",
            "options": [],
            "default_value": None,
            "is_required": False,
            "section": "ADR Governance",
            "sort_order": 8
        }
    ]

    for it in adr_items:
        existing_it = db.query(AttributePackageItem).filter(AttributePackageItem.id == it["id"]).first()
        if existing_it:
            for k, v in it.items():
                setattr(existing_it, k, v)
        else:
            db.add(AttributePackageItem(package_id=adr_pkg.id, **it))

    # Ensure ADR package is active on existing workspaces when first seeded or for newly created workspaces
    for ws in workspaces:
        if created_adr_pkg or ws.id in newly_linked_ws_ids:
            has_adr_link = db.query(WorkspaceAttributePackage).filter(
                WorkspaceAttributePackage.model_id == ws.id,
                WorkspaceAttributePackage.package_id == adr_pkg.id
            ).first()
            if not has_adr_link:
                db.add(WorkspaceAttributePackage(
                    id=f"wap-{uuid.uuid4().hex[:8]}",
                    model_id=ws.id,
                    package_id=adr_pkg.id
                ))

    adr_views = [
        {
            "id": "pkv-adr-registry",
            "view_key": "adr_governance_registry",
            "name": "Architecture Decision Records (ADR)",
            "description": "Interactive MADR 3.0 Architecture Decision Records registry, options analysis, superseding chains, and governance workflow.",
            "category": "Architecture Governance",
            "view_type": "adr_manager",
            "icon": "Scale",
            "sort_order": 1,
            "target_hub": "architecture",
            "target_stereotypes": ["Architecture Decision", "stereo-adr"],
            "target_types": ["Assessment"],
            "config": {}
        },
        {
            "id": "pkv-adr-elements-table",
            "view_key": "adr_elements_catalog",
            "name": "ADR Catalog & Matrix View",
            "description": "Tabular and analytical view of «Architecture Decision» elements in the ArchiMate Motivation layer.",
            "category": "Architecture Governance",
            "view_type": "table",
            "icon": "Table",
            "sort_order": 2,
            "target_hub": "architecture",
            "target_stereotypes": ["Architecture Decision", "stereo-adr"],
            "target_types": ["Assessment"],
            "config": {
                "columns": [
                    { "field": "adr_code", "label": "ADR Code", "type": "badge", "sortable": True, "filterable": True },
                    { "field": "name", "label": "Decision Title", "type": "string", "sortable": True },
                    { "field": "adr_status", "label": "Status", "type": "badge", "filterable": True },
                    { "field": "adr_domain", "label": "Domain", "type": "badge", "filterable": True },
                    { "field": "adr_deciders", "label": "Deciders", "type": "string", "sortable": True },
                    { "field": "adr_decision_outcome", "label": "Decision Outcome", "type": "string", "sortable": False }
                ],
                "default_sort": { "field": "adr_code", "direction": "asc" },
                "filters": []
            }
        }
    ]

    for v_data in adr_views:
        existing_v = db.query(PackageView).filter(PackageView.id == v_data["id"]).first()
        if not existing_v:
            v = PackageView(
                id=v_data["id"],
                package_id=adr_pkg.id,
                view_key=v_data["view_key"],
                name=v_data["name"],
                description=v_data["description"],
                category=v_data["category"],
                view_type=v_data["view_type"],
                icon=v_data["icon"],
                sort_order=v_data.get("sort_order", 0),
                target_hub=v_data.get("target_hub", "architecture"),
                target_stereotypes=v_data["target_stereotypes"],
                target_types=v_data.get("target_types", []),
                config=v_data["config"]
            )
            db.add(v)
        else:
            existing_v.name = v_data["name"]
            existing_v.description = v_data["description"]
            existing_v.category = v_data["category"]
            existing_v.view_type = v_data["view_type"]
            existing_v.icon = v_data["icon"]
            existing_v.sort_order = v_data.get("sort_order", 0)
            existing_v.target_hub = v_data.get("target_hub", "architecture")
            existing_v.target_stereotypes = v_data["target_stereotypes"]
            existing_v.target_types = v_data.get("target_types", [])
            existing_v.config = v_data["config"]

    # 6c. Operational Resilience & SLA (DORA) System Package (pkg-resilience)
    res_pkg = db.query(AttributePackage).filter(AttributePackage.id == "pkg-resilience").first()
    if not res_pkg:
        res_pkg = AttributePackage(
            id="pkg-resilience",
            code="resilience",
            name="Operational Resilience & SLA (DORA)",
            version="1.0.0",
            author="EasyEA Governance & Resilience",
            license="Open Standard (DORA / ISO 22301)",
            description="Enterprise resilience package providing operational continuity attributes (RTO, RPO, SLA Availability) and automatic mismatch analysis across Business, Application, and Technology layers.",
            icon_color="emerald",
            package_type="attribute_only",
            standard_version="DORA / ISO 22301",
            is_default_active=False,
            is_system=True
        )
        db.add(res_pkg)
        db.flush()
    else:
        res_pkg.code = "resilience"
        res_pkg.name = "Operational Resilience & SLA (DORA)"
        res_pkg.version = "1.0.0"
        res_pkg.author = "EasyEA Governance & Resilience"
        res_pkg.license = "Open Standard (DORA / ISO 22301)"
        res_pkg.description = "Enterprise resilience package providing operational continuity attributes (RTO, RPO, SLA Availability) and automatic mismatch analysis across Business, Application, and Technology layers."
        res_pkg.icon_color = "emerald"
        res_pkg.package_type = "attribute_only"
        res_pkg.standard_version = "DORA / ISO 22301"
        res_pkg.is_default_active = False
        res_pkg.is_system = True

    res_items = [
        # Business Layer
        {
            "id": "item-res-criticality",
            "name": "resilience_criticality",
            "label": "Resilience Tier",
            "description": "Business continuity criticality tier defining recovery priority.",
            "element_type": "BusinessProcess",
            "layer": "Business",
            "data_type": "select",
            "options": ["Tier-1 (Mission Critical)", "Tier-2 (Business Critical)", "Tier-3 (Important)", "Tier-4 (Non-critical)"],
            "default_value": "Tier-2 (Business Critical)",
            "is_required": False,
            "section": "Operational Resilience Target",
            "sort_order": 1
        },
        {
            "id": "item-res-target-rto",
            "name": "target_rto_hours",
            "label": "Target RTO (Hours)",
            "description": "Recovery Time Objective: maximum acceptable duration of downtime before service restoration.",
            "element_type": "BusinessProcess",
            "layer": "Business",
            "data_type": "number",
            "options": [],
            "default_value": "4.0",
            "is_required": False,
            "section": "Operational Resilience Target",
            "sort_order": 2
        },
        {
            "id": "item-res-target-rpo",
            "name": "target_rpo_hours",
            "label": "Target RPO (Hours)",
            "description": "Recovery Point Objective: maximum acceptable data loss measured in hours of transactions.",
            "element_type": "BusinessProcess",
            "layer": "Business",
            "data_type": "number",
            "options": [],
            "default_value": "1.0",
            "is_required": False,
            "section": "Operational Resilience Target",
            "sort_order": 3
        },
        {
            "id": "item-res-target-sla",
            "name": "target_sla_availability",
            "label": "Target SLA Availability (%)",
            "description": "Minimum contractual or operational service availability percentage (e.g. 99.90%).",
            "element_type": "BusinessProcess",
            "layer": "Business",
            "data_type": "number",
            "options": [],
            "default_value": "99.90",
            "is_required": False,
            "section": "Operational Resilience Target",
            "sort_order": 4
        },
        {
            "id": "item-res-dora-flag",
            "name": "dora_critical_function",
            "label": "DORA Critical Function",
            "description": "Designates whether this process/service qualifies as a critical or important operational function under DORA / NIS2.",
            "element_type": "BusinessProcess",
            "layer": "Business",
            "data_type": "boolean",
            "options": [],
            "default_value": "false",
            "is_required": False,
            "section": "Regulatory Compliance (DORA/NIS2)",
            "sort_order": 5
        },
        # Application Layer
        {
            "id": "item-res-app-sla",
            "name": "app_sla_availability",
            "label": "Offered App SLA (%)",
            "description": "Application software or vendor contract uptime availability percentage.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "99.50",
            "is_required": False,
            "section": "Application Reliability & DR",
            "sort_order": 6
        },
        {
            "id": "item-res-app-rto",
            "name": "app_rto_hours",
            "label": "App RTO (Hours)",
            "description": "Estimated application service restoration or failover time.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "2.0",
            "is_required": False,
            "section": "Application Reliability & DR",
            "sort_order": 7
        },
        {
            "id": "item-res-app-rpo",
            "name": "app_rpo_hours",
            "label": "App RPO (Hours)",
            "description": "Application data synchronization or local backup interval.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "1.0",
            "is_required": False,
            "section": "Application Reliability & DR",
            "sort_order": 8
        },
        {
            "id": "item-res-dr-strategy",
            "name": "dr_strategy",
            "label": "DR Strategy",
            "description": "Disaster Recovery and high-availability architecture pattern implemented.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Active-Active Multi-Region", "Active-Passive Automated", "Warm Standby", "Cold Standby / Backup Restore"],
            "default_value": "Active-Passive Automated",
            "is_required": False,
            "section": "Application Reliability & DR",
            "sort_order": 9
        },
        # Technology Layer
        {
            "id": "item-res-infra-sla",
            "name": "infra_sla_availability",
            "label": "Infrastructure SLA (%)",
            "description": "Cloud provider, datacenter or server hardware SLA availability percentage.",
            "element_type": "Node",
            "layer": "Technology",
            "data_type": "number",
            "options": [],
            "default_value": "99.90",
            "is_required": False,
            "section": "Infrastructure Resilience",
            "sort_order": 10
        },
        {
            "id": "item-res-infra-rto",
            "name": "infra_rto_hours",
            "label": "Infra RTO (Hours)",
            "description": "Infrastructure hardware or cloud VM rebuild/reboot recovery time.",
            "element_type": "Node",
            "layer": "Technology",
            "data_type": "number",
            "options": [],
            "default_value": "1.0",
            "is_required": False,
            "section": "Infrastructure Resilience",
            "sort_order": 11
        },
        {
            "id": "item-res-infra-rpo",
            "name": "infra_rpo_hours",
            "label": "Storage / Snapshot RPO (Hours)",
            "description": "Storage block-level replication frequency or automated snapshot frequency.",
            "element_type": "Node",
            "layer": "Technology",
            "data_type": "number",
            "options": [],
            "default_value": "1.0",
            "is_required": False,
            "section": "Infrastructure Resilience",
            "sort_order": 12
        },
        {
            "id": "item-res-ha-redundancy",
            "name": "ha_redundancy",
            "label": "HA Redundancy",
            "description": "Physical hosting failure domain redundancy level.",
            "element_type": "Node",
            "layer": "Technology",
            "data_type": "select",
            "options": ["Single Zone (No HA)", "Multi-AZ Redundant", "Multi-Region Geo-Replicated"],
            "default_value": "Multi-AZ Redundant",
            "is_required": False,
            "section": "Infrastructure Resilience",
            "sort_order": 13
        }
    ]

    for it_data in res_items:
        existing_it = db.query(AttributePackageItem).filter(AttributePackageItem.id == it_data["id"]).first()
        if not existing_it:
            item = AttributePackageItem(
                id=it_data["id"],
                package_id=res_pkg.id,
                name=it_data["name"],
                label=it_data["label"],
                description=it_data["description"],
                element_type=it_data["element_type"],
                layer=it_data["layer"],
                data_type=it_data["data_type"],
                options=it_data["options"],
                default_value=it_data["default_value"],
                is_required=it_data["is_required"],
                section=it_data["section"],
                sort_order=it_data["sort_order"]
            )
            db.add(item)
        else:
            existing_it.name = it_data["name"]
            existing_it.label = it_data["label"]
            existing_it.description = it_data["description"]
            existing_it.element_type = it_data["element_type"]
            existing_it.layer = it_data["layer"]
            existing_it.data_type = it_data["data_type"]
            existing_it.options = it_data["options"]
            existing_it.default_value = it_data["default_value"]
            existing_it.is_required = it_data["is_required"]
            existing_it.section = it_data["section"]
            existing_it.sort_order = it_data["sort_order"]

    res_views = [
        {
            "id": "pview-resilience-dashboard",
            "view_key": "resilience_dashboard",
            "name": "Operational Resilience & SLA Gaps",
            "description": "Interactive mismatch engine and audit dashboard comparing business RTO/RPO/SLA targets against application and infrastructure capabilities.",
            "category": "Governance & Resilience",
            "view_type": "resilience_dashboard",
            "icon": "ShieldAlert",
            "sort_order": 1,
            "target_hub": "both",
            "target_stereotypes": [],
            "target_types": ["BusinessProcess", "BusinessService", "ApplicationComponent", "Node"],
            "config": {}
        },
        {
            "id": "pview-resilience-matrix",
            "view_key": "resilience_matrix",
            "name": "Resilience & DORA Tier Matrix",
            "description": "Tabular matrix of Business Processes with critical tiers, recovery objectives and technical supply chain status.",
            "category": "Governance & Resilience",
            "view_type": "table",
            "icon": "Table",
            "sort_order": 2,
            "target_hub": "business",
            "target_stereotypes": [],
            "target_types": ["BusinessProcess", "BusinessService"],
            "config": {
                "columns": [
                    { "field": "name", "label": "Process Name", "type": "string", "sortable": True },
                    { "field": "resilience_criticality", "label": "Criticality Tier", "type": "badge", "filterable": True },
                    { "field": "target_sla_availability", "label": "Target SLA (%)", "type": "number", "sortable": True },
                    { "field": "target_rto_hours", "label": "Target RTO (h)", "type": "number", "sortable": True },
                    { "field": "target_rpo_hours", "label": "Target RPO (h)", "type": "number", "sortable": True },
                    { "field": "dora_critical_function", "label": "DORA Critical", "type": "boolean", "filterable": True }
                ],
                "default_sort": { "field": "resilience_criticality", "direction": "asc" },
                "filters": []
            }
        }
    ]

    for v_data in res_views:
        existing_v = db.query(PackageView).filter(PackageView.id == v_data["id"]).first()
        if not existing_v:
            v = PackageView(
                id=v_data["id"],
                package_id=res_pkg.id,
                view_key=v_data["view_key"],
                name=v_data["name"],
                description=v_data["description"],
                category=v_data["category"],
                view_type=v_data["view_type"],
                icon=v_data["icon"],
                sort_order=v_data.get("sort_order", 0),
                target_hub=v_data.get("target_hub", "both"),
                target_stereotypes=v_data["target_stereotypes"],
                target_types=v_data.get("target_types", []),
                config=v_data["config"]
            )
            db.add(v)
        else:
            existing_v.name = v_data["name"]
            existing_v.description = v_data["description"]
            existing_v.category = v_data["category"]
            existing_v.view_type = v_data["view_type"]
            existing_v.icon = v_data["icon"]
            existing_v.sort_order = v_data.get("sort_order", 0)
            if not getattr(existing_v, "target_hub", None):
                existing_v.target_hub = v_data.get("target_hub", "both")
            existing_v.target_stereotypes = v_data["target_stereotypes"]
            existing_v.target_types = v_data.get("target_types", [])
            existing_v.config = v_data["config"]

    # 6d. As-Is vs To-Be Gap Analysis & Transition Plateaus System Package (pkg-gap-analysis)
    gap_pkg = db.query(AttributePackage).filter(AttributePackage.id == "pkg-gap-analysis").first()
    if not gap_pkg:
        gap_pkg = AttributePackage(
            id="pkg-gap-analysis",
            code="gap_analysis",
            name="As-Is vs To-Be Gap Analysis & Transition Plateaus",
            version="1.0.0",
            author="EasyEA Architecture Governance",
            license="Open Standard (TOGAF / ArchiMate 3.2)",
            description="Enterprise Architecture Gap Analysis package comparing Baseline (As-Is), Transition Plateaus, and Target (To-Be) architectures with change categorization (Retained, Added, Modified, Retired) and financial delta.",
            icon_color="blue",
            package_type="attribute_only",
            standard_version="TOGAF ADM / ArchiMate 3.2",
            is_default_active=False,
            is_system=True
        )
        db.add(gap_pkg)
        db.flush()
    else:
        gap_pkg.code = "gap_analysis"
        gap_pkg.name = "As-Is vs To-Be Gap Analysis & Transition Plateaus"
        gap_pkg.version = "1.0.0"
        gap_pkg.author = "EasyEA Architecture Governance"
        gap_pkg.license = "Open Standard (TOGAF / ArchiMate 3.2)"
        gap_pkg.description = "Enterprise Architecture Gap Analysis package comparing Baseline (As-Is), Transition Plateaus, and Target (To-Be) architectures with change categorization (Retained, Added, Modified, Retired) and financial delta."
        gap_pkg.icon_color = "blue"
        gap_pkg.package_type = "attribute_only"
        gap_pkg.standard_version = "TOGAF ADM / ArchiMate 3.2"
        gap_pkg.is_default_active = False
        gap_pkg.is_system = True

    gap_items = [
        {
            "id": "item-gap-horizon",
            "name": "architecture_horizon",
            "label": "Architecture Horizon",
            "description": "Lifecycle state of the element across architectural transition stages.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["As-Is (Current)", "Transition Plateau", "To-Be (Target)", "Persistent (Both)"],
            "default_value": "Persistent (Both)",
            "is_required": False,
            "section": "Architecture Lifecycle & Transition",
            "sort_order": 1
        },
        {
            "id": "item-gap-action",
            "name": "gap_action",
            "label": "Gap Action",
            "description": "Classification of the architectural change required to reach the target state.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "select",
            "options": ["Retain", "Add / Introduce", "Modify / Migrate", "Retire / Decommission"],
            "default_value": "Retain",
            "is_required": False,
            "section": "Architecture Lifecycle & Transition",
            "sort_order": 2
        },
        {
            "id": "item-gap-target-plateau",
            "name": "target_plateau",
            "label": "Target Plateau / Release",
            "description": "Destination architecture plateau or release timeframe for this transformation.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "Target Architecture",
            "is_required": False,
            "section": "Architecture Lifecycle & Transition",
            "sort_order": 3
        },
        {
            "id": "item-gap-cost-impact",
            "name": "transition_cost_impact",
            "label": "Financial Cost Delta (€/year)",
            "description": "Estimated cost variation (positive = added run cost, negative = retirement savings).",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "number",
            "options": [],
            "default_value": "0.0",
            "is_required": False,
            "section": "Financial & Migration Impact",
            "sort_order": 4
        },
        {
            "id": "item-gap-work-package",
            "name": "work_package_ref",
            "label": "Associated Work Package / Project",
            "description": "Reference to the strategic initiative, epic or work package delivering this change.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "string",
            "options": [],
            "default_value": "",
            "is_required": False,
            "section": "Financial & Migration Impact",
            "sort_order": 5
        },
        {
            "id": "item-gap-rationale",
            "name": "migration_rationale",
            "label": "Transition Rationale",
            "description": "Strategic, operational or architectural drivers justifying this lifecycle transition.",
            "element_type": "ApplicationComponent",
            "layer": "Application",
            "data_type": "text",
            "options": [],
            "default_value": "",
            "is_required": False,
            "section": "Financial & Migration Impact",
            "sort_order": 6
        }
    ]

    for it_data in gap_items:
        existing_it = db.query(AttributePackageItem).filter(AttributePackageItem.id == it_data["id"]).first()
        if not existing_it:
            item = AttributePackageItem(
                id=it_data["id"],
                package_id=gap_pkg.id,
                name=it_data["name"],
                label=it_data["label"],
                description=it_data["description"],
                element_type=it_data["element_type"],
                layer=it_data["layer"],
                data_type=it_data["data_type"],
                options=it_data["options"],
                default_value=it_data["default_value"],
                is_required=it_data["is_required"],
                section=it_data["section"],
                sort_order=it_data["sort_order"]
            )
            db.add(item)
        else:
            existing_it.name = it_data["name"]
            existing_it.label = it_data["label"]
            existing_it.description = it_data["description"]
            existing_it.element_type = it_data["element_type"]
            existing_it.layer = it_data["layer"]
            existing_it.data_type = it_data["data_type"]
            existing_it.options = it_data["options"]
            existing_it.default_value = it_data["default_value"]
            existing_it.is_required = it_data["is_required"]
            existing_it.section = it_data["section"]
            existing_it.sort_order = it_data["sort_order"]

    gap_views = [
        {
            "id": "pview-gap-analysis-matrix",
            "view_key": "gap_matrix",
            "name": "As-Is vs To-Be Gap Analysis Matrix",
            "description": "Interactive matrix and detailed register comparing Baseline, Transition, and Target states with financial delta, swimlanes, and work package coverage.",
            "category": "Strategy & Transformation",
            "view_type": "gap_matrix",
            "icon": "ArrowRightLeft",
            "sort_order": 1,
            "target_hub": "both",
            "target_stereotypes": [],
            "target_types": ["BusinessProcess", "BusinessService", "ApplicationComponent", "Node", "Plateau"],
            "config": {}
        }
    ]

    # Clean up redundant legacy table view if present
    db.query(PackageView).filter(PackageView.id == "pview-gap-analysis-table").delete(synchronize_session=False)

    for v_data in gap_views:
        existing_v = db.query(PackageView).filter(PackageView.id == v_data["id"]).first()
        if not existing_v:
            v = PackageView(
                id=v_data["id"],
                package_id=gap_pkg.id,
                view_key=v_data["view_key"],
                name=v_data["name"],
                description=v_data["description"],
                category=v_data["category"],
                view_type=v_data["view_type"],
                icon=v_data["icon"],
                sort_order=v_data.get("sort_order", 0),
                target_hub=v_data.get("target_hub", "both"),
                target_stereotypes=v_data["target_stereotypes"],
                target_types=v_data.get("target_types", []),
                config=v_data["config"]
            )
            db.add(v)
        else:
            existing_v.name = v_data["name"]
            existing_v.description = v_data["description"]
            existing_v.category = v_data["category"]
            existing_v.view_type = v_data["view_type"]
            existing_v.icon = v_data["icon"]
            existing_v.sort_order = v_data.get("sort_order", 0)
            if not getattr(existing_v, "target_hub", None):
                existing_v.target_hub = v_data.get("target_hub", "both")
            existing_v.target_stereotypes = v_data["target_stereotypes"]
            existing_v.target_types = v_data.get("target_types", [])
            existing_v.config = v_data["config"]

    # 6e. Business Process & BPMN 2.0 Automation System Package (pkg-bpmn)
    bpmn_pkg = db.query(AttributePackage).filter(AttributePackage.id == "pkg-bpmn").first()
    if not bpmn_pkg:
        bpmn_pkg = AttributePackage(
            id="pkg-bpmn",
            code="bpmn",
            name="Business Process & BPMN 2.0 Automation",
            version="1.0.0",
            author="EasyEA Process & Automation Lab",
            license="Open Standard (BPMN 2.0 / ArchiMate 3.x Specialization)",
            description="BPMN 2.0 execution and automation package extending ArchiMate Business Processes with specialized task stereotypes (UserTask, ServiceTask, ScriptTask, ManualTask, BusinessRuleTask, AIAgentTask) and operational maturity attributes.",
            icon_color="cyan",
            package_type="attribute_only",
            standard_version="BPMN 2.0 / ArchiMate 3.2",
            is_default_active=True,
            is_system=True
        )
        db.add(bpmn_pkg)
        db.flush()
    else:
        bpmn_pkg.code = "bpmn"
        bpmn_pkg.name = "Business Process & BPMN 2.0 Automation"
        bpmn_pkg.version = "1.0.0"
        bpmn_pkg.author = "EasyEA Process & Automation Lab"
        bpmn_pkg.license = "Open Standard (BPMN 2.0 / ArchiMate 3.x Specialization)"
        bpmn_pkg.description = "BPMN 2.0 execution and automation package extending ArchiMate Business Processes with specialized task stereotypes (UserTask, ServiceTask, ScriptTask, ManualTask, BusinessRuleTask, AIAgentTask) and operational maturity attributes."
        bpmn_pkg.icon_color = "cyan"
        bpmn_pkg.package_type = "attribute_only"
        bpmn_pkg.standard_version = "BPMN 2.0 / ArchiMate 3.2"
        bpmn_pkg.is_default_active = True
        bpmn_pkg.is_system = True

    bpmn_items = [
        {
            "id": "item-bpmn-automation-level",
            "name": "bpmn_automation_level",
            "label": "Automation Level",
            "description": "Execution automation maturity: Full Automated, Semi-Automated, Manual, or AI-Assisted.",
            "element_type": "BusinessProcess",
            "layer": "Business",
            "data_type": "select",
            "options": ["Full Automated", "Semi-Automated", "Manual", "AI-Assisted"],
            "default_value": "Semi-Automated",
            "is_required": False,
            "section": "Process Automation & Execution",
            "sort_order": 1
        },
        {
            "id": "item-bpmn-cycle-time",
            "name": "bpmn_cycle_time_minutes",
            "label": "Avg Cycle Time (Minutes)",
            "description": "Average duration in minutes to complete this process step.",
            "element_type": "BusinessProcess",
            "layer": "Business",
            "data_type": "number",
            "options": [],
            "default_value": "15.0",
            "is_required": False,
            "section": "Process Automation & Execution",
            "sort_order": 2
        },
        {
            "id": "item-bpmn-monthly-volume",
            "name": "bpmn_execution_volume_month",
            "label": "Monthly Execution Volume",
            "description": "Estimated or measured number of transactions/executions per month.",
            "element_type": "BusinessProcess",
            "layer": "Business",
            "data_type": "number",
            "options": [],
            "default_value": "1000",
            "is_required": False,
            "section": "Process Automation & Execution",
            "sort_order": 3
        },
        {
            "id": "item-bpmn-rework-rate",
            "name": "bpmn_error_rework_rate_pct",
            "label": "Error / Rework Rate (%)",
            "description": "Percentage of executions requiring human correction, rollback, or rework.",
            "element_type": "BusinessProcess",
            "layer": "Business",
            "data_type": "number",
            "options": [],
            "default_value": "2.0",
            "is_required": False,
            "section": "Process Automation & Execution",
            "sort_order": 4
        }
    ]

    for item in bpmn_items:
        existing_item = db.query(AttributePackageItem).filter(AttributePackageItem.id == item["id"]).first()
        if not existing_item:
            db.add(AttributePackageItem(
                id=item["id"],
                package_id="pkg-bpmn",
                name=item["name"],
                label=item["label"],
                description=item["description"],
                element_type=item["element_type"],
                layer=item["layer"],
                data_type=item["data_type"],
                options=item["options"],
                default_value=item["default_value"],
                is_required=item["is_required"],
                section=item["section"],
                sort_order=item["sort_order"]
            ))
        else:
            existing_item.label = item["label"]
            existing_item.description = item["description"]
            existing_item.data_type = item["data_type"]
            existing_item.options = item["options"]
            existing_item.default_value = item["default_value"]
            existing_item.section = item["section"]
            existing_item.sort_order = item["sort_order"]

    # 7. Delete any orphaned package items and packages not belonging to registered packages or frameworks
    legacy_pkgs = db.query(AttributePackage).filter(
        AttributePackage.package_type != "framework",
        ~AttributePackage.id.in_(["pkg-apm", "pkg-adr", "pkg-resilience", "pkg-gap-analysis", "pkg-bpmn"])
    ).all()
    legacy_ids = [p.id for p in legacy_pkgs if not p.id.startswith("pkg-user-")]
    if legacy_ids:
        db.query(AttributePackageItem).filter(AttributePackageItem.package_id.in_(legacy_ids)).delete(synchronize_session=False)
        db.query(AttributePackage).filter(AttributePackage.id.in_(legacy_ids)).delete(synchronize_session=False)

    db.commit()


def seed_default_archimate_views(db: Session):
    """Seed standard out-of-the-box ArchiMate business views (activatable by the Enterprise Architect)."""
    default_views = [
        {
            "id": "pkv-archimate-app-landscape",
            "view_key": "archimate_app_landscape",
            "name": "Application Landscape Catalog",
            "description": "Comprehensive catalog of all application components, services, and interfaces defined in the ArchiMate model.",
            "category": "ArchiMate Core",
            "view_type": "table",
            "icon": "Building2",
            "sort_order": 1,
            "target_types": ["ApplicationComponent", "ApplicationService", "ApplicationInterface"],
            "target_stereotypes": [],
            "config": {
                "columns": [
                    {"field": "name", "label": "Component / Service Name", "type": "string", "sortable": True, "filterable": True},
                    {"field": "type", "label": "ArchiMate Type", "type": "badge", "sortable": True, "filterable": True},
                    {"field": "layer", "label": "Layer", "type": "badge", "sortable": True, "filterable": True},
                    {"field": "documentation", "label": "Documentation", "type": "string", "sortable": False, "filterable": False}
                ],
                "default_sort": {"field": "name", "direction": "asc"},
                "filter_config": {
                    "selectedLayer": "Application",
                    "selectedType": "All",
                    "relationshipFilter": "all",
                    "documentationFilter": "all",
                    "sortBy": "name_asc"
                }
            }
        },
        {
            "id": "pkv-archimate-process-catalog",
            "view_key": "archimate_process_catalog",
            "name": "Business Process & Capability Inventory",
            "description": "Inventory of enterprise business processes, capabilities, functions, and value streams.",
            "category": "ArchiMate Core",
            "view_type": "table",
            "icon": "Workflow",
            "sort_order": 2,
            "target_types": ["BusinessProcess", "Capability", "BusinessFunction", "ValueStream", "BusinessService"],
            "target_stereotypes": [],
            "config": {
                "columns": [
                    {"field": "name", "label": "Process / Capability Name", "type": "string", "sortable": True, "filterable": True},
                    {"field": "type", "label": "ArchiMate Type", "type": "badge", "sortable": True, "filterable": True},
                    {"field": "layer", "label": "Layer", "type": "badge", "sortable": True, "filterable": True},
                    {"field": "documentation", "label": "Documentation", "type": "string", "sortable": False, "filterable": False}
                ],
                "default_sort": {"field": "name", "direction": "asc"},
                "filter_config": {
                    "selectedLayer": "All",
                    "selectedType": "All",
                    "relationshipFilter": "all",
                    "documentationFilter": "all",
                    "sortBy": "name_asc"
                }
            }
        },
        {
            "id": "pkv-archimate-infra-landscape",
            "view_key": "archimate_infra_landscape",
            "name": "Technology & Infrastructure Landscape",
            "description": "Physical, cloud, and system software infrastructure nodes and technology services hosting applications.",
            "category": "ArchiMate Core",
            "view_type": "table",
            "icon": "Server",
            "sort_order": 3,
            "target_types": ["Node", "Device", "SystemSoftware", "TechnologyService", "Artifact", "CommunicationNetwork"],
            "target_stereotypes": [],
            "config": {
                "columns": [
                    {"field": "name", "label": "Infrastructure Node / Service", "type": "string", "sortable": True, "filterable": True},
                    {"field": "type", "label": "ArchiMate Type", "type": "badge", "sortable": True, "filterable": True},
                    {"field": "layer", "label": "Layer", "type": "badge", "sortable": True, "filterable": True},
                    {"field": "documentation", "label": "Documentation", "type": "string", "sortable": False, "filterable": False}
                ],
                "default_sort": {"field": "name", "direction": "asc"},
                "filter_config": {
                    "selectedLayer": "Technology",
                    "selectedType": "All",
                    "relationshipFilter": "all",
                    "documentationFilter": "all",
                    "sortBy": "name_asc"
                }
            }
        },
        {
            "id": "pkv-archimate-data-catalog",
            "view_key": "archimate_data_catalog",
            "name": "Information & Data Objects Catalog",
            "description": "Business and application data structures, information concepts, and digital representations.",
            "category": "ArchiMate Core",
            "view_type": "table",
            "icon": "Package",
            "sort_order": 4,
            "target_types": ["DataObject", "BusinessObject", "Representation"],
            "target_stereotypes": [],
            "config": {
                "columns": [
                    {"field": "name", "label": "Data Object Name", "type": "string", "sortable": True, "filterable": True},
                    {"field": "type", "label": "ArchiMate Type", "type": "badge", "sortable": True, "filterable": True},
                    {"field": "layer", "label": "Layer", "type": "badge", "sortable": True, "filterable": True},
                    {"field": "documentation", "label": "Documentation", "type": "string", "sortable": False, "filterable": False}
                ],
                "default_sort": {"field": "name", "direction": "asc"},
                "filter_config": {
                    "selectedLayer": "All",
                    "selectedType": "All",
                    "relationshipFilter": "all",
                    "documentationFilter": "all",
                    "sortBy": "name_asc"
                }
            }
        },
        {
            "id": "pkv-archimate-strategy-portfolio",
            "view_key": "archimate_strategy_portfolio",
            "name": "Strategy, Goals & Requirements",
            "description": "Strategic drivers, goals, outcomes, principles, and architectural requirements.",
            "category": "ArchiMate Core",
            "view_type": "table",
            "icon": "Sparkles",
            "sort_order": 5,
            "target_types": ["Goal", "Outcome", "Principle", "Requirement", "Constraint", "Driver", "Assessment"],
            "target_stereotypes": [],
            "config": {
                "columns": [
                    {"field": "name", "label": "Element Name", "type": "string", "sortable": True, "filterable": True},
                    {"field": "type", "label": "ArchiMate Type", "type": "badge", "sortable": True, "filterable": True},
                    {"field": "layer", "label": "Layer", "type": "badge", "sortable": True, "filterable": True},
                    {"field": "documentation", "label": "Documentation", "type": "string", "sortable": False, "filterable": False}
                ],
                "default_sort": {"field": "name", "direction": "asc"},
                "filter_config": {
                    "selectedLayer": "All",
                    "selectedType": "All",
                    "relationshipFilter": "all",
                    "documentationFilter": "all",
                    "sortBy": "name_asc"
                }
            }
        },
        {
            "id": "pkv-archimate-model-health",
            "view_key": "archimate_model_health",
            "name": "Model Health & Hygiene Dashboard",
            "description": "Architectural metrics, element distribution across layers, and top ArchiMate types in the library.",
            "category": "Model Governance",
            "view_type": "kpi_dashboard",
            "icon": "BarChart3",
            "sort_order": 6,
            "target_types": [],
            "target_stereotypes": [],
            "config": {
                "metrics": [
                    {"id": "total_elements", "label": "Total Elements", "type": "count"},
                    {"id": "apps_count", "label": "Applications", "type": "count", "where": {"type": ["ApplicationComponent", "ApplicationService"]}},
                    {"id": "processes_count", "label": "Business Processes", "type": "count", "where": {"type": ["BusinessProcess", "BusinessFunction"]}},
                    {"id": "infra_nodes_count", "label": "Infrastructure Nodes", "type": "count", "where": {"type": ["Node", "Device", "SystemSoftware"]}}
                ],
                "charts": [
                    {"id": "by_layer", "title": "Elements by ArchiMate Layer", "type": "pie", "group_by": "layer"},
                    {"id": "by_type", "title": "Top Element Types", "type": "bar", "group_by": "type"}
                ],
                "filter_config": {}
            }
        },
        {
            "id": "pkv-archimate-cross-layer-matrix",
            "view_key": "archimate_cross_layer_matrix",
            "name": "Cross-Layer Distribution Matrix",
            "description": "2D pivot matrix analyzing the distribution of architectural elements across Layers and Types.",
            "category": "Model Governance",
            "view_type": "matrix",
            "icon": "Grid",
            "sort_order": 7,
            "target_types": [],
            "target_stereotypes": [],
            "config": {
                "matrix": {
                    "x_axis": {"field": "layer", "label": "ArchiMate Layer"},
                    "y_axis": {"field": "type", "label": "Element Type"}
                },
                "filter_config": {}
            }
        },
        {
            "id": "pkv-archimate-orphan-audit",
            "view_key": "archimate_orphan_audit",
            "name": "Orphan Elements Audit",
            "description": "Quality audit listing all elements in the model that have no relationships (inbound or outbound).",
            "category": "Model Governance",
            "view_type": "table",
            "icon": "ShieldAlert",
            "sort_order": 8,
            "target_types": [],
            "target_stereotypes": [],
            "config": {
                "columns": [
                    {"field": "name", "label": "Element Name", "type": "string", "sortable": True, "filterable": True},
                    {"field": "type", "label": "ArchiMate Type", "type": "badge", "sortable": True, "filterable": True},
                    {"field": "layer", "label": "Layer", "type": "badge", "sortable": True, "filterable": True},
                    {"field": "documentation", "label": "Documentation", "type": "string", "sortable": False, "filterable": False}
                ],
                "default_sort": {"field": "name", "direction": "asc"},
                "filter_config": {
                    "selectedLayer": "All",
                    "selectedType": "All",
                    "relationshipFilter": "orphan",
                    "documentationFilter": "all",
                    "sortBy": "name_asc"
                }
            }
        },
        {
            "id": "pkv-archimate-undocumented-audit",
            "view_key": "archimate_undocumented_audit",
            "name": "Undocumented Elements Checklist",
            "description": "Checklist of architectural elements missing documentation descriptions.",
            "category": "Model Governance",
            "view_type": "table",
            "icon": "Table",
            "sort_order": 9,
            "target_types": [],
            "target_stereotypes": [],
            "config": {
                "columns": [
                    {"field": "name", "label": "Element Name", "type": "string", "sortable": True, "filterable": True},
                    {"field": "type", "label": "ArchiMate Type", "type": "badge", "sortable": True, "filterable": True},
                    {"field": "layer", "label": "Layer", "type": "badge", "sortable": True, "filterable": True}
                ],
                "default_sort": {"field": "name", "direction": "asc"},
                "filter_config": {
                    "selectedLayer": "All",
                    "selectedType": "All",
                    "relationshipFilter": "all",
                    "documentationFilter": "no_doc",
                    "sortBy": "name_asc"
                }
            }
        }
    ]

    for v_data in default_views:
        existing_v = db.query(PackageView).filter(PackageView.id == v_data["id"]).first()
        if not existing_v:
            v = PackageView(
                id=v_data["id"],
                package_id=None,
                model_id=None,
                view_key=v_data["view_key"],
                name=v_data["name"],
                description=v_data["description"],
                category=v_data["category"],
                view_type=v_data["view_type"],
                icon=v_data["icon"],
                sort_order=v_data.get("sort_order", 0),
                is_global=True,
                is_active=False,  # Activatable by the EA
                target_stereotypes=v_data.get("target_stereotypes", []),
                target_types=v_data.get("target_types", []),
                config=v_data["config"]
            )
            db.add(v)
        else:
            existing_v.name = v_data["name"]
            existing_v.description = v_data["description"]
            existing_v.category = v_data["category"]
            existing_v.view_type = v_data["view_type"]
            existing_v.icon = v_data["icon"]
            existing_v.sort_order = v_data.get("sort_order", 0)
            existing_v.target_stereotypes = v_data.get("target_stereotypes", [])
            existing_v.target_types = v_data.get("target_types", [])
            existing_v.config = v_data["config"]
            existing_v.is_global = True
            # Preserves existing_v.is_active

    db.commit()


def seed_default_custom_attributes(db: Session):
    """Seed standard base attribute packages and layer packages, default stereotypes, and clean up non-package attributes."""
    # First seed standard base attribute packages (APM, ADR, Resilience, Gap Analysis)
    seed_default_attribute_packages(db)
    # Seed standard ArchiMate layer packages (bcm, bsc, alc, cld, eol, req, ppm)
    from app.services.archimate_packages_seed import seed_archimate_standard_packages
    seed_archimate_standard_packages(db)
    # Seed default stereotypes
    seed_default_stereotypes(db)
    # Seed default ArchiMate core business views
    seed_default_archimate_views(db)

    # Purge any custom attribute definitions not matching any registered package code
    pkg_codes = [p.code for p in db.query(AttributePackage).all()]
    filters = [~CustomAttributeDefinition.name.like(f"{c}_%") for c in pkg_codes]
    if filters:
        db.query(CustomAttributeDefinition).filter(*filters).delete(synchronize_session=False)
    db.commit()


def seed_default_stereotypes(db: Session):
    """Seed canonical ArchiMate stereotypes with specialized attribute requirements and defaults."""
    # Purge any deprecated links to removed tme_ or apm_in_scope attributes
    db.query(StereotypeAttributeLink).filter(
        (StereotypeAttributeLink.attribute_name.like("tme_%")) |
        (StereotypeAttributeLink.attribute_name == "apm_in_scope")
    ).delete(synchronize_session=False)

    # Migrate legacy stereo-enterprise-app to stereo-business-app
    db.query(ArchimateElement).filter(ArchimateElement.stereotype_id == "stereo-enterprise-app").update(
        {"stereotype_id": "stereo-business-app"},
        synchronize_session=False
    )
    db.query(StereotypeAttributeLink).filter(StereotypeAttributeLink.stereotype_id == "stereo-enterprise-app").delete(synchronize_session=False)
    db.query(ElementStereotype).filter(ElementStereotype.id == "stereo-enterprise-app").delete(synchronize_session=False)

    default_stereotypes = [
        {
            "id": "stereo-business-app",
            "base_type": "ApplicationComponent",
            "name": "Business Application",
            "label": "«Business Application»",
            "description": "Enterprise business application managed in the application portfolio (APM governance, TCO budget, SLA, lifecycle, and TIME rationalization matrix).",
            "icon_color": "indigo",
            "is_system": True,
            "package_id": "pkg-apm",
            "links": [
                {
                    "attribute_name": "apm_lifecycle_status",
                    "is_required": True,
                    "default_value": "Live",
                    "section_override": None,
                    "sort_order": 1
                },
                {
                    "attribute_name": "apm_business_criticality",
                    "is_required": True,
                    "default_value": "Business Operational",
                    "section_override": None,
                    "sort_order": 2
                },
                {
                    "attribute_name": "apm_functional_fit",
                    "is_required": True,
                    "default_value": "3 - Appropriate",
                    "section_override": None,
                    "sort_order": 3
                },
                {
                    "attribute_name": "apm_technical_fit",
                    "is_required": True,
                    "default_value": "3 - Appropriate",
                    "section_override": None,
                    "sort_order": 4
                },
                {
                    "attribute_name": "apm_annual_cost",
                    "is_required": True,
                    "default_value": "0",
                    "section_override": None,
                    "sort_order": 5
                },
                {
                    "attribute_name": "apm_hosting_type",
                    "is_required": True,
                    "default_value": "Public Cloud",
                    "section_override": None,
                    "sort_order": 6
                }
            ]
        },
        {
            "id": "stereo-microservice",
            "base_type": "ApplicationComponent",
            "name": "Microservice",
            "label": "«Microservice»",
            "description": "Single functional bounded-context application component, containerized and exposed via REST/gRPC APIs.",
            "icon_color": "indigo",
            "stencil_shape": "modern_microservice",
            "stencil_icon": "api",
            "is_system": True,
            "package_id": None,
            "links": [
                {
                    "attribute_name": "apm_hosting_type",
                    "is_required": True,
                    "default_value": "Public Cloud",
                    "section_override": None,
                    "sort_order": 1
                },
                {
                    "attribute_name": "apm_technical_fit",
                    "is_required": True,
                    "default_value": "4 - Perfect (Cloud Native)",
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
            "description": "Software-as-a-service delivered and operated entirely in the cloud by a third-party vendor.",
            "icon_color": "emerald",
            "stencil_shape": "modern_card",
            "stencil_icon": "cloud",
            "is_system": True,
            "package_id": None,
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
            "description": "Monolithic application or core legacy system hosted on on-premises mainframe infrastructure.",
            "icon_color": "amber",
            "stencil_shape": "modern_card",
            "stencil_icon": "server",
            "is_system": True,
            "package_id": None,
            "links": [
                {
                    "attribute_name": "apm_hosting_type",
                    "is_required": True,
                    "default_value": "On-Premise",
                    "section_override": None,
                    "sort_order": 1
                },
                {
                    "attribute_name": "apm_technical_fit",
                    "is_required": True,
                    "default_value": "1 - Unreasonable (Legacy)",
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
            "description": "Business process fully automated by IT systems or workflow engines (BPMN / Camunda).",
            "icon_color": "purple",
            "stencil_shape": "modern_process",
            "stencil_icon": "cog",
            "is_system": True,
            "package_id": None,
            "links": []
        },
        {
            "id": "stereo-manual-process",
            "base_type": "BusinessProcess",
            "name": "Manual Process",
            "label": "«Manual»",
            "description": "Business process executed manually by operational personnel without end-to-end IT automation.",
            "icon_color": "rose",
            "is_system": True,
            "package_id": None,
            "links": []
        },
        {
            "id": "stereo-k8s",
            "base_type": "Node",
            "name": "Kubernetes Cluster",
            "label": "«K8s Cluster»",
            "description": "Kubernetes container orchestration platform with distributed worker nodes.",
            "icon_color": "blue",
            "stencil_shape": "modern_cloud_node",
            "stencil_icon": "cloud",
            "is_system": True,
            "package_id": None,
            "links": []
        },
        {
            "id": "stereo-adr",
            "base_type": "Assessment",
            "name": "Architecture Decision",
            "label": "«Architecture Decision»",
            "description": "Formal Architecture Decision Record (ADR) modeled in the ArchiMate Motivation Layer.",
            "icon_color": "indigo",
            "stencil_shape": "modern_hex",
            "stencil_icon": "shield",
            "is_system": True,
            "package_id": "pkg-adr",
            "links": [
                {
                    "attribute_name": "adr_code",
                    "is_required": True,
                    "default_value": None,
                    "section_override": None,
                    "sort_order": 1
                },
                {
                    "attribute_name": "adr_status",
                    "is_required": True,
                    "default_value": "Draft",
                    "section_override": None,
                    "sort_order": 2
                },
                {
                    "attribute_name": "adr_domain",
                    "is_required": True,
                    "default_value": "Application",
                    "section_override": None,
                    "sort_order": 3
                },
                {
                    "attribute_name": "adr_deciders",
                    "is_required": False,
                    "default_value": None,
                    "section_override": None,
                    "sort_order": 4
                },
                {
                    "attribute_name": "adr_decided_at",
                    "is_required": False,
                    "default_value": None,
                    "section_override": None,
                    "sort_order": 5
                },
                {
                    "attribute_name": "adr_decision_outcome",
                    "is_required": False,
                    "default_value": None,
                    "section_override": None,
                    "sort_order": 6
                },
                {
                    "attribute_name": "adr_compliance_impact",
                    "is_required": False,
                    "default_value": None,
                    "section_override": None,
                    "sort_order": 7
                },
                {
                    "attribute_name": "adr_superseded_by",
                    "is_required": False,
                    "default_value": None,
                    "section_override": None,
                    "sort_order": 8
                }
            ]
        },
        {
            "id": "stereo-plateau-baseline",
            "base_type": "Plateau",
            "name": "Baseline Architecture",
            "label": "«Baseline Architecture»",
            "description": "Represents the current, verified As-Is operational baseline state of the enterprise architecture.",
            "icon_color": "amber",
            "is_system": True,
            "package_id": "pkg-gap-analysis",
            "links": []
        },
        {
            "id": "stereo-plateau-transition",
            "base_type": "Plateau",
            "name": "Transition Plateau",
            "label": "«Transition Plateau»",
            "description": "Represents an intermediate transition architecture state delivering defined milestone increments.",
            "icon_color": "blue",
            "is_system": True,
            "package_id": "pkg-gap-analysis",
            "links": []
        },
        {
            "id": "stereo-plateau-target",
            "base_type": "Plateau",
            "name": "Target Architecture",
            "label": "«Target Architecture»",
            "description": "Represents the desired future To-Be target enterprise architecture state.",
            "icon_color": "emerald",
            "is_system": True,
            "package_id": "pkg-gap-analysis",
            "links": []
        },
        {
            "id": "stereo-workpackage-strategic",
            "base_type": "WorkPackage",
            "name": "Strategic Initiative",
            "label": "«Strategic Initiative»",
            "description": "A funded transition program, epic or work package delivering deliverables to close architectural gaps.",
            "icon_color": "indigo",
            "is_system": True,
            "package_id": "pkg-gap-analysis",
            "links": []
        },
        # BPMN 2.0 Task Stereotypes (Specialization of ArchiMate BusinessProcess)
        {
            "id": "stereo-bpmn-user-task",
            "base_type": "BusinessProcess",
            "name": "User Task",
            "label": "«UserTask»",
            "description": "Task semi-automatico eseguito da un operatore umano con supporto di un applicativo software.",
            "icon_color": "blue",
            "stencil_shape": "modern_card",
            "stencil_icon": "users",
            "is_system": True,
            "package_id": "pkg-bpmn",
            "links": []
        },
        {
            "id": "stereo-bpmn-service-task",
            "base_type": "BusinessProcess",
            "name": "Service Task",
            "label": "«ServiceTask»",
            "description": "Task 100% automatizzato eseguito direttamente da un servizio applicativo, API, microservizio o job backend.",
            "icon_color": "indigo",
            "stencil_shape": "modern_card",
            "stencil_icon": "cpu",
            "is_system": True,
            "package_id": "pkg-bpmn",
            "links": []
        },
        {
            "id": "stereo-bpmn-script-task",
            "base_type": "BusinessProcess",
            "name": "Script Task",
            "label": "«ScriptTask»",
            "description": "Task automatizzato eseguito direttamente dal motore di processo o workflow tramite script o trasformazione dati.",
            "icon_color": "cyan",
            "stencil_shape": "modern_card",
            "stencil_icon": "terminal",
            "is_system": True,
            "package_id": "pkg-bpmn",
            "links": []
        },
        {
            "id": "stereo-bpmn-manual-task",
            "base_type": "BusinessProcess",
            "name": "Manual Task",
            "label": "«ManualTask»",
            "description": "Task interamente fisico, cartaceo o manuale svolto senza alcun ausilio software o applicativo.",
            "icon_color": "amber",
            "stencil_shape": "modern_card",
            "stencil_icon": "hand",
            "is_system": True,
            "package_id": "pkg-bpmn",
            "links": []
        },
        {
            "id": "stereo-bpmn-rule-task",
            "base_type": "BusinessProcess",
            "name": "Business Rule Task",
            "label": "«BusinessRuleTask»",
            "description": "Decisione o calcolo decisionale automatizzato eseguito tramite Decision Table, DMN o Rule Engine.",
            "icon_color": "purple",
            "stencil_shape": "modern_card",
            "stencil_icon": "sliders",
            "is_system": True,
            "package_id": "pkg-bpmn",
            "links": []
        },
        {
            "id": "stereo-bpmn-ai-task",
            "base_type": "BusinessProcess",
            "name": "AI Agent Task",
            "label": "«AIAgentTask»",
            "description": "Task cognitivo assistito o autonomo affidato a un agente AI generativo, LLM o modello predittivo.",
            "icon_color": "emerald",
            "stencil_shape": "modern_card",
            "stencil_icon": "zap",
            "is_system": True,
            "package_id": "pkg-bpmn",
            "links": []
        }
    ]

    for st_data in default_stereotypes:
        existing = db.query(ElementStereotype).filter(ElementStereotype.id == st_data["id"]).first()
        if not existing:
            st = ElementStereotype(
                id=st_data["id"],
                model_id=None,
                package_id=st_data.get("package_id"),
                base_type=st_data["base_type"],
                name=st_data["name"],
                label=st_data["label"],
                description=st_data["description"],
                icon_color=st_data["icon_color"],
                stencil_shape=st_data.get("stencil_shape"),
                stencil_icon=st_data.get("stencil_icon"),
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
            existing.package_id = st_data.get("package_id")
            existing.name = st_data["name"]
            existing.label = st_data["label"]
            existing.description = st_data["description"]
            existing.icon_color = st_data["icon_color"]
            if "stencil_shape" in st_data:
                existing.stencil_shape = st_data["stencil_shape"]
            if "stencil_icon" in st_data:
                existing.stencil_icon = st_data["stencil_icon"]
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
    """List stereotypes filtered by base_type and scope, including active package stereotypes."""
    query = db.query(ElementStereotype)
    if model_id and model_id != "*":
        active_links = db.query(WorkspaceAttributePackage.package_id).filter(
            WorkspaceAttributePackage.model_id == model_id
        ).all()
        active_pkg_ids = [r[0] for r in active_links]
        query = query.filter(
            (ElementStereotype.model_id == model_id) |
            ((ElementStereotype.model_id == None) & (ElementStereotype.package_id == None)) |
            (ElementStereotype.package_id.in_(active_pkg_ids) if active_pkg_ids else False)
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
            "package_id": st.package_id,
            "package_name": st.package.name if st.package else None,
            "package_code": st.package.code if st.package else None,
            "base_type": st.base_type,
            "name": st.name,
            "label": st.label,
            "description": st.description,
            "icon_color": st.icon_color,
            "stencil_shape": st.stencil_shape,
            "stencil_icon": st.stencil_icon,
            "custom_drawio_style": st.custom_drawio_style,
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
        "package_id": st.package_id,
        "package_name": st.package.name if st.package else None,
        "package_code": st.package.code if st.package else None,
        "base_type": st.base_type,
        "name": st.name,
        "label": st.label,
        "description": st.description,
        "icon_color": st.icon_color,
        "stencil_shape": st.stencil_shape,
        "stencil_icon": st.stencil_icon,
        "custom_drawio_style": st.custom_drawio_style,
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
    package_id = data.get("package_id")
    label = (data.get("label") or "").strip()
    if not label:
        label = f"«{name}»"
    elif not (label.startswith("«") and label.endswith("»")):
        label = f"«{label}»"

    st_id = f"stereo-{uuid.uuid4().hex[:8]}"
    st = ElementStereotype(
        id=st_id,
        model_id=model_id,
        package_id=package_id,
        base_type=base_type,
        name=name,
        label=label,
        description=data.get("description"),
        icon_color=data.get("icon_color", "indigo"),
        stencil_shape=data.get("stencil_shape"),
        stencil_icon=data.get("stencil_icon"),
        custom_drawio_style=data.get("custom_drawio_style"),
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
    if "stencil_shape" in data:
        st.stencil_shape = data["stencil_shape"]
    if "stencil_icon" in data:
        st.stencil_icon = data["stencil_icon"]
    if "custom_drawio_style" in data:
        st.custom_drawio_style = data["custom_drawio_style"]

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
            "version": getattr(pkg, "version", "1.0.0") or "1.0.0",
            "author": getattr(pkg, "author", None),
            "license": getattr(pkg, "license", None),
            "description": pkg.description,
            "icon_color": pkg.icon_color,
            "package_type": pkg.package_type or "attribute_only",
            "standard_version": pkg.standard_version,
            "website_url": pkg.website_url,
            "is_default_active": pkg.is_default_active,
            "is_system": bool(pkg.is_system),
            "is_active": pkg.id in active_pkg_ids if model_id and model_id != "*" else None,
            "item_count": len(items_data),
            "items": items_data,
            "stereotypes_count": len(pkg.stereotypes or []),
            "reference_elements_count": len(pkg.reference_elements or []),
            "reference_relationships_count": len(pkg.reference_relationships or []),
            "views_count": len(pkg.views or []),
            "created_at": pkg.created_at.isoformat() if pkg.created_at else None
        })
    return result


def get_attribute_package(db: Session, package_id: str) -> Dict[str, Any]:
    """Get package details, its items, stereotypes, and canonical reference elements/relationships."""
    pkg = db.query(AttributePackage).filter(AttributePackage.id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail=f"Attribute package '{package_id}' not found.")
    
    return {
        "id": pkg.id,
        "code": pkg.code,
        "name": pkg.name,
        "version": getattr(pkg, "version", "1.0.0") or "1.0.0",
        "author": getattr(pkg, "author", None),
        "license": getattr(pkg, "license", None),
        "description": pkg.description,
        "icon_color": pkg.icon_color,
        "package_type": pkg.package_type or "attribute_only",
        "standard_version": pkg.standard_version,
        "website_url": pkg.website_url,
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
        "stereotypes": [
            {
                "id": st.id,
                "name": st.name,
                "label": st.label,
                "base_type": st.base_type,
                "description": st.description,
                "icon_color": st.icon_color,
            }
            for st in (pkg.stereotypes or [])
        ],
        "reference_elements": [
            {
                "id": el.id,
                "name": el.name,
                "type": el.type,
                "layer": el.layer,
                "documentation": el.documentation,
                "properties": el.properties or {},
                "stereotype": {
                    "id": el.stereotype.id,
                    "name": el.stereotype.name,
                    "label": el.stereotype.label
                } if el.stereotype else None
            }
            for el in (pkg.reference_elements or [])
        ],
        "reference_relationships": [
            {
                "id": rel.id,
                "type": rel.type,
                "name": rel.name,
                "source_id": rel.source_id,
                "source_name": rel.source_element.name if rel.source_element else "",
                "target_id": rel.target_id,
                "target_name": rel.target_element.name if rel.target_element else "",
                "documentation": rel.documentation
            }
            for rel in (pkg.reference_relationships or [])
        ],
        "views": [
            {
                "id": v.id,
                "view_key": v.view_key,
                "name": v.name,
                "description": v.description,
                "category": v.category or "General",
                "view_type": v.view_type,
                "icon": v.icon or "Table",
                "target_hub": getattr(v, "target_hub", None) or "business",
                "target_stereotypes": v.target_stereotypes or [],
                "config": v.config or {}
            }
            for v in (pkg.views or [])
        ],
        "created_at": pkg.created_at.isoformat() if pkg.created_at else None
    }


def create_attribute_package(db: Session, data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new package in the global catalog. Enforces a 3-8 character unique code."""
    raw_code = (data.get("code") or "").strip().lower()
    if not re.match(r"^[a-z0-9]{3,8}$", raw_code):
        raise HTTPException(
            status_code=400,
            detail="Il codice del pacchetto deve essere composto da 3 a 8 caratteri alfanumerici (es. 'apm', 'tme', 'sec', 'bian', 'rami', 'fhir')."
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
        is_system=False,
        package_type=data.get("package_type", "attribute_only"),
        standard_version=data.get("standard_version"),
        website_url=data.get("website_url")
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
    if "package_type" in data and data["package_type"]:
        pkg.package_type = data["package_type"]
    if "standard_version" in data:
        pkg.standard_version = data["standard_version"]
    if "website_url" in data:
        pkg.website_url = data["website_url"]

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
        raise HTTPException(status_code=404, detail=f"Model workspace '{model_id}' not found.")

    pkg = db.query(AttributePackage).filter(AttributePackage.id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail=f"Package '{package_id}' not found.")

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
            "message": f"Package '{pkg.name}' activated for library '{model.name}'."
        }
    else:
        # STRICT DEACTIVATION GUARD (except for pkg-adr, pkg-resilience, and pkg-gap-analysis which can be toggled freely to show/hide views)
        if existing_link:
            if package_id not in ["pkg-adr", "pkg-resilience", "pkg-gap-analysis"]:
                # 1. Check if any element in the library has populated attributes from this package
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
                            "message": f"Cannot deactivate package '{pkg.name}': {len(populated_elements)} elements in this library have one or more populated package attributes.",
                            "populated_count": len(populated_elements),
                            "affected_elements": populated_elements[:20]
                        }
                    )

                # 2. Check if any local element uses a stereotype provided by this package
                pkg_stereotype_ids = [st.id for st in (pkg.stereotypes or [])]
                if pkg_stereotype_ids:
                    elem_with_st = [
                        {"id": e.id, "name": e.name, "type": e.type}
                        for e in elements if e.stereotype_id in pkg_stereotype_ids
                    ]
                    if elem_with_st:
                        raise HTTPException(
                            status_code=409,
                            detail={
                                "error": "package_deactivation_blocked",
                                "message": f"Cannot deactivate package '{pkg.name}': {len(elem_with_st)} elements in this library have a stereotype provided by this package.",
                                "populated_count": len(elem_with_st),
                                "affected_elements": elem_with_st[:20]
                            }
                        )

                # 3. Check if any relationship in this library connects to canonical reference elements of this package
                pkg_ref_elem_ids = [re_el.id for re_el in (pkg.reference_elements or [])]
                if pkg_ref_elem_ids:
                    connected_rels = db.query(ArchimateRelationship).filter(
                        ArchimateRelationship.model_id == model_id,
                        (ArchimateRelationship.source_id.in_(pkg_ref_elem_ids) | ArchimateRelationship.target_id.in_(pkg_ref_elem_ids))
                    ).all()
                    if connected_rels:
                        raise HTTPException(
                            status_code=409,
                            detail={
                                "error": "package_deactivation_blocked",
                                "message": f"Cannot deactivate framework '{pkg.name}': {len(connected_rels)} relationships connect to canonical reference elements of this framework.",
                                "populated_count": len(connected_rels),
                                "affected_elements": [
                                    {"id": r.id, "name": r.name, "type": r.type} for r in connected_rels[:20]
                                ]
                            }
                        )

            db.delete(existing_link)
            db.commit()

        return {
            "status": "success",
            "package_id": package_id,
            "package_name": pkg.name,
            "is_active": False,
            "message": f"Package '{pkg.name}' deactivated for library '{model.name}'."
        }


def audit_package_usage(db: Session, package_id: str) -> Dict[str, Any]:
    """Audit which libraries have the package active and which populate attributes of this package."""
    pkg = db.query(AttributePackage).filter(AttributePackage.id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail=f"Package '{package_id}' not found.")

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
        "Requirement": ["Influence", "Association"],
        "Principle": ["Influence", "Association"],
        "Constraint": ["Influence", "Association"],
        "Capability": ["Influence", "Association"],
        "ValueStream": ["Influence", "Association"],
        "BusinessProcess": ["Influence", "Association"],
        "ApplicationComponent": ["Influence", "Association"],
        "ApplicationService": ["Influence", "Association"],
        "DataObject": ["Influence", "Association"],
        "Node": ["Influence", "Association"],
        "SystemSoftware": ["Influence", "Association"],
        "TechnologyService": ["Influence", "Association"],
        "WorkPackage": ["Influence", "Association"]
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
                "horizon": "Baseline / As-Is (Current)",
                "description": "Applications currently Live, in Phase-out, or classified as Tolerate in TIME matrix.",
                "app_count": len(as_is_apps),
                "applications": as_is_apps
            },
            {
                "horizon": "Transition Plateau",
                "description": "Applications undergoing active migration, transformation, or architectural evaluation.",
                "app_count": len(transition_apps),
                "applications": transition_apps
            },
            {
                "horizon": "Target Architecture / To-Be (Target)",
                "description": "Strategic target applications (Invest) and newly planned architectural initiatives.",
                "app_count": len(to_be_apps),
                "applications": to_be_apps
            }
        ],
        "work_packages": [{"id": wp.id, "name": wp.name, "doc": wp.documentation} for wp in work_packages]
    }


