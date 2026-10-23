---
name: ea-evaluator
description: >-
  Use this skill when the user asks to evaluate, review, audit, or improve EasyEA from the perspective of an Enterprise Architect, specifically focusing on ArchiMate 3.x / BPMN 2.0 modeling & diagramming, metamodel relationship analysis, impact analysis, APM, or architectural governance.
---

# EasyEA Enterprise Architect Evaluator (`ea-evaluator`)

Questa skill guida l'agente (o un sub-agente specializzato definito tramite `define_subagent` / `invoke_subagent`) a valutare **EasyEA** dal punto di vista di un **Principal Enterprise Architect** (esperto in TOGAF, ArchiMate 3.2, BPMN 2.0, Application Portfolio Management e Graph Impact Analysis) e a proporre miglioramenti concreti e prioritizzati.

## 1. Quando e come eseguire la valutazione

1. **Delega a un Sub-Agente specializzato (Consigliato per audit completi)**:
   - Usa `define_subagent` per creare l'agente `ea-architect-reviewer` (con accesso di lettura alla codebase) usando la griglia di valutazione in [references/ea_evaluation_rubric.md](./references/ea_evaluation_rubric.md).
   - Invocalo con `invoke_subagent` specificando se l'audit deve essere **globale** o **focalizzato** su una singola area (es. solo Diagramming, solo Impact Analysis, solo Metamodello).
2. **Esecuzione diretta (Per verifiche mirate)**:
   - Se l'utente chiede un parere rapido su una singola feature o schermata, leggi direttamente i file coinvolti seguendo la mappa architetturale qui sotto.

---

## 2. Mappa dei file chiave di EasyEA da ispezionare

Durante l'analisi, verifica sempre l'effettiva implementazione nel codice sorgente:

### A. Metamodello, Elementi e Relazioni (ArchiMate 3.x)
- **Modelli DB & Schema**: `backend/app/models/archimate.py`
- **Logica e Validazione Metamodello**: `backend/app/services/metamodel_service.py`, `backend/app/api/metamodel.py`
- **Gestione Elementi e Relazioni**: `backend/app/api/elements.py`, `backend/app/api/relationships.py`
- **UI Gestione Metamodello & Matrice Relazioni**:
  - `frontend/src/features/admin/MetamodelManager.tsx`
  - `frontend/src/features/architect/RelationsMatrix.tsx`
  - `frontend/src/features/architect/ArchitectRepository.tsx`

### B. Disegno di Applicazioni, Architetture e Processi di Business
- **Visualizzatore & Canvas Interattivo (React Flow)**:
  - `frontend/src/features/architect/DiagramViewer.tsx`
  - `frontend/src/features/architect/ArchitectSavedViews.tsx`
  - `frontend/src/lib/archimateVisuals.tsx`
- **Integrazione Draw.io, Archi e Camunda BPMN 2.0**:
  - Backend: `backend/app/services/drawio_service.py`, `backend/app/services/bpmn_service.py`, `backend/app/services/schema_diff_service.py`, `backend/app/services/schema_export_service.py`, `backend/app/parsers/archi_parser.py`
  - Frontend: `frontend/src/features/architect/DrawioEditorModal.tsx`, `frontend/src/features/schemas/SchemaRepository.tsx`, `frontend/src/features/schemas/CheckinDiffModal.tsx`
  - Plugin Desktop: `plugins/archi-easyea/`, `plugins/drawio-easyea/`, `plugins/camunda-easyea/`

### C. Analisi di Impatto, Lineage e Relazioni tra Oggetti
- **Process Lineage & What-If Impact Simulator**:
  - Backend: `backend/app/services/process_service.py`, `backend/app/api/processes.py`
  - Frontend: `frontend/src/features/processes/ProcessNavigator.tsx`
- **Application Portfolio Management (APM) & Functional Overlap**:
  - Backend: `backend/app/services/apm_service.py`, `backend/app/services/overlap_service.py`
  - Frontend: `frontend/src/features/apm/APMDashboard.tsx`, `frontend/src/features/overlap/OverlapMatrix.tsx`, `frontend/src/features/business/ExecutiveOverview.tsx`

---

## 3. Dimensioni obbligatorie di valutazione

Leggi [references/ea_evaluation_rubric.md](./references/ea_evaluation_rubric.md) per i criteri dettagliati. In sintesi, ogni valutazione deve coprire:

1. **Esperienza di Modellazione e Disegno (Application & Business Process Design)**:
   - Conformità notazionale ArchiMate 3.x e BPMN 2.0 (layer, colori, icone, nesting/contenimento visivo, connettori tipizzati).
   - Fluidità del ciclo *Check-out ➔ Modifica (Web / Archi / Draw.io / Camunda) ➔ Diff semantico ➔ Check-in* e riuso del catalogo centrale (evitare duplicati).
   - Supporto ai *Viewpoint* standard (es. Application Cooperation, Business Process Cooperation, Layered Viewpoint, Infrastructure Usage).
2. **Analisi di Impatto e Navigazione del Grafo del Metamodello**:
   - Profondità della *Graph Traversal* (analisi multi-hop $N$-livelli upstream/downstream vs lookup piatto a 1 livello).
   - Direzionalità semantica delle relazioni ArchiMate (es. differenza tra *Serving*, *Realization*, *Triggering*, *Flow*, *Composition*, *Aggregation* nel calcolo della propagazione dei guasti o del cambiamento).
   - Rilevamento automatico di **Single Point of Failure (SPOF)**, dipendenze circolari, nodi orfani e *blast radius* (impatto su SLA, costi, utenti, processi critici).
3. **Governance del Metamodello e Analisi di Portafoglio (APM / Overlap / Gap Analysis)**:
   - Validazione rigorosa delle triple `(SourceType, RelationshipType, TargetType)` e regole di derivazione ArchiMate.
   - Supporto agli stati di transizione (*As-Is*, *Transition/Plateau*, *To-Be*) per l'analisi del cambiamento architetturale.

---

## 4. Formato dell'Output Richiesto

Quando produci il report per l'utente (direttamente o tramite Artifact Markdown), strutturalo sempre in questo modo:

1. **Executive Summary & Maturity Score (1-5)** per ciascuna area:
   - *Modellazione & Diagramming (ArchiMate / BPMN)*
   - *Rigore del Metamodello & Governance*
   - *Analisi di Impatto & Graph Analytics*
   - *Decision Support (APM, Overlap, Executive)*
2. **Punti di Forza Attuali** (con link diretti ai file del codice che li implementano).
3. **Gap Analysis dal punto di vista dell'Enterprise Architect**:
   - Cosa blocca o rallenta un EA reale nell'uso quotidiano di EasyEA (distinguendo tra *Disegno/Modellazione* e *Analisi di Impatto/Relazioni*).
4. **Proposte di Miglioramento & Roadmap Tecnica**:
   - Divisa in **Quick Wins** (basso sforzo, alto valore), **Medium-Term Enhancements** (evoluzioni su grafo/UI) e **Strategic Differentiators** (funzionalità avanzate da tool EA enterprise), indicando per ogni proposta **quali file backend/frontend modificare**.
