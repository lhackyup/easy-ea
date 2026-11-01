from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.models.archimate import User, SecurityAuditLog
from app.api.deps import require_admin, require_admin_or_viewer
from app.services.audit_service import (
    query_audit_logs,
    verify_audit_trail,
    get_audit_summary,
    log_security_event
)

router = APIRouter(prefix="/admin/audit-logs", tags=["Security Audit"])


def _serialize_audit_log(log: SecurityAuditLog) -> Dict[str, Any]:
    return {
        "id": log.id,
        "sequence_number": log.sequence_number,
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        "event_id": log.event_id,
        "action": log.action,
        "outcome": log.outcome,
        "actor_id": log.actor_id,
        "actor_username": log.actor_username,
        "actor_role": log.actor_role,
        "ip_address": log.ip_address,
        "user_agent": log.user_agent,
        "target_type": log.target_type,
        "target_id": log.target_id,
        "details": log.details or {},
        "prev_hash": log.prev_hash,
        "current_hash": log.current_hash
    }


@router.get("")
def list_security_audit_logs(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    outcome: Optional[str] = Query(None),
    actor_id: Optional[str] = Query(None),
    target_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(require_admin_or_viewer),
    db: Session = Depends(get_db)
):
    """
    List paginated security audit logs with optional filters (requires Admin or Viewer role).
    """
    items, total = query_audit_logs(
        db=db,
        page=page,
        size=size,
        action=action,
        outcome=outcome,
        actor_id=actor_id,
        target_type=target_type,
        search=search
    )
    return {
        "items": [_serialize_audit_log(item) for item in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if size > 0 else 1
    }


@router.get("/verify")
def verify_audit_trail_integrity(
    current_user: User = Depends(require_admin_or_viewer),
    db: Session = Depends(get_db)
):
    """
    Cryptographically verifies the cryptographic SHA-256 hash chain of the audit trail.
    Detects if any record was modified, added out-of-order, or deleted.
    """
    result = verify_audit_trail(db)
    return result


@router.get("/summary")
def get_audit_trail_summary(
    current_user: User = Depends(require_admin_or_viewer),
    db: Session = Depends(get_db)
):
    """
    Returns summary metrics (total events, 24h failure count, top action types).
    """
    return get_audit_summary(db)
