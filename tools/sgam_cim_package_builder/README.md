# SGAM & CIM Smart Grid Framework Package Builder for EasyEA

Questo tool autonomo genera il pacchetto di riferimento conforme agli standard **SGAM (Smart Grid Architecture Model - CEN-CENELEC-ETSI)** e **CIM (Common Information Model - IEC 61968 / IEC 61970 / IEC 62325)** in formato `.eap` (EasyEA Attribute & Reference Package).

## Isolamento e Docker Boundary
> [!IMPORTANT]
> Questa cartella (`tools/sgam_cim_package_builder/`) è **completamente esclusa dall'immagine Docker di produzione** di EasyEA tramite `.dockerignore`.
> Serve unicamente come utility offline / pipeline CI/CD per compilare il file distributivo `sgam-cim-1.0.0.eap` distribuito tramite il Package Repository / Marketplace di EasyEA.

## Standard di Riferimento
- **SGAM (CEN-CENELEC-ETSI Smart Grid Mandate M/490)**: Modello a 3 dimensioni (Interoperability Layers, Electrical Domains, Operational Management Zones).
- **IEC 61970 (EMS-API) & IEC 61968 (DMS-API)**: Common Information Model (CIM) per la modellazione unificata della rete di trasmissione, distribuzione e smart metering.
- **Protocolli di Telecomunicazione Energetica**: IEC 61850 (Substation Automation), IEC 60870-5-104 (SCADA Telecontrol), DLMS/COSEM (Smart Metering).

## Utilizzo

```bash
python3 tools/sgam_cim_package_builder/build_sgam_package.py
```

L'output verrà generato in:
`backend/app/packages_repository/sgam-cim-1.0.0.eap`
e registrato con relativo hash SHA-256 in `backend/app/packages_repository/index.json`.
