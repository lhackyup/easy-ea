import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.rate_limiter import (
    GlobalDynamicRateLimiter,
    rate_limiter,
    extract_client_ip,
    get_client_rate_limit_identity,
    resolve_dynamic_limit
)

client = TestClient(app)


def test_rate_limiter_unit_sliding_window():
    limiter = GlobalDynamicRateLimiter()
    key = "test:client:1"
    limit = 3
    window = 2  # 2 seconds window

    # Request 1
    is_limited, remaining, reset_sec, total = limiter.check(key, limit, window)
    assert not is_limited
    assert remaining == 2
    assert total == 3

    # Request 2
    is_limited, remaining, reset_sec, total = limiter.check(key, limit, window)
    assert not is_limited
    assert remaining == 1

    # Request 3
    is_limited, remaining, reset_sec, total = limiter.check(key, limit, window)
    assert not is_limited
    assert remaining == 0

    # Request 4 -> should be rate limited
    is_limited, remaining, reset_sec, total = limiter.check(key, limit, window)
    assert is_limited
    assert remaining == 0
    assert reset_sec >= 1

    # Wait for window expiration
    time.sleep(2.1)

    # Request 5 after expiration -> should succeed again
    is_limited, remaining, reset_sec, total = limiter.check(key, limit, window)
    assert not is_limited
    assert remaining == 2


def test_rate_limiter_pruning():
    limiter = GlobalDynamicRateLimiter()
    limiter._prune_interval = 0.05  # Force rapid prune

    limiter.check("old:key", limit=5, window_seconds=1)
    assert "old:key" in limiter._windows

    # Wait past window and prune
    time.sleep(0.2)
    limiter._auto_prune(now=time.time(), max_window=0.1)
    assert "old:key" not in limiter._windows


def test_resolve_dynamic_limits_tiering():
    # Auth sensitive route
    limit, window = resolve_dynamic_limit("/api/auth/login", "ip")
    assert limit == settings.RATE_LIMIT_AUTH_PER_MINUTE

    # Anonymous IP on regular route
    limit, window = resolve_dynamic_limit("/api/v1/models", "ip")
    assert limit == settings.RATE_LIMIT_DEFAULT_PER_MINUTE

    # Authenticated user on regular route
    limit, window = resolve_dynamic_limit("/api/v1/models", "user")
    assert limit == settings.RATE_LIMIT_AUTHENTICATED_PER_MINUTE

    # API key on regular route
    limit, window = resolve_dynamic_limit("/api/v1/models", "apikey")
    assert limit == settings.RATE_LIMIT_APIKEY_PER_MINUTE


def test_http_rate_limit_headers_and_exemption():
    rate_limiter.reset()

    # 1. Exempt path (/health) should not have RateLimit headers or increment counts
    res_health = client.get("/health")
    assert res_health.status_code == 200

    # 2. Regular API endpoint returns RateLimit headers
    res_auth_cfg = client.get("/api/auth/oidc/config")
    assert res_auth_cfg.status_code == 200
    assert "RateLimit-Limit" in res_auth_cfg.headers
    assert "RateLimit-Remaining" in res_auth_cfg.headers
    assert "RateLimit-Reset" in res_auth_cfg.headers

    limit_val = int(res_auth_cfg.headers["RateLimit-Limit"])
    rem_val = int(res_auth_cfg.headers["RateLimit-Remaining"])
    assert limit_val == settings.RATE_LIMIT_AUTH_PER_MINUTE
    assert rem_val < limit_val


def test_http_rate_limit_exceeded_returns_429():
    rate_limiter.reset()
    test_key = "ip:testclient"

    # Pre-exhaust client limit in global rate limiter
    window = settings.RATE_LIMIT_WINDOW_SECONDS
    for _ in range(settings.RATE_LIMIT_AUTH_PER_MINUTE + 5):
        rate_limiter.check(test_key, limit=settings.RATE_LIMIT_AUTH_PER_MINUTE, window_seconds=window)

    # Calling an auth route with the same client identity should now return 429
    res = client.get("/api/auth/oidc/config")
    assert res.status_code == 429
    data = res.json()
    assert "Rate limit superato" in data["detail"]
    assert "retry_after" in data
    assert res.headers.get("Retry-After") is not None
    assert res.headers.get("RateLimit-Remaining") == "0"

    # Cleanup state
    rate_limiter.reset()
