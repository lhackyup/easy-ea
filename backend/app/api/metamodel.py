from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.core.database import get_db
from app.models.archimate import CustomAttributeDefinition, User
from app.api.deps import get_current_user, require_admin, require_library_permission
from app.services.metamodel_service import (
    get_full_metamodel_with_custom_attributes,
    list_custom_attributes,
    create_custom_attribute,
    update_custom_attribute,
    rename_custom_attributes_section,
    delete_custom_attribute,
    get_relationships_matrix,
    list_attribute_packages,
    get_attribute_package,
    create_attribute_package,
    update_attribute_package,
    delete_attribute_package,
    create_package_item,
    update_package_item,
    delete_package_item,
    toggle_library_package,
    audit_package_usage,
    list_stereotypes,
    get_stereotype,
    create_stereotype,
    update_stereotype,
    delete_stereotype,
    add_stereotype_attribute_link,
    delete_stereotype_attribute_link
)

router = APIRouter(prefix="/metamodel", tags=["metamodel"])

class CustomAttributeCreate(BaseModel):
    name: str
    label: str
    section: Optional[str] = "Custom Attributes"
    model_id: Optional[str] = None # Optional: target specific model workspace
    description: Optional[str] = None
    element_type: str = "*" # e.g. "ApplicationComponent", "BusinessProcess", or "*"
    layer: str = "All" # "Strategy", "Business", "Application", "Technology", "Motivation", "Implementation", or "All"
    data_type: str = "string" # "string", "number", "boolean", "date", "select"
    options: Optional[List[str]] = []
    default_value: Optional[str] = None
    is_required: bool = False

class CustomAttributeUpdate(BaseModel):
    label: Optional[str] = None
    section: Optional[str] = None
    description: Optional[str] = None
    data_type: Optional[str] = None
    options: Optional[List[str]] = None
    default_value: Optional[str] = None
    is_required: Optional[bool] = None

class AttributePackageCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    icon_color: Optional[str] = "blue"
    is_default_active: Optional[bool] = True

class AttributePackageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon_color: Optional[str] = None
    is_default_active: Optional[bool] = None

class PackageItemCreate(BaseModel):
    name: str
    label: str
    description: Optional[str] = None
    element_type: Optional[str] = "ApplicationComponent"
    layer: Optional[str] = "Application"
    data_type: Optional[str] = "string"
    options: Optional[List[str]] = []
    default_value: Optional[str] = None
    is_required: Optional[bool] = False
    section: Optional[str] = None
    sort_order: Optional[int] = 0

