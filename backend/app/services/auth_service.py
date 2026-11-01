import ipaddress
import os
import socket
import time
import json
import base64
import hmac
import hashlib
import secrets
import threading
import uuid
import urllib.parse
import io
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Set, Tuple
from fastapi import HTTPException
import httpx
try:
    import pyotp
except ImportError:
    pyotp = None

try:
    import qrcode
    import qrcode.image.svg
except ImportError:
    qrcode = None
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.archimate import User, UserRoleAssignment, SystemAuthSettings, RevokedToken

# In-memory cache for OIDC Discovery metadata and JWKS
_OIDC_DISCOVERY_CACHE: Dict[str, Any] = {}
_OIDC_DISCOVERY_EXPIRY: float = 0
_OIDC_JWKS_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}


DEFAULT_ROLE_MAPPINGS = [
    {
        "id": "map-admin-role",
        "claim_type": "realm_role",
        "claim_name": "admin",
        "expected_value": "",
        "target_role": "admin",
        "target_model_id": None,
        "description": "IdP Realm Role 'admin' -> Amministratore Globale EasyEA"
    },
    {
        "id": "map-admin-group",
        "claim_type": "group",
        "claim_name": "easyea-admins",
        "expected_value": "",
        "target_role": "admin",
        "target_model_id": None,
        "description": "IdP Group '/easyea-admins' -> Amministratore Globale EasyEA"
    },
    {
        "id": "map-arch-role",
        "claim_type": "realm_role",
        "claim_name": "architect",
        "expected_value": "",
        "target_role": "architect",
        "target_model_id": None,
        "description": "IdP Realm Role 'architect' -> Enterprise Architect"
    },
    {
        "id": "map-arch-group",
        "claim_type": "group",
        "claim_name": "easyea-architects",
        "expected_value": "",
        "target_role": "architect",
        "target_model_id": None,
        "description": "IdP Group '/easyea-architects' -> Enterprise Architect"
    },
    {
        "id": "map-analyst-role",
        "claim_type": "realm_role",
        "claim_name": "analyst",
        "expected_value": "",
        "target_role": "analyst",
        "target_model_id": None,
        "description": "IdP Realm Role 'analyst' -> Business Analyst"
    },
    {
        "id": "map-exec-role",
        "claim_type": "realm_role",
        "claim_name": "executive",
        "expected_value": "",
        "target_role": "executive",
        "target_model_id": None,
        "description": "IdP Realm Role 'executive' -> Executive Stakeholder"
    }
]


def get_system_auth_settings(db: Session) -> SystemAuthSettings:
    """Fetch persistent auth configuration from database, seeding defaults if missing."""
    auth_cfg = db.query(SystemAuthSettings).filter(SystemAuthSettings.id == "default").first()
    if not auth_cfg:
        auth_cfg = SystemAuthSettings(
            id="default",
            allow_local_login=True,
            allow_idp_login=settings.OIDC_ENABLED,
            allow_mcp_access=True,
            provider_name=settings.OIDC_PROVIDER_NAME,
            issuer_url=settings.OIDC_ISSUER_URL,
            client_id=settings.OIDC_CLIENT_ID,
            client_secret=settings.OIDC_CLIENT_SECRET,
            scopes=settings.OIDC_SCOPES,
            prompt_login=False,
            enable_single_logout=True,
            rbac_mode=settings.AUTH_RBAC_MODE,
            role_mappings=DEFAULT_ROLE_MAPPINGS,
            mfa_policy="disabled",
            show_demo_banner=True,
            demo_banner_message="Accesso Demo (Sola Lettura) - Username: demo | Password: EasyEA2026!"
        )
        db.add(auth_cfg)
        db.commit()
        db.refresh(auth_cfg)
    else:
        if getattr(auth_cfg, "mfa_policy", None) is None:
            auth_cfg.mfa_policy = "disabled"
        if getattr(auth_cfg, "show_demo_banner", None) is None:
            auth_cfg.show_demo_banner = True
        if getattr(auth_cfg, "demo_banner_message", None) is None:
            auth_cfg.demo_banner_message = "Accesso Demo (Sola Lettura) - Username: demo | Password: EasyEA2026!"
    return auth_cfg


_FORBIDDEN_SSRF_PORTS = {
    21, 22, 23, 25, 53, 111, 135, 137, 139, 389, 445, 1433, 1521,
    2049, 2375, 2376, 3306, 3389, 5432, 5433, 5672, 6379, 8000,
    9042, 9200, 9300, 11211, 27017,
}

_FORBIDDEN_SSRF_HOSTNAMES = {
    "metadata.google.internal",
    "metadata",
    "instance-data",
    "169.254.169.254",
    "0.0.0.0",
}


def _get_allowed_internal_idp_netlocs() -> Set[str]:
    """Return explicitly permitted local/internal IdP host:port netlocs for development or configured SSO."""
    allowed = {
        "localhost:18000",
        "127.0.0.1:18000",
        "host.docker.internal:18000",
        "shared-keycloak:8080",
    }
    try:
        cfg_parsed = urllib.parse.urlparse(settings.OIDC_ISSUER_URL or "")
        if cfg_parsed.netloc:
            allowed.add(cfg_parsed.netloc.lower())
    except Exception:
        pass
    extra = os.getenv("EASYEA_ALLOWED_IDP_HOSTS", "")
    for item in extra.split(","):
        if item.strip():
            allowed.add(item.strip().lower())
    return allowed


def _is_forbidden_ip(ip_str: str) -> bool:
    """Return True if an IP address is loopback, private, link-local, multicast, unspecified, or reserved."""
    try:
        ip_obj = ipaddress.ip_address(ip_str)
        return (
            ip_obj.is_loopback
            or ip_obj.is_private
            or ip_obj.is_link_local
            or ip_obj.is_multicast
            or ip_obj.is_unspecified
            or ip_obj.is_reserved
        )
    except ValueError:
        return True


