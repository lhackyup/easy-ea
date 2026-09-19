# EasyEA - Business-Oriented Enterprise Architecture Platform

**EasyEA** è una piattaforma web-based di Enterprise Architecture progettata con due anime distinte:
1. **🏛️ Architect Hub (ArchiMate Core)**: Metamodello standard ArchiMate 3.x, parser compatibile al 100% con **Archi Tool** (`.archimate` e *Open Group Model Exchange XML*), navigatore di elementi e relazioni con layer filtering, e visualizzatore di viste grafiche interattive basato su React Flow.
2. **💼 Business & Executive Hub**: 
   - **Application Portfolio Management (APM)**: Calcolo automatico della **TIME Matrix** di Gartner (*Tolerate, Invest, Migrate, Eliminate*), tracciamento TCO / costi annui, ownership, SLA e lifecycle status.
   - **Analisi dell'Overlapping Funzionale**: Matrice dinamica *Capability / Funzione vs Applicazioni*, calcolo dell'indice di ridondanza e stima delle opportunità di risparmio per razionalizzare le licenze.
   - **Catalogo Processi & What-If Impact Simulator**: Mappa di lineage (*Stakeholder ➔ Processo ➔ Applicazioni ➔ Infrastruttura Cloud*) e simulatore in tempo reale delle conseguenze di dismissioni o disservizi applicativi.

---

## 🏗️ Architettura & Stack Cloud-Native

- **Backend**: Python 3.12 + FastAPI (Asincrono, Pydantic v2, SQLAlchemy)
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + `@xyflow/react` (React Flow) + Lucide Icons
- **Database**: PostgreSQL (con supporto SQLite per sviluppo locale zero-config)
- **Deployment**: Docker Multi-stage compatto (< 100MB RAM), pronto per **Render**, **Railway**, **GCP Cloud Run**, **AWS App Runner / ECS**, **Azure Container Apps**.

---

## 🚀 Avvio Rapido

### Opzione A: Con Docker Compose (Consigliato)
Avvia backend, frontend e PostgreSQL con un singolo comando:

```bash
docker compose up --build -d
```
L'applicazione web sarà accessibile all'indirizzo: `http://localhost:8000`  
*(PostgreSQL è esposto sull'host alla porta **`5433`** per non entrare in conflitto con un'eventuale istanza Postgres locale sulla 5432).*

---

### Opzione B: Sviluppo Locale (Senza Docker)

#### 1. Avvia il Backend:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```
*Il backend crea automaticamente il DB SQLite `easyea.db` e popola il modello demo "EasyBank" al primo avvio.*

#### 2. Avvia il Frontend:
```bash
cd frontend
npm install
npm run dev
```
Apri il browser su: `http://localhost:3000`

---

## 🧪 Esecuzione dei Test Automatizzati

```bash
cd backend
source venv/bin/activate
PYTHONPATH=. pytest tests/test_all.py
```

---

## ☁️ Deployment sul Cloud a Basso Costo

- **Render.com / Railway**:
  1. Connetti il repository Git.
  2. Aggiungi un Database PostgreSQL gestito (Free / Starter Tier).
  3. Deploya il servizio Web selezionando il `Dockerfile` nella root del repository.
  4. Imposta la variabile d'ambiente `DATABASE_URL` fornita da Render/Railway.
- **Google Cloud Run**:
  1. Esegui la build dell'immagine Docker su Artifact Registry: `gcloud builds submit --tag gcr.io/YOUR_PROJECT/easyea .`
  2. Deploya con scaling a zero: `gcloud run deploy easyea --image gcr.io/YOUR_PROJECT/easyea --platform managed --allow-unauthenticated`
