#!/usr/bin/env python3
"""
EasyEA Protocol Handler (`easyea://`)
Enables direct 1-click launch and checkout of diagrams from EasyEA Web into:
1. ArchiMate Tool (Archi)
2. Draw.io Desktop
3. Camunda Modeler (BPMN)

URI Structure:
  easyea://open?tool=[archi|drawio|bpmn]&schema_id=[ID]&model_id=[MODEL_ID]&token=[JWT]&server=[URL]
"""

import sys
import os
import json
import urllib.parse
import urllib.request
import subprocess
import shutil
import re

LOG_FILE = os.path.expanduser("~/.easyea/easyea-handler.log")

def log(msg):
    try:
        os.makedirs(os.path.expanduser("~/.easyea"), exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except Exception:
        pass
    print(msg)


def notify(title, message):
    try:
        subprocess.run(["notify-send", title, message], check=False)
    except Exception:
        pass


def sanitize_filename(name):
    return re.sub(r'[^a-zA-Z0-9_\-\.]', '_', name)


def sync_easyea_config(server_url, token, model_id, schema_meta=None):
    """
    Ensures ~/.easyea/config.json is up to date with the latest token, server_url, and active library.
    Both Archi plugin and Camunda plugin read from this shared file.
    """
    config_dir = os.path.expanduser("~/.easyea")
    os.makedirs(config_dir, exist_ok=True)
    config_path = os.path.join(config_dir, "config.json")

    existing = {}
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = {}

    existing["server_url"] = server_url.rstrip("/")
    if token:
        existing["token"] = token
    if model_id:
        existing["model_id"] = model_id
        existing["library_id"] = model_id

    # If library info is in schema_meta, store it
    if schema_meta:
        if "library_name" in schema_meta:
            existing["library_name"] = schema_meta["library_name"]
        if "library_code" in schema_meta:
            existing["library_code"] = schema_meta["library_code"]

    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
    log(f"Synced EasyEA config to: {config_path}")


def fetch_schema_info(server_url, token, schema_id):
    """Fetches schema metadata from EasyEA server."""
    url = f"{server_url.rstrip('/')}/api/schemas/{schema_id}/detail"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_model_info(server_url, token, model_id):
    """Fetches model/workspace info from EasyEA server."""
    url = f"{server_url.rstrip('/')}/api/models/{model_id}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def download_schema_content(server_url, token, schema_id):
    """Downloads schema file content without re-locking (since web already checked it out)."""
    url = f"{server_url.rstrip('/')}/api/schemas/{schema_id}/download"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as resp:
        return resp.read()


def sync_drawio_plugin_config(server_url, token, username, full_name, active_schema):
    """
    Injects or prepares active schema and credentials for Draw.io.
    Writes to ~/.easyea/drawio_active_session.json and ensures EasyEA config is ready.
    If Draw.io is running via Snap, also writes to ~/snap/drawio/current/.easyea/
    and ~/snap/drawio/common/.easyea/ so the confined Electron process can access it.
    """
    # Extract user information from JWT token if available
    extracted_user = username
    extracted_full_name = full_name
    if token and "." in token:
        try:
            import base64
            parts = token.split(".")
            if len(parts) >= 2:
                payload_b64 = parts[1]
                payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
                claims = json.loads(base64.urlsafe_b64decode(payload_b64.encode("utf-8")).decode("utf-8"))
                extracted_user = claims.get("username") or claims.get("preferred_username") or extracted_user or "Architetto"
                extracted_full_name = claims.get("full_name") or claims.get("name") or extracted_full_name or extracted_user
        except Exception as e:
            log(f"Warning decoding JWT token: {e}")

    payload = {
        "config": {
            "server_url": server_url.rstrip("/"),
            "token": token,
            "username": extracted_user or "Architetto",
            "full_name": extracted_full_name or extracted_user or "Architetto"
        },
        "active_schema": active_schema
    }

    target_dirs = [os.path.expanduser("~/.easyea")]
    snap_base = os.path.expanduser("~/snap/drawio")
    if os.path.exists(snap_base):
        target_dirs.append(os.path.join(snap_base, "current", ".easyea"))
        target_dirs.append(os.path.join(snap_base, "common", ".easyea"))

    for tdir in target_dirs:
        try:
            os.makedirs(tdir, exist_ok=True)
            sfile = os.path.join(tdir, "drawio_active_session.json")
            with open(sfile, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
            log(f"Wrote Draw.io active session to: {sfile}")
        except Exception as e:
            log(f"Warning writing Draw.io session to {tdir}: {e}")


def handle_archi(server_url, token, schema_id, model_id):
    log(f"Handling Archi checkout for schema {schema_id}...")
    notify("EasyEA Archi Launcher", "Preparazione modello ArchiMate in corso...")

    # 1. Fetch metadata
    schema_data = fetch_schema_info(server_url, token, schema_id)
    model_data = fetch_model_info(server_url, token, model_id) if model_id else {}

    library_name = model_data.get("name", "Active Library")
    library_code = model_data.get("code", "")
    schema_name = schema_data.get("name", "Schema")
    version = schema_data.get("current_version", "v1.0")

    # 2. Update ~/.easyea/config.json
    sync_easyea_config(server_url, token, model_id, {
        "library_name": library_name,
        "library_code": library_code
    })

    # 3. Download content into ~/.easyea/checked_out/
    checked_out_dir = os.path.expanduser("~/.easyea/checked_out")
    os.makedirs(checked_out_dir, exist_ok=True)

    clean_name = sanitize_filename(schema_name)
    file_name = f"{schema_id}_{clean_name}.archimate"
    file_path = os.path.join(checked_out_dir, file_name)

    content = download_schema_content(server_url, token, schema_id)
    with open(file_path, "wb") as f:
        f.write(content)
    log(f"Saved .archimate file to {file_path}")

    # 4. Write .meta.json for EasyEA Archi plugin
    meta_path = os.path.join(checked_out_dir, f"{file_name}.meta.json")
    meta_content = {
        "schema_id": schema_id,
        "model_id": model_id,
        "library_name": library_name,
        "library_code": library_code,
        "schema_name": schema_name,
        "version": version,
        "checked_out_at": schema_data.get("locked_at") or schema_data.get("updated_at")
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta_content, f, indent=2, ensure_ascii=False)
    log(f"Saved .meta.json to {meta_path}")

    # 5. Launch Archi
    archi_bin = shutil.which("archi") or "/opt/Archi/Archi"
    log(f"Launching Archi: {archi_bin} {file_path}")
    subprocess.Popen(
        [archi_bin, file_path],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
        close_fds=True
    )
    notify("EasyEA - Archi", f"Modello '{schema_name}' aperto in Archi!")


def handle_drawio(server_url, token, schema_id, model_id):
    log(f"Handling Draw.io checkout for schema {schema_id}...")
    notify("EasyEA Draw.io Launcher", "Preparazione diagramma Draw.io in corso...")

    # 1. Fetch metadata
    schema_data = fetch_schema_info(server_url, token, schema_id)
    model_data = fetch_model_info(server_url, token, model_id) if model_id else {}

    schema_name = schema_data.get("name", "Schema")
    version = schema_data.get("current_version", "v1.0")

    sync_easyea_config(server_url, token, model_id, {
        "library_name": model_data.get("name", ""),
        "library_code": model_data.get("code", "")
    })

    # 2. Download .drawio file
    checked_out_dir = os.path.expanduser("~/.easyea/checked_out")
    os.makedirs(checked_out_dir, exist_ok=True)

    clean_name = sanitize_filename(schema_name)
    file_name = f"{schema_id}_{clean_name}.drawio"
    file_path = os.path.join(checked_out_dir, file_name)

    content = download_schema_content(server_url, token, schema_id)
    with open(file_path, "wb") as f:
        f.write(content)
    log(f"Saved .drawio file to {file_path}")

    # Write .meta.json
    meta_path = os.path.join(checked_out_dir, f"{file_name}.meta.json")
    meta_content = {
        "schema_id": schema_id,
        "model_id": model_id,
        "schema_name": schema_name,
        "version": version,
        "checked_out_at": schema_data.get("locked_at") or schema_data.get("updated_at")
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta_content, f, indent=2, ensure_ascii=False)

    # Detect Snap confinement for Draw.io on Linux (Ubuntu AppArmor denies access to ~/.easyea dotfolder)
    drawio_bin = shutil.which("drawio") or "/usr/bin/drawio" or "/snap/bin/drawio"
    is_snap = bool(drawio_bin and "/snap/" in drawio_bin)

    launch_file_path = file_path
    if is_snap:
        snap_checked_out_dir = os.path.expanduser("~/snap/drawio/current/checked_out")
        os.makedirs(snap_checked_out_dir, exist_ok=True)
        snap_file_path = os.path.join(snap_checked_out_dir, file_name)
        with open(snap_file_path, "wb") as f:
            f.write(content)
        snap_meta_path = os.path.join(snap_checked_out_dir, f"{file_name}.meta.json")
        with open(snap_meta_path, "w", encoding="utf-8") as f:
            json.dump(meta_content, f, indent=2, ensure_ascii=False)
        launch_file_path = snap_file_path
        log(f"Draw.io is running via Snap. Using snap user data path: {launch_file_path}")

    # 3. Sync Draw.io active session state
    active_schema = {
        "schema_id": schema_id,
        "model_id": model_id,
        "schema_name": schema_name,
        "version": version,
        "checked_out_at": schema_data.get("locked_at") or schema_data.get("updated_at")
    }
    sync_drawio_plugin_config(server_url, token, schema_data.get("locked_by_username", "Architetto"), "", active_schema)

    # 4. Launch Draw.io
    log(f"Launching Draw.io: {drawio_bin} {launch_file_path}")
    subprocess.Popen(
        [drawio_bin, launch_file_path],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
        close_fds=True
    )
    notify("EasyEA - Draw.io", f"Diagramma '{schema_name}' aperto in Draw.io!")


def handle_camunda(server_url, token, schema_id, model_id):
    log(f"Handling Camunda BPMN checkout for schema {schema_id}...")
    notify("EasyEA Camunda Launcher", "Preparazione processo BPMN in corso...")

    schema_data = fetch_schema_info(server_url, token, schema_id)
    schema_name = schema_data.get("name", "Processo")

    sync_easyea_config(server_url, token, model_id)

    checked_out_dir = os.path.expanduser("~/.easyea/checked_out")
    os.makedirs(checked_out_dir, exist_ok=True)

    clean_name = sanitize_filename(schema_name)
    file_name = f"{schema_id}_{clean_name}.bpmn"
    file_path = os.path.join(checked_out_dir, file_name)

    content = download_schema_content(server_url, token, schema_id)
    with open(file_path, "wb") as f:
        f.write(content)
    log(f"Saved .bpmn file to {file_path}")

    camunda_bin = shutil.which("camunda-modeler")
    if camunda_bin:
        subprocess.Popen([camunda_bin, file_path], start_new_session=True)
        notify("EasyEA - Camunda", f"Processo '{schema_name}' aperto in Camunda Modeler!")
    else:
        notify("EasyEA", f"File salvato in {file_path}. Installa 'camunda-modeler' per aprirlo automaticamente.")


def main():
    if len(sys.argv) < 2:
        log("No arguments provided. Usage: easyea-handler easyea://open?...")
        sys.exit(1)

    raw_uri = sys.argv[1]
    log(f"Received raw URI: {raw_uri}")

    parsed = urllib.parse.urlparse(raw_uri)
    if parsed.scheme != "easyea":
        log(f"Unsupported scheme: {parsed.scheme}")
        sys.exit(1)

    # Parse query parameters
    query = urllib.parse.parse_qs(parsed.query)
    tool = query.get("tool", ["archi"])[0].lower()
    schema_id = query.get("schema_id", [None])[0]
    model_id = query.get("model_id", [None])[0]
    token = query.get("token", [None])[0]
    server_url = query.get("server", ["http://localhost:8000"])[0]

    if not schema_id:
        log("Error: schema_id is required.")
        notify("EasyEA Launcher", "Errore: ID schema mancante nell'URL.")
        sys.exit(1)

    if not token:
        # Fallback to existing saved token in ~/.easyea/config.json
        cfg_path = os.path.expanduser("~/.easyea/config.json")
        if os.path.exists(cfg_path):
            try:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    token = json.load(f).get("token")
            except Exception:
                pass

    if not token:
        log("Error: No authentication token provided or found in ~/.easyea/config.json")
        notify("EasyEA Launcher", "Errore: Token di autenticazione non trovato.")
        sys.exit(1)

    try:
        if tool in ["drawio", "draw.io"]:
            handle_drawio(server_url, token, schema_id, model_id)
        elif tool in ["camunda", "bpmn"]:
            handle_camunda(server_url, token, schema_id, model_id)
        else:
            handle_archi(server_url, token, schema_id, model_id)
    except Exception as e:
        log(f"Unhandled error during handling: {e}")
        notify("EasyEA Launcher Error", str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
