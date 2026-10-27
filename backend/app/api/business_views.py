"""
Business Package Views API Router
Provides endpoints to list and execute package-defined business views for active workspace models.
"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.archimate import (
    ModelWorkspace,
    AttributePackage,
    WorkspaceAttributePackage,
    PackageView,
    ElementStereotype,
    ArchimateElement
)

router = APIRouter(prefix="/business/package-views", tags=["business-views"])


class ViewExecuteRequest(BaseModel):
    search: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    sort_field: Optional[str] = None
    sort_direction: Optional[str] = "asc" # "asc" | "desc"


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


@router.get("")
def list_package_views(
    model_id: str = Query(..., description="Active workspace model ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Returns all package-defined business views available for the active model workspace.
    Groups views by package and category, including count of matching enterprise elements.
    """
    model = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Workspace model non trovato")

    active_pkg_ids = _get_active_package_ids(db, model_id)
    if not active_pkg_ids:
        return {"packages": []}

    packages = db.query(AttributePackage).filter(
        AttributePackage.id.in_(active_pkg_ids)
    ).all()

    # Pre-fetch stereotypes for matching
    stereotypes = db.query(ElementStereotype).all()
    name_to_stereo = {s.name: s for s in stereotypes}
    id_to_stereo = {s.id: s for s in stereotypes}

    result_packages = []
    for pkg in packages:
        views = db.query(PackageView).filter(
            PackageView.package_id == pkg.id
        ).order_by(PackageView.sort_order.asc(), PackageView.name.asc()).all()
        if not views:
            continue

        pkg_views_data = []
        for v in views:
            # Resolve target stereotype IDs
            target_ids = []
            for st_target in (v.target_stereotypes or []):
                if st_target in id_to_stereo:
                    target_ids.append(id_to_stereo[st_target].id)
                elif st_target in name_to_stereo:
                    target_ids.append(name_to_stereo[st_target].id)

            # Count matching enterprise elements in model (is_reference == False)
            match_query = db.query(ArchimateElement).filter(
                ArchimateElement.model_id == model_id,
                ArchimateElement.is_reference == False
            )
            if target_ids:
                match_query = match_query.filter(ArchimateElement.stereotype_id.in_(target_ids))

            count = match_query.count()

            pkg_views_data.append({
                "id": v.id,
                "view_key": v.view_key,
                "name": v.name,
                "description": v.description,
                "category": v.category or "General",
                "view_type": v.view_type,
                "icon": v.icon or "Table",
                "sort_order": v.sort_order if v.sort_order is not None else 0,
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

    # Resolve target stereotype IDs
    stereotypes = db.query(ElementStereotype).all()
    name_to_stereo = {s.name: s for s in stereotypes}
    id_to_stereo = {s.id: s for s in stereotypes}

    target_ids = []
    for st_target in (view.target_stereotypes or []):
        if st_target in id_to_stereo:
            target_ids.append(id_to_stereo[st_target].id)
        elif st_target in name_to_stereo:
            target_ids.append(name_to_stereo[st_target].id)

    # Base query: non-reference elements belonging to this workspace
    query = db.query(ArchimateElement).filter(
        ArchimateElement.model_id == model_id,
        ArchimateElement.is_reference == False
    )
    if target_ids:
        query = query.filter(ArchimateElement.stereotype_id.in_(target_ids))

    elements = query.all()

    # Flatten elements into rows
    rows: List[Dict[str, Any]] = []
    facet_values: Dict[str, set] = {}

    columns = (view.config or {}).get("columns", [])
    filterable_fields = {col["field"] for col in columns if col.get("filterable")}

    for el in elements:
        row: Dict[str, Any] = {
            "id": el.id,
            "name": el.name,
            "type": el.type,
            "layer": el.layer,
            "documentation": el.documentation or "",
            "stereotype_id": el.stereotype_id,
            "stereotype_name": el.stereotype.name if el.stereotype else None
        }

        # Merge JSON properties
        props = el.properties or {}
        for k, v in props.items():
            row[k] = v

        # Fallback short name and app code if not explicitly populated
        if not row.get("apm_short_name"):
            row["apm_short_name"] = (el.name or "App")[:12]
        if not row.get("apm_app_code"):
            row["apm_app_code"] = f"AP{abs(hash(el.id)) % 9000 + 1000}"[:6]

        # Calculate APM computed fields if relevant
        b_str = str(row.get("apm_functional_fit") or "3")
        t_str = str(row.get("apm_technical_fit") or "3")
        b_val = int(b_str[0]) if b_str and b_str[0].isdigit() else 3
        t_val = int(t_str[0]) if t_str and t_str[0].isdigit() else 3
        row["business_fit_score"] = b_val
        row["technical_fit_score"] = t_val

        # TIME Quadrant (Override or Computed)
        override_q = row.get("apm_time_quadrant_override")
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
        lc_status = str(row.get("apm_lifecycle_status") or "Live")
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

        # Populate facet values collector
        for field in filterable_fields:
            val = row.get(field)
            if val is not None and str(val).strip():
                if field not in facet_values:
                    facet_values[field] = set()
                facet_values[field].add(str(val))

        rows.append(row)

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
    default_sort = (view.config or {}).get("default_sort") or {}
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
    view_type = view.view_type

    if view_type == "table":
        return {
            "view_id": view.id,
            "view_key": view.view_key,
            "name": view.name,
            "description": view.description,
            "category": view.category or "General",
            "view_type": "table",
            "icon": view.icon or "Table",
            "columns": columns,
            "rows": rows,
            "total": len(rows),
            "facet_options": facet_options
        }

    elif view_type == "matrix":
        quadrant_counts = {"Invest": 0, "Tolerate": 0, "Migrate": 0, "Eliminate": 0}
        quadrant_costs = {"Invest": 0.0, "Tolerate": 0.0, "Migrate": 0.0, "Eliminate": 0.0}
        for r in rows:
            q = r.get("computed_time_quadrant", "Invest")
            if q in quadrant_counts:
                quadrant_counts[q] += 1
                try:
                    c = float(r.get("apm_annual_cost") or 0.0)
                    quadrant_costs[q] += c
                except (ValueError, TypeError):
                    pass

        return {
            "view_id": view.id,
            "view_key": view.view_key,
            "name": view.name,
            "description": view.description,
            "category": view.category or "Portfolio Rationalization",
            "view_type": "matrix",
            "icon": view.icon or "Grid",
            "columns": columns,
            "rows": rows,
            "total": len(rows),
            "facet_options": facet_options,
            "matrix_summary": {
                "counts": quadrant_counts,
                "costs": quadrant_costs
            }
        }

    elif view_type == "kpi_dashboard":
        metrics_specs = (view.config or {}).get("metrics", [])
        charts_specs = (view.config or {}).get("charts", [])

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

        # Ensure default columns if not configured so the drill-down table is functional
        if not columns:
            columns = [
                { "field": "name", "label": "Applicazione", "type": "string", "sortable": True },
                { "field": "apm_app_code", "label": "Codice", "type": "badge", "filterable": True },
                { "field": "apm_short_name", "label": "Nome Breve", "type": "string", "sortable": True },
                { "field": "apm_annual_cost", "label": "Costo TCO (€)", "type": "currency", "sortable": True },
                { "field": "apm_business_criticality", "label": "Criticità", "type": "badge", "filterable": True },
                { "field": "apm_lifecycle_status", "label": "Ciclo di Vita", "type": "badge", "filterable": True },
                { "field": "apm_hosting_type", "label": "Hosting", "type": "enum", "filterable": True },
                { "field": "apm_business_owner", "label": "Business Owner", "type": "string", "sortable": True }
            ]

        return {
            "view_id": view.id,
            "view_key": view.view_key,
            "name": view.name,
            "description": view.description,
            "category": view.category or "Analytics",
            "view_type": "kpi_dashboard",
            "icon": view.icon or "BarChart3",
            "metrics": computed_metrics,
            "charts": computed_charts,
            "rows": rows,
            "columns": columns,
            "total": len(rows),
            "total_items": len(rows),
            "facet_options": facet_options
        }

    else:
        # Fallback / generic table
        return {
            "view_id": view.id,
            "view_key": view.view_key,
            "name": view.name,
            "description": view.description,
            "category": view.category or "General",
            "view_type": view_type,
            "icon": view.icon or "Grid",
            "columns": columns,
            "rows": rows,
            "total": len(rows),
            "facet_options": facet_options
        }
