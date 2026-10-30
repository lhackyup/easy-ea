"""
EasyEA Package Manager Service
Handles definition, packaging, validation, safe SemVer upgrade, inspection, and export of .eap bundle archives.
"""
import io
import json
import re
import zipfile
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.models.archimate import (
    AttributePackage,
    AttributePackageItem,
    CustomAttributeDefinition,
    ElementStereotype,
    StereotypeAttributeLink,
    ArchimateElement,
    ArchimateRelationship,
    WorkspaceAttributePackage,
    PackageView
)


# --- Pydantic Schemas for Bundle Validation ---

class PackageManifestAuthor(BaseModel):
    name: str
    url: Optional[str] = None
    email: Optional[str] = None


class PackageManifest(BaseModel):
    id: Optional[str] = None
    code: str = Field(..., min_length=2, max_length=32)
    name: str = Field(..., min_length=2, max_length=128)
    version: str = Field(default="1.0.0", max_length=32)
    package_type: str = Field(default="attribute_only") # 'attribute_only' or 'framework'
    standard_version: Optional[str] = None
    description: Optional[str] = None
    author: Optional[Any] = None # str or PackageManifestAuthor
    license: Optional[str] = None
    website_url: Optional[str] = None
    icon_color: Optional[str] = "blue"
    is_default_active: Optional[bool] = False
    min_easyea_version: Optional[str] = "0.1.0"
    dependencies: Optional[List[str]] = []


class AttributeItemSpec(BaseModel):
    name: str
    label: str
    description: Optional[str] = None
    element_type: str = "ApplicationComponent"
    layer: str = "Application"
    data_type: str = "string" # string, number, boolean, date, select
    options: List[str] = []
    default_value: Optional[str] = None
    is_required: bool = False
    section: Optional[str] = None
    sort_order: int = 0


class StereotypeLinkSpec(BaseModel):
    attribute_name: str
    is_required: bool = False
    default_value: Optional[str] = None
    section_override: Optional[str] = None
    sort_order: int = 0


class StereotypeSpec(BaseModel):
    base_type: str
    name: str
    label: Optional[str] = None
    description: Optional[str] = None
    icon_color: Optional[str] = "blue"
    links: List[StereotypeLinkSpec] = []


class CanonicalElementSpec(BaseModel):
    id_alias: Optional[str] = None
    name: str
    type: str
    layer: str
    documentation: Optional[str] = None
    stereotype_name: Optional[str] = None
    properties: Dict[str, Any] = {}


class CanonicalRelationshipSpec(BaseModel):
    id_alias: Optional[str] = None
    source_alias: str
    target_alias: str
    type: str
    name: Optional[str] = None
    documentation: Optional[str] = None
    properties: Dict[str, Any] = {}


class PackageViewSpec(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = "General"
    view_type: str = "table" # "table", "matrix", "kpi_dashboard", "adr_manager"
    icon: Optional[str] = "Table"
    sort_order: Optional[int] = 0
    target_hub: Optional[str] = "business" # "business", "architecture", "both"
    target_stereotypes: List[str] = []
    target_types: Optional[List[str]] = []
    target_layer: Optional[str] = None
    columns: Optional[List[Dict[str, Any]]] = []
    default_sort: Optional[Dict[str, str]] = None
    filters: Optional[List[Dict[str, Any]]] = []
    filter_config: Optional[Dict[str, Any]] = None
    metrics: Optional[List[Dict[str, Any]]] = []
    charts: Optional[List[Dict[str, Any]]] = []
    matrix_config: Optional[Dict[str, Any]] = None


# --- Helper functions ---

def parse_semver(ver_str: str) -> Tuple[int, ...]:
    """Parse a version string (e.g. '1.2.3' or 'v1.0') into a comparable integer tuple."""
    if not ver_str:
        return (0, 0, 0)
    cleaned = re.sub(r'^[vV]', '', ver_str.strip())
    parts = []
    for chunk in cleaned.split('.'):
        digits = re.match(r'^\d+', chunk)
        if digits:
            parts.append(int(digits.group(0)))
        else:
            parts.append(0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:4])


