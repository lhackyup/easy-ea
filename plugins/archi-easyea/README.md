# EasyEA Integration Suite for Archi (jArchi Plugin 5.x)

This package enables enterprise architects to manage the entire ArchiMate modeling lifecycle directly inside the desktop application **Archi**, synchronizing models and catalog elements in real-time with **EasyEA Platform**.

---

## 🚀 Features

1. **`EasyEA_Settings.ajs`**: Configures EasyEA server connection (e.g. `http://localhost:8000`), supporting both **Identity Provider SSO (Keycloak / OIDC Browser Flow)** and local credentials.
2. **`EasyEA_Checkout.ajs`**: Browses repository schemas, performs collaborative check-out with exclusive locking, downloads the `.archimate` model and automatically opens it in Archi.
3. **`EasyEA_Checkin.ajs`**: Inspects current Archi model changes, computes visual Diff with EasyEA, displays changes summary, prompts for commit message, updates the company catalog, creates a new version snapshot and releases the lock.
4. **`EasyEA_DiscardCheckout.ajs`**: Cancels active checkout and releases the schema lock on EasyEA without saving changes.

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

1. **Setup**: Double-click `EasyEA_Settings.ajs` to configure server URL and authenticate.
2. **Start Work**: Run `EasyEA_Checkout.ajs`, select your target schema and confirm: the diagram will open automatically in Archi.
3. **Model**: Add, modify, or connect elements in Archi designer.
4. **Finish Work**: Run `EasyEA_Checkin.ajs`, review the diff summary dialog, enter your commit message and confirm!
