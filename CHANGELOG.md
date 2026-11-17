# Changelog

Tutte le modifiche degne di nota apportate al progetto EasyEA sono documentate in questo file.
Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/) e aderisce al [Semantic Versioning](https://semver.org/lang/it/).

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
