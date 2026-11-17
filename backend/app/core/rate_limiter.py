import time
import hashlib
import threading
from collections import defaultdict
from typing import Dict, List, Tuple, Optional
from fastapi import Request

from app.core.config import settings


class GlobalDynamicRateLimiter:
    """
    In-memory, thread-safe sliding window dynamic rate limiter.
    Complies with OWASP API Security Top 10 (API4:2023 - Unrestricted Resource Consumption)
    and IETF draft-ietf-httpapi-ratelimit-headers / RFC 6585.
    
    Features:
    - Sliding window algorithm with millisecond precision.
    - Dynamic tiering: anonymous IP, authenticated user, API key, and sensitive auth routes.
    - Automated memory pruning to prevent memory exhaustion in constrained/read-only environments.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self._windows: Dict[str, List[float]] = defaultdict(list)
        self._last_prune: float = time.time()
        self._prune_interval: float = 120.0  # Prune expired keys every 2 minutes

    def _auto_prune(self, now: float, max_window: float = 3600.0) -> None:
        """Removes expired window entries to prevent memory leaks."""
        if now - self._last_prune < self._prune_interval:
            return
        
        self._last_prune = now
        threshold = now - max_window
        keys_to_delete = []
        for key, timestamps in self._windows.items():
            valid = [t for t in timestamps if t > threshold]
            if not valid:
                keys_to_delete.append(key)
            else:
                self._windows[key] = valid
                
        for k in keys_to_delete:
            del self._windows[k]

    def check(
        self,
        key: str,
        limit: int,
        window_seconds: int
    ) -> Tuple[bool, int, int, int]:
        """
        Check and record a request under the sliding window.
        
        Returns:
            Tuple of:
            - is_limited (bool): True if rate limit is exceeded (block request)
            - remaining (int): Number of requests remaining in current window
            - reset_seconds (int): Seconds until current window oldest entry expires
            - limit (int): Total allowed requests in this window
        """
        now = time.time()
        threshold = now - window_seconds

        with self._lock:
            self._auto_prune(now, float(window_seconds))

            # Filter timestamps within current window
            current_hits = [t for t in self._windows[key] if t > threshold]
            count = len(current_hits)

            if count >= limit:
                # Rate limit exceeded
                oldest_hit = current_hits[0] if current_hits else threshold
                reset_seconds = max(1, int(window_seconds - (now - oldest_hit)))
                self._windows[key] = current_hits
                return True, 0, reset_seconds, limit

            # Record this valid request
            current_hits.append(now)
            self._windows[key] = current_hits

            remaining = max(0, limit - count - 1)
            oldest_hit = current_hits[0]
            reset_seconds = max(1, int(window_seconds - (now - oldest_hit)))

            return False, remaining, reset_seconds, limit

    def reset(self) -> None:
        """Clear all active rate limiting state (useful for tests and maintenance)."""
        with self._lock:
            self._windows.clear()
            self._last_prune = time.time()


# Global singleton instance
rate_limiter = GlobalDynamicRateLimiter()


def extract_client_ip(request: Request) -> str:
    """Extract client IP taking trusted reverse proxy headers into account."""
    if not request:
        return "127.0.0.1"

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # First IP in the X-Forwarded-For chain is the client origin
        client_ip = forwarded.split(",")[0].strip()
        if client_ip:
            return client_ip

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


def get_client_rate_limit_identity(request: Request) -> Tuple[str, str]:
    """
    Identify client identity and tier for dynamic rate limiting.
    Returns (client_tier, identifier_key)
    Tiers:
    - 'apikey': Programmatic requests carrying X-API-Key header
    - 'user': Authenticated session carrying Authorization: Bearer token
    - 'ip': Anonymous / untrusted client IP
    """
    # 1. Check for API Key
    api_key = request.headers.get("x-api-key")
    if api_key and len(api_key.strip()) >= 8:
        # Hash API key prefix to avoid storing full key in rate limiter memory
        hashed_key = hashlib.sha256(api_key.strip().encode("utf-8")).hexdigest()[:16]
        return "apikey", f"apikey:{hashed_key}"

    # 2. Check for Bearer token
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token:
            hashed_token = hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]
            return "user", f"user:{hashed_token}"

    # 3. Fallback to client IP
    ip = extract_client_ip(request)
    return "ip", f"ip:{ip}"


def resolve_dynamic_limit(
    path: str,
    client_tier: str
) -> Tuple[int, int]:
    """
    Resolve dynamic request limit and window duration according to target route and client tier.
    Returns: (limit, window_seconds)
    """
    window = settings.RATE_LIMIT_WINDOW_SECONDS

    # Strict limits for sensitive authentication endpoints (prevent brute-force / credential stuffing)
    if path.startswith("/api/auth/"):
        return settings.RATE_LIMIT_AUTH_PER_MINUTE, window

    # Dynamic tiered limits based on client identity
    if client_tier == "apikey":
        return settings.RATE_LIMIT_APIKEY_PER_MINUTE, window
    elif client_tier == "user":
        return settings.RATE_LIMIT_AUTHENTICATED_PER_MINUTE, window
    else:
        return settings.RATE_LIMIT_DEFAULT_PER_MINUTE, window
