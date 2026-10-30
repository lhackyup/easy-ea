"""
Business Package Views API Router
Provides endpoints to list and execute package-defined business views for active workspace models.
"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.archimate import (
    ModelWorkspace,
    AttributePackage,
    WorkspaceAttributePackage,
    PackageView,
    ElementStereotype,
    ArchimateElement,
    ArchimateRelationship
)

import uuid
import re
from sqlalchemy import or_, and_

router = APIRouter(prefix="/business/package-views", tags=["business-views"])


class ViewExecuteRequest(BaseModel):
    search: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    sort_field: Optional[str] = None
    sort_direction: Optional[str] = "asc" # "asc" | "desc"


class CustomViewPayload(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = "General"
    view_type: str = "table" # "table" | "matrix" | "kpi_dashboard" | "adr_manager"
    icon: Optional[str] = "Table"
    sort_order: Optional[int] = 0
    target_hub: Optional[str] = "business" # "business" | "architecture" | "both"
    is_global: Optional[bool] = False
    is_active: Optional[bool] = False
    package_id: Optional[str] = None
    target_stereotypes: Optional[List[str]] = []
    target_types: Optional[List[str]] = []
    config: Optional[Dict[str, Any]] = {}


class CustomViewUpdatePayload(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    view_type: Optional[str] = None
    icon: Optional[str] = None
    sort_order: Optional[int] = None
    target_hub: Optional[str] = None
    is_global: Optional[bool] = None
    is_active: Optional[bool] = None
    package_id: Optional[str] = None
    target_stereotypes: Optional[List[str]] = None
    target_types: Optional[List[str]] = None
    config: Optional[Dict[str, Any]] = None


class ViewStatusPayload(BaseModel):
    is_active: bool


class ViewTargetHubPayload(BaseModel):
    target_hub: str # "business" | "architecture" | "both"


def _flatten_string_list(val: Any) -> List[str]:
    """Recursively flattens any nested list, tuple, or set of strings into a flat list of non-empty strings."""
    if not val:
        return []
    if isinstance(val, str):
        return [val] if val.strip() else []
    res = []
    if isinstance(val, (list, tuple, set)):
        for item in val:
            if isinstance(item, (list, tuple, set)):
                res.extend(_flatten_string_list(item))
            elif isinstance(item, str):
                if item.strip():
                    res.append(item.strip())
            elif item is not None:
                res.append(str(item))
    return res


def _get_active_package_ids(db: Session, model_id: str) -> List[str]:
    """Retrieve package IDs active for the given model workspace."""
    links = db.query(WorkspaceAttributePackage.package_id).filter(
        WorkspaceAttributePackage.model_id == model_id
    ).all()
    if links:
        # If the workspace has explicit package activations, ONLY those are active
        return [l[0] for l in links]

    # If no packages have been explicitly configured for this workspace yet, fallback to default active packages
    defaults = db.query(AttributePackage.id).filter(
        AttributePackage.is_default_active == True
    ).all()
    return [d[0] for d in defaults]


def _build_match_filter(v: Any, id_to_stereo: dict, name_to_stereo: dict):
    """Builds an SQLAlchemy filter combining target stereotypes, target types, and target layer."""
    filters = []
    target_ids = []

    target_stereos = _flatten_string_list(v.get("target_stereotypes") if isinstance(v, dict) else getattr(v, "target_stereotypes", None))
    target_types = _flatten_string_list(v.get("target_types") if isinstance(v, dict) else getattr(v, "target_types", None))
    config = v.get("config") if isinstance(v, dict) else getattr(v, "config", None)
    filter_config = (config or {}).get("filter_config") if isinstance(config, dict) else {}

    target_layer = None
    if isinstance(filter_config, dict) and filter_config.get("selectedLayer"):
        target_layer = filter_config.get("selectedLayer")
    if not target_layer and isinstance(v, dict) and v.get("target_layer"):
        target_layer = v.get("target_layer")
    elif not target_layer and hasattr(v, "target_layer"):
        target_layer = getattr(v, "target_layer", None)

    # Fallback to selectedType in filter_config if target_types was not set
    if not target_types and isinstance(filter_config, dict) and filter_config.get("selectedType"):
        st = filter_config.get("selectedType")
        if st and str(st).lower() != "all":
            target_types = _flatten_string_list([st])

    # Fallback to selectedStereotypeFilter in filter_config if target_stereos was not set
    if not target_stereos and isinstance(filter_config, dict) and filter_config.get("selectedStereotypeFilter"):
        sst = filter_config.get("selectedStereotypeFilter")
        if sst and str(sst).lower() != "all":
            target_stereos = _flatten_string_list([sst])

    for st_target in (target_stereos or []):
        if st_target in id_to_stereo:
            target_ids.append(id_to_stereo[st_target].id)
        elif st_target in name_to_stereo:
            target_ids.append(name_to_stereo[st_target].id)
        else:
            target_ids.append(st_target)

    if target_ids:
        filters.append(ArchimateElement.stereotype_id.in_(target_ids))
    if target_types:
        filters.append(ArchimateElement.type.in_(target_types))

    type_match = or_(*filters) if filters else None

    if target_layer and str(target_layer).lower() != "all":
        layer_match = (ArchimateElement.layer.ilike(str(target_layer)))
        if type_match is not None:
            return and_(type_match, layer_match)
        return layer_match

    return type_match


def _get_attr_value(row: Dict[str, Any], attr_name: str) -> Any:
    """Extracts attribute value trying exact name and standard APM/EEA prefix variations."""
    if not attr_name:
        return None
    if attr_name in row and row[attr_name] is not None:
        return row[attr_name]
    eea_key = f"eea_{attr_name}"
    if eea_key in row and row[eea_key] is not None:
        return row[eea_key]
    stripped_eea = re.sub(r"^eea_", "", attr_name)
    if stripped_eea in row and row[stripped_eea] is not None:
        return row[stripped_eea]
    apm_key = f"apm_{attr_name}"
    if apm_key in row and row[apm_key] is not None:
        return row[apm_key]
    stripped_apm = re.sub(r"^apm_", "", attr_name)
    if stripped_apm in row and row[stripped_apm] is not None:
        return row[stripped_apm]
    return None


def _evaluate_attribute_rule(row: Dict[str, Any], rule: Dict[str, Any]) -> bool:
    """Evaluates a single attribute filter rule against an element row."""
    attr_name = rule.get("attributeName")
    if not attr_name:
        return True
    op = rule.get("operator") or "equals"
    rule_val = rule.get("value")
    second_val = rule.get("secondValue")

    raw_val = _get_attr_value(row, attr_name)

    if op == "empty":
        return raw_val is None or str(raw_val).strip() == ""
    if op == "not_empty":
        return raw_val is not None and str(raw_val).strip() != ""

    if raw_val is None:
        return False

    str_raw = str(raw_val).strip()
    str_rule = str(rule_val).strip() if rule_val is not None else ""

    if op == "contains":
        return str_rule.lower() in str_raw.lower()
    if op == "starts_with":
        return str_raw.lower().startswith(str_rule.lower())
    if op == "equals":
        try:
            return float(str_raw) == float(str_rule)
        except (ValueError, TypeError):
            return str_raw.lower() == str_rule.lower()
    if op == "not_equals":
        try:
            return float(str_raw) != float(str_rule)
        except (ValueError, TypeError):
            return str_raw.lower() != str_rule.lower()
    if op == "is_true":
        return str_raw.lower() in ("true", "1", "yes", "si")
    if op == "is_false":
        return str_raw.lower() in ("false", "0", "no")

    try:
        num_raw = float(str_raw)
    except (ValueError, TypeError):
        num_raw = None

    if op == "gt":
        try:
            return num_raw is not None and num_raw > float(str_rule)
        except (ValueError, TypeError):
            return False
    if op == "lt":
        try:
            return num_raw is not None and num_raw < float(str_rule)
        except (ValueError, TypeError):
            return False
    if op == "gte":
        try:
            return num_raw is not None and num_raw >= float(str_rule)
        except (ValueError, TypeError):
            return False
    if op == "lte":
        try:
            return num_raw is not None and num_raw <= float(str_rule)
        except (ValueError, TypeError):
            return False
    if op == "between":
        try:
            min_val = float(str_rule) if str_rule != "" else float("-inf")
            max_val = float(second_val) if second_val not in (None, "") else float("inf")
            return num_raw is not None and (min_val <= num_raw <= max_val)
        except (ValueError, TypeError):
            return False

    if op in ("after", "before"):
        try:
            from datetime import datetime
            d_raw = datetime.fromisoformat(str_raw[:10])
            d_rule = datetime.fromisoformat(str_rule[:10])
            return d_raw > d_rule if op == "after" else d_raw < d_rule
        except Exception:
            return str_raw > str_rule if op == "after" else str_raw < str_rule

    return True


def _apply_filter_config(
    rows: List[Dict[str, Any]],
    filter_config: Dict[str, Any],
    db: Session,
    model_id: str,
    connected_ids: Optional[set] = None
) -> List[Dict[str, Any]]:
    """Filters rows according to saved repository search filter rules."""
    if not filter_config:
        return rows

    # 1. Connected / Orphan relationship check
    rel_filter = filter_config.get("relationshipFilter")
    if rel_filter in ("orphan", "connected") and connected_ids is None:
        rels = db.query(ArchimateRelationship.source_id, ArchimateRelationship.target_id).filter(
            ArchimateRelationship.model_id == model_id
        ).all()
        connected_ids = {s for s, t in rels if s} | {t for s, t in rels if t}

    # 2. Text Search
    search_term = str(filter_config.get("search") or "").strip().lower()
    search_in_props = filter_config.get("searchInProps", False)

    # 3. Documentation
    doc_filter = filter_config.get("documentationFilter")

    # 4. Layer, Type, Stereotype
    layer_filter = filter_config.get("selectedLayer")
    type_filter = filter_config.get("selectedType")
    stereo_filter = filter_config.get("selectedStereotypeFilter")

    # 5. Multi-attribute filter rules
    attribute_rules = filter_config.get("attributeFilterRules") or []
    match_logic = (filter_config.get("matchLogic") or "AND").upper()

    filtered = []
    for r in rows:
        # Layer
        if layer_filter and str(layer_filter).lower() != "all":
            if str(r.get("layer") or "").lower() != str(layer_filter).lower():
                continue

        # Type
        if type_filter and str(type_filter).lower() != "all":
            if r.get("type") != type_filter:
                continue

        # Stereotype
        if stereo_filter and str(stereo_filter).lower() != "all":
            if r.get("stereotype_id") != stereo_filter:
                continue

        # Documentation
        has_doc = bool(r.get("documentation") and str(r.get("documentation")).strip())
        if doc_filter == "with_doc" and not has_doc:
            continue
        if doc_filter in ("no_doc", "without_doc") and has_doc:
            continue

        # Relationship
        if rel_filter in ("orphan", "connected"):
            is_connected = r["id"] in connected_ids
            if rel_filter == "orphan" and is_connected:
                continue
            if rel_filter == "connected" and not is_connected:
                continue

        # Search
        if search_term:
            name_m = search_term in str(r.get("name") or "").lower()
            id_m = search_term in str(r.get("id") or "").lower()
            doc_m = search_term in str(r.get("documentation") or "").lower()
            props_m = False
            if search_in_props:
                for v in r.values():
                    if v is not None and search_term in str(v).lower():
                        props_m = True
                        break
            if not (name_m or id_m or doc_m or props_m):
                continue

        # Multi-attribute rules
        if attribute_rules:
            rule_evals = [_evaluate_attribute_rule(r, rule) for rule in attribute_rules]
            if match_logic == "AND":
                if not all(rule_evals):
                    continue
            else:
                if not any(rule_evals):
                    continue

        filtered.append(r)

    return filtered


def _build_element_row(el: ArchimateElement) -> Dict[str, Any]:
    """Constructs a normalized row from an ArchimateElement, merging properties and APM fields."""
    row: Dict[str, Any] = {
        "id": el.id,
        "name": el.name,
        "type": el.type,
        "layer": el.layer,
        "documentation": el.documentation or "",
        "stereotype_id": el.stereotype_id,
        "stereotype_name": el.stereotype.name if el.stereotype else None
    }

    # Merge APM attributes if present
    apm = getattr(el, "apm_attributes", None)
    if apm:
        apm_dict = {
            "apm_business_fit": apm.business_fit,
            "apm_technical_fit": apm.technical_fit,
            "apm_time_quadrant": apm.time_quadrant,
            "apm_annual_cost": apm.annual_cost,
            "apm_business_criticality": apm.business_criticality,
            "apm_lifecycle_status": apm.lifecycle_status,
            "apm_business_owner": apm.business_owner,
            "apm_technical_owner": apm.technical_owner,
            "apm_vendor": apm.vendor,
            "apm_hosting_type": apm.hosting_type,
            "apm_data_classification": apm.data_classification,
            "apm_sla_level": apm.sla_level,
            # aliases
            "business_criticality": apm.business_criticality,
            "eea_business_criticality": apm.business_criticality,
            "lifecycle_status": apm.lifecycle_status,
            "eea_lifecycle_status": apm.lifecycle_status,
            "annual_cost": apm.annual_cost,
            "eea_annual_cost": apm.annual_cost,
            "business_fit": apm.business_fit,
            "eea_business_fit": apm.business_fit,
            "technical_fit": apm.technical_fit,
            "eea_technical_fit": apm.technical_fit,
            "time_quadrant": apm.time_quadrant,
            "eea_time_quadrant": apm.time_quadrant,
            "business_owner": apm.business_owner,
            "technical_owner": apm.technical_owner,
            "vendor": apm.vendor,
            "hosting_type": apm.hosting_type
        }
        for k, v in apm_dict.items():
            if v is not None:
                row[k] = v

    # Merge JSON properties and create prefix aliases
    props = el.properties or {}
    for k, v in props.items():
        row[k] = v
        if k.startswith("eea_"):
            row[k[4:]] = v
        if k.startswith("apm_"):
            row[k[4:]] = v

    # Fallback short name and app code if not explicitly populated
    if not row.get("apm_short_name"):
        row["apm_short_name"] = (el.name or "App")[:12]
    if not row.get("apm_app_code"):
        row["apm_app_code"] = f"AP{abs(hash(el.id)) % 9000 + 1000}"[:6]

    # Calculate APM computed fields if relevant
    b_str = str(row.get("apm_functional_fit") or row.get("business_fit") or "3")
    t_str = str(row.get("apm_technical_fit") or row.get("technical_fit") or "3")
    b_val = int(b_str[0]) if b_str and b_str[0].isdigit() else 3
    t_val = int(t_str[0]) if t_str and t_str[0].isdigit() else 3
    row["business_fit_score"] = b_val
    row["technical_fit_score"] = t_val

    # TIME Quadrant (Override or Computed)
    override_q = row.get("apm_time_quadrant_override") or row.get("time_quadrant")
    if override_q in ("Invest", "Tolerate", "Migrate", "Eliminate"):
        row["computed_time_quadrant"] = override_q
    else:
        if b_val >= 3 and t_val >= 3:
            row["computed_time_quadrant"] = "Invest"
        elif b_val >= 3 and t_val < 3:
            row["computed_time_quadrant"] = "Tolerate"
        elif b_val < 3 and t_val >= 3:
            row["computed_time_quadrant"] = "Migrate"
        else:
            row["computed_time_quadrant"] = "Eliminate"

    # Obsolescence Risk
    lc_status = str(row.get("apm_lifecycle_status") or row.get("lifecycle_status") or "Live")
    ret_date = row.get("apm_retirement_date")
    if lc_status == "Retired":
        row["obsolescence_risk"] = "Retired (Dismessa)"
    elif lc_status == "Phase Out":
        row["obsolescence_risk"] = "Phase Out (Dismissione in Corso)"
    elif t_str.startswith("1") or t_str.startswith("2"):
        row["obsolescence_risk"] = "Debito Tecnico Elevato"
    elif ret_date:
        row["obsolescence_risk"] = "Dismissione Programmata"
    else:
        row["obsolescence_risk"] = "Stabile / Manutenuta"

    return row


class ModelViewsCache:
    """Pre-loads workspace elements and relationships once with eager loading to compute view counts in memory."""
    def __init__(self, db: Session, model_id: str, stereotypes: List[ElementStereotype]):
        self.db = db
        self.model_id = model_id
        self.id_to_stereo = {s.id: s for s in stereotypes}
        self.name_to_stereo = {s.name: s for s in stereotypes}

        # Pre-load non-reference workspace elements with eager loaded 1:1 models
        elements = db.query(ArchimateElement).options(
            joinedload(ArchimateElement.stereotype),
            joinedload(ArchimateElement.apm_attributes)
        ).filter(
            ArchimateElement.model_id == model_id,
            ArchimateElement.is_reference == False
        ).all()
        self.cached_rows = [_build_element_row(el) for el in elements]

        # Pre-load connected relationship IDs for fast orphan/connected checks
        rels = db.query(ArchimateRelationship.source_id, ArchimateRelationship.target_id).filter(
            ArchimateRelationship.model_id == model_id
        ).all()
        self.connected_ids = {s for s, t in rels if s} | {t for s, t in rels if t}
        self._adr_count = None

    def count_view(self, v: PackageView) -> int:
        if getattr(v, "view_type", None) == "adr_manager":
            if self._adr_count is None:
                from app.models.archimate import ArchitectureDecisionRecord
                self._adr_count = self.db.query(ArchitectureDecisionRecord).filter(
                    ArchitectureDecisionRecord.model_id == self.model_id
                ).count()
            return self._adr_count

        spec = _extract_spec(v)
        target_stereos = set(_flatten_string_list(spec.get("target_stereotypes")))
        target_types = set(_flatten_string_list(spec.get("target_types")))
        config = spec.get("config") or {}
        filter_config = config.get("filter_config") or {}

        # Fast in-memory filter on stereotypes and types
        rows = self.cached_rows
        if target_stereos:
            valid_ids = set()
            for st in target_stereos:
                if st in self.id_to_stereo:
                    valid_ids.add(self.id_to_stereo[st].id)
                elif st in self.name_to_stereo:
                    valid_ids.add(self.name_to_stereo[st].id)
                else:
                    valid_ids.add(st)
            rows = [r for r in rows if r.get("stereotype_id") in valid_ids or r.get("stereotype_name") in target_stereos]

        if target_types:
            rows = [r for r in rows if r.get("type") in target_types]

        if filter_config:
            rows = _apply_filter_config(rows, filter_config, self.db, self.model_id, connected_ids=self.connected_ids)

        return len(rows)


def _count_matching_elements(db: Session, model_id: str, v: PackageView, id_to_stereo: dict, name_to_stereo: dict) -> int:
    cache = ModelViewsCache(db, model_id, list(id_to_stereo.values()))
    return cache.count_view(v)


@router.get("")
def list_package_views(
    model_id: str = Query(..., description="Active workspace model ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Returns all package-defined business views available for the active model workspace,
    plus any custom business views defined for this model workspace (or globally).
    Groups views by package and category, including count of matching enterprise elements.
    """
    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Workspace model non trovato")

    # Pre-fetch stereotypes and initialize high-performance matching cache
    stereotypes = db.query(ElementStereotype).all()
    cache = ModelViewsCache(db, model_id, stereotypes)

    result_packages = []

    # 1. Custom Business Views created by the Enterprise Architect (active only)
    custom_views = db.query(PackageView).filter(
        PackageView.package_id == None,
        (PackageView.model_id == model_id) | (PackageView.is_global == True),
        PackageView.is_active == True
    ).order_by(PackageView.sort_order.asc(), PackageView.name.asc()).all()

    if custom_views:
        custom_views_data = []
        for v in custom_views:
            count = cache.count_view(v)
            custom_views_data.append({
                "id": v.id,
                "view_key": v.view_key,
                "name": v.name,
                "description": v.description,
                "category": v.category or "Custom Views",
                "view_type": v.view_type,
                "icon": v.icon or "Table",
                "sort_order": v.sort_order if v.sort_order is not None else 0,
                "target_hub": getattr(v, "target_hub", None) or "business",
                "is_global": v.is_global,
                "author": v.author,
                "target_stereotypes": _flatten_string_list(v.target_stereotypes),
                "target_types": _flatten_string_list(v.target_types),
                "config": v.config,
                "matching_elements_count": count
            })

        result_packages.append({
            "id": "custom-business-views",
            "code": "business_views",
            "name": "Business Views",
            "version": "1.0.0",
            "icon_color": "emerald",
            "package_type": "custom",
            "views": custom_views_data
        })

    # 2. Package-defined business views
    active_pkg_ids = _get_active_package_ids(db, model_id)
    if active_pkg_ids:
        packages = db.query(AttributePackage).filter(
            AttributePackage.id.in_(active_pkg_ids)
        ).all()

        for pkg in packages:
            views = db.query(PackageView).filter(
                PackageView.package_id == pkg.id,
                PackageView.is_active == True
            ).order_by(PackageView.sort_order.asc(), PackageView.name.asc()).all()
            if not views:
                continue

            pkg_views_data = []
            for v in views:
                count = cache.count_view(v)
                pkg_views_data.append({
                    "id": v.id,
                    "view_key": v.view_key,
                    "name": v.name,
                    "description": v.description,
                    "category": v.category or "General",
                    "view_type": v.view_type,
                    "icon": v.icon or "Table",
                    "sort_order": v.sort_order if v.sort_order is not None else 0,
                    "target_hub": getattr(v, "target_hub", None) or "business",
                    "target_stereotypes": _flatten_string_list(v.target_stereotypes),
                    "target_types": _flatten_string_list(v.target_types),
                    "config": v.config,
                    "matching_elements_count": count
                })

            result_packages.append({
                "id": pkg.id,
                "code": pkg.code,
                "name": pkg.name,
                "version": getattr(pkg, "version", "1.0.0"),
                "icon_color": pkg.icon_color or "blue",
                "package_type": pkg.package_type,
                "views": pkg_views_data
            })

    return {"packages": result_packages}


