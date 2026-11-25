# Changelog

Tutte le modifiche degne di nota apportate al progetto EasyEA sono documentate in questo file.
Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/) e aderisce al [Semantic Versioning](https://semver.org/lang/it/).

---

## [1.4.0] - 2026-11-25

### Added
- **Modulo Surveys & Crowdsourcing Architetturale**:
  - Campagne di rilevazione distribuita per la manutenzione partecipata del repository di Enterprise Architecture: creazione campagne, gestione del ciclo di vita (`draft`, `active`, `closed`), scadenze e workflow di approvazione (`review_required` o `direct_apply`).
  - **Matrice di Assegnazione Ownership Bidirezionale**: vista unificata per la mappatura e la delega di responsabilità su Application Assets (Application Owner) e Processi di Business (Process Owner).
  - **Portale Owner Unificato (`OwnerDashboard`)**: cruscotto dedicato a responsabili applicativi e di processo con riepilogo a schede dei propri asset in gestione, avanzamento percentuale di completezza dati, e questionari attivi da compilare.
  - **Wizard Guidato a 5 Step per Applicazioni**: aggiornamento guidato di anagrafica e note funzionali, valutazione Business & Technical Fit con calcolo quadrante Gartner TIME, Hosting & Lifecycle (SLA, classificazione dati, criticità DORA), TCO & costi con mascheramento/redaction per ruoli non autorizzati, e calcolo diff interattivo pre-approvazione.
  - **Wizard Guidato a 5 Step per Processi di Business (BPMN)**: censimento metriche di performance operativa (tempo medio di ciclo in minuti, volume mensile transazioni, rework / error rate %), livello di automazione BPMN (Full Automated STP, Semi-Automated, AI-Assisted, Manual), SLA e RTO di processo, e governance regolamentare (DORA Core ICT Service, GDPR High Risk, AML).
  - **Merge Automatico nel Modello ArchiMate**: alla revisione e approvazione da parte dell'Enterprise Architect, i dati validati vengono fusi deterministicamente nelle proprietà (`ArchimateElement.properties`) e nella documentazione del repository.
- **Suite Analitica Avanzata per Processi di Business & BPMN**:
  - Cruscotti analitici integrati: *Process Lineage* (catena di valore e dipendenze applicative), *Process Automation* (tasso STP vs AI-assisted vs manuale), *Process TCO* (allocazione costi IT sui processi aziendali), *Process Outage Simulator* (analisi blast radius e simulazione impatto disservizio ICT sul business), *Process Risks & DORA Audit*, e *Process Decommissioning*.
- **Motore di Ricerca Utenti & Autocomplete Universale (`UserAutocomplete`)**:
  - Endpoint backend indicizzato `GET /api/rbac/users/search?q=...` con ricerca full-text case-insensitive su nome, username ed email.
  - Componente frontend reattivo con soglia minima a 3 caratteri, debounce a 250ms, avatar con iniziali, badge dei ruoli e selezione rapida.
  - Posizionamento dinamico e intelligente (`placement="auto"`) che calcola lo spazio verticale disponibile ed esegue il dropup verso l'alto quando il campo è vicino al margine inferiore del viewport o della modale, prevenendo la sovrapposizione con le barre comandi.

### Changed
- **Razionalizzazione Matrice RBAC (Tassonomia Ortogonale a 7 Ruoli)**:
  - Definizione pulita di 7 ruoli di governance: `admin`, `architect`, `c_level`, `app_owner`, `process_owner`, `business_user`, `viewer`.
  - Unificazione dei ruoli direzionali nel ruolo canonico **`c_level`** (*"C-Level & Board: CIO, CFO, CEO, CISO"*), eliminando le ridondanze storiche (`executive`).
  - Rimozione del ruolo ambiguo `analyst` (con migrazione automatica degli analisti verso `architect` o `business_user`).
  - Migrazione automatica delle assegnazioni nel database e deduplicazione delle tuple utente/ruolo in `seed_default_rbac`.
- **Internazionalizzazione (i18n) Bilingue Completa**:
  - Estensione simmetrica al 100% dei dizionari IT ed EN per tutti i flussi di survey, matrice di ownership, audit BPMN, ruoli RBAC e componenti autocomplete.

### Security & Compliance
- **Audit Sicurezza e Conformità**:
  - Suite di test di sicurezza e RBAC estesa a 32 test automatici (`pytest`), inclusa verifica su isolamento multi-tenant, revoca token, audit trail, cifratura segreti, CSP e HSTS.
  - Zero vulnerabilità critiche o non bloccate nell'ecosistema Python.

---

## [1.3.0] - 2026-11-21

### Added
- **Esportazione Report Strategico APM in Word (.docx)**:
  - Generatore esecutivo `APMReportService` che produce un documento Word (.docx) completo di 7 sezioni strategiche: Executive Summary con KPI Cards, Matrice Gartner TIME, Priorità di Razionalizzazione (Eliminate & Migrate), Rischio Tecnologico e Alert DORA/NIS2, Analisi Finanziaria TCO, Registro Interfacce & Flussi di Integrazione, e Appendice Master Catalog tabellare orizzontale.
  - Supporto bilingue simmetrico (Italiano e Inglese) selezionabile con un clic, con formattazione numerica e monetaria localizzata.
  - Endpoint API dedicato `GET /api/apm/export/docx/{model_id}?lang=it|en`.
- **Matrice Strategica Gartner TIME a Bolle (Bubble Chart) ad Alta Risoluzione**:
  - Rendering grafico nativo backend a 1540×960 pixel tramite Pillow, inserito nel documento Word su una **sezione a piena pagina orizzontale dedicata (Landscape A4)** con ritorno automatico a Portrait.
  - Rappresentazione a bolle (Bubble Chart) perfettamente coincidente con la vista web interattiva di EasyEA: diametro delle bolle proporzionale al **TCO annuo** (in scala radice quadrata), etichette con nome e costo formattato, assi cartesiani continui (Business Fit Y vs Technical Fit X), e algoritmo di *physics collision relaxation* per distribuire uniformemente i punti nei rispettivi quadranti.
  - Codifica cromatica ufficiale: Invest (Smeraldo), Tolerate (Blu), Migrate (Ambra con testo a contrasto), Eliminate (Rosso), con badge di riepilogo per quadrante (conteggio app, spesa aggregata €/anno, soglie e raccomandazione d'azione).
- **Esportazione Report Analisi Funzionale in Word (.docx)**:
  - Generazione di report Word dedicato con Heatmap delle Capability e adeguatezza funzionale a 3 colonne, impaginata in orizzontale (Landscape A4) con legenda cromatica e registro tabellare delle buche funzionali (GAP).
- **Navigazione & UX Semplificata nel Business Hub**:
  - Riorganizzazione della barra laterale a singoli moduli esecutivi: *Executive Overview*, *Functional Analysis*, *Processes & Lineage*, *APM*.
  - Switcher a schede a riga intera con persistenza automatica della scheda selezionata e della libreria/workspace attivo su `localStorage` attraverso i refresh del browser (F5 / Ctrl+F5).

### Changed
- **Libreria Grafica Server-Side**:
  - Inclusione di `pillow==13.0.0` nel file `requirements.txt` e nell'immagine Docker per abilitare la generazione headless e deterministica dei diagrammi senza dipendenze browser o dipendenze esterne.

### Fixed
- **Isolamento Test Suite Pytest**: Corretto il ripristino di `app.dependency_overrides` tra moduli nei test di esportazione reportistica Word e analisi funzionale.
- **Filtraggio Coerente Business Applications**: Standardizzato il calcolo delle metriche di Lifecycle e Decommissioning per considerare rigorosamente le sole Business Application censite.

---

## [1.2.0] - 2026-11-17

### Added
- **APM Interface & Flow Inventory**: Nuovo pillar e dashboard per la catalogazione e la governance delle interfacce applicative (`ApplicationInterface`) e flussi di integrazione.
  - Tracciamento delle applicazioni sorgente e destinazione con risoluzione automatica delle Business Application coinvolte.
  - Metadati architetturali completi: protocollo (REST, GraphQL, gRPC, Kafka/MQ, SOAP, SFTP, DB Link), pattern architetturale (Sync Request/Reply, Async Event-Driven, Batch/File ETL, Stream/CDC), data object scambiati, livello di classificazione dei dati (Public, Internal, Confidential, Restricted/PII), criticità e stato operativo.
  - Ricerca full-text e filtri reattivi per protocollo, pattern e riservatezza dei dati, con indicatori statistici in tempo reale.
- **Catalogo Business Application Ergonomico e Strutturato**:
  - Filtraggio rigoroso delle sole `Business Application` all'interno dell'Application Catalog.
  - Modale di dettaglio applicazione a dimensione ergonomica fissa con navigazione a schede per sezioni tematiche: Attributi Generici, Metriche APM, TIME Matrix, Rischio Tecnologico e Relazioni Architetturali.

### Changed
- **Allineamento Metriche APM a 6 Pilastri**:
  - Armonizzazione coerente di tutti i moduli APM (Catalogo, TIME Matrix, Interface Inventory, TCO, Rischio Tecnologico e Lifecycle & Decommissioning Roadmap) per valutare univocamente le sole Business Application attive, depurando il conteggio da sub-componenti tecnici di basso livello.

### Security & Hardening
- **Dynamic Sliding-Window Rate Limiter**:
  - Middleware FastAPI per la mitigazione automatica di attacchi DoS e tentativi di brute-force sugli endpoint di autenticazione (`/api/auth/login`, `/api/auth/mfa/verify`) con finestre temporali mobili.
- **Database Connection Hardening**:
  - Rafforzamento della configurazione dei connection pool PostgreSQL/SQLite, controlli SSL e gestione sicura delle credenziali.
- **RFC 9116 `.well-known/security.txt`**:
  - Pubblicazione standardizzata delle policy di Vulnerability Disclosure e contatti di sicurezza.
- **Suite di Test di Sicurezza**:
  - Aggiunti test automatizzati per container, database configuration, rate limiting dinamico e security.txt (`test_container_and_db_security.py`, `test_dynamic_rate_limiter.py`, `test_password_and_security_txt.py`).

### Fixed
- **Navigazione Tab Dettaglio Applicazione**: Risolto il problema di rendering che forzava il reset al tab iniziale quando si consultavano le Relazioni Architetturali.
- **Pulizia Traduzioni i18n**: Rimozione di chiavi duplicate e allineamento bilingue simmetrico IT/EN.

---

## [1.1.0] - 2026-11-13

### Added
- **Draw.io Web Integrato Nativo**: Editor visuale a schermo intero accessibile direttamente dal browser senza richiedere installazioni locali o plugin desktop.
  - Iniezione automatica e dinamica della **Palette Completa ArchiMate 3.x** con colori standard, icone vettoriali e notazione ufficiale.
  - Sincronizzazione automatica bidirezionale e salvataggio trasparente con versionamento nel repository degli schemi (`POST /api/schemas`).
  - Passaggio trasparente dei token di sessione (SSO pass-through) e policy di auto-close alla chiusura della finestra modale.
- **Supporto Stereotipi e Stencil di Settore**: Estensione del metamodello per supportare package standard (BIAN, TM Forum, ACORD, RAMI 4.0 / ISA-95, SCOR-DS, SGAM / CIM) con attributi tipizzati e stili grafici personalizzati.
- **Ruolo Utente Viewer**: Aggiunto il ruolo dedicato `viewer` nei modali di assegnazione ruoli RBAC.
- **Creazione Utente con Username/Email Personalizzati**: Possibilità di definire puntualmente username ed email durante la registrazione di nuovi utenti dall'Admin Hub.
- **Blueprint Cloud Modulari per Render.com**: Aggiunte configurazioni specifiche `render.yaml` (Turnkey All-in-One con draw.io), `render.demo.yaml`, `render.dev.yaml` e `render.external-db.yaml`.

### Security & Hardening
- **HSTS Preload & Content Security Policy (CSP)**: Rafforzate le direttive con `frame-ancestors 'self'`, `default-src 'self'`, `script-src` protetto e frame consentiti solo per `embed.diagrams.net` e l'istanza draw.io locale.
- **Revoca Rigorosa dei Token JWT**: Gestione integrata del logout con registrazione dei token JTI revocati nel database PostgreSQL/SQLite.
- **Multi-Factor Authentication (MFA)**: Supporto per policy di MFA obbligatoria e self-service TOTP.
- **Security Audit Trail Immutabile**: Tracciamento di tutti gli eventi di autenticazione e autorizzazione con hash concatenati.

### Fixed
- **Credenziali Demo Dinamiche**: Allineamento automatico tra banner della modalità dimostrativa e utente demo registrato a database.
- **Isolamento Test Suite di Sicurezza**: Rimozione delle fixture `autouse` invasive e standardizzazione dell'ambiente di test.

---

## [1.0.1] - 2026-11-04

### Added
- Internazionalizzazione completa (i18n) per il frontend (Italiano ed Inglese).
- Supporto multilingua per package e metadati di architettura.

---

## [1.0.0] - 2026-10-31

### Added
- **Architect Hub**: Parser ArchiMate 3.x (.archimate e Open Group XML), navigatore di elementi/relazioni con layer filtering e viewer React Flow.
- **Business Hub**: Application Portfolio Management (APM) con calcolo automatico della TIME Matrix di Gartner, analisi dell'overlapping funzionale e navigatore processi/simulatore di impatto.
- **Sicurezza Enterprise**: Autenticazione OIDC (Keycloak/Entra ID), RBAC a ruoli gerarchici, API Keys e Audit Trail.
- **Deploy Container**: Dockerfile compatto multi-stage e orchestrazione Docker Compose.