def validate_oidc_issuer_url(url: str, resolve_dns: bool = False) -> str:
    """
    Validate an OIDC Issuer or endpoint URL against Server-Side Request Forgery (`CWE-918`).
    Blocks non-HTTP(S) schemes, query/fragment path truncation, cloud metadata endpoints,
    internal infrastructure ports, and private/loopback IPs unless explicitly in the allowed IdP netloc list.
    """
    if not url or not isinstance(url, str):
        raise ValueError("URL IdP mancante o non valido.")

    clean = url.strip().rstrip("/")
    if "\\" in clean or "\r" in clean or "\n" in clean:
        raise ValueError("Caratteri non consentiti nell'URL dell'IdP.")

    parsed = urllib.parse.urlparse(clean)
    if parsed.scheme.lower() not in ("http", "https"):
        raise ValueError("Lo schema dell'URL IdP deve essere 'http' o 'https'.")
    if not parsed.hostname or not parsed.netloc:
        raise ValueError("Hostname mancante nell'URL dell'IdP.")
    if parsed.username or parsed.password:
        raise ValueError("Credenziali incorporate non consentite nell'URL dell'IdP.")
    if parsed.query or parsed.fragment or parsed.params:
        raise ValueError("Query string o frammenti ('?', '#') non consentiti nell'URL dell'IdP.")

    hostname = parsed.hostname.lower().strip("[]")
    port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
    netloc_lower = parsed.netloc.lower()

    if hostname in _FORBIDDEN_SSRF_HOSTNAMES:
        raise ValueError(f"SSRF Protection: accesso all'host '{hostname}' bloccato.")

    if port in _FORBIDDEN_SSRF_PORTS:
        raise ValueError(f"SSRF Protection: porta interna {port} non consentita per un Identity Provider.")

    allowed_internal_netlocs = _get_allowed_internal_idp_netlocs()
    is_allowed_internal = netloc_lower in allowed_internal_netlocs

    # Check if hostname is an IP literal
    try:
        ip_obj = ipaddress.ip_address(hostname)
        if ip_obj.is_link_local or ip_obj.is_multicast or ip_obj.is_unspecified:
            raise ValueError(f"SSRF Protection: indirizzo IP '{hostname}' non consentito.")
        if _is_forbidden_ip(hostname) and not is_allowed_internal:
            raise ValueError(f"SSRF Protection: accesso a indirizzo IP privato o di loopback '{hostname}' negato.")
    except ValueError as ip_err:
        if "SSRF Protection" in str(ip_err):
            raise
        # Hostname is a domain name: block localhost/internal names unless in allowed_internal_netlocs
        if hostname in ("localhost", "host.docker.internal", "shared-keycloak") and not is_allowed_internal:
            raise ValueError(f"SSRF Protection: accesso a '{netloc_lower}' negato.")

    if resolve_dns and not is_allowed_internal:
        try:
            addr_infos = socket.getaddrinfo(hostname, port, proto=socket.IPPROTO_TCP)
            for info in addr_infos:
                resolved_ip = info[4][0]
                if _is_forbidden_ip(resolved_ip):
                    raise ValueError(
                        f"SSRF Protection: l'host '{hostname}' risolve verso un indirizzo interno/privato ({resolved_ip})."
                    )
        except ValueError:
            raise
        except socket.gaierror:
            pass

    return clean


def update_system_auth_settings(db: Session, updates: Dict[str, Any]) -> SystemAuthSettings:
    """Update auth configuration in database with validation against lockout and SSRF."""
    auth_cfg = get_system_auth_settings(db)

    # Validate against lockout: cannot disable both local login and IdP login
    allow_local = updates.get("allow_local_login", auth_cfg.allow_local_login)
    allow_idp = updates.get("allow_idp_login", auth_cfg.allow_idp_login)

    if not allow_local and not allow_idp:
        raise ValueError("Impossibile disabilitare contemporaneamente sia il login locale che il login IdP.")

    if "issuer_url" in updates and updates["issuer_url"]:
        updates["issuer_url"] = validate_oidc_issuer_url(updates["issuer_url"], resolve_dns=False)

    if "mfa_policy" in updates and updates["mfa_policy"]:
        clean_policy = str(updates["mfa_policy"]).strip().lower()
        allowed_policies = {"disabled", "admin_only", "write_roles", "all"}
        if clean_policy not in allowed_policies:
            raise ValueError(f"Policy MFA non valida '{updates['mfa_policy']}'. Valori ammessi: {', '.join(sorted(allowed_policies))}")
        updates["mfa_policy"] = clean_policy

    for field in [
        "allow_local_login", "allow_idp_login", "allow_mcp_access", "provider_name",
        "issuer_url", "client_id", "client_secret", "scopes",
        "prompt_login", "enable_single_logout", "rbac_mode", "role_mappings",
        "max_schema_versions", "mfa_policy", "show_demo_banner", "demo_banner_message"
    ]:
        if field in updates:
            if field == "client_secret" and updates[field] == "********":
                continue
            setattr(auth_cfg, field, updates[field])

    db.commit()
    db.refresh(auth_cfg)

    # Invalidate cached discovery
    global _OIDC_DISCOVERY_CACHE, _OIDC_DISCOVERY_EXPIRY
    _OIDC_DISCOVERY_CACHE = {}
    _OIDC_DISCOVERY_EXPIRY = 0

    return auth_cfg


def test_idp_connection(issuer_url: str) -> Dict[str, Any]:
    """Test connection and discovery metadata resolution against an IdP URL with SSRF protection."""
    try:
        clean_issuer = validate_oidc_issuer_url(issuer_url, resolve_dns=True)
        discovery_url = f"{clean_issuer}/.well-known/openid-configuration"

        resp = _make_oidc_request("GET", discovery_url)
        if resp.status_code != 200:
            return {
                "success": False,
                "message": f"IdP ha risposto con codice HTTP {resp.status_code}."
            }
        data = resp.json()
        if not isinstance(data, dict) or not data.get("issuer") or not data.get("authorization_endpoint"):
            return {
                "success": False,
                "message": "La risposta ricevuta non è un documento OpenID Connect Discovery valido."
            }
        return {
            "success": True,
            "message": "Connessione all'Identity Provider riuscita!",
            "issuer": data.get("issuer"),
            "authorization_endpoint": data.get("authorization_endpoint"),
            "token_endpoint": data.get("token_endpoint"),
            "userinfo_endpoint": data.get("userinfo_endpoint"),
            "end_session_endpoint": data.get("end_session_endpoint")
        }
    except ValueError as val_err:
        return {
            "success": False,
            "message": str(val_err)
        }
    except Exception as exc:
        return {
            "success": False,
            "message": f"Impossibile raggiungere l'IdP: {str(exc)}"
        }


