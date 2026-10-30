"""
Script to create and populate 10 enterprise ArchiMate viewpoint schemas in EasyBank Global ('sample-easybank-ea', 'EASY')
with full architectural relationships created in DB and linked in diagram view_data and standalone XML:
1. E2E SEPA Instant Payment & Clearing Full-Stack (Layered Viewpoint)
2. Core Banking Platform Functional Realization (Capability Realization Viewpoint)
3. Global Trading Desk Inter-Application Mesh & Dependencies (Application Cooperation Viewpoint)
4. Hybrid Cloud Enterprise Infrastructure Topology (Technology Viewpoint)
5. Residential Mortgage Origination & Underwriting Lineage (Business Process Cooperation Viewpoint)
6. Financial Crime, AML & Compliance Surveillance Mesh (Security & Risk Viewpoint)
7. Enterprise Banking Capability Map & Strategic Alignment (Strategy / Capability Map Viewpoint)
8. Private Banking & Wealth Management Advisory Ecosystem (Application Usage Viewpoint)
9. Corporate Treasury, Cash Pooling & Interbank Settlement (Information / Data Flow Viewpoint)
10. Omnichannel Customer Engagement & Digital Identity Access (Service Realization Viewpoint)
"""

import sys
import os
from typing import Dict, Any, List
from sqlalchemy.orm import Session

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.database import SessionLocal
from app.models.archimate import (
    ModelWorkspace,
    ArchimateElement,
    ArchimateRelationship,
    SchemaFolder,
    ArchiSchema,
    SchemaVersionHistory,
    ArchimateView
)
from app.services.schema_export_service import generate_standalone_archi_xml

MODEL_ID = "sample-easybank-ea"

