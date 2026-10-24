import io
import zipfile
from typing import Optional, Dict, Any
from fastapi import Depends, Header, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.archimate import User
from app.services.auth_service import get_user_from_token
from app.services.rbac_service import check_user_permission


def get_current_user(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None, include_in_schema=False),
    db: Session = Depends(get_db)
) -> User:
    """
    Validates the caller's Bearer JWT token (from Authorization header or query token for direct file downloads)
    and returns the authenticated active User.
    """
    raw_token: Optional[str] = None
    if authorization and authorization.startswith("Bearer "):
        raw_token = authorization.split("Bearer ", 1)[1].strip()
    elif token:
        raw_token = token.strip()

    if not raw_token:
        raise HTTPException(status_code=401, detail="Authentication required.")

    user = get_user_from_token(db, raw_token)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid or expired session token.")

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


def require_library_permission(
    db: Session,
    user: User,
    action: str,
    target_model_id: Optional[str]
) -> Dict[str, Any]:
    """
    Enforces library-scoped RBAC permission for the specified action and target_model_id.
    Raises HTTP 403 if the user is not authorized.
    """
    res = check_user_permission(
        db,
        user_id=user.id,
        action=action,
        target_model_id=target_model_id
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