PBKDF2_ITERATIONS = 600_000


def hash_password(password: str) -> str:
    """Generate salted PBKDF2-HMAC-SHA256 hash using OWASP-recommended 600,000 iterations."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${key.hex()}"


def verify_password(password: str, hashed_value: str) -> bool:
    """Verify plain password against stored pbkdf2_sha256$iterations$salt$hash or legacy salt$hash."""
    if not hashed_value or "$" not in hashed_value:
        return False
    try:
        parts = hashed_value.split("$")
        if len(parts) == 4 and parts[0] == "pbkdf2_sha256":
            iterations = int(parts[1])
            salt = parts[2]
            stored_hash = parts[3]
        elif len(parts) == 2:
            iterations = 100_000
            salt, stored_hash = parts
        else:
            return False

        key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations
        )
        return hmac.compare_digest(key.hex(), stored_hash)
    except Exception:
        return False


class LoginRateLimiter:
    """
    Sliding-window in-memory rate limiter for failed login attempts (CWE-307 / SAST-MED-02).
    Limits failed login attempts per key (typically client_ip:username) to max_attempts
    within window_seconds (default: 5 failed attempts in 300 seconds / 5 minutes).
    """
    def __init__(self, max_attempts: int = 5, window_seconds: int = 300):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._lock = threading.Lock()
        self._failed_attempts: Dict[str, List[float]] = defaultdict(list)

    def _prune(self, now: float, key: str) -> List[float]:
        threshold = now - self.window_seconds
        valid = [t for t in self._failed_attempts[key] if t > threshold]
        if valid:
            self._failed_attempts[key] = valid
        else:
            self._failed_attempts.pop(key, None)
        return valid

    def check_rate_limit(self, key: str) -> None:
        """
        Check if the key has exceeded max failed attempts in the window.
        Raises HTTPException(429) with Retry-After header if blocked.
        """
        now = time.time()
        with self._lock:
            valid_attempts = self._prune(now, key)
            if len(valid_attempts) >= self.max_attempts:
                oldest_attempt = min(valid_attempts)
                retry_after = max(1, int(self.window_seconds - (now - oldest_attempt)))
                raise HTTPException(
                    status_code=429,
                    detail=f"Troppi tentativi di accesso falliti. Riprova tra {retry_after} secondi.",
                    headers={"Retry-After": str(retry_after)}
                )

    def record_failure(self, key: str) -> None:
        """Record a failed login attempt for the key."""
        now = time.time()
        with self._lock:
            self._prune(now, key)
            self._failed_attempts[key].append(now)

    def record_success(self, key: str) -> None:
        """Clear failed login attempts for the key upon successful authentication."""
        with self._lock:
            self._failed_attempts.pop(key, None)

    def reset(self) -> None:
        """Reset all rate limiter state (useful for test isolation)."""
        with self._lock:
            self._failed_attempts.clear()


login_rate_limiter = LoginRateLimiter()


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')


def _base64url_decode(data: str) -> bytes:
    padding = '=' * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode((data + padding).encode('utf-8'))


def create_access_token(user: User, expires_delta: Optional[int] = None) -> str:
    """Generate secure signed JWT-like token for user session with unique JTI."""
    now = int(time.time())
    expiry = now + (expires_delta if expires_delta is not None else settings.TOKEN_EXPIRY_SECONDS)
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "jti": str(uuid.uuid4()),
        "sub": user.id,
        "username": user.username or user.email,
        "email": user.email,
        "full_name": user.full_name,
        "auth_provider": user.auth_provider or "local",
        "exp": expiry,
        "iat": now
    }

    header_b64 = _base64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = _base64url_encode(json.dumps(payload).encode('utf-8'))
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    
    signature = hmac.new(settings.SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    signature_b64 = _base64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode signed JWT token."""
    if not token or token.count('.') != 2:
        return None
    try:
        header_b64, payload_b64, signature_b64 = token.split('.')
        signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_sig = hmac.new(settings.SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
        provided_sig = _base64url_decode(signature_b64)

        if not hmac.compare_digest(expected_sig, provided_sig):
            return None

        payload_json = _base64url_decode(payload_b64).decode('utf-8')
        payload = json.loads(payload_json)

        # Check expiration
        if payload.get("exp", 0) < int(time.time()):
            return None

        return payload
    except Exception:
        return None


def is_token_revoked(db: Session, jti: str) -> bool:
    """Check if token JTI is present in the database blacklist."""
    if not jti:
        return False
    try:
        return db.query(RevokedToken.id).filter(RevokedToken.jti == jti).first() is not None
    except Exception:
        return False


def clean_expired_revoked_tokens(db: Session) -> int:
    """Remove expired entries from revoked_tokens to prevent table bloat."""
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        deleted = db.query(RevokedToken).filter(RevokedToken.expires_at < now).delete(synchronize_session=False)
        db.commit()
        return deleted
    except Exception:
        db.rollback()
        return 0


def revoke_token(db: Session, token: str, reason: str = "logout") -> bool:
    """
    Revoke a token by extracting its JTI and writing it to the revoked_tokens database table.
    Stores expiration timestamp to enable periodic cleanup.
    """
    if not token:
        return False

    payload = decode_access_token(token)
    if not payload:
        # Decode payload without exp check in case token is expiring/expired
        try:
            parts = token.split('.')
            if len(parts) == 3:
                payload = json.loads(_base64url_decode(parts[1]).decode('utf-8'))
        except Exception:
            pass

    if not payload:
        return False

    jti = payload.get("jti") or hashlib.sha256(token.encode('utf-8')).hexdigest()
    exp_ts = payload.get("exp")
    if exp_ts:
        expires_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc).replace(tzinfo=None)
    else:
        expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=1)

    user_id = payload.get("sub")

    try:
        existing = db.query(RevokedToken.id).filter(RevokedToken.jti == jti).first()
        if not existing:
            record = RevokedToken(
                id=str(uuid.uuid4()),
                jti=jti,
                token_type="access_token",
                user_id=user_id,
                reason=reason,
                revoked_at=datetime.now(timezone.utc).replace(tzinfo=None),
                expires_at=expires_at
            )
            db.add(record)
            db.commit()

        # Opportunistic garbage collection of expired tokens
        clean_expired_revoked_tokens(db)
        return True
    except Exception:
        db.rollback()
        return False


