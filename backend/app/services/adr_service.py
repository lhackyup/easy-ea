import re
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.archimate import (
    ArchitectureDecisionRecord,
    ADRLinkedElement,
    ArchimateElement,
    ArchimateRelationship,
    ElementStereotype,
    ModelWorkspace,
    User
)

VALID_ADR_STATUSES = {"Draft", "Proposed", "Accepted", "Rejected", "Deprecated", "Superseded"}
VALID_ADR_DOMAINS = {
    "Strategy",
    "Business",
    "Application",
    "Data",
    "Technology",
    "Security",
    "Integration",
    "Governance"
}
VALID_IMPACT_TYPES = {"driven_by", "introduces", "governs", "modifies", "retires"}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ADRService:
    @staticmethod
    def generate_next_code(db: Session, model_id: str) -> str:
        """Generates the next sequential ADR code (e.g. ADR-0001, ADR-0002) for a library workspace."""
        existing_codes = [
            r[0] for r in db.query(ArchitectureDecisionRecord.code).filter(
                ArchitectureDecisionRecord.model_id == model_id
            ).all() if r[0]
        ]
        max_num = 0
        for c in existing_codes:
            m = re.search(r"(\d+)$", str(c))
            if m:
                num = int(m.group(1))
                if num > max_num:
                    max_num = num
        return f"ADR-{max_num + 1:04d}"

    @staticmethod
    def serialize_adr(adr: ArchitectureDecisionRecord) -> Dict[str, Any]:
        """Serializes an ArchitectureDecisionRecord with linked elements and superseding chain."""
        linked = []
        for link in (adr.linked_elements or []):
            el = link.element
            linked.append({
                "id": link.id,
                "element_id": link.element_id,
                "element_name": el.name if el else link.element_id,
                "element_type": el.type if el else "Unknown",
                "element_layer": el.layer if el else "Application",
                "impact_type": link.impact_type,
                "notes": link.notes or ""
            })

        superseded_by_info = None
        if adr.superseded_by:
            superseded_by_info = {
                "id": adr.superseded_by.id,
                "code": adr.superseded_by.code,
                "title": adr.superseded_by.title,
                "status": adr.superseded_by.status
            }

        supersedes_info = []
        if hasattr(adr, "supersedes_list") and adr.supersedes_list:
            for prev_adr in adr.supersedes_list:
                supersedes_info.append({
                    "id": prev_adr.id,
                    "code": prev_adr.code,
                    "title": prev_adr.title,
                    "status": prev_adr.status
                })

        return {
            "id": adr.id,
            "model_id": adr.model_id,
            "archimate_element_id": adr.archimate_element_id,
            "code": adr.code,
            "title": adr.title,
            "status": adr.status,
            "domain": adr.domain,
            "context_and_problem": adr.context_and_problem or "",
            "decision_drivers": adr.decision_drivers or [],
            "considered_options": adr.considered_options or [],
            "decision_outcome": adr.decision_outcome or "",
            "consequences": adr.consequences or "",
            "compliance_impact": adr.compliance_impact or "",
            "deciders": adr.deciders or "",
            "author_id": adr.author_id,
            "author_name": adr.author_name or "Enterprise Architect",
            "superseded_by_id": adr.superseded_by_id,
            "superseded_by": superseded_by_info,
            "supersedes": supersedes_info,
            "linked_elements": linked,
            "linked_elements_count": len(linked),
            "decided_at": adr.decided_at.isoformat() if adr.decided_at else None,
            "created_at": adr.created_at.isoformat() if adr.created_at else None,
            "updated_at": adr.updated_at.isoformat() if adr.updated_at else None,
        }

    @staticmethod
    def list_adrs(
        db: Session,
        model_id: str,
        status: Optional[str] = None,
        domain: Optional[str] = None,
        element_id: Optional[str] = None,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        """Lists ADRs for a library workspace along with KPI summary statistics."""
        all_model_adrs = db.query(ArchitectureDecisionRecord).filter(
            ArchitectureDecisionRecord.model_id == model_id
        ).order_by(ArchitectureDecisionRecord.code.asc()).all()

        # Compute global KPIs for the model
        total = len(all_model_adrs)
        status_counts: Dict[str, int] = {s: 0 for s in VALID_ADR_STATUSES}
        domain_counts: Dict[str, int] = {}
        for a in all_model_adrs:
            status_counts[a.status] = status_counts.get(a.status, 0) + 1
            domain_counts[a.domain] = domain_counts.get(a.domain, 0) + 1

        # Apply filters
        filtered = all_model_adrs
        if status and status.lower() != "all":
            filtered = [a for a in filtered if a.status.lower() == status.lower()]
        if domain and domain.lower() != "all":
            filtered = [a for a in filtered if a.domain.lower() == domain.lower()]
        if element_id:
            filtered = [
                a for a in filtered
                if any(link.element_id == element_id for link in (a.linked_elements or []))
            ]
        if search and search.strip():
            q = search.strip().lower()
            filtered = [
                a for a in filtered
                if q in (a.code or "").lower()
                or q in (a.title or "").lower()
                or q in (a.context_and_problem or "").lower()
                or q in (a.decision_outcome or "").lower()
                or q in (a.deciders or "").lower()
                or any(
                    q in (l.element.name.lower() if l.element else "")
                    for l in (a.linked_elements or [])
                )
            ]

        return {
            "model_id": model_id,
            "summary": {
                "total": total,
                "accepted": status_counts.get("Accepted", 0),
                "proposed": status_counts.get("Proposed", 0),
                "draft": status_counts.get("Draft", 0),
                "rejected": status_counts.get("Rejected", 0),
                "deprecated": status_counts.get("Deprecated", 0),
                "superseded": status_counts.get("Superseded", 0),
                "by_status": status_counts,
                "by_domain": domain_counts
            },
            "items": [ADRService.serialize_adr(a) for a in filtered]
        }

    @staticmethod
    def get_adr(db: Session, adr_id: str) -> Dict[str, Any]:
        adr = db.query(ArchitectureDecisionRecord).filter(ArchitectureDecisionRecord.id == adr_id).first()
        if not adr:
            raise HTTPException(status_code=404, detail="Architecture Decision Record not found.")
        return ADRService.serialize_adr(adr)

    @staticmethod
    def _sync_archimate_element_for_adr(db: Session, adr: ArchitectureDecisionRecord):
        """
        Synchronizes an ArchitectureDecisionRecord 1:1 with an ArchimateElement of type Assessment
        (Motivation layer, stereotype 'stereo-adr'), and creates/updates ArchimateRelationships to linked elements.
        """
        elem = None
        if adr.archimate_element_id:
            elem = db.query(ArchimateElement).filter(ArchimateElement.id == adr.archimate_element_id).first()

        elem_id = adr.archimate_element_id or f"elem-adr-{adr.id.replace('adr-', '')}"
        if not elem:
            elem = db.query(ArchimateElement).filter(ArchimateElement.id == elem_id).first()

        stereo = db.query(ElementStereotype).filter(ElementStereotype.id == "stereo-adr").first()
        stereo_id = stereo.id if stereo else None

        props = {
            "adr_code": adr.code,
            "adr_status": adr.status,
            "adr_domain": adr.domain,
            "adr_deciders": adr.deciders or "",
            "adr_decided_at": adr.decided_at.strftime("%Y-%m-%d") if adr.decided_at else "",
            "adr_decision_outcome": adr.decision_outcome or "",
            "adr_compliance_impact": adr.compliance_impact or "",
            "adr_superseded_by": adr.superseded_by.code if adr.superseded_by else ""
        }

        elem_name = f"[{adr.code}] {adr.title}"
        doc_text = adr.decision_outcome or adr.context_and_problem or ""

        if not elem:
            elem = ArchimateElement(
                id=elem_id,
                model_id=adr.model_id,
                name=elem_name,
                type="Assessment",
                layer="Motivation",
                documentation=doc_text,
                stereotype_id=stereo_id,
                properties=props
            )
            db.add(elem)
            db.flush()
        else:
            elem.model_id = adr.model_id
            elem.name = elem_name
            elem.type = "Assessment"
            elem.layer = "Motivation"
            elem.documentation = doc_text
            if stereo_id:
                elem.stereotype_id = stereo_id
            current_props = dict(elem.properties or {})
            current_props.update(props)
            elem.properties = current_props

        adr.archimate_element_id = elem.id

        # Sync ArchimateRelationships for each linked element
        existing_adr_rels = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.source_id == elem.id
        ).all()
        for r in existing_adr_rels:
            r_props = r.properties if isinstance(r.properties, dict) else {}
            if r_props.get("adr_auto_sync") is True or r.id.startswith("rel-adr-"):
                db.delete(r)

        for link in (adr.linked_elements or []):
            rel_type = "InfluenceRelationship"
            rel_id = f"rel-adr-{adr.id.replace('adr-', '')}-{link.element_id}"
            rel_props = {
                "adr_auto_sync": True,
                "adr_id": adr.id,
                "impact_type": link.impact_type
            }
            rel = ArchimateRelationship(
                id=rel_id,
                model_id=adr.model_id,
                source_id=elem.id,
                target_id=link.element_id,
                type=rel_type,
                name=f"ADR {link.impact_type}",
                documentation=link.notes or f"ADR {adr.code} governance link ({link.impact_type})",
                properties=rel_props
            )
            db.add(rel)

    @staticmethod
    def _sync_linked_elements(
        db: Session,
        adr: ArchitectureDecisionRecord,
        links_payload: Optional[List[Dict[str, Any]]]
    ):
        if links_payload is None:
            return
        # Clear existing links
        db.query(ADRLinkedElement).filter(ADRLinkedElement.adr_id == adr.id).delete()
        seen = set()
        for item in links_payload:
            el_id = item.get("element_id")
            if not el_id or el_id in seen:
                continue
            el = db.query(ArchimateElement).filter(ArchimateElement.id == el_id).first()
            if not el:
                continue
            impact_type = item.get("impact_type") or "governs"
            if impact_type not in VALID_IMPACT_TYPES:
                impact_type = "governs"
            seen.add(el_id)
            link = ADRLinkedElement(
                id=f"adrl-{uuid.uuid4().hex[:8]}",
                adr_id=adr.id,
                element_id=el_id,
                impact_type=impact_type,
                notes=item.get("notes") or ""
            )
            db.add(link)

    @staticmethod
    def create_adr(
        db: Session,
        model_id: str,
        payload: Dict[str, Any],
        current_user: Optional[User] = None
    ) -> Dict[str, Any]:
        ws = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
        if not ws:
            raise HTTPException(status_code=404, detail=f"Library workspace '{model_id}' not found.")

        code = (payload.get("code") or "").strip()
        if not code:
            code = ADRService.generate_next_code(db, model_id)
        else:
            dup = db.query(ArchitectureDecisionRecord).filter(
                ArchitectureDecisionRecord.model_id == model_id,
                ArchitectureDecisionRecord.code == code
            ).first()
            if dup:
                raise HTTPException(status_code=400, detail=f"An ADR with code '{code}' already exists in this library.")

        status = payload.get("status") or "Draft"
        if status not in VALID_ADR_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid ADR status '{status}'.")

        domain = payload.get("domain") or "Application"
        author_name = payload.get("author_name") or (
            current_user.full_name if current_user else "Enterprise Architect"
        )

        decided_at = None
        if status in ("Accepted", "Rejected"):
            decided_at = _utc_now()

        adr = ArchitectureDecisionRecord(
            id=f"adr-{uuid.uuid4().hex[:8]}",
            model_id=model_id,
            code=code,
            title=payload["title"].strip(),
            status=status,
            domain=domain,
            context_and_problem=payload.get("context_and_problem") or "",
            decision_drivers=payload.get("decision_drivers") or [],
            considered_options=payload.get("considered_options") or [],
            decision_outcome=payload.get("decision_outcome") or "",
            consequences=payload.get("consequences") or "",
            compliance_impact=payload.get("compliance_impact") or "",
            deciders=payload.get("deciders") or "",
            author_id=current_user.id if current_user else None,
            author_name=author_name,
            superseded_by_id=payload.get("superseded_by_id"),
            decided_at=decided_at
        )
        db.add(adr)
        db.flush()

        # Sync linked ArchiMate elements
        ADRService._sync_linked_elements(db, adr, payload.get("linked_elements", []))

        # If this new ADR supersedes a previous ADR
        supersedes_id = payload.get("supersedes_adr_id")
        if supersedes_id:
            old_adr = db.query(ArchitectureDecisionRecord).filter(
                ArchitectureDecisionRecord.id == supersedes_id,
                ArchitectureDecisionRecord.model_id == model_id
            ).first()
            if old_adr and old_adr.id != adr.id:
                old_adr.status = "Superseded"
                old_adr.superseded_by_id = adr.id
                ADRService._sync_archimate_element_for_adr(db, old_adr)

        # Synchronize 1:1 ArchimateElement and relationships
        ADRService._sync_archimate_element_for_adr(db, adr)

        db.commit()
        db.refresh(adr)
        return ADRService.serialize_adr(adr)

    @staticmethod
    def update_adr(
        db: Session,
        adr_id: str,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        adr = db.query(ArchitectureDecisionRecord).filter(ArchitectureDecisionRecord.id == adr_id).first()
        if not adr:
            raise HTTPException(status_code=404, detail="ADR not found.")

        if "code" in payload and payload["code"]:
            new_code = payload["code"].strip()
            if new_code != adr.code:
                dup = db.query(ArchitectureDecisionRecord).filter(
                    ArchitectureDecisionRecord.model_id == adr.model_id,
                    ArchitectureDecisionRecord.code == new_code,
                    ArchitectureDecisionRecord.id != adr.id
                ).first()
                if dup:
                    raise HTTPException(status_code=400, detail=f"An ADR with code '{new_code}' already exists.")
                adr.code = new_code

        if "title" in payload and payload["title"] is not None:
            adr.title = payload["title"].strip()
        if "status" in payload and payload["status"] is not None:
            new_status = payload["status"]
            if new_status not in VALID_ADR_STATUSES:
                raise HTTPException(status_code=400, detail=f"Invalid ADR status '{new_status}'.")
            if new_status in ("Accepted", "Rejected") and adr.status not in ("Accepted", "Rejected"):
                adr.decided_at = _utc_now()
            adr.status = new_status
        if "domain" in payload and payload["domain"] is not None:
            adr.domain = payload["domain"]
        if "context_and_problem" in payload and payload["context_and_problem"] is not None:
            adr.context_and_problem = payload["context_and_problem"]
        if "decision_drivers" in payload and payload["decision_drivers"] is not None:
            adr.decision_drivers = payload["decision_drivers"]
        if "considered_options" in payload and payload["considered_options"] is not None:
            adr.considered_options = payload["considered_options"]
        if "decision_outcome" in payload and payload["decision_outcome"] is not None:
            adr.decision_outcome = payload["decision_outcome"]
        if "consequences" in payload and payload["consequences"] is not None:
            adr.consequences = payload["consequences"]
        if "compliance_impact" in payload and payload["compliance_impact"] is not None:
            adr.compliance_impact = payload["compliance_impact"]
        if "deciders" in payload and payload["deciders"] is not None:
            adr.deciders = payload["deciders"]
        if "superseded_by_id" in payload:
            if payload["superseded_by_id"] == adr.id:
                raise HTTPException(status_code=400, detail="An ADR cannot supersede itself.")
            adr.superseded_by_id = payload["superseded_by_id"] or None

        if "linked_elements" in payload and payload["linked_elements"] is not None:
            ADRService._sync_linked_elements(db, adr, payload["linked_elements"])

        ADRService._sync_archimate_element_for_adr(db, adr)

        db.commit()
        db.refresh(adr)
        return ADRService.serialize_adr(adr)

    @staticmethod
    def transition_adr(
        db: Session,
        adr_id: str,
        target_status: str,
        superseded_by_id: Optional[str] = None,
        deciders: Optional[str] = None
    ) -> Dict[str, Any]:
        adr = db.query(ArchitectureDecisionRecord).filter(ArchitectureDecisionRecord.id == adr_id).first()
        if not adr:
            raise HTTPException(status_code=404, detail="ADR not found.")

        if target_status not in VALID_ADR_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid target status '{target_status}'.")

        adr.status = target_status
        if target_status in ("Accepted", "Rejected"):
            adr.decided_at = _utc_now()
        if deciders:
            adr.deciders = deciders
        if target_status == "Superseded" and superseded_by_id:
            if superseded_by_id == adr.id:
                raise HTTPException(status_code=400, detail="An ADR cannot supersede itself.")
            adr.superseded_by_id = superseded_by_id

        ADRService._sync_archimate_element_for_adr(db, adr)

        db.commit()
        db.refresh(adr)
        return ADRService.serialize_adr(adr)

    @staticmethod
    def delete_adr(db: Session, adr_id: str) -> Dict[str, Any]:
        adr = db.query(ArchitectureDecisionRecord).filter(ArchitectureDecisionRecord.id == adr_id).first()
        if not adr:
            raise HTTPException(status_code=404, detail="ADR not found.")
        code = adr.code
        # Clear any superseded_by_id pointing to this ADR
        db.query(ArchitectureDecisionRecord).filter(
            ArchitectureDecisionRecord.superseded_by_id == adr.id
        ).update({"superseded_by_id": None}, synchronize_session=False)

        # Also delete linked ArchimateElement
        if adr.archimate_element_id:
            elem = db.query(ArchimateElement).filter(ArchimateElement.id == adr.archimate_element_id).first()
            if elem:
                db.delete(elem)

        db.delete(adr)
        db.commit()
        return {"message": f"ADR {code} deleted successfully.", "id": adr_id}

    @staticmethod
    def export_adr_markdown(adr_data: Dict[str, Any]) -> str:
        """Generates a standard MADR (Markdown Any Decision Records) v3.0 document."""
        lines = [
            f"# {adr_data['code']}: {adr_data['title']}",
            "",
            f"* **Status:** {adr_data['status']}",
            f"* **Domain:** {adr_data['domain']}",
            f"* **Author:** {adr_data.get('author_name') or 'Enterprise Architect'}",
            f"* **Deciders:** {adr_data.get('deciders') or 'Architecture Governance Board'}",
            f"* **Date:** {(adr_data.get('decided_at') or adr_data.get('updated_at') or '')[:10]}",
        ]
        if adr_data.get("superseded_by"):
            sb = adr_data["superseded_by"]
            lines.append(f"* **Superseded By:** {sb['code']} ({sb['title']})")
        if adr_data.get("supersedes"):
            sup_str = ", ".join([f"{s['code']} ({s['title']})" for s in adr_data["supersedes"]])
            lines.append(f"* **Supersedes:** {sup_str}")

        lines.extend([
            "",
            "## Context and Problem Statement",
            "",
            adr_data.get("context_and_problem") or "_No context provided._",
            ""
        ])

        drivers = adr_data.get("decision_drivers") or []
        if drivers:
            lines.extend(["## Decision Drivers", ""])
            for d in drivers:
                lines.append(f"* {d}")
            lines.append("")

        options = adr_data.get("considered_options") or []
        if options:
            lines.extend(["## Considered Options", ""])
            for idx, opt in enumerate(options, start=1):
                title = opt.get("title") or f"Option {idx}"
                lines.append(f"### {idx}. {title}")
                if opt.get("description"):
                    lines.append(f"{opt['description']}")
                if opt.get("pros"):
                    lines.append(f"* **Good (`+`):** {opt['pros']}")
                if opt.get("cons"):
                    lines.append(f"* **Bad (`-`):** {opt['cons']}")
                lines.append("")

        lines.extend([
            "## Decision Outcome",
            "",
            adr_data.get("decision_outcome") or "_No decision outcome recorded yet._",
            "",
            "### Consequences & Technical Debt",
            "",
            adr_data.get("consequences") or "_No specific consequences documented._",
            ""
        ])

        if adr_data.get("compliance_impact"):
            lines.extend([
                "### Security, Regulatory & Compliance Impact",
                "",
                adr_data["compliance_impact"],
                ""
            ])

        linked = adr_data.get("linked_elements") or []
        if linked:
            lines.extend([
                "## Impacted ArchiMate Architecture Elements",
                "",
                "| Element Name | ArchiMate Type | Layer | Governance Role | Notes |",
                "| :--- | :--- | :--- | :--- | :--- |"
            ])
            for l in linked:
                lines.append(
                    f"| **{l['element_name']}** | `{l['element_type']}` | {l['element_layer']} | `{l['impact_type']}` | {l.get('notes') or '-'} |"
                )
            lines.append("")

        return "\n".join(lines)


def seed_sample_adrs(db: Session, model_id: str):
    """Seeds sample Architecture Decision Records (ADRs) for the demo library."""
    existing = db.query(ArchitectureDecisionRecord).filter(
        ArchitectureDecisionRecord.model_id == model_id
    ).count()
    if existing > 0:
        return

    now = _utc_now()

    adr1 = ArchitectureDecisionRecord(
        id="adr-sample-0001",
        model_id=model_id,
        code="ADR-0001",
        title="Migrazione Core Banking da Mainframe AS400 a Cloud-Native Core (Thought Machine)",
        status="Accepted",
        domain="Application",
        context_and_problem=(
            "Il sistema legacy 'Mainframe AS400 Ledger' presenta costi operativi (MIPS) in crescita del 18% annuo, "
            "tempi di rilascio superiori a 4 settimane e rigidità nell'esposizione di API real-time per l'Open Banking PSD3/BIAN."
        ),
        decision_drivers=[
            "Riduzione del TCO infrastrutturale e licenze mainframe entro 24 mesi",
            "Supporto nativo a contratti smart-ledger e API real-time 24/7",
            "Conformità nativa ai Service Domain BIAN v12.0 (Current Account, Position Keeping)"
        ],
        considered_options=[
            {
                "title": "Opzione 1: Re-hosting (Lift & Shift) del codice COBOL su Cloud VM",
                "description": "Esecuzione dei programmi batch e CICS su emulatori cloud.",
                "pros": "Minore impatto iniziale sulle logiche contabili.",
                "cons": "Mantiene il debito tecnico monolitico e non abilita API event-driven."
            },
            {
                "title": "Opzione 2: Adozione Cloud-Native Core Banking (Thought Machine Vault Core) su AWS EKS",
                "description": "Sostituzione progressiva con pattern Strangler Fig verso Thought Machine Vault Core.",
                "pros": "Architettura a microservizi, scalabilità orizzontale su Kubernetes, pieno allineamento BIAN.",
                "cons": "Richiede coesistenza transitoria e sincronizzazione CDC con il Mainframe."
            }
        ],
        decision_outcome=(
            "Scelta l'Opzione 2: adozione di Thought Machine Vault Core ospitato su AWS EKS Cluster come target strategico "
            "(quadrante TIME: Invest) e avvio del piano di phase-out/dismissione per Mainframe AS400 Ledger."
        ),
        consequences=(
            "Positivi: Time-to-market nuovi prodotti bancari ridotto del 70%.\n"
            "Negativi/Rischi: Necessità di mantenere un layer di sincronizzazione temporaneo durante la migrazione graduale."
        ),
        compliance_impact="Conformità DORA (Resilienza Operativa Digitale) con architettura Multi-AZ su AWS.",
        deciders="Enterprise Architecture Board, CTO, Chief Risk Officer",
        author_name="Lead Enterprise Architect",
        decided_at=now
    )

    adr2 = ArchitectureDecisionRecord(
        id="adr-sample-0002",
        model_id=model_id,
        code="ADR-0002",
        title="Standardizzazione Gateway Pagamenti su Stripe Modern Payment Gateway",
        status="Accepted",
        domain="Integration",
        context_and_problem=(
            "La coesistenza di SIA/Nexi Legacy Payment Hub e nuovi canali digitali genera duplicazione funzionale "
            "sul processo 'Process SEPA Payment' e alti costi di manutenzione."
        ),
        decision_drivers=[
            "Eliminazione dell'overlapping funzionale sui pagamenti SEPA Instant e carte",
            "Riduzione latenza di integrazione con il motore antifrode Feedzai"
        ],
        considered_options=[
            {
                "title": "Mantenere doppio hub pagamenti per canale",
                "description": "Separare canali fisici e canali mobile.",
                "pros": "Zero costi di migrazione immediati.",
                "cons": "Doppio canone annuo e riconciliazione complessa."
            },
            {
                "title": "Consolidamento su Stripe Modern Payment Gateway + Feedzai Real-time Fraud",
                "description": "Convergenza di tutti i flussi di pagamento sul gateway moderno.",
                "pros": "API unificata, integrazione nativa con Feedzai e dismissione legacy.",
                "cons": "Migrazione dei flussi batch SEPA esistenti."
            }
        ],
        decision_outcome=(
            "Adottare Stripe Modern Payment Gateway come unico orchestratore per i pagamenti digitali "
            "e pianificare il ritiro di SIA/Nexi Legacy Payment Hub."
        ),
        consequences="Risparmio stimato di 180k€/anno a regime dopo il decommissioning dell'hub legacy.",
        compliance_impact="PCI-DSS v4.0 Level 1 delegato al provider SaaS certificato.",
        deciders="Head of Payments, Enterprise Architecture Board",
        author_name="Solution Architect Payments",
        decided_at=now
    )

    adr3 = ArchitectureDecisionRecord(
        id="adr-sample-0003",
        model_id=model_id,
        code="ADR-0003",
        title="Architettura Motore Antifrode basata su Regole Statiche SQL Notturne",
        status="Deprecated",
        domain="Security",
        context_and_problem=(
            "Definizione del meccanismo di rilevamento frodi sulle transazioni di pagamento e prestiti."
        ),
        decision_drivers=[
            "Semplicità implementativa sul database relazionale esistente"
        ],
        considered_options=[
            {
                "title": "Batch SQL notturno di verifica anomalie",
                "description": "Esecuzione script SQL a fine giornata.",
                "pros": "Nessun costo di licenza aggiuntivo.",
                "cons": "Incapace di bloccare frodi SEPA Instant in tempo reale (< 200ms)."
            }
        ],
        decision_outcome=(
            "Decisione originaria del 2021 ora DEPRECATA a favore dello scoring AI real-time con Feedzai."
        ),
        consequences="Qualsiasi componente attivo ancora legato a logiche antifrode batch deve essere migrato a Feedzai.",
        compliance_impact="Non conforme ai nuovi requisiti PSD3 Instant Payments Fraud Prevention.",
        deciders="Security Architecture Committee",
        author_name="Security Architect",
        decided_at=now
    )

    adr4 = ArchitectureDecisionRecord(
        id="adr-sample-0004",
        model_id=model_id,
        code="ADR-0004",
        title="Adozione Event-Streaming Kafka per Telemetria IT4IT e Audit Log Centralizzato",
        status="Proposed",
        domain="Technology",
        context_and_problem=(
            "I flussi di osservabilità tra i microservizi su AWS EKS e i processi di Incident/Problem Management "
            "richiedono un backbone asincrono ad alto throughput."
        ),
        decision_drivers=[
            "Disaccoppiamento tra applicazioni core e sistemi di monitoraggio/audit",
            "Tracciabilità immutabile degli eventi di sicurezza"
        ],
        considered_options=[
            {
                "title": "Amazon MSK (Managed Streaming for Apache Kafka)",
                "description": "Cluster Kafka gestito su AWS.",
                "pros": "Alta affidabilità, integrazione IAM nativa, zero gestione broker manuale.",
                "cons": "Costo fisso dei broker."
            },
            {
                "title": "Code punto-punto SQS/SNS",
                "description": "Messaggistica serverless semplice.",
                "pros": "Pay-per-use.",
                "cons": "Assenza di log replay storico multi-consumer."
            }
        ],
        decision_outcome="In proposta: adozione di Amazon MSK integrato con AWS EKS Cluster.",
        consequences="Standardizzazione dello schema eventi tramite Avro/Schema Registry.",
        compliance_impact="Retention di 10 anni su S3 cold storage per ispezioni regolamentari.",
        deciders="Cloud Infrastructure Team, Enterprise Architecture Board",
        author_name="Cloud Infrastructure Architect",
        decided_at=None
    )

    db.add_all([adr1, adr2, adr3, adr4])
    db.flush()

    sample_links = [
        ("adr-sample-0001", "goal-cloud-first", "driven_by", "Allineamento diretto all'obiettivo Cloud-First 2026"),
        ("adr-sample-0001", "app-cloud-core", "introduces", "Piattaforma Core Banking target su cui investire"),
        ("adr-sample-0001", "app-legacy-ledger", "retires", "Sistema legacy pianificato per la dismissione"),
        ("adr-sample-0001", "tech-aws-cluster", "governs", "Infrastruttura Kubernetes di riferimento per il nuovo Core"),
        ("adr-sample-0002", "app-stripe-engine", "governs", "Gateway standard per i pagamenti"),
        ("adr-sample-0002", "app-legacy-pay", "retires", "Hub pagamenti legacy da dismettere"),
        ("adr-sample-0002", "proc-send-payment", "modifies", "Semplificazione del processo SEPA Payment"),
        ("adr-sample-0003", "app-feedzai-fraud", "governs", "Transizione dal vecchio modello deprecato al motore AI real-time"),
        ("adr-sample-0004", "tech-aws-cluster", "modifies", "Integrazione sidecar telemetria verso Kafka"),
    ]

    for adr_id, el_id, imp_type, notes in sample_links:
        el_exists = db.query(ArchimateElement.id).filter(ArchimateElement.id == el_id).first()
        if el_exists:
            db.add(ADRLinkedElement(
                id=f"adrl-{uuid.uuid4().hex[:8]}",
                adr_id=adr_id,
                element_id=el_id,
                impact_type=imp_type,
                notes=notes
            ))

    db.flush()

    # Synchronize Motivation Assessment elements and relationships for sample ADRs
    for adr in [adr1, adr2, adr3, adr4]:
        ADRService._sync_archimate_element_for_adr(db, adr)

    db.commit()
