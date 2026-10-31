# BIAN Package Builder for EasyEA

Questo tool autonomo genera il pacchetto di riferimento conforme allo standard **BIAN Service Landscape v12.0** (Banking Industry Architecture Network) in formato `.eap` (EasyEA Attribute & Reference Package).

## Isolamento e Docker Boundary
> [!IMPORTANT]
> Questa cartella (`tools/bian_package_builder/`) è **completamente esclusa dall'immagine Docker di produzione** di EasyEA tramite `.dockerignore`.
> Serve unicamente come utility offline / pipeline CI/CD per estrarre e compilare il file `bian-12.0.0.eap` distribuito tramite il Package Repository / Marketplace di EasyEA.

## Fonte Dati Ufficiale Open Source
- **Fonte**: Repository GitHub ufficiale [bian-official/public](https://github.com/bian-official/public)
- **Licenza**: Apache 2.0 (Open Source)
- **Specifiche**: OpenAPI 3.0 (YAML/JSON) relative alla Release 12.0.0 (`release12.0.0/semantic-apis/oas3/yamls`)
- **Contenuto generato**:
  - Tassonomia completa con **8 Business Areas** e **~40 Business Domains**
  - **247 Service Domains** ufficiali BIAN mappati come `BusinessService` stereotipati «Service Domain»
  - **247 Control Records** associati mappati come `BusinessObject` stereotipati «Control Record»
  - Relazioni gerarchiche di Aggregazione e relazioni semantiche di Serving/Accesso
  - Viste e Dashboard di analisi preconfigurate per il Core Banking

## Utilizzo

```bash
# Esecuzione con Python 3
python3 tools/bian_package_builder/build_bian_package.py
```

L'output verrà generato in:
`backend/app/packages_repository/bian-12.0.0.eap`
e registrato con relativo hash SHA-256 in `backend/app/packages_repository/index.json`.
