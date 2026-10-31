import logging
import secrets
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.core.config import settings
from app.models.archimate import User, UserRoleAssignment, ModelWorkspace

logger = logging.getLogger(__name__)

ROLE_DEFINITIONS = [
    {
        "role": "admin",
        "name": "System Administrator",
        "scope_type": "global", # "global" or "library"
        "badge_color": "rose",
        "description": "Global enterprise platform administrator. Full permissions across all architectural libraries, metamodels, users, APM parameters and system configuration.",
        "permissions": [
            {"domain": "Libraries", "action": "create_library", "description": "Create, import and delete library workspaces"},
            {"domain": "Libraries", "action": "export_library", "description": "Export any library to JSON / Archi format"},
            {"domain": "Metamodel", "action": "manage_global_metamodel", "description": "Define and edit global ArchiMate custom attributes and sections"},
            {"domain": "Metamodel", "action": "manage_library_metamodel", "description": "Define library-scoped attributes and sections"},
            {"domain": "Architecture", "action": "edit_any_architecture", "description": "Full read/write on elements and diagrams of all libraries"},
            {"domain": "APM", "action": "manage_apm_parameters", "description": "Configure investment thresholds and cost alert limits"},
            {"domain": "APM", "action": "edit_apm_data", "description": "Update application lifecycle, TIME quadrants and business fit"},
            {"domain": "Security & RBAC", "action": "manage_users_roles", "description": "Create users and assign global/library roles"},
            {"domain": "System", "action": "view_system_status", "description": "Inspect PostgreSQL health and server infrastructure"}
        ]
    },
    {
        "role": "architect",
        "name": "Enterprise Architect",
        "scope_type": "library", # "global" or "library"
        "badge_color": "emerald",
        "description": "Enterprise and solution architect responsible for modeling within specific assigned libraries. Cannot alter other libraries or platform configuration.",
        "permissions": [
            {"domain": "Architecture", "action": "create_element", "description": "Create ArchiMate elements in assigned library"},
            {"domain": "Architecture", "action": "edit_element", "description": "Edit element documentation, names and properties"},
            {"domain": "Architecture", "action": "delete_element", "description": "Delete elements from assigned library"},
            {"domain": "Architecture", "action": "create_relationship", "description": "Establish ArchiMate relationships conforming to metamodel"},
            {"domain": "Architecture", "action": "edit_diagram", "description": "Design visual architecture diagram views in assigned library"},
            {"domain": "Architecture", "action": "import_model_file", "description": "Import .archimate / Open Exchange models into assigned library"},
            {"domain": "Metamodel", "action": "create_library_attribute", "description": "Define custom attributes with library prefix (e.g. easy_*)"},
            {"domain": "Reports", "action": "view_reports", "description": "View relations matrix, lineage and architecture catalogs"},
            {"domain": "Isolation", "action": "cross_library_write", "allowed": False, "description": "Forbidden from modifying libraries other than assigned ones"}
        ]
    },
    {
        "role": "analyst",
        "name": "Business Analyst",
        "scope_type": "library",
        "badge_color": "indigo",
        "description": "Business analyst and process owner evaluating business capabilities, APM portfolios and process impact simulations within assigned libraries.",
        "permissions": [
            {"domain": "APM", "action": "edit_apm_attributes", "description": "Update Business Fit, Technical Fit, TIME Quadrant, Costs and Owners"},
            {"domain": "APM", "action": "toggle_apm_scope", "description": "Include or exclude applications from APM portfolio perimeter"},
            {"domain": "Processes", "action": "simulate_impact", "description": "Run upstream/downstream business process impact simulations"},
            {"domain": "Architecture", "action": "read_repository", "description": "Browse elements, relationships and diagrams (Read-Only)"},
            {"domain": "Isolation", "action": "cross_library_write", "allowed": False, "description": "Forbidden from modifying libraries other than assigned ones"},
            {"domain": "Architecture", "action": "create_element", "allowed": False, "description": "Cannot add or delete core architectural nodes"}
        ]
    },
    {
        "role": "executive",
        "name": "CIO / CFO / Board",
        "scope_type": "library",
        "badge_color": "blue",
        "description": "Executive leadership and steering committee. High-level read-only portfolio intelligence, cost rationalization, Gartner TIME matrices and functional overlap analysis.",
        "permissions": [
            {"domain": "Executive", "action": "view_executive_overview", "description": "High-level summary of total applications, TCO and TIME distribution"},
            {"domain": "APM", "action": "view_time_portfolio", "description": "Gartner TIME matrix and application portfolio analytics"},
            {"domain": "Overlap", "action": "view_overlap_matrix", "description": "Heatmap of redundant applications serving identical capabilities"},
            {"domain": "Processes", "action": "view_process_lineage", "description": "Consult business process end-to-end lineage"},
            {"domain": "Security", "action": "write_operations", "allowed": False, "description": "Strictly read-only access to preserve data integrity"}
        ]
    }
]

