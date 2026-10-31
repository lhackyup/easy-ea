# TM Forum ODA & eTOM Package Builder for EasyEA

Questo tool autonomo genera il pacchetto di riferimento conforme agli standard **TM Forum Open Digital Architecture (ODA)** e **eTOM (enhanced Telecom Operations Map v23.5)** in formato `.eap` (EasyEA Attribute & Reference Package).

## Isolamento e Docker Boundary
> [!IMPORTANT]
> Questa cartella (`tools/tmforum_package_builder/`) è **completamente esclusa dall'immagine Docker di produzione** di EasyEA tramite `.dockerignore`.
> Serve unicamente come utility offline / pipeline CI/CD per compilare il file distributivo `tmforum-oda-1.0.0.eap` distribuito tramite il Package Repository / Marketplace di EasyEA.

## Standard di Riferimento
- **eTOM (GB921)**: Framework dei processi di business per l'industria delle telecomunicazioni (Operations, Strategy & Product, Enterprise Management).
- **ODA (Open Digital Architecture - IG1228 / GB929)**: Architettura applicativa a componenti aperti disaccoppiati (Engagement, Core Commerce, Production, Party Management, Intelligence).
- **TM Forum Open APIs**: Specifiche REST/OpenAPI standard (TMF620, TMF622, TMF632, TMF641, TMF652, TMF678, ecc.).
- **SID (GB922)**: Modello informativo canonico dei dati (Customer, Product, Service, Resource).

## Utilizzo

```bash
python3 tools/tmforum_package_builder/build_tmforum_package.py
```

L'output verrà generato in:
`backend/app/packages_repository/tmforum-oda-1.0.0.eap`
e registrato con relativo hash SHA-256 in `backend/app/packages_repository/index.json`.