def slugify(text: str) -> str:
    """Sanitize string to lowercase alphanumeric slug."""
    s = re.sub(r'[^\w\s-]', '', text.lower().strip())
    return re.sub(r'[-\s]+', '-', s)


# --- Core Package Manager Functions ---

def inspect_package_bundle(file_bytes: bytes, db: Session) -> Dict[str, Any]:
    """
    Dry-run inspection of an .eap (ZIP) package archive.
    Validates manifest, attributes, stereotypes, canonical reference elements,
    checks SemVer version against database, and reports diff and safety warnings.
    """
    errors: List[str] = []
    warnings: List[str] = []

    try:
        archive = zipfile.ZipFile(io.BytesIO(file_bytes))
    except Exception as exc:
        return {
            "valid": False,
            "errors": [f"File non valido: l'archivio non è un bundle ZIP / .eap leggibile ({exc})"],
            "warnings": [],
            "action": "invalid"
        }

    namelist = archive.namelist()

    # 1. Check & parse manifest.json
    manifest_name = next((n for n in namelist if n.lower().endswith("manifest.json") or n.lower() == "manifest.json"), None)
    if not manifest_name:
        return {
            "valid": False,
            "errors": ["Archivio .eap non conforme: file 'manifest.json' mancante nella radice del pacchetto."],
            "warnings": [],
            "action": "invalid"
        }

    try:
        manifest_raw = json.loads(archive.read(manifest_name).decode("utf-8"))
        manifest = PackageManifest(**manifest_raw)
    except Exception as exc:
        return {
            "valid": False,
            "errors": [f"Errore di validazione dello schema in manifest.json: {exc}"],
            "warnings": [],
            "action": "invalid"
        }

    # Normalize code
    code = slugify(manifest.code)
    pkg_id = manifest.id or f"pkg-{code}"

    # 2. Check & parse attributes.json
    attributes: List[AttributeItemSpec] = []
    attr_filename = next((n for n in namelist if n.lower().endswith("attributes.json")), None)
    if attr_filename:
        try:
            attr_raw = json.loads(archive.read(attr_filename).decode("utf-8"))
            if isinstance(attr_raw, list):
                for item in attr_raw:
                    attributes.append(AttributeItemSpec(**item))
            else:
                errors.append("attributes.json deve contenere un array JSON di attributi.")
        except Exception as exc:
            errors.append(f"Errore nel parsing di attributes.json: {exc}")

    # 3. Check & parse stereotypes.json
    stereotypes: List[StereotypeSpec] = []
    stereo_filename = next((n for n in namelist if n.lower().endswith("stereotypes.json")), None)
    if stereo_filename:
        try:
            stereo_raw = json.loads(archive.read(stereo_filename).decode("utf-8"))
            if isinstance(stereo_raw, list):
                for item in stereo_raw:
                    stereotypes.append(StereotypeSpec(**item))
            else:
                errors.append("stereotypes.json deve contenere un array JSON di stereotipi.")
        except Exception as exc:
            errors.append(f"Errore nel parsing di stereotypes.json: {exc}")

    # 4. Check & parse reference_model (elements.json & relationships.json)
    elements: List[CanonicalElementSpec] = []
    relationships: List[CanonicalRelationshipSpec] = []

    elem_filename = next((n for n in namelist if "elements.json" in n.lower()), None)
    if elem_filename:
        try:
            elem_raw = json.loads(archive.read(elem_filename).decode("utf-8"))
            if isinstance(elem_raw, list):
                for item in elem_raw:
                    elements.append(CanonicalElementSpec(**item))
            else:
                errors.append("elements.json deve contenere un array JSON di elementi canonici.")
        except Exception as exc:
            errors.append(f"Errore nel parsing di reference_model/elements.json: {exc}")

    rel_filename = next((n for n in namelist if "relationships.json" in n.lower()), None)
    if rel_filename:
        try:
            rel_raw = json.loads(archive.read(rel_filename).decode("utf-8"))
            if isinstance(rel_raw, list):
                for item in rel_raw:
                    relationships.append(CanonicalRelationshipSpec(**item))
            else:
                errors.append("relationships.json deve contenere un array JSON di relazioni canoniche.")
        except Exception as exc:
            errors.append(f"Errore nel parsing di reference_model/relationships.json: {exc}")

    # 5. Check & parse views.json (optional)
    views: List[PackageViewSpec] = []
    views_filename = next((n for n in namelist if n.lower().endswith("views.json") or n.lower() == "views.json"), None)
    if views_filename:
        try:
            views_raw = json.loads(archive.read(views_filename).decode("utf-8"))
            if isinstance(views_raw, list):
                for item in views_raw:
                    views.append(PackageViewSpec(**item))
            else:
                errors.append("views.json deve contenere un array JSON di definizioni di viste.")
        except Exception as exc:
            errors.append(f"Errore nel parsing di views.json: {exc}")

    # 6. Read README.md if present
    readme_content = ""
    readme_filename = next((n for n in namelist if n.lower().endswith("readme.md")), None)
    if readme_filename:
        try:
            readme_content = archive.read(readme_filename).decode("utf-8", errors="replace")
        except Exception:
            pass

    if errors:
        return {
            "valid": False,
            "errors": errors,
            "warnings": warnings,
            "action": "invalid"
        }

    # 6. Database comparison & SemVer inspection
    existing_pkg = db.query(AttributePackage).filter(
        (AttributePackage.id == pkg_id) | (AttributePackage.code == code)
    ).first()

    action = "new_install"
    existing_info = None

    if existing_pkg:
        existing_info = {
            "id": existing_pkg.id,
            "code": existing_pkg.code,
            "name": existing_pkg.name,
            "version": getattr(existing_pkg, "version", "1.0.0") or "1.0.0",
            "package_type": existing_pkg.package_type,
            "items_count": len(existing_pkg.items),
            "stereotypes_count": len(existing_pkg.stereotypes),
            "reference_elements_count": len(existing_pkg.reference_elements),
            "reference_relationships_count": len(existing_pkg.reference_relationships),
            "views_count": len(getattr(existing_pkg, "views", []))
        }

        v_curr = parse_semver(existing_info["version"])
        v_new = parse_semver(manifest.version)

        if v_new > v_curr:
            action = "upgrade"
        elif v_new == v_curr:
            action = "reinstall"
            warnings.append(f"La versione caricata ({manifest.version}) è identica a quella attualmente installata.")
        else:
            action = "downgrade"
            warnings.append(f"Attenzione: la versione caricata ({manifest.version}) è inferiore alla versione attualmente installata ({existing_info['version']}).")

        # Safety Check: check if any attributes currently in DB are missing in the new bundle and used in libraries
        new_attr_names = {a.name if a.name.startswith(f"{code}_") else f"{code}_{a.name}" for a in attributes}
        for old_item in existing_pkg.items:
            if old_item.name not in new_attr_names:
                # Check usage
                usage_count = db.query(ArchimateElement).filter(
                    ArchimateElement.properties.op('->>')(old_item.name) != None
                ).count()
                if usage_count > 0:
                    warnings.append(f"L'attributo '{old_item.label}' ({old_item.name}) verrà rimosso ma è utilizzato da {usage_count} elementi in catalogo.")

        # Safety Check: check if any canonical elements currently in DB are missing in the new bundle and have relations
        new_elem_names = {e.name for e in elements}
        for old_el in existing_pkg.reference_elements:
            if old_el.name not in new_elem_names:
                # Check relations
                rel_count = db.query(ArchimateRelationship).filter(
                    (ArchimateRelationship.source_id == old_el.id) | (ArchimateRelationship.target_id == old_el.id)
                ).count()
                if rel_count > 0:
                    warnings.append(f"L'elemento canonico '{old_el.name}' verrà rimosso ma possiede {rel_count} relazioni connesse.")

    # Convert author to string if it's a dict
    author_str = manifest.author.get("name") if isinstance(manifest.author, dict) else str(manifest.author or "")

    return {
        "valid": True,
        "action": action,
        "manifest": {
            "id": pkg_id,
            "code": code,
            "name": manifest.name,
            "version": manifest.version,
            "package_type": manifest.package_type,
            "standard_version": manifest.standard_version,
            "description": manifest.description,
            "author": author_str,
            "license": manifest.license,
            "website_url": manifest.website_url,
            "icon_color": manifest.icon_color or "blue",
            "is_default_active": manifest.is_default_active or False
        },
        "counts": {
            "attributes": len(attributes),
            "stereotypes": len(stereotypes),
            "reference_elements": len(elements),
            "reference_relationships": len(relationships),
            "views": len(views)
        },
        "existing_package": existing_info,
        "readme": readme_content,
        "warnings": warnings,
        "errors": []
    }


