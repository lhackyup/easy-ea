# EasyEA v1.3.0 Released: Executive Word Reports, Landscape High-Res Gartner TIME Bubble Matrix & Enhanced Functional Assessment! ☕🌐

We are thrilled to announce that **EasyEA v1.3.0** is officially here!

This release bridges the gap between deep ArchiMate technical models and executive decision-making: you can now generate comprehensive, publication-ready **Microsoft Word (.docx) Strategic Reports** for both **Application Portfolio Management (APM)** and **Functional Capability Assessment** with a single click.

---

### 🌟 What's New in EasyEA v1.3.0?

#### 1. Strategic APM Executive Word Report (`.docx`)
Sharing enterprise architecture assessments with CIOs, CFOs, and leadership committees is now seamless. The newly introduced APM Word export delivers a structured, 7-pillar assessment:
- **Executive Summary & High-Impact KPI Cards**: Total business applications, annual TCO breakdown, rationalization takeout savings, and high-risk application alerts.
- **Dedicated Full-Page Landscape Section (A4)**: Section 2 is rendered horizontally to accommodate the full-width high-resolution **Gartner TIME Bubble Matrix diagram**.
- **Rationalization Priorities Register**: Actionable inventory of applications in *Eliminate* and *Migrate* quadrants.
- **Technology Risk & Regulatory Compliance**: Critical applications evaluated against DORA and NIS2 frameworks with vendor End-of-Life (EOL) timelines.
- **TCO & Financial Distribution**: Symmetrical Capex vs Opex breakdown across the 4 key cost drivers (Licenses, Cloud, AMS, Labor).
- **Interface & Flow Inventory**: Catalog of application integrations, protocols, and data classification.
- **Master Catalog Appendix**: Comprehensive tabular inventory of all active business applications.
- **Symmetric Bilingual Support**: One-click generation in either **English** or **Italian** with localized currency formatting (€).

#### 2. High-Resolution Gartner TIME Bubble Matrix
Instead of generic tables or browser screenshots, EasyEA now generates an executive-grade **2D Bubble Chart diagram** directly on the server (using Pillow):
- **TCO-Proportional Bubble Areas**: Every application is plotted as a circular bubble whose diameter scales cleanly with its annual Total Cost of Ownership.
- **Cartesian Fit Coordinates**: Accurate placement along the **Business Fit (Y)** and **Technical Fit (X)** axes, with a central **2.5 threshold** and clear quadrant demarcation.
- **Physics Collision Relaxation**: Automatic layout relaxation prevents bubble overlaps while strictly maintaining applications within their designated quadrants (*Invest*, *Tolerate*, *Migrate*, *Eliminate*).
- **Quadrant KPI Badges**: Aggregated application counts and total annual spend per quadrant displayed prominently.

#### 3. Functional Assessment Word Report (`.docx`)
The **Functional Analysis & Capability Mapping** view now features its own dedicated Word report:
- **Full-Page Capability Heatmap**: Multi-column visual capability map generated on a dedicated landscape page, color-coded by maturity and fit (*Excellent*, *Adequate*, *Tolerable*, *GAP*).
- **Functional Gaps Register**: Prioritized list of uncovered capabilities requiring immediate architecture or procurement focus.
- **Functional Overlaps Register**: Inventory of duplicate software solutions with redundancy index calculations and estimated net consolidation savings.

#### 4. Streamlined Business Hub Navigation & Instant Persistence
- Single-level sidebar modules for rapid navigation: *Executive Overview*, *Functional Analysis*, *Processes & Lineage*, and *APM*.
- Full-width switcher tabs with automatic state persistence in `localStorage`, preserving your active view and selected model workspace across browser reloads (F5 / Ctrl+F5).

---

### 🛡️ Security, Reliability & Quality
- **Python Security Hardening**: Zero SCA vulnerabilities across all 83 backend packages, with deterministic pinning.
- **Headless Server-Side Rendering**: Diagram generation runs purely inside the backend container without requiring headless browsers or display servers.
- **Test Suite Isolation**: Comprehensive test fixtures guaranteeing clean test isolation across all APM, functional, and security test suites.

---

### 📖 Documentation & Links
- 📘 [APM & Gartner TIME Documentation (English)](https://easyea.lhackyup.dev/en/docs/user-guide/business/apm-and-time-matrix/)
- 📘 [Functional Overlap & Capability Mapping (English)](https://easyea.lhackyup.dev/en/docs/user-guide/business/functional-overlap/)
- ⚡ [Live Interactive Demo](https://easyea-demo.onrender.com/)
- 📦 [Docker Container (GHCR)](https://github.com/lhackyup/easy-ea/pkgs/container/easy-ea)

---

### ☕ Support EasyEA on Buy Me a Coffee
EasyEA is built with passion as an open, accessible, and rigorous platform for enterprise architects and business leaders worldwide.

You can pull the new release today via Docker:
```bash
docker pull ghcr.io/lhackyup/easy-ea:1.3.0
```

If EasyEA saves your team hours of presentation crafting and delivers clarity to your organization, please consider supporting future developments with a coffee! ☕

Warm regards,  
**Lhackyup**
