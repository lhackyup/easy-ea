---
name: release-manager
description: >-
  Use this skill when the user asks to prepare, audit, tag, document, or execute a new release of EasyEA. Orchestrates security auditing (SAST/SCA), changelog generation, documentation update on the Astro/Cloudflare website (EasyEA-website), Git version tagging, Docker publication, and creating the Buy Me a Coffee community post.
---

# EasyEA Release Manager (`release-manager`)

Questa skill orchestra l'intero ciclo di rilascio di una nuova versione di **EasyEA**, automatizzando i passaggi critici e collegando l'applicazione centrale al sito di documentazione su Cloudflare e alla community su Buy Me a Coffee.

---

## 🏛️ Mappa dei Repository Coinvolti

| Componente | Percorso Locale | Repository GitHub | Hosting / CI/CD |
| :--- | :--- | :--- | :--- |
| **EasyEA Core** | `/home/lucky/Develpment/EasyEA` | `github.com/lhackyup/easy-ea` | GitHub Actions (`docker-publish.yml`) ➔ GHCR (`ghcr.io/lhackyup/easy-ea`) ➔ Render |
| **EasyEA Website & Docs** | `/home/lucky/Develpment/EasyEA-website` | `github.com/lhackyup/easy-ea-website` | Cloudflare Pages (`https://easyea.lhackyup.dev`) |

---

## 🚀 Flusso Operativo del Rilascio (Passo-Passo)

### Fase 1: Pre-Release Check & Security Audit
1. **Verifica stato Git locale**:
   - Assicurati che il working tree di `EasyEA` sia pulito o che le modifiche da rilasciare siano tracciate:
     ```bash
     git status
     ```
2. **Esecuzione Security Scan (SCA + SAST)**:
   - Esegui lo scanner integrato dello skill `security-auditor`:
     ```bash
     python3 .agents/skills/security-auditor/scripts/run_security_scan.py
     ```
   - Esegui i test di sicurezza e unitari:
     ```bash
     PYTHONPATH=backend pytest backend/tests/test_pinned_dependencies.py \
                               backend/tests/test_csp_hsts.py \
                               backend/tests/test_token_revocation.py \
                               backend/tests/test_mfa.py \
                               backend/tests/test_audit_trail.py
     ```
   - *Se emergono vulnerabilità critiche (Critical CVE o SAST blockanti), segnalale prima di procedere con il tag.*

---

### Fase 2: Determinazione Versione & Changelog
1. **Identifica l'ultimo tag Git**:
   ```bash
   git describe --tags --abbrev=0 2>/dev/null || echo "v1.0.0"
   ```
2. **Analizza i commit dall'ultimo tag**:
   ```bash
   git log $(git describe --tags --abbrev=0)..HEAD --oneline
   ```
3. **Calcola la nuova versione semantica (SemVer)**:
   - **Patch (`vX.Y.Z+1`)**: solo bug fix, ritocchi grafici, ottimizzazioni.
   - **Minor (`vX.Y+1.0`)**: nuove funzionalità retrocompatibili (es. nuovo modulo APM, nuovo parser).
   - **Major (`vX+1.0.0`)**: modifiche architetturali con breaking changes sui modelli o sulle API.
   - *Conferma sempre la versione con l'utente.*
4. **Aggiorna `CHANGELOG.md`** su `EasyEA` con le sezioni:
   - `Added` (nuove feature)
   - `Changed` (modifiche al comportamento esistente)
   - `Fixed` (correzioni di bug)
   - `Security` (aggiornamenti di sicurezza e dipendenze)

---

### Fase 3: Aggiornamento Documentazione (`EasyEA-website` ➔ Cloudflare Pages)
1. **Allinea la copia locale del sito**:
   ```bash
   git -C /home/lucky/Develpment/EasyEA-website pull --rebase origin main
   ```
2. **Aggiorna/Crea i file di documentazione MDX**:
   - Percorsi contenuti:
     - Documentazione in Italiano: `/home/lucky/Develpment/EasyEA-website/src/content/docs/it/docs/`
     - Documentazione in Inglese: `/home/lucky/Develpment/EasyEA-website/src/content/docs/en/docs/`
   - Se la release introduce una nuova schermata o funzionalità (es. *Business View Editor*, *TIME Matrix*, *ADR Manager*, *Framework Insights*), aggiorna le relative guide utente in entrambe le lingue.
3. **Commit & Push del sito**:
   ```bash
   git -C /home/lucky/Develpment/EasyEA-website add .
   git -C /home/lucky/Develpment/EasyEA-website commit -m "docs: sync documentation for EasyEA release vX.Y.Z"
   git -C /home/lucky/Develpment/EasyEA-website push origin main
   ```
   > [!NOTE]
   > Il push scatena automaticamente la build di Cloudflare Pages. Il sito `https://easyea.lhackyup.dev` risulterà aggiornato entro 60-90 secondi.

---

### Fase 4: Tag di Versione & Deploy di EasyEA
1. **Commit su EasyEA Core**:
   ```bash
   git add CHANGELOG.md
   git commit -m "chore(release): vX.Y.Z"
   ```
2. **Creazione del Tag Git**:
   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   ```
3. **Push su GitHub**:
   ```bash
   git push origin main
   git push origin vX.Y.Z
   ```
   > [!IMPORTANT]
   > Il push del tag `vX.Y.Z` innesca la GitHub Action `.github/workflows/docker-publish.yml` che compila l'immagine Docker multi-stage e la pubblica sul registro GitHub Container Registry (`ghcr.io/lhackyup/easy-ea:vX.Y.Z` e `:latest`), abilitando il redeploy automatico su Render.

---

### Fase 5: Creazione Bozza Post per Buy Me a Coffee
1. **Generazione del Post per la Community**:
   - **Lingua obbligatoria**: Il post per Buy Me a Coffee **DEVE ESSERE SCRITTO IN INGLESE (`English`)**, poiché la community di sostenitori e architetti è internazionale.
   - **Tone of voice**: Accattivante, empatico, focalizzato sul valore reale per gli utenti e per i supporter.
   - Evita gerghi tecnici da commit grezzi; racconta le novità dal punto di vista dell'utente finale (nuove feature, miglioramenti all'usabilità, impatti pratici sui modelli di architettura).
   - Inserisci sempre i link diretti alle guide ufficiali in inglese con la corretta struttura Starlight: `https://easyea.lhackyup.dev/en/docs/...` (oppure `https://easyea.lhackyup.dev/it/docs/...` per l'italiano). Nota bene: il codice lingua precede `/docs/`.
2. **Salvataggio della Bozza**:
   - Salva l'articolo formattato in Markdown in:
     `.agents/releases/vX.Y.Z/buymeacoffee_post.md`
3. **Presentazione all'utente**:
   - Mostra il testo formattato in inglese pronto da copiare direttamente nella chat o nell'artifact finale.
   - Fornisci il link diretto con un clic per incollare e pubblicare:
     👉 [Buy Me a Coffee Post Editor](https://www.buymeacoffee.com/dashboard/posts)

---

## 📌 Checklist di Conclusione Rilascio
Al termine dell'esecuzione, presenta all'utente:
1. ✅ **Versione Rilasciata**: Tag Git e commit SHA.
2. 🛡️ **Stato Sicurezza**: Esito dell'audit SAST/SCA.
3. 🌐 **Documentazione Online**: Link diretto ai capitoli aggiornati su `https://easyea.lhackyup.dev`.
4. ☕ **Bozza Buy Me a Coffee**: Testo completo generato, percorso del file `.md` salvato e link rapido al pannello per la pubblicazione.
