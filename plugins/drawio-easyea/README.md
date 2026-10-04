# EasyEA Integration Suite per Draw.io Desktop

Questo plugin estende l'applicazione desktop **Draw.io** (compatibile con Linux, macOS e Windows, oltre che con la versione Web) consentendo la sincronizzazione bidirezionale, il controllo delle versioni e la gestione del ciclo di vita dei modelli **ArchiMate 3.x** direttamente con la piattaforma aziendale **EasyEA**.

---

## 🚀 Funzionalità Principali

1. **⚙️ Configurazione & Accesso (`Impostazioni / Login`)**:
   - Connessione sicura al server EasyEA (es. `http://localhost:8000`).
   - Autenticazione con credenziali locali o token SSO/Keycloak.
   - Memorizzazione sicura della sessione e profilo utente.

2. **📥 Check-out Schema (`Check-out Schema...`)**:
   - Esplorazione delle librerie/workspace di modellazione.
   - Visualizzazione in tempo reale dello stato degli schemi (`🟢 Disponibile` vs `🔒 In uso da [Utente]`).
   - Blocco esclusivo (*lock*) sul server EasyEA e download/apertura automatica del diagramma in Draw.io.

3. **🔍 Inserimento Elementi dal Catalogo Globale (`Inserisci Elemento da Catalogo...`)**:
   - Ricerca istantanea nel catalogo centrale di EasyEA per nome o tipo.
   - Inserimento diretto nel canvas con forma nativa **ArchiMate 3.x** (colori di layer standard, bordi, font e metadati `easyea_id`).
   - *Nota: abilitato per gli schemi attualmente in Check-out.*

4. **📤 Check-in Schema con Diff Visivo (`Check-in Schema (Commit & Diff)...`)**:
   - Calcolo automatico delle differenze (*Diff*) rispetto alla versione presente su EasyEA.
   - Cruscotto riepilogativo delle modifiche (*Nuovi elementi, Nuove relazioni, Elementi modificati, Relazioni modificate, Rimossi*).
   - Inserimento del messaggio di commit descrittivo.
   - Creazione della nuova versione dello schema nel repository, sincronizzazione del catalogo aziendale e rilascio automatico del blocco (*unlock*).

5. **❌ Annullamento Check-out (`Annulla Check-out (Discard)...`)**:
   - Rilascio del blocco esclusivo sul server senza salvare le modifiche locali.

---

## 📦 Installazione in Draw.io Desktop (3 semplici passaggi)

### Passo 1: Individuare il file del Plugin
Il file del plugin è situato in:
```
plugins/drawio-easyea/easyea-plugin.js
```
*(o percorso assoluto all'interno del progetto EasyEA)*.

### Passo 2: Aggiungere il Plugin in Draw.io Desktop
1. Avvia l'applicazione desktop **Draw.io**.
2. Dalla barra dei menu superiore, clicca su **Extra** $\rightarrow$ **Plugin...** (oppure in lingua inglese *Extras* $\rightarrow$ *Plugins...*).
3. Nella finestra di dialogo che compare, clicca sul pulsante **Aggiungi...** (*Add...*).
4. Clicca su **Scegli file...** (*Choose file...*) e seleziona il file `easyea-plugin.js`.
5. Clicca su **Applica** (*Apply*).

### Passo 3: Riavviare Draw.io
1. Chiudi e riapri **Draw.io Desktop**.
2. Noterai la nuova voce di menu **EasyEA** nella barra dei menu in alto!

---

## 🎯 Guida Rapida al Flusso di Lavoro Quotidiano

```
+-------------------------------------------------------------+
| 1. Configura & Accedi (Menu EasyEA -> Impostazioni/Login)   |
+-------------------------------------------------------------+
                             |
                             v
+-------------------------------------------------------------+
| 2. Check-out Schema (Scarica il diagramma e applica il lock)|
+-------------------------------------------------------------+
                             |
                             v
+-------------------------------------------------------------+
| 3. Modella e Riutilizza:                                    |
|    - Disegna liberamente con la palette ArchiMate           |
|    - Inserisci elementi dal Catalogo Centrale EasyEA        |
+-------------------------------------------------------------+
                             |
                             v
+-------------------------------------------------------------+
| 4. Check-in Schema:                                         |
|    - Revisiona il Diff di elementi e relazioni              |
|    - Inserisci il messaggio di commit                       |
|    - Salva la nuova versione e rilascia il lock             |
+-------------------------------------------------------------+
```

---

## 🛠️ Avvio da Riga di Comando (Opzionale)

Se preferisci avviare Draw.io caricando il plugin direttamente da terminale:
```bash
drawio --load-plugin /percorso/assoluto/EasyEA/plugins/drawio-easyea/easyea-plugin.js
```
