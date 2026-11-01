# EasyEA Model Context Protocol (MCP) Server

Il server **EasyEA MCP** connette gli agenti AI (come **Antigravity**, **Claude Desktop**, **Cursor**, **Continue**, o framework multi-agente come LangChain/CrewAI) alla piattaforma di Enterprise Architecture **EasyEA**.

Permette all'agente di interrogare ed esplorare il repository in linguaggio naturale, eseguire analisi di impatto e resilienza, analizzare il portafoglio applicativo (APM) e redigere decisioni architetturali (ADR) collegate al modello.

---

## 🛠️ Capability esposte tramite MCP

### Tools
- `list_workspaces()`: Elenca i modelli/workspace EA presenti in EasyEA.
- `search_archimate_elements(query, layer, element_type, model_id, limit)`: Ricerca testuale e semantica di elementi ArchiMate 3.x.
- `get_element_details(element_id)`: Scheda tecnica completa dell'elemento (attributi APM, TIME quadrant, costi, lifecycle, owner, diagrammi, ADR).
- `get_element_relationships(element_id, model_id, rel_type)`: Relazioni entranti e uscenti per un nodo.
- `analyze_impact(element_id, model_id, depth, direction)`: Traversata del grafo per determinare l'albero di impatto a monte (`upstream`) e a valle (`downstream`).
- `get_apm_portfolio(model_id)`: Sintesi esecutiva APM (quadranti TIME, costi TCO, criticità di business).
- `get_resilience_and_spof_analysis(model_id)`: Analisi di conformità DORA, RTO/RPO e rilevazione Single Points of Failure (SPOF).
- `audit_model_governance(model_id)`: Verifica di qualità architetturale (elementi orfani, documentazione assente, app senza owner).
- `list_adrs(model_id, status, domain, search)`: Consultazione degli Architecture Decision Records.
- `get_adr_details(adr_id)`: Dettaglio esteso di una decisione architetturale.
- `create_adr_draft(title, context_and_problem, decision_outcome, ...)`: Creazione assistita di una nuova bozza di ADR collegata a elementi EA.

### Resources
- `easyea://models`: Elenco aggiornato dei cataloghi e workspace EA.

### Prompts
- `architectural_impact_review(component_name)`: Guida strutturata per l'agente nella valutazione dell'impatto di un componente.

---

## 🔑 1. Generazione della API Key in EasyEA

Le chiamate B2B e del server MCP si autenticano tramite una API Key persistente con prefisso `eea_live_`.

Puoi generare una chiave tramite chiamata API REST:

```bash
curl -X POST "http://localhost:8000/api/api-keys" \
  -H "Authorization: Bearer <TUO_JWT_SESSIONE>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Antigravity EA Agent", "expires_in_days": 90}'
```

La risposta conterrà:
```json
{
  "id": "key-uuid",
  "name": "Antigravity EA Agent",
  "prefix": "eea_live_a1b2c3",
  "raw_key": "eea_live_abc123...456",
  "warning": "Salva la chiave 'raw_key' in un luogo sicuro..."
}
```

---

## 🚀 2. Configurazione nei Client MCP

### In Google Antigravity / Claude Desktop

Aggiungi la configurazione al tuo file di configurazione MCP (ad esempio in `~/.gemini/antigravity/mcp_servers.json` o `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "easyea": {
      "command": "/home/lucky/Develpment/EasyEA/backend/venv/bin/python",
      "args": [
        "/home/lucky/Develpment/EasyEA/mcp-server/server.py"
      ],
      "env": {
        "EASYEA_BASE_URL": "http://localhost:8000/api",
        "EASYEA_API_KEY": "eea_live_IL_TUO_TOKEN_SEGRETO",
        "EASYEA_DEFAULT_MODEL_ID": "sample-easybank-ea"
      }
    }
  }
}
```

### In Cursor IDE (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "easyea": {
      "command": "python",
      "args": ["mcp-server/server.py"],
      "env": {
        "EASYEA_BASE_URL": "http://localhost:8000/api",
        "EASYEA_API_KEY": "eea_live_IL_TUO_TOKEN_SEGRETO"
      }
    }
  }
}
```

---

## 💻 3. Esecuzione Manuale e Test

### Test rapido di avvio (stdio):
```bash
cd mcp-server
EASYEA_BASE_URL="http://localhost:8000/api" EASYEA_API_KEY="eea_live_..." ../backend/venv/bin/python server.py
```

### Modalità Server SSE (per agenti distribuiti in cloud):
FastMCP supporta nativamente il trasporto HTTP Server-Sent Events (SSE):
```bash
../backend/venv/bin/mcp run server.py --transport sse --port 8001
```
