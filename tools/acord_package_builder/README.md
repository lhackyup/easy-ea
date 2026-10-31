# ACORD Insurance Framework Package Builder for EasyEA

Questo tool autonomo genera il pacchetto di riferimento conforme allo standard **ACORD Framework (Association for Cooperative Operations Research and Development)** in formato `.eap` (EasyEA Attribute & Reference Package).

## Isolamento e Docker Boundary
> [!IMPORTANT]
> Questa cartella (`tools/acord_package_builder/`) è **completamente esclusa dall'immagine Docker di produzione** di EasyEA tramite `.dockerignore`.
> Serve unicamente come utility offline / pipeline CI/CD per compilare il file distributivo `acord-framework-1.0.0.eap` distribuito tramite il Package Repository / Marketplace di EasyEA.

## Standard di Riferimento
- **ACORD Capability Model**: Mappa gerarchica delle capacità assicurative di business per i rami Danni (P&C), Vita & Previdenza (Life & Annuity) e Riassicurazione.
- **ACORD Information Model**: Dizionario semantico canonico dei dati assicurativi (Policy, Coverage, Claim, Insured Object, Premium, Reinsurance Treaty).
- **ACORD Component Model**: Architettura applicativa dei sistemi core assicurativi (Policy Administration, Claims Management, Rating Engine, Underwriting Workbench).

## Utilizzo

```bash
python3 tools/acord_package_builder/build_acord_package.py
```

L'output verrà generato in:
`backend/app/packages_repository/acord-framework-1.0.0.eap`
e registrato con relativo hash SHA-256 in `backend/app/packages_repository/index.json`.
