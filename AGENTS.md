# Regole di Progetto per EasyEA (Project Guidelines & Rules)

Queste regole sono vincolanti per tutte le sessioni di sviluppo e interazione con l'agente.

---

## 1. Internazionalizzazione (i18n) Obbligatoria e Sempre Attiva
- **Zero stringhe hardcoded**: Nessuna stringa testuale visibile all'utente (etichette, titoli, pulsanti, descrizioni, messaggi di errore, avvisi, placeholder, tooltip, opzioni di filtro, stati o intestazioni di tabelle ed export CSV) deve essere scritta direttamente nel codice del frontend o nelle API utente.
- **Supporto Bilingue Simmetrico IT / EN**: Per qualsiasi nuova funzionalità, schermata, componente o modifica:
  1. Aggiornare SEMPRE contestualmente sia `frontend/src/locales/it.ts` che `frontend/src/locales/en.ts`.
  2. Utilizzare le chiavi tramite `useLanguage()` (`t...`).
  3. Verificare che il cambio lingua tra Italiano e Inglese sia reattivo al 100% in tutta la vista, inclusi modali ed export di dati.
- **Formattazione e Valute**: Utilizzare i formatter localizzati per valute (€ / EUR), numeri e percentuali rispettando il contesto linguistico.

---

## 2. Standard Architetturali e UI
- **ArchiMate 3.x / BPMN 2.0 Compliance**: Rispettare sempre il metamodello standard senza forzature non conformi.
- **Verifica della Build**: Eseguire sempre `cd frontend && npm run build` e verificare l'assenza di errori TypeScript prima di considerare completata un'attività di frontend.
- **Docker Mount**: Verificare che le modifiche al codice backend e frontend siano sincronizzate con i container Docker in esecuzione.
