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


def _resolve_secret_key() -> str:
    env_mode = os.getenv("EASYEA_ENV", "development").strip().lower()
    raw_key = (os.getenv("EASYEA_SECRET_KEY") or "").strip()

    if raw_key and raw_key not in _WEAK_SECRET_KEYS and len(raw_key) >= 32:
        return raw_key

    if env_mode == "production":
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: EASYEA_SECRET_KEY must be set to a strong secret "
            "(at least 32 characters) when EASYEA_ENV=production."
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
        "http://localhost:5173,http://localhost:8000,http://127.0.0.1:5173,http://127.0.0.1:8000,https://embed.diagrams.net,null,file://",
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
        "https://embed.diagrams.net",
        "null",
        "file://",
    ]


class Settings(BaseSettings):
    PROJECT_NAME: str = "EasyEA - Business-Oriented Enterprise Architecture"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = os.getenv("EASYEA_ENV", "development").strip().lower()

    # Database: SQLite default for local zero-config, PostgreSQL for production
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./easyea.db")

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
    ADMIN_INITIAL_PASSWORD: Optional[str] = os.getenv("EASYEA_ADMIN_PASSWORD") or None
    DEMO_USER_PASSWORD: Optional[str] = os.getenv("EASYEA_DEMO_PASSWORD") or None

    # OAuth2 / OpenID Connect (OIDC)
    OIDC_ENABLED: bool = os.getenv("OIDC_ENABLED", "true").lower() in ("1", "true", "yes")
    OIDC_PROVIDER_NAME: str = os.getenv("OIDC_PROVIDER_NAME", "Keycloak SSO")
    OIDC_ISSUER_URL: str = os.getenv("OIDC_ISSUER_URL", "http://localhost:18000/realms/dev-realm")
    OIDC_CLIENT_ID: str = os.getenv("OIDC_CLIENT_ID", "easyea-client")
    OIDC_CLIENT_SECRET: str = os.getenv("OIDC_CLIENT_SECRET", "")
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

    model_config = SettingsConfigDict(case_sensitive=True)


settings = Settings()


