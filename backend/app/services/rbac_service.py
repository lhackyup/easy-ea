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
        "role": "c_level",
        "name": "C-Level & Board (CIO, CFO, CEO, CISO)",
        "scope_type": "library",
        "badge_color": "purple",
        "description": "Executive leadership with full access to confidential financial metrics (TCO, costs, license savings), Gartner TIME matrix, technology obsolescence and risk radars.",
        "permissions": [
            {"domain": "Financials", "action": "view_financial_analytics", "description": "Full access to annual costs, license expenses, cloud TCO and CAPEX/OPEX breakdowns"},
            {"domain": "Executive", "action": "view_executive_overview", "description": "High-level summary of total applications, TCO and TIME distribution"},
            {"domain": "APM", "action": "view_time_portfolio", "description": "Gartner TIME matrix and application portfolio analytics"},
            {"domain": "Overlap", "action": "view_overlap_matrix", "description": "Heatmap of redundant applications serving identical capabilities"},
            {"domain": "Functional", "action": "view_functional_analysis", "description": "Hierarchical functional architecture, gap and overlap analysis"},
            {"domain": "Processes", "action": "view_process_lineage", "description": "Consult business process end-to-end lineage"}
        ]
    },
    {
        "role": "process_owner",
        "name": "Process Owner",
        "scope_type": "library",
        "badge_color": "indigo",
        "description": "Responsabile di Processo di Business (Process Owner). Gestisce le informazioni operative, BPMN, volumi, tempi di ciclo e compila i questionari di qualità sui processi assegnati.",
        "permissions": [
            {"domain": "Portal", "action": "view_owner_portal", "description": "Access dedicated 'My Surveys & Processes' dashboard"},
            {"domain": "Surveys", "action": "fill_surveys", "description": "Complete and submit process survey questionnaires"},
            {"domain": "Processes", "action": "edit_owned_processes", "description": "Edit BPMN automation, cycle times, volumes and attributes for owned processes"},
            {"domain": "Architecture", "action": "read_repository", "description": "Browse elements, relationships and diagrams (Read-Only)"}
        ]
    },
    {
        "role": "app_owner",
        "name": "Application Owner",
        "scope_type": "library",
        "badge_color": "amber",
        "description": "Application owner responsible for maintaining lifecycle, technical/business fit and survey responses for assigned applications. Financial costs visible only for owned applications.",
        "permissions": [
            {"domain": "Portal", "action": "view_owner_portal", "description": "Access dedicated 'My Applications & Surveys' dashboard"},
            {"domain": "Surveys", "action": "fill_surveys", "description": "Complete and submit application survey questionnaires"},
            {"domain": "APM", "action": "edit_owned_applications", "description": "Edit lifecycle, fit scores and attributes for owned applications"},
            {"domain": "Financials", "action": "view_own_financials", "description": "View and manage financial figures of assigned applications"},
            {"domain": "Architecture", "action": "read_repository", "description": "Browse elements, relationships and diagrams (Read-Only)"}
        ]
    },
    {
        "role": "business_user",
        "name": "Business User / Standard Staff",
        "scope_type": "library",
        "badge_color": "slate",
        "description": "Standard business user with access to application catalogs and architecture diagrams. High-sensitivity financial figures and executive overviews are redacted.",
        "permissions": [
            {"domain": "Catalog", "action": "browse_catalog", "description": "Browse application catalogs, capabilities and process lineage"},
            {"domain": "Architecture", "action": "read_repository", "description": "View elements, relationships and diagrams (Read-Only)"},
            {"domain": "Financials", "action": "view_financial_analytics", "allowed": False, "description": "Strictly forbidden from accessing confidential financial and TCO metrics"}
        ]
    },
    {
        "role": "viewer",
        "name": "Demo / Read-Only Viewer",
        "scope_type": "global",
        "badge_color": "cyan",
        "description": "Global read-only access across all architectural libraries, business views, diagrams, metamodels, packages, and system administration status. All write/mutating operations are disabled.",
        "permissions": [
            {"domain": "Navigation", "action": "browse_all_hubs", "description": "Browse Business, Architecture and Administration Hubs"},
            {"domain": "Libraries", "action": "read_all_libraries", "description": "Read-only access to all workspaces"},
            {"domain": "Architecture", "action": "view_repository", "description": "Browse elements, relationships, matrices and schemas"},
            {"domain": "Administration", "action": "view_admin_hub", "description": "Inspect metamodels, package definitions, RBAC directory and system status"},
            {"domain": "Mutations", "action": "write_operations", "allowed": False, "description": "Strictly read-only to preserve demo data integrity"}
        ]
    }
]

