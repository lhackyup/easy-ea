# EasyEA v1.2.0 Released: APM Interface & Flow Inventory, Structured Business App Catalog & Advanced Security! ☕🌐

Hello everyone, and a warm welcome to our incredible community of enterprise architects, engineers, and **EasyEA** supporters! 🚀

We are delighted to announce that **EasyEA v1.2.0** is officially available!

This release brings one of our most anticipated functional milestones: turning Application Portfolio Management (APM) into a comprehensive **6-Pillar Command Center**, crowned by our brand-new **Interface & Flow Inventory** and an ergonomically redesigned **Business Application Catalog**.

Here is what's new in **v1.2.0**:

---

### 🌐 1. APM Interface & Flow Inventory: Complete Integration Visibility

Understanding how applications communicate and exchange information across complex enterprise landscapes has always been one of the toughest challenges for architects. 

With **EasyEA v1.2.0**, we have introduced the **Interface & Flow Inventory** tab directly inside Application Management:
- **Comprehensive Flow Mapping**: Automatically indexes all `ApplicationInterface` elements and ArchiMate flow/serving relationships.
- **Business Application Resolution**: Intelligently traces interfaces back to their source and target Business Applications, clarifying end-to-end service dependencies.
- **Rich Architectural Metadata**: Capture protocols (REST, GraphQL, gRPC, Kafka/MQ, SOAP, SFTP, DB Link), integration patterns (Sync Request/Reply, Async Event-Driven, Batch/File ETL, Stream/CDC), payload data objects, criticality, and operational status.
- **Data Classification & Governance**: Tag flows by sensitivity (`Public`, `Internal`, `Confidential`, `Restricted / PII`) to accelerate compliance audits and GDPR assessments.
- **Instant Search & Real-time KPI Counters**: Filter by protocol, pattern, and confidentiality in milliseconds with responsive counter chips.

---

### 🏛️ 2. Business Application Catalog & Ergonomic Detail View

We heard your feedback about application catalog usability!
- **Strict Business Application Isolation**: The catalog and APM metrics now exclusively showcase genuine **Business Applications**, filtering out underlying technical subcomponents, middleware, or libraries that used to clutter high-level executive views.
- **Fixed Ergonomic Inspection Modal**: Opening an application from the catalog now presents a beautifully balanced, fixed-dimension modal with seamless tab switching:
  - *Generic Attributes & Identity*
  - *APM Metrics & Ownership*
  - *Gartner TIME Matrix Strategic Assessment*
  - *Technological Risk & EOL Debt*
  - *Interactive Architectural Relationships*

---

### 🛡️ 3. Security Hardening & Rate Limiting

As enterprise adoption grows, security remains our foundational priority:
- **Dynamic Sliding-Window Rate Limiter**: High-precision middleware guarding authentication and sensitive endpoints against brute-force and DoS attempts.
- **Database Connection Hardening**: Strengthened connection pool settings, SSL verification, and timeout configurations for both PostgreSQL and SQLite.
- **RFC 9116 `.well-known/security.txt`**: Standardized vulnerability disclosure guidelines and dedicated security reporting channels.
- **Automated Security Test Suite**: Expanded SAST and SCA coverage ensuring zero critical vulnerabilities in dependencies and container runtimes.

---

### 📖 Explore the Updated Documentation

Our official user guide for APM, the TIME Matrix, and the new Interface Inventory has been updated on our documentation portal:
👉 **APM & Interface Inventory Guide**: https://easyea.lhackyup.dev/en/docs/user-guide/business/apm-and-time-matrix/

---

### ❤️ Thank You for Your Continued Support!

Every feature in EasyEA is inspired by the real-world challenges faced by architects and modeled to make enterprise architecture accessible, actionable, and open.

Take **v1.2.0** for a spin via Docker (`ghcr.io/lhackyup/easy-ea:v1.2.0`) or on your local instance. If EasyEA brings value to your organization, please consider supporting ongoing development with a coffee! ☕

Happy modeling!  
*Lhackyup*
