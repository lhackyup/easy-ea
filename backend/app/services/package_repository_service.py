"""
EasyEA External Package Repository Service.

Manages remote and local package registries (Marketplace / Maven Central for EasyEA):
- Fetches and parses registry catalog index.json (via HTTP/HTTPS or local filesystem fallback).
- Compares available versions with locally installed packages using SemVer.
- Safely downloads .eap bundle archives and installs/upgrades via PackageManagerService.
- Manages repository URL configuration and connectivity tests.
"""

import json
import logging
import os
import re
from typing import Dict, Any, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.archimate import (
    AttributePackage,
    SystemAuthSettings
)
from app.services.package_manager import (
    install_package_bundle,
    parse_semver
)

logger = logging.getLogger(__name__)

# Base directory for local bundled repository
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCAL_REPO_DIR = os.path.join(BASE_DIR, "packages_repository")
LOCAL_INDEX_PATH = os.path.join(LOCAL_REPO_DIR, "index.json")

MAX_BUNDLE_BYTES = 15 * 1024 * 1024  # 15 MB safety limit


class PackageRepositoryService:

    @staticmethod
    def get_configured_url(db: Session) -> str:
        """Returns the configured registry URL (from DB settings, env var, or empty)."""
        auth_settings = db.query(SystemAuthSettings).first()
        if auth_settings and auth_settings.package_registry_url:
            return auth_settings.package_registry_url.strip()
        if settings.PACKAGE_REGISTRY_URL:
            return settings.PACKAGE_REGISTRY_URL.strip()
        return ""

    @staticmethod
    def set_configured_url(db: Session, new_url: Optional[str]) -> str:
        """Saves a custom package registry URL in system settings."""
        auth_settings = db.query(SystemAuthSettings).first()
        if not auth_settings:
            auth_settings = SystemAuthSettings(id="default")
            db.add(auth_settings)
        cleaned = (new_url or "").strip()
        auth_settings.package_registry_url = cleaned if cleaned else None
        db.commit()
        db.refresh(auth_settings)
        return cleaned

    @classmethod
    def fetch_index_raw(cls, url: Optional[str] = None) -> Tuple[Dict[str, Any], str]:
        """
        Fetches the raw index.json from a remote URL or falls back to local file.
        Returns a tuple: (catalog_dict, source_type).
        """
        target_url = (url or "").strip()

        # 1. If no remote URL is provided or explicitly local/file
        if not target_url or target_url.lower() == "local" or target_url.startswith("file://"):
            if not os.path.exists(LOCAL_INDEX_PATH):
                return {"name": "Local Package Registry", "version": "1.0.0", "packages": []}, "local"
            with open(LOCAL_INDEX_PATH, "r", encoding="utf-8") as f:
                return json.load(f), "local"

        # 2. Remote HTTP/HTTPS URL
        parsed = urlparse(target_url)
        if parsed.scheme not in ("http", "https"):
            raise ValueError(f"Protocollo non supportato '{parsed.scheme}'. Usa http:// o https://")

        try:
            with httpx.Client(timeout=10.0, follow_redirects=True) as client:
                resp = client.get(target_url, headers={"User-Agent": "EasyEA-PackageManager/1.0"})
                resp.raise_for_status()
                data = resp.json()
                return data, f"remote ({target_url})"
        except Exception as exc:
            logger.warning(f"Errore download registry da '{target_url}': {exc}. Tento fallback locale.")
            if os.path.exists(LOCAL_INDEX_PATH):
                with open(LOCAL_INDEX_PATH, "r", encoding="utf-8") as f:
                    return json.load(f), "local_fallback"
            raise ValueError(f"Impossibile raggiungere il repository '{target_url}': {exc}")

    @classmethod
    def list_packages(cls, db: Session, custom_url: Optional[str] = None) -> Dict[str, Any]:
        """
        Lists available packages from the registry and correlates them with
        locally installed packages in the database.
        """
        active_url = custom_url if custom_url is not None else cls.get_configured_url(db)
        catalog_data, source_type = cls.fetch_index_raw(active_url)

        repo_packages = catalog_data.get("packages", [])

        # Local packages lookup by id and code
        installed_pkgs = db.query(AttributePackage).all()
        installed_by_id = {p.id: p for p in installed_pkgs}
        installed_by_code = {p.code: p for p in installed_pkgs}

        enriched_list = []
        for p in repo_packages:
            p_id = p.get("id")
            p_code = p.get("code")
            latest_version = p.get("version", "1.0.0")

            local_pkg = installed_by_id.get(p_id) or installed_by_code.get(p_code)
            is_installed = local_pkg is not None
            installed_version = getattr(local_pkg, "version", None) if is_installed else None

            has_update = False
            if is_installed and installed_version:
                has_update = parse_semver(latest_version) > parse_semver(installed_version)

            if not is_installed:
                status = "available"
            elif has_update:
                status = "update_available"
            else:
                status = "installed"

            enriched_list.append({
                **p,
                "is_installed": is_installed,
                "installed_version": installed_version,
                "has_update": has_update,
                "status": status,
                "installed_package_id": local_pkg.id if local_pkg else None
            })

        return {
            "registry_name": catalog_data.get("name", "EasyEA Package Registry"),
            "registry_version": catalog_data.get("version", "1.0.0"),
            "description": catalog_data.get("description", ""),
            "source_type": source_type,
            "configured_url": active_url,
            "total": len(enriched_list),
            "packages": enriched_list
        }

    @classmethod
    def download_bundle_bytes(cls, bundle_url: str, base_registry_url: str) -> bytes:
        """Downloads or reads the bundle file bytes safely."""
        # 1. Relative bundle filename pointing to local filesystem or remote base
        if not bundle_url.startswith("http://") and not bundle_url.startswith("https://"):
            # Check local filesystem
            local_bundle_path = os.path.join(LOCAL_REPO_DIR, bundle_url)
            if os.path.exists(local_bundle_path):
                with open(local_bundle_path, "rb") as f:
                    return f.read()

            # If base_registry_url is remote HTTP, resolve relative URL
            if base_registry_url.startswith("http://") or base_registry_url.startswith("https://"):
                bundle_url = urljoin(base_registry_url, bundle_url)
            else:
                raise FileNotFoundError(f"Bundle file '{bundle_url}' non trovato nel repository locale '{LOCAL_REPO_DIR}'.")

        # 2. Remote HTTP/HTTPS download
        parsed = urlparse(bundle_url)
        if parsed.scheme not in ("http", "https"):
            raise ValueError(f"Schema URL '{parsed.scheme}' non consentito per il download del bundle.")

        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            resp = client.get(bundle_url, headers={"User-Agent": "EasyEA-PackageManager/1.0"})
            resp.raise_for_status()
            content = resp.content
            if len(content) > MAX_BUNDLE_BYTES:
                raise ValueError(f"Dimensione del pacchetto ({len(content)} bytes) superiore al limite consentito di {MAX_BUNDLE_BYTES} bytes.")
            return content

    @classmethod
    def install_from_repository(
        cls,
        package_id_or_code: str,
        db: Session,
        force: bool = False,
        custom_url: Optional[str] = None
    ) -> AttributePackage:
        """
        Locates a package in the registry index, downloads its .eap bundle,
        and installs/upgrades it via PackageManagerService.
        """
        active_url = custom_url if custom_url is not None else cls.get_configured_url(db)
        catalog_data, _ = cls.fetch_index_raw(active_url)
        packages = catalog_data.get("packages", [])

        target_entry = None
        for p in packages:
            if p.get("id") == package_id_or_code or p.get("code") == package_id_or_code:
                target_entry = p
                break

        if not target_entry:
            raise ValueError(f"Pacchetto '{package_id_or_code}' non trovato nel catalogo del repository.")

        bundle_url = target_entry.get("bundle_url")
        if not bundle_url:
            raise ValueError(f"Nessun file bundle associato al pacchetto '{target_entry.get('name')}'.")

        logger.info(f"Downloading bundle '{bundle_url}' for package '{target_entry.get('name')}'...")
        bundle_bytes = cls.download_bundle_bytes(bundle_url, active_url)

        logger.info(f"Installing package bundle ({len(bundle_bytes)} bytes)...")
        installed = install_package_bundle(bundle_bytes, db, force=force)
        return installed

    @classmethod
    def test_connection(cls, url: str) -> Dict[str, Any]:
        """Tests connectivity and returns catalog metadata."""
        data, source_type = cls.fetch_index_raw(url)
        packages = data.get("packages", [])
        return {
            "status": "success",
            "reachable": True,
            "source_type": source_type,
            "registry_name": data.get("name", "EasyEA Package Registry"),
            "registry_version": data.get("version", "1.0.0"),
            "packages_count": len(packages)
        }