def authenticate_user(db: Session, identifier: str, password: str) -> Optional[User]:
    """Authenticate user by username or email and plain password."""
    clean_id = identifier.strip().lower()
    user = db.query(User).filter(
        (User.email.ilike(clean_id)) | (User.username.ilike(clean_id))
    ).first()

    if not user:
        return None
    if not user.is_active:
        return None
    if not verify_password(password, user.password_hash or ""):
        return None

    return user


def get_user_from_token(db: Session, token: str) -> Optional[User]:
    """Fetch active user from token, verifying it is not in the JTI blacklist."""
    payload = decode_access_token(token)
    if not payload:
        return None
    jti = payload.get("jti") or hashlib.sha256(token.encode('utf-8')).hexdigest()
    if is_token_revoked(db, jti):
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    return user


# ============================================================================
# MFA / 2FA Engine (RFC 6238 TOTP) for Local Accounts
# ============================================================================

def generate_totp_secret() -> str:
    """Generates a secure random 32-character Base32 secret for RFC 6238 TOTP."""
    if pyotp is not None:
        return pyotp.random_base32()
    return secrets.token_hex(16).upper()


def get_totp_uri(secret: str, username: str, issuer: str = "EasyEA") -> str:
    """Returns the standard otpauth:// URI for authenticator applications."""
    if pyotp is not None:
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(name=username, issuer_name=issuer)
    return f"otpauth://totp/{issuer}:{username}?secret={secret}&issuer={issuer}"


def generate_qr_code_svg(otpauth_url: str) -> str:
    """Generates a clean inline SVG string for the QR Code with white background and responsive viewBox."""
    if qrcode is not None:
        import re
        factory = qrcode.image.svg.SvgPathFillImage
        img = qrcode.make(otpauth_url, image_factory=factory, box_size=10, border=2)
        stream = io.BytesIO()
        img.save(stream)
        raw_svg = stream.getvalue().decode("utf-8")
        clean_svg = raw_svg
        if clean_svg.startswith("<?xml"):
            clean_svg = clean_svg.split("?>", 1)[-1].strip()
        clean_svg = re.sub(r'width="[^"]+"', 'width="100%"', clean_svg, count=1)
        clean_svg = re.sub(r'height="[^"]+"', 'height="100%"', clean_svg, count=1)
        return clean_svg
    return "<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='white'/><text x='10' y='50' fill='black'>QR Code</text></svg>"


def generate_qr_code_data_url(otpauth_url: str) -> str:
    """Generates a data:image/svg+xml;base64,... URL for embedding directly in <img src="..." />."""
    svg_str = generate_qr_code_svg(otpauth_url)
    b64 = base64.b64encode(svg_str.encode("utf-8")).decode("utf-8")
    return f"data:image/svg+xml;base64,{b64}"


def verify_totp_code(secret: str, code: str) -> bool:
    """Verifies a 6-digit TOTP code against the Base32 secret allowing 1 step window drift."""
    if not secret or not code or pyotp is None:
        return False
    clean_code = str(code).strip().replace(" ", "").replace("-", "")
    if not clean_code.isdigit() or len(clean_code) != 6:
        return False
    try:
        totp = pyotp.TOTP(secret)
        return bool(totp.verify(clean_code, valid_window=1))
    except Exception:
        return False


def is_user_subject_to_mfa_policy(user: User, mfa_policy: str) -> bool:
    """
    Evaluates whether a user is required to have MFA enabled based on the admin policy.
    CRITICAL: Applies exclusively to local accounts. Federated users (Keycloak/OIDC)
    rely on the external IdP's policies and return False.
    """
    if not user:
        return False

    # Check if user is federated (e.g. auth_provider != 'local' or external_id is present)
    is_federated = (user.auth_provider and user.auth_provider != "local") or (user.external_id is not None)
    if is_federated:
        return False

    policy = (mfa_policy or "disabled").strip().lower()
    if policy == "disabled":
        return False
    if policy == "all":
        return True

    user_roles = {a.role for a in (user.role_assignments or [])}

    if policy == "admin_only":
        return "admin" in user_roles

    if policy == "write_roles":
        # 'admin', 'architect', 'analyst' have modification rights
        write_roles = {"admin", "architect", "analyst"}
        return bool(user_roles.intersection(write_roles))

    return False


def is_mfa_required_for_user(user: User, db: Session) -> Tuple[bool, bool]:
    """
    Returns (is_required, is_enforced_by_policy).
    True if user already has MFA enabled or if current admin policy mandates it.
    """
    auth_cfg = get_system_auth_settings(db)
    enforced = is_user_subject_to_mfa_policy(user, getattr(auth_cfg, "mfa_policy", "disabled"))
    required = bool(user.is_mfa_enabled or enforced)
    return required, enforced


def create_mfa_challenge_token(user_id: str, username: str, pending_secret: Optional[str] = None) -> str:
    """Creates a short-lived (5 min) HMAC-SHA256 signed token for the 2-step login challenge."""
    exp = int(time.time()) + 300
    payload = {
        "sub": user_id,
        "username": username,
        "purpose": "mfa_challenge",
        "pending_secret": pending_secret,
        "exp": exp
    }
    payload_json = json.dumps(payload, separators=(',', ':'))
    payload_b64 = _base64url_encode(payload_json.encode('utf-8'))
    signature = hmac.new(settings.SECRET_KEY.encode('utf-8'), payload_b64.encode('utf-8'), hashlib.sha256).digest()
    sig_b64 = _base64url_encode(signature)
    return f"{payload_b64}.{sig_b64}"


