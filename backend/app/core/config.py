from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "EasyEA - Business-Oriented Enterprise Architecture"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api"
    
    # Database: SQLite default for local zero-config, PostgreSQL for production
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./easyea.db")
    
    # CORS
    CORS_ORIGINS: List[str] = ["*"]

    # Security & Sessions
    SECRET_KEY: str = os.getenv("EASYEA_SECRET_KEY", "easyea-production-secret-key-2026-auth-session")
    TOKEN_EXPIRY_SECONDS: int = int(os.getenv("EASYEA_TOKEN_EXPIRY", str(7 * 24 * 3600)))

    # OAuth2 / OpenID Connect (OIDC)
    OIDC_ENABLED: bool = os.getenv("OIDC_ENABLED", "true").lower() in ("1", "true", "yes")
    OIDC_PROVIDER_NAME: str = os.getenv("OIDC_PROVIDER_NAME", "Keycloak SSO")
    OIDC_ISSUER_URL: str = os.getenv("OIDC_ISSUER_URL", "http://localhost:18000/realms/dev-realm")
    OIDC_CLIENT_ID: str = os.getenv("OIDC_CLIENT_ID", "easyea-client")
    OIDC_CLIENT_SECRET: str = os.getenv("OIDC_CLIENT_SECRET", "easyea-dev-secret-key-2026")
    OIDC_REDIRECT_URI: str = os.getenv("OIDC_REDIRECT_URI", "http://localhost:8000/api/auth/oidc/callback")
    OIDC_FRONTEND_REDIRECT_URL: str = os.getenv("OIDC_FRONTEND_REDIRECT_URL", "http://localhost:5173")
    OIDC_SCOPES: str = os.getenv("OIDC_SCOPES", "openid profile email roles")
    
    # RBAC Mode: 'hybrid' (IdP admin/roles mapped + local library assignments preserved),
    #            'internal' (only identity from IdP, roles managed inside EasyEA),
    #            'idp_sync' (strict sync from IdP claims)
    AUTH_RBAC_MODE: str = os.getenv("EASYEA_RBAC_MODE", "hybrid")

    model_config = SettingsConfigDict(case_sensitive=True)

settings = Settings()