from app.services.auth_service import hash_password

def get_roles_metadata() -> Dict[str, Any]:
    """Returns the comprehensive list of roles, their scope types, and permission matrix."""
    return {
        "roles": ROLE_DEFINITIONS,
        "scope_rules": {
            "admin": {
                "scope_type": "global",
                "requires_model_id": False,
                "description": "Global administrator not restricted by library boundary."
            },
            "architect": {
                "scope_type": "library",
                "requires_model_id": True,
                "description": "Must be bound to a specific library. Write permissions restricted to that library."
            },
            "analyst": {
                "scope_type": "library",
                "requires_model_id": True,
                "description": "Must be bound to a specific library. APM and process edit permissions restricted to that library."
            },
            "executive": {
                "scope_type": "library",
                "requires_model_id": True,
                "description": "Read-only executive access bound to specific library or portfolio."
            }
        }
    }

def list_users(db: Session) -> List[Dict[str, Any]]:
    """List all registered users with their role assignments and associated library details."""
    users = db.query(User).order_by(User.created_at.asc()).all()
    result = []
    for u in users:
        assignments = []
        for a in u.role_assignments:
            ws_code = None
            ws_name = None
            if a.workspace:
                ws_code = a.workspace.code
                ws_name = a.workspace.name
            assignments.append({
                "id": a.id,
                "role": a.role,
                "model_id": a.model_id,
                "library_code": ws_code,
                "library_name": ws_name,
                "created_at": a.created_at.isoformat() if a.created_at else None
            })

        result.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "role_assignments": assignments
        })
    return result

def create_user(
    db: Session,
    email: str,
    full_name: str,
    username: Optional[str] = None,
    password: Optional[str] = None
) -> Dict[str, Any]:
    """Create a new user in the directory."""
    clean_email = email.strip().lower()
    clean_name = full_name.strip()
    clean_username = username.strip().lower() if username else clean_email.split('@')[0]
    if not clean_email or not clean_name:
        raise HTTPException(status_code=400, detail="Email and Full Name are required.")
    
    existing = db.query(User).filter((User.email == clean_email) | (User.username == clean_username)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"User with email '{clean_email}' or username '{clean_username}' already exists.")
    
    if password is not None and password.strip():
        if len(password.strip()) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")
        pwd_to_hash = password.strip()
    else:
        pwd_to_hash = secrets.token_urlsafe(16)
    user = User(
        id=f"usr-{uuid.uuid4().hex[:8]}",
        username=clean_username,
        email=clean_email,
        full_name=clean_name,
        password_hash=hash_password(pwd_to_hash),
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "role_assignments": []
    }

