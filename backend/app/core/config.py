from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List
import logging
import os
import secrets

logger = logging.getLogger(__name__)

_WEAK_SECRET_KEYS = {
    "",
    "easyea-production-secret-key-2026-auth-session",
    "changeme",
    "secret",
    "default",
}


def _read_secret(key: str, default: Optional[str] = None) -> Optional[str]:
    """
    Resolves a configuration secret using multi-tier resolution:
    1. Direct file path via {KEY}_FILE environment variable (e.g. EASYEA_SECRET_KEY_FILE=/run/secrets/key)
    2. Convention Docker / Kubernetes secret file: /run/secrets/{key.lower()}
    3. Direct environment variable: os.getenv(key)
    4. Fallback default
    """
    # 1. Check {KEY}_FILE explicit path
    file_path = os.getenv(f"{key}_FILE")
    if file_path and os.path.isfile(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                val = f.read().strip()
                if val:
                    return val
        except Exception as e:
            logger.warning("Failed to read secret file '%s' for key '%s': %s", file_path, key, e)

    # 2. Check conventional Docker/K8s /run/secrets/{key.lower()}
    conventional_path = os.path.join("/run/secrets", key.lower())
    if os.path.isfile(conventional_path):
        try:
            with open(conventional_path, "r", encoding="utf-8") as f:
                val = f.read().strip()
                if val:
                    return val
        except Exception as e:
            logger.warning("Failed to read conventional secret file '%s': %s", conventional_path, e)

    # 3. Environment variable fallback
    env_val = os.getenv(key)
    if env_val is not None:
        return env_val.strip()

    return default


def _resolve_secret_key() -> str:
    env_mode = os.getenv("EASYEA_ENV", "development").strip().lower()
    raw_key = (_read_secret("EASYEA_SECRET_KEY") or "").strip()

    if raw_key and raw_key not in _WEAK_SECRET_KEYS and len(raw_key) >= 32:
        return raw_key

    if env_mode == "production":
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: EASYEA_SECRET_KEY must be set to a strong secret "
            "(at least 32 characters) when EASYEA_ENV=production. You can provide it via "
            "EASYEA_SECRET_KEY or file-based secret via EASYEA_SECRET_KEY_FILE / /run/secrets/easyea_secret_key."
        )

    generated = secrets.token_urlsafe(48)
    logger.warning(
        "EASYEA_SECRET_KEY not set or too weak; generated an ephemeral random 384-bit key "
        "for this process (%s mode). Set EASYEA_SECRET_KEY in production.",
        env_mode,
    )
    return generated


def _resolve_cors_origins() -> List[str]:
    raw_origins = os.getenv(
        "EASYEA_CORS_ORIGINS",
        "http://localhost:5173,http://localhost:8000,http://127.0.0.1:5173,http://127.0.0.1:8000,http://localhost:8080,http://127.0.0.1:8080,https://embed.diagrams.net,null,file://",
    )
    origins = [
        o.strip().rstrip("/")
        for o in raw_origins.split(",")
        if o.strip() and o.strip() != "*"
    ]
    return origins or [
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "https://embed.diagrams.net",
        "null",
        "file://",
    ]


