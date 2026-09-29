import os
import time
import json
import base64
import hmac
import hashlib
import secrets
import uuid
import urllib.parse
from typing import Optional, Dict, Any, List, Set
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.archimate import User, UserRoleAssignment, SystemAuthSettings

# In-memory cache for OIDC Discovery metadata
_OIDC_DISCOVERY_CACHE: Dict[str, Any] = {}
_OIDC_DISCOVERY_EXPIRY: float = 0


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
            provider_name=settings.OIDC_PROVIDER_NAME,
            issuer_url=settings.OIDC_ISSUER_URL,
            client_id=settings.OIDC_CLIENT_ID,
            client_secret=settings.OIDC_CLIENT_SECRET,
            scopes=settings.OIDC_SCOPES,
            prompt_login=False,
            enable_single_logout=True,
            rbac_mode=settings.AUTH_RBAC_MODE,
            role_mappings=DEFAULT_ROLE_MAPPINGS
        )
        db.add(auth_cfg)
        db.commit()
        db.refresh(auth_cfg)
    return auth_cfg


def update_system_auth_settings(db: Session, updates: Dict[str, Any]) -> SystemAuthSettings:
    """Update auth configuration in database with validation against lockout."""
    auth_cfg = get_system_auth_settings(db)

    # Validate against lockout: cannot disable both local login and IdP login
    allow_local = updates.get("allow_local_login", auth_cfg.allow_local_login)
    allow_idp = updates.get("allow_idp_login", auth_cfg.allow_idp_login)

    if not allow_local and not allow_idp:
        raise ValueError("Impossibile disabilitare contemporaneamente sia il login locale che il login IdP.")

    for field in [
        "allow_local_login", "allow_idp_login", "provider_name",
        "issuer_url", "client_id", "client_secret", "scopes",
        "prompt_login", "enable_single_logout", "rbac_mode", "role_mappings",
        "max_schema_versions"
    ]:
        if field in updates:
            setattr(auth_cfg, field, updates[field])

    db.commit()
    db.refresh(auth_cfg)

    # Invalidate cached discovery
    global _OIDC_DISCOVERY_CACHE, _OIDC_DISCOVERY_EXPIRY
    _OIDC_DISCOVERY_CACHE = {}
    _OIDC_DISCOVERY_EXPIRY = 0

    return auth_cfg


def test_idp_connection(issuer_url: str) -> Dict[str, Any]:
    """Test connection and discovery metadata resolution against an IdP URL."""
    clean_issuer = issuer_url.strip().rstrip('/')
    discovery_url = f"{clean_issuer}/.well-known/openid-configuration"

    try:
        resp = _make_oidc_request("GET", discovery_url)
        if resp.status_code != 200:
            return {
                "success": False,
                "message": f"IdP ha risposto con codice HTTP {resp.status_code}: {resp.text[:200]}"
            }
        data = resp.json()
        return {
            "success": True,
            "message": "Connessione all'Identity Provider riuscita!",
            "issuer": data.get("issuer"),
            "authorization_endpoint": data.get("authorization_endpoint"),
            "token_endpoint": data.get("token_endpoint"),
            "userinfo_endpoint": data.get("userinfo_endpoint"),
            "end_session_endpoint": data.get("end_session_endpoint")
        }
    except Exception as exc:
        return {
            "success": False,
            "message": f"Impossibile raggiungere l'IdP: {str(exc)}"
        }


def hash_password(password: str) -> str:
    """Generate salted PBKDF2-HMAC-SHA256 hash."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return f"{salt}${key.hex()}"


def verify_password(password: str, hashed_value: str) -> bool:
    """Verify plain password against stored salt$hash."""
    if not hashed_value or "$" not in hashed_value:
        return False
    try:
        salt, stored_hash = hashed_value.split("$", 1)
        key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return hmac.compare_digest(key.hex(), stored_hash)
    except Exception:
        return False


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')


def _base64url_decode(data: str) -> bytes:
    padding = '=' * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode((data + padding).encode('utf-8'))


def create_access_token(user: User) -> str:
    """Generate secure signed JWT-like token for user session."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user.id,
        "username": user.username or user.email,
        "email": user.email,
        "full_name": user.full_name,
        "auth_provider": user.auth_provider or "local",
        "exp": int(time.time()) + settings.TOKEN_EXPIRY_SECONDS,
        "iat": int(time.time())
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
    """Fetch active user from token."""
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    return user


# ============================================================================
# OIDC / OAuth2 Engine
# ============================================================================

