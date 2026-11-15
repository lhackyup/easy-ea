"""
Enrichment script for EasyBank Global ('sample-easybank-ea')
Populates realistic Technology components (SystemSoftware & Nodes) with complete lifecycle/EOL metadata
and creates ArchiMate Serving/Realization relationships to Application Components to power the Obsolescence Radar.
"""

from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.archimate import ModelWorkspace, ArchimateElement, ArchimateRelationship

MODEL_ID = "sample-easybank-ea"

TECHNOLOGY_ELEMENTS = [
    {
        "id": "tech-oracle-10g",
        "name": "Oracle Database 10g R2 Enterprise",
        "type": "SystemSoftware",
        "layer": "Technology",
        "documentation": "RDBMS relazionale legacy adoperato per lo storage transazionale dei moduli CRM e Backoffice storici.",
        "properties": {
            "tech_vendor": "Oracle",
            "tech_version": "10.2.0.5 R2",
            "tech_category": "Database / RDBMS",
            "tech_lifecycle_status": "End of Life / Obsolete",
            "tech_eol_date": "2013-07-31",
            "tech_eoes_date": "2015-12-31",
            "tech_cve_risk": "Critical / Active Exploits",
            "infra_sla_availability": "98.50",
            "infra_rto_hours": "8.0"
        }
    },
    {
        "id": "tech-java-8",
        "name": "Oracle Java SE / OpenJDK 8 Runtime",
        "type": "SystemSoftware",
        "layer": "Technology",
        "documentation": "Ambiente di esecuzione JVM 1.8 legacy per i batch applicativi e i monolitici interni.",
        "properties": {
            "tech_vendor": "Oracle",
            "tech_version": "8u202",
            "tech_category": "Runtime & Programming Language",
            "tech_lifecycle_status": "End of Life / Obsolete",
            "tech_eol_date": "2019-01-15",
            "tech_eoes_date": "2020-12-31",
            "tech_cve_risk": "High",
            "infra_sla_availability": "99.00"
        }
    },
    {
        "id": "tech-tomcat-8",
        "name": "Apache Tomcat 8.5 Servlet Container",
        "type": "SystemSoftware",
        "layer": "Technology",
        "documentation": "Application server Java open source giunto al termine del ciclo di supporto ufficiale ad inizio 2024.",
        "properties": {
            "tech_vendor": "Apache Software Foundation",
            "tech_version": "8.5.99",
            "tech_category": "Application Server / Web Server",
            "tech_lifecycle_status": "End of Life / Obsolete",
            "tech_eol_date": "2024-03-31",
            "tech_eoes_date": "2024-06-30",
            "tech_cve_risk": "High"
        }
    },
    {
        "id": "tech-spring-boot-2",
        "name": "Spring Boot 2.7.x Framework",
        "type": "SystemSoftware",
        "layer": "Technology",
        "documentation": "Framework Java microservizi open source EOL a fine 2023.",
        "properties": {
            "tech_vendor": "VMware Tanzu",
            "tech_version": "2.7.18",
            "tech_category": "Runtime & Programming Language",
            "tech_lifecycle_status": "End of Life / Obsolete",
            "tech_eol_date": "2023-11-24",
            "tech_eoes_date": "2024-02-28",
            "tech_cve_risk": "High"
        }
    },
    {
        "id": "tech-vmware-dc",
        "name": "VMware vSphere 7.0 On-Prem Datacenter",
        "type": "Node",
        "layer": "Technology",
        "documentation": "Cluster di virtualizzazione ESXi 7.0 on-premise in scadenza di supporto standard.",
        "properties": {
            "tech_vendor": "VMware / Broadcom",
            "tech_version": "7.0 U3",
            "tech_category": "Virtualization & Cloud",
            "tech_lifecycle_status": "Approaching EOL",
            "tech_eol_date": "2027-04-02",
            "tech_eoes_date": "2027-10-02",
            "tech_cve_risk": "Medium",
            "infra_sla_availability": "99.50",
            "infra_rto_hours": "4.0",
            "ha_redundancy": "Multi-AZ Redundant"
        }
    },
    {
        "id": "tech-ibm-z15",
        "name": "IBM z15 Enterprise Mainframe",
        "type": "Node",
        "layer": "Technology",
        "documentation": "Piattaforma Mainframe centrale con sistema operativo z/OS per la contabilità generale bancaria.",
        "properties": {
            "tech_vendor": "IBM",
            "tech_version": "z15 Enterprise (z/OS 2.4)",
            "tech_category": "Mainframe Software & OS",
            "tech_lifecycle_status": "Extended Support",
            "tech_eol_date": "2025-06-30",
            "tech_eoes_date": "2027-12-31",
            "tech_cve_risk": "Medium",
            "infra_sla_availability": "99.99",
            "infra_rto_hours": "2.0",
            "ha_redundancy": "Multi-Region Geo-Replicated"
        }
    },
    {
        "id": "tech-kafka-eventmesh",
        "name": "Apache Kafka Confluent Enterprise 3.6",
        "type": "SystemSoftware",
        "layer": "Technology",
        "documentation": "Backbone centrale per streaming di eventi finanziari e telemetria IT4IT.",
        "properties": {
            "tech_vendor": "Confluent / Apache",
            "tech_version": "3.6.1",
            "tech_category": "Middleware & Messaging",
            "tech_lifecycle_status": "Approaching EOL",
            "tech_eol_date": "2027-03-31",
            "tech_eoes_date": "2027-09-30",
            "tech_cve_risk": "Low / Negligible",
            "infra_sla_availability": "99.95"
        }
    },
    {
        "id": "tech-aws-cluster",
        "name": "AWS EKS Kubernetes Cluster (eu-west-1)",
        "type": "Node",
        "layer": "Technology",
        "documentation": "Cluster Kubernetes gestito AWS multi-AZ per il deployment dei microservizi cloud-native.",
        "properties": {
            "tech_vendor": "Amazon Web Services",
            "tech_version": "1.29 Managed",
            "tech_category": "Container & Kubernetes",
            "tech_lifecycle_status": "Supported",
            "tech_eol_date": "2028-05-31",
            "tech_cve_risk": "Low / Negligible",
            "infra_sla_availability": "99.99",
            "infra_rto_hours": "0.5",
            "ha_redundancy": "Multi-AZ Redundant"
        }
    },
    {
        "id": "tech-rds-postgres",
        "name": "AWS Aurora PostgreSQL Enterprise 15",
        "type": "SystemSoftware",
        "layer": "Technology",
        "documentation": "Cluster database Aurora Serverless v2 PostgreSQL ad elevata disponibilità e crittografia KMS.",
        "properties": {
            "tech_vendor": "Amazon Web Services",
            "tech_version": "15.4 Aurora",
            "tech_category": "Database / RDBMS",
            "tech_lifecycle_status": "Supported",
            "tech_eol_date": "2028-02-15",
            "tech_eoes_date": "2029-02-15",
            "tech_cve_risk": "Low / Negligible",
            "infra_sla_availability": "99.99",
            "infra_rto_hours": "0.2"
        }
    },
    {
        "id": "tech-redis-cache",
        "name": "Redis Enterprise In-Memory Cache",
        "type": "SystemSoftware",
        "layer": "Technology",
        "documentation": "Cache distribuita ad alta velocità per token di sessione, antifrode e rate limiting.",
        "properties": {
            "tech_vendor": "Redis Ltd",
            "tech_version": "7.2 Cluster",
            "tech_category": "In-Memory Cache & NoSQL",
            "tech_lifecycle_status": "Supported",
            "tech_eol_date": "2028-06-30",
            "tech_cve_risk": "Low / Negligible",
            "infra_sla_availability": "99.99"
        }
    },
    {
        "id": "tech-spring-boot-3",
        "name": "Spring Boot 3.2.x Cloud Native",
        "type": "SystemSoftware",
        "layer": "Technology",
        "documentation": "Stack moderno Java 17/21 con Spring Boot 3 per microservizi containerizzati su EKS.",
        "properties": {
            "tech_vendor": "VMware Tanzu",
            "tech_version": "3.2.4",
            "tech_category": "Runtime & Programming Language",
            "tech_lifecycle_status": "Supported",
            "tech_eol_date": "2027-11-24",
            "tech_cve_risk": "Low / Negligible"
        }
    }
]

