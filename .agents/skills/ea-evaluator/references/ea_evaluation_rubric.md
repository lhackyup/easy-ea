# Griglia di Valutazione per l'Enterprise Architect (`ea_evaluation_rubric.md`)

Usa questa checklist dettagliata per ispezionare il codice di EasyEA e formulare osservazioni tecniche e funzionali mirate.

---

## Area 1: Disegno di Applicazioni e Processi di Business (Modeling & Diagramming)

### 1.1 Usabilità del Canvas e Visualizzazione ArchiMate (`DiagramViewer.tsx`, `DrawioEditorModal.tsx`, `archimateVisuals.tsx`)
- **Contenimento / Nesting visivo**: In ArchiMate e BPMN è fondamentale inserire un elemento dentro un altro (es. *Application Function* dentro *Application Component*, *System Software* dentro *Node*, *Sub-process* in *Process*). Come viene gestito il parent/child nel grafo React Flow e nella conversione Draw.io?
- **Distinzione visiva delle relazioni**: Un EA deve distinguere a colpo d'occhio una relazione strutturale (*Composition*, *Aggregation*, *Assignment*, *Realization*) da una di dipendenza (*Serving*, *Access*, *Influence*) o dinamica (*Triggering*, *Flow*). Gli archi nel diagramma usano gli stili di linea e le frecce standard Open Group?
- **Viewpoint & Filtri**: L'architetto può filtrare rapidamente un diagramma complesso per *Layer* (Business, Application, Technology), per tipo di relazione o isolare il sottografo a $k$ salti da un nodo selezionato (*Neighborhood Exploration*)?
- **Layout automatico**: Esiste un layout gerarchico (es. Dagre / ELK) stratificato per layer ArchiMate (Business in alto, Application al centro, Technology in basso)?

### 1.2 Integrazione Processi BPMN 2.0 ↔ ArchiMate (`bpmn_service.py`, `camunda-easyea`)
- **Ponte semantico BPMN-ArchiMate**: Quando un analista disegna un processo BPMN in Camunda (Task, Service Task, Pool/Lane, Message Flow, Data Object), come viene mappato nel repository ArchiMate?
  - *Pool / Lane* $\leftrightarrow$ *Business Actor / Business Role*
  - *Process / SubProcess / Task* $\leftrightarrow$ *Business Process / Business Step*
  - *Service Task / Send Task* $\leftrightarrow$ *Application Service / Application Component* (tramite relazione `Serving`)
  - *Data Object / Data Store* $\leftrightarrow$ *Business Object / Data Object* (tramite relazione `Access`)
- **Controllo di coerenza in Check-in (`schema_diff_service.py`)**: Il diff prima del check-in evidenzia chiaramente se un elemento disegnato è **nuovo** nel catalogo centrale o **riutilizza** un oggetto esistente, prevenendo l'inquinamento del repository con duplicati (es. `"CRM"`, `"CRM System"`, `"Salesforce CRM"`)?

---

## Area 2: Analisi delle Relazioni del Metamodello (`metamodel_service.py`, `RelationsMatrix.tsx`)

### 2.1 Rigore del Metamodello ArchiMate 3.x
- **Copertura Layer & Aspect**: Sono supportati gli aspetti *Active Structure*, *Behavior*, *Passive Structure* e i layer *Strategy*, *Business*, *Application*, *Technology*, *Physical*, *Motivation*, *Implementation & Migration*?
- **Matrice di Validazione**: `metamodel_service.py` valida la creazione di relazioni sia da UI sia durante l'import/check-in? Permette agli amministratori di estendere gli attributi custom (es. *Data Classification*, *RTO/RPO*, *Cloud Provider*, *API Protocol*)?
- **Relazioni Derivate (ArchiMate Derivation Rules)**:
  - In ArchiMate, se il Nodo Tecnologico $T$ *realizza* o *serve* il Componente Applicativo $A$, e $A$ *serve* il Processo di Business $P$, esiste una relazione derivata per cui $T$ *serve* $P$.
  - EasyEA calcola o visualizza le **relazioni indirette/derivate** nella `RelationsMatrix.tsx` o mostra solo le relazioni dirette a 1 salto?

### 2.2 Strumenti di Analisi Relazionale per l'Architetto
- **Matrice di Relazione (`RelationsMatrix.tsx`)**:
  - Permette di incrociare qualsiasi Tipo Sorgente con qualsiasi Tipo Destinazione (es. *Application Component* vs *Data Object* per vedere chi legge/scrive quali dati - matrice CRUD)?
  - Permette di creare/modificare/eliminare una relazione direttamente cliccando sulla cella della matrice?
  - Evidenzia righe/colonne vuote (es. applicazioni che non servono alcun processo o processi privi di copertura applicativa)?

---

## Area 3: Analisi di Impatto e Graph Analytics (`process_service.py`, `ProcessNavigator.tsx`, `apm_service.py`)

### 3.1 Algoritmo di Propagazione dell'Impatto (What-If & Failure Simulation)
- **Traversal Multi-Hop reale vs Lookup statico**:
  - Verifica in `process_service.py` come viene calcolato l'impatto: esplora ricorsivamente catene arbitrarie (es. `Database Server` $\rightarrow$ `System Software` $\rightarrow$ `Microservice A` $\rightarrow$ `API Gateway` $\rightarrow$ `Frontend App` $\rightarrow$ `Application Service` $\rightarrow$ `Business Process` $\rightarrow$ `Product / Customer Stakeholder`) o assume una struttura fissa a livelli predefiniti?
- **Semantica della propagazione**:
  - Distingue la direzione della dipendenza? (Se $A$ *uses/is served by* $B$, un guasto su $B$ impatta $A$, ma non necessariamente viceversa; mentre per *Flow* o *Triggering* l'impatto segue il flusso degli eventi/dati).
- **Metriche di Criticità del Grafo**:
  - **Single Point of Failure (SPOF)**: Identifica componenti tecnologici o applicativi privi di ridondanza che, se spenti, bloccano processi business con alta criticità?
  - **Blast Radius & Change Impact**: Oltre al "guasto infrastrutturale", un EA fa analisi di impatto per **modifiche evolutive** (es. *"Se modifico o dismetto questo Data Object / Application Interface, quali altre applicazioni e processi devono essere aggiornati e con quale costo di integrazione?"*).
  - **RTO / RPO & SLA Mismatch**: Segnala se un processo business con criticità *Mission Critical* (es. SLA 99.99%) dipende da un'applicazione o infrastruttura con SLA inferiore (es. 99.0%) o in stato *Eliminate / Sunset* nella TIME Matrix?
