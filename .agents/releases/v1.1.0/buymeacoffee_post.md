# EasyEA v1.1.0 Released: Embedded Draw.io Web Modeling, Industry Framework Packages & Hardened Enterprise Security! ☕🎨

Hello everyone, and a warm welcome to all supporters and friends in the **EasyEA** community! 🚀

Today we are thrilled to announce that **EasyEA v1.1.0** is officially live!

This release represents a major milestone in making EasyEA more intuitive, accessible, and enjoyable for daily use — whether you are crafting rigorous enterprise architecture models or quickly sketching process and technology blueprints with your team.

---

### 🎨 1. Draw.io Web Embedded Directly in Your Browser (Zero Installation Required!)

One of the most requested features was the ability to edit diagrams directly on the web without having to install desktop software or local plugins.

With **EasyEA v1.1.0**, we have natively embedded **Draw.io Web**:
- Click *"Edit in Draw.io Web"* from any schema, and the full-screen visual canvas opens right inside EasyEA.
- **Complete ArchiMate 3.x Shape Palette**: Canonical notation shapes, colors, and industry stereotypes are injected into your sidebar, ready to drag and drop.
- **Automated Two-Way Sync**: When you close the modal, revisions are automatically committed and versioned in EasyEA's schema repository.
- **Transparent SSO**: Seamless pass-through authentication ensures your session stays active securely.

*Prefer desktop tools?* No worries! The native desktop integration via the `easyea://` protocol handler and our smart **Archi Tool** jArchi scripts remain 100% supported!

---

### 🏛️ 2. Industry Standard Packages & Custom Stereotypes

We have expanded the core metamodel to natively embrace major enterprise frameworks — including **BIAN** (Banking), **TM Forum** (Telecom), **ACORD** (Insurance), **RAMI 4.0 / ISA-95** (Smart Manufacturing), and **SCOR-DS** (Supply Chain). Elements can now carry domain-specific stereotypes, typed attributes, and customized stencil styles.

---

### 🛡️ 3. Enterprise-Grade Security Hardening

Under the hood, we invested heavily in rock-solid security and data governance:
- **Comprehensive Content Security Policy (CSP)** & **HSTS Preload** to prevent clickjacking and code injection.
- **Strict JWT Token Revocation**: Instant session invalidation stored with JTI blacklist tracking in PostgreSQL/SQLite.
- **Multi-Factor Authentication (MFA)**: Support for self-service TOTP enrollment and organization-wide enforcement policies.
- **Tamper-Evident Audit Trail**: Cryptographically chained audit logging for all authentication and administrative actions.

---

### 📖 Explore the Updated Documentation

The official guides for Draw.io Web integration and modular cloud deployments on Render are live on our documentation portal:
👉 **Draw.io & Desktop Guide**: https://easyea.lhackyup.dev/en/docs/user-guide/architecture/desktop-protocol-and-plugins/  
👉 **Cloud Deployment Guide on Render**: https://easyea.lhackyup.dev/en/docs/getting-started/deploy-render/

---

### ❤️ Thank You for Your Support!

EasyEA is evolving rapidly thanks to your feedback, suggestions, and generous coffee donations. 

Take **v1.1.0** for a spin, and let us know your thoughts in the comments below. If EasyEA is saving you time and helping bring clarity to your organization's architecture, consider supporting development by buying a coffee! ☕

Happy modeling!  
*Lucky & the EasyEA team*
