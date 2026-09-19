from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.core.database import get_db
from app.services.rbac_service import (
    get_roles_metadata,
    list_users,
    create_user,
    assign_role,
    remove_role_assignment,
    check_user_permission
)

router = APIRouter(prefix="/rbac", tags=["rbac"])

class UserCreateRequest(BaseModel):
    email: str
    full_name: str

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
def get_roles():
    """Returns RBAC roles metadata, scope types (Global vs Library) and permissions."""
    return get_roles_metadata()

@router.get("/users")
def get_users(db: Session = Depends(get_db)):
    """Returns the list of all users and their role assignments."""
    return list_users(db)

@router.post("/users")
def add_user(payload: UserCreateRequest, db: Session = Depends(get_db)):
    """Creates a new user account."""
    return create_user(db, email=payload.email, full_name=payload.full_name)

@router.post("/assignments")
def create_role_assignment(payload: RoleAssignRequest, db: Session = Depends(get_db)):
    """Assigns a role to a user, ensuring scope rules (admin=global, others=library)."""
    return assign_role(
        db,
        user_id=payload.user_id,
        role=payload.role,
        model_id=payload.model_id
    )

@router.delete("/assignments/{assignment_id}")
def delete_role_assignment(assignment_id: str, db: Session = Depends(get_db)):
    """Revokes a user role assignment."""
    success = remove_role_assignment(db, assignment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Role assignment not found.")
    return {"status": "success", "message": f"Assignment {assignment_id} removed."}

@router.post("/check-permission")
def evaluate_permission(payload: PermissionCheckRequest, db: Session = Depends(get_db)):
    """Evaluates whether the user can perform the specified action on the target library."""
    target_lib = payload.target_model_id or payload.model_id
    return check_user_permission(
        db,
        user_id=payload.user_id,
        action=payload.action,
        target_model_id=target_lib
    )
