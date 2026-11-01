import json
import logging
import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import Request

from app.models.archimate import SecurityAuditLog, User

logger = logging.getLogger("easyea.security.audit")
# Ensure standard formatting if no specific handler configured
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('{"time": "%(asctime)s", "logger": "%(name)s", "level": "%(levelname)s", "message": %(message)s}')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

GENESIS_HASH = "0" * 64

SENSITIVE_KEYS = {
    "password", "pwd", "secret", "token", "totp", "totp_secret", 
    "mfa_token", "api_key", "key", "access_token", "refresh_token",
    "client_secret", "authorization", "hashed_key"
}


def sanitize_details(data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Recursively sanitize sensitive fields (passwords, tokens, keys) from audit metadata."""
    if not data:
        return {}
    clean: Dict[str, Any] = {}
    for k, v in data.items():
        k_lower = str(k).lower()
        if k_lower in SENSITIVE_KEYS or any(s in k_lower for s in ("password", "secret", "token")):
            clean[k] = "[REDACTED]"
        elif isinstance(v, dict):
            clean[k] = sanitize_details(v)
        elif isinstance(v, list):
            clean[k] = [sanitize_details(i) if isinstance(i, dict) else i for i in v]
        else:
            clean[k] = v
    return clean


def extract_client_ip(request: Optional[Request]) -> Optional[str]:
    """Safely extract client IP from reverse proxy headers or socket connection."""
    if not request:
        return None
    # Check standard proxy headers
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return None


def extract_user_agent(request: Optional[Request]) -> Optional[str]:
    """Extract and truncate user agent string."""
    if not request:
        return None
    ua = request.headers.get("user-agent")
    return ua[:255] if ua else None


def compute_entry_hash(
    prev_hash: str,
    sequence_number: int,
    timestamp_iso: str,
    event_id: str,
    action: str,
    outcome: str,
    actor_id: Optional[str],
    target_type: Optional[str],
    target_id: Optional[str],
    details: Optional[Dict[str, Any]]
) -> str:
    """
    Computes deterministic cryptographic SHA-256 hash for an audit record.
    Binds the previous hash, sequence, timestamps, action, actor, target and canonical JSON payload.
    """
    canonical_details = json.dumps(details or {}, sort_keys=True, separators=(',', ':'))
    raw_message = (
        f"{prev_hash}|"
        f"{sequence_number}|"
        f"{timestamp_iso}|"
        f"{event_id}|"
        f"{action}|"
        f"{outcome}|"
        f"{actor_id or ''}|"
        f"{target_type or ''}|"
        f"{target_id or ''}|"
        f"{canonical_details}"
    )
    return hashlib.sha256(raw_message.encode('utf-8')).hexdigest()


def log_security_event(
    db: Optional[Session],
    action: str,
    outcome: str = "SUCCESS", # "SUCCESS", "FAILURE", "DENIED"
    actor: Optional[Any] = None, # User object or dict
    actor_id: Optional[str] = None,
    actor_username: Optional[str] = None,
    actor_role: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None
) -> Optional[SecurityAuditLog]:
    """
    Appends an immutable, tamper-evident security audit record.
    1. Writes cryptographically chained entry to database (if db session provided).
    2. Emits structured JSON log event to logging subsystem for SIEM ingestion.
    """
    now = datetime.now(timezone.utc)
    now_naive = now.replace(tzinfo=None)
    timestamp_iso = now.isoformat()
    event_id = str(uuid.uuid4())

    # Extract actor info if User instance passed
    if actor and isinstance(actor, User):
        actor_id = actor_id or actor.id
        actor_username = actor_username or actor.username or actor.email
        if not actor_role and getattr(actor, "role_assignments", None):
            roles = [a.role for a in actor.role_assignments]
            actor_role = ",".join(roles) if roles else "viewer"
    elif isinstance(actor, dict):
        actor_id = actor_id or actor.get("id")
        actor_username = actor_username or actor.get("username")
        actor_role = actor_role or actor.get("role")

    # Extract request metadata
    if request:
        ip_address = ip_address or extract_client_ip(request)
        user_agent = user_agent or extract_user_agent(request)

    clean_details = sanitize_details(details)

    prev_hash = GENESIS_HASH
    sequence_number = 1
    audit_entry: Optional[SecurityAuditLog] = None

    if db is not None:
        try:
            # Get latest sequence number and previous hash
            latest = db.query(SecurityAuditLog).order_by(SecurityAuditLog.sequence_number.desc()).first()
            if latest:
                sequence_number = latest.sequence_number + 1
                prev_hash = latest.current_hash
            else:
                sequence_number = 1
                prev_hash = GENESIS_HASH

            current_hash = compute_entry_hash(
                prev_hash=prev_hash,
                sequence_number=sequence_number,
                timestamp_iso=timestamp_iso,
                event_id=event_id,
                action=action,
                outcome=outcome,
                actor_id=actor_id,
                target_type=target_type,
                target_id=target_id,
                details=clean_details
            )

            audit_entry = SecurityAuditLog(
                id=str(uuid.uuid4()),
                sequence_number=sequence_number,
                timestamp=now_naive,
                event_id=event_id,
                action=action,
                outcome=outcome,
                actor_id=actor_id,
                actor_username=actor_username,
                actor_role=actor_role,
                ip_address=ip_address,
                user_agent=user_agent,
                target_type=target_type,
                target_id=target_id,
                details=clean_details,
                prev_hash=prev_hash,
                current_hash=current_hash
            )
            db.add(audit_entry)
            db.commit()
            db.refresh(audit_entry)
        except Exception as exc:
            db.rollback()
            # Still continue to log to SIEM/stdout even if DB commit encounters an error
            current_hash = hashlib.sha256(f"{prev_hash}|{event_id}|{action}".encode('utf-8')).hexdigest()
    else:
        current_hash = hashlib.sha256(f"{prev_hash}|{event_id}|{action}".encode('utf-8')).hexdigest()

    # Emit Structured JSON Log for SIEM / Centralized Logging
    log_record = {
        "event_type": "security_audit",
        "timestamp": timestamp_iso,
        "event_id": event_id,
        "sequence": sequence_number,
        "action": action,
        "outcome": outcome,
        "actor": {
            "id": actor_id,
            "username": actor_username,
            "role": actor_role,
            "ip_address": ip_address,
            "user_agent": user_agent
        },
        "target": {
            "type": target_type,
            "id": target_id
        },
        "details": clean_details,
        "prev_hash": prev_hash,
        "current_hash": current_hash
    }
    logger.info(json.dumps(log_record))
    return audit_entry


def verify_audit_trail(db: Session) -> Dict[str, Any]:
    """
    Cryptographically verifies the entire audit log blockchain.
    Ensures:
    1. Continuity: each record's prev_hash matches the previous record's current_hash.
    2. Authenticity: each record's current_hash strictly matches recalculation of its content.
    Returns audit status and details if tampering is detected.
    """
    logs = db.query(SecurityAuditLog).order_by(SecurityAuditLog.sequence_number.asc()).all()
    total_records = len(logs)

    if total_records == 0:
        return {
            "is_valid": True,
            "total_records": 0,
            "first_event_at": None,
            "last_event_at": None,
            "tampered_at_sequence": None,
            "message": "Audit trail is empty. Ready for new entries."
        }

    expected_prev_hash = GENESIS_HASH
    expected_sequence = 1

    for record in logs:
        # Check sequence continuity
        if record.sequence_number != expected_sequence:
            return {
                "is_valid": False,
                "total_records": total_records,
                "tampered_at_sequence": record.sequence_number,
                "broken_event_id": record.event_id,
                "reason": f"Sequence gap detected: expected {expected_sequence}, found {record.sequence_number}",
                "message": f"Tampering detected at sequence {record.sequence_number}: sequence continuity violated."
            }

        # Check prev_hash continuity
        if record.prev_hash != expected_prev_hash:
            return {
                "is_valid": False,
                "total_records": total_records,
                "tampered_at_sequence": record.sequence_number,
                "broken_event_id": record.event_id,
                "reason": "Previous hash mismatch (blockchain link broken)",
                "message": f"Tampering detected at sequence {record.sequence_number}: prev_hash does not match preceding record."
            }

        # Format record timestamp to ISO string as used during hashing
        # Note: if timezone naive, treat as UTC
        ts_utc = record.timestamp.replace(tzinfo=timezone.utc) if record.timestamp.tzinfo is None else record.timestamp
        timestamp_iso = ts_utc.isoformat()

        # Recalculate hash
        recalculated_hash = compute_entry_hash(
            prev_hash=record.prev_hash,
            sequence_number=record.sequence_number,
            timestamp_iso=timestamp_iso,
            event_id=record.event_id,
            action=record.action,
            outcome=record.outcome,
            actor_id=record.actor_id,
            target_type=record.target_type,
            target_id=record.target_id,
            details=record.details
        )

        if record.current_hash != recalculated_hash:
            return {
                "is_valid": False,
                "total_records": total_records,
                "tampered_at_sequence": record.sequence_number,
                "broken_event_id": record.event_id,
                "reason": "Current hash mismatch (record content altered after commit)",
                "message": f"Tampering detected at sequence {record.sequence_number}: cryptographic hash mismatch."
            }

        expected_prev_hash = record.current_hash
        expected_sequence += 1

    return {
        "is_valid": True,
        "total_records": total_records,
        "first_event_at": logs[0].timestamp.isoformat(),
        "last_event_at": logs[-1].timestamp.isoformat(),
        "tampered_at_sequence": None,
        "message": f"Audit trail intact. Verified {total_records} chained records with 0 tampering detected."
    }


def query_audit_logs(
    db: Session,
    page: int = 1,
    size: int = 50,
    action: Optional[str] = None,
    outcome: Optional[str] = None,
    actor_id: Optional[str] = None,
    target_type: Optional[str] = None,
    search: Optional[str] = None
) -> Tuple[List[SecurityAuditLog], int]:
    """Query audit logs with filtering and pagination."""
    q = db.query(SecurityAuditLog)

    if action:
        q = q.filter(SecurityAuditLog.action == action)
    if outcome:
        q = q.filter(SecurityAuditLog.outcome == outcome)
    if actor_id:
        q = q.filter(SecurityAuditLog.actor_id == actor_id)
    if target_type:
        q = q.filter(SecurityAuditLog.target_type == target_type)
    if search:
        search_filter = f"%{search.strip()}%"
        q = q.filter(
            (SecurityAuditLog.actor_username.ilike(search_filter))
            | (SecurityAuditLog.action.ilike(search_filter))
            | (SecurityAuditLog.target_id.ilike(search_filter))
            | (SecurityAuditLog.ip_address.ilike(search_filter))
        )

    total = q.count()
    items = q.order_by(SecurityAuditLog.sequence_number.desc()).offset((page - 1) * size).limit(size).all()
    return items, total


def get_audit_summary(db: Session) -> Dict[str, Any]:
    """Retrieve security audit dashboard summary statistics."""
    total_events = db.query(SecurityAuditLog).count()
    
    # 24 hours stats
    since_24h = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=24)
    recent_events = db.query(SecurityAuditLog).filter(SecurityAuditLog.timestamp >= since_24h).count()
    recent_failures = db.query(SecurityAuditLog).filter(
        SecurityAuditLog.timestamp >= since_24h,
        SecurityAuditLog.outcome.in_(["FAILURE", "DENIED"])
    ).count()

    recent_logins = db.query(SecurityAuditLog).filter(
        SecurityAuditLog.timestamp >= since_24h,
        SecurityAuditLog.action.in_(["AUTH_LOGIN", "AUTH_MFA_VERIFY", "AUTH_LOGIN_SSO"]),
        SecurityAuditLog.outcome == "SUCCESS"
    ).count()

    # Top actions
    top_actions = db.query(
        SecurityAuditLog.action, func.count(SecurityAuditLog.id)
    ).group_by(SecurityAuditLog.action).order_by(func.count(SecurityAuditLog.id).desc()).limit(5).all()

    return {
        "total_records": total_events,
        "recent_24h_events": recent_events,
        "recent_24h_failures": recent_failures,
        "recent_24h_logins": recent_logins,
        "top_actions": [{"action": act, "count": cnt} for act, cnt in top_actions]
    }