from app.services.auth_service import hash_password, validate_password_complexity

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
            "viewer": {
                "scope_type": "global",
                "requires_model_id": False,
                "description": "Global demo/viewer role with read-only access across all workspaces and hubs."
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
            "c_level": {
                "scope_type": "library",
                "requires_model_id": False,
                "description": "C-suite executive role (CIO/CFO/CISO) with full access to confidential financial and risk metrics."
            },
            "app_owner": {
                "scope_type": "library",
                "requires_model_id": True,
                "description": "Application Owner with management permissions and survey access for assigned applications."
            },
            "process_owner": {
                "scope_type": "library",
                "requires_model_id": True,
                "description": "Process Owner with governance, BPMN automation attributes and survey access for assigned business processes."
            },
            "business_user": {
                "scope_type": "library",
                "requires_model_id": True,
                "description": "Standard business user with read-only catalog access and redacted financial metrics."
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
    
    existing_email = db.query(User).filter(User.email == clean_email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail=f"Un utente con l'indirizzo email '{clean_email}' esiste già.")
    existing_username = db.query(User).filter(User.username == clean_username).first()
    if existing_username:
        raise HTTPException(status_code=400, detail=f"Un utente con il nome utente (username) '{clean_username}' esiste già.")
    
    if password is not None and password.strip():
        pwd_to_check = password.strip()
        is_valid, err_msg = validate_password_complexity(pwd_to_check, username=clean_username, email=clean_email)
        if not is_valid:
            raise HTTPException(status_code=400, detail=err_msg or "Invalid password.")
        pwd_to_hash = pwd_to_check
    else:
        # Generate cryptographically secure random initial password fulfilling complexity rules
        pwd_to_hash = f"Aa1!{secrets.token_urlsafe(14)}"
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
    """Reset a user's password enforcing OWASP complexity policy."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")
    
    clean_pwd = new_password.strip() if new_password else ""
    is_valid, err_msg = validate_password_complexity(clean_pwd, username=user.username, email=user.email)
    if not is_valid:
        raise HTTPException(status_code=400, detail=err_msg or "Invalid password.")
    
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
    
    valid_roles = {"admin", "architect", "lead_architect", "c_level", "app_owner", "process_owner", "business_user", "viewer"}
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role '{role}'. Must be one of {valid_roles}.")
    
    # Enforce scope rules
    if role in ("admin", "viewer"):
        model_id = None # Admin and Viewer are global
    elif role == "c_level" and (not model_id or model_id == "global"):
        model_id = None # C-Level can be globally assigned or library-scoped
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

def is_user_app_owner(db: Session, user: User, element_id: str) -> bool:
    """
    Determines if user is an owner of the given application element.
    Checks:
    1. Direct assignment in ApplicationOwnership table
    2. Fallback matching user email / username / full_name with business_owner / technical_owner fields
    3. Global admin accounts always pass
    """
    if not user:
        return False
    if any(a.role == "admin" for a in user.role_assignments):
        return True

    from app.models.surveys import ApplicationOwnership
    from app.models.archimate import ArchimateElement

    # 1. Relational check
    ownership = db.query(ApplicationOwnership).filter(
        ApplicationOwnership.element_id == element_id,
        ApplicationOwnership.user_id == user.id
    ).first()
    if ownership:
        return True

    # 2. Textual fallback check
    el = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
    if el:
        user_idents = {
            ident.strip().lower() for ident in [user.email, user.username, user.full_name]
            if ident and ident.strip()
        }
        if el.apm_attributes:
            apm = el.apm_attributes
            biz_owner = (apm.business_owner or "").strip().lower()
            tech_owner = (apm.technical_owner or "").strip().lower()
            if (biz_owner and biz_owner in user_idents) or (tech_owner and tech_owner in user_idents):
                return True
        props = el.properties if isinstance(el.properties, dict) else {}
        proc_owner = (props.get("process_owner") or props.get("processOwner") or "").strip().lower()
        proc_mgr = (props.get("process_manager") or props.get("processManager") or "").strip().lower()
        if (proc_owner and proc_owner in user_idents) or (proc_mgr and proc_mgr in user_idents):
            return True

    return False


def can_user_view_financials(db: Session, user: User, element_id: Optional[str] = None) -> bool:
    """
    Checks if user is authorized to view financial metrics (TCO, costs, license budgets):
    - Admin, C-Level, Executive: always authorized
    - App Owner: authorized ONLY if element_id is provided and user owns that specific application
    - Business User, Viewer, Analyst, Architect: NOT authorized to view financial cost metrics
    """
    if not user:
        return False

    roles = {a.role for a in user.role_assignments}
    if "admin" in roles or "c_level" in roles:
        return True

    if element_id and ("app_owner" in roles):
        return is_user_app_owner(db, user, element_id)

    return False


def filter_apm_application_financials(app_data: Dict[str, Any], can_view_fin: bool) -> Dict[str, Any]:
    """Redacts financial figures from an application APM dictionary if not authorized."""
    if can_view_fin:
        return app_data

    redacted = dict(app_data)
    financial_fields = [
        "annual_cost", "cost_software_licenses", "cost_cloud_infrastructure",
        "cost_vendor_maintenance", "cost_internal_labor", "capex_ratio"
    ]
    for f in financial_fields:
        if f in redacted:
            redacted[f] = None
    redacted["_financials_redacted"] = True
    return redacted


def check_user_permission(
    db: Session,
    user_id: str,
    action: str,
    target_model_id: Optional[str] = None,
    element_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluates whether a user is authorized to perform an action on a target library or element.
    - Global admin: can perform all actions on any library.
    - C-Level: full access to financial metrics and executive portfolio views.
    - Architect on library X: can perform architect actions and manage surveys on X.
    - Analyst on library X: can perform APM/process actions on X.
    - App Owner on library X: can edit owned applications, fill surveys, view own costs.
    - Business User: read-only catalog access with financial metrics redacted.
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

    # 2. Global C-Level check
    if any(a.role == "c_level" and (not a.model_id or a.model_id == target_model_id) for a in assignments):
        c_level_actions = {
            "view_financial_analytics", "view_executive_overview", "view_time_portfolio",
            "view_overlap_matrix", "view_functional_analysis", "view_process_lineage",
            "read_repository", "view_reports"
        }
        if action in c_level_actions:
            return {
                "allowed": True,
                "role": "c_level",
                "scope": f"library:{target_model_id}" if target_model_id else "global",
                "reason": "Authorized via C-Level Executive role."
            }

    # 3. Global Demo / Viewer check
    if any(a.role == "viewer" for a in assignments):
        read_actions = {
            "read_repository", "view_executive_overview", "view_time_portfolio",
            "view_overlap_matrix", "view_functional_analysis", "view_process_lineage", "view_reports",
            "read_all_libraries", "browse_all_hubs", "view_repository", "view_admin_hub",
            "view_schemas", "read_element", "read_model"
        }
        if action in read_actions or action.startswith("read_") or action.startswith("view_"):
            return {
                "allowed": True,
                "role": "viewer",
                "scope": "global",
                "reason": "Authorized for read-only access via Demo / Viewer role."
            }
        else:
            return {
                "allowed": False,
                "role": "viewer",
                "scope": "global",
                "reason": "Action not permitted: user has Demo / Read-Only role."
            }

    # If action requires target_model_id and none was supplied
    if not target_model_id:
        return {
            "allowed": False,
            "reason": "Non-admin roles must operate within a specific library scope."
        }

    # Find matching assignments for the target library
    matching_assignments = [a for a in assignments if a.model_id == target_model_id or a.model_id is None]
    if not matching_assignments:
        return {
            "allowed": False,
            "reason": f"User has no role assignments for library '{target_model_id}'."
        }

    user_roles_in_lib = {a.role for a in matching_assignments}

    # Financial analysis permission check
    if action == "view_financial_analytics":
        if "c_level" in user_roles_in_lib:
            return {
                "allowed": True,
                "role": "c_level",
                "scope": f"library:{target_model_id}",
                "reason": "Authorized for financial analytics."
            }
        return {
            "allowed": False,
            "reason": "Access to financial and TCO metrics is restricted to C-Level and Admin roles."
        }

    # Survey management actions
    if action in ("manage_surveys", "approve_survey", "reject_survey"):
        if "architect" in user_roles_in_lib or "lead_architect" in user_roles_in_lib:
            return {
                "allowed": True,
                "role": "architect",
                "scope": f"library:{target_model_id}",
                "reason": f"Authorized to manage surveys on library '{target_model_id}'."
            }
        return {
            "allowed": False,
            "reason": f"Action '{action}' requires Enterprise Architect or Admin privileges."
        }

    # Survey filling actions
    if action in ("fill_surveys", "view_owner_portal"):
        if "app_owner" in user_roles_in_lib or "process_owner" in user_roles_in_lib or "architect" in user_roles_in_lib:
            matched_owner_role = "process_owner" if "process_owner" in user_roles_in_lib else ("app_owner" if "app_owner" in user_roles_in_lib else list(user_roles_in_lib)[0])
            return {
                "allowed": True,
                "role": matched_owner_role,
                "scope": f"library:{target_model_id}",
                "reason": "Authorized for Owner portal and surveys."
            }
        return {
            "allowed": False,
            "reason": f"Action '{action}' requires Process Owner, Application Owner, Business Owner, Business Analyst or Enterprise Architect role."
        }

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
    apm_write_actions = {"edit_apm_scores", "edit_apm_attributes", "edit_owned_processes", "toggle_apm_scope", "simulate_impact"}
    if action in apm_write_actions:
        # App Owner, Business Owner or Process Owner can edit attributes if they own the specific element
        if ("app_owner" in user_roles_in_lib or "process_owner" in user_roles_in_lib) and action in ("edit_apm_attributes", "edit_owned_processes"):
            matched_owner_role = "process_owner" if "process_owner" in user_roles_in_lib else "app_owner"
            if element_id and is_user_app_owner(db, user, element_id):
                return {
                    "allowed": True,
                    "role": matched_owner_role,
                    "scope": f"element:{element_id}",
                    "reason": f"Authorized as {matched_owner_role} for element '{element_id}'."
                }
            elif not element_id:
                # General check
                return {
                    "allowed": True,
                    "role": matched_owner_role,
                    "scope": f"library:{target_model_id}",
                    "reason": f"Authorized as {matched_owner_role}."
                }

        if "architect" in user_roles_in_lib or "lead_architect" in user_roles_in_lib:
            matched_role = ("lead_architect" if "lead_architect" in user_roles_in_lib else "architect")
            return {
                "allowed": True,
                "role": matched_role,
                "scope": f"library:{target_model_id}",
                "reason": f"Authorized as {matched_role} on library '{target_model_id}'."
            }
        else:
            return {
                "allowed": False,
                "reason": f"Action '{action}' requires Application Owner, Business Analyst or Enterprise Architect role."
            }

    # Read-only actions
    read_actions = {
        "read_repository", "view_executive_overview", "view_time_portfolio",
        "view_overlap_matrix", "view_functional_analysis", "view_process_lineage", "view_reports",
        "browse_catalog"
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
                {"role": "architect", "model_id": "sample-easybank-ea"}
            ]
        },
        {
            "id": "usr-cio-board",
            "username": "giorgio_cio",
            "email": "giorgio.cio@easybank.it",
            "full_name": "Giorgio Ferrari (CIO & Board Director)",
            "password": demo_pwd,
            "assignments": [
                {"role": "c_level", "model_id": "sample-easybank-ea"},
            ]
        },
        {
            "id": "usr-appowner-easy",
            "username": "roberto_owner",
            "email": "roberto.owner@easybank.it",
            "full_name": "Roberto Neri (Core Banking App Owner)",
            "password": demo_pwd,
            "assignments": [
                {"role": "app_owner", "model_id": "sample-easybank-ea"}
            ]
        },
        {
            "id": "usr-bizowner-easy",
            "username": "silvia_bizowner",
            "email": "silvia.lombardi@easybank.it",
            "full_name": "Silvia Lombardi (Core Banking Process Owner)",
            "password": demo_pwd,
            "assignments": [
                {"role": "process_owner", "model_id": "sample-easybank-ea"}
            ]
        },
        {
            "id": "usr-buser-easy",
            "username": "elena_business",
            "email": "elena.business@easybank.it",
            "full_name": "Elena Galli (Business Staff)",
            "password": demo_pwd,
            "assignments": [
                {"role": "business_user", "model_id": "sample-easybank-ea"}
            ]
        },
        {
            "id": "usr-demo-viewer",
            "username": "demo",
            "email": "demo@easyea.local",
            "full_name": "Demo User (Sola Lettura)",
            "password": demo_pwd,
            "assignments": [
                {"role": "viewer", "model_id": None}
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
            target_user = user
        else:
            target_user = existing_user
            if not existing_user.password_hash or not existing_user.username:
                existing_user.username = su["username"]
                existing_user.password_hash = hash_password(su["password"])
                db.flush()

        # Ensure all sample role assignments are populated for this user
        current_ura = db.query(UserRoleAssignment).filter(UserRoleAssignment.user_id == target_user.id).all()
        current_roles_models = {(a.role, a.model_id) for a in current_ura}

        for a in su["assignments"]:
            if (a["role"], a["model_id"]) not in current_roles_models:
                if a["model_id"]:
                    ws = db.query(ModelWorkspace).filter(ModelWorkspace.id == a["model_id"]).first()
                    if not ws:
                        continue
                ura = UserRoleAssignment(
                    id=f"ura-{uuid.uuid4().hex[:8]}",
                    user_id=target_user.id,
                    role=a["role"],
                    model_id=a["model_id"]
                )
                db.add(ura)
    db.commit()

    # Seed sample ownerships and sample survey campaign for roberto_owner and silvia_bizowner
    try:
        from app.models.surveys import ApplicationOwnership, SurveyCampaign
        from app.models.archimate import ArchimateElement

        roberto = db.query(User).filter(User.username == "roberto_owner").first()
        silvia = db.query(User).filter(User.username == "silvia_bizowner").first()

        if roberto:
            for app_id in ["app-cloud-core", "app-salesforce"]:
                el = db.query(ArchimateElement).filter(ArchimateElement.id == app_id).first()
                if el:
                    own = db.query(ApplicationOwnership).filter(
                        ApplicationOwnership.element_id == el.id,
                        ApplicationOwnership.user_id == roberto.id
                    ).first()
                    if not own:
                        db.add(ApplicationOwnership(
                            id=f"own-{uuid.uuid4().hex[:12]}",
                            element_id=el.id,
                            user_id=roberto.id,
                            ownership_type="technical_owner",
                            notes="Primary Application / Technical Owner"
                        ))
                    else:
                        own.ownership_type = "technical_owner"
            db.commit()

        # Clean up any legacy business_owner application ownerships
        db.query(ApplicationOwnership).filter(ApplicationOwnership.ownership_type == "business_owner").delete()
        db.commit()

        # Seed sample Business Process ownerships for EasyBank
        elena = db.query(User).filter(User.username == "elena_business").first()
        proc_seed_configs = [
            ("proc-onboarding", silvia, "process_owner", "Digital Onboarding Lead Process Owner"),
            ("proc-send-payment", silvia, "process_owner", "Payment Operations Process Owner"),
            ("proc-loan-origination", elena, "process_manager", "Lending Operations Process Manager"),
        ]
        for proc_id, target_u, otype, notes in proc_seed_configs:
            if target_u:
                el = db.query(ArchimateElement).filter(ArchimateElement.id == proc_id).first()
                if el:
                    own = db.query(ApplicationOwnership).filter(
                        ApplicationOwnership.element_id == el.id,
                        ApplicationOwnership.user_id == target_u.id
                    ).first()
                    if not own:
                        db.add(ApplicationOwnership(
                            id=f"own-{uuid.uuid4().hex[:12]}",
                            element_id=el.id,
                            user_id=target_u.id,
                            ownership_type=otype,
                            notes=notes
                        ))
                    else:
                        own.ownership_type = otype
                    # Sync to properties
                    props = dict(el.properties or {})
                    if otype == "process_owner":
                        props["process_owner"] = target_u.full_name or target_u.email
                        props["processOwner"] = target_u.full_name or target_u.email
                    elif otype == "process_manager":
                        props["process_manager"] = target_u.full_name or target_u.email
                        props["processManager"] = target_u.full_name or target_u.email
                    el.properties = props
        db.commit()

        # Clean up legacy business_owner assignments and migrate executive -> c_level, analyst -> architect
        for lbo in db.query(UserRoleAssignment).filter(UserRoleAssignment.role == "business_owner").all():
            db.delete(lbo)
        for lexec in db.query(UserRoleAssignment).filter(UserRoleAssignment.role == "executive").all():
            lexec.role = "c_level"
        for lanalyst in db.query(UserRoleAssignment).filter(UserRoleAssignment.role == "analyst").all():
            lanalyst.role = "architect"
        db.commit()

        # Deduplicate role assignments for same user, role and model
        seen = set()
        for ura in db.query(UserRoleAssignment).all():
            key = (ura.user_id, ura.role, ura.model_id)
            if key in seen:
                db.delete(ura)
            else:
                seen.add(key)
        db.commit()

        has_campaigns = db.query(SurveyCampaign).filter(SurveyCampaign.model_id == "sample-easybank-ea").count() > 0
        if not has_campaigns:
            admin_u = db.query(User).filter(User.username == "admin").first()
            if admin_u:
                from app.services.survey_service import SurveyService
                SurveyService.create_campaign(
                    db=db,
                    model_id="sample-easybank-ea",
                    title="Q4 2026 APM Data Health Check",
                    description="Verifica annuale dei metadati, fit funzionale, SLA e costi operativi per le applicazioni di EasyBank.",
                    created_by=admin_u,
                    mode="approval_required",
                    sections=["general", "fit", "costs", "lifecycle", "hosting"]
                )
    except Exception as exc:
        logger.warning(f"Note seeding sample surveys: {exc}")