class PackageItemUpdate(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    element_type: Optional[str] = None
    layer: Optional[str] = None
    data_type: Optional[str] = None
    options: Optional[List[str]] = None
    default_value: Optional[str] = None
    is_required: Optional[bool] = None
    section: Optional[str] = None
    sort_order: Optional[int] = None

class LibraryPackageToggleRequest(BaseModel):
    active: Optional[bool] = None

class SectionRenameRequest(BaseModel):
    old_section: str
    new_section: str
    model_id: Optional[str] = None
    element_type: Optional[str] = None

class StereotypeCreate(BaseModel):
    name: str
    label: Optional[str] = None
    base_type: str
    description: Optional[str] = None
    icon_color: Optional[str] = "indigo"
    model_id: Optional[str] = None
    attribute_links: Optional[List[Dict[str, Any]]] = []

class StereotypeUpdate(BaseModel):
    name: Optional[str] = None
    label: Optional[str] = None
    description: Optional[str] = None
    icon_color: Optional[str] = None

class StereotypeAttributeLinkCreate(BaseModel):
    attribute_name: str
    is_required: Optional[bool] = False
    default_value: Optional[str] = None
    section_override: Optional[str] = None
    sort_order: Optional[int] = 0

@router.get("/types")
def get_metamodel_types(
    model_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns the ArchiMate 3.x metamodel structure with standard and custom attributes."""
    return get_full_metamodel_with_custom_attributes(db, model_id=model_id)

@router.get("/relationships-matrix")
def get_metamodel_relationships_matrix(
    current_user: User = Depends(get_current_user)
):
    """Returns the official ArchiMate 3.x allowed relationships matrix and relationship metadata."""
    return get_relationships_matrix()

@router.get("/attributes")
def get_custom_attributes(
    model_id: Optional[str] = Query(None),
    element_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns custom attribute definitions."""
    return list_custom_attributes(db, model_id=model_id, element_type=element_type)

@router.post("/attributes")
def add_custom_attribute(
    payload: CustomAttributeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new custom attribute definition for an element type."""
    if payload.model_id:
        require_library_permission(db, current_user, "create_library_attribute", payload.model_id)
    else:
        require_admin(current_user)

    if not payload.name.strip() or not payload.label.strip():
        raise HTTPException(status_code=400, detail="Attribute name and label are required.")
    
    return create_custom_attribute(db, payload.model_dump())

@router.put("/attributes/{attr_id}")
def edit_custom_attribute(
    attr_id: str,
    payload: CustomAttributeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates an existing custom attribute definition."""
    attr = db.query(CustomAttributeDefinition).filter(CustomAttributeDefinition.id == attr_id).first()
    if attr and attr.model_id:
        require_library_permission(db, current_user, "create_library_attribute", attr.model_id)
    else:
        require_admin(current_user)
    return update_custom_attribute(db, attr_id, payload.model_dump(exclude_unset=True))

@router.put("/sections/rename")
def rename_section(
    payload: SectionRenameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Renames an attribute section across all matching attributes."""
    if payload.model_id:
        require_library_permission(db, current_user, "create_library_attribute", payload.model_id)
    else:
        require_admin(current_user)
    count = rename_custom_attributes_section(
        db,
        old_section=payload.old_section,
        new_section=payload.new_section,
        model_id=payload.model_id,
        element_type=payload.element_type
    )
    return {"status": "success", "updated_count": count, "new_section": payload.new_section}

@router.delete("/attributes/{attr_id}")
def remove_custom_attribute(
    attr_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a custom attribute definition."""
    attr = db.query(CustomAttributeDefinition).filter(CustomAttributeDefinition.id == attr_id).first()
    if attr and attr.model_id:
        require_library_permission(db, current_user, "create_library_attribute", attr.model_id)
    else:
        require_admin(current_user)
    success = delete_custom_attribute(db, attr_id)
    if not success:
        raise HTTPException(status_code=404, detail="Attribute definition not found.")
    return {"status": "success", "message": f"Attribute {attr_id} deleted."}


# ==========================================
# ATTRIBUTE PACKAGES ENDPOINTS
# ==========================================

@router.get("/packages")
def get_attribute_packages(
    model_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all attribute packages in the global catalog, with active status for model_id if provided."""
    return list_attribute_packages(db, model_id=model_id)


@router.get("/packages/{package_id}")
def get_single_package(
    package_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get package details and its items."""
    return get_attribute_package(db, package_id)


@router.post("/packages")
def add_attribute_package(
    payload: AttributePackageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new attribute package in the global catalog (Admin only)."""
    return create_attribute_package(db, payload.model_dump())


@router.put("/packages/{package_id}")
def edit_attribute_package(
    package_id: str,
    payload: AttributePackageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update metadata of an attribute package (Admin only)."""
    return update_attribute_package(db, package_id, payload.model_dump(exclude_unset=True))


@router.delete("/packages/{package_id}")
def remove_attribute_package(
    package_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete an attribute package if not system and not populated with data (Admin only)."""
    success = delete_attribute_package(db, package_id)
    if not success:
        raise HTTPException(status_code=404, detail="Attribute package not found.")
    return {"status": "success", "message": f"Pacchetto {package_id} eliminato con successo."}


@router.post("/packages/{package_id}/items")
def add_package_attribute_item(
    package_id: str,
    payload: PackageItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Add an attribute definition to a package (Admin only)."""
    return create_package_item(db, package_id, payload.model_dump())


@router.put("/packages/{package_id}/items/{item_id}")
def edit_package_attribute_item(
    package_id: str,
    item_id: str,
    payload: PackageItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update an attribute definition in a package (Admin only)."""
    return update_package_item(db, package_id, item_id, payload.model_dump(exclude_unset=True))


@router.delete("/packages/{package_id}/items/{item_id}")
def remove_package_attribute_item(
    package_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete an attribute from a package (Admin only)."""
    success = delete_package_item(db, package_id, item_id)
    if not success:
        raise HTTPException(status_code=404, detail="Package attribute item not found.")
    return {"status": "success", "message": f"Attributo di pacchetto {item_id} rimosso."}


@router.post("/libraries/{model_id}/packages/{package_id}/toggle")
def toggle_package_activation(
    model_id: str,
    package_id: str,
    payload: Optional[LibraryPackageToggleRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Activate or deactivate an attribute package on a library.
    STRICT GUARD: Impossible to deactivate if even a single element in the library has
    a populated value for any attribute belonging to the package.
    """
    require_library_permission(db, current_user, "create_library_attribute", model_id)
    active_val = payload.active if payload else None
    return toggle_library_package(
        db,
        model_id=model_id,
        package_id=package_id,
        active=active_val,
        user_id=current_user.id
    )


@router.get("/packages/{package_id}/usage")
def get_package_usage_audit(
    package_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Audit which libraries have the package active and which populate attributes of this package."""
    return audit_package_usage(db, package_id)


# ==========================================
# STEREOTYPES & PROFILES ENDPOINTS
# ==========================================

@router.get("/stereotypes")
def get_stereotypes(
    base_type: Optional[str] = Query(None),
    model_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List element stereotypes filtered by ArchiMate concept base_type and scope."""
    return list_stereotypes(db, base_type=base_type, model_id=model_id)


@router.get("/stereotypes/{stereotype_id}")
def get_single_stereotype(
    stereotype_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve details and linked attributes for a single stereotype."""
    return get_stereotype(db, stereotype_id)


@router.post("/stereotypes")
def create_new_stereotype(
    payload: StereotypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new stereotype (Admin for global, or library-permission for scoped)."""
    if payload.model_id:
        require_library_permission(db, current_user, "create_library_attribute", payload.model_id)
    else:
        require_admin(current_user)
    return create_stereotype(db, payload.model_dump())


@router.put("/stereotypes/{stereotype_id}")
def edit_stereotype(
    stereotype_id: str,
    payload: StereotypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update stereotype metadata."""
    st = get_stereotype(db, stereotype_id)
    if st.get("model_id"):
        require_library_permission(db, current_user, "create_library_attribute", st["model_id"])
    else:
        require_admin(current_user)
    return update_stereotype(db, stereotype_id, payload.model_dump(exclude_unset=True))


@router.delete("/stereotypes/{stereotype_id}")
def remove_stereotype(
    stereotype_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a custom stereotype."""
    st = get_stereotype(db, stereotype_id)
    if st.get("model_id"):
        require_library_permission(db, current_user, "create_library_attribute", st["model_id"])
    else:
        require_admin(current_user)
    success = delete_stereotype(db, stereotype_id)
    if not success:
        raise HTTPException(status_code=404, detail="Stereotype not found.")
    return {"status": "success", "message": f"Stereotipo {stereotype_id} eliminato con successo."}


@router.post("/stereotypes/{stereotype_id}/attributes")
def link_attribute_to_stereotype(
    stereotype_id: str,
    payload: StereotypeAttributeLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Link an attribute definition to a stereotype with required/optional and default rule."""
    st = get_stereotype(db, stereotype_id)
    if st.get("model_id"):
        require_library_permission(db, current_user, "create_library_attribute", st["model_id"])
    else:
        require_admin(current_user)
    return add_stereotype_attribute_link(db, stereotype_id, payload.model_dump())


@router.delete("/stereotypes/{stereotype_id}/attributes/{link_id}")
def unlink_attribute_from_stereotype(
    stereotype_id: str,
    link_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove an attribute link from a stereotype."""
    st = get_stereotype(db, stereotype_id)
    if st.get("model_id"):
        require_library_permission(db, current_user, "create_library_attribute", st["model_id"])
    else:
        require_admin(current_user)
    success = delete_stereotype_attribute_link(db, stereotype_id, link_id)
    if not success:
        raise HTTPException(status_code=404, detail="Stereotype attribute link not found.")
    return {"status": "success", "message": f"Collegamento attributo {link_id} rimosso dallo stereotipo."}