def verify_mfa_challenge_token(token: str) -> Optional[Dict[str, Any]]:
    """Verifies and decodes the HMAC-SHA256 signed MFA challenge token."""
    try:
        parts = token.split('.')
        if len(parts) != 2:
            return None
        payload_b64, sig_b64 = parts
        expected_sig = hmac.new(settings.SECRET_KEY.encode('utf-8'), payload_b64.encode('utf-8'), hashlib.sha256).digest()
        provided_sig = _base64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, provided_sig):
            return None

        payload_json = _base64url_decode(payload_b64).decode('utf-8')
        payload = json.loads(payload_json)

        if payload.get("purpose") != "mfa_challenge":
            return None
        if payload.get("exp", 0) < int(time.time()):
            return None

        return payload
    except Exception:
        return None


# ============================================================================
# OIDC / OAuth2 Engine
# ============================================================================

def _make_oidc_request(method: str, url: str, **kwargs) -> httpx.Response:
    """
    Executes an SSRF-validated HTTP request to the OIDC IdP (with redirects disabled),
    including automatic fallback strictly for the configured local Keycloak dev port (18000).
    """
    validate_oidc_issuer_url(url.split("?")[0], resolve_dns=True)

    candidate_urls = [url]
    parsed = urllib.parse.urlparse(url)
    hostname = parsed.hostname or ""
    port = parsed.port

    if hostname in ("localhost", "127.0.0.1") and port == 18000:
        candidate_urls.append(url.replace(f"{hostname}:{port}", f"host.docker.internal:{port}"))
        candidate_urls.append(url.replace(f"{hostname}:{port}", "shared-keycloak:8080"))
    elif hostname == "host.docker.internal" and port == 18000:
        candidate_urls.append(url.replace("host.docker.internal:18000", "shared-keycloak:8080"))
        candidate_urls.append(url.replace("host.docker.internal", "localhost"))

    last_exc = None
    for target_url in candidate_urls:
        try:
            with httpx.Client(timeout=8.0, follow_redirects=False) as client:
                resp = client.request(method, target_url, **kwargs)
                return resp
        except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
            last_exc = exc
            continue

    if last_exc:
        raise last_exc
    raise RuntimeError(f"Failed to connect to {url}")


def get_oidc_discovery(issuer_url: Optional[str] = None) -> Dict[str, Any]:
    """Fetch and cache OpenID Connect Discovery configuration from IdP."""
    global _OIDC_DISCOVERY_CACHE, _OIDC_DISCOVERY_EXPIRY
    now = time.time()
    target_issuer = (issuer_url or settings.OIDC_ISSUER_URL).rstrip('/')

    if not issuer_url and _OIDC_DISCOVERY_CACHE and now < _OIDC_DISCOVERY_EXPIRY:
        return _OIDC_DISCOVERY_CACHE

    discovery_url = f"{target_issuer}/.well-known/openid-configuration"

    try:
        resp = _make_oidc_request("GET", discovery_url)
        resp.raise_for_status()
        data = resp.json()
        if not issuer_url:
            _OIDC_DISCOVERY_CACHE = data
            _OIDC_DISCOVERY_EXPIRY = now + 3600  # Cache for 1 hour
        return data
    except Exception as exc:
        return {
            "issuer": target_issuer,
            "authorization_endpoint": f"{target_issuer}/protocol/openid-connect/auth",
            "token_endpoint": f"{target_issuer}/protocol/openid-connect/token",
            "userinfo_endpoint": f"{target_issuer}/protocol/openid-connect/userinfo",
            "end_session_endpoint": f"{target_issuer}/protocol/openid-connect/logout"
        }


def _extract_origin(url_str: str) -> Optional[str]:
    try:
        parsed = urllib.parse.urlparse(url_str.strip())
        if parsed.scheme in ("http", "https") and parsed.netloc and not parsed.username and not parsed.password:
            return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"
    except Exception:
        pass
    return None


def validate_oidc_return_to(
    candidate_url: Optional[str],
    base_url: Optional[str] = None,
    strict: bool = False,
) -> str:
    """
    Validate OIDC post-login redirect target (`return_to`) against an explicit allowlist of origins
    to prevent Open Redirect & JWT token exfiltration (`CWE-601`).
    """
    default_target = settings.OIDC_FRONTEND_REDIRECT_URL.strip().rstrip("/")
    if not candidate_url or not candidate_url.strip():
        return default_target

    raw = candidate_url.strip()
    if "\\" in raw or "\r" in raw or "\n" in raw:
        if strict:
            raise ValueError("Invalid characters in return_to redirect URL.")
        return default_target

    parsed = urllib.parse.urlparse(raw)
    if parsed.scheme.lower() not in ("http", "https") or not parsed.netloc or parsed.username or parsed.password:
        if strict:
            raise ValueError(f"Invalid or disallowed redirect URL scheme/netloc: '{raw}'")
        return default_target

    candidate_origin = f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"

    allowed_origins: Set[str] = set()
    for src in [settings.OIDC_FRONTEND_REDIRECT_URL, base_url or ""]:
        orig = _extract_origin(src)
        if orig:
            allowed_origins.add(orig)
    for item in (settings.OIDC_ALLOWED_RETURN_ORIGINS or "").split(","):
        orig = _extract_origin(item)
        if orig:
            allowed_origins.add(orig)

    # RFC 8252 loopback redirect for Archi desktop plugin (ports 8765..8775 on 127.0.0.1 / localhost)
    is_loopback_plugin = (
        parsed.scheme.lower() == "http"
        and (parsed.hostname in ("127.0.0.1", "localhost"))
        and (parsed.port is not None and 8765 <= int(parsed.port) <= 8775)
        and (parsed.path in ("/callback", "/callback/"))
    )

    if candidate_origin not in allowed_origins and not is_loopback_plugin:
        if strict:
            raise ValueError(f"Untrusted redirect origin in return_to: '{candidate_origin}'")
        return default_target

    clean_path = (parsed.path or "").rstrip("/")
    if clean_path.endswith("/api/auth") or clean_path.endswith("/api"):
        clean_path = ""
    return f"{candidate_origin}{clean_path}"


