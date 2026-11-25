from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.archimate import ArchimateElement, ArchimateRelationship, ElementStereotype
from app.services.metamodel_service import seed_default_custom_attributes

def seed_easybank_process_automation_and_tco(db: Session, model_id: str = "sample-easybank-ea") -> Dict[str, Any]:
    """
    Seeds comprehensive BPMN 2.0 task steps with specialized stereotypes (UserTask, ServiceTask,
    AIAgentTask, BusinessRuleTask, ManualTask, ScriptTask) and supporting application relationships
    for EasyBank Global (sample-easybank-ea), enabling full visibility in Process TCO and Automation dashboards.
    """
    # 1. Ensure system package and stereotypes exist
    seed_default_custom_attributes(db)

    # 2. Add/Enrich application relationships for processes that had none
    supporting_rel_defs = [
        # Loan Origination
        {"source": "app-salesforce", "target": "proc-loan-origination", "type": "ServingRelationship"},
        {"source": "app-cloud-core", "target": "proc-loan-origination", "type": "ServingRelationship"},
        {"source": "app-feedzai-fraud", "target": "proc-loan-origination", "type": "ServingRelationship"},
        {"source": "app-alfresco-doc", "target": "proc-loan-origination", "type": "ServingRelationship"},
        # Insurance Claim
        {"source": "app-legacy-crm", "target": "proc-handle-claim", "type": "ServingRelationship"},
        {"source": "app-alfresco-doc", "target": "proc-handle-claim", "type": "ServingRelationship"},
        # Onboarding enrichment
        {"source": "app-ekyc-onboarding", "target": "proc-onboarding", "type": "ServingRelationship"}
    ]

    for rel in supporting_rel_defs:
        s_el = db.query(ArchimateElement).filter(ArchimateElement.id == rel["source"], ArchimateElement.model_id == model_id).first()
        t_el = db.query(ArchimateElement).filter(ArchimateElement.id == rel["target"], ArchimateElement.model_id == model_id).first()
        if s_el and t_el:
            exists = db.query(ArchimateRelationship).filter(
                ArchimateRelationship.model_id == model_id,
                ArchimateRelationship.source_id == rel["source"],
                ArchimateRelationship.target_id == rel["target"]
            ).first()
            if not exists:
                db.add(ArchimateRelationship(
                    id=f"rel-{rel['source']}-{rel['target']}",
                    model_id=model_id,
                    source_id=rel["source"],
                    target_id=rel["target"],
                    type=rel["type"],
                    name=None
                ))

    # 3. Define BPMN 2.0 steps for macro processes
    bpmn_macro_steps = [
        # Process 1: Customer Digital Onboarding
        {
            "parent_id": "proc-onboarding",
            "steps": [
                {
                    "id": "proc-step-onb-1",
                    "name": "Compilazione Dati & Documento Identità",
                    "stereotype_id": "stereo-bpmn-user-task",
                    "bpmn_tag": "userTask",
                    "automation_level": "Semi-Automated",
                    "cycle_time": 12.0,
                    "monthly_volume": 4500,
                    "doc": "L'utente compila form anagrafico e carica fotografia documento di identità tramite web o mobile."
                },
                {
                    "id": "proc-step-onb-2",
                    "name": "Verifica Biometrica & Liveness Check con AI",
                    "stereotype_id": "stereo-bpmn-ai-task",
                    "bpmn_tag": "aiAgentTask",
                    "automation_level": "AI-Assisted",
                    "cycle_time": 1.0,
                    "monthly_volume": 4500,
                    "doc": "Agente AI di computer vision verifica la corrispondenza del volto (selfie video liveness check) con la foto del documento."
                },
                {
                    "id": "proc-step-onb-3",
                    "name": "Antiriciclaggio AML & Watchlist Check",
                    "stereotype_id": "stereo-bpmn-service-task",
                    "bpmn_tag": "serviceTask",
                    "automation_level": "Full Automated",
                    "cycle_time": 0.5,
                    "monthly_volume": 4500,
                    "doc": "Invocazione sincrona API del motore antiriciclaggio contro PEP, liste sanzioni internazionali e adverse media."
                },
                {
                    "id": "proc-step-onb-4",
                    "name": "Calcolo Credit Score & Rating Preliminare",
                    "stereotype_id": "stereo-bpmn-rule-task",
                    "bpmn_tag": "businessRuleTask",
                    "automation_level": "Full Automated",
                    "cycle_time": 0.2,
                    "monthly_volume": 4500,
                    "doc": "Decision table DMN per calcolare il massimale di affidamento e la classe di rischio iniziale."
                },
                {
                    "id": "proc-step-onb-5",
                    "name": "Firma Elettronica Qualificata (FEQ)",
                    "stereotype_id": "stereo-bpmn-user-task",
                    "bpmn_tag": "userTask",
                    "automation_level": "Semi-Automated",
                    "cycle_time": 5.0,
                    "monthly_volume": 4200,
                    "doc": "Sottoscrizione del contratto con certificato digitale one-shot e OTP SMS."
                },
                {
                    "id": "proc-step-onb-6",
                    "name": "Provisioning Conto su Core Banking",
                    "stereotype_id": "stereo-bpmn-service-task",
                    "bpmn_tag": "serviceTask",
                    "automation_level": "Full Automated",
                    "cycle_time": 0.5,
                    "monthly_volume": 4200,
                    "doc": "Creazione IBAN e attivazione profilo cliente sul Core Banking Thought Machine Vault."
                }
            ]
        },
        # Process 2: Process SEPA Payment (100% STP)
        {
            "parent_id": "proc-send-payment",
            "steps": [
                {
                    "id": "proc-step-pay-1",
                    "name": "Ricezione e Validazione Formato ISO 20022",
                    "stereotype_id": "stereo-bpmn-service-task",
                    "bpmn_tag": "serviceTask",
                    "automation_level": "Full Automated",
                    "cycle_time": 0.1,
                    "monthly_volume": 85000,
                    "doc": "Validazione sintattica e semantica pacchetto pacs.008 via gateway API."
                },
                {
                    "id": "proc-step-pay-2",
                    "name": "Fraud Detection & Real-Time Sanction Screening",
                    "stereotype_id": "stereo-bpmn-rule-task",
                    "bpmn_tag": "businessRuleTask",
                    "automation_level": "Full Automated",
                    "cycle_time": 0.2,
                    "monthly_volume": 85000,
                    "doc": "Scoring anti-frode e controllo embargo istantaneo con motore Feedzai."
                },
                {
                    "id": "proc-step-pay-3",
                    "name": "Verifica Saldo & Riserva Fondi su Core",
                    "stereotype_id": "stereo-bpmn-service-task",
                    "bpmn_tag": "serviceTask",
                    "automation_level": "Full Automated",
                    "cycle_time": 0.1,
                    "monthly_volume": 85000,
                    "doc": "Blocco contabile fondi sul conto di addebito cliente."
                },
                {
                    "id": "proc-step-pay-4",
                    "name": "Routing verso Clearing Network (EBA STEP2 / TIPS)",
                    "stereotype_id": "stereo-bpmn-service-task",
                    "bpmn_tag": "serviceTask",
                    "automation_level": "Full Automated",
                    "cycle_time": 0.3,
                    "monthly_volume": 84800,
                    "doc": "Inoltro transazione verso la camera di compensazione SEPA europea."
                },
                {
                    "id": "proc-step-pay-5",
                    "name": "Contabilizzazione Automatica su Ledger Core",
                    "stereotype_id": "stereo-bpmn-script-task",
                    "bpmn_tag": "scriptTask",
                    "automation_level": "Full Automated",
                    "cycle_time": 0.1,
                    "monthly_volume": 84800,
                    "doc": "Scrittura partita contabile in partita doppia sul partitario generale."
                }
            ]
        },
        # Process 3: Credit & Loan Origination (RPA / AI candidate with manual bottleneck)
        {
            "parent_id": "proc-loan-origination",
            "steps": [
                {
                    "id": "proc-step-loan-1",
                    "name": "Raccolta Domanda & Buste Paga da Portale",
                    "stereotype_id": "stereo-bpmn-user-task",
                    "bpmn_tag": "userTask",
                    "automation_level": "Semi-Automated",
                    "cycle_time": 20.0,
                    "monthly_volume": 1200,
                    "doc": "Caricamento manuale della documentazione reddituale da parte del cliente o gestore filiale."
                },
                {
                    "id": "proc-step-loan-2",
                    "name": "Analisi Documentale OCR & Verifica Buste Paga con AI",
                    "stereotype_id": "stereo-bpmn-ai-task",
                    "bpmn_tag": "aiAgentTask",
                    "automation_level": "AI-Assisted",
                    "cycle_time": 2.0,
                    "monthly_volume": 1200,
                    "doc": "Estrazione automatica dei dati del CU/730 e verifica congruenza reddito netto."
                },
                {
                    "id": "proc-step-loan-3",
                    "name": "Interrogazione Centrale Rischi Banca d'Italia & CRIF",
                    "stereotype_id": "stereo-bpmn-service-task",
                    "bpmn_tag": "serviceTask",
                    "automation_level": "Full Automated",
                    "cycle_time": 1.0,
                    "monthly_volume": 1200,
                    "doc": "Chiamata API asincrona per storico sofferenze ed esposizione creditizia del richiedente."
                },
                {
                    "id": "proc-step-loan-4",
                    "name": "Delibera Automatica Scoring di Credito",
                    "stereotype_id": "stereo-bpmn-rule-task",
                    "bpmn_tag": "businessRuleTask",
                    "automation_level": "Full Automated",
                    "cycle_time": 0.5,
                    "monthly_volume": 1200,
                    "doc": "Motore decisionale per calcolo rapporto rata/reddito e approvazione preliminare."
                },
                {
                    "id": "proc-step-loan-5",
                    "name": "Perizia e Verifica Ipotecaria Notarile",
                    "stereotype_id": "stereo-bpmn-manual-task",
                    "bpmn_tag": "manualTask",
                    "automation_level": "Manual",
                    "cycle_time": 240.0,
                    "monthly_volume": 800,
                    "doc": "Sopralluogo peritale e redazione relazione notarile preliminare cartacea (Collo di bottiglia manuale)."
                },
                {
                    "id": "proc-step-loan-6",
                    "name": "Erogazione Finanziamento su Conto Corrente",
                    "stereotype_id": "stereo-bpmn-service-task",
                    "bpmn_tag": "serviceTask",
                    "automation_level": "Full Automated",
                    "cycle_time": 1.0,
                    "monthly_volume": 800,
                    "doc": "Accredito importo erogato e creazione piano di ammortamento."
                }
            ]
        },
        # Process 4: Process Insurance Claim
        {
            "parent_id": "proc-handle-claim",
            "steps": [
                {
                    "id": "proc-step-claim-1",
                    "name": "Ricezione Denuncia Sinistro Online",
                    "stereotype_id": "stereo-bpmn-user-task",
                    "bpmn_tag": "userTask",
                    "automation_level": "Semi-Automated",
                    "cycle_time": 15.0,
                    "monthly_volume": 900,
                    "doc": "Inserimento foto e constatazione amichevole da app mobile."
                },
                {
                    "id": "proc-step-claim-2",
                    "name": "Verifica Copertura Polizza & Franchigia",
                    "stereotype_id": "stereo-bpmn-rule-task",
                    "bpmn_tag": "businessRuleTask",
                    "automation_level": "Full Automated",
                    "cycle_time": 0.5,
                    "monthly_volume": 900,
                    "doc": "Verifica vigenza del contratto e applicazione clausole contrattuali."
                },
                {
                    "id": "proc-step-claim-3",
                    "name": "Perizia Tecnica del Danno sul Campo",
                    "stereotype_id": "stereo-bpmn-manual-task",
                    "bpmn_tag": "manualTask",
                    "automation_level": "Manual",
                    "cycle_time": 180.0,
                    "monthly_volume": 600,
                    "doc": "Ispezione fisica del bene danneggiato da parte del perito assicurativo."
                },
                {
                    "id": "proc-step-claim-4",
                    "name": "Liquidazione Indennizzo Sinistro",
                    "stereotype_id": "stereo-bpmn-service-task",
                    "bpmn_tag": "serviceTask",
                    "automation_level": "Full Automated",
                    "cycle_time": 2.0,
                    "monthly_volume": 600,
                    "doc": "Emissione bonifico di liquidazione verso l'assicurato o carrozzeria convenzionata."
                }
            ]
        }
    ]

    inserted_steps = 0
    for macro in bpmn_macro_steps:
        parent_id = macro["parent_id"]
        parent_el = db.query(ArchimateElement).filter(ArchimateElement.id == parent_id, ArchimateElement.model_id == model_id).first()
        if not parent_el:
            continue

        for st in macro["steps"]:
            existing = db.query(ArchimateElement).filter(ArchimateElement.id == st["id"]).first()
            props = {
                "is_bpmn_step": True,
                "parent_process_id": parent_id,
                "bpmn_tag": st["bpmn_tag"],
                "bpmn_automation_level": st["automation_level"],
                "bpmn_cycle_time_minutes": st["cycle_time"],
                "bpmn_execution_volume_month": st["monthly_volume"]
            }

            if not existing:
                elem = ArchimateElement(
                    id=st["id"],
                    model_id=model_id,
                    name=st["name"],
                    type="BusinessProcess",
                    layer="Business",
                    documentation=st["doc"],
                    properties=props,
                    stereotype_id=st["stereotype_id"],
                    package_id="pkg-bpmn"
                )
                db.add(elem)
                inserted_steps += 1
            else:
                existing.name = st["name"]
                existing.documentation = st["doc"]
                existing.properties = {**(existing.properties or {}), **props}
                existing.stereotype_id = st["stereotype_id"]
                existing.package_id = "pkg-bpmn"

            # Ensure Composition relationship exists: Parent -> Step
            rel_id = f"rel-comp-{parent_id}-{st['id']}"
            existing_rel = db.query(ArchimateRelationship).filter(ArchimateRelationship.id == rel_id).first()
            if not existing_rel:
                db.add(ArchimateRelationship(
                    id=rel_id,
                    model_id=model_id,
                    source_id=parent_id,
                    target_id=st["id"],
                    type="CompositionRelationship",
                    name=None
                ))

    db.commit()
    return {"status": "success", "inserted_or_updated_steps": inserted_steps}