# Map Technology -> Applications
TECH_TO_APP_LINKS = [
    # Legacy apps on EOL stack (Critical DORA risk!)
    ("tech-oracle-10g", "app-legacy-crm", "ServingRelationship", "Database Tier (Oracle 10g EOL)"),
    ("tech-java-8", "app-legacy-crm", "ServingRelationship", "Legacy Java 8 Runtime"),
    ("tech-tomcat-8", "app-legacy-crm", "ServingRelationship", "Tomcat 8.5 Web Container"),
    ("tech-vmware-dc", "app-legacy-crm", "AssignmentRelationship", "VMware On-Prem Hosting"),

    ("tech-oracle-10g", "app-legacy-ledger", "ServingRelationship", "Relational Ledger Data"),
    ("tech-ibm-z15", "app-legacy-ledger", "RealizationRelationship", "Mainframe Computation"),

    ("tech-java-8", "app-legacy-pay", "ServingRelationship", "Legacy Payment Engine Runtime"),
    ("tech-tomcat-8", "app-legacy-pay", "ServingRelationship", "Payment Gateway Web Container"),
    ("tech-vmware-dc", "app-legacy-pay", "AssignmentRelationship", "VMware On-Prem Hosting"),

    ("tech-spring-boot-2", "app-alfresco-doc", "ServingRelationship", "Alfresco Document Backend"),
    ("tech-java-8", "app-alfresco-doc", "ServingRelationship", "Java 8 Runtime"),
    ("tech-vmware-dc", "app-alfresco-doc", "AssignmentRelationship", "VMware Datacenter Hosting"),

    # Modern cloud-native apps (Low risk, supported stack)
    ("tech-aws-cluster", "app-cloud-core", "RealizationRelationship", "Cloud Microservices Cluster"),
    ("tech-rds-postgres", "app-cloud-core", "ServingRelationship", "Core Banking Multi-AZ DB"),
    ("tech-spring-boot-3", "app-cloud-core", "ServingRelationship", "Cloud Native Core Backend"),

    ("tech-aws-cluster", "app-stripe-engine", "ServingRelationship", "EKS Payment Worker Pods"),
    ("tech-kafka-eventmesh", "app-stripe-engine", "ServingRelationship", "Payment Event Streaming"),

    ("tech-aws-cluster", "app-feedzai-fraud", "ServingRelationship", "EKS Real-time Fraud Pods"),
    ("tech-kafka-eventmesh", "app-feedzai-fraud", "ServingRelationship", "High-throughput Transaction Mesh"),
    ("tech-redis-cache", "app-feedzai-fraud", "ServingRelationship", "In-memory Fraud Rule Engine"),

    ("tech-aws-cluster", "app-mobile-retail", "ServingRelationship", "Mobile API Backend Pods"),
    ("tech-redis-cache", "app-mobile-retail", "ServingRelationship", "User Session Cache"),
    ("tech-spring-boot-3", "app-mobile-retail", "ServingRelationship", "Spring Boot API Gateway"),

    # Assign software to nodes
    ("tech-oracle-10g", "tech-vmware-dc", "CompositionRelationship", "Hosted on On-Prem VM"),
    ("tech-java-8", "tech-vmware-dc", "CompositionRelationship", "Installed on VM"),
    ("tech-tomcat-8", "tech-vmware-dc", "CompositionRelationship", "Hosted on VM"),
    ("tech-rds-postgres", "tech-aws-cluster", "ServingRelationship", "VPC Peered DB Cluster")
]


