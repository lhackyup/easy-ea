# EasyEA Integration Suite for Archi (jArchi Plugin 5.x)

This package enables enterprise architects to manage the entire ArchiMate modeling lifecycle directly inside the desktop application **Archi**, synchronizing models and catalog elements in real-time with **EasyEA Platform**.

---

## 🚀 Features

1. **`EasyEA_Settings.ajs`**: Configures EasyEA server connection (e.g. `http://localhost:8000`), authenticates via **Identity Provider SSO (Keycloak / OIDC Browser Flow)** or local credentials, and allows selecting the **target Library / Workspace** to work on.
2. **`EasyEA_Checkout.ajs`**: Browses repository schemas strictly for the selected active library, performs collaborative check-out with exclusive locking, downloads the `.archimate` model and automatically opens it in Archi.
3. **`EasyEA_AddElementFromRepository.ajs`**: Searches elements already existing in the central EasyEA repository for the active library and adds them directly to the active diagram view, automatically reconnecting relationships with existing nodes.
4. **`EasyEA_InspectElement.ajs`**: Provides **360° Inspection** of any selected element in the diagram (APM/TIME quadrant, lifecycle, ownership, cost, hosting, criticality, and central repository incoming/outgoing relationships), with one-click actions to sync properties or expand missing links.
5. **`EasyEA_ExpandNeighbors.ajs`**: Automatically discovers and draws all 1-hop connected neighbors (incoming/outgoing) directly from the repository around the selected element, connecting them instantly.
6. **`EasyEA_Checkin.ajs`**: Inspects current Archi model changes, computes visual Diff with EasyEA, displays changes summary, prompts for commit message, updates the company catalog, creates a new version snapshot and releases the lock. Restricted strictly to schemas of the active library.
7. **`EasyEA_DiscardCheckout.ajs`**: Cancels active checkout and releases the schema lock on EasyEA without saving changes for the active library.

---

## 📦 2-Step Installation in Archi 5.x

### Step 1: Enable jArchi (Scripting Plugin) in Archi
If you haven't installed the jArchi plugin yet:
1. In Archi go to: **Help** $\rightarrow$ **Manage Plug-ins...**.
2. Install the official **jArchi (Scripting Plugin)** or download it from [archimatetool.com/plugins](https://www.archimatetool.com/plugins).

### Step 2: Copy the Scripts
1. In Archi open the **Scripts** view: **Window** $\rightarrow$ **Show View** $\rightarrow$ **Scripts**.
2. Click the folder icon in the Scripts view to open the user scripts directory in your file manager (or browse to `~/Documents/Archi/scripts` / `~/.archi/scripts` / `%USERPROFILE%\AppData\Roaming\Archi\scripts`).
3. Copy the `archi-easyea` folder inside your `scripts` directory.
4. Right-click and select **Refresh** in the Archi Scripts view: the `archi-easyea` suite is now ready to use!

---

## 🎯 Daily Workflow

1. **Setup & Library Choice**: Double-click `EasyEA_Settings.ajs` to authenticate and choose your target **Library / Workspace**.
2. **Start Work**: Run `EasyEA_Checkout.ajs`, select your target schema from the chosen library and confirm: the diagram will open automatically in Archi.
3. **Model & Intelligence**: 
   - Draw new elements in Archi designer.
   - Run `EasyEA_AddElementFromRepository.ajs` to search and reuse catalog elements from the central repository.
   - Run `EasyEA_InspectElement.ajs` on any element to view its full APM sheet, ownership, and central repository relations.
   - Run `EasyEA_ExpandNeighbors.ajs` on an element to automatically pull in and draw all its connected neighbors.
4. **Finish Work**: Run `EasyEA_Checkin.ajs`, review the diff summary dialog, enter your commit message and confirm!
