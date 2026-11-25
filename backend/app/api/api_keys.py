from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.archimate import User
from app.api.deps import get_current_user, require_admin, require_admin_or_viewer
from app.services.api_key_service import (
    generate_api_key,
    list_api_keys,
    revoke_api_key
)
from app.services.audit_service import log_security_event

router = APIRouter(prefix="/api-keys", tags=["API Keys & Service Accounts"])


class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Nome identificativo per la chiave/agente")
    expires_in_days: Optional[int] = Field(None, ge=1, le=365, description="Scadenza opzionale in giorni")
    user_id: Optional[str] = Field(None, description="Opzionale: ID utente/service account proprietario (solo admin)")


@router.post("", status_code=201)
def create_api_key_endpoint(
    payload: ApiKeyCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Genera una nuova API Key per chiamate B2B o per agenti AI (es. MCP Server).
    Riservato agli amministratori di sistema.
    Restituisce il token in chiaro solo in questa risposta.
    """
    target_user_id = payload.user_id if payload.user_id else current_user.id

    api_key_obj, raw_key = generate_api_key(
        db=db,
        user_id=target_user_id,
        name=payload.name,
        expires_in_days=payload.expires_in_days
    )

    log_security_event(
        db=db,
        action="API_KEY_CREATED",
        outcome="SUCCESS",
        actor=current_user,
        target_type="api_key",
        target_id=api_key_obj.id,
        details={
            "name": api_key_obj.name,
            "prefix": api_key_obj.prefix,
            "target_user_id": target_user_id,
            "expires_in_days": payload.expires_in_days
        }
    )

    return {
        "id": api_key_obj.id,
        "name": api_key_obj.name,
        "prefix": api_key_obj.prefix,
        "raw_key": raw_key,
        "user_id": api_key_obj.user_id,
        "created_at": api_key_obj.created_at.isoformat() if api_key_obj.created_at else None,
        "expires_at": api_key_obj.expires_at.isoformat() if api_key_obj.expires_at else None,
        "warning": "Salva la chiave 'raw_key' in un luogo sicuro. Non sarà più possibile visualizzarla per esteso."
    }


@router.get("")
def list_api_keys_endpoint(
    current_user: User = Depends(require_admin_or_viewer),
    db: Session = Depends(get_db)
):
    """
    Elenca le API Keys attive. Riservato ad Admin e Viewer.
    """
    return list_api_keys(db, user_id=None)


@router.delete("/{key_id}")
def revoke_api_key_endpoint(
    key_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Revoca immediatamente una API Key esistente. Riservato agli amministratori.
    """
    revoked = revoke_api_key(db, key_id, user_id=None)
    if not revoked:
        log_security_event(
            db=db,
            action="API_KEY_REVOKED",
            outcome="FAILURE",
            actor=current_user,
            target_type="api_key",
            target_id=key_id
        )
        raise HTTPException(status_code=404, detail="API Key non trovata o non autorizzato alla revoca.")

    log_security_event(
        db=db,
        action="API_KEY_REVOKED",
        outcome="SUCCESS",
        actor=current_user,
        target_type="api_key",
        target_id=key_id
    )
    return {"message": "API Key revocata con successo.", "id": key_id}
