import os
import json
from typing import Optional, Dict, Any, List
try:
    from mcp.server.mcpserver import MCPServer as FastMCP
except ImportError:
    from mcp.server.fastmcp import FastMCP

from config import settings
from client import EasyEAClient

# Istanziazione server FastMCP
mcp = FastMCP(
    name="EasyEA Enterprise Architecture",
    instructions="""
    EasyEA MCP Server connette gli agenti AI con la piattaforma di Enterprise Architecture EasyEA.
    Permette di esplorare elementi ArchiMate 3.x, analizzare impatti e dipendenze grafiche,
    ispezionare il portfolio applicativo (APM TIME matrix), verificare la resilienza operativa DORA/SPOF,
    e consultare o redigere Architecture Decision Records (ADR).
    """
)

ea_client = EasyEAClient()


def _resolve_model_id(model_id: Optional[str]) -> str:
    return model_id.strip() if model_id and model_id.strip() else settings.default_model_id


# ============================================================================
# TOOLS: Models & Workspaces
# ============================================================================

@mcp.tool()
async def list_workspaces() -> str:
    """
    Restituisce l'elenco dei repository / workspace di architettura (modelli) disponibili in EasyEA.
    Ogni modello include ID univoco, codice a 4 lettere, nome e formato di origine.
    """
    res = await ea_client.get_models()
    return json.dumps(res, indent=2, ensure_ascii=False)


# ============================================================================
# TOOLS: Elements & Graph Exploration
# ============================================================================

@mcp.tool()
async def search_archimate_elements(
    query: Optional[str] = None,
    layer: Optional[str] = None,
    element_type: Optional[str] = None,
    model_id: Optional[str] = None,
    limit: int = 25
) -> str:
    """
    Cerca elementi architetturali in EasyEA per parola chiave, layer o tipo.

    Args:
        query: Testo da cercare nel nome o nella documentazione dell'elemento (es. 'Payment', 'Core Banking', 'CRM')
        layer: Layer ArchiMate opzionale (Business, Application, Technology, Strategy, Motivation, Implementation)
        element_type: Tipo ArchiMate opzionale (es. 'ApplicationComponent', 'BusinessProcess', 'Node', 'Capability')
        model_id: ID del workspace (default: 'sample-easybank-ea')
        limit: Numero massimo di risultati (default 25)
    """
    target_model = _resolve_model_id(model_id)
    res = await ea_client.search_elements(
        query=query,
        model_id=target_model,
        layer=layer,
        element_type=element_type,
        limit=limit
    )
    return json.dumps(res, indent=2, ensure_ascii=False)


@mcp.tool()
async def get_element_details(element_id: str) -> str:
    """
    Recupera la scheda di dettaglio completa di un elemento architetturale:
    nome, tipo, layer, documentazione, proprietà personalizzate, stereotipi,
    attributi APM (quadrante TIME, costi, criticità, owner), diagrammi in cui è presente
    e decisioni architetturali (ADR) collegate.

    Args:
        element_id: ID univoco dell'elemento ArchiMate
    """
    res = await ea_client.get_element(element_id.strip())
    return json.dumps(res, indent=2, ensure_ascii=False)


@mcp.tool()
async def get_element_relationships(
    element_id: str,
    model_id: Optional[str] = None,
    rel_type: Optional[str] = None
) -> str:
    """
    Elenca tutte le relazioni dirette (entranti e uscenti) collegate a uno specifico elemento architetturale.

    Args:
        element_id: ID dell'elemento per cui estrarre le relazioni
        model_id: ID del workspace opzionale
        rel_type: Filtro opzionale per tipo di relazione ArchiMate (es. 'Serving', 'Realization', 'Flow', 'Assignment')
    """
    target_model = _resolve_model_id(model_id)
    res = await ea_client.list_relationships(
        model_id=target_model,
        element_id=element_id.strip(),
        rel_type=rel_type
    )
    return json.dumps(res, indent=2, ensure_ascii=False)