def seed_viewpoints(db: Session):
    print("=" * 70)
    print("STARTING EASYBANK ENTERPRISE VIEWPOINTS SEEDING (EASY)")
    print("=" * 70)

    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == MODEL_ID).first()
    if not model:
        print(f"Error: Model {MODEL_ID} not found!")
        return

    # ----------------------------------------------------------------------
    # STEP 1: Auxiliary Elements
    # ----------------------------------------------------------------------
    print("\n--> [1/4] Creazione/Verifica elementi ausiliari per i viewpoint...")
    aux_elements = [
        {"id": "actor-pay-clearing", "name": "Direzione Pagamenti & Regolamento Interbancario", "type": "BusinessActor", "layer": "Business", "doc": "Unità operativa responsabile dell'elaborazione flussi SEPA, clearing e settlement interbancario."},
        {"id": "actor-branch-advisor", "name": "Gestore Consulente Filiale Retail", "type": "BusinessActor", "layer": "Business", "doc": "Consulente commerciale di filiale dedicato all'istruttoria del credito ai privati."},
        {"id": "actor-appraiser", "name": "Perito Tecnico Immobiliare Asseverato", "type": "BusinessActor", "layer": "Business", "doc": "Professionista abilitato per la perizia estimativa e asseverazione garanzie ipotecarie."},
        {"id": "actor-credit-underwriter", "name": "Deliberante Fidi & Comitato Crediti", "type": "BusinessActor", "layer": "Business", "doc": "Organo deliberante per la concessione del merito creditizio residenziale e corporate."},
        {"id": "actor-notary", "name": "Studio Notarile Convenzionato", "type": "BusinessActor", "layer": "Business", "doc": "Pubblico ufficiale rogante per la stipula del mutuo e l'iscrizione dell'ipoteca."},
        {"id": "actor-private-banker", "name": "Private Banker Wealth Advisor", "type": "BusinessActor", "layer": "Business", "doc": "Consulente finanziario abilitato all'offerta fuori sede per clienti High Net Worth."},
        {"id": "actor-hnw-client", "name": "Cliente High Net Worth Individual (HNWI)", "type": "BusinessActor", "layer": "Business", "doc": "Cliente private banking titolare di patrimoni e mandati fiduciari complessi."},
        {"id": "event-mortgage-requested", "name": "Richiesta di Mutuo Inoltrata", "type": "BusinessEvent", "layer": "Business", "doc": "Evento scatenato dal cliente o dalla filiale con acquisizione documentazione reddituale."},
        {"id": "event-appraisal-completed", "name": "Perizia Immobiliare Asseverata", "type": "BusinessEvent", "layer": "Business", "doc": "Deposito perizia tecnica con valore di stima e conformità catastale dell'immobile."},
        {"id": "event-credit-approved", "name": "Delibera Creditizia Approvata", "type": "BusinessEvent", "layer": "Business", "doc": "Parere favorevole all'erogazione fidi da parte del comitato crediti."},
        {"id": "event-funds-disbursed", "name": "Saldo Finanziamento Erogato", "type": "BusinessEvent", "layer": "Business", "doc": "Erogazione effettiva dei fondi con addebito sul conto corrente del mutuatario."},
        {"id": "goal-dora-resilience", "name": "Resilienza Operativa Digitale (Regolamento DORA)", "type": "Goal", "layer": "Strategy", "doc": "Piena conformità ai requisiti di continuità operativa, gestione dei rischi ICT e incident reporting UE 2022/2554."},
        {"id": "goal-open-finance", "name": "Espansione Open Finance & Nuove API PSD3", "type": "Goal", "layer": "Strategy", "doc": "Monetizzazione dei dati bancari e interoperabilità con terze parti tramite API aperte e standardizzate."},
        {"id": "goal-cost-rationalization", "name": "Razionalizzazione IT Portfolio & Riduzione TCO", "type": "Goal", "layer": "Strategy", "doc": "Dismissione sistemi legacy duplicati e consolidamento sui sistemi target Invest identificati nella matrice APM."},
        {"id": "data-cash-pool-order", "name": "Dispositivo Girofondo Cash Pooling (camt.053)", "type": "DataObject", "layer": "Application", "doc": "Tracciato contabile per il livellamento della liquidità e zero-balancing intersocietario."},
        {"id": "data-swift-pacs008", "name": "Messaggio Interbancario ISO20022 (pacs.008)", "type": "DataObject", "layer": "Application", "doc": "Messaggio standard di regolamento bonifico bancario su canale SWIFT / RTGS."},
        {"id": "data-treasury-ledger", "name": "Registro Posizioni di Tesoreria Multivaluta", "type": "DataObject", "layer": "Application", "doc": "Registro delle disponibilità liquide, posizioni FX e tassi a vista."},
        {"id": "data-reconciliation-stmt", "name": "Estratto Conto Interbancario Riconciliato", "type": "DataObject", "layer": "Application", "doc": "Riconciliazione automatica saldi contabili verso controparti bancarie e BCE."},
        {"id": "serv-biometric-auth", "name": "Servizio Autenticazione Forte Biometrica (SCA)", "type": "BusinessService", "layer": "Business", "doc": "Servizio di autenticazione sicura a due fattori conforme a PSD2 per canali digitali."},
        {"id": "serv-digital-onboarding", "name": "Servizio Onboarding Digitale e Riconoscimento e-KYC", "type": "BusinessService", "layer": "Business", "doc": "Apertura conto 100% online con video-riconoscimento biometrico e verifica antiriciclaggio."},
        {"id": "serv-qualified-sign", "name": "Servizio Firma Elettronica Qualificata a Norma", "type": "BusinessService", "layer": "Business", "doc": "Sottoscrizione digitale dei contratti bancari con valore legale probatorio ex art. 2702 c.c."}
    ]

    for el_data in aux_elements:
        existing = db.query(ArchimateElement).filter(
            ArchimateElement.id == el_data["id"],
            ArchimateElement.model_id == MODEL_ID
        ).first()
        if not existing:
            elem = ArchimateElement(
                id=el_data["id"],
                model_id=MODEL_ID,
                name=el_data["name"],
                type=el_data["type"],
                layer=el_data["layer"],
                documentation=el_data["doc"],
                properties={"viewpoint_seed": True},
                stereotype_id=None,
                package_id=None,
                is_reference=False
            )
            db.add(elem)
    db.commit()

    # Schema Folder
    folder_vp_arch = db.query(SchemaFolder).filter(SchemaFolder.id == "folder-ea-viewpoints-arch").first()
    if not folder_vp_arch:
        folder_vp_arch = SchemaFolder(
            id="folder-ea-viewpoints-arch",
            model_id=MODEL_ID,
            name="Architetture di Riferimento & Viewpoints ArchiMate",
            order_index=4
        )
        db.add(folder_vp_arch)
        db.commit()

    # ----------------------------------------------------------------------
    # STEP 2: Definition of the 10 Viewpoint Schemas with Verified Element IDs
    # ----------------------------------------------------------------------
    print("\n--> [2/4] Definizione modelli e registrazione relazioni nel grafo ArchiMate...")

    SCHEMAS_DEFINITION = [
        # 1. LAYERED VIEWPOINT
        {
            "id": "schema-layered-sepa-instant",
            "name": "E2E SEPA Instant Payment & Clearing Full-Stack",
            "viewpoint": "Layered",
            "doc": "Architettura a strati end-to-end per l'elaborazione dei bonifici istantanei SEPA (TIPS/RT1). Mostra l'attraversamento dai processi di business ai canali applicativi, la scomposizione nei microservizi interni fino all'infrastruttura tecnologica (Nodi Kubernetes, Database HA, Broker Kafka e modulo HSM di sicurezza).",
            "nodes": [
                {"id": "s1-n1", "element_id": "actor-pay-clearing", "name": "Direzione Pagamenti & Regolamento Interbancario", "type": "BusinessActor", "layer": "Business", "x": 80, "y": 40, "width": 260, "height": 65},
                {"id": "s1-n2", "element_id": "proc-sepa-instant", "name": "Elaborazione Bonifici Istantanei SEPA (TIPS / RT1)", "type": "BusinessProcess", "layer": "Business", "x": 420, "y": 40, "width": 320, "height": 65},
                {"id": "s1-n3", "element_id": "app-sepa-instant", "name": "RT1 & TIPS SEPA Instant Payment Engine", "type": "ApplicationComponent", "layer": "Application", "x": 120, "y": 170, "width": 280, "height": 70},
                {"id": "s1-n4", "element_id": "app-stripe-engine", "name": "Stripe Modern Payment Gateway", "type": "ApplicationComponent", "layer": "Application", "x": 470, "y": 170, "width": 260, "height": 70},
                {"id": "s1-n5", "element_id": "comp-app-sepa-instant-gw", "name": "RT1 & TIPS [API Gateway & BFF Service]", "type": "ApplicationComponent", "layer": "Application", "x": 50, "y": 300, "width": 210, "height": 65},
                {"id": "s1-n6", "element_id": "comp-app-sepa-instant-core", "name": "RT1 & TIPS [Core Domain Logic Engine]", "type": "ApplicationComponent", "layer": "Application", "x": 280, "y": 300, "width": 210, "height": 65},
                {"id": "s1-n7", "element_id": "comp-app-sepa-instant-broker", "name": "RT1 & TIPS [Integration & Event Broker]", "type": "ApplicationComponent", "layer": "Application", "x": 510, "y": 300, "width": 210, "height": 65},
                {"id": "s1-n8", "element_id": "comp-app-sepa-instant-data", "name": "RT1 & TIPS [Data Access & Persistence Layer]", "type": "ApplicationComponent", "layer": "Application", "x": 740, "y": 300, "width": 210, "height": 65},
                {"id": "s1-n9", "element_id": "node-k8s-prod-worker-01", "name": "Kubernetes Production Worker Node 01", "type": "Node", "layer": "Technology", "x": 50, "y": 440, "width": 220, "height": 70},
                {"id": "s1-n10", "element_id": "sys-broker-kafka-prod-01", "name": "Apache Kafka Financial Event Streaming Broker", "type": "SystemSoftware", "layer": "Technology", "x": 290, "y": 440, "width": 220, "height": 70},
                {"id": "s1-n11", "element_id": "sys-db-postgres-ha-01", "name": "PostgreSQL 16 High-Availability Cluster", "type": "SystemSoftware", "layer": "Technology", "x": 530, "y": 440, "width": 220, "height": 70},
                {"id": "s1-n12", "element_id": "dev-hsm-thales-payshield-01", "name": "Thales payShield 10K Dedicated Banking HSM", "type": "Device", "layer": "Technology", "x": 770, "y": 440, "width": 200, "height": 70}
            ],
            "connections": [
                {"src": "actor-pay-clearing", "tgt": "proc-sepa-instant", "type": "AssignmentRelationship", "name": "Assegnato a Esecuzione"},
                {"src": "app-sepa-instant", "tgt": "proc-sepa-instant", "type": "ServingRelationship", "name": "Eroga Servizio TIPS"},
                {"src": "app-stripe-engine", "tgt": "proc-sepa-instant", "type": "ServingRelationship", "name": "Gateway Bonifici"},
                {"src": "app-sepa-instant", "tgt": "comp-app-sepa-instant-gw", "type": "CompositionRelationship", "name": "Comprende Gateway"},
                {"src": "app-sepa-instant", "tgt": "comp-app-sepa-instant-core", "type": "CompositionRelationship", "name": "Comprende Core"},
                {"src": "app-sepa-instant", "tgt": "comp-app-sepa-instant-broker", "type": "CompositionRelationship", "name": "Comprende Broker"},
                {"src": "app-sepa-instant", "tgt": "comp-app-sepa-instant-data", "type": "CompositionRelationship", "name": "Comprende Data"},
                {"src": "comp-app-sepa-instant-gw", "tgt": "comp-app-sepa-instant-core", "type": "FlowRelationship", "name": "Inoltro Richiesta SCT Inst"},
                {"src": "comp-app-sepa-instant-core", "tgt": "comp-app-sepa-instant-broker", "type": "FlowRelationship", "name": "Notifica Evento Kafka"},
                {"src": "comp-app-sepa-instant-core", "tgt": "comp-app-sepa-instant-data", "type": "FlowRelationship", "name": "Scrittura Transazione"},
                {"src": "node-k8s-prod-worker-01", "tgt": "comp-app-sepa-instant-gw", "type": "AssignmentRelationship", "name": "Esegue Container"},
                {"src": "sys-broker-kafka-prod-01", "tgt": "comp-app-sepa-instant-broker", "type": "ServingRelationship", "name": "Streaming Eventi SEPA"},
                {"src": "sys-db-postgres-ha-01", "tgt": "comp-app-sepa-instant-data", "type": "AssignmentRelationship", "name": "Persistenza Transazioni"},
                {"src": "dev-hsm-thales-payshield-01", "tgt": "comp-app-sepa-instant-core", "type": "ServingRelationship", "name": "Cifratura PIN & Chiavi"}
            ]
        },

        # 2. CAPABILITY REALIZATION VIEWPOINT
        {
            "id": "schema-cap-realization-vault",
            "name": "Core Banking Platform Functional Realization",
            "viewpoint": "Capability Realization",
            "doc": "Mappatura delle capability e delle funzionalità di business coperte dalla piattaforma Core Banking (Thought Machine Vault Core). Evidenzia la scomposizione modulare interna e le relazioni di realizzazione verso le capacità strategiche.",
            "nodes": [
                {"id": "s2-n1", "element_id": "cap-core-acc", "name": "Core Account & General Ledger Management", "type": "Capability", "layer": "Strategy", "x": 120, "y": 40, "width": 320, "height": 65},
                {"id": "s2-n2", "element_id": "cap-payments", "name": "Payment & Transaction Processing", "type": "Capability", "layer": "Strategy", "x": 520, "y": 40, "width": 300, "height": 65},
                {"id": "s2-n3", "element_id": "app-cloud-core", "name": "Thought Machine Vault Core", "type": "ApplicationComponent", "layer": "Application", "x": 300, "y": 170, "width": 340, "height": 75},
                {"id": "s2-n4", "element_id": "comp-app-cloud-core-ui", "name": "Vault Core [Web & Mobile UI Frontend]", "type": "ApplicationComponent", "layer": "Application", "x": 40, "y": 310, "width": 200, "height": 65},
                {"id": "s2-n5", "element_id": "comp-app-cloud-core-gw", "name": "Vault Core [API Gateway & BFF Service]", "type": "ApplicationComponent", "layer": "Application", "x": 260, "y": 310, "width": 200, "height": 65},
                {"id": "s2-n6", "element_id": "comp-app-cloud-core-core", "name": "Vault Core [Core Domain Logic Engine]", "type": "ApplicationComponent", "layer": "Application", "x": 480, "y": 310, "width": 200, "height": 65},
                {"id": "s2-n7", "element_id": "comp-app-cloud-core-broker", "name": "Vault Core [Integration & Event Broker]", "type": "ApplicationComponent", "layer": "Application", "x": 700, "y": 310, "width": 200, "height": 65},
                {"id": "s2-n8", "element_id": "comp-app-cloud-core-data", "name": "Vault Core [Data Access & Persistence Layer]", "type": "ApplicationComponent", "layer": "Application", "x": 920, "y": 310, "width": 200, "height": 65}
            ],
            "connections": [
                {"src": "app-cloud-core", "tgt": "cap-core-acc", "type": "RealizationRelationship", "name": "Realizza Ledger Multi-Valuta"},
                {"src": "app-cloud-core", "tgt": "cap-payments", "type": "RealizationRelationship", "name": "Realizza Transato Contabile"},
                {"src": "app-cloud-core", "tgt": "comp-app-cloud-core-ui", "type": "CompositionRelationship", "name": "Comprende Frontend"},
                {"src": "app-cloud-core", "tgt": "comp-app-cloud-core-gw", "type": "CompositionRelationship", "name": "Comprende API GW"},
                {"src": "app-cloud-core", "tgt": "comp-app-cloud-core-core", "type": "CompositionRelationship", "name": "Comprende Smart Contracts Engine"},
                {"src": "app-cloud-core", "tgt": "comp-app-cloud-core-broker", "type": "CompositionRelationship", "name": "Comprende Streaming Kafka"},
                {"src": "app-cloud-core", "tgt": "comp-app-cloud-core-data", "type": "CompositionRelationship", "name": "Comprende Persistenza Spanner"},
                {"src": "comp-app-cloud-core-ui", "tgt": "comp-app-cloud-core-gw", "type": "ServingRelationship", "name": "Invocazione REST/GraphQL"},
                {"src": "comp-app-cloud-core-gw", "tgt": "comp-app-cloud-core-core", "type": "FlowRelationship", "name": "Regole di Conto"},
                {"src": "comp-app-cloud-core-core", "tgt": "cap-core-acc", "type": "RealizationRelationship", "name": "Calcolo Saldi & Interessi Real-Time"},
                {"src": "comp-app-cloud-core-core", "tgt": "comp-app-cloud-core-broker", "type": "FlowRelationship", "name": "Mutazioni Saldo"},
                {"src": "comp-app-cloud-core-core", "tgt": "comp-app-cloud-core-data", "type": "FlowRelationship", "name": "Scrittura Snapshot Saldi"}
            ]
        },

        # 3. APPLICATION COOPERATION VIEWPOINT
        {
            "id": "schema-app-cooperation-easytrade",
            "name": "Global Trading Desk Inter-Application Mesh & Dependencies",
            "viewpoint": "Application Cooperation",
            "doc": "Topologia di integrazione e cooperazione applicativa incentrata sul sistema di Trading Desk (EasyTrade Global Trading Desk). Mostra come i singoli sotto-componenti interni dell'applicazione dialogano con l'ecosistema circostante.",
            "nodes": [
                {"id": "s3-n1", "element_id": "app-eb-75", "name": "Keycloak Customer Identity & Access Management", "type": "ApplicationComponent", "layer": "Application", "x": 40, "y": 60, "width": 240, "height": 65},
                {"id": "s3-n2", "element_id": "app-apigee-gateway", "name": "Google Cloud Apigee Enterprise API Gateway", "type": "ApplicationComponent", "layer": "Application", "x": 40, "y": 180, "width": 240, "height": 65},
                {"id": "s3-n3", "element_id": "app-eb-78", "name": "Bloomberg Terminal Market Feed Connector", "type": "ApplicationComponent", "layer": "Application", "x": 40, "y": 300, "width": 240, "height": 65},
                {"id": "s3-n4", "element_id": "app-market-data-refinitiv", "name": "LSEG Refinitiv Real-Time Market Feed", "type": "ApplicationComponent", "layer": "Application", "x": 40, "y": 420, "width": 240, "height": 65},
                {"id": "s3-n5", "element_id": "app-eb-68", "name": "EasyTrade Global Trading Desk", "type": "ApplicationComponent", "layer": "Application", "x": 350, "y": 40, "width": 260, "height": 70},
                {"id": "s3-n6", "element_id": "comp-app-eb-68-ui", "name": "EasyTrade [Web & Mobile UI Frontend]", "type": "ApplicationComponent", "layer": "Application", "x": 350, "y": 140, "width": 240, "height": 55},
                {"id": "s3-n7", "element_id": "comp-app-eb-68-gw", "name": "EasyTrade [API Gateway & BFF Service]", "type": "ApplicationComponent", "layer": "Application", "x": 350, "y": 220, "width": 240, "height": 55},
                {"id": "s3-n8", "element_id": "comp-app-eb-68-core", "name": "EasyTrade [Core Domain Logic Engine]", "type": "ApplicationComponent", "layer": "Application", "x": 350, "y": 300, "width": 240, "height": 55},
                {"id": "s3-n9", "element_id": "comp-app-eb-68-broker", "name": "EasyTrade [Integration & Event Broker]", "type": "ApplicationComponent", "layer": "Application", "x": 350, "y": 380, "width": 240, "height": 55},
                {"id": "s3-n10", "element_id": "comp-app-eb-68-data", "name": "EasyTrade [Data Access & Persistence Layer]", "type": "ApplicationComponent", "layer": "Application", "x": 350, "y": 460, "width": 240, "height": 55},
                {"id": "s3-n11", "element_id": "app-eb-81", "name": "Temenos Multifonds NAV Calculation", "type": "ApplicationComponent", "layer": "Application", "x": 670, "y": 120, "width": 250, "height": 65},
                {"id": "s3-n12", "element_id": "app-murex-treasury", "name": "Murex MX.3 Treasury & Capital Markets Platform", "type": "ApplicationComponent", "layer": "Application", "x": 670, "y": 250, "width": 250, "height": 65},
                {"id": "s3-n13", "element_id": "app-snowflake-dwh", "name": "Snowflake Enterprise Data Lakehouse", "type": "ApplicationComponent", "layer": "Application", "x": 670, "y": 380, "width": 250, "height": 65}
            ],
            "connections": [
                {"src": "app-eb-75", "tgt": "comp-app-eb-68-ui", "type": "ServingRelationship", "name": "Autenticazione OIDC & MFA"},
                {"src": "app-apigee-gateway", "tgt": "comp-app-eb-68-gw", "type": "FlowRelationship", "name": "Routing & Rate Limiting"},
                {"src": "app-eb-78", "tgt": "comp-app-eb-68-core", "type": "FlowRelationship", "name": "Order Book Feed"},
                {"src": "app-market-data-refinitiv", "tgt": "comp-app-eb-68-core", "type": "FlowRelationship", "name": "Tick Data & Prezzi"},
                {"src": "comp-app-eb-68-ui", "tgt": "comp-app-eb-68-gw", "type": "FlowRelationship", "name": "Ordine Compravendita"},
                {"src": "comp-app-eb-68-gw", "tgt": "comp-app-eb-68-core", "type": "FlowRelationship", "name": "Validazione Limiti Fidi"},
                {"src": "comp-app-eb-68-core", "tgt": "comp-app-eb-68-broker", "type": "FlowRelationship", "name": "Eseguiti di Mercato"},
                {"src": "comp-app-eb-68-broker", "tgt": "app-eb-81", "type": "FlowRelationship", "name": "Valorizzazione NAV"},
                {"src": "comp-app-eb-68-broker", "tgt": "app-murex-treasury", "type": "FlowRelationship", "name": "Posizioni Derivati"},
                {"src": "comp-app-eb-68-core", "tgt": "comp-app-eb-68-data", "type": "FlowRelationship", "name": "Persistenza Ordine"},
                {"src": "comp-app-eb-68-data", "tgt": "app-snowflake-dwh", "type": "FlowRelationship", "name": "Replicazione Dati Storici"}
            ]
        },

        # 4. TECHNOLOGY VIEWPOINT
        {
            "id": "schema-tech-infra-hybrid",
            "name": "Hybrid Cloud Enterprise Infrastructure Topology",
            "viewpoint": "Technology",
            "doc": "Topologia dell'infrastruttura tecnologica enterprise (Hybrid Cloud AWS + On-Premise privato). Mostra nodi di calcolo Kubernetes, hypervisor VMware ESXi, database engine Oracle RAC Exadata e PostgreSQL HA, message broker Kafka, apparati di storage SAN Flash PureStorage, firewall di perimetro Palo Alto e moduli crittografici HSM.",
            "nodes": [
                {"id": "s4-n1", "element_id": "node-k8s-prod-worker-01", "name": "Kubernetes Production Worker Node 01", "type": "Node", "layer": "Technology", "x": 60, "y": 40, "width": 240, "height": 65},
                {"id": "s4-n2", "element_id": "node-k8s-prod-worker-02", "name": "Kubernetes Production Worker Node 02", "type": "Node", "layer": "Technology", "x": 330, "y": 40, "width": 240, "height": 65},
                {"id": "s4-n3", "element_id": "node-ocp-fin-03", "name": "Red Hat OpenShift Bare-Metal Node 03", "type": "Node", "layer": "Technology", "x": 600, "y": 40, "width": 250, "height": 65},
                {"id": "s4-n4", "element_id": "node-vm-rhel-app-01", "name": "VMware vSphere VM Linux App Server 01", "type": "Node", "layer": "Technology", "x": 880, "y": 40, "width": 250, "height": 65},
                {"id": "s4-n5", "element_id": "sys-broker-kafka-prod-01", "name": "Apache Kafka Event Streaming Broker", "type": "SystemSoftware", "layer": "Technology", "x": 80, "y": 180, "width": 220, "height": 65},
                {"id": "s4-n6", "element_id": "sys-cache-redis-01", "name": "Redis In-Memory Distributed Cache", "type": "SystemSoftware", "layer": "Technology", "x": 330, "y": 180, "width": 230, "height": 65},
                {"id": "s4-n7", "element_id": "sys-db-oracle-rac-01", "name": "Oracle RAC 19c Enterprise Database Instance", "type": "SystemSoftware", "layer": "Technology", "x": 600, "y": 180, "width": 230, "height": 65},
                {"id": "s4-n8", "element_id": "sys-db-postgres-ha-01", "name": "PostgreSQL 16 High-Availability Cluster", "type": "SystemSoftware", "layer": "Technology", "x": 860, "y": 180, "width": 220, "height": 65},
                {"id": "s4-n9", "element_id": "dev-fw-paloalto-pa5400-01", "name": "Palo Alto Networks PA-5450 Firewall", "type": "Device", "layer": "Technology", "x": 80, "y": 320, "width": 250, "height": 65},
                {"id": "s4-n10", "element_id": "dev-lb-f5-bigip-01", "name": "F5 BIG-IP Application Delivery Controller", "type": "Device", "layer": "Technology", "x": 360, "y": 320, "width": 250, "height": 65},
                {"id": "s4-n11", "element_id": "dev-hsm-thales-payshield-01", "name": "Thales payShield 10K Dedicated Banking HSM", "type": "Device", "layer": "Technology", "x": 640, "y": 320, "width": 240, "height": 65},
                {"id": "s4-n12", "element_id": "svc-tech-netapp-san-storage", "name": "NetApp All-Flash SAN Enterprise Storage", "type": "TechnologyService", "layer": "Technology", "x": 910, "y": 320, "width": 240, "height": 65}
            ],
            "connections": [
                {"src": "node-k8s-prod-worker-01", "tgt": "sys-broker-kafka-prod-01", "type": "AssignmentRelationship", "name": "Ospita Broker"},
                {"src": "node-k8s-prod-worker-02", "tgt": "sys-cache-redis-01", "type": "AssignmentRelationship", "name": "Ospita Cache In-Memory"},
                {"src": "node-ocp-fin-03", "tgt": "sys-db-oracle-rac-01", "type": "AssignmentRelationship", "name": "Esegue Istanza RAC"},
                {"src": "node-vm-rhel-app-01", "tgt": "sys-db-postgres-ha-01", "type": "AssignmentRelationship", "name": "Esegue VM Postgres"},
                {"src": "dev-fw-paloalto-pa5400-01", "tgt": "node-k8s-prod-worker-01", "type": "ServingRelationship", "name": "Ispezione Traffico Ingress"},
                {"src": "dev-lb-f5-bigip-01", "tgt": "node-k8s-prod-worker-02", "type": "ServingRelationship", "name": "Bilanciamento del Carico"},
                {"src": "dev-hsm-thales-payshield-01", "tgt": "node-ocp-fin-03", "type": "ServingRelationship", "name": "Offload Cifratura Hardware"},
                {"src": "svc-tech-netapp-san-storage", "tgt": "sys-db-oracle-rac-01", "type": "ServingRelationship", "name": "Volumi NVMe Fibra Canale"}
            ]
        },

        # 5. BUSINESS PROCESS COOPERATION VIEWPOINT
        {
            "id": "schema-bp-coop-mortgage",
            "name": "Residential Mortgage Origination & Underwriting Lineage",
            "viewpoint": "Business Process Cooperation",
            "doc": "Cooperazione inter-funzionale end-to-end per l'istruttoria, la delibera e l'erogazione di mutui ipotecari residenziali. Illustra la sequenza di processi di business, gli eventi scatenanti e la collaborazione tra attori.",
            "nodes": [
                {"id": "s5-n1", "element_id": "actor-branch-advisor", "name": "Gestore Consulente Filiale Retail", "type": "BusinessActor", "layer": "Business", "x": 60, "y": 40, "width": 240, "height": 65},
                {"id": "s5-n2", "element_id": "actor-appraiser", "name": "Perito Tecnico Immobiliare Asseverato", "type": "BusinessActor", "layer": "Business", "x": 340, "y": 40, "width": 240, "height": 65},
                {"id": "s5-n3", "element_id": "actor-credit-underwriter", "name": "Deliberante Fidi & Comitato Crediti", "type": "BusinessActor", "layer": "Business", "x": 620, "y": 40, "width": 240, "height": 65},
                {"id": "s5-n4", "element_id": "actor-notary", "name": "Studio Notarile Convenzionato", "type": "BusinessActor", "layer": "Business", "x": 900, "y": 40, "width": 240, "height": 65},
                {"id": "s5-n5", "element_id": "proc-mortgage-origination", "name": "Istruttoria e Delibera Mutui Ipotecari", "type": "BusinessProcess", "layer": "Business", "x": 60, "y": 180, "width": 250, "height": 65},
                {"id": "s5-n6", "element_id": "proc-property-appraisal", "name": "Perizia Immobiliare e Valutazione Garanzie", "type": "BusinessProcess", "layer": "Business", "x": 340, "y": 180, "width": 250, "height": 65},
                {"id": "s5-n7", "element_id": "proc-instant-personal-loan", "name": "Valutazione del Merito Creditizio e Scoring", "type": "BusinessProcess", "layer": "Business", "x": 620, "y": 180, "width": 250, "height": 65},
                {"id": "s5-n8", "element_id": "proc-mortgage-disbursement", "name": "Erogazione Fondi e Stipula Notarile", "type": "BusinessProcess", "layer": "Business", "x": 900, "y": 180, "width": 250, "height": 65},
                {"id": "s5-n9", "element_id": "event-mortgage-requested", "name": "Richiesta di Mutuo Inoltrata", "type": "BusinessEvent", "layer": "Business", "x": 70, "y": 320, "width": 220, "height": 55},
                {"id": "s5-n10", "element_id": "event-appraisal-completed", "name": "Perizia Immobiliare Asseverata", "type": "BusinessEvent", "layer": "Business", "x": 350, "y": 320, "width": 220, "height": 55},
                {"id": "s5-n11", "element_id": "event-credit-approved", "name": "Delibera Creditizia Approvata", "type": "BusinessEvent", "layer": "Business", "x": 630, "y": 320, "width": 220, "height": 55},
                {"id": "s5-n12", "element_id": "event-funds-disbursed", "name": "Saldo Finanziamento Erogato", "type": "BusinessEvent", "layer": "Business", "x": 910, "y": 320, "width": 220, "height": 55}
            ],
            "connections": [
                {"src": "actor-branch-advisor", "tgt": "proc-mortgage-origination", "type": "AssignmentRelationship", "name": "Compila Domanda"},
                {"src": "event-mortgage-requested", "tgt": "proc-mortgage-origination", "type": "TriggeringRelationship", "name": "Avvia Istruttoria"},
                {"src": "proc-mortgage-origination", "tgt": "proc-property-appraisal", "type": "TriggeringRelationship", "name": "Richiede Perizia"},
                {"src": "actor-appraiser", "tgt": "proc-property-appraisal", "type": "AssignmentRelationship", "name": "Esegue Sopralluogo"},
                {"src": "proc-property-appraisal", "tgt": "event-appraisal-completed", "type": "TriggeringRelationship", "name": "Consegna Perizia"},
                {"src": "event-appraisal-completed", "tgt": "proc-instant-personal-loan", "type": "TriggeringRelationship", "name": "Inoltro a Delibera"},
                {"src": "actor-credit-underwriter", "tgt": "proc-instant-personal-loan", "type": "AssignmentRelationship", "name": "Assegna Rating Fidi"},
                {"src": "proc-instant-personal-loan", "tgt": "event-credit-approved", "type": "TriggeringRelationship", "name": "Delibera Favorevole"},
                {"src": "event-credit-approved", "tgt": "proc-mortgage-disbursement", "type": "TriggeringRelationship", "name": "Avvio Pratica Notarile"},
                {"src": "actor-notary", "tgt": "proc-mortgage-disbursement", "type": "AssignmentRelationship", "name": "Rogito e Ipoteca"},
                {"src": "proc-mortgage-disbursement", "tgt": "event-funds-disbursed", "type": "TriggeringRelationship", "name": "Svincolo Saldo"}
            ]
        },

        # 6. SECURITY & RISK VIEWPOINT
        {
            "id": "schema-sec-risk-compliance",
            "name": "Financial Crime, AML & Compliance Surveillance Mesh",
            "viewpoint": "Security & Risk",
            "doc": "Architettura di sicurezza, antiriciclaggio e conformità normativa (DORA, BCE, Banca d'Italia). Mostra l'interazione tra i motori transazionali di rilevazione frodi in tempo reale, i sistemi di screening liste PEP/sanzioni internazionali e la reportistica di vigilanza.",
            "nodes": [
                {"id": "s6-n1", "element_id": "cap-fraud", "name": "Fraud Detection & Anti-Financial Crime", "type": "Capability", "layer": "Strategy", "x": 120, "y": 40, "width": 280, "height": 65},
                {"id": "s6-n2", "element_id": "cap-aml-screening", "name": "Anti-Money Laundering (AML) & PEP Screening", "type": "Capability", "layer": "Strategy", "x": 440, "y": 40, "width": 310, "height": 65},
                {"id": "s6-n3", "element_id": "cap-reg-reporting", "name": "Supervisory & Regulatory Reporting", "type": "Capability", "layer": "Strategy", "x": 780, "y": 40, "width": 280, "height": 65},
                {"id": "s6-n4", "element_id": "app-feedzai-fraud", "name": "Feedzai Real-time Fraud Engine", "type": "ApplicationComponent", "layer": "Application", "x": 60, "y": 180, "width": 240, "height": 70},
                {"id": "s6-n5", "element_id": "app-eb-77", "name": "SAS Anti-Money Laundering & PEP Surveillance", "type": "ApplicationComponent", "layer": "Application", "x": 330, "y": 180, "width": 260, "height": 70},
                {"id": "s6-n6", "element_id": "app-aml-actimize", "name": "NICE Actimize Anti-Money Laundering (AML)", "type": "ApplicationComponent", "layer": "Application", "x": 610, "y": 180, "width": 250, "height": 70},
                {"id": "s6-n7", "element_id": "app-sanctions-firco", "name": "Fircosoft Sanctions & PEP Real-Time Screening", "type": "ApplicationComponent", "layer": "Application", "x": 880, "y": 180, "width": 250, "height": 70},
                {"id": "s6-n8", "element_id": "app-splunk-siem", "name": "Splunk Enterprise SIEM & SOC Security Hub", "type": "ApplicationComponent", "layer": "Application", "x": 180, "y": 320, "width": 260, "height": 70},
                {"id": "s6-n9", "element_id": "app-eb-73", "name": "Puma Supervisory Reporting Engine", "type": "ApplicationComponent", "layer": "Application", "x": 510, "y": 320, "width": 250, "height": 70},
                {"id": "s6-n10", "element_id": "app-internal-audit-teammate", "name": "TeamMate Internal Audit & Risk Assessment", "type": "ApplicationComponent", "layer": "Application", "x": 790, "y": 320, "width": 260, "height": 70}
            ],
            "connections": [
                {"src": "app-feedzai-fraud", "tgt": "cap-fraud", "type": "RealizationRelationship", "name": "Real-time Scoring Frodi"},
                {"src": "app-eb-77", "tgt": "cap-aml-screening", "type": "RealizationRelationship", "name": "Sorveglianza Transazioni AML"},
                {"src": "app-eb-73", "tgt": "cap-reg-reporting", "type": "RealizationRelationship", "name": "Matrice Segnalazioni BDI"},
                {"src": "app-feedzai-fraud", "tgt": "app-splunk-siem", "type": "FlowRelationship", "name": "Log Allarmi Frode (SIEM)"},
                {"src": "app-eb-77", "tgt": "app-eb-73", "type": "FlowRelationship", "name": "Flusso Segnalazioni S.O.S."},
                {"src": "app-sanctions-firco", "tgt": "app-eb-77", "type": "FlowRelationship", "name": "Liste Sanzioni & Blocco Bonifici"},
                {"src": "app-aml-actimize", "tgt": "app-eb-73", "type": "FlowRelationship", "name": "Quadratura Controlli AML"},
                {"src": "app-internal-audit-teammate", "tgt": "app-eb-77", "type": "ServingRelationship", "name": "Audit Trail Conformità"}
            ]
        },

        # 7. STRATEGY / CAPABILITY MAP VIEWPOINT
        {
            "id": "schema-strategy-capability-map",
            "name": "Enterprise Banking Capability Map & Strategic Alignment",
            "viewpoint": "Strategy / Capability Map",
            "doc": "Mappa strategica delle capability bancarie di EasyBank Global collegata ai Goal e Driver di trasformazione digitale (Resilienza operativa DORA, Open Finance PSD3 e Razionalizzazione costi TCO).",
            "nodes": [
                {"id": "s7-n1", "element_id": "goal-dora-resilience", "name": "Resilienza Operativa Digitale (Regolamento DORA)", "type": "Goal", "layer": "Strategy", "x": 60, "y": 40, "width": 310, "height": 65},
                {"id": "s7-n2", "element_id": "goal-open-finance", "name": "Espansione Open Finance & Nuove API PSD3", "type": "Goal", "layer": "Strategy", "x": 420, "y": 40, "width": 300, "height": 65},
                {"id": "s7-n3", "element_id": "goal-cost-rationalization", "name": "Razionalizzazione IT Portfolio & Riduzione TCO", "type": "Goal", "layer": "Strategy", "x": 770, "y": 40, "width": 310, "height": 65},
                {"id": "s7-n4", "element_id": "cap-core-acc", "name": "Core Account & General Ledger Management", "type": "Capability", "layer": "Strategy", "x": 60, "y": 180, "width": 240, "height": 65},
                {"id": "s7-n5", "element_id": "cap-payments", "name": "Payment & Transaction Processing", "type": "Capability", "layer": "Strategy", "x": 330, "y": 180, "width": 240, "height": 65},
                {"id": "s7-n6", "element_id": "cap-integration-platform", "name": "Integration Middleware & API Gateway", "type": "Capability", "layer": "Strategy", "x": 600, "y": 180, "width": 240, "height": 65},
                {"id": "s7-n7", "element_id": "cap-cyber-defense", "name": "Cybersecurity, SIEM & Threat Detection", "type": "Capability", "layer": "Strategy", "x": 870, "y": 180, "width": 240, "height": 65},
                {"id": "s7-n8", "element_id": "cap-securities-trading", "name": "Securities Trading, OMS & Market Feeds", "type": "Capability", "layer": "Strategy", "x": 60, "y": 320, "width": 240, "height": 65},
                {"id": "s7-n9", "element_id": "cap-mortgage-orig", "name": "Mortgage & Loan Origination / Underwriting", "type": "Capability", "layer": "Strategy", "x": 330, "y": 320, "width": 240, "height": 65},
                {"id": "s7-n10", "element_id": "cap-wealth-portfolio", "name": "Wealth Portfolio Management & Asset Allocation", "type": "Capability", "layer": "Strategy", "x": 600, "y": 320, "width": 240, "height": 65},
                {"id": "s7-n11", "element_id": "cap-reg-reporting", "name": "Supervisory & Regulatory Reporting", "type": "Capability", "layer": "Strategy", "x": 870, "y": 320, "width": 240, "height": 65}
            ],
            "connections": [
                {"src": "cap-cyber-defense", "tgt": "goal-dora-resilience", "type": "RealizationRelationship", "name": "Conformità ICT Risk"},
                {"src": "cap-integration-platform", "tgt": "goal-open-finance", "type": "RealizationRelationship", "name": "Abilita API Banking"},
                {"src": "cap-core-acc", "tgt": "goal-cost-rationalization", "type": "RealizationRelationship", "name": "Consolidamento Core Cloud"},
                {"src": "cap-payments", "tgt": "goal-cost-rationalization", "type": "RealizationRelationship", "name": "Dismissione Legacy SIA Hub"},
                {"src": "cap-reg-reporting", "tgt": "goal-dora-resilience", "type": "RealizationRelationship", "name": "Segnalazione Incidenti EBA"},
                {"src": "cap-securities-trading", "tgt": "goal-open-finance", "type": "RealizationRelationship", "name": "Trading Open API"},
                {"src": "cap-mortgage-orig", "tgt": "goal-cost-rationalization", "type": "RealizationRelationship", "name": "Underwriting Automatico"},
                {"src": "cap-wealth-portfolio", "tgt": "goal-open-finance", "type": "RealizationRelationship", "name": "Robo-Advisory Integrato"}
            ]
        },

        # 8. APPLICATION USAGE VIEWPOINT
        {
            "id": "schema-app-usage-wealth",
            "name": "Private Banking & Wealth Management Advisory Ecosystem",
            "viewpoint": "Application Usage",
            "doc": "Ecosistema applicativo a supporto del Private Banking. Mostra come le applicazioni di Portfolio Management, il Copilot AI, lo scoring ESG e la firma qualificata servono consulenti e clienti nell'erogazione della consulenza e conformità MiFID II.",
            "nodes": [
                {"id": "s8-n1", "element_id": "actor-private-banker", "name": "Private Banker Wealth Advisor", "type": "BusinessActor", "layer": "Business", "x": 200, "y": 40, "width": 260, "height": 65},
                {"id": "s8-n2", "element_id": "actor-hnw-client", "name": "Cliente High Net Worth Individual", "type": "BusinessActor", "layer": "Business", "x": 620, "y": 40, "width": 260, "height": 65},
                {"id": "s8-n3", "element_id": "proc-robo-advisory", "name": "Consulenza Finanziaria e Ribilanciamento Portafogli", "type": "BusinessProcess", "layer": "Business", "x": 160, "y": 170, "width": 340, "height": 65},
                {"id": "s8-n4", "element_id": "proc-mifid-profiling", "name": "Profilazione Finanziaria MIFID II e ESG", "type": "BusinessProcess", "layer": "Business", "x": 580, "y": 170, "width": 340, "height": 65},
                {"id": "s8-n5", "element_id": "app-eb-79", "name": "Avaloq Wealth Core Portfolio Manager", "type": "ApplicationComponent", "layer": "Application", "x": 50, "y": 310, "width": 250, "height": 70},
                {"id": "s8-n6", "element_id": "app-ai-copilot-wealth", "name": "Generative AI Wealth Advisory Copilot", "type": "ApplicationComponent", "layer": "Application", "x": 320, "y": 310, "width": 250, "height": 70},
                {"id": "s8-n7", "element_id": "app-esg-scoring", "name": "Clarity AI ESG Portfolio Risk Scorer", "type": "ApplicationComponent", "layer": "Application", "x": 590, "y": 310, "width": 250, "height": 70},
                {"id": "s8-n8", "element_id": "app-eb-85", "name": "DocuSign Enterprise Trust Qualified Signature", "type": "ApplicationComponent", "layer": "Application", "x": 860, "y": 310, "width": 250, "height": 70}
            ],
            "connections": [
                {"src": "actor-private-banker", "tgt": "proc-robo-advisory", "type": "AssignmentRelationship", "name": "Pianifica Investimenti"},
                {"src": "actor-hnw-client", "tgt": "proc-mifid-profiling", "type": "AssignmentRelationship", "name": "Firma Questionario"},
                {"src": "app-eb-79", "tgt": "proc-robo-advisory", "type": "ServingRelationship", "name": "Motore Asset Allocation"},
                {"src": "app-ai-copilot-wealth", "tgt": "proc-robo-advisory", "type": "ServingRelationship", "name": "Suggerimenti Portafoglio AI"},
                {"src": "app-esg-scoring", "tgt": "proc-mifid-profiling", "type": "ServingRelationship", "name": "Rating Sostenibilità SFDR"},
                {"src": "app-eb-85", "tgt": "proc-mifid-profiling", "type": "ServingRelationship", "name": "Firma Elettronica Qualificata"},
                {"src": "proc-robo-advisory", "tgt": "proc-mifid-profiling", "type": "TriggeringRelationship", "name": "Verifica Adeguatezza Proposta"}
            ]
        },

        # 9. INFORMATION / DATA FLOW VIEWPOINT
        {
            "id": "schema-data-flow-treasury",
            "name": "Corporate Treasury, Cash Pooling & Interbank Settlement",
            "viewpoint": "Information / Data Flow",
            "doc": "Flusso informativo e scambio di oggetti dati transazionali per la tesoreria di gruppo e la gestione della liquidità accentrata (Cash Pooling). Traccia i messaggi interbancari ISO 20022, posizioni di liquidità e quadrature contabili.",
            "nodes": [
                {"id": "s9-n1", "element_id": "app-corporate-portal", "name": "EasyCorporate Cash & Trade Portal", "type": "ApplicationComponent", "layer": "Application", "x": 60, "y": 40, "width": 240, "height": 65},
                {"id": "s9-n2", "element_id": "app-eb-88", "name": "Bacta Treasury Cash Pooling & Liquidity", "type": "ApplicationComponent", "layer": "Application", "x": 340, "y": 40, "width": 250, "height": 65},
                {"id": "s9-n3", "element_id": "app-murex-treasury", "name": "Murex MX.3 Treasury & Capital Markets", "type": "ApplicationComponent", "layer": "Application", "x": 630, "y": 40, "width": 250, "height": 65},
                {"id": "s9-n4", "element_id": "app-target2-rtgs", "name": "TARGET2 RTGS Central Bank Gateway", "type": "ApplicationComponent", "layer": "Application", "x": 920, "y": 40, "width": 240, "height": 65},
                {"id": "s9-n5", "element_id": "data-cash-pool-order", "name": "Dispositivo Girofondo (camt.053)", "type": "DataObject", "layer": "Application", "x": 180, "y": 180, "width": 240, "height": 60},
                {"id": "s9-n6", "element_id": "data-treasury-ledger", "name": "Registro Posizioni di Tesoreria", "type": "DataObject", "layer": "Application", "x": 480, "y": 180, "width": 240, "height": 60},
                {"id": "s9-n7", "element_id": "data-swift-pacs008", "name": "Messaggio ISO20022 (pacs.008)", "type": "DataObject", "layer": "Application", "x": 780, "y": 180, "width": 240, "height": 60},
                {"id": "s9-n8", "element_id": "app-eb-72", "name": "Swift Alliance Gateway ISO20022", "type": "ApplicationComponent", "layer": "Application", "x": 280, "y": 320, "width": 260, "height": 65},
                {"id": "s9-n9", "element_id": "app-treasury-reconciliation", "name": "SmartStream Corona Interbank Reconciliation", "type": "ApplicationComponent", "layer": "Application", "x": 600, "y": 320, "width": 260, "height": 65}
            ],
            "connections": [
                {"src": "app-corporate-portal", "tgt": "data-cash-pool-order", "type": "AccessRelationship", "name": "Genera Ordine Girofondo"},
                {"src": "app-eb-88", "tgt": "data-cash-pool-order", "type": "AccessRelationship", "name": "Elabora Zero-Balancing"},
                {"src": "app-eb-88", "tgt": "data-treasury-ledger", "type": "AccessRelationship", "name": "Aggiorna Posizioni Contabili"},
                {"src": "app-murex-treasury", "tgt": "data-treasury-ledger", "type": "AccessRelationship", "name": "Allineamento Posizioni FX"},
                {"src": "app-murex-treasury", "tgt": "data-swift-pacs008", "type": "AccessRelationship", "name": "Inoltra Istruzione di Regolamento"},
                {"src": "data-swift-pacs008", "tgt": "app-target2-rtgs", "type": "FlowRelationship", "name": "Liquidazione Lorda TARGET2"},
                {"src": "app-eb-72", "tgt": "app-treasury-reconciliation", "type": "FlowRelationship", "name": "Flusso Rendicontazione Nostro/Loro"},
                {"src": "app-treasury-reconciliation", "tgt": "data-treasury-ledger", "type": "AccessRelationship", "name": "Quadratura Contabile Automatica"}
            ]
        },

        # 10. SERVICE REALIZATION VIEWPOINT
        {
            "id": "schema-service-realization-omnichannel",
            "name": "Omnichannel Customer Engagement & Digital Identity Access",
            "viewpoint": "Service Realization",
            "doc": "Architettura di erogazione e realizzazione dei servizi digitali omnicanale (Mobile App, Portale Corporate, Contact Center Webex e Sportello di Filiale). Mostra come i servizi applicativi di autenticazione forte biometrica, onboarding digitale e firma qualificata sono realizzati dai sistemi di sicurezza sottostanti.",
            "nodes": [
                {"id": "s10-n1", "element_id": "app-mobile-retail", "name": "EasyBank Mobile Retail App (iOS & Android)", "type": "ApplicationComponent", "layer": "Application", "x": 40, "y": 40, "width": 260, "height": 65},
                {"id": "s10-n2", "element_id": "app-corporate-portal", "name": "EasyCorporate Cash & Trade Portal", "type": "ApplicationComponent", "layer": "Application", "x": 330, "y": 40, "width": 250, "height": 65},
                {"id": "s10-n3", "element_id": "app-eb-83", "name": "Cisco Webex Contact Center Omnichannel", "type": "ApplicationComponent", "layer": "Application", "x": 610, "y": 40, "width": 250, "height": 65},
                {"id": "s10-n4", "element_id": "app-branch-appointment", "name": "Qmatic Customer Branch Queue Manager", "type": "ApplicationComponent", "layer": "Application", "x": 890, "y": 40, "width": 250, "height": 65},
                {"id": "s10-n5", "element_id": "serv-biometric-auth", "name": "Servizio Autenticazione Forte Biometrica (SCA)", "type": "BusinessService", "layer": "Business", "x": 120, "y": 180, "width": 280, "height": 65},
                {"id": "s10-n6", "element_id": "serv-digital-onboarding", "name": "Servizio Onboarding e-KYC", "type": "BusinessService", "layer": "Business", "x": 440, "y": 180, "width": 280, "height": 65},
                {"id": "s10-n7", "element_id": "serv-qualified-sign", "name": "Servizio Firma Elettronica Qualificata", "type": "BusinessService", "layer": "Business", "x": 760, "y": 180, "width": 280, "height": 65},
                {"id": "s10-n8", "element_id": "app-eb-75", "name": "Keycloak Customer Identity & Access Management", "type": "ApplicationComponent", "layer": "Application", "x": 60, "y": 320, "width": 250, "height": 65},
                {"id": "s10-n9", "element_id": "app-cyberark-pam", "name": "CyberArk Privileged Access Management", "type": "ApplicationComponent", "layer": "Application", "x": 340, "y": 320, "width": 250, "height": 65},
                {"id": "s10-n10", "element_id": "app-ekyc-onboarding", "name": "IDnow Digital Onboarding & e-KYC Hub", "type": "ApplicationComponent", "layer": "Application", "x": 620, "y": 320, "width": 250, "height": 65},
                {"id": "s10-n11", "element_id": "app-eb-85", "name": "DocuSign Enterprise Trust Qualified Signature", "type": "ApplicationComponent", "layer": "Application", "x": 900, "y": 320, "width": 250, "height": 65}
            ],
            "connections": [
                {"src": "serv-biometric-auth", "tgt": "app-mobile-retail", "type": "ServingRelationship", "name": "Protegge Accesso Mobile"},
                {"src": "serv-biometric-auth", "tgt": "app-corporate-portal", "type": "ServingRelationship", "name": "Protegge Accesso Web Corporate"},
                {"src": "app-eb-75", "tgt": "serv-biometric-auth", "type": "RealizationRelationship", "name": "Realizza OIDC / FIDO2 Token"},
                {"src": "app-ekyc-onboarding", "tgt": "serv-digital-onboarding", "type": "RealizationRelationship", "name": "Riconoscimento AI Documenti"},
                {"src": "app-eb-85", "tgt": "serv-qualified-sign", "type": "RealizationRelationship", "name": "Certificati QES eIDAS"},
                {"src": "app-cyberark-pam", "tgt": "app-eb-75", "type": "ServingRelationship", "name": "Protezione Password Amministrative"},
                {"src": "serv-digital-onboarding", "tgt": "app-mobile-retail", "type": "ServingRelationship", "name": "Apertura Conto Online in App"},
                {"src": "serv-qualified-sign", "tgt": "app-corporate-portal", "type": "ServingRelationship", "name": "Firma Contratti Fidi & Garanzie"},
                {"src": "app-eb-83", "tgt": "app-mobile-retail", "type": "ServingRelationship", "name": "Supporto Chat & Videochiamata in App"},
                {"src": "app-branch-appointment", "tgt": "app-mobile-retail", "type": "ServingRelationship", "name": "Prenotazione Appuntamento Filiale"}
            ]
        }
    ]

    total_rels_created = 0

    for s_idx, s_def in enumerate(SCHEMAS_DEFINITION, 1):
        s_id = s_def["id"]
        elem_to_node_id = {n["element_id"]: n["id"] for n in s_def["nodes"]}

        # Prepare view connections with valid relationship_id
        serialized_connections = []

        for c_idx, conn in enumerate(s_def["connections"], 1):
            src_elem_id = conn["src"]
            tgt_elem_id = conn["tgt"]
            rel_type = conn["type"]
            rel_name = conn["name"]

            # 1. Deterministic relationship ID in DB
            rel_id = f"rel-vp-{s_id[:16]}-{c_idx}-{src_elem_id[:12]}-{tgt_elem_id[:12]}"[:60]

            existing_rel = db.query(ArchimateRelationship).filter(
                ArchimateRelationship.id == rel_id,
                ArchimateRelationship.model_id == MODEL_ID
            ).first()

            if not existing_rel:
                # Also check if another relationship connects src -> tgt with same type
                existing_match = db.query(ArchimateRelationship).filter(
                    ArchimateRelationship.model_id == MODEL_ID,
                    ArchimateRelationship.source_id == src_elem_id,
                    ArchimateRelationship.target_id == tgt_elem_id,
                    ArchimateRelationship.type == rel_type
                ).first()

                if existing_match:
                    rel_id = existing_match.id
                else:
                    new_rel = ArchimateRelationship(
                        id=rel_id,
                        model_id=MODEL_ID,
                        source_id=src_elem_id,
                        target_id=tgt_elem_id,
                        type=rel_type,
                        name=rel_name,
                        documentation=f"Relazione architetturale dello schema '{s_def['name']}': {rel_name}"
                    )
                    db.add(new_rel)
                    total_rels_created += 1

            src_node_id = elem_to_node_id.get(src_elem_id, f"node-{src_elem_id}")
            tgt_node_id = elem_to_node_id.get(tgt_elem_id, f"node-{tgt_elem_id}")

            serialized_connections.append({
                "id": f"conn-{s_id[:10]}-{c_idx}",
                "relationship_id": rel_id,
                "source_node_id": src_node_id,
                "target_node_id": tgt_node_id,
                "source": src_node_id,
                "target": tgt_node_id,
                "source_id": src_elem_id,
                "target_id": tgt_elem_id,
                "type": rel_type,
                "name": rel_name
            })

        db.commit()

        v_data = {
            "nodes": s_def["nodes"],
            "connections": serialized_connections
        }

        # 2. Upsert ArchiSchema
        schema = db.query(ArchiSchema).filter(
            ArchiSchema.id == s_id,
            ArchiSchema.model_id == MODEL_ID
        ).first()

        if not schema:
            schema = ArchiSchema(
                id=s_id,
                model_id=MODEL_ID,
                folder_id=folder_vp_arch.id,
                name=s_def["name"],
                viewpoint=s_def["viewpoint"],
                documentation=s_def["doc"],
                status="available",
                current_version="v1.0",
                format="archi",
                view_data=v_data,
                raw_xml=None
            )
            db.add(schema)
            db.commit()
            db.refresh(schema)

            ver = SchemaVersionHistory(
                id=f"ver-{s_id}-v10",
                schema_id=s_id,
                version_number=1,
                version_label="v1.0",
                commit_message=f"Creazione schema viewpoint ufficiale con relazioni: {s_def['name']}",
                author_name="Lead Enterprise Architect",
                view_data_snapshot=v_data
            )
            db.add(ver)
        else:
            schema.name = s_def["name"]
            schema.viewpoint = s_def["viewpoint"]
            schema.documentation = s_def["doc"]
            schema.view_data = v_data
            db.commit()
            db.refresh(schema)

        # Generate complete standalone .archimate XML with verified relationships
        try:
            standalone_xml = generate_standalone_archi_xml(schema, db)
            schema.raw_xml = standalone_xml
            db.commit()
        except Exception as e:
            print(f"  [Warning] Errore generazione XML per {s_id}: {e}")

        # 3. Upsert ArchimateView (for Web Diagram Viewer)
        view_id = f"view-{s_id}"
        view = db.query(ArchimateView).filter(
            ArchimateView.id == view_id,
            ArchimateView.model_id == MODEL_ID
        ).first()

        if not view:
            view = ArchimateView(
                id=view_id,
                model_id=MODEL_ID,
                name=s_def["name"],
                viewpoint=s_def["viewpoint"],
                documentation=s_def["doc"],
                view_data=v_data
            )
            db.add(view)
        else:
            view.name = s_def["name"]
            view.viewpoint = s_def["viewpoint"]
            view.documentation = s_def["doc"]
            view.view_data = v_data

        db.commit()

    print(f"✓ Tutte le relazioni architetturali create ({total_rels_created} nuove) e collegate ai 10 schemi.")

    # Verification
    final_schemas = db.query(ArchiSchema).filter(ArchiSchema.model_id == MODEL_ID).all()
    print("\n" + "=" * 70)
    print("VERIFICA SCHEMI & RELAZIONI COLLEGATE:")
    for s in final_schemas:
        if "schema-" in s.id and s.id != "schema-loan-origination-bpmn":
            conns = (s.view_data or {}).get("connections", [])
            has_xml = bool(s.raw_xml and "<archimate:model" in s.raw_xml)
            print(f"  * {s.name:55} | Nodi: {len((s.view_data or {}).get('nodes', [])):2} | Relazioni: {len(conns):2} | XML: {'OK' if has_xml else 'No'}")
    print("=" * 70)

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_viewpoints(db)
    finally:
        db.close()
