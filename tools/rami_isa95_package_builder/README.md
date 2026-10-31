# RAMI 4.0 & ISA-95 Industry Framework Package Builder for EasyEA

Questo tool autonomo genera il pacchetto di riferimento conforme agli standard **RAMI 4.0 (Reference Architectural Model Industrie 4.0 - DIN SPEC 91345 / Plattform Industrie 4.0)** e **ISA-95 (IEC 62264 Manufacturing Operations Management)** in formato `.eap` (EasyEA Attribute & Reference Package).

## Isolamento e Docker Boundary
> [!IMPORTANT]
> Questa cartella (`tools/rami_isa95_package_builder/`) è **completamente esclusa dall'immagine Docker di produzione** di EasyEA tramite `.dockerignore`.
> Serve unicamente come utility offline / pipeline CI/CD per compilare il file distributivo `rami-isa95-1.0.0.eap` distribuito tramite il Package Repository / Marketplace di EasyEA.

## Standard di Riferimento
- **RAMI 4.0 (DIN SPEC 91345)**: Modello a 3 coordinate tridimensionali per Industrie 4.0 (Layers architetturali, Hierarchy Levels, Lifecycle & Value Stream).
- **ISA-95 / IEC 62264**: Integrazione tra Enterprise Control (L4 ERP), Manufacturing Operations Management (L3 MES/MOM), Automation & SCADA (L2), Sensing & Actuation (L1).
- **Asset Administration Shell (AAS / IEC 63278)**: Specifiche per il Digital Twin industriale standardizzato.

## Utilizzo

```bash
python3 tools/rami_isa95_package_builder/build_rami_package.py
```

L'output verrà generato in:
`backend/app/packages_repository/rami-isa95-1.0.0.eap`
e registrato con relativo hash SHA-256 in `backend/app/packages_repository/index.json`.
