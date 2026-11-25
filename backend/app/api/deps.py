import io
import zipfile
import hashlib
from typing import Optional, Dict, Any
from fastapi import Depends, Header, HTTPException, Query, UploadFile, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.archimate import User
from app.services.auth_service import get_user_from_token, get_system_auth_settings, decode_access_token, is_token_revoked
from app.services.api_key_service import verify_api_key
from app.services.rbac_service import check_user_permission
from app.services.audit_service import log_security_event


def get_current_user(
    request: Request = None,
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_mcp_agent: Optional[str] = Header(None, alias="X-MCP-Agent"),
    token: Optional[str] = Query(None, include_in_schema=False),
    db: Session = Depends(get_db)
) -> User:
    """
    Validates caller authentication via:
    1. 'X-API-Key' header or 'Bearer eea_live_...' (B2B & AI Agent authentication)
    2. Bearer JWT token in 'Authorization' header or query token for downloads (User session)
    Also verifies whether MCP access is globally permitted if X-MCP-Agent header is set.
    Returns the authenticated active User.
    """
    # Verify MCP access setting if caller is an MCP agent
    if x_mcp_agent and x_mcp_agent.strip().lower() in ("true", "1", "yes"):
        auth_cfg = get_system_auth_settings(db)
        if not getattr(auth_cfg, "allow_mcp_access", True):
            raise HTTPException(
                status_code=403,
                detail="L'accesso tramite MCP (Model Context Protocol) è disabilitato dall'amministratore."
            )

    # 1. API Key Check (M2M / Agent)
    api_key_candidate = x_api_key
    if not api_key_candidate and authorization and authorization.startswith("Bearer eea_live_"):
        api_key_candidate = authorization.split("Bearer ", 1)[1].strip()

    if api_key_candidate:
        user = verify_api_key(db, api_key_candidate)
        if not user or not user.is_active:
            log_security_event(
                db=db,
                action="AUTH_API_KEY",
                outcome="FAILURE",
                request=request,
                details={
                    "prefix": api_key_candidate[:12] if len(api_key_candidate) >= 12 else "invalid",
                    "reason": "invalid_or_expired_key"
                }
            )
            raise HTTPException(status_code=401, detail="Invalid or expired API Key.")
        return user

    # 2. JWT Session Token Check
    raw_token: Optional[str] = None
    if authorization and authorization.startswith("Bearer "):
        raw_token = authorization.split("Bearer ", 1)[1].strip()
    elif token:
        raw_token = token.strip()

    if not raw_token:
        raise HTTPException(status_code=401, detail="Authentication required.")

    payload = decode_access_token(raw_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired session token.")

    jti = payload.get("jti") or hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
    if is_token_revoked(db, jti):
        log_security_event(
            db=db,
            action="AUTH_TOKEN_REVOKED_ATTEMPT",
            outcome="DENIED",
            actor_id=payload.get("sub"),
            details={"jti": jti}
        )
        raise HTTPException(status_code=401, detail="Token revoked. Session terminated.")

    user = get_user_from_token(db, raw_token)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User account not found or deactivated.")

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Ensures the authenticated user holds the Global System Administrator ('admin') role.
    """
    if not any(a.role == "admin" for a in current_user.role_assignments):
        raise HTTPException(
            status_code=403,
            detail="Global System Administrator privileges required."
        )
    return current_user


def require_admin_or_viewer(current_user: User = Depends(get_current_user)) -> User:
    """
    Ensures the authenticated user holds either the 'admin' or global 'viewer' (demo) role.
    Used for read-only inspection endpoints in Administration Hub (view users, view system status, view auth config).
    """
    if not any(a.role in ("admin", "viewer") for a in current_user.role_assignments):
        raise HTTPException(
            status_code=403,
            detail="Administrator or Viewer privileges required."
        )
    return current_user


def require_library_permission(
    db: Session,
    user: User,
    action: str,
    target_model_id: Optional[str],
    element_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Enforces library-scoped RBAC permission for the specified action and target_model_id.
    Raises HTTP 403 if the user is not authorized.
    """
    res = check_user_permission(
        db,
        user_id=user.id,
        action=action,
        target_model_id=target_model_id,
        element_id=element_id
    )
    if not res.get("allowed"):
        raise HTTPException(
            status_code=403,
            detail=res.get("reason", "Permission denied for this library workspace.")
        )
    return res


async def read_upload_bounded(
    file: UploadFile,
    max_bytes: Optional[int] = None,
) -> bytes:
    """
    Reads an UploadFile in bounded chunks and rejects payloads exceeding max_bytes
    with HTTP 413 Payload Too Large before exhausting server RAM (SAST-HIGH-06).
    """
    limit = max_bytes if max_bytes is not None else settings.MAX_UPLOAD_BYTES
    chunk_size = 64 * 1024
    buffer = bytearray()

    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        buffer.extend(chunk)
        if len(buffer) > limit:
            limit_mb = round(limit / (1024 * 1024), 2)
            raise HTTPException(
                status_code=413,
                detail=f"Uploaded file exceeds maximum allowed size ({limit_mb} MB).",
            )

    return bytes(buffer)


def validate_zip_archive_safety(
    raw_bytes: bytes,
    max_uncompressed_bytes: Optional[int] = None,
    max_entries: Optional[int] = None,
) -> None:
    """
    Inspects ZIP/OOXML (.zip / .xlsx) headers to block Zip Bombs, excessive entry counts,
    extreme compression ratios, and Zip-Slip path traversal before extraction (SAST-HIGH-06).
    """
    uncompressed_limit = (
        max_uncompressed_bytes
        if max_uncompressed_bytes is not None
        else settings.MAX_UNCOMPRESSED_ZIP_BYTES
    )
    entries_limit = max_entries if max_entries is not None else settings.MAX_ZIP_ENTRIES

    try:
        with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
            infos = zf.infolist()
            if len(infos) > entries_limit:
                raise HTTPException(
                    status_code=413,
                    detail=f"Archive contains too many entries ({len(infos)} > {entries_limit}).",
                )

            total_uncompressed = 0
            for info in infos:
                norm_name = info.filename.replace("\\", "/")
                if norm_name.startswith("/") or ".." in norm_name.split("/"):
                    raise HTTPException(
                        status_code=400,
                        detail="Archive contains unsafe relative path traversal entries.",
                    )
                total_uncompressed += info.file_size
                if total_uncompressed > uncompressed_limit:
                    limit_mb = round(uncompressed_limit / (1024 * 1024), 2)
                    raise HTTPException(
                        status_code=413,
                        detail=f"Archive uncompressed size exceeds maximum allowed limit ({limit_mb} MB).",
                    )
                if info.file_size > 1024 * 1024:
                    ratio = info.file_size / max(info.compress_size, 1)
                    if ratio > 100.0:
                        raise HTTPException(
                            status_code=413,
                            detail="Suspicious archive compression ratio detected (potential Zip Bomb).",
                        )
    except HTTPException:
        raise
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail=f"Invalid or corrupted ZIP/Excel archive: {exc}")
