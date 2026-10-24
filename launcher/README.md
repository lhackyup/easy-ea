# EasyEA Desktop Protocol Handler (`easyea://`)

La suite di integrazione desktop EasyEA supporta il protocollo URL personalizzato `easyea://` per consentire l'apertura con 1 solo click direttamente dal browser a:
- **Archi** (per modelli e schemi ArchiMate 3.x `.archimate`)
- **Draw.io Desktop** (per diagrammi `.drawio`)
- **Camunda Modeler** (per processi BPMN 2.0 `.bpmn`)

---

## 🚀 Come funziona il flusso

1. **Click su "Check-out" nella web app EasyEA**:
   - EasyEA Web applica il blocco (*lock*) esclusivo sul server.
   - Il browser invoca l'URL:
     ```text
     easyea://open?tool=archi&schema_id=...&model_id=...&token=...&server=http://...
     ```
2. **Attivazione del Protocol Handler di sistema**:
   - Lo script `easyea-handler.py` riceve la richiesta con token di sessione autenticato.
   - Sincronizza istantaneamente le credenziali e la libreria attiva in `~/.easyea/config.json`.
   - Scarica il file aggiornato in `~/.easyea/checked_out/` e ne predispone i metadati `.meta.json`.
   - Avvia direttamente **Archi** o **Draw.io Desktop** con il file aperto e pronto.
3. **Nel tool desktop**:
   - I plugin `archi-easyea` o `drawio-easyea` riconoscono immediatamente l'utente come autenticato e lo schema come bloccato in check-out.
   - Puoi modificare il disegno, inserire componenti dal catalogo aziendale ed eseguire il Check-in senza dover rieseguire login manuali.

---

## 📦 Installazione e Registrazione (Linux)

Dalla cartella principale del progetto:

```bash
chmod +x launcher/linux/install-handler.sh
./launcher/linux/install-handler.sh
```

Lo script registra l'associazione per `x-scheme-handler/easyea` nel desktop environment (`xdg-mime`).

---

## 🧪 Test di verifica da terminale

Puoi verificare il funzionamento in qualsiasi momento eseguendo:

```bash
xdg-open "easyea://open?tool=archi&schema_id=<SCHEMA_ID>&model_id=<MODEL_ID>&server=http://localhost:8000"
```