def _make_oidc_request(method: str, url: str, **kwargs) -> httpx.Response:
    """
    Executes an HTTP request to the OIDC IdP, with automatic fallback for Docker container environments
    if localhost/127.0.0.1 cannot be reached directly.
    """
    candidate_urls = [url]
    parsed = urllib.parse.urlparse(url)
    hostname = parsed.hostname or ""
    port = parsed.port

    if hostname in ("localhost", "127.0.0.1"):
        if port in (18000, 15173):
            candidate_urls.append(url.replace(f"{hostname}:{port}", f"host.docker.internal:{port}"))
            candidate_urls.append(url.replace(f"{hostname}:{port}", "shared-keycloak:8080"))
            candidate_urls.append(url.replace(f"{hostname}:{port}", f"172.17.0.1:{port}"))
        else:
            candidate_urls.append(url.replace(hostname, "host.docker.internal"))
            candidate_urls.append(url.replace(hostname, "shared-keycloak"))
    elif hostname == "host.docker.internal":
        candidate_urls.append(url.replace("host.docker.internal:18000", "shared-keycloak:8080"))
        candidate_urls.append(url.replace("host.docker.internal", "localhost"))

    last_exc = None
    for target_url in candidate_urls:
        try:
            with httpx.Client(timeout=8.0) as client:
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
        "state": state or secrets.token_urlsafe(16)
    }

    # If prompt_login is active or explicitly passed, force login prompt
    active_prompt = prompt or ("login" if prompt_login else None)
    if active_prompt:
        params["prompt"] = active_prompt

    return f"{auth_endpoint}?{urllib.parse.urlencode(params)}"


def exchange_oidc_code(code: str, db: Optional[Session] = None) -> Dict[str, Any]:
    """Exchange authorization code for tokens and fetch userinfo."""
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

    user_info = {}
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

    # Parse ID Token payload for claims if present
    id_token = token_data.get("id_token")
    id_token_claims = {}
    if id_token and id_token.count('.') == 2:
        try:
            _, payload_b64, _ = id_token.split('.')
            id_token_claims = json.loads(_base64url_decode(payload_b64).decode('utf-8'))
        except Exception:
            pass

    # Parse Access Token payload for realm/resource roles (standard Keycloak JWT)
    access_token_claims = {}
    if access_token and access_token.count('.') == 2:
        try:
            _, payload_b64, _ = access_token.split('.')
            access_token_claims = json.loads(_base64url_decode(payload_b64).decode('utf-8'))
        except Exception:
            pass

    # Merge user info and claims
    merged_claims = {**access_token_claims, **id_token_claims, **user_info}
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
    """
    # If token response dict was passed directly (contains access_token or id_token), unpack claims
    if "access_token" in claims or "id_token" in claims:
        unpacked = {}
        for k in ("access_token", "id_token"):
            tok = claims.get(k)
            if tok and isinstance(tok, str) and tok.count('.') == 2:
                try:
                    _, payload_b64, _ = tok.split('.')
                    payload_dict = json.loads(_base64url_decode(payload_b64).decode('utf-8'))
                    unpacked.update(payload_dict)
                except Exception:
                    pass
        claims = {**unpacked, **claims}

    external_id = claims.get("sub")
    email = claims.get("email")
    if not email:
        email = f"{external_id or 'user'}@oidc.local"
    email = email.strip().lower()

    full_name = (
        claims.get("name")
        or f"{claims.get('given_name', '')} {claims.get('family_name', '')}".strip()
        or claims.get("preferred_username")
        or email.split("@")[0]
    )
    username = claims.get("preferred_username") or email.split("@")[0]

    # Find existing user by external_id or email
    user = None
    if external_id:
        user = db.query(User).filter(User.external_id == external_id).first()
    if not user:
        user = db.query(User).filter(User.email.ilike(email)).first()

    auth_cfg = get_system_auth_settings(db)
    provider_label = auth_cfg.provider_name or "oidc"

    if not user:
        # Create new user
        user = User(
            id=str(uuid.uuid4()),
            username=username,
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
        # Update external_id and auth_provider if missing
        updated = False
        if not user.external_id and external_id:
            user.external_id = external_id
            updated = True
        if user.auth_provider == "local" and external_id:
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



def hash_password(password: str) -> str:
    """Generate salted PBKDF2-HMAC-SHA256 hash."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return f"{salt}${key.hex()}"


def verify_password(password: str, hashed_value: str) -> bool:
    """Verify plain password against stored salt$hash."""
    if not hashed_value or "$" not in hashed_value:
        return False
    try:
        salt, stored_hash = hashed_value.split("$", 1)
        key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return hmac.compare_digest(key.hex(), stored_hash)
    except Exception:
        return False


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')


def _base64url_decode(data: str) -> bytes:
    padding = '=' * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode((data + padding).encode('utf-8'))


def create_access_token(user: User) -> str:
    """Generate secure signed JWT-like token for user session."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user.id,
        "username": user.username or user.email,
        "email": user.email,
        "full_name": user.full_name,
        "auth_provider": user.auth_provider or "local",
        "exp": int(time.time()) + settings.TOKEN_EXPIRY_SECONDS,
        "iat": int(time.time())
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
    """Fetch active user from token."""
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    return user

