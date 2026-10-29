# EasyEA Integration Suite for Archi (jArchi Plugin 5.x)

This package enables enterprise architects to manage the entire ArchiMate modeling lifecycle directly inside the desktop application **Archi**, synchronizing models and catalog elements in real-time with **EasyEA Platform**.

---

## 📁 Organized Package Structure

```text
📁 archi-easyea/
│
├── ⚙️ EasyEA_Settings.ajs                   Configures connection, SSO/Password Login & Active Library
├── 📥 EasyEA_Checkout.ajs                   Browses schemas, performs collaborative check-out with lock & opens model
├── 📤 EasyEA_Checkin.ajs                    Computes visual Diff, prompts for commit msg, syncs to catalog & releases lock
├── 🔓 EasyEA_DiscardCheckout.ajs            Cancels active checkout and releases schema lock on EasyEA
├── 🛡️ EasyEA_AutoGuard.ajs                  Automatic shutdown guard to prevent forgotten active checkouts on exit
│
├── 📁 1. Smart Modeling/
│   ├── 🔍 EasyEA_AddElementFromRepository.ajs   Searches catalog & adds existing elements directly into diagram view
│   ├── 🧭 EasyEA_InspectElement.ajs             360° APM inspection (TIME, lifecycle, ownership, cost) & repo links
│   ├── 🌐 EasyEA_ExpandNeighbors.ajs            Discovers & automatically draws 1-hop connected neighbors from repository
│   └── 💡 EasyEA_SmartRelationshipSuggester.ajs Recommends ArchiMate relations & connects unlinked repo pairs in 1 click
│
└── 📁 2. Diagram Tools/
    ├── 📐 EasyEA_AutoLayoutLayers.ajs           Auto-aligns diagram views into clean ArchiMate 3 layered architecture
    ├── 🏷️ EasyEA_BatchPropertyEditor.ajs        Bulk-assigns APM attributes (TIME, Lifecycle, SLA, etc.) to multiple elements
    ├── 📄 EasyEA_ExportToSaC.ajs                Exports active diagram or model into clean Schema-as-Code (.eac) DSL
    └── 📥 EasyEA_ImportFromSaC.ajs              Selects a .eac code file, compiles it via EasyEA and opens it in Archi
```

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