def reset_user_password(
    db: Session,
    user_id: str,
    new_password: str
) -> Dict[str, Any]:
    """Reset a user's password (min 8 chars)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")
    
    clean_pwd = new_password.strip() if new_password else ""
    if len(clean_pwd) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")
    
    user.password_hash = hash_password(clean_pwd)
    db.commit()
    return {"status": "success", "message": f"Password for user '{user.username}' updated successfully."}

def assign_role(
    db: Session,
    user_id: str,
    role: str,
    model_id: Optional[str] = None
) -> Dict[str, Any]:
    """Assign a role to a user, enforcing Global vs Library-scoped constraints."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")
    
    valid_roles = {"admin", "architect", "analyst", "executive"}
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role '{role}'. Must be one of {valid_roles}.")
    
    # Enforce scope rules
    if role == "admin":
        model_id = None # Admin is always global
    else:
        if not model_id or model_id == "global":
            raise HTTPException(
                status_code=400,
                detail=f"Role '{role}' is library-scoped and requires a valid library (model_id)."
            )
        ws = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
        if not ws:
            raise HTTPException(status_code=404, detail=f"Library workspace '{model_id}' not found.")

    # Check duplicate assignment
    existing = db.query(UserRoleAssignment).filter(
        UserRoleAssignment.user_id == user_id,
        UserRoleAssignment.role == role,
        UserRoleAssignment.model_id == model_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="This user already has this role assignment.")

    assignment = UserRoleAssignment(
        id=f"ura-{uuid.uuid4().hex[:8]}",
        user_id=user_id,
        role=role,
        model_id=model_id
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    ws_code = assignment.workspace.code if assignment.workspace else None
    ws_name = assignment.workspace.name if assignment.workspace else None

    return {
        "id": assignment.id,
        "user_id": assignment.user_id,
        "role": assignment.role,
        "model_id": assignment.model_id,
        "library_code": ws_code,
        "library_name": ws_name,
        "created_at": assignment.created_at.isoformat() if assignment.created_at else None
    }

def remove_role_assignment(db: Session, assignment_id: str) -> bool:
    """Remove a user role assignment."""
    assignment = db.query(UserRoleAssignment).filter(UserRoleAssignment.id == assignment_id).first()
    if not assignment:
        return False
    db.delete(assignment)
    db.commit()
    return True

def check_user_permission(
    db: Session,
    user_id: str,
    action: str,
    target_model_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluates whether a user is authorized to perform an action on a target library.
    - Global admin: can perform all actions on any library.
    - Architect on library X: can perform architect actions on X; denied on library Y.
    - Analyst on library X: can perform APM/process actions on X; denied on library Y.
    - Executive on library X: read-only on X; write actions denied.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"allowed": False, "reason": f"User '{user_id}' not found."}
    
    if not user.is_active:
        return {"allowed": False, "reason": "User account is inactive."}
    
    assignments = user.role_assignments

    # 1. Global Admin check
    if any(a.role == "admin" for a in assignments):
        return {
            "allowed": True,
            "role": "admin",
            "scope": "global",
            "reason": "Authorized via Global System Administrator role."
        }

    # If action requires target_model_id and none was supplied
    if not target_model_id:
        return {
            "allowed": False,
            "reason": "Non-admin roles must operate within a specific library scope."
        }

    # Find matching assignments for the target library
    matching_assignments = [a for a in assignments if a.model_id == target_model_id]
    if not matching_assignments:
        return {
            "allowed": False,
            "reason": f"User has no role assignments for library '{target_model_id}'."
        }

    user_roles_in_lib = {a.role for a in matching_assignments}

    # Architecture write actions
    arch_write_actions = {
        "write_architecture", "create_element", "edit_element", "delete_element",
        "create_relationship", "delete_relationship",
        "edit_diagram", "import_model_file", "create_library_attribute"
    }
    if action in arch_write_actions:
        if "architect" in user_roles_in_lib or "lead_architect" in user_roles_in_lib:
            matched_arch_role = "lead_architect" if "lead_architect" in user_roles_in_lib else "architect"
            return {
                "allowed": True,
                "role": matched_arch_role,
                "scope": f"library:{target_model_id}",
                "reason": f"Authorized as Enterprise Architect on library '{target_model_id}'."
            }
        else:
            return {
                "allowed": False,
                "reason": f"Action '{action}' requires Enterprise Architect role on library '{target_model_id}'."
            }

    # APM write actions
    apm_write_actions = {"edit_apm_scores", "edit_apm_attributes", "toggle_apm_scope", "simulate_impact"}
    if action in apm_write_actions:
        if "analyst" in user_roles_in_lib or "architect" in user_roles_in_lib or "lead_architect" in user_roles_in_lib:
            matched_role = "analyst" if "analyst" in user_roles_in_lib else ("lead_architect" if "lead_architect" in user_roles_in_lib else "architect")
            return {
                "allowed": True,
                "role": matched_role,
                "scope": f"library:{target_model_id}",
                "reason": f"Authorized as {matched_role} on library '{target_model_id}'."
            }
        else:
            return {
                "allowed": False,
                "reason": f"Action '{action}' requires Business Analyst or Enterprise Architect role on library '{target_model_id}'."
            }

    # Read-only actions
    read_actions = {
        "read_repository", "view_executive_overview", "view_time_portfolio",
        "view_overlap_matrix", "view_process_lineage", "view_reports"
    }
    if action in read_actions:
        return {
            "allowed": True,
            "role": list(user_roles_in_lib)[0],
            "scope": f"library:{target_model_id}",
            "reason": f"Authorized for read access on library '{target_model_id}'."
        }

    return {
        "allowed": False,
        "reason": f"Unrecognized action '{action}' or missing appropriate role."
    }

def seed_default_rbac(db: Session):
    """
    Seed initial RBAC users and role assignments.
    In production (EASYEA_ENV=production and EASYEA_SEED_DEMO_USERS=false), demo users are NOT seeded;
    only a single bootstrap admin account is created if the user table is empty, using EASYEA_ADMIN_PASSWORD
    or a cryptographically random one-time password.
    """
    if settings.ENVIRONMENT == "production" and not settings.SEED_DEMO_USERS:
        if db.query(User).count() == 0:
            bootstrap_pwd = settings.ADMIN_INITIAL_PASSWORD or secrets.token_urlsafe(18)
            if not settings.ADMIN_INITIAL_PASSWORD:
                logger.warning(
                    "EasyEA production bootstrap: created initial 'sys_admin' account with generated one-time password: %s",
                    bootstrap_pwd,
                )
            admin_user = User(
                id="usr-sysadmin-00",
                username="sys_admin",
                email="sys_admin@easyea.local",
                full_name="System Administrator",
                password_hash=hash_password(bootstrap_pwd),
                is_active=True,
            )
            db.add(admin_user)
            db.flush()
            db.add(
                UserRoleAssignment(
                    id=f"ura-{uuid.uuid4().hex[:8]}",
                    user_id=admin_user.id,
                    role="admin",
                    model_id=None,
                )
            )
            db.commit()
        return

    admin_pwd = settings.ADMIN_INITIAL_PASSWORD or "AdminEasyEA2026!"
    demo_pwd = settings.DEMO_USER_PASSWORD or "EasyEA2026!"

    sample_users = [
        {
            "id": "usr-sysadmin-00",
            "username": "sys_admin",
            "email": "sys_admin@easyea.local",
            "full_name": "System Administrator",
            "password": admin_pwd,
            "assignments": [
                {"role": "admin", "model_id": None}
            ]
        },
        {
            "id": "usr-admin-01",
            "username": "admin",
            "email": "admin@easyea.local",
            "full_name": "Alessandro Rossi (System Admin)",
            "password": admin_pwd,
            "assignments": [
                {"role": "admin", "model_id": None}
            ]
        },
        {
            "id": "usr-arch-easy",
            "username": "marco_arch",
            "email": "marco.arch@easybank.it",
            "full_name": "Marco Bianchi (Lead EA EasyBank)",
            "password": demo_pwd,
            "assignments": [
                {"role": "architect", "model_id": "sample-easybank-ea"}
            ]
        },
        {
            "id": "usr-analyst-easy",
            "username": "laura_analyst",
            "email": "laura.analyst@easybank.it",
            "full_name": "Laura Verdi (Senior Business Analyst)",
            "password": demo_pwd,
            "assignments": [
                {"role": "analyst", "model_id": "sample-easybank-ea"}
            ]
        },
        {
            "id": "usr-cio-board",
            "username": "giorgio_cio",
            "email": "giorgio.cio@easybank.it",
            "full_name": "Giorgio Ferrari (CIO & Board Director)",
            "password": demo_pwd,
            "assignments": [
                {"role": "executive", "model_id": "sample-easybank-ea"}
            ]
        }
    ]

    for su in sample_users:
        existing_user = db.query(User).filter(
            (User.id == su["id"]) | (User.email == su["email"]) | (User.username == su["username"])
        ).first()
        if not existing_user:
            user = User(
                id=su["id"],
                username=su["username"],
                email=su["email"],
                full_name=su["full_name"],
                password_hash=hash_password(su["password"]),
                is_active=True
            )
            db.add(user)
            db.flush()

            for a in su["assignments"]:
                if a["model_id"]:
                    ws = db.query(ModelWorkspace).filter(ModelWorkspace.id == a["model_id"]).first()
                    if not ws:
                        continue
                ura = UserRoleAssignment(
                    id=f"ura-{uuid.uuid4().hex[:8]}",
                    user_id=user.id,
                    role=a["role"],
                    model_id=a["model_id"]
                )
                db.add(ura)
        else:
            # Ensure password_hash and username are up to date
            if not existing_user.password_hash or not existing_user.username:
                existing_user.username = su["username"]
                existing_user.password_hash = hash_password(su["password"])
                db.flush()
    db.commit()