class Settings(BaseSettings):
    PROJECT_NAME: str = "EasyEA - Business-Oriented Enterprise Architecture"
    VERSION: str = "1.2.0"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = os.getenv("EASYEA_ENV", "development").strip().lower()

    # Database: SQLite default for local zero-config, PostgreSQL for production
    DATABASE_URL: str = _read_secret("DATABASE_URL", "sqlite:///./easyea.db")
    DATABASE_SSLMODE: Optional[str] = _read_secret("EASYEA_DATABASE_SSLMODE", None)
    DATABASE_SSL_CERT: Optional[str] = _read_secret("EASYEA_DATABASE_SSL_CERT", None)
    DATABASE_ALLOW_INSECURE: bool = os.getenv(
        "EASYEA_DATABASE_ALLOW_INSECURE", "false"
    ).lower() in ("1", "true", "yes")

    # CORS (SAST-HIGH-05: explicit origin allowlist, never wildcard '*' with credentials)
    CORS_ORIGINS: List[str] = _resolve_cors_origins()

    # Upload & Decompression Limits (SAST-HIGH-06)
    MAX_UPLOAD_BYTES: int = int(os.getenv("EASYEA_MAX_UPLOAD_BYTES", str(15 * 1024 * 1024)))
    MAX_UNCOMPRESSED_ZIP_BYTES: int = int(os.getenv("EASYEA_MAX_UNCOMPRESSED_ZIP_BYTES", str(50 * 1024 * 1024)))
    MAX_ZIP_ENTRIES: int = int(os.getenv("EASYEA_MAX_ZIP_ENTRIES", "200"))

    # Security & Sessions
    SECRET_KEY: str = _resolve_secret_key()
    TOKEN_EXPIRY_SECONDS: int = int(os.getenv("EASYEA_TOKEN_EXPIRY", str(7 * 24 * 3600)))

    # Bootstrap & Demo Seeding Controls
    SEED_DEMO_USERS: bool = os.getenv(
        "EASYEA_SEED_DEMO_USERS",
        "false" if os.getenv("EASYEA_ENV", "development").strip().lower() == "production" else "true",
    ).lower() in ("1", "true", "yes")
    ADMIN_INITIAL_PASSWORD: Optional[str] = _read_secret("EASYEA_ADMIN_PASSWORD") or None
    DEMO_USER_PASSWORD: Optional[str] = _read_secret("EASYEA_DEMO_PASSWORD") or None

    # OAuth2 / OpenID Connect (OIDC)
    OIDC_ENABLED: bool = os.getenv("OIDC_ENABLED", "true").lower() in ("1", "true", "yes")
    OIDC_PROVIDER_NAME: str = os.getenv("OIDC_PROVIDER_NAME", "Keycloak SSO")
    OIDC_ISSUER_URL: str = os.getenv("OIDC_ISSUER_URL", "http://localhost:18000/realms/dev-realm")
    OIDC_CLIENT_ID: str = _read_secret("OIDC_CLIENT_ID", "easyea-client")
    OIDC_CLIENT_SECRET: str = _read_secret("OIDC_CLIENT_SECRET", "")
    OIDC_REDIRECT_URI: str = os.getenv("OIDC_REDIRECT_URI", "http://localhost:8000/api/auth/oidc/callback")
    OIDC_FRONTEND_REDIRECT_URL: str = os.getenv("OIDC_FRONTEND_REDIRECT_URL", "http://localhost:5173")
    OIDC_ALLOWED_RETURN_ORIGINS: str = os.getenv(
        "EASYEA_ALLOWED_REDIRECT_ORIGINS",
        "http://localhost:5173,http://localhost:8000,http://127.0.0.1:5173,http://127.0.0.1:8000",
    )
    OIDC_SCOPES: str = os.getenv("OIDC_SCOPES", "openid profile email roles")

    # RBAC Mode: 'hybrid' (IdP admin/roles mapped + local library assignments preserved),
    #            'internal' (only identity from IdP, roles managed inside EasyEA),
    #            'idp_sync' (strict sync from IdP claims)
    AUTH_RBAC_MODE: str = os.getenv("EASYEA_RBAC_MODE", "hybrid")

    # External Package Registry URL (Marketplace for .eap bundles)
    PACKAGE_REGISTRY_URL: str = os.getenv("EASYEA_PACKAGE_REGISTRY_URL", "").strip()

    # Draw.io Web Integration (Local Docker instance by default, with cloud fallback)
    DRAWIO_WEB_URL: str = os.getenv("EASYEA_DRAWIO_WEB_URL", "http://localhost:8080").strip().rstrip("/")

    # HTTP Strict Transport Security (HSTS Preload - RFC 6797)
    HSTS_ENABLED: bool = os.getenv("EASYEA_HSTS_ENABLED", "true").lower() in ("1", "true", "yes")
    HSTS_MAX_AGE: int = int(os.getenv("EASYEA_HSTS_MAX_AGE", "63072000")) # 2 years for HSTS Preload
    HSTS_INCLUDE_SUBDOMAINS: bool = os.getenv("EASYEA_HSTS_INCLUDE_SUBDOMAINS", "true").lower() in ("1", "true", "yes")
    HSTS_PRELOAD: bool = os.getenv("EASYEA_HSTS_PRELOAD", "true").lower() in ("1", "true", "yes")

    # Content Security Policy (CSP)
    CUSTOM_CSP_POLICY: Optional[str] = os.getenv("EASYEA_CSP_POLICY") or None

    # Security.txt (RFC 9116)
    SECURITY_TXT_CONTACT: str = os.getenv("EASYEA_SECURITY_CONTACT", "mailto:security@easyea.org")
    SECURITY_TXT_POLICY: str = os.getenv("EASYEA_SECURITY_POLICY_URL", "https://github.com/lhackyup/EasyEA/security/policy")
    SECURITY_TXT_CANONICAL: Optional[str] = os.getenv("EASYEA_SECURITY_CANONICAL_URL") or None
    SECURITY_TXT_LANGUAGES: str = os.getenv("EASYEA_SECURITY_LANGUAGES", "it, en")

    # Global Dynamic Rate Limiting (OWASP API4:2023 / CWE-770)
    RATE_LIMIT_ENABLED: bool = os.getenv("EASYEA_RATE_LIMIT_ENABLED", "true").lower() in ("1", "true", "yes")
    RATE_LIMIT_DEFAULT_PER_MINUTE: int = int(os.getenv("EASYEA_RATE_LIMIT_DEFAULT_PER_MINUTE", "300"))
    RATE_LIMIT_AUTH_PER_MINUTE: int = int(os.getenv("EASYEA_RATE_LIMIT_AUTH_PER_MINUTE", "60"))
    RATE_LIMIT_AUTHENTICATED_PER_MINUTE: int = int(os.getenv("EASYEA_RATE_LIMIT_AUTHENTICATED_PER_MINUTE", "600"))
    RATE_LIMIT_APIKEY_PER_MINUTE: int = int(os.getenv("EASYEA_RATE_LIMIT_APIKEY_PER_MINUTE", "1200"))
    RATE_LIMIT_WINDOW_SECONDS: int = int(os.getenv("EASYEA_RATE_LIMIT_WINDOW_SECONDS", "60"))

    model_config = SettingsConfigDict(case_sensitive=True)


settings = Settings()


