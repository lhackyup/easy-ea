from typing import Optional, List, Dict, Any
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
from app.models.archimate import User
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    get_user_from_token,
    get_oidc_authorization_url,
    exchange_oidc_code,
    provision_or_sync_oidc_user,
    get_system_auth_settings,
    update_system_auth_settings,
    test_idp_connection
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: Dict[str, Any]


class SystemAuthSettingsUpdateRequest(BaseModel):
    allow_local_login: Optional[bool] = None
    allow_idp_login: Optional[bool] = None
    provider_name: Optional[str] = None
    issuer_url: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    scopes: Optional[str] = None
    prompt_login: Optional[bool] = None
    enable_single_logout: Optional[bool] = None
    rbac_mode: Optional[str] = None
    role_mappings: Optional[List[Dict[str, Any]]] = None


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

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "auth_provider": user.auth_provider or "local",
        "is_active": user.is_active,
        "assignments": assignments
    }


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user with username/email and password."""
    auth_cfg = get_system_auth_settings(db)
    if not auth_cfg.allow_local_login:
        raise HTTPException(
            status_code=403,
            detail="L'autenticazione con credenziali locali è disabilitata dall'amministratore. Utilizza il Single Sign-On."
        )

    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password. Please check your credentials."
        )

    token = create_access_token(user)
    return {
        "token": token,
        "user": _serialize_user(user)
    }


@router.get("/me")
def get_current_user_profile(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Retrieve profile and roles of currently authenticated user."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")

    token = authorization.split("Bearer ", 1)[1].strip()
    user = get_user_from_token(db, token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session token.")

    return _serialize_user(user)


@router.post("/logout")
def logout():
    """Client logout confirmation endpoint."""
    return {"success": True, "message": "Logged out successfully."}


# ============================================================================
# OIDC / OAuth2 Public & Flow Endpoints
# ============================================================================

@router.get("/oidc/config")
def get_oidc_public_config(db: Session = Depends(get_db)):
    """Returns the IdP and OIDC configuration for the frontend UI."""
    auth_cfg = get_system_auth_settings(db)
    return {
        "allow_local_login": auth_cfg.allow_local_login,
        "allow_idp_login": auth_cfg.allow_idp_login,
        "enabled": auth_cfg.allow_idp_login,
        "provider_name": auth_cfg.provider_name,
        "issuer_url": auth_cfg.issuer_url,
        "login_url": "/api/auth/oidc/login",
        "prompt_login": auth_cfg.prompt_login,
        "enable_single_logout": auth_cfg.enable_single_logout,
        "rbac_mode": auth_cfg.rbac_mode
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

    # Determine caller's origin for return redirection
    referer = request.headers.get("referer") or ""
    origin = request.headers.get("origin") or ""
    base_url = str(request.base_url).rstrip('/')
    
    caller_origin = return_to or origin or (referer.split('?')[0].rstrip('/') if referer else base_url)
    if caller_origin.endswith("/api") or caller_origin.endswith("/api/auth"):
        caller_origin = base_url

    state_data = {
        "return_to": caller_origin,
        "nonce": secrets.token_hex(8)
    }
    encoded_state = base64.urlsafe_b64encode(json.dumps(state_data).encode('utf-8')).decode('utf-8').rstrip('=')

    auth_url = get_oidc_authorization_url(db=db, state=encoded_state, prompt=prompt)
    return RedirectResponse(url=auth_url, status_code=302)


# ============================================================================
# Admin Configuration & IdP Management Endpoints
# ============================================================================

@router.get("/admin/config")
def get_admin_auth_config(db: Session = Depends(get_db)):
    """Returns the full auth and IdP settings including role mappings (Admin endpoint)."""
    cfg = get_system_auth_settings(db)
    return {
        "allow_local_login": cfg.allow_local_login,
        "allow_idp_login": cfg.allow_idp_login,
        "provider_name": cfg.provider_name,
        "issuer_url": cfg.issuer_url,
        "client_id": cfg.client_id,
        "client_secret": cfg.client_secret,
        "scopes": cfg.scopes,
        "prompt_login": cfg.prompt_login,
        "enable_single_logout": cfg.enable_single_logout,
        "rbac_mode": cfg.rbac_mode,
        "role_mappings": cfg.role_mappings or []
    }


@router.put("/admin/config")
def update_admin_auth_config(
    payload: SystemAuthSettingsUpdateRequest,
    db: Session = Depends(get_db)
):
    """Updates auth and IdP settings and role mappings (Admin endpoint)."""
    try:
        updated = update_system_auth_settings(db, payload.model_dump(exclude_unset=True))
        return {
            "status": "success",
            "message": "Configurazione di autenticazione e mapping ruoli salvata con successo.",
            "config": {
                "allow_local_login": updated.allow_local_login,
                "allow_idp_login": updated.allow_idp_login,
                "provider_name": updated.provider_name,
                "issuer_url": updated.issuer_url,
                "client_id": updated.client_id,
                "client_secret": updated.client_secret,
                "scopes": updated.scopes,
                "prompt_login": updated.prompt_login,
                "enable_single_logout": updated.enable_single_logout,
                "rbac_mode": updated.rbac_mode,
                "role_mappings": updated.role_mappings or []
            }
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Errore durante il salvataggio: {str(exc)}")


@router.post("/admin/test-connection")
def test_idp_connectivity(payload: IdpConnectionTestRequest):
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
    Exchanges code for tokens, provisions/syncs the user, and redirects to frontend with session token.
    """
    # Extract caller origin from state
    target_frontend = settings.OIDC_FRONTEND_REDIRECT_URL.rstrip('/')
    if state:
        try:
            padding = '=' * ((4 - len(state) % 4) % 4)
            decoded_json = base64.urlsafe_b64decode((state + padding).encode('utf-8')).decode('utf-8')
            state_data = json.loads(decoded_json)
            if state_data.get("return_to"):
                target_frontend = state_data["return_to"].rstrip('/')
        except Exception:
            pass

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
        # Exchange code for tokens & claims
        token_info = exchange_oidc_code(code)
        claims = token_info.get("claims", {})

        # Provision or sync user in EasyEA with hybrid role mapping
        user = provision_or_sync_oidc_user(db, claims)

        # Generate local EasyEA session token
        session_token = create_access_token(user)

        if format == "json" or "application/json" in request.headers.get("accept", ""):
            return {
                "token": session_token,
                "user": _serialize_user(user)
            }

        # Redirect user back to the origin frontend with session token
        return RedirectResponse(
            url=f"{target_frontend}/?token={session_token}",
            status_code=302
        )

    except Exception as exc:
        if format == "json":
            raise HTTPException(status_code=500, detail=f"OIDC Token Exchange Error: {str(exc)}")
        return RedirectResponse(
            url=f"{target_frontend}/?auth_error={urllib.parse.quote(str(exc))}",
            status_code=302
        )


