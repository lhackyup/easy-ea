from typing import Optional, List, Dict, Any, Tuple
import re
import json
import base64
import secrets
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.models.archimate import User, utc_now
from app.api.deps import get_current_user, require_admin, require_admin_or_viewer
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    get_user_from_token,
    get_oidc_authorization_url,
    exchange_oidc_code,
    provision_or_sync_oidc_user,
    get_system_auth_settings,
    update_system_auth_settings,
    test_idp_connection,
    validate_oidc_return_to,
    create_oidc_state,
    verify_oidc_state,
    login_rate_limiter,
    generate_totp_secret,
    get_totp_uri,
    generate_qr_code_svg,
    generate_qr_code_data_url,
    verify_totp_code,
    is_user_subject_to_mfa_policy,
    is_mfa_required_for_user,
    create_mfa_challenge_token,
    verify_mfa_challenge_token,
    verify_password,
    revoke_token
)
from app.services.audit_service import log_security_event

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str
    totp_code: Optional[str] = None


class LoginResponse(BaseModel):
    token: Optional[str] = None
    user: Optional[Dict[str, Any]] = None
    mfa_required: Optional[bool] = None
    mfa_setup_required: Optional[bool] = None
    mfa_token: Optional[str] = None
    secret: Optional[str] = None
    otpauth_url: Optional[str] = None
    qr_code_svg: Optional[str] = None
    qr_code_data_url: Optional[str] = None


class MfaVerifyRequest(BaseModel):
    mfa_token: str
    totp_code: str


class MfaEnableRequest(BaseModel):
    secret: str
    totp_code: str


class MfaDisableRequest(BaseModel):
    password: str


class SystemAuthSettingsUpdateRequest(BaseModel):
    allow_local_login: Optional[bool] = None
    allow_idp_login: Optional[bool] = None
    allow_mcp_access: Optional[bool] = None
    provider_name: Optional[str] = None
    issuer_url: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    scopes: Optional[str] = None
    prompt_login: Optional[bool] = None
    enable_single_logout: Optional[bool] = None
    rbac_mode: Optional[str] = None
    role_mappings: Optional[List[Dict[str, Any]]] = None
    max_schema_versions: Optional[int] = None
    mfa_policy: Optional[str] = None
    show_demo_banner: Optional[bool] = None
    demo_banner_message: Optional[str] = None
    demo_username: Optional[str] = None
    demo_password: Optional[str] = None


class IdpConnectionTestRequest(BaseModel):
    issuer_url: str