@mcp.tool()
async def analyze_impact(
    element_id: str,
    model_id: Optional[str] = None,
    depth: int = 2,
    direction: str = "both"
) -> str:
    """
    Esegue l'analisi di impatto sul grafo architetturale partendo da un elemento sorgente.
    Calcola l'albero di dipendenze per comprendere le conseguenze di una dismissione, modifica o incidente.

    Args:
        element_id: ID dell'elemento su cui valutare l'impatto
        model_id: ID del workspace (default: 'sample-easybank-ea')
        depth: Profondità di esplorazione del grafo (default 2, min 1, max 4)
        direction: 'upstream' (da chi dipende), 'downstream' (chi dipende da esso), oppure 'both'
    """
    target_model = _resolve_model_id(model_id)
    depth = max(1, min(depth, 4))

    # Recupera tutte le relazioni del modello per calcolare l'albero di impatto
    all_rels = await ea_client.list_relationships(model_id=target_model)
    if isinstance(all_rels, dict) and "error" in all_rels:
        return json.dumps(all_rels, indent=2)

    visited_elements = {element_id.strip()}
    current_front = {element_id.strip()}
    impact_tree = {
        "root_element_id": element_id,
        "model_id": target_model,
        "max_depth": depth,
        "direction": direction,
        "levels": []
    }

    for current_depth in range(1, depth + 1):
        level_items = []
        next_front = set()

        for r in all_rels:
            src = r.get("source_id")
            tgt = r.get("target_id")
            rtype = r.get("type")

            # Upstream: chi serve o realizza il nodo corrente
            if direction in ("upstream", "both") and tgt in current_front and src not in visited_elements:
                next_front.add(src)
                level_items.append({
                    "relationship_type": rtype,
                    "direction": "upstream",
                    "from_id": src,
                    "from_name": (r.get("source") or {}).get("name", src),
                    "from_type": (r.get("source") or {}).get("type", "Unknown"),
                    "connected_to": tgt
                })

            # Downstream: chi consuma o dipende dal nodo corrente
            if direction in ("downstream", "both") and src in current_front and tgt not in visited_elements:
                next_front.add(tgt)
                level_items.append({
                    "relationship_type": rtype,
                    "direction": "downstream",
                    "to_id": tgt,
                    "to_name": (r.get("target") or {}).get("name", tgt),
                    "to_type": (r.get("target") or {}).get("type", "Unknown"),
                    "connected_from": src
                })

        visited_elements.update(next_front)
        current_front = next_front
        impact_tree["levels"].append({
            "depth": current_depth,
            "impacted_count": len(level_items),
            "connections": level_items
        })

        if not current_front:
            break

    impact_tree["total_impacted_elements"] = len(visited_elements) - 1
    return json.dumps(impact_tree, indent=2, ensure_ascii=False)


# ============================================================================
# TOOLS: APM (Application Portfolio Management)
# ============================================================================

@mcp.tool()
async def get_apm_portfolio(model_id: Optional[str] = None) -> str:
    """
    Recupera l'Application Portfolio Management (APM) di EasyEA per un modello:
    - Distribuzione nei 4 quadranti TIME (Tolerate, Invest, Migrate, Eliminate) con conteggi e costi
    - Costo Totale di Possesso (TCO / annual cost)
    - Ripartizione per criticità di business (Mission Critical, Business Critical, Operational)
    - Elenco dettagliato delle applicazioni censite con valutazione tecnica e funzionale.

    Args:
        model_id: ID del workspace (default: 'sample-easybank-ea')
    """
    target_model = _resolve_model_id(model_id)
    res = await ea_client.get_apm_portfolio(target_model)
    return json.dumps(res, indent=2, ensure_ascii=False)


# ============================================================================
# TOOLS: Operational Resilience & Governance
# ============================================================================

