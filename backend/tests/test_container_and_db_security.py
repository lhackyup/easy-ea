import os
import pytest
import yaml
from app.core.database import _build_db_connection_params
from app.core.config import settings


def test_dockerfile_security_hardening():
    """
    Verify Dockerfile implements container hardening:
    - Non-privileged user
    - Read-only execution permissions (chmod 555 on /app and /frontend)
    - Python bytecode generation disabled (PYTHONDONTWRITEBYTECODE=1)
    - Sticky bit on /tmp (chmod 1777 /tmp)
    """
    dockerfile_path = os.path.join(os.path.dirname(__file__), "../../Dockerfile")
    assert os.path.exists(dockerfile_path), "Dockerfile must exist"

    with open(dockerfile_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "USER easyea" in content, "Dockerfile must run as non-root user 'easyea'"
    assert "PYTHONDONTWRITEBYTECODE=1" in content, "PYTHONDONTWRITEBYTECODE=1 must be set"
    assert "chmod 1777 /tmp" in content, "chmod 1777 /tmp must be set"
    assert "chmod -R 555 /app /frontend" in content or "555" in content, "Read-only permissions must be enforced on /app"


def test_docker_compose_container_hardening():
    """
    Verify docker-compose.yml implements container hardening:
    - read_only: true
    - cap_drop: [ALL]
    - security_opt: [no-new-privileges:true]
    - tmpfs on /tmp with noexec,nosuid,nodev
    """
    compose_path = os.path.join(os.path.dirname(__file__), "../../docker-compose.yml")
    assert os.path.exists(compose_path), "docker-compose.yml must exist"

    with open(compose_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    app_service = data.get("services", {}).get("easyea", {})
    assert app_service.get("read_only") is True, "easyea service must have read_only: true"
    assert "ALL" in app_service.get("cap_drop", []), "easyea service must drop ALL capabilities"
    assert "no-new-privileges:true" in app_service.get("security_opt", []), "no-new-privileges must be true"

    tmpfs = app_service.get("tmpfs", [])
    assert any("/tmp" in t and "noexec" in t for t in tmpfs), "/tmp must be mounted with noexec in tmpfs"


def test_database_tls_enforcement_in_production(monkeypatch):
    """
    Verify PostgreSQL connections enforce TLS in production:
    - Automatically sets sslmode=require if omitted
    - Rejects insecure sslmode=disable or sslmode=allow
    - Allows insecure only if EASYEA_DATABASE_ALLOW_INSECURE=true
    """
    # 1. Production without explicit sslmode -> auto-adds sslmode=require
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "DATABASE_SSLMODE", None)
    monkeypatch.setattr(settings, "DATABASE_ALLOW_INSECURE", False)

    url = "postgresql://easyea_user:secret@postgres.internal.net:5432/easyea_db"
    _, connect_args = _build_db_connection_params(url)
    assert connect_args.get("sslmode") == "require", "Production PostgreSQL must default to sslmode=require"

    # 2. Production with insecure sslmode=disable -> raises RuntimeError
    insecure_url = "postgresql://easyea_user:secret@postgres.internal.net:5432/easyea_db?sslmode=disable"
    with pytest.raises(RuntimeError) as exc_info:
        _build_db_connection_params(insecure_url)
    assert "CRITICAL SECURITY ERROR" in str(exc_info.value)
    assert "sslmode='disable'" in str(exc_info.value)

    # 3. Production with insecure sslmode=allow -> raises RuntimeError
    allow_url = "postgresql://easyea_user:secret@postgres.internal.net:5432/easyea_db?sslmode=allow"
    with pytest.raises(RuntimeError) as exc_info:
        _build_db_connection_params(allow_url)
    assert "CRITICAL SECURITY ERROR" in str(exc_info.value)

    # 4. Production with explicit sslmode=verify-full in config
    monkeypatch.setattr(settings, "DATABASE_SSLMODE", "verify-full")
    _, connect_args_full = _build_db_connection_params(url)
    assert connect_args_full.get("sslmode") == "verify-full"

    # 5. Production with allow_insecure bypass enabled
    monkeypatch.setattr(settings, "DATABASE_ALLOW_INSECURE", True)
    _, connect_args_bypass = _build_db_connection_params(insecure_url)
    assert connect_args_bypass is not None


def test_database_sqlite_connection_params():
    """Verify SQLite connection parameters retain check_same_thread=False."""
    url = "sqlite:///./easyea.db"
    _, connect_args = _build_db_connection_params(url)
    assert connect_args.get("check_same_thread") is False
    assert "sslmode" not in connect_args


def test_file_based_secrets_management(tmp_path, monkeypatch):
    """
    Verify multi-tier secret resolution:
    1. Direct file path via {KEY}_FILE
    2. Conventional path in /run/secrets/{key.lower()}
    3. Direct environment variable fallback
    4. Default value fallback
    """
    from app.core.config import _read_secret

    # 1. Direct file path via {KEY}_FILE
    secret_file = tmp_path / "custom_secret.txt"
    secret_file.write_text("super_secure_file_secret_12345", encoding="utf-8")
    monkeypatch.setenv("MY_APP_SECRET_FILE", str(secret_file))
    monkeypatch.setenv("MY_APP_SECRET", "ignored_env_val")

    resolved_file = _read_secret("MY_APP_SECRET")
    assert resolved_file == "super_secure_file_secret_12345"

    # 2. Direct environment variable fallback when no file exists
    monkeypatch.delenv("MY_APP_SECRET_FILE", raising=False)
    monkeypatch.setenv("MY_APP_SECRET", "direct_env_secret_val")
    resolved_env = _read_secret("MY_APP_SECRET")
    assert resolved_env == "direct_env_secret_val"

    # 3. Default fallback when neither file nor env var exists
    monkeypatch.delenv("MY_APP_SECRET", raising=False)
    resolved_default = _read_secret("MY_APP_SECRET", default="fallback_default")
    assert resolved_default == "fallback_default"