def create_oidc_state(return_to: str, base_url: Optional[str] = None) -> str:
    """Create an HMAC-SHA256 signed, expiring OIDC `state` token binding `return_to` and a random nonce."""
    safe_return_to = validate_oidc_return_to(return_to, base_url=base_url, strict=True)
    now = int(time.time())
    state_payload = {
        "return_to": safe_return_to,
        "nonce": secrets.token_hex(16),
        "iat": now,
        "exp": now + 600,
    }
    payload_b64 = _base64url_encode(json.dumps(state_payload, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    sig_b64 = _base64url_encode(sig)
    return f"{payload_b64}.{sig_b64}"


def verify_oidc_state(state_token: Optional[str], base_url: Optional[str] = None) -> Dict[str, Any]:
    """Verify HMAC-SHA256 signature, expiration, and allowed `return_to` of an OIDC `state` parameter."""
    if not state_token or "." not in state_token:
        raise ValueError("Missing or unsigned OIDC state parameter.")
    try:
        payload_b64, sig_b64 = state_token.split(".", 1)
        expected_sig = hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            payload_b64.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        provided_sig = _base64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, provided_sig):
            raise ValueError("Invalid OIDC state signature.")

        data = json.loads(_base64url_decode(payload_b64).decode("utf-8"))
        if int(data.get("exp", 0)) < int(time.time()):
            raise ValueError("Expired OIDC state parameter.")

        data["return_to"] = validate_oidc_return_to(
            data.get("return_to"),
            base_url=base_url,
            strict=True,
        )
        return data
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(f"Malformed OIDC state parameter: {exc}")


# ASN.1 DER DigestInfo prefixes for RSA PKCS#1 v1.5 signature verification (RFC 8017 Section 9.2)
_RSA_DIGEST_INFO_PREFIXES = {
    "RS256": (hashlib.sha256, bytes.fromhex("3031300d060960864801650304020105000420")),
    "RS384": (hashlib.sha384, bytes.fromhex("3041300d060960864801650304020205000430")),
    "RS512": (hashlib.sha512, bytes.fromhex("3051300d060960864801650304020305000440")),
}


def _verify_rsa_pkcs1_v15(signing_input: bytes, signature: bytes, jwk: Dict[str, Any], alg: str) -> bool:
    """Verify RSA PKCS#1 v1.5 JWS signature (`RS256`/`RS384`/`RS512`) against a JWK (`n`, `e`)."""
    if alg not in _RSA_DIGEST_INFO_PREFIXES:
        return False
    hash_fn, digest_prefix = _RSA_DIGEST_INFO_PREFIXES[alg]
    n_b64 = jwk.get("n")
    e_b64 = jwk.get("e")
    if not n_b64 or not e_b64:
        return False
    n_bytes = _base64url_decode(n_b64)
    e_bytes = _base64url_decode(e_b64)
    k = len(n_bytes)
    if len(signature) != k or k < 128:
        return False

    n_int = int.from_bytes(n_bytes, "big")
    e_int = int.from_bytes(e_bytes, "big")
    sig_int = int.from_bytes(signature, "big")
    if sig_int >= n_int:
        return False

    em = pow(sig_int, e_int, n_int).to_bytes(k, "big")
    digest = hash_fn(signing_input).digest()
    t = digest_prefix + digest
    ps_len = k - len(t) - 3
    if ps_len < 8:
        return False
    expected_em = b"\x00\x01" + (b"\xff" * ps_len) + b"\x00" + t
    return hmac.compare_digest(em, expected_em)


def _get_oidc_jwks(jwks_uri: str) -> List[Dict[str, Any]]:
    """Fetch and cache JSON Web Key Set (JWKS) from the Identity Provider."""
    now = time.time()
    cached = _OIDC_JWKS_CACHE.get(jwks_uri)
    if cached and now < cached[0]:
        return cached[1]

    resp = _make_oidc_request("GET", jwks_uri)
    resp.raise_for_status()
    keys = resp.json().get("keys", [])
    if isinstance(keys, list):
        _OIDC_JWKS_CACHE[jwks_uri] = (now + 3600, keys)
        return keys
    return []


def _normalize_issuer_set(configured_issuer: str, discovery_issuer: Optional[str] = None) -> Set[str]:
    """Return set of equivalent normalized issuer URLs accounting for Docker internal host aliases."""
    issuers: Set[str] = set()
    for raw in [configured_issuer, discovery_issuer or ""]:
        clean = raw.strip().rstrip("/")
        if not clean:
            continue
        issuers.add(clean)
        for alias in ("localhost", "127.0.0.1", "host.docker.internal"):
            issuers.add(clean.replace("localhost", alias).replace("host.docker.internal", alias))
        issuers.add(clean.replace("shared-keycloak:8080", "localhost:18000"))
        issuers.add(clean.replace("localhost:18000", "shared-keycloak:8080"))
    return issuers


def _verify_and_decode_oidc_jwt(
    token: str,
    issuer: str,
    client_id: str,
    client_secret: str,
    discovery: Dict[str, Any],
    verify_aud: bool = True,
) -> Dict[str, Any]:
    """
    Cryptographically verify an OIDC JWT (`id_token` or `access_token`) signature (RS256/384/512 via JWKS
    or HS256/384/512 via client_secret) and validate `iss`, `aud`/`azp`, and `exp` claims (`CWE-347`).
    """
    if not token or token.count(".") != 2:
        raise ValueError("Malformed OIDC JWT token.")

    header_b64, payload_b64, sig_b64 = token.split(".")
    if not sig_b64:
        raise ValueError("Unsigned OIDC JWT rejected.")

    header = json.loads(_base64url_decode(header_b64).decode("utf-8"))
    payload = json.loads(_base64url_decode(payload_b64).decode("utf-8"))

    alg = str(header.get("alg") or "").upper()
    if not alg or alg == "NONE":
        raise ValueError("Disallowed 'none' algorithm in OIDC JWT.")

    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    sig_bytes = _base64url_decode(sig_b64)

    if alg in ("HS256", "HS384", "HS512"):
        if not client_secret:
            raise ValueError("Cannot verify HMAC-signed OIDC JWT without client_secret.")
        hash_map = {"HS256": hashlib.sha256, "HS384": hashlib.sha384, "HS512": hashlib.sha512}
        expected_sig = hmac.new(
            client_secret.encode("utf-8"),
            signing_input,
            hash_map[alg],
        ).digest()
        if not hmac.compare_digest(expected_sig, sig_bytes):
            raise ValueError("Invalid HMAC signature on OIDC JWT.")
    elif alg in ("RS256", "RS384", "RS512"):
        jwks_uri = discovery.get("jwks_uri") or f"{issuer.rstrip('/')}/protocol/openid-connect/certs"
        keys = _get_oidc_jwks(jwks_uri)
        kid = header.get("kid")
        candidate_keys = [k for k in keys if k.get("kty") == "RSA" and (not kid or k.get("kid") == kid)]
        if not candidate_keys:
            candidate_keys = [k for k in keys if k.get("kty") == "RSA"]
        if not candidate_keys or not any(_verify_rsa_pkcs1_v15(signing_input, sig_bytes, k, alg) for k in candidate_keys):
            raise ValueError("Invalid RSA JWS signature on OIDC JWT.")
    else:
        raise ValueError(f"Unsupported OIDC JWT signature algorithm: '{alg}'")

    # Validate expiration (`exp`) with 60s clock-skew tolerance
    now = int(time.time())
    exp = payload.get("exp")
    if exp is None or int(exp) + 60 < now:
        raise ValueError("OIDC JWT token has expired.")

    # Validate issuer (`iss`)
    token_iss = str(payload.get("iss") or "").strip().rstrip("/")
    allowed_issuers = _normalize_issuer_set(issuer, discovery.get("issuer"))
    if not token_iss or token_iss not in allowed_issuers:
        raise ValueError(f"Untrusted OIDC JWT issuer: '{token_iss}'")

    # Validate audience (`aud` / `azp`)
    if verify_aud and client_id:
        aud = payload.get("aud")
        azp = payload.get("azp")
        aud_list = [aud] if isinstance(aud, str) else (aud if isinstance(aud, list) else [])
        if client_id not in aud_list and azp != client_id:
            raise ValueError(f"OIDC JWT audience mismatch for client '{client_id}'.")

    return payload


def get_oidc_authorization_url(
    db: Optional[Session] = None,
    state: Optional[str] = None,
    prompt: Optional[str] = None
) -> str:
    """Generate the OAuth2 / OIDC authorization URL for redirecting users to the IdP."""
    cfg = get_system_auth_settings(db) if db else None
    issuer = cfg.issuer_url if cfg else settings.OIDC_ISSUER_URL
    client_id = cfg.client_id if cfg else settings.OIDC_CLIENT_ID
    scopes = cfg.scopes if cfg else settings.OIDC_SCOPES
    prompt_login = cfg.prompt_login if cfg else False

    discovery = get_oidc_discovery(issuer)
    auth_endpoint = discovery.get("authorization_endpoint")
    if not auth_endpoint:
        auth_endpoint = f"{issuer.rstrip('/')}/protocol/openid-connect/auth"

    # Ensure browser-accessible host (replace internal docker hostname with localhost if needed)
    auth_endpoint = auth_endpoint.replace("host.docker.internal", "localhost").replace("shared-keycloak:8080", "localhost:18000")

    params = {
        "client_id": client_id,
        "redirect_uri": settings.OIDC_REDIRECT_URI,
        "response_type": "code",
        "scope": scopes,
        "state": state or create_oidc_state(settings.OIDC_FRONTEND_REDIRECT_URL)
    }

    # If prompt_login is active or explicitly passed, force login prompt
    active_prompt = prompt or ("login" if prompt_login else None)
    if active_prompt:
        params["prompt"] = active_prompt

    return f"{auth_endpoint}?{urllib.parse.urlencode(params)}"


def exchange_oidc_code(code: str, db: Optional[Session] = None) -> Dict[str, Any]:
    """Exchange authorization code for tokens, cryptographically verify JWTs, and fetch userinfo."""
    cfg = get_system_auth_settings(db) if db else None
    issuer = cfg.issuer_url if cfg else settings.OIDC_ISSUER_URL
    client_id = cfg.client_id if cfg else settings.OIDC_CLIENT_ID
    client_secret = cfg.client_secret if cfg else settings.OIDC_CLIENT_SECRET

    discovery = get_oidc_discovery(issuer)
    token_endpoint = discovery.get("token_endpoint") or f"{issuer.rstrip('/')}/protocol/openid-connect/token"
    userinfo_endpoint = discovery.get("userinfo_endpoint")

    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": settings.OIDC_REDIRECT_URI
    }

    token_resp = _make_oidc_request(
        "POST",
        token_endpoint,
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    if token_resp.status_code != 200:
        raise ValueError(f"Failed to exchange token with IdP: {token_resp.text}")

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    id_token = token_data.get("id_token")

    # Verify ID Token cryptographically if present
    id_token_claims: Dict[str, Any] = {}
    if id_token:
        id_token_claims = _verify_and_decode_oidc_jwt(
            id_token,
            issuer=issuer,
            client_id=client_id,
            client_secret=client_secret,
            discovery=discovery,
            verify_aud=True,
        )

    # Verify Access Token cryptographically if it is a JWT
    access_token_claims: Dict[str, Any] = {}
    if access_token and access_token.count(".") == 2:
        access_token_claims = _verify_and_decode_oidc_jwt(
            access_token,
            issuer=issuer,
            client_id=client_id,
            client_secret=client_secret,
            discovery=discovery,
            verify_aud=False,
        )

    user_info: Dict[str, Any] = {}
    if userinfo_endpoint and access_token:
        try:
            userinfo_resp = _make_oidc_request(
                "GET",
                userinfo_endpoint,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if userinfo_resp.status_code == 200:
                user_info = userinfo_resp.json()
        except Exception:
            pass

    # OIDC Core 1.0 Section 5.3.4: verify UserInfo `sub` matches ID Token `sub`
    if id_token_claims.get("sub") and user_info.get("sub") and user_info["sub"] != id_token_claims["sub"]:
        raise ValueError("OIDC UserInfo 'sub' claim does not match ID Token 'sub' claim.")

    merged_claims = {**access_token_claims, **id_token_claims, **user_info}
    if not merged_claims.get("sub"):
        raise ValueError("OIDC authentication failed: no verified 'sub' claim obtained from IdP.")

    return {
        "token_data": token_data,
        "claims": merged_claims
    }


def _evaluate_role_mappings(claims: Dict[str, Any], role_mappings: List[Dict[str, Any]], client_id: str) -> List[Dict[str, Any]]:
    """
    Evaluates dynamic role mapping rules against token claims.
    Returns matched assignments: [{'role': 'admin', 'model_id': None}, ...]
    """
    matched_assignments = []
    
    # Extract roles sets from claims for fast lookup
    realm_roles = set()
    realm_access = claims.get("realm_access", {})
    if isinstance(realm_access, dict):
        for r in realm_access.get("roles", []):
            realm_roles.add(str(r).strip().lower())
    for r in claims.get("roles", []):
        realm_roles.add(str(r).strip().lower())

    client_roles = set()
    resource_access = claims.get("resource_access", {})
    if isinstance(resource_access, dict):
        c_res = resource_access.get(client_id, {})
        if isinstance(c_res, dict):
            for r in c_res.get("roles", []):
                client_roles.add(str(r).strip().lower())

    groups = set()
    for g in claims.get("groups", []):
        groups.add(str(g).strip().strip("/").lower())

    for rule in role_mappings:
        claim_type = rule.get("claim_type", "realm_role")
        claim_name = str(rule.get("claim_name", "")).strip().lower()
        target_role = rule.get("target_role", "analyst")
        target_model_id = rule.get("target_model_id")

        matched = False
        if claim_type == "realm_role":
            matched = claim_name in realm_roles
        elif claim_type == "client_role":
            matched = claim_name in client_roles
        elif claim_type == "group":
            g_clean = claim_name.strip("/")
            matched = any(g_clean == grp or g_clean in grp for grp in groups)
        elif claim_type == "custom_claim":
            expected = rule.get("expected_value", "")
            claim_val = claims.get(rule.get("claim_name", ""))
            if isinstance(claim_val, list):
                matched = expected in claim_val or str(expected).lower() in [str(x).lower() for x in claim_val]
            elif claim_val is not None:
                matched = str(claim_val).lower() == str(expected).lower()

        if matched:
            matched_assignments.append({
                "role": target_role,
                "model_id": target_model_id
            })

    return matched_assignments


def provision_or_sync_oidc_user(db: Session, claims: Dict[str, Any]) -> User:
    """
    Just-In-Time (JIT) provisioning and hybrid role synchronization for OIDC authenticated users
    based on dynamic SystemAuthSettings and Role Mapping rules.
    Enforces strict subject (`sub`) identity matching and requires `email_verified == True`
    before linking an OIDC identity to any pre-existing local account (`CWE-287` / `CWE-303`).
    """
    external_id = str(claims.get("sub") or "").strip()
    if not external_id:
        raise ValueError("Invalid OIDC claims: missing 'sub' subject identifier.")

    email = claims.get("email")
    if not email:
        email = f"{external_id}@oidc.local"
    email = email.strip().lower()

    email_verified_raw = claims.get("email_verified")
    email_verified = (
        email_verified_raw is True
        or (isinstance(email_verified_raw, str) and email_verified_raw.strip().lower() == "true")
    )

    full_name = (
        claims.get("name")
        or f"{claims.get('given_name', '')} {claims.get('family_name', '')}".strip()
        or claims.get("preferred_username")
        or email.split("@")[0]
    )
    username = claims.get("preferred_username") or email.split("@")[0]

    # 1. Primary lookup by immutable IdP `sub` (`external_id`)
    user = db.query(User).filter(User.external_id == external_id).first()

    # 2. Secondary lookup by email ONLY if email is verified by IdP and account is not already bound to another subject
    if not user:
        existing_by_email = db.query(User).filter(User.email.ilike(email)).first()
        if existing_by_email:
            if (
                not email_verified
                or existing_by_email.id == "usr-sysadmin-00"
                or (existing_by_email.external_id and existing_by_email.external_id != external_id)
            ):
                raise ValueError(
                    "Account linking denied: cannot link OIDC identity to an existing account "
                    "without a verified email or when bound to a different subject."
                )
            user = existing_by_email

    auth_cfg = get_system_auth_settings(db)
    provider_label = auth_cfg.provider_name or "oidc"

    if not user:
        # Ensure username uniqueness when provisioning a new OIDC user
        candidate_username = username
        if db.query(User).filter(User.username.ilike(candidate_username)).first():
            candidate_username = f"{username}_{external_id[:6]}"
        user = User(
            id=str(uuid.uuid4()),
            username=candidate_username,
            email=email,
            full_name=full_name,
            auth_provider=provider_label,
            external_id=external_id,
            is_active=True,
            password_hash=""
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update external_id and auth_provider if linking a verified email account
        updated = False
        if not user.external_id:
            user.external_id = external_id
            updated = True
        if user.auth_provider == "local":
            user.auth_provider = provider_label
            updated = True
        if full_name and user.full_name != full_name:
            user.full_name = full_name
            updated = True
        if updated:
            db.commit()
            db.refresh(user)

    # Dynamic Role Synchronization
    rbac_mode = (auth_cfg.rbac_mode or "hybrid").lower()

    if rbac_mode in ("hybrid", "idp_sync"):
        mappings = auth_cfg.role_mappings or DEFAULT_ROLE_MAPPINGS
        matched_roles = _evaluate_role_mappings(claims, mappings, auth_cfg.client_id or settings.OIDC_CLIENT_ID)

        existing_assignments = {(a.role, a.model_id): a for a in user.role_assignments}

        for match in matched_roles:
            r = match["role"]
            m_id = match["model_id"]
            key = (r, m_id)

            if key not in existing_assignments:
                # Add assignment
                new_assignment = UserRoleAssignment(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    role=r,
                    model_id=m_id
                )
                db.add(new_assignment)
                db.commit()
                db.refresh(user)
                existing_assignments[key] = new_assignment

        # Fallback if no roles matched and user has no assignments
        if not user.role_assignments and matched_roles:
            pass # already assigned above

    return user