@mcp.tool()
async def get_resilience_and_spof_analysis(model_id: Optional[str] = None) -> str:
    """
    Restituisce l'analisi di Resilienza Operativa (DORA, RTO/RPO e SLA mismatch) per il modello.
    Rileva discrepanze di disponibilità tra servizi di business e infrastruttura tecnologica sottostante
    e individua potenziali Single Points of Failure (SPOF).

    Args:
        model_id: ID del workspace (default: 'sample-easybank-ea')
    """
    target_model = _resolve_model_id(model_id)
    res = await ea_client.get_resilience_analysis(target_model)
    return json.dumps(res, indent=2, ensure_ascii=False)


@mcp.tool()
async def audit_model_governance(model_id: Optional[str] = None) -> str:
    """
    Esegue un audit automatico sulla qualità e completezza dei dati architetturali nel modello:
    - Componenti privi di documentazione
    - Applicazioni in ambito APM senza proprietario (business/technical owner) o senza quadrante TIME
    - Elementi orfani (senza alcuna relazione con il resto dell'architettura).

    Args:
        model_id: ID del workspace da sottoporre ad audit
    """
    target_model = _resolve_model_id(model_id)
    elements_raw = await ea_client.search_elements(model_id=target_model, limit=300)
    rels_raw = await ea_client.list_relationships(model_id=target_model)

    if isinstance(elements_raw, dict) and "error" in elements_raw:
        return json.dumps(elements_raw, indent=2)
    if isinstance(rels_raw, dict) and "error" in rels_raw:
        return json.dumps(rels_raw, indent=2)

    connected_ids = set()
    for r in rels_raw:
        if r.get("source_id"):
            connected_ids.add(r["source_id"])
        if r.get("target_id"):
            connected_ids.add(r["target_id"])

    missing_docs = []
    missing_owner = []
    missing_time = []
    orphans = []

    for el in elements_raw:
        el_id = el.get("id")
        el_name = el.get("name")
        el_type = el.get("type")
        doc = el.get("documentation") or ""
        props = el.get("properties") or {}

        if not doc.strip():
            missing_docs.append({"id": el_id, "name": el_name, "type": el_type})

        if el_id not in connected_ids and not el.get("is_reference"):
            orphans.append({"id": el_id, "name": el_name, "type": el_type})

        if el_type in ("ApplicationComponent", "ApplicationService"):
            owner = props.get("eea_business_owner") or props.get("eea_technical_owner")
            time_q = props.get("eea_time_quadrant")
            if not owner:
                missing_owner.append({"id": el_id, "name": el_name})
            if not time_q:
                missing_time.append({"id": el_id, "name": el_name})

    report = {
        "model_id": target_model,
        "total_elements_audited": len(elements_raw),
        "total_relationships": len(rels_raw),
        "audit_findings": {
            "missing_documentation_count": len(missing_docs),
            "missing_documentation_samples": missing_docs[:10],
            "orphan_elements_count": len(orphans),
            "orphan_elements_samples": orphans[:10],
            "applications_missing_owner_count": len(missing_owner),
            "applications_missing_owner_samples": missing_owner[:10],
            "applications_missing_time_quadrant_count": len(missing_time),
            "applications_missing_time_quadrant_samples": missing_time[:10]
        },
        "governance_score": max(0, 100 - len(orphans)*2 - len(missing_docs) - len(missing_time)*2)
    }
    return json.dumps(report, indent=2, ensure_ascii=False)


# ============================================================================
# TOOLS: Architecture Decision Records (ADRs)
# ============================================================================

@mcp.tool()
async def list_adrs(
    model_id: Optional[str] = None,
    status: Optional[str] = None,
    domain: Optional[str] = None,
    search: Optional[str] = None
) -> str:
    """
    Elenca gli Architecture Decision Records (ADR) registrati in EasyEA.
    Permette di verificare le decisioni già prese, il loro stato (Draft, Proposed, Accepted, Superseded)
    e i vincoli architetturali approvati.

    Args:
        model_id: ID del workspace (default: 'sample-easybank-ea')
        status: Filtro opzionale ('Draft', 'Proposed', 'Accepted', 'Rejected', 'Superseded')
        domain: Filtro opzionale per dominio ('Business', 'Application', 'Technology', 'Security', ecc.)
        search: Parola chiave di ricerca testuale
    """
    target_model = _resolve_model_id(model_id)
    res = await ea_client.list_adrs(
        model_id=target_model,
        status=status,
        domain=domain,
        search=search
    )
    return json.dumps(res, indent=2, ensure_ascii=False)


