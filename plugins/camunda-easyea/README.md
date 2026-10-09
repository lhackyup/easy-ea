# EasyEA Integration Suite for Camunda Modeler Desktop

This plugin extends the **Camunda Modeler** desktop application (v5.x+, available on Linux, macOS, and Windows), enabling business analysts and Enterprise Architects to design process workflows in standard **BPMN 2.0** and synchronize them bidirectionally with the **EasyEA Platform** and its **ArchiMate 3.x** metamodel.

---

## 🚀 Key Features

1. **⚙️ Configuration & Authentication (`Settings / Login...`)**:
   - Secure connection to your EasyEA server instance (e.g. `http://localhost:8000`).
   - Authentication via local credentials or SSO/OAuth Bearer tokens.
   - Active repository / workspace selection.

2. **📥 BPMN Process Check-out (`Check-out BPMN Process...`)**:
   - Live repository browser with real-time collaborative lock status (`🟢 Available` vs `🔒 Locked by [User]`).
   - Exclusive lock acquisition on EasyEA server and instant diagram loading onto the Camunda Modeler canvas.

3. **🔍 Insert Element from EA Catalog (`Insert Element from EA Catalog...`)**:
   - Real-time search across the centralized EasyEA Catalog (Business Roles, IT Applications, Business Objects).
   - Injects standard `easyea:metadata` extensions to preserve architectural lineage.

4. **📤 Process Check-in with Semantic Diff (`Check-in Process (Commit & Diff)...`)**:
   - Automated semantic difference calculation (*Diff*) between the local BPMN XML and the EasyEA database.
   - Change summary dashboard (*New tasks/activities, modified lanes/roles, generated ArchiMate relationships*).
   - Descriptive version commit message and automatic lock release.

5. **🔓 Discard Check-out (`Discard Check-out...`)**:
   - Releases the exclusive lock on the server without modifying repository state.

---

## 📦 2-Step Installation in Camunda Modeler

### Step 1: Download or Locate the Plugin Folder
The plugin files are located in:
```
plugins/camunda-easyea
```
*(or download the auto-generated ZIP package directly from the EasyEA Schema Repository page or via API at `http://localhost:8000/api/plugin/camunda/download`)*.

### Step 2: Copy the Folder into Camunda Modeler Plugins Directory

Copy the `camunda-easyea` directory into your operating system's Camunda Modeler plugin folder:

- **🐧 Linux**:
  ```bash
  mkdir -p ~/.config/camunda-modeler/resources/plugins
  cp -r plugins/camunda-easyea ~/.config/camunda-modeler/resources/plugins/
  ```

- **🍎 macOS**:
  ```bash
  mkdir -p ~/Library/Application\ Support/camunda-modeler/resources/plugins
  cp -r plugins/camunda-easyea ~/Library/Application\ Support/camunda-modeler/resources/plugins/
  ```

- **🪟 Windows**:
  Copy the `camunda-easyea` folder into:
  ```text
  %APPDATA%\camunda-modeler\resources\plugins\
  ```

### Step 3: Restart Camunda Modeler
Restart **Camunda Modeler**. You will see:
- The **EasyEA** menu in the top menu bar.
- The floating status widget at the bottom-left of the modeling canvas.

---

## 🗺️ BPMN 2.0 ➔ ArchiMate 3.x Mapping Reference

During Check-in, the EasyEA conversion engine automatically maps BPMN constructs to ArchiMate 3.x:

| BPMN 2.0 Construct | ArchiMate 3.x Element | ArchiMate Layer |
| :--- | :--- | :--- |
| `bpmn:process` / `bpmn:subProcess` | `Business Process` | Business |
| `bpmn:participant` (Pool) | `Business Actor` | Business |
| `bpmn:lane` | `Business Role` (with `Assignment`) | Business |
| `bpmn:userTask` / `bpmn:manualTask` | `Business Process` / `Business Function` | Business |
| `bpmn:serviceTask` / `bpmn:scriptTask` | `Application Service` (with `Serving`) | Application |
| `bpmn:dataObject` / `dataStore` | `Business Object` (with `Access`) | Business |
| `bpmn:startEvent` / `bpmn:endEvent` | `Business Event` | Business |
| `bpmn:exclusiveGateway` / `parallelGateway` | `Junction (Or / And)` | Core |
| `bpmn:sequenceFlow` | `Triggering Relationship` | Core |
| `bpmn:messageFlow` | `Flow Relationship` | Core |
