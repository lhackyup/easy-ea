# SCOR Digital Standard (SCOR DS) Package Builder for EasyEA

Questo tool autonomo genera il pacchetto di riferimento conforme allo standard **SCOR DS (Supply Chain Operations Reference Digital Standard - ASCM)** in formato `.eap` (EasyEA Attribute & Reference Package).

## Isolamento e Docker Boundary
> [!IMPORTANT]
> Questa cartella (`tools/scor_ds_package_builder/`) è **completamente esclusa dall'immagine Docker di produzione** di EasyEA tramite `.dockerignore`.
> Serve unicamente come utility offline / pipeline CI/CD per compilare il file distributivo `scor-ds-1.0.0.eap` distribuito tramite il Package Repository / Marketplace di EasyEA.

## Standard di Riferimento
- **SCOR DS (ASCM - Association for Supply Chain Management)**: Modello unificato a 7 processi core (*Orchestrate, Plan, Order, Source, Transform, Deliver, Return*).
- **Metriche e KPI Standard**: Affidabilità (OTIF, Perfect Order), Reattività (Order Cycle Time), Agilità (Upside Adaptability), Costi (COGS, Supply Chain Cost), Asset (Cash-to-Cash Cycle Time C2C).
- **Sistemi Core Supply Chain**: Supply Chain Planning (SCP/S&OP), Warehouse Management System (WMS), Transportation Management System (TMS), Supplier Relationship Management (SRM).

## Utilizzo

```bash
python3 tools/scor_ds_package_builder/build_scor_package.py
```

L'output verrà generato in:
`backend/app/packages_repository/scor-ds-1.0.0.eap`
e registrato con relativo hash SHA-256 in `backend/app/packages_repository/index.json`.
