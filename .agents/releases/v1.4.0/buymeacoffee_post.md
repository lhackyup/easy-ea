# EasyEA v1.4.0 Released: Participatory Architecture Surveys & Crowdsourcing, BPMN Process Analytics, and 7-Role RBAC! ☕🚀

We are ecstatic to announce the official release of **EasyEA v1.4.0**!

One of the greatest challenges enterprise architects face in modern distributed organizations is keeping architecture repositories fresh, accurate, and aligned with operational reality. Models created in isolation quickly drift. 

**EasyEA v1.4.0 solves this by turning architecture into a team effort.** With this major milestone, we introduce an end-to-end **Surveys & Crowdsourcing Governance Engine**, comprehensive **BPMN Business Process Analytics**, a streamlined **7-Role Orthogonal RBAC Matrix**, and enterprise **Reactive User Autocomplete**.

---

### 🌟 What's New in EasyEA v1.4.0?

#### 1. Participatory Surveys & Architectural Crowdsourcing
Enterprise architects can now launch, monitor, and govern collaborative review campaigns across the entire organization:
- **Campaign Management Lifecycle**: Create and configure campaigns in `Draft`, open them for stakeholder input in `Active`, and lock submissions when `Closed`.
- **Flexible Approval Workflows**: Choose between `Review Required` (architect validation with full side-by-side diff review) or `Direct Apply` for automated repository updates.
- **Unified Ownership Matrix**: Rapidly map and assign **Application Owners** and **Process Owners** with clear accountability across IT and business domains.
- **Owner Dashboard Portal**: A tailored, distraction-free portal for business stakeholders to review their assigned assets, check data completeness scores, and complete surveys.
- **5-Step Guided Application Wizard**: Structured, ergonomic questionnaires covering General Info, Business & Technical Fit (computing the live Gartner TIME quadrant), Hosting & Lifecycle (SLA, DORA criticality, data classification), and TCO (with automated financial redaction for non-finance users).
- **Automated ArchiMate Merge**: Approved survey responses are merged deterministically and atomically into the central ArchiMate repository properties (`ArchimateElement.properties`) and documentation.

#### 2. Advanced BPMN Process Architecture & Performance Analytics
Bring Business Process Architecture to life with end-to-end operational indicators:
- **5-Step Process Questionnaire**: Captures average cycle time (minutes), monthly transaction volumes, rework and error rates (%), BPMN automation tiers (*Full Automated STP*, *Semi-Automated*, *AI-Assisted*, *Manual*), SLAs, and regulatory compliance (*DORA Core ICT Service*, *GDPR High Risk*, *AML*).
- **Process Lineage & Value Chain**: Trace end-to-end dependencies from business capabilities down to serving IT applications and underlying databases.
- **Process Automation & STP Heatmaps**: Visualize straight-through processing rates versus manual human workflows to target automation investments.
- **Process TCO Allocation**: Allocate IT software and infrastructure spend directly onto core business processes for true cost-to-serve insights.
- **Outage Simulator & Blast Radius**: Simulate ICT application downtime and instantly evaluate the cascade impact on business processes, SLA commitments, and regulatory compliance.

#### 3. Streamlined RBAC (7-Role Orthogonal Matrix)
We rationalized the platform's permission matrix into 7 clean, orthogonal roles matching real-world organizational governance:
1. 🛡️ **`admin`**: System administration, multi-tenancy, and security settings.
2. 📐 **`architect`**: ArchiMate modeling, metamodel extensions, schema/ADR approvals, and survey review.
3. 👔 **`c_level`**: Executive visibility into C-suite dashboards (Executive Overview, Tech Risk Radar, Lifecycle Roadmap, DORA Resilience).
4. 📦 **`app_owner`**: Software asset steward managing lifecycle status and completing APM/TIME surveys.
5. ⚙️ **`process_owner`**: Business process owner supervising operational metrics and BPMN compliance.
6. 👥 **`business_user`**: Read-only business exploration and diagram review.
7. 👁️ **`viewer`**: Guest read-only access.

#### 4. Reactive User Autocomplete (`UserAutocomplete`)
Say goodbye to frustrating, unscalable select dropdowns when managing hundreds of corporate users:
- **3-Character Dynamic Search**: Instant full-text search across names, usernames, and corporate emails with a smooth 250ms debounce.
- **Smart Dropup Placement**: The component automatically senses screen boundaries and flips upward (*dropup*) when rendered near bottom action bars or modal footers, ensuring action buttons like *Back* and *Next* are never obstructed.

---

### 🛡️ Security, Hardening & Quality
- **32 Automated Pytest Suites**: Full coverage across security headers, token revocation, multi-tenant isolation, RBAC role scopes, and survey approval workflows.
- **Zero Critical SCA Vulnerabilities**: Fully verified dependency tree across Python and Node.js ecosystems.
- **100% Symmetric Bilingual i18n**: Every label, modal, tooltip, and report fully supported in both Italian and English.

---

### 📖 Documentation & Links
- 📘 [Surveys & Crowdsourcing Documentation (English)](https://easyea.lhackyup.dev/en/docs/user-guide/business/surveys-and-crowdsourcing/)
- 📘 [Users, Roles & RBAC Matrix (English)](https://easyea.lhackyup.dev/en/docs/user-guide/administration/users-and-rbac/)
- 📘 [Process Navigator & Blast Radius (English)](https://easyea.lhackyup.dev/en/docs/user-guide/business/process-navigator-and-impact/)
- 📦 [Docker Container (GHCR)](https://github.com/lhackyup/easy-ea/pkgs/container/easy-ea)
- 🌐 [EasyEA Website & Documentation](https://easyea.lhackyup.dev/)

---

### ☕ Support EasyEA on Buy Me a Coffee
EasyEA is built with dedication to democratize enterprise architecture and empower architects with tools that bridge the gap between technical diagrams and board-level strategy.

You can deploy the new release today with Docker:
```bash
docker pull ghcr.io/lhackyup/easy-ea:1.4.0
```

If EasyEA helps your organization maintain an up-to-date, collaborative architecture repository, please consider [buying a coffee](https://www.buymeacoffee.com/lhackyup) to support ongoing development! ☕✨

Warm regards,  
**Lhackyup**