@mcp.tool()
async def get_adr_details(adr_id: str) -> str:
    """
    Recupera il contenuto completo di un Architecture Decision Record (ADR):
    contesto del problema, alternative analizzate, decisione finale, conseguenze
    e componenti architetturali ArchiMate ad esso vincolati.

    Args:
        adr_id: ID dell'ADR da visualizzare
    """
    res = await ea_client.get_adr(adr_id.strip())
    return json.dumps(res, indent=2, ensure_ascii=False)


@mcp.tool()
async def create_adr_draft(
    title: str,
    context_and_problem: str,
    decision_outcome: str,
    consequences: Optional[str] = "",
    domain: Optional[str] = "Application",
    linked_element_id: Optional[str] = None,
    model_id: Optional[str] = None
) -> str:
    """
    Crea una nuova bozza controllata di Architecture Decision Record (ADR) in EasyEA (stato 'Draft').
    Consente all'agente di formalizzare una decisione architetturale discussa con l'utente
    e collegarla facoltativamente a un componente ArchiMate.

    Args:
        title: Titolo chiaro e sintetico della decisione (es. 'Adozione di Apache Kafka per i pagamenti realtime')
        context_and_problem: Descrizione del contesto di business, problema o driver che richiede la scelta
        decision_outcome: La decisione architetturale adottata e le motivazioni chiave
        consequences: Conseguenze positive, negative e compromessi (trade-offs)
        domain: Dominio architetturale ('Business', 'Application', 'Technology', 'Security')
        linked_element_id: ID opzionale dell'elemento ArchiMate governato da questa decisione
        model_id: ID del workspace (default: 'sample-easybank-ea')
    """
    target_model = _resolve_model_id(model_id)
    linked = []
    if linked_element_id:
        linked.append({
            "element_id": linked_element_id.strip(),
            "impact_type": "governs",
            "notes": "Collegato automaticamente da AI Agent via EasyEA MCP Server"
        })

    payload = {
        "title": title.strip(),
        "status": "Draft",
        "domain": domain or "Application",
        "context_and_problem": context_and_problem.strip(),
        "decision_outcome": decision_outcome.strip(),
        "consequences": (consequences or "").strip(),
        "author_name": "AI Architecture Agent (MCP)",
        "linked_elements": linked
    }

    res = await ea_client.create_adr(model_id=target_model, payload=payload)
    return json.dumps(res, indent=2, ensure_ascii=False)


# ============================================================================
# RESOURCES & PROMPTS
# ============================================================================

@mcp.resource("easyea://models")
async def get_models_resource() -> str:
    """Catalogo dei modelli architetturali censiti in EasyEA."""
    res = await ea_client.get_models()
    return json.dumps(res, indent=2, ensure_ascii=False)


@mcp.prompt()
def architectural_impact_review(component_name: str) -> str:
    """
    Template di revisione dell'impatto architetturale per un componente software.
    """
    return f"""Sei un Enterprise Architect esperto.
Esegui una revisione completa dell'impatto architetturale per il componente '{component_name}'.
Passi da seguire:
1. Cerca il componente usando `search_archimate_elements` con query='{component_name}'.
2. Recupera i suoi dettagli con `get_element_details` per verificarne layer, proprietà APM e criticità.
3. Esegui `analyze_impact` per determinare tutte le dipendenze a monte e a valle.
4. Controlla se esistono ADR pertinenti con `list_adrs`.
5. Fornisci un report con:
   - Sintesi del componente e ruolo nel sistema
   - Rischi di dismissione o malfunzionamento
   - Raccomandazioni e mitigazioni architetturali.
"""


# ============================================================================
# Entry Point
# ============================================================================

if __name__ == "__main__":
    # Supporta esecuzione via stdio (default per client locali) o via opzioni CLI
    mcp.run()