def install_package_bundle(file_bytes: bytes, db: Session, force: bool = False) -> AttributePackage:
    """
    Atomically installs or upgrades a package from an .eap ZIP archive.
    Executes inspection, validates SemVer rules, creates/updates AttributePackage,
    AttributePackageItem, CustomAttributeDefinition, ElementStereotype,
    StereotypeAttributeLink, ArchimateElement, and ArchimateRelationship.
    """
    inspect_res = inspect_package_bundle(file_bytes, db)
    if not inspect_res["valid"]:
        raise ValueError(f"Pacchetto .eap non valido: {', '.join(inspect_res['errors'])}")

    action = inspect_res["action"]
    if action == "downgrade" and not force:
        raise ValueError(f"Installazione bloccata: la versione ({inspect_res['manifest']['version']}) è un downgrade rispetto alla versione installata ({inspect_res['existing_package']['version']}). Usa il parametro force=true per confermare.")

    archive = zipfile.ZipFile(io.BytesIO(file_bytes))
    namelist = archive.namelist()

    manifest_data = inspect_res["manifest"]
    code = manifest_data["code"]
    pkg_id = manifest_data["id"]

    # 1. Upsert AttributePackage
    pkg = db.query(AttributePackage).filter(
        (AttributePackage.id == pkg_id) | (AttributePackage.code == code)
    ).first()

    if not pkg:
        pkg = AttributePackage(
            id=pkg_id,
            code=code,
            name=manifest_data["name"],
            version=manifest_data["version"],
            author=manifest_data.get("author"),
            license=manifest_data.get("license"),
            package_type=manifest_data["package_type"],
            standard_version=manifest_data.get("standard_version"),
            description=manifest_data.get("description"),
            website_url=manifest_data.get("website_url"),
            icon_color=manifest_data.get("icon_color") or "blue",
            is_default_active=manifest_data.get("is_default_active", False),
            is_system=False
        )
        db.add(pkg)
        db.flush()
    else:
        pkg.code = code
        pkg.name = manifest_data["name"]
        pkg.version = manifest_data["version"]
        pkg.author = manifest_data.get("author")
        pkg.license = manifest_data.get("license")
        pkg.package_type = manifest_data["package_type"]
        pkg.standard_version = manifest_data.get("standard_version")
        pkg.description = manifest_data.get("description")
        pkg.website_url = manifest_data.get("website_url")
        pkg.icon_color = manifest_data.get("icon_color") or pkg.icon_color or "blue"
        pkg.is_default_active = manifest_data.get("is_default_active", pkg.is_default_active)

    # 2. Upsert Attributes
    attr_filename = next((n for n in namelist if n.lower().endswith("attributes.json")), None)
    if attr_filename:
        attr_raw = json.loads(archive.read(attr_filename).decode("utf-8"))
        for item_data in attr_raw:
            attr_spec = AttributeItemSpec(**item_data)
            # Ensure name has prefix if not present
            attr_name = attr_spec.name
            if not attr_name.startswith(f"{code}_"):
                attr_name = f"{code}_{attr_name}"

            item_id = f"item-{code}-{slugify(attr_spec.name)}"
            existing_item = db.query(AttributePackageItem).filter(
                AttributePackageItem.package_id == pkg.id,
                AttributePackageItem.name == attr_name
            ).first()

            section_name = attr_spec.section or f"{pkg.name} Metadata"

            if not existing_item:
                new_item = AttributePackageItem(
                    id=item_id,
                    package_id=pkg.id,
                    name=attr_name,
                    label=attr_spec.label,
                    description=attr_spec.description,
                    element_type=attr_spec.element_type,
                    layer=attr_spec.layer,
                    data_type=attr_spec.data_type,
                    options=attr_spec.options,
                    default_value=attr_spec.default_value,
                    is_required=attr_spec.is_required,
                    section=section_name,
                    sort_order=attr_spec.sort_order
                )
                db.add(new_item)
            else:
                existing_item.label = attr_spec.label
                existing_item.description = attr_spec.description
                existing_item.element_type = attr_spec.element_type
                existing_item.layer = attr_spec.layer
                existing_item.data_type = attr_spec.data_type
                existing_item.options = attr_spec.options
                existing_item.default_value = attr_spec.default_value
                existing_item.is_required = attr_spec.is_required
                existing_item.section = section_name
                existing_item.sort_order = attr_spec.sort_order

    db.flush()

    # 3. Upsert Stereotypes
    stereo_filename = next((n for n in namelist if n.lower().endswith("stereotypes.json")), None)
    if stereo_filename:
        stereo_raw = json.loads(archive.read(stereo_filename).decode("utf-8"))
        for st_data in stereo_raw:
            st_spec = StereotypeSpec(**st_data)
            stereo_id = f"stereo-{code}-{slugify(st_spec.name)}"
            stereo_label = st_spec.label or f"«{st_spec.name}»"

            st = db.query(ElementStereotype).filter(
                ElementStereotype.package_id == pkg.id,
                ElementStereotype.name == st_spec.name
            ).first()

            if not st:
                st = ElementStereotype(
                    id=stereo_id,
                    base_type=st_spec.base_type,
                    name=st_spec.name,
                    label=stereo_label,
                    description=st_spec.description,
                    icon_color=st_spec.icon_color or pkg.icon_color or "blue",
                    is_system=False,
                    package_id=pkg.id,
                    model_id=None
                )
                db.add(st)
                db.flush()
            else:
                st.base_type = st_spec.base_type
                st.label = stereo_label
                st.description = st_spec.description
                st.icon_color = st_spec.icon_color or pkg.icon_color or "blue"

            # Sync links
            for l_spec in st_spec.links:
                attr_name = l_spec.attribute_name
                if not attr_name.startswith(f"{code}_"):
                    attr_name = f"{code}_{attr_name}"

                link = db.query(StereotypeAttributeLink).filter(
                    StereotypeAttributeLink.stereotype_id == st.id,
                    StereotypeAttributeLink.attribute_name == attr_name
                ).first()
                if not link:
                    link = StereotypeAttributeLink(
                        id=f"link-{st.id}-{attr_name}",
                        stereotype_id=st.id,
                        attribute_name=attr_name,
                        is_required=l_spec.is_required,
                        default_value=l_spec.default_value,
                        section_override=l_spec.section_override or st_spec.name,
                        sort_order=l_spec.sort_order
                    )
                    db.add(link)
                else:
                    link.is_required = l_spec.is_required
                    link.default_value = l_spec.default_value
                    link.section_override = l_spec.section_override or st_spec.name
                    link.sort_order = l_spec.sort_order

    db.flush()

    # 4. Upsert Canonical Elements & Relationships (if framework)
    elem_alias_to_id: Dict[str, str] = {}
    elem_filename = next((n for n in namelist if "elements.json" in n.lower()), None)
    if elem_filename and pkg.package_type == "framework":
        elem_raw = json.loads(archive.read(elem_filename).decode("utf-8"))
        for elem_data in elem_raw:
            el_spec = CanonicalElementSpec(**elem_data)
            elem_id = el_spec.id_alias or f"elem-{code}-{slugify(el_spec.name)}"
            alias_key = el_spec.id_alias or el_spec.name

            # Find matching stereotype
            st_id = None
            if el_spec.stereotype_name:
                match_st = db.query(ElementStereotype).filter(
                    ElementStereotype.package_id == pkg.id,
                    (ElementStereotype.name == el_spec.stereotype_name) | (ElementStereotype.label == el_spec.stereotype_name)
                ).first()
                if match_st:
                    st_id = match_st.id

            el = db.query(ArchimateElement).filter(
                ArchimateElement.package_id == pkg.id,
                ArchimateElement.name == el_spec.name
            ).first()

            if not el:
                el = ArchimateElement(
                    id=elem_id,
                    model_id=None,
                    name=el_spec.name,
                    type=el_spec.type,
                    layer=el_spec.layer,
                    documentation=el_spec.documentation,
                    properties=el_spec.properties,
                    stereotype_id=st_id,
                    is_reference=True,
                    package_id=pkg.id
                )
                db.add(el)
                db.flush()
            else:
                el.type = el_spec.type
                el.layer = el_spec.layer
                el.documentation = el_spec.documentation
                el.properties = el_spec.properties
                el.stereotype_id = st_id
                el.is_reference = True

            elem_alias_to_id[alias_key] = el.id
            elem_alias_to_id[el.name] = el.id
            elem_alias_to_id[el.id] = el.id

    db.flush()

    rel_filename = next((n for n in namelist if "relationships.json" in n.lower()), None)
    if rel_filename and pkg.package_type == "framework":
        rel_raw = json.loads(archive.read(rel_filename).decode("utf-8"))
        for rel_data in rel_raw:
            rel_spec = CanonicalRelationshipSpec(**rel_data)
            src_id = elem_alias_to_id.get(rel_spec.source_alias)
            tgt_id = elem_alias_to_id.get(rel_spec.target_alias)

            if not src_id or not tgt_id:
                # Fallback search by name
                if not src_id:
                    s_el = db.query(ArchimateElement).filter(ArchimateElement.package_id == pkg.id, ArchimateElement.name == rel_spec.source_alias).first()
                    if s_el:
                        src_id = s_el.id
                if not tgt_id:
                    t_el = db.query(ArchimateElement).filter(ArchimateElement.package_id == pkg.id, ArchimateElement.name == rel_spec.target_alias).first()
                    if t_el:
                        tgt_id = t_el.id

            if src_id and tgt_id:
                rel_id = rel_spec.id_alias or f"rel-{code}-{src_id[:8]}-{tgt_id[:8]}"
                r = db.query(ArchimateRelationship).filter(
                    ArchimateRelationship.package_id == pkg.id,
                    ArchimateRelationship.source_id == src_id,
                    ArchimateRelationship.target_id == tgt_id,
                    ArchimateRelationship.type == rel_spec.type
                ).first()

                if not r:
                    r = ArchimateRelationship(
                        id=rel_id,
                        model_id=None,
                        source_id=src_id,
                        target_id=tgt_id,
                        type=rel_spec.type,
                        name=rel_spec.name,
                        documentation=rel_spec.documentation,
                        properties=rel_spec.properties,
                        is_reference=True,
                        package_id=pkg.id
                    )
                    db.add(r)
                else:
                    r.name = rel_spec.name
                    r.documentation = rel_spec.documentation
                    r.properties = rel_spec.properties
                    r.is_reference = True

    # 5. Sync Views from views.json (if present)
    views_filename = next((n for n in namelist if n.lower().endswith("views.json") or n.lower() == "views.json"), None)
    if views_filename:
        try:
            views_raw = json.loads(archive.read(views_filename).decode("utf-8"))
            if isinstance(views_raw, list):
                # Delete existing views for this package
                db.query(PackageView).filter(PackageView.package_id == pkg.id).delete()
                db.flush()
                for idx, v_item in enumerate(views_raw):
                    v_spec = PackageViewSpec(**v_item)
                    pv_id = f"pkv-{code}-{v_spec.id}"
                    view_sort = v_spec.sort_order if (v_spec.sort_order is not None and v_spec.sort_order != 0) else (idx + 1)
                    cfg = v_spec.model_dump()
                    if v_spec.filter_config:
                        cfg["filter_config"] = v_spec.filter_config
                    elif v_spec.filters:
                        cfg["filter_config"] = {
                            "attributeFilterRules": v_spec.filters,
                            "matchLogic": "AND"
                        }
                    if v_spec.target_layer:
                        if "filter_config" not in cfg or not cfg["filter_config"]:
                            cfg["filter_config"] = {}
                        cfg["filter_config"]["selectedLayer"] = v_spec.target_layer

                    pv = PackageView(
                        id=pv_id,
                        package_id=pkg.id,
                        view_key=v_spec.id,
                        name=v_spec.name,
                        description=v_spec.description,
                        category=v_spec.category or "General",
                        view_type=v_spec.view_type or "table",
                        icon=v_spec.icon or "Table",
                        target_hub=v_spec.target_hub or "business",
                        target_stereotypes=v_spec.target_stereotypes or [],
                        target_types=v_spec.target_types or [],
                        config=cfg,
                        sort_order=view_sort
                    )
                    db.add(pv)
        except Exception as exc:
            pass

    db.commit()
    db.refresh(pkg)
    return pkg