def _serialize_user(user: User) -> Dict[str, Any]:
    assignments = []
    for a in user.role_assignments:
        ws_code = a.workspace.code if a.workspace else None
        ws_name = a.workspace.name if a.workspace else None
        assignments.append({
            "id": a.id,
            "role": a.role,
            "model_id": a.model_id,
            "library_code": ws_code,
            "library_name": ws_name,
            "created_at": a.created_at.isoformat() if a.created_at else None
        })

    is_local = (user.auth_provider == "local" or user.external_id is None)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "auth_provider": user.auth_provider or "local",
        "is_active": user.is_active,
        "is_local": is_local,
        "is_mfa_enabled": bool(getattr(user, "is_mfa_enabled", False)),
        "mfa_enrolled_at": user.mfa_enrolled_at.isoformat() if getattr(user, "mfa_enrolled_at", None) else None,
        "assignments": assignments
    }


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticate user with username/email and password with rate limiting on failed attempts."""
    auth_cfg = get_system_auth_settings(db)
    if not auth_cfg.allow_local_login:
        raise HTTPException(
            status_code=403,
            detail="L'autenticazione con credenziali locali è disabilitata dall'amministratore. Utilizza il Single Sign-On."
        )

    client_ip = request.client.host if request.client else "127.0.0.1"
    rate_limit_key = f"{client_ip}:{payload.username.strip().lower()}"
    login_rate_limiter.check_rate_limit(rate_limit_key)

    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        login_rate_limiter.record_failure(rate_limit_key)
        log_security_event(
            db=db,
            action="AUTH_LOGIN",
            outcome="FAILURE",
            actor_username=payload.username.strip(),
            request=request,
            details={"reason": "invalid_credentials"}
        )
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password. Please check your credentials."
        )

    # Check MFA requirement for local user
    mfa_required, is_enforced = is_mfa_required_for_user(user, db)

    if mfa_required:
        # Case A: User has enrolled MFA already
        if user.is_mfa_enabled and user.totp_secret:
            if payload.totp_code:
                if verify_totp_code(user.totp_secret, payload.totp_code):
                    login_rate_limiter.record_success(rate_limit_key)
                    token = create_access_token(user)
                    log_security_event(
                        db=db,
                        action="AUTH_LOGIN",
                        outcome="SUCCESS",
                        actor=user,
                        request=request,
                        details={"auth_method": "password_totp"}
                    )
                    return {
                        "token": token,
                        "user": _serialize_user(user)
                    }
                else:
                    login_rate_limiter.record_failure(rate_limit_key)
                    log_security_event(
                        db=db,
                        action="AUTH_MFA_VERIFY",
                        outcome="FAILURE",
                        actor=user,
                        request=request,
                        details={"reason": "invalid_totp_code"}
                    )
                    raise HTTPException(
                        status_code=401,
                        detail="Codice MFA / TOTP non valido o scaduto."
                    )
            else:
                # Issue challenge token for step 2
                mfa_token = create_mfa_challenge_token(user.id, user.username or user.email)
                log_security_event(
                    db=db,
                    action="AUTH_MFA_CHALLENGE",
                    outcome="SUCCESS",
                    actor=user,
                    request=request,
                    details={"setup_required": False}
                )
                return {
                    "mfa_required": True,
                    "mfa_setup_required": False,
                    "mfa_token": mfa_token,
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "full_name": user.full_name
                    }
                }
        else:
            # Case B: User has NOT enrolled yet, but MFA is required by policy!
            temp_secret = generate_totp_secret()
            otpauth_url = get_totp_uri(temp_secret, user.username or user.email)
            qr_svg = generate_qr_code_svg(otpauth_url)
            qr_data_url = generate_qr_code_data_url(otpauth_url)
            mfa_token = create_mfa_challenge_token(user.id, user.username or user.email, pending_secret=temp_secret)
            log_security_event(
                db=db,
                action="AUTH_MFA_CHALLENGE",
                outcome="SUCCESS",
                actor=user,
                request=request,
                details={"setup_required": True}
            )
            return {
                "mfa_required": True,
                "mfa_setup_required": True,
                "mfa_token": mfa_token,
                "secret": temp_secret,
                "otpauth_url": otpauth_url,
                "qr_code_svg": qr_svg,
                "qr_code_data_url": qr_data_url,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "full_name": user.full_name
                }
            }

    login_rate_limiter.record_success(rate_limit_key)
    token = create_access_token(user)
    log_security_event(
        db=db,
        action="AUTH_LOGIN",
        outcome="SUCCESS",
        actor=user,
        request=request,
        details={"auth_method": "password"}
    )
    return {
        "token": token,
        "user": _serialize_user(user)
    }


@router.post("/login/mfa", response_model=LoginResponse)
def login_mfa(payload: MfaVerifyRequest, request: Request, db: Session = Depends(get_db)):
    """Second step of MFA authentication or initial mandatory MFA enrollment."""
    challenge = verify_mfa_challenge_token(payload.mfa_token)
    if not challenge:
        raise HTTPException(
            status_code=401,
            detail="Sessione di verifica MFA scaduta o non valida. Riprova il login."
        )

    client_ip = request.client.host if request.client else "127.0.0.1"
    rate_limit_key = f"{client_ip}:{challenge.get('username', 'mfa')}"
    login_rate_limiter.check_rate_limit(rate_limit_key)

    user = db.query(User).filter(User.id == challenge["sub"], User.is_active == True).first()
    if not user:
        login_rate_limiter.record_failure(rate_limit_key)
        raise HTTPException(status_code=401, detail="Utente non trovato o disattivato.")

    pending_secret = challenge.get("pending_secret")
    if pending_secret:
        # Mandatory initial enrollment verification
        if not verify_totp_code(pending_secret, payload.totp_code):
            login_rate_limiter.record_failure(rate_limit_key)
            log_security_event(
                db=db,
                action="AUTH_MFA_VERIFY",
                outcome="FAILURE",
                actor=user,
                request=request,
                details={"reason": "invalid_totp_code", "phase": "initial_enrollment"}
            )
            raise HTTPException(
                status_code=401,
                detail="Codice TOTP non valido. Inserisci il codice a 6 cifre mostrato sulla tua app e riprova."
            )

        user.totp_secret = pending_secret
        user.is_mfa_enabled = True
        user.mfa_enrolled_at = utc_now()
        db.commit()
        db.refresh(user)
    else:
        # Standard TOTP verification
        if not user.is_mfa_enabled or not user.totp_secret:
            raise HTTPException(status_code=400, detail="MFA non configurata per questo account.")

        if not verify_totp_code(user.totp_secret, payload.totp_code):
            login_rate_limiter.record_failure(rate_limit_key)
            log_security_event(
                db=db,
                action="AUTH_MFA_VERIFY",
                outcome="FAILURE",
                actor=user,
                request=request,
                details={"reason": "invalid_totp_code", "phase": "login"}
            )
            raise HTTPException(
                status_code=401,
                detail="Codice TOTP non valido o scaduto."
            )

    login_rate_limiter.record_success(rate_limit_key)
    token = create_access_token(user)
    log_security_event(
        db=db,
        action="AUTH_MFA_VERIFY",
        outcome="SUCCESS",
        actor=user,
        request=request,
        details={"initial_enrollment": pending_secret is not None}
    )
    return {
        "token": token,
        "user": _serialize_user(user)
    }


# ============================================================================
# User Self-Service MFA Management (Authenticated)
# ============================================================================

@router.get("/mfa/status")
def get_user_mfa_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves 2FA status and policy enforcement for the authenticated user."""
    auth_cfg = get_system_auth_settings(db)
    is_local = (current_user.auth_provider == "local" or current_user.external_id is None)
    enforced = is_user_subject_to_mfa_policy(current_user, getattr(auth_cfg, "mfa_policy", "disabled"))

    return {
        "is_local": is_local,
        "is_mfa_enabled": bool(current_user.is_mfa_enabled),
        "mfa_enrolled_at": current_user.mfa_enrolled_at.isoformat() if current_user.mfa_enrolled_at else None,
        "mfa_policy": getattr(auth_cfg, "mfa_policy", "disabled"),
        "is_enforced": enforced
    }


