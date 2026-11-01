from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.core.database import get_db
from app.models.archimate import User
from app.api.deps import get_current_user, require_admin, require_admin_or_viewer
from app.services.audit_service import log_security_event
from app.services.rbac_service import (
    get_roles_metadata,
    list_users,
    create_user,
    reset_user_password,
    assign_role,
    remove_role_assignment,
    check_user_permission
)

router = APIRouter(prefix="/rbac", tags=["rbac"])

class UserCreateRequest(BaseModel):
    email: str
    full_name: str
    password: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    new_password: str

class RoleAssignRequest(BaseModel):
    user_id: str
    role: str # "admin", "architect", "analyst", "executive"
    model_id: Optional[str] = None # None for global admin, library workspace id for others

class PermissionCheckRequest(BaseModel):
    user_id: str
    action: str
    target_model_id: Optional[str] = None
    model_id: Optional[str] = None

@router.get("/roles")
def get_roles(current_user: User = Depends(get_current_user)):
    """Returns RBAC roles metadata, scope types (Global vs Library) and permissions."""
    return get_roles_metadata()

@router.get("/users")
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_viewer)
):
    """Returns the list of all users and their role assignments."""
    return list_users(db)

@router.post("/users")
def add_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Creates a new user account."""
    res = create_user(db, email=payload.email, full_name=payload.full_name, password=payload.password)
    log_security_event(
        db=db,
        action="RBAC_USER_CREATED",
        outcome="SUCCESS",
        actor=current_user,
        target_type="user",
        target_id=res.get("id"),
        details={"email": payload.email, "full_name": payload.full_name}
    )
    return res

@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: str,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Resets a user's password (requires administrator role)."""
    res = reset_user_password(db, user_id=user_id, new_password=payload.new_password)
    log_security_event(
        db=db,
        action="RBAC_PASSWORD_RESET",
        outcome="SUCCESS",
        actor=current_user,
        target_type="user",
        target_id=user_id
    )
    return res

@router.post("/assignments")
def create_role_assignment(
    payload: RoleAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Assigns a role to a user, ensuring scope rules (admin=global, others=library)."""
    res = assign_role(
        db,
        user_id=payload.user_id,
        role=payload.role,
        model_id=payload.model_id
    )
    log_security_event(
        db=db,
        action="RBAC_ROLE_ASSIGNED",
        outcome="SUCCESS",
        actor=current_user,
        target_type="user",
        target_id=payload.user_id,
        details={"role": payload.role, "model_id": payload.model_id}
    )
    return res

@router.delete("/assignments/{assignment_id}")
def delete_role_assignment(
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Revokes a user role assignment."""
    success = remove_role_assignment(db, assignment_id)
    if not success:
        log_security_event(
            db=db,
            action="RBAC_ROLE_REVOKED",
            outcome="FAILURE",
            actor=current_user,
            target_type="role_assignment",
            target_id=assignment_id
        )
        raise HTTPException(status_code=404, detail="Role assignment not found.")
    log_security_event(
        db=db,
        action="RBAC_ROLE_REVOKED",
        outcome="SUCCESS",
        actor=current_user,
        target_type="role_assignment",
        target_id=assignment_id
    )
    return {"status": "success", "message": f"Assignment {assignment_id} removed."}

@router.post("/check-permission")
def evaluate_permission(
    payload: PermissionCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Evaluates whether the user can perform the specified action on the target library."""
    is_admin = any(a.role == "admin" for a in current_user.role_assignments)
    if payload.user_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only Global Administrators can evaluate permissions for other users."
        )
    target_lib = payload.target_model_id or payload.model_id
    return check_user_permission(
        db,
        user_id=payload.user_id,
        action=payload.action,
        target_model_id=target_lib
    )