def export_package_bundle(package_id: str, db: Session) -> Tuple[bytes, str]:
    """
    Exports an existing package from EasyEA into a downloadable .eap (ZIP) archive.
    Returns (zip_bytes, recommended_filename).
    """
    pkg = db.query(AttributePackage).filter(
        (AttributePackage.id == package_id) | (AttributePackage.code == package_id)
    ).first()

    if not pkg:
        raise ValueError(f"Pacchetto con ID o codice '{package_id}' non trovato.")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # 1. manifest.json
        manifest = {
            "$schema": "https://easyea.org/schemas/package-manifest-v1.json",
            "id": pkg.id,
            "code": pkg.code,
            "name": pkg.name,
            "version": getattr(pkg, "version", "1.0.0") or "1.0.0",
            "package_type": pkg.package_type or "attribute_only",
            "standard_version": pkg.standard_version,
            "description": pkg.description,
            "author": getattr(pkg, "author", None),
            "license": getattr(pkg, "license", "Open Standard"),
            "website_url": pkg.website_url,
            "icon_color": pkg.icon_color or "blue",
            "is_default_active": pkg.is_default_active or False
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))

        # 2. attributes.json
        attributes_list = []
        for it in pkg.items:
            # Strip package code prefix if present for clean export
            raw_name = it.name
            if raw_name.startswith(f"{pkg.code}_"):
                raw_name = raw_name[len(pkg.code) + 1:]

            attributes_list.append({
                "name": raw_name,
                "label": it.label,
                "description": it.description,
                "element_type": it.element_type,
                "layer": it.layer,
                "data_type": it.data_type,
                "options": it.options or [],
                "default_value": it.default_value,
                "is_required": it.is_required,
                "section": it.section,
                "sort_order": it.sort_order
            })
        zf.writestr("attributes.json", json.dumps(attributes_list, indent=2, ensure_ascii=False))

        # 3. stereotypes.json
        stereotypes_list = []
        for st in pkg.stereotypes:
            links = []
            for l in getattr(st, "attribute_links", []):
                attr_name = l.attribute_name
                if attr_name.startswith(f"{pkg.code}_"):
                    attr_name = attr_name[len(pkg.code) + 1:]
                links.append({
                    "attribute_name": attr_name,
                    "is_required": l.is_required,
                    "default_value": l.default_value,
                    "section_override": l.section_override,
                    "sort_order": l.sort_order
                })

            stereotypes_list.append({
                "base_type": st.base_type,
                "name": st.name,
                "label": st.label,
                "description": st.description,
                "icon_color": st.icon_color or pkg.icon_color,
                "links": links
            })
        zf.writestr("stereotypes.json", json.dumps(stereotypes_list, indent=2, ensure_ascii=False))

        # 4. reference_model/ (elements.json & relationships.json)
        if pkg.package_type == "framework":
            elements_list = []
            elem_id_to_name: Dict[str, str] = {}
            for el in pkg.reference_elements:
                st_name = el.stereotype.name if el.stereotype else None
                elem_id_to_name[el.id] = el.name
                elements_list.append({
                    "id_alias": el.id,
                    "name": el.name,
                    "type": el.type,
                    "layer": el.layer,
                    "documentation": el.documentation,
                    "stereotype_name": st_name,
                    "properties": el.properties or {}
                })
            zf.writestr("reference_model/elements.json", json.dumps(elements_list, indent=2, ensure_ascii=False))

            relationships_list = []
            for r in pkg.reference_relationships:
                relationships_list.append({
                    "id_alias": r.id,
                    "source_alias": elem_id_to_name.get(r.source_id, r.source_id),
                    "target_alias": elem_id_to_name.get(r.target_id, r.target_id),
                    "type": r.type,
                    "name": r.name,
                    "documentation": r.documentation,
                    "properties": r.properties or {}
                })
            zf.writestr("reference_model/relationships.json", json.dumps(relationships_list, indent=2, ensure_ascii=False))

        # 5. views.json (if present)
        pkg_views = getattr(pkg, "views", [])
        if pkg_views:
            views_list = []
            sorted_views = sorted(pkg_views, key=lambda v: (v.sort_order if v.sort_order is not None else 0, v.name))
            for pv in sorted_views:
                v_data = dict(pv.config) if pv.config else {}
                v_data["id"] = pv.view_key
                v_data["name"] = pv.name
                v_data["description"] = pv.description
                v_data["category"] = pv.category or "General"
                v_data["view_type"] = pv.view_type or "table"
                v_data["icon"] = pv.icon or "Table"
                v_data["sort_order"] = pv.sort_order
                v_data["target_hub"] = getattr(pv, "target_hub", None) or "business"
                v_data["target_stereotypes"] = pv.target_stereotypes or []
                v_data["target_types"] = pv.target_types or []
                if pv.config and "filter_config" in pv.config:
                    v_data["filter_config"] = pv.config["filter_config"]
                views_list.append(v_data)
            zf.writestr("views.json", json.dumps(views_list, indent=2, ensure_ascii=False))

        # 6. README.md
        readme = f"""# {pkg.name} ({pkg.code.upper()})
Version: {manifest['version']}
Standard: {pkg.standard_version or 'N/A'}
Type: {pkg.package_type}

## Description
{pkg.description or 'No description provided.'}

## Package Specifications
- **Included Attributes**: {len(pkg.items)}
- **Architectural Stereotypes**: {len(pkg.stereotypes)}
- **Canonical Reference Elements**: {len(pkg.reference_elements)}
- **Canonical Reference Relationships**: {len(pkg.reference_relationships)}
- **Business Views & Dashboards**: {len(pkg_views)}

## Documentation & References
- Website: {pkg.website_url or 'N/A'}
- Author: {manifest['author'] or 'EasyEA Community'}
- License: {manifest['license']}
"""
        zf.writestr("README.md", readme)

    filename = f"{pkg.code}-{manifest['version']}.eap"
    return buf.getvalue(), filename
