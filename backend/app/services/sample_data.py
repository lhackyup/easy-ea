from sqlalchemy.orm import Session
from app.models.archimate import ModelWorkspace, ArchimateElement, ArchimateRelationship, ArchimateView, ApplicationBusinessAttributes
from app.services.apm_service import calculate_time_quadrant

def seed_sample_model(db: Session) -> str:
    """Creates or resets a comprehensive sample ArchiMate model with business data in English."""
    existing = db.query(ModelWorkspace).filter(ModelWorkspace.id == "sample-easybank-ea").first()
    if existing:
        db.delete(existing)
        db.commit()

    workspace = ModelWorkspace(
        id="sample-easybank-ea",
        code="EASY",
        name="EasyBank Global Enterprise Model",
        description="EasyBank enterprise reference architecture: banking business processes, application catalog, TIME matrix assessment, and cloud infrastructure.",
        version="2.4.0",
        source_format="archi_native"
    )
    db.add(workspace)

    # 1. Strategy & Capabilities
    capabilities = [
        ("cap-cust-mgmt", "Customer Relationship Management", "Capability", "Strategy", "Comprehensive 360-degree customer relationship and master data management."),
        ("cap-payments", "Payment & Transaction Processing", "Capability", "Strategy", "Execution and reconciliation of instant payments and SEPA credit transfers."),
        ("cap-claims", "Claims & Dispute Management", "Capability", "Strategy", "Management of insurance claims, customer disputes, and card chargebacks."),
        ("cap-fraud", "Fraud Detection & Prevention", "Capability", "Strategy", "Real-time transactional analysis using machine learning anti-fraud models."),
        ("cap-core-acc", "Core Account & Ledger Management", "Capability", "Strategy", "General ledger, chart of accounts, and current account management."),
        ("cap-hr", "Human Capital & Payroll", "Capability", "Strategy", "Human resources management, employee payroll, and talent recruitment."),
        ("cap-doc", "Document & Archive Management", "Capability", "Strategy", "Regulatory digital archiving, electronic signatures, and contract management.")
    ]

    # 2. Business Processes & Actors
    business_elements = [
        ("actor-branch-mgr", "Branch & Customer Agent", "BusinessActor", "Business", "Branch operators, relationship managers, and customer service advisors."),
        ("actor-client", "Bank Customer", "BusinessActor", "Business", "Retail and corporate banking customer."),
        ("proc-onboarding", "Customer Digital Onboarding", "BusinessProcess", "Business", "Digital account opening process with automated KYC/AML verification."),
        ("proc-send-payment", "Process SEPA Payment", "BusinessProcess", "Business", "Domestic and international payment transaction execution."),
        ("proc-handle-claim", "Process Insurance Claim", "BusinessProcess", "Business", "Claim investigation, expert appraisal, and settlement process."),
        ("proc-loan-origination", "Credit & Loan Origination", "BusinessProcess", "Business", "Credit risk assessment, scoring, and loan disbursement workflow.")
    ]

    # 3. Application Components (with rich APM metadata)
    app_elements = [
        # (id, name, type, layer, doc, b_fit, t_fit, cost, crit, status, b_owner, t_owner, vendor, hosting)
        ("app-salesforce", "Salesforce Financial Services Cloud", "ApplicationComponent", "Application", "Cloud CRM platform for financial advisors, customer support, and lead tracking.", 5, 4, 180000.0, "Business Critical", "Live", "Mario Rossi (Head of Sales)", "Luca Verdi (Enterprise Cloud)", "Salesforce Inc.", "SaaS"),
        ("app-legacy-crm", "Legacy Oracle CRM 10g", "ApplicationComponent", "Application", "Internal legacy CRM retained for corporate customer historical records.", 2, 1, 95000.0, "Administrative", "Phase-out", "Mario Rossi (Head of Sales)", "Anna Bianchi (Legacy Ops)", "Oracle", "On-Premise"),
        ("app-cloud-core", "Thought Machine Vault Core", "ApplicationComponent", "Application", "Cloud-native core banking engine for real-time accounts and balance processing.", 5, 5, 250000.0, "Mission Critical", "Live", "Giulia Neri (Head of Core Banking)", "Marco Conti (Platform Eng)", "Thought Machine", "Public Cloud (AWS)"),
        ("app-legacy-ledger", "Mainframe AS400 Ledger", "ApplicationComponent", "Application", "Historical core general ledger running on IBM AS400 mainframe.", 4, 2, 320000.0, "Mission Critical", "Phase-out", "Paolo Ferrari (CFO Office)", "Anna Bianchi (Legacy Ops)", "IBM", "On-Premise"),
        ("app-stripe-engine", "Stripe Modern Payment Gateway", "ApplicationComponent", "Application", "Modern payment gateway for card acquiring and digital commerce transactions.", 4, 5, 110000.0, "Business Critical", "Live", "Giulia Neri (Head of Core Banking)", "Luca Verdi (Enterprise Cloud)", "Stripe Inc.", "SaaS"),
        ("app-legacy-pay", "SIA/Nexi Legacy Payment Hub", "ApplicationComponent", "Application", "Legacy interbank batch clearing connector.", 3, 2, 140000.0, "Business Operational", "Phase-out", "Giulia Neri (Head of Core Banking)", "Anna Bianchi (Legacy Ops)", "Nexi SpA", "Private Cloud"),
        ("app-feedzai-fraud", "Feedzai Real-time Fraud Engine", "ApplicationComponent", "Application", "AI/ML real-time transaction scoring and fraud prevention system.", 5, 4, 130000.0, "Mission Critical", "Live", "Roberto De Luca (Chief Risk Officer)", "Marco Conti (Platform Eng)", "Feedzai", "Public Cloud (AWS)"),
        ("app-workday", "Workday HCM & Payroll", "ApplicationComponent", "Application", "Human capital management, employee self-service, and payroll system.", 4, 4, 75000.0, "Administrative", "Live", "Elena Galli (CHRO)", "Luca Verdi (Enterprise Cloud)", "Workday", "SaaS"),
        ("app-alfresco-doc", "Alfresco Enterprise Content", "ApplicationComponent", "Application", "Enterprise document repository for digitally signed contracts and records.", 3, 3, 45000.0, "Business Operational", "Live", "Paolo Ferrari (CFO Office)", "Marco Conti (Platform Eng)", "Hyland / Alfresco", "Private Cloud")
    ]

    # 4. Technology Layer Elements
    tech_elements = [
        ("tech-aws-cluster", "AWS EKS Kubernetes Cluster (eu-west-1)", "Node", "Technology", "Managed cloud Kubernetes cluster hosting application microservices."),
        ("tech-rds-postgres", "AWS Aurora PostgreSQL Enterprise", "SystemSoftware", "Technology", "High-availability managed relational database service."),
        ("tech-ibm-z15", "IBM z15 Enterprise Mainframe", "Node", "Technology", "Headquarters on-premise mainframe infrastructure."),
        ("tech-vmware-dc", "VMware vSphere On-Prem Datacenter", "Node", "Technology", "Private datacenter server virtualization platform.")
    ]

    # Insert Elements
    for elem_id, name, elem_type, layer, doc in capabilities + business_elements + tech_elements:
        el = ArchimateElement(
            id=elem_id,
            model_id=workspace.id,
            name=name,
            type=elem_type,
            layer=layer,
            documentation=doc,
            properties={}
        )
        db.add(el)

    for elem_id, name, elem_type, layer, doc, b_fit, t_fit, cost, crit, status, b_owner, t_owner, vendor, hosting in app_elements:
        el = ArchimateElement(
            id=elem_id,
            model_id=workspace.id,
            name=name,
            type=elem_type,
            layer=layer,
            documentation=doc,
            properties={}
        )
        db.add(el)

        time_q = calculate_time_quadrant(b_fit, t_fit)
        apm = ApplicationBusinessAttributes(
            element_id=elem_id,
            business_fit=b_fit,
            technical_fit=t_fit,
            time_quadrant=time_q,
            annual_cost=cost,
            business_criticality=crit,
            lifecycle_status=status,
            business_owner=b_owner,
            technical_owner=t_owner,
            vendor=vendor,
            hosting_type=hosting,
            data_classification="Confidential",
            sla_level="Gold (99.9%)" if "Critical" in crit else "Silver (99.0%)",
            in_apm_scope=True,
            notes="Standard Enterprise Architecture configuration."
        )
        db.add(apm)

    # 5. Relationships
    relations = [
        # Process -> Actor (Assignment/Triggering)
        ("rel-1", "proc-onboarding", "actor-client", "AssociationRelationship", "Initiated by customer"),
        ("rel-2", "actor-branch-mgr", "proc-onboarding", "AssignmentRelationship", "Validated by operator"),
        
        # Process -> App (Serving)
        ("rel-3", "app-salesforce", "proc-onboarding", "ServingRelationship", "Lead & KYC management"),
        ("rel-4", "app-cloud-core", "proc-onboarding", "ServingRelationship", "IBAN account opening"),
        ("rel-5", "app-alfresco-doc", "proc-onboarding", "ServingRelationship", "Signature archiving"),
        ("rel-6", "app-stripe-engine", "proc-send-payment", "ServingRelationship", "Web payment channel"),
        ("rel-7", "app-legacy-pay", "proc-send-payment", "ServingRelationship", "Legacy wire transfer channel"),
        ("rel-8", "app-feedzai-fraud", "proc-send-payment", "ServingRelationship", "Anti-fraud screening"),
        ("rel-9", "app-cloud-core", "proc-send-payment", "ServingRelationship", "Account debit/credit"),
        ("rel-10", "app-legacy-ledger", "proc-send-payment", "ServingRelationship", "Ledger accounting posting"),

        # App -> Capability (Realization) -> Explicit Overlaps!
        # CRM Capability realized by BOTH Salesforce and Legacy CRM!
        ("rel-11", "app-salesforce", "cap-cust-mgmt", "RealizationRelationship", "Modern CRM"),
        ("rel-12", "app-legacy-crm", "cap-cust-mgmt", "RealizationRelationship", "Legacy Corporate CRM"),
        
        # Payments Capability realized by BOTH Stripe and Legacy Payment Hub!
        ("rel-13", "app-stripe-engine", "cap-payments", "RealizationRelationship", "Card & Online Gateway"),
        ("rel-14", "app-legacy-pay", "cap-payments", "RealizationRelationship", "Interbank Gateway"),
        
        # Core Account Ledger realized by BOTH Cloud Core and Legacy AS400!
        ("rel-15", "app-cloud-core", "cap-core-acc", "RealizationRelationship", "Real-time Core"),
        ("rel-16", "app-legacy-ledger", "cap-core-acc", "RealizationRelationship", "Batch Accounting"),

        # Fraud Capability
        ("rel-17", "app-feedzai-fraud", "cap-fraud", "RealizationRelationship", "AI Anti-fraud"),
        
        # HR Capability
        ("rel-18", "app-workday", "cap-hr", "RealizationRelationship", "Payroll & People"),
        
        # Doc Capability
        ("rel-19", "app-alfresco-doc", "cap-doc", "RealizationRelationship", "DMS & Contracts"),

        # Tech -> App (Serving / Hosting)
        ("rel-20", "tech-aws-cluster", "app-cloud-core", "ServingRelationship", "Kubernetes Pods"),
        ("rel-21", "tech-rds-postgres", "app-cloud-core", "ServingRelationship", "Relational Database"),
        ("rel-22", "tech-aws-cluster", "app-feedzai-fraud", "ServingRelationship", "Real-time Worker"),
        ("rel-23", "tech-ibm-z15", "app-legacy-ledger", "ServingRelationship", "CICS/COBOL Host"),
        ("rel-24", "tech-vmware-dc", "app-legacy-crm", "ServingRelationship", "Virtual Machine")
    ]

    for rel_id, src, tgt, r_type, r_name in relations:
        rel = ArchimateRelationship(
            id=rel_id,
            model_id=workspace.id,
            source_id=src,
            target_id=tgt,
            type=r_type,
            name=r_name,
            documentation="",
            properties={}
        )
        db.add(rel)

    # 6. Diagram Views (for React Flow rendering)
    views_data = [
        {
            "id": "view-core-banking-overview",
            "name": "Core Banking & Payment Ecosystem (Overall Architecture)",
            "viewpoint": "Application Usage",
            "documentation": "Overall interaction view between payment channels, core banking, and anti-fraud engines.",
            "view_data": {
                "nodes": [
                    {"id": "v1-node-proc-pay", "element_id": "proc-send-payment", "x": 350, "y": 40, "width": 220, "height": 60, "name": "Process SEPA Payment"},
                    {"id": "v1-node-app-stripe", "element_id": "app-stripe-engine", "x": 100, "y": 180, "width": 200, "height": 70, "name": "Stripe Modern Payment Gateway"},
                    {"id": "v1-node-app-fraud", "element_id": "app-feedzai-fraud", "x": 350, "y": 180, "width": 220, "height": 70, "name": "Feedzai Real-time Fraud Engine"},
                    {"id": "v1-node-app-core", "element_id": "app-cloud-core", "x": 620, "y": 180, "width": 220, "height": 70, "name": "Thought Machine Vault Core"},
                    {"id": "v1-node-app-legpay", "element_id": "app-legacy-pay", "x": 100, "y": 320, "width": 200, "height": 70, "name": "SIA/Nexi Legacy Payment Hub"},
                    {"id": "v1-node-app-legledger", "element_id": "app-legacy-ledger", "x": 620, "y": 320, "width": 220, "height": 70, "name": "Mainframe AS400 Ledger"},
                    {"id": "v1-node-tech-eks", "element_id": "tech-aws-cluster", "x": 350, "y": 320, "width": 220, "height": 70, "name": "AWS EKS Cluster"}
                ],
                "connections": [
                    {"id": "c1", "relationship_id": "rel-6", "source_node_id": "v1-node-app-stripe", "target_node_id": "v1-node-proc-pay"},
                    {"id": "c2", "relationship_id": "rel-8", "source_node_id": "v1-node-app-fraud", "target_node_id": "v1-node-proc-pay"},
                    {"id": "c3", "relationship_id": "rel-4", "source_node_id": "v1-node-app-core", "target_node_id": "v1-node-proc-pay"},
                    {"id": "c4", "relationship_id": "rel-22", "source_node_id": "v1-node-tech-eks", "target_node_id": "v1-node-app-fraud"},
                    {"id": "c5", "relationship_id": "rel-20", "source_node_id": "v1-node-tech-eks", "target_node_id": "v1-node-app-core"}
                ]
            }
        }
    ]

    for v in views_data:
        view = ArchimateView(
            id=v["id"],
            model_id=workspace.id,
            name=v["name"],
            viewpoint=v["viewpoint"],
            documentation=v["documentation"],
            view_data=v["view_data"]
        )
        db.add(view)

    db.commit()
    return workspace.id
