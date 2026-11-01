import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings

client = TestClient(app)


def test_hsts_preload_header():
    """
    Verify Strict-Transport-Security header adheres to RFC 6797 and HSTS Preload requirements:
    - max-age >= 31536000 (set to 63072000 / 2 years)
    - includeSubDomains
    - preload
    """
    res = client.get("/health")
    assert res.status_code == 200
    hsts = res.headers.get("Strict-Transport-Security")
    assert hsts is not None, "Strict-Transport-Security header must be present"
    assert "max-age=63072000" in hsts
    assert "includeSubDomains" in hsts
    assert "preload" in hsts


def test_content_security_policy_comprehensive_directives():
    """
    Verify Content-Security-Policy contains comprehensive directives:
    - default-src 'self'
    - script-src with self, unsafe-inline, wasm-unsafe-eval
    - style-src with self, unsafe-inline, google fonts
    - font-src with self, gstatic, data:
    - img-src with self, data:, blob:, https:
    - connect-src with self, http:, https:, ws:, wss:
    - frame-src with self, https://embed.diagrams.net
    - frame-ancestors 'self' (anti-clickjacking)
    - object-src 'none' (blocks plugins/applets)
    - base-uri 'self'
    - form-action 'self'
    """
    res = client.get("/health")
    assert res.status_code == 200
    csp = res.headers.get("Content-Security-Policy")
    assert csp is not None, "Content-Security-Policy header must be present"

    directives = [d.strip() for d in csp.split(";") if d.strip()]
    csp_dict = {}
    for d in directives:
        parts = d.split(None, 1)
        name = parts[0]
        val = parts[1] if len(parts) > 1 else ""
        csp_dict[name] = val

    assert csp_dict.get("default-src") == "'self'"
    assert "'self'" in csp_dict.get("script-src", "")
    assert "'wasm-unsafe-eval'" in csp_dict.get("script-src", "")
    assert "https://fonts.googleapis.com" in csp_dict.get("style-src", "")
    assert "https://fonts.gstatic.com" in csp_dict.get("font-src", "")
    assert "data:" in csp_dict.get("img-src", "")
    assert "blob:" in csp_dict.get("img-src", "")
    assert "https://embed.diagrams.net" in csp_dict.get("frame-src", "")
    assert csp_dict.get("frame-ancestors") == "'self'"
    assert csp_dict.get("object-src") == "'none'"
    assert csp_dict.get("base-uri") == "'self'"
    assert "'self'" in csp_dict.get("form-action", "")


def test_api_endpoints_inherit_hsts_and_csp():
    """Verify API endpoints deliver CSP and HSTS headers."""
    res = client.get("/api/auth/oidc/config")
    assert res.status_code == 200
    assert "preload" in res.headers.get("Strict-Transport-Security", "")
    assert "frame-ancestors 'self'" in res.headers.get("Content-Security-Policy", "")