def seed_easybank_tech_risk_portfolio(db: Session, model_id: str = MODEL_ID) -> Dict[str, Any]:
    """Ensures technology components and relationships exist for EasyBank Global."""
    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not model:
        print(f"Model workspace '{model_id}' not found.")
        return {"status": "error", "message": "Model not found"}

    tech_upserted = 0
    for te in TECHNOLOGY_ELEMENTS:
        elem = db.query(ArchimateElement).filter(
            ArchimateElement.id == te["id"],
            ArchimateElement.model_id == model_id
        ).first()

        if not elem:
            elem = ArchimateElement(
                id=te["id"],
                model_id=model_id,
                name=te["name"],
                type=te["type"],
                layer=te["layer"],
                documentation=te["documentation"],
                properties=te["properties"],
                is_reference=False,
                package_id="pkg-apm"
            )
            db.add(elem)
        else:
            elem.name = te["name"]
            elem.documentation = te["documentation"]
            merged = dict(elem.properties or {})
            merged.update(te["properties"])
            elem.properties = merged
            elem.type = te["type"]
            elem.layer = te["layer"]
        tech_upserted += 1

    db.commit()

    rels_created = 0
    for rel_tuple in TECH_TO_APP_LINKS:
        src_id, tgt_id, rel_type, rel_name = rel_tuple
        src = db.query(ArchimateElement).filter(ArchimateElement.id == src_id).first()
        tgt = db.query(ArchimateElement).filter(ArchimateElement.id == tgt_id).first()
        if not src or not tgt:
            continue

        existing_rel = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.model_id == model_id,
            ArchimateRelationship.source_id == src_id,
            ArchimateRelationship.target_id == tgt_id
        ).first()

        if not existing_rel:
            rel_id = f"rel-tech-{src_id.replace('tech-', '')}-{tgt_id.replace('app-', '')}"[:45]
            new_rel = ArchimateRelationship(
                id=rel_id,
                model_id=model_id,
                source_id=src_id,
                target_id=tgt_id,
                type=rel_type,
                name=rel_name,
                properties={"created_by": "tech_risk_seed"}
            )
            db.add(new_rel)
            rels_created += 1

    db.commit()
    return {
        "status": "success",
        "technologies_upserted": tech_upserted,
        "relationships_created": rels_created
    }


if __name__ == "__main__":
    db = SessionLocal()
    res = seed_easybank_tech_risk_portfolio(db)
    print("Seed result:", res)