@router.post("/mfa/setup")
def setup_user_mfa(
    current_user: User = Depends(get_current_user)
):
    """Initializes MFA setup by generating a Base32 secret, otpauth URI and QR Code."""
    if current_user.auth_provider and current_user.auth_provider != "local" and current_user.external_id:
        raise HTTPException(
            status_code=400,
            detail="Gli account federati (SSO) devono configurare l'MFA direttamente sul proprio Identity Provider aziendale (Keycloak)."
        )

    secret = generate_totp_secret()
    otpauth_url = get_totp_uri(secret, current_user.username or current_user.email)
    qr_svg = generate_qr_code_svg(otpauth_url)
    qr_data_url = generate_qr_code_data_url(otpauth_url)

    return {
        "secret": secret,
        "otpauth_url": otpauth_url,
        "qr_code_svg": qr_svg,
        "qr_code_data_url": qr_data_url
    }


@router.post("/mfa/enable")
def enable_user_mfa(
    payload: MfaEnableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verifies the TOTP code and activates MFA on the user account."""
    if current_user.auth_provider and current_user.auth_provider != "local" and current_user.external_id:
        raise HTTPException(
            status_code=400,
            detail="Operazione non consentita per account federati SSO."
        )

    if not verify_totp_code(payload.secret, payload.totp_code):
        raise HTTPException(
            status_code=400,
            detail="Codice di verifica non valido. Verifica l'orario del dispositivo e riprova."
        )

    current_user.totp_secret = payload.secret
    current_user.is_mfa_enabled = True
    current_user.mfa_enrolled_at = utc_now()
    db.commit()
    db.refresh(current_user)

    log_security_event(
        db=db,
        action="AUTH_MFA_ENROLLED",
        outcome="SUCCESS",
        actor=current_user,
        details={"method": "totp_rfc6238"}
    )

    return {
        "success": True,
        "message": "Autenticazione a due fattori (2FA) attivata con successo sul tuo account."
    }


@router.post("/mfa/disable")
def disable_user_mfa(
    payload: MfaDisableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disables MFA if permitted by the global security policy."""
    auth_cfg = get_system_auth_settings(db)
    if is_user_subject_to_mfa_policy(current_user, getattr(auth_cfg, "mfa_policy", "disabled")):
        raise HTTPException(
            status_code=403,
            detail="Impossibile disattivare la 2FA: è richiesta obbligatoriamente per il tuo ruolo dalla policy aziendale."
        )

    if not verify_password(payload.password, current_user.password_hash or ""):
        raise HTTPException(
            status_code=401,
            detail="Password non corretta. Inserisci la tua password attuale per confermare la disattivazione."
        )

    current_user.totp_secret = None
    current_user.is_mfa_enabled = False
    current_user.mfa_enrolled_at = None
    db.commit()
    db.refresh(current_user)

    log_security_event(
        db=db,
        action="AUTH_MFA_DISABLED",
        outcome="SUCCESS",
        actor=current_user
    )

    return {
        "success": True,
        "message": "Autenticazione a due fattori disattivata."
    }


@router.get("/me")
def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Retrieve profile and roles of currently authenticated user."""
    return _serialize_user(current_user)


class LogoutRequest(BaseModel):
    token: Optional[str] = None


@router.post("/logout")
def logout(
    request: Request,
    payload: Optional[LogoutRequest] = None,
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Client logout and token revocation endpoint (JTI Blacklist in database).
    Invalidates current session token so it cannot be reused.
    """
    raw_token: Optional[str] = None
    if authorization and authorization.startswith("Bearer "):
        raw_token = authorization.split("Bearer ", 1)[1].strip()
    elif payload and payload.token:
        raw_token = payload.token.strip()
    elif token:
        raw_token = token.strip()

    actor_user = None
    if raw_token:
        actor_user = get_user_from_token(db, raw_token)
        revoke_token(db, raw_token, reason="logout")

    log_security_event(
        db=db,
        action="AUTH_LOGOUT",
        outcome="SUCCESS",
        actor=actor_user,
        request=request,
        details={"token_revoked": raw_token is not None}
    )

    return {"success": True, "message": "Logged out successfully. Token revoked."}


# ============================================================================
# OIDC / OAuth2 Public & Flow Endpoints
# ============================================================================

def _resolve_demo_credentials(auth_cfg) -> Tuple[str, str]:
    """
    Extracts demo username and password, with intelligent fallback parsing
    if custom credentials were included in demo_banner_message.
    """
    username = getattr(auth_cfg, "demo_username", None) or "demo"
    password = getattr(auth_cfg, "demo_password", None) or "EasyEA2026!"
    msg = getattr(auth_cfg, "demo_banner_message", None) or ""

    if (username == "demo" or password == "EasyEA2026!") and msg:
        u_match = re.search(r'(?:username|utente|user)\s*:\s*([^\s|;,]+)', msg, re.IGNORECASE)
        if u_match and username == "demo":
            username = u_match.group(1).strip()
        p_match = re.search(r'(?:password|pwd)\s*:\s*([^\s|;,]+)', msg, re.IGNORECASE)
        if p_match and password == "EasyEA2026!":
            password = p_match.group(1).strip()

    return username, password


@router.get("/oidc/config")
def get_oidc_public_config(db: Session = Depends(get_db)):
    """Returns the IdP and OIDC configuration for the frontend UI."""
    auth_cfg = get_system_auth_settings(db)
    demo_user, demo_pwd = _resolve_demo_credentials(auth_cfg)
    return {
        "allow_local_login": auth_cfg.allow_local_login,
        "allow_idp_login": auth_cfg.allow_idp_login,
        "enabled": auth_cfg.allow_idp_login,
        "provider_name": auth_cfg.provider_name,
        "issuer_url": auth_cfg.issuer_url,
        "login_url": "/api/auth/oidc/login",
        "prompt_login": auth_cfg.prompt_login,
        "enable_single_logout": auth_cfg.enable_single_logout,
        "rbac_mode": auth_cfg.rbac_mode,
        "mfa_policy": getattr(auth_cfg, "mfa_policy", "disabled") or "disabled",
        "demo_mode": False,
        "show_demo_banner": getattr(auth_cfg, "show_demo_banner", True) if getattr(auth_cfg, "show_demo_banner", None) is not None else True,
        "demo_banner_message": getattr(auth_cfg, "demo_banner_message", None) or "Accesso Demo (Sola Lettura) - Username: demo | Password: EasyEA2026!",
        "demo_username": demo_user,
        "demo_password": demo_pwd
    }


@router.get("/oidc/login")
def oidc_login_redirect(
    request: Request,
    state: Optional[str] = Query(None),
    return_to: Optional[str] = Query(None),
    prompt: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Redirects the user to the Identity Provider login page."""
    auth_cfg = get_system_auth_settings(db)
    if not auth_cfg.allow_idp_login:
        raise HTTPException(status_code=403, detail="L'autenticazione tramite Identity Provider esterno è disabilitata.")

    # Determine and strictly validate caller's origin for return redirection
    referer = request.headers.get("referer") or ""
    origin = request.headers.get("origin") or ""
    base_url = str(request.base_url).rstrip('/')

    if return_to:
        try:
            caller_origin = validate_oidc_return_to(return_to, base_url=base_url, strict=True)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    else:
        fallback_candidate = origin or (referer.split('?')[0].rstrip('/') if referer else base_url)
        caller_origin = validate_oidc_return_to(fallback_candidate, base_url=base_url, strict=False)

    encoded_state = create_oidc_state(caller_origin, base_url=base_url)

    auth_url = get_oidc_authorization_url(db=db, state=encoded_state, prompt=prompt)
    return RedirectResponse(url=auth_url, status_code=302)


# ============================================================================
# Admin Configuration & IdP Management Endpoints
# ============================================================================

@router.get("/admin/config")
def get_admin_auth_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_viewer)
):
    """Returns the full auth and IdP settings including role mappings (Admin endpoint)."""
    cfg = get_system_auth_settings(db)
    demo_user, demo_pwd = _resolve_demo_credentials(cfg)
    return {
        "allow_local_login": cfg.allow_local_login,
        "allow_idp_login": cfg.allow_idp_login,
        "allow_mcp_access": getattr(cfg, "allow_mcp_access", True),
        "provider_name": cfg.provider_name,
        "issuer_url": cfg.issuer_url,
        "client_id": cfg.client_id,
        "client_secret": "********" if cfg.client_secret else "",
        "scopes": cfg.scopes,
        "prompt_login": cfg.prompt_login,
        "enable_single_logout": cfg.enable_single_logout,
        "rbac_mode": cfg.rbac_mode,
        "mfa_policy": getattr(cfg, "mfa_policy", "disabled") or "disabled",
        "show_demo_banner": getattr(cfg, "show_demo_banner", True) if getattr(cfg, "show_demo_banner", None) is not None else True,
        "demo_banner_message": getattr(cfg, "demo_banner_message", None) or "Accesso Demo (Sola Lettura) - Username: demo | Password: EasyEA2026!",
        "demo_username": demo_user,
        "demo_password": demo_pwd,
        "role_mappings": cfg.role_mappings or []
    }


@router.put("/admin/config")
def update_admin_auth_config(
    payload: SystemAuthSettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Updates auth and IdP settings and role mappings (Admin endpoint)."""
    try:
        updated = update_system_auth_settings(db, payload.model_dump(exclude_unset=True))
        demo_user, demo_pwd = _resolve_demo_credentials(updated)
        return {
            "status": "success",
            "message": "Configurazione di autenticazione e mapping ruoli salvata con successo.",
            "config": {
                "allow_local_login": updated.allow_local_login,
                "allow_idp_login": updated.allow_idp_login,
                "allow_mcp_access": getattr(updated, "allow_mcp_access", True),
                "provider_name": updated.provider_name,
                "issuer_url": updated.issuer_url,
                "client_id": updated.client_id,
                "client_secret": "********" if updated.client_secret else "",
                "scopes": updated.scopes,
                "prompt_login": updated.prompt_login,
                "enable_single_logout": updated.enable_single_logout,
                "rbac_mode": updated.rbac_mode,
                "mfa_policy": getattr(updated, "mfa_policy", "disabled") or "disabled",
                "show_demo_banner": getattr(updated, "show_demo_banner", True) if getattr(updated, "show_demo_banner", None) is not None else True,
                "demo_banner_message": getattr(updated, "demo_banner_message", None) or "Accesso Demo (Sola Lettura) - Username: demo | Password: EasyEA2026!",
                "demo_username": demo_user,
                "demo_password": demo_pwd,
                "role_mappings": updated.role_mappings or []
            }
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Errore durante il salvataggio: {str(exc)}")


@router.post("/admin/test-connection")
def test_idp_connectivity(
    payload: IdpConnectionTestRequest,
    current_user: User = Depends(require_admin)
):
    """Tests connectivity and discovery metadata against the provided IdP Issuer URL."""
    return test_idp_connection(payload.issuer_url)



@router.get("/oidc/callback")
def oidc_callback(
    request: Request,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    format: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Handles the OAuth2 redirect callback from the IdP.
    Verifies HMAC-signed state, exchanges code for cryptographically verified tokens,
    provisions/syncs the user, and redirects only to allowlisted origins.
    """
    base_url = str(request.base_url).rstrip('/')
    default_frontend = settings.OIDC_FRONTEND_REDIRECT_URL.rstrip('/')

    try:
        state_data = verify_oidc_state(state, base_url=base_url)
        target_frontend = state_data["return_to"]
    except ValueError as state_err:
        if format == "json" or "application/json" in request.headers.get("accept", ""):
            raise HTTPException(status_code=400, detail=f"OIDC State Validation Error: {str(state_err)}")
        return RedirectResponse(
            url=f"{default_frontend}/?auth_error={urllib.parse.quote(str(state_err))}",
            status_code=302
        )

    if error:
        err_msg = error_description or error
        if format == "json":
            raise HTTPException(status_code=400, detail=f"IdP Authentication Error: {err_msg}")
        return RedirectResponse(
            url=f"{target_frontend}/?auth_error={urllib.parse.quote(err_msg)}",
            status_code=302
        )

    if not code:
        if format == "json":
            raise HTTPException(status_code=400, detail="Missing authorization code.")
        return RedirectResponse(
            url=f"{target_frontend}/?auth_error={urllib.parse.quote('Missing authorization code')}",
            status_code=302
        )

    try:
        # Exchange code for cryptographically verified tokens & claims
        token_info = exchange_oidc_code(code, db=db)
        claims = token_info.get("claims", {})

        # Provision or sync user in EasyEA with hybrid role mapping
        user = provision_or_sync_oidc_user(db, claims)

        # Generate local EasyEA session token
        session_token = create_access_token(user)

        log_security_event(
            db=db,
            action="AUTH_LOGIN_SSO",
            outcome="SUCCESS",
            actor=user,
            request=request,
            details={"provider": token_info.get("provider", "oidc")}
        )

        if format == "json" or "application/json" in request.headers.get("accept", ""):
            return {
                "token": session_token,
                "user": _serialize_user(user)
            }

        # Redirect user back to the origin frontend with session token
        separator = "&" if "?" in target_frontend else "?"
        return RedirectResponse(
            url=f"{target_frontend}{separator}token={session_token}",
            status_code=302
        )

    except Exception as exc:
        log_security_event(
            db=db,
            action="AUTH_LOGIN_SSO",
            outcome="FAILURE",
            request=request,
            details={"reason": str(exc)}
        )
        if format == "json":
            raise HTTPException(status_code=500, detail=f"OIDC Token Exchange Error: {str(exc)}")
        separator = "&" if "?" in target_frontend else "?"
        return RedirectResponse(
            url=f"{target_frontend}{separator}auth_error={urllib.parse.quote(str(exc))}",
            status_code=302
        )