# --- CRUD Endpoints for Custom Business Views ---

@router.get("/custom")
def list_custom_views(
    model_id: str = Query(..., description="Active workspace model ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List all custom business views defined for this model workspace (or globally)."""
    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Workspace model non trovato")

    stereotypes = db.query(ElementStereotype).all()
    cache = ModelViewsCache(db, model_id, stereotypes)

    views = db.query(PackageView).filter(
        (PackageView.model_id == model_id) | (PackageView.is_global == True)
    ).order_by(PackageView.sort_order.asc(), PackageView.name.asc()).all()

    res = []
    for v in views:
        count = cache.count_view(v)
        res.append({
            "id": v.id,
            "view_key": v.view_key,
            "name": v.name,
            "description": v.description,
            "category": v.category or "General",
            "view_type": v.view_type,
            "icon": v.icon or "Table",
            "sort_order": v.sort_order or 0,
            "target_hub": getattr(v, "target_hub", None) or "business",
            "is_global": v.is_global,
            "is_active": v.is_active if v.is_active is not None else True,
            "package_id": v.package_id,
            "author": v.author,
            "model_id": v.model_id,
            "target_stereotypes": v.target_stereotypes or [],
            "target_types": v.target_types or [],
            "config": v.config or {},
            "matching_elements_count": count,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "updated_at": v.updated_at.isoformat() if v.updated_at else None
        })
    return {"views": res}


@router.post("/custom")
def create_custom_view(
    payload: CustomViewPayload,
    model_id: str = Query(..., description="Active workspace model ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new custom business view (inactive by default)."""
    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Workspace model non trovato")

    view_id = f"pkv-custom-{uuid.uuid4().hex[:8]}"
    slug_key = re.sub(r'[^a-zA-Z0-9_]', '_', payload.name.lower().strip())[:48] or f"custom_{uuid.uuid4().hex[:6]}"

    author_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", "Enterprise Architect")

    view = PackageView(
        id=view_id,
        package_id=payload.package_id if payload.package_id else None,
        model_id=model.id,
        is_global=payload.is_global or False,
        is_active=payload.is_active if payload.is_active is not None else False,
        author=author_name,
        view_key=slug_key,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        category=payload.category or "General",
        view_type=payload.view_type or "table",
        icon=payload.icon or "Table",
        sort_order=payload.sort_order or 0,
        target_hub=payload.target_hub or "business",
        target_stereotypes=payload.target_stereotypes or [],
        target_types=payload.target_types or [],
        config=payload.config or {}
    )
    db.add(view)
    db.commit()
    db.refresh(view)
    return {"status": "ok", "view": {
        "id": view.id,
        "view_key": view.view_key,
        "name": view.name,
        "description": view.description,
        "category": view.category,
        "view_type": view.view_type,
        "icon": view.icon,
        "sort_order": view.sort_order,
        "target_hub": getattr(view, "target_hub", None) or "business",
        "is_global": view.is_global,
        "is_active": view.is_active,
        "package_id": view.package_id,
        "target_stereotypes": view.target_stereotypes,
        "target_types": view.target_types,
        "config": view.config
    }}


@router.put("/custom/{view_id}")
def update_custom_view(
    view_id: str,
    payload: CustomViewUpdatePayload,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update an existing custom business view (supports partial updates)."""
    view = db.query(PackageView).filter(
        PackageView.id == view_id
    ).first()
    if not view:
        raise HTTPException(status_code=404, detail="Vista personalizzata non trovata")

    if payload.name is not None and payload.name.strip():
        view.name = payload.name.strip()
    if payload.description is not None:
        view.description = payload.description.strip() if payload.description else None
    if payload.category is not None:
        view.category = payload.category or "General"
    if payload.view_type is not None:
        view.view_type = payload.view_type or "table"
    if payload.icon is not None:
        view.icon = payload.icon or "Table"
    if payload.sort_order is not None:
        view.sort_order = payload.sort_order or 0
    if payload.target_hub is not None:
        view.target_hub = payload.target_hub
    if payload.is_global is not None:
        view.is_global = payload.is_global
    if payload.is_active is not None:
        view.is_active = payload.is_active
    if payload.package_id is not None:
        view.package_id = payload.package_id if payload.package_id != "" else None
    if payload.target_stereotypes is not None:
        view.target_stereotypes = payload.target_stereotypes
    if payload.target_types is not None:
        view.target_types = payload.target_types
    if payload.config is not None:
        view.config = payload.config

    db.commit()
    db.refresh(view)
    return {"status": "ok", "view": {
        "id": view.id,
        "view_key": view.view_key,
        "name": view.name,
        "description": view.description,
        "category": view.category,
        "view_type": view.view_type,
        "icon": view.icon,
        "sort_order": view.sort_order,
        "target_hub": getattr(view, "target_hub", None) or "business",
        "is_global": view.is_global,
        "is_active": view.is_active,
        "package_id": view.package_id,
        "target_stereotypes": view.target_stereotypes,
        "target_types": view.target_types,
        "config": view.config
    }}


@router.patch("/custom/{view_id}/status")
def toggle_custom_view_status(
    view_id: str,
    payload: ViewStatusPayload,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Toggle activation status (active/inactive) of a custom business view."""
    view = db.query(PackageView).filter(
        PackageView.id == view_id
    ).first()
    if not view:
        raise HTTPException(status_code=404, detail="Vista personalizzata non trovata")

    view.is_active = payload.is_active
    db.commit()
    db.refresh(view)
    return {"status": "ok", "id": view.id, "is_active": view.is_active}


@router.patch("/{view_id}/target-hub")
def update_view_target_hub(
    view_id: str,
    payload: ViewTargetHubPayload,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Update target_hub ('business' | 'architecture' | 'both') for any view (package-defined or custom).
    Allows Enterprise Architects to configure whether a view appears in the Business Hub, Architecture Hub, or both.
    """
    target = (payload.target_hub or "").strip().lower()
    if target not in ("business", "architecture", "both"):
        raise HTTPException(
            status_code=400,
            detail="Valore target_hub non valido. Valori ammessi: 'business', 'architecture', 'both'."
        )

    view = db.query(PackageView).filter(PackageView.id == view_id).first()
    if not view:
        raise HTTPException(status_code=404, detail="Vista non trovata")

    view.target_hub = target
    db.commit()
    db.refresh(view)
    return {"status": "ok", "id": view.id, "target_hub": view.target_hub}


@router.delete("/custom/{view_id}")
def delete_custom_view(
    view_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a custom business view."""
    view = db.query(PackageView).filter(
        PackageView.id == view_id
    ).first()
    if not view:
        raise HTTPException(status_code=404, detail="Vista personalizzata non trovata")

    db.delete(view)
    db.commit()
    return {"status": "deleted", "id": view_id}
    db.commit()
    return {"status": "deleted", "id": view_id}


def _extract_spec(view_spec: Any) -> Dict[str, Any]:
    if isinstance(view_spec, dict):
        return {
            "id": view_spec.get("id") or "preview",
            "view_key": view_spec.get("view_key") or "preview",
            "name": view_spec.get("name") or "Preview View",
            "description": view_spec.get("description") or "",
            "category": view_spec.get("category") or "General",
            "view_type": view_spec.get("view_type") or "table",
            "icon": view_spec.get("icon") or "Table",
            "target_stereotypes": _flatten_string_list(view_spec.get("target_stereotypes")),
            "target_types": _flatten_string_list(view_spec.get("target_types")),
            "config": view_spec.get("config") or {}
        }
    else:
        return {
            "id": getattr(view_spec, "id", None) or "preview",
            "view_key": getattr(view_spec, "view_key", None) or "preview",
            "name": getattr(view_spec, "name", None) or "Preview View",
            "description": getattr(view_spec, "description", None) or "",
            "category": getattr(view_spec, "category", None) or "General",
            "view_type": getattr(view_spec, "view_type", None) or "table",
            "icon": getattr(view_spec, "icon", None) or "Table",
            "target_stereotypes": _flatten_string_list(getattr(view_spec, "target_stereotypes", None)),
            "target_types": _flatten_string_list(getattr(view_spec, "target_types", None)),
            "config": getattr(view_spec, "config", None) or {}
        }


def _run_view_execution(
    db: Session,
    model_id: str,
    view_spec: Any,
    payload: ViewExecuteRequest
) -> Dict[str, Any]:
    spec = _extract_spec(view_spec)

    # Resolve target stereotypes and types filter
    stereotypes = db.query(ElementStereotype).all()
    name_to_stereo = {s.name: s for s in stereotypes}
    id_to_stereo = {s.id: s for s in stereotypes}

    # Base query: non-reference elements belonging to this workspace with eager loaded relationships
    query = db.query(ArchimateElement).options(
        joinedload(ArchimateElement.stereotype),
        joinedload(ArchimateElement.apm_attributes)
    ).filter(
        ArchimateElement.model_id == model_id,
        ArchimateElement.is_reference == False
    )
    match_filter = _build_match_filter(spec, id_to_stereo, name_to_stereo)
    if match_filter is not None:
        query = query.filter(match_filter)

    elements = query.all()

    # Flatten elements into normalized rows with properties and APM fields
    rows: List[Dict[str, Any]] = [_build_element_row(el) for el in elements]

    # Apply saved filter_config if defined on view spec
    filter_config = (spec.get("config") or {}).get("filter_config") or {}
    if filter_config:
        rows = _apply_filter_config(rows, filter_config, db, model_id)

    # Populate facet values collector from rows matching filter_config
    columns = (spec["config"] or {}).get("columns", [])
    filterable_fields = {col["field"] for col in columns if col.get("filterable")}
    facet_values: Dict[str, set] = {}

    for r in rows:
        for field in filterable_fields:
            val = r.get(field)
            if val is not None and str(val).strip():
                if field not in facet_values:
                    facet_values[field] = set()
                facet_values[field].add(str(val))

    # Apply runtime search filter
    if payload.search:
        s = payload.search.lower().strip()
        filtered_rows = []
        for r in rows:
            text_match = False
            for val in r.values():
                if val and s in str(val).lower():
                    text_match = True
                    break
            if text_match:
                filtered_rows.append(r)
        rows = filtered_rows

    # Apply runtime facet filters
    if payload.filters:
        filtered_rows = []
        for r in rows:
            match = True
            for f_key, f_val in payload.filters.items():
                if f_val is not None and f_val != "":
                    r_val = r.get(f_key)
                    if str(r_val) != str(f_val):
                        match = False
                        break
            if match:
                filtered_rows.append(r)
        rows = filtered_rows

    # Sort rows
    default_sort = (spec["config"] or {}).get("default_sort") or {}
    if not default_sort and filter_config.get("sortBy"):
        sort_by_str = str(filter_config.get("sortBy"))
        if sort_by_str.endswith("_desc"):
            default_sort = {"field": sort_by_str[:-5], "direction": "desc"}
        elif sort_by_str.endswith("_asc"):
            default_sort = {"field": sort_by_str[:-4], "direction": "asc"}

    sort_field = payload.sort_field or default_sort.get("field", "name")
    sort_dir = payload.sort_direction or default_sort.get("direction", "asc")
    reverse = (sort_dir.lower() == "desc")

    def sort_key(item):
        val = item.get(sort_field)
        return str(val or "").lower()

    rows.sort(key=sort_key, reverse=reverse)

    # Format facet_options as sorted lists
    facet_options = {k: sorted(list(v)) for k, v in facet_values.items()}

    # Handle View Type
    view_type = spec["view_type"]

    if view_type == "table":
        if not columns:
            columns = [
                {"field": "name", "label": "Nome Elemento", "type": "string", "sortable": True, "filterable": True},
                {"field": "type", "label": "Tipo ArchiMate", "type": "badge", "sortable": True, "filterable": True},
                {"field": "layer", "label": "Layer", "type": "badge", "sortable": True, "filterable": True},
                {"field": "documentation", "label": "Documentazione", "type": "string"}
            ]
        return {
            "view_id": spec["id"],
            "view_key": spec["view_key"],
            "name": spec["name"],
            "description": spec["description"],
            "category": spec["category"] or "General",
            "view_type": "table",
            "icon": spec["icon"] or "Table",
            "config": spec["config"] or {},
            "columns": columns,
            "rows": rows,
            "total": len(rows),
            "facet_options": facet_options
        }

    elif view_type == "matrix":
        matrix_cfg = (spec["config"] or {}).get("matrix") or {}
        x_field = matrix_cfg.get("x_axis", {}).get("field")
        y_field = matrix_cfg.get("y_axis", {}).get("field")

        quadrant_counts = {"Invest": 0, "Tolerate": 0, "Migrate": 0, "Eliminate": 0}
        quadrant_costs = {"Invest": 0.0, "Tolerate": 0.0, "Migrate": 0.0, "Eliminate": 0.0}
        matrix_grid: Dict[str, Dict[str, int]] = {}

        for r in rows:
            q = r.get("computed_time_quadrant", "Invest")
            if q in quadrant_counts:
                quadrant_counts[q] += 1
                try:
                    c = float(r.get("apm_annual_cost") or 0.0)
                    quadrant_costs[q] += c
                except (ValueError, TypeError):
                    pass

            if x_field and y_field:
                xv = str(r.get(x_field) or "Non Definito")
                yv = str(r.get(y_field) or "Non Definito")
                if yv not in matrix_grid:
                    matrix_grid[yv] = {}
                matrix_grid[yv][xv] = matrix_grid[yv].get(xv, 0) + 1

        return {
            "view_id": spec["id"],
            "view_key": spec["view_key"],
            "name": spec["name"],
            "description": spec["description"],
            "category": spec["category"] or "Portfolio Rationalization",
            "view_type": "matrix",
            "icon": spec["icon"] or "Grid",
            "config": spec["config"] or {},
            "columns": columns,
            "rows": rows,
            "total": len(rows),
            "facet_options": facet_options,
            "matrix_summary": {
                "counts": quadrant_counts,
                "costs": quadrant_costs,
                "grid": matrix_grid
            }
        }

    elif view_type == "kpi_dashboard":
        metrics_specs = (spec["config"] or {}).get("metrics", [])
        charts_specs = (spec["config"] or {}).get("charts", [])

        # Compute metrics
        computed_metrics = []
        for m_spec in metrics_specs:
            m_id = m_spec.get("id")
            m_label = m_spec.get("label", m_id)
            m_type = m_spec.get("type", "count")
            m_where = m_spec.get("where") or {}
            m_field = m_spec.get("field")

            val = 0
            if m_type == "count":
                if not m_where:
                    val = len(rows)
                else:
                    for r in rows:
                        matches_where = True
                        for w_key, w_val in m_where.items():
                            if isinstance(w_val, list):
                                if str(r.get(w_key)) not in [str(x) for x in w_val]:
                                    matches_where = False
                                    break
                            else:
                                if str(r.get(w_key)) != str(w_val):
                                    matches_where = False
                                    break
                        if matches_where:
                            val += 1
            elif m_type == "sum" and m_field:
                total_sum = 0.0
                for r in rows:
                    try:
                        total_sum += float(r.get(m_field) or 0.0)
                    except (ValueError, TypeError):
                        pass
                val = total_sum
            elif m_type == "average" and m_field:
                total_sum = 0.0
                cnt = 0
                for r in rows:
                    try:
                        total_sum += float(r.get(m_field) or 0.0)
                        cnt += 1
                    except (ValueError, TypeError):
                        pass
                val = round(total_sum / max(1, cnt), 2)

            computed_metrics.append({
                "id": m_id,
                "label": m_label,
                "value": val,
                "type": m_type
            })

        # Compute charts
        computed_charts = []
        for c_spec in charts_specs:
            c_id = c_spec.get("id")
            c_title = c_spec.get("title", c_id)
            c_type = c_spec.get("type", "bar")
            c_group_by = c_spec.get("group_by")
            c_metric = c_spec.get("metric", "count")
            c_metric_field = c_spec.get("metric_field")

            groups_agg: Dict[str, Dict[str, Any]] = {}
            for r in rows:
                g_val = str(r.get(c_group_by) or "Non Definito")
                if g_val not in groups_agg:
                    groups_agg[g_val] = {"count": 0, "sum": 0.0}
                groups_agg[g_val]["count"] += 1
                if c_metric_field:
                    try:
                        groups_agg[g_val]["sum"] += float(r.get(c_metric_field) or 0.0)
                    except (ValueError, TypeError):
                        pass

            if c_metric == "sum" and c_metric_field:
                sorted_groups = sorted(groups_agg.items(), key=lambda x: x[1]["sum"], reverse=True)
                if len(sorted_groups) > 8:
                    sorted_groups = sorted_groups[:8]
                chart_data = [{"label": k, "count": v["count"], "value": v["sum"]} for k, v in sorted_groups]
            else:
                sorted_groups = sorted(groups_agg.items(), key=lambda x: x[1]["count"], reverse=True)
                chart_data = [{"label": k, "count": v["count"], "value": v["count"]} for k, v in sorted_groups]

            computed_charts.append({
                "id": c_id,
                "title": c_title,
                "type": c_type,
                "group_by": c_group_by,
                "metric": c_metric,
                "data": chart_data
            })

        if not columns:
            columns = [
                { "field": "name", "label": "Nome", "type": "string", "sortable": True },
                { "field": "type", "label": "Tipo ArchiMate", "type": "badge", "sortable": True },
                { "field": "layer", "label": "Layer", "type": "badge", "sortable": True }
            ]

        return {
            "view_id": spec["id"],
            "view_key": spec["view_key"],
            "name": spec["name"],
            "description": spec["description"],
            "category": spec["category"] or "Executive Dashboard",
            "view_type": "kpi_dashboard",
            "icon": spec["icon"] or "BarChart3",
            "config": spec["config"] or {},
            "columns": columns,
            "rows": rows,
            "total": len(rows),
            "facet_options": facet_options,
            "metrics": computed_metrics,
            "charts": computed_charts
        }

    return {
        "view_id": spec["id"],
        "view_key": spec["view_key"],
        "name": spec["name"],
        "description": spec["description"],
        "category": spec["category"] or "General",
        "view_type": view_type,
        "icon": spec["icon"] or "Table",
        "columns": columns,
        "rows": rows,
        "total": len(rows),
        "facet_options": facet_options
    }


@router.post("/preview")
def preview_package_view(
    payload: CustomViewPayload,
    model_id: str = Query(..., description="Active workspace model ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Executes live preview of an in-flight custom view definition on workspace elements
    without requiring it to be persisted to the database first.
    """
    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Workspace model non trovato")

    req = ViewExecuteRequest()
    return _run_view_execution(db, model_id, payload, req)


@router.post("/{view_id}/execute")
def execute_package_view(
    view_id: str,
    payload: ViewExecuteRequest,
    model_id: str = Query(..., description="Active workspace model ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Executes a package business view against the enterprise model elements (is_reference == False).
    Flattens custom and package properties, applies runtime search, facet filtering, and aggregations.
    """
    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Workspace model non trovato")

    view = db.query(PackageView).filter(
        (PackageView.id == view_id) | (PackageView.view_key == view_id)
    ).first()
    if not view:
        raise HTTPException(status_code=404, detail="Vista del pacchetto non trovata")

    return _run_view_execution(db, model_id, view, payload)
