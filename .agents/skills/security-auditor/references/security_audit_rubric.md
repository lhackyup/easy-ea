# Griglia di Valutazione AppSec SAST & SCA per EasyEA (`security_audit_rubric.md`)

Usa questa checklist dettagliata per condurre audit di sicurezza **SAST** (Static Application Security Testing) e **SCA** (Software Composition Analysis) su **EasyEA** (Backend FastAPI/Python, Frontend React/Vite/TypeScript, Plugin Archi/Draw.io/Camunda e Container Docker).

---

## 1. Software Composition Analysis (SCA) & Gestione CVE

### 1.1 Dipendenze Backend Python (`backend/requirements.txt` & `backend/venv`)
- **Identificazione CVE / GHSA / PYSEC**:
  - Esegui lo scanner `.agents/skills/security-auditor/scripts/run_security_scan.py` per interrogare il database ufficiale **OSV.dev** su tutti i pacchetti diretti e transitivi installati (`fastapi`, `starlette`, `uvicorn`, `sqlalchemy`, `pydantic`, `python-multipart`, `pandas`, `openpyxl`, `pytest`, `httpx`, `anyio`, ecc.).
- **Pinning & Supply Chain Hygiene**:
  - Verifica se `backend/requirements.txt` utilizza versioni bloccate (`==`) con hash o se lascia i pacchetti completamente non pinnati (esponendo il build Docker a *dependency confusion* o breaking/malicious updates).
- **Valutazione di Sfruttabilità (Reachability Analysis)**:
  - Per ogni CVE individuata (es. su `python-multipart`, `starlette`, `fastapi`), verifica nel codice di `backend/app/` se la funzionalità vulnerabile è effettivamente utilizzata ed esposta (es. endpoint `UploadFile` / `Form` in `data_import.py`, `models.py`, `schemas.py`).

### 1.2 Dipendenze Frontend NPM (`frontend/package.json` & `frontend/package-lock.json`)
- **Analisi Lockfile & `npm audit`**:
  - Controlla le vulnerabilità nei pacchetti runtime (`react`, `react-dom`, `reactflow`, `lucide-react`, `d3-*`) e nel toolchain di build/dev (`vite`, `esbuild`, `rollup`, `postcss`, `tailwindcss`).
  - Distingui chiaramente tra CVE **Runtime (Production Bundle)** e CVE **Build/Dev-Server** (es. vulnerabilità su `vite` / `esbuild` / `rollup` e il loro impatto in ambienti di sviluppo o CI/CD).

### 1.3 Plugin Desktop/Web, Script Esterni e Container (`Dockerfile`, `docker-compose.yml`, `plugins/`)
- **Immagini Base Docker**:
  - Controlla `Dockerfile` e `docker-compose.yml`: immagini base (`python:3.11-slim`, `node:20-alpine`), esecuzione come utente `root` vs non-root (`USER`), esposizione porte e gestione segreti nelle variabili d'ambiente.
- **Dipendenze Esterne / CDN / Iframe**:
  - Verifica l'uso di iframe esterni (es. `https://embed.diagrams.net` in `DrawioEditorModal.tsx`) e bundle precompilati (`plugins/camunda-easyea/client/client.bundle.js`) privi di Subresource Integrity (SRI) o pinning di versione.

---

## 2. Static Application Security Testing (SAST) — OWASP Top 10 & CWE

### 2.1 Broken Access Control & Authentication (`OWASP A01 / A07`)
- **Protezione degli Endpoint API (`backend/app/api/*.py`)**:
  - Verifica quali router/endpoint di FastAPI richiedono `Depends(get_current_user)` o controlli RBAC (`rbac_service.py`) e quali sono completamente privi di autenticazione.
  - Controlla se il controllo RBAC è applicato **server-side** nelle API o soltanto **client-side** nella UI React (`AuthContext.tsx`, `Sidebar.tsx`).
- **Gestione Credenziali, Sessioni e Token (`backend/app/services/auth_service.py`, `backend/app/api/auth.py`)**:
  - Come vengono salvate le password o i segreti dei provider OIDC/LDAP/SAML nel DB (`AuthConfig` / `User`)?
  - Come vengono generati, firmati e validati i token di autenticazione? Hanno scadenza, firma crittografica (HMAC/RSA) e protezione contro la falsificazione?
  - Esistono credenziali di default o bypass di login?

### 2.2 XML External Entity (XXE), Deserializzazione & File Upload (`OWASP A03 / A05 / A08`)
- **Parsing XML/BPMN/ArchiMate/Draw.io (`archi_parser.py`, `bpmn_service.py`, `drawio_service.py`, `schema_diff_service.py`)**:
  - EasyEA elabora file XML caricati dagli utenti o dai plugin (`.archimate`, `.xml`, `.bpmn`, `.drawio`).
  - Verifica se viene usato `xml.etree.ElementTree` standard (vulnerabile a **Billion Laughs / XML Bomb DoS** `CWE-776` e, in specifiche configurazioni, XXE `CWE-611`) invece di `defusedxml`.
- **Unrestricted File Upload & DoS (`data_import.py`, `models.py`, `schemas.py`)**:
  - Viene applicato un limite massimo alla dimensione dei file caricati (`UploadFile.read()`) per file `.csv`, `.xlsx`, `.archimate`, `.bpmn` prima di caricarli interamente in RAM?
  - I file Excel (`.xlsx`) sono anch'essi archivi ZIP/XML potenzialmente soggetti a *Zip Bomb* o *Formula/CSV Injection* in fase di export.

### 2.3 Cross-Site Scripting (XSS), PostMessage & Sicurezza Frontend/Plugin (`OWASP A03 / A04`)
- **Comunicazione Cross-Window (`postMessage` in `DrawioEditorModal.tsx`)**:
  - Verifica se `window.addEventListener('message', ...)` valida `event.origin` prima di fidarsi dei messaggi ricevuti e se `iframe.contentWindow.postMessage(..., '*')` usa il wildcard `'*'`.
- **DOM XSS nei Plugin e nel Frontend (`plugins/camunda-easyea/`, `plugins/drawio-easyea/`, `frontend/src/`)**:
  - Controlla l'uso di `.innerHTML = ...` con dati provenienti dal backend o dai file di modello (es. `s.name`, `s.description`, `el.name`, `d.element_name`) senza escaping HTML (`CWE-79`).
- **Storage di Token e Credenziali nei Plugin (`plugins/archi-easyea/`, `plugins/camunda-easyea/`, `plugins/drawio-easyea/`)**:
  - Verifica dove vengono salvati token API o password nei plugin (es. file in chiaro `.easyea.cfg`, `localStorage`).

### 2.4 Security Misconfiguration & Infrastruttura (`OWASP A05`)
- **CORS (`backend/app/main.py`)**:
  - Verifica la configurazione di `CORSMiddleware` (`allow_origins=["*"]` combinato con `allow_credentials=True`).
- **Database & Giacenza Dati (`.gitignore`, `easyea.db`, `test.db`)**:
  - Controlla se database SQLite contenenti utenti, configurazioni auth o dati architetturali sono tracciati o presenti nella working directory e montati nei container.
- **Rate Limiting & Audit Logging**:
  - Verifica se gli endpoint sensibili (`/api/auth/login`, `/api/plugin/auth`, `/api/import/*`) hanno protezione contro brute-force o DoS.
