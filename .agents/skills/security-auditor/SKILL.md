---
name: security-auditor
description: >-
  Use this skill when the user asks to perform a security audit, SAST (Static Application Security Testing), SCA (Software Composition Analysis), vulnerability scan, or CVE assessment of the EasyEA application (backend, frontend, desktop/web plugins, and Docker configuration).
---

# EasyEA Application Security Auditor (`security-auditor`)

Questa skill guida l'agente (o un sub-agente specializzato definito tramite `define_subagent` / `invoke_subagent`) nell'esecuzione di un audit completo di sicurezza applicativa (**SAST** + **SCA**) su **EasyEA**, individuando le vulnerabilità nel codice sorgente (OWASP Top 10 / CWE) e le **CVE più gravi** nelle dipendenze di terze parti.

## 1. Workflow di Esecuzione dell'Audit

1. **Scansione Automatica SCA + SAST Preliminare**:
   - Esegui sempre per primo lo script dedicato:
     ```bash
     python3 .agents/skills/security-auditor/scripts/run_security_scan.py
     ```
   - Lo script interroga in tempo reale l'API ufficiale **OSV.dev** (`https://api.osv.dev/v1/querybatch`) e `npm audit` per tutte le dipendenze Python (`backend/requirements.txt` e `backend/venv`) e Node/NPM (`frontend/package-lock.json`), estraendo CVE, GHSA, CVSS e versioni con fix, oltre ad analizzare l'AST degli endpoint FastAPI e i pattern SAST critici.
2. **Delega al Sub-Agente `security-auditor` (o Ispezione Approfondita Manuale)**:
   - Usa `define_subagent` per definire l'agente `security-auditor` (un **Principal AppSec Engineer & Penetration Tester**) e invocalo con `invoke_subagent` passandogli i risultati dello scanner oppure verifica manualmente i file critici seguendo [references/security_audit_rubric.md](./references/security_audit_rubric.md).
3. **Analisi di Reachability (Sfruttabilità Reale)**:
   - Non limitarti a elencare l'output grezzo degli scanner: verifica sempre nel codice di EasyEA se una CVE o un finding SAST è **effettivamente raggiungibile e sfruttabile** (es. se una CVE su `python-multipart` o `starlette` impatta gli endpoint `/api/import/*`, `/api/models/upload`, `/api/schemas/*`).

---

## 2. Perimetro di Analisi in EasyEA

### A. Backend FastAPI & Python (`backend/`)
- **Entrypoint, CORS e Middleware**: `backend/app/main.py`, `backend/app/core/config.py`, `backend/app/core/database.py`
- **Autenticazione, RBAC e Gestione Segreti**: `backend/app/api/auth.py`, `backend/app/api/rbac.py`, `backend/app/api/plugin_api.py`, `backend/app/services/auth_service.py`, `backend/app/services/rbac_service.py`
- **Endpoint API & Controllo Accessi**: `backend/app/api/elements.py`, `backend/app/api/relationships.py`, `backend/app/api/metamodel.py`, `backend/app/api/schemas.py`, `backend/app/api/models.py`, `backend/app/api/data_import.py`, `backend/app/api/processes.py`, `backend/app/api/apm.py`, `backend/app/api/overlap.py`, `backend/app/api/saved_views.py`, `backend/app/api/views.py`
- **Parser XML / BPMN / Draw.io / Excel**: `backend/app/parsers/archi_parser.py`, `backend/app/services/bpmn_service.py`, `backend/app/services/drawio_service.py`, `backend/app/services/schema_diff_service.py`, `backend/app/services/schema_export_service.py`
- **Dipendenze Python**: `backend/requirements.txt`, `backend/venv/`

### B. Frontend React / TypeScript (`frontend/`)
- **Autenticazione & Stato Client-Side**: `frontend/src/context/AuthContext.tsx`, `frontend/src/lib/api.ts`, `frontend/src/features/admin/AuthConfigManager.tsx`, `frontend/src/features/admin/RolesManager.tsx`
- **Integrazione Iframe & PostMessage**: `frontend/src/features/architect/DrawioEditorModal.tsx`, `frontend/src/features/schemas/SchemaPreviewModal.tsx`
- **Dipendenze NPM**: `frontend/package.json`, `frontend/package-lock.json`

### C. Plugin & Infrastruttura (`plugins/`, `Dockerfile`, `docker-compose.yml`)
- **Plugin Camunda, Draw.io e Archi**: `plugins/camunda-easyea/client/client.bundle.js`, `plugins/drawio-easyea/easyea-plugin.js`, `plugins/archi-easyea/*.ajs`, `menu-builder.js`
- **Containerizzazione**: `Dockerfile`, `docker-compose.yml`

---

## 3. Struttura del Report di Sicurezza Richiesto

Quando presenti i risultati all'utente (tramite Artifact dettagliato + sintesi in chat), organizza sempre l'analisi in:

1. **Executive Summary & Risk Posture**:
   - Conteggio vulnerabilità per severità (*Critical*, *High*, *Medium*, *Low*) divise tra **SAST** e **SCA (CVE)**.
2. **Analisi SCA — Principali CVE e Vulnerabilità delle Dipendenze**:
   - Tabella completa con: **CVE / GHSA ID**, **Pacchetto & Versione installata**, **Severità / CVSS**, **Descrizione tecnica e Reachability in EasyEA**, **Versione corretta (Remediation)**.
   - Analisi di Supply Chain (pinning in `requirements.txt`, container base images, script esterni).
3. **Analisi SAST — Principali Vulnerabilità nel Codice Sorgente**:
   - Ordinate per gravità (*Critical* $\rightarrow$ *High* $\rightarrow$ *Medium*), con **ID CWE / OWASP Top 10**, **File e Righe esatte cliccabili**, **Scenario di attacco (Proof of Concept concettuale)** e **Fix del codice consigliato**.
4. **Piano di Remediation Prioritizzato**:
   - **Immediate Hotfixes (0-48h)**, **Short-Term Hardening (1-2 settimane)** e **Architectural Security Improvements**.
