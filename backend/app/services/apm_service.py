import re
import uuid
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session, joinedload
from app.models.archimate import ArchimateElement, ApplicationBusinessAttributes, ModelWorkspace, ElementStereotype, ArchimateRelationship, WorkspaceAttributePackage, ArchiSchema

def calculate_time_quadrant(business_fit: int, technical_fit: int) -> str:
    """
    Gartner TIME Model Matrix:
    - Business/Functional Fit >= 3 & Technical Fit >= 3  => INVEST (Strategic value, modern tech)
    - Business/Functional Fit >= 3 & Technical Fit < 3   => TOLERATE (High business value, legacy tech)
    - Business/Functional Fit < 3 & Technical Fit >= 3   => MIGRATE (Low business value, modern tech)
    - Business/Functional Fit < 3 & Technical Fit < 3    => ELIMINATE (Low value, high technical debt)
    """
    if business_fit >= 3 and technical_fit >= 3:
        return "Invest"
    elif business_fit >= 3 and technical_fit < 3:
        return "Tolerate"
    elif business_fit < 3 and technical_fit >= 3:
        return "Migrate"
    else:
        return "Eliminate"

def parse_fit_score(val: Any, default: int = 3) -> int:
    """Safely parse integer score from number or string like '3 - Appropriate'."""
    if val is None or val == "":
        return default
    if isinstance(val, (int, float)):
        return int(val)
    s = str(val).strip()
    if s and s[0].isdigit():
        return int(s[0])
    m = re.search(r'\d+', s)
    return int(m.group(0)) if m else default

class APMService:
    @staticmethod
    def get_portfolio_summary(db: Session, model_id: str) -> Dict[str, Any]:
        """Calculates executive APM metrics for a model workspace according to LeanIX & TOGAF standards."""
        is_apm_pkg_active = db.query(WorkspaceAttributePackage).filter(
            WorkspaceAttributePackage.model_id == model_id,
            WorkspaceAttributePackage.package_id == "pkg-apm"
        ).first() is not None

        apps = db.query(ArchimateElement).options(
            joinedload(ArchimateElement.apm_attributes),
            joinedload(ArchimateElement.stereotype)
        ).filter(
            ArchimateElement.model_id == model_id,
            ArchimateElement.type == "ApplicationComponent"
        ).all()

        total_apps = len(apps)
        in_scope_apps_count = 0
        out_of_scope_apps_count = 0
        total_cost = 0.0
        time_counts = {"Invest": 0, "Migrate": 0, "Tolerate": 0, "Eliminate": 0}
        time_costs = {"Invest": 0.0, "Migrate": 0.0, "Tolerate": 0.0, "Eliminate": 0.0}
        criticality_counts = {"Mission Critical": 0, "Business Critical": 0, "Business Operational": 0, "Administrative": 0}
        lifecycle_counts = {"Plan": 0, "Phase In": 0, "Live": 0, "Phase Out": 0, "Retired": 0}
        hosting_counts = {}
        vendor_costs = {}

        app_list = []

        for app in apps:
            apm = app.apm_attributes
            props = app.properties if isinstance(app.properties, dict) else {}

            # Determine if this element is a Business Application (in APM scope)
            # Standard rule: has Business Application stereotype (or legacy fallback)
            is_business_app = False
            if app.stereotype_id in ("stereo-business-app", "stereo-enterprise-app"):
                is_business_app = True
            elif app.stereotype and app.stereotype.name in ("Business Application", "Enterprise Application"):
                is_business_app = True
            elif props.get("stereotype") in ("Business Application", "Enterprise Application", "stereo-business-app", "stereo-enterprise-app"):
                is_business_app = True
            elif app.stereotype_id is None and (apm and apm.in_apm_scope):
                is_business_app = True

            # Functional / Business Fit & Technical Fit (supporting new apm_ properties, legacy tme_/eea_, or db fallback)
            raw_b_fit = props.get("apm_functional_fit") or props.get("tme_business_fit") or props.get("eea_business_fit") or (apm.business_fit if apm else 3)
            raw_t_fit = props.get("apm_technical_fit") or props.get("tme_technical_fit") or props.get("eea_technical_fit") or (apm.technical_fit if apm else 3)
            b_fit = parse_fit_score(raw_b_fit, 3)
            t_fit = parse_fit_score(raw_t_fit, 3)

            # TCO Breakdown fields
            try:
                c_lic = float(props.get("apm_cost_software_licenses") or getattr(apm, "cost_software_licenses", 0.0) or 0.0)
            except (ValueError, TypeError):
                c_lic = 0.0
            try:
                c_cld = float(props.get("apm_cost_cloud_infrastructure") or getattr(apm, "cost_cloud_infrastructure", 0.0) or 0.0)
            except (ValueError, TypeError):
                c_cld = 0.0
            try:
                c_mnt = float(props.get("apm_cost_vendor_maintenance") or getattr(apm, "cost_vendor_maintenance", 0.0) or 0.0)
            except (ValueError, TypeError):
                c_mnt = 0.0
            try:
                c_lab = float(props.get("apm_cost_internal_labor") or getattr(apm, "cost_internal_labor", 0.0) or 0.0)
            except (ValueError, TypeError):
                c_lab = 0.0
            try:
                users = int(props.get("apm_active_users") or getattr(apm, "active_users", 0) or 0)
            except (ValueError, TypeError):
                users = 0
            try:
                capex_r = float(props.get("apm_capex_ratio") or getattr(apm, "capex_ratio", 0.0) or 0.0)
            except (ValueError, TypeError):
                capex_r = 0.0

            raw_cost = props.get("apm_annual_cost") or props.get("eea_annual_cost") or (apm.annual_cost if apm else 0.0)
            try:
                base_cost = float(raw_cost)
            except (ValueError, TypeError):
                base_cost = 0.0

            breakdown_sum = c_lic + c_cld + c_mnt + c_lab
            if breakdown_sum > 0:
                cost = breakdown_sum if base_cost <= 0 else base_cost
            else:
                cost = base_cost

            cost_per_user = round(cost / users, 2) if users > 0 else 0.0

            crit = props.get("apm_business_criticality") or props.get("eea_business_criticality") or (apm.business_criticality if apm else "Business Operational")
            l_stat = props.get("apm_lifecycle_status") or props.get("eea_lifecycle_status") or (apm.lifecycle_status if apm else "Live")
            
            auto_time = calculate_time_quadrant(b_fit, t_fit)
            time_override = props.get("apm_time_quadrant_override") or props.get("tme_quadrant") or props.get("eea_time_quadrant") or ""
            time_q = time_override if time_override in ("Invest", "Migrate", "Tolerate", "Eliminate") else auto_time

            b_owner = props.get("apm_business_owner") or props.get("eea_business_owner") or (apm.business_owner if apm else "")
            t_owner = props.get("apm_technical_owner") or props.get("eea_technical_owner") or (apm.technical_owner if apm else "")
            vendor = props.get("apm_vendor") or props.get("eea_vendor") or (apm.vendor if apm else "Internal")
            cost_center = props.get("apm_cost_center") or getattr(apm, "cost_center", "") or "Generale / IT"
            hosting = props.get("apm_hosting_type") or props.get("eea_hosting_type") or (apm.hosting_type if apm else "Public Cloud")
            arch_type = props.get("apm_architecture_type") or "3-Tier Web App"
            cost_type = props.get("apm_cost_type") or "OPEX (SaaS / Canone Cloud)"
            live_date = props.get("apm_live_date") or None
            retirement_date = props.get("apm_retirement_date") or None
            personal_data = props.get("apm_personal_data") is True or str(props.get("apm_personal_data")).lower() in ("true", "1", "yes")
            rto = props.get("apm_rto_hours") or "< 4 ore"
            sla = props.get("apm_sla_level") or (apm.sla_level if apm else "Silver (99.0%)")
            data_class = props.get("apm_data_classification") or (apm.data_classification if apm else "Internal")

            if is_business_app:
                in_scope_apps_count += 1
                total_cost += cost
                if time_q in time_counts:
                    time_counts[time_q] += 1
                    time_costs[time_q] += cost
                
                if crit in criticality_counts:
                    criticality_counts[crit] += 1
                else:
                    criticality_counts[crit] = 1

                if l_stat in lifecycle_counts:
                    lifecycle_counts[l_stat] += 1
                else:
                    lifecycle_counts[l_stat] = 1

                hosting_counts[hosting] = hosting_counts.get(hosting, 0) + 1
                vendor_costs[vendor] = vendor_costs.get(vendor, 0.0) + cost
            else:
                out_of_scope_apps_count += 1

            app_list.append({
                "id": app.id,
                "name": app.name,
                "short_name": props.get("apm_short_name") or "",
                "app_code": props.get("apm_app_code") or "",
                "documentation": app.documentation,
                "business_fit": b_fit,
                "technical_fit": t_fit,
                "functional_fit_label": str(raw_b_fit),
                "technical_fit_label": str(raw_t_fit),
                "time_quadrant": time_q,
                "time_quadrant_override": time_override,
                "annual_cost": cost,
                "cost_software_licenses": c_lic,
                "cost_cloud_infrastructure": c_cld,
                "cost_vendor_maintenance": c_mnt,
                "cost_internal_labor": c_lab,
                "active_users": users,
                "capex_ratio": capex_r,
                "cost_per_user": cost_per_user,
                "cost_type": cost_type,
                "cost_center": cost_center,
                "business_criticality": crit,
                "lifecycle_status": l_stat,
                "live_date": live_date,
                "retirement_date": retirement_date,
                "business_owner": b_owner,
                "technical_owner": t_owner,
                "vendor": vendor,
                "hosting_type": hosting,
                "architecture_type": arch_type,
                "is_business_app": is_business_app,
                "is_enterprise_app": is_business_app,
                "in_apm_scope": is_business_app, # backward compatible alias
                "stereotype_id": app.stereotype_id,
                "stereotype_name": app.stereotype.name if app.stereotype else ("Business Application" if is_business_app else ""),
                "stereotype_label": app.stereotype.label if app.stereotype else ("«Business Application»" if is_business_app else ""),
                "data_classification": data_class,
                "personal_data": personal_data,
                "sla_level": sla,
                "rto_hours": rto,
                "notes": apm.notes if apm else ""
            })

        return {
            "is_apm_package_active": is_apm_pkg_active,
            "total_applications": in_scope_apps_count,
            "total_raw_components": total_apps,
            "total_in_scope": in_scope_apps_count,
            "total_out_of_scope": out_of_scope_apps_count,
            "total_annual_cost": total_cost,
            "time_distribution": time_counts,
            "time_cost_distribution": time_costs,
            "criticality_distribution": criticality_counts,
            "lifecycle_distribution": lifecycle_counts,
            "hosting_distribution": hosting_counts,
            "top_vendors_by_cost": sorted([{"vendor": k, "cost": v} for k, v in vendor_costs.items()], key=lambda x: x["cost"], reverse=True)[:5],
            "applications": app_list
        }

    @staticmethod
    def update_app_attributes(db: Session, element_id: str, attributes: Dict[str, Any]) -> ApplicationBusinessAttributes:
        """Creates or updates business attributes and enterprise stereotype for an Application Component."""
        element = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
        if not element:
            raise ValueError(f"Element with id '{element_id}' not found.")

        apm = db.query(ApplicationBusinessAttributes).filter(
            ApplicationBusinessAttributes.element_id == element_id
        ).first()

        # Handle Business Application stereotype assignment
        if "is_business_app" in attributes or "is_enterprise_app" in attributes or "in_apm_scope" in attributes:
            wants_patrimonio = (
                attributes.get("is_business_app") if "is_business_app" in attributes
                else attributes.get("is_enterprise_app") if "is_enterprise_app" in attributes
                else attributes.get("in_apm_scope")
            )
            if wants_patrimonio:
                element.stereotype_id = "stereo-business-app"
            else:
                if element.stereotype_id in ("stereo-business-app", "stereo-enterprise-app"):
                    element.stereotype_id = None

        b_fit = parse_fit_score(attributes.get("functional_fit") or attributes.get("business_fit"), apm.business_fit if apm else 3)
        t_fit = parse_fit_score(attributes.get("technical_fit"), apm.technical_fit if apm else 3)
        auto_time = calculate_time_quadrant(b_fit, t_fit)

        time_q = attributes.get("time_quadrant", attributes.get("time_quadrant_override", auto_time))

        if not apm:
            apm = ApplicationBusinessAttributes(
                element_id=element_id,
                business_fit=b_fit,
                technical_fit=t_fit,
                time_quadrant=time_q,
                annual_cost=attributes.get("annual_cost", 0.0),
                cost_software_licenses=attributes.get("cost_software_licenses", 0.0),
                cost_cloud_infrastructure=attributes.get("cost_cloud_infrastructure", 0.0),
                cost_vendor_maintenance=attributes.get("cost_vendor_maintenance", 0.0),
                cost_internal_labor=attributes.get("cost_internal_labor", 0.0),
                active_users=attributes.get("active_users", 0),
                capex_ratio=attributes.get("capex_ratio", 0.0),
                cost_center=attributes.get("cost_center", ""),
                business_criticality=attributes.get("business_criticality", "Business Operational"),
                lifecycle_status=attributes.get("lifecycle_status", "Live"),
                business_owner=attributes.get("business_owner", ""),
                technical_owner=attributes.get("technical_owner", ""),
                vendor=attributes.get("vendor", ""),
                hosting_type=attributes.get("hosting_type", "Public Cloud"),
                data_classification=attributes.get("data_classification", "Internal"),
                sla_level=attributes.get("sla_level", "Silver (99.0%)"),
                in_apm_scope=True,
                notes=attributes.get("notes", "")
            )
            db.add(apm)
        else:
            for key in [
                "business_criticality", "lifecycle_status", "business_owner",
                "technical_owner", "vendor", "hosting_type", "data_classification",
                "sla_level", "notes", "cost_center", "active_users",
                "cost_software_licenses", "cost_cloud_infrastructure",
                "cost_vendor_maintenance", "cost_internal_labor", "capex_ratio"
            ]:
                if key in attributes:
                    setattr(apm, key, attributes[key])

            if "annual_cost" in attributes:
                apm.annual_cost = float(attributes["annual_cost"])
            else:
                # If breakdown fields were updated, auto-sync annual_cost if desired
                breakdown_keys = ["cost_software_licenses", "cost_cloud_infrastructure", "cost_vendor_maintenance", "cost_internal_labor"]
                if any(k in attributes for k in breakdown_keys):
                    b_sum = (
                        float(getattr(apm, "cost_software_licenses", 0.0) or 0.0) +
                        float(getattr(apm, "cost_cloud_infrastructure", 0.0) or 0.0) +
                        float(getattr(apm, "cost_vendor_maintenance", 0.0) or 0.0) +
                        float(getattr(apm, "cost_internal_labor", 0.0) or 0.0)
                    )
                    if b_sum > 0:
                        apm.annual_cost = b_sum

            apm.business_fit = b_fit
            apm.technical_fit = t_fit
            apm.time_quadrant = time_q
            apm.in_apm_scope = True

        # Sync to element properties with apm_ prefix and clean deprecated tme_ / in_scope keys
        elem_props = dict(element.properties) if isinstance(element.properties, dict) else {}

        # Remove deprecated tme_ and in_scope from properties
        for dep in ["tme_business_fit", "tme_technical_fit", "tme_quadrant", "apm_in_scope", "eea_in_apm_scope"]:
            elem_props.pop(dep, None)

        prop_mapping = {
            "functional_fit": "apm_functional_fit",
            "business_fit": "apm_functional_fit",
            "technical_fit": "apm_technical_fit",
            "time_quadrant_override": "apm_time_quadrant_override",
            "annual_cost": "apm_annual_cost",
            "cost_software_licenses": "apm_cost_software_licenses",
            "cost_cloud_infrastructure": "apm_cost_cloud_infrastructure",
            "cost_vendor_maintenance": "apm_cost_vendor_maintenance",
            "cost_internal_labor": "apm_cost_internal_labor",
            "active_users": "apm_active_users",
            "capex_ratio": "apm_capex_ratio",
            "cost_type": "apm_cost_type",
            "cost_center": "apm_cost_center",
            "business_criticality": "apm_business_criticality",
            "lifecycle_status": "apm_lifecycle_status",
            "live_date": "apm_live_date",
            "retirement_date": "apm_retirement_date",
            "business_owner": "apm_business_owner",
            "technical_owner": "apm_technical_owner",
            "vendor": "apm_vendor",
            "hosting_type": "apm_hosting_type",
            "architecture_type": "apm_architecture_type",
            "data_classification": "apm_data_classification",
            "personal_data": "apm_personal_data",
            "sla_level": "apm_sla_level",
            "rto_hours": "apm_rto_hours"
        }

        for attr_key, pkg_prop in prop_mapping.items():
            if attr_key in attributes and attributes[attr_key] is not None:
                elem_props[pkg_prop] = attributes[attr_key]

        if "annual_cost" not in attributes and getattr(apm, "annual_cost", 0.0):
            elem_props["apm_annual_cost"] = apm.annual_cost

        element.properties = elem_props

        db.commit()
        db.refresh(apm)
        return apm

    @staticmethod
    def get_tco_breakdown(db: Session, model_id: str) -> Dict[str, Any]:
        """Calculates analytic TCO financial breakdowns, unit economics, and Cost vs Value matrices."""
        summary = APMService.get_portfolio_summary(db, model_id)
        all_apps = summary.get("applications", [])
        in_scope_apps = [a for a in all_apps if a.get("is_business_app")]
        if not in_scope_apps:
            in_scope_apps = all_apps

        total_tco = sum(a.get("annual_cost", 0.0) for a in in_scope_apps)
        total_licenses = sum(a.get("cost_software_licenses", 0.0) for a in in_scope_apps)
        total_cloud = sum(a.get("cost_cloud_infrastructure", 0.0) for a in in_scope_apps)
        total_maintenance = sum(a.get("cost_vendor_maintenance", 0.0) for a in in_scope_apps)
        total_labor = sum(a.get("cost_internal_labor", 0.0) for a in in_scope_apps)

        breakdown_accounted = total_licenses + total_cloud + total_maintenance + total_labor
        total_unallocated = max(0.0, round(total_tco - breakdown_accounted, 2))

        # CAPEX vs OPEX
        total_capex = 0.0
        for a in in_scope_apps:
            c = a.get("annual_cost", 0.0)
            ratio = a.get("capex_ratio", 0.0)
            total_capex += c * (ratio / 100.0)
        total_opex = max(0.0, total_tco - total_capex)

        capex_pct = round((total_capex / total_tco * 100.0), 1) if total_tco > 0 else 0.0
        opex_pct = round((total_opex / total_tco * 100.0), 1) if total_tco > 0 else 100.0

        # Users & Unit Economics
        total_users = sum(a.get("active_users", 0) for a in in_scope_apps)
        avg_cost_per_user = round(total_tco / total_users, 2) if total_users > 0 else 0.0

        # Waste / Rationalization potential (spend trapped in Eliminate or Phase-out)
        waste_apps = [
            a for a in in_scope_apps
            if a.get("time_quadrant") == "Eliminate" or a.get("lifecycle_status") in ("Phase Out", "Retired")
        ]
        waste_eliminate_cost = sum(a.get("annual_cost", 0.0) for a in waste_apps)
        strategic_invest_cost = sum(a.get("annual_cost", 0.0) for a in in_scope_apps if a.get("time_quadrant") == "Invest")

        # Cost categories list
        cost_by_category = [
            {
                "category": "Licenze Software & SaaS",
                "category_key": "licenses",
                "amount": round(total_licenses, 2),
                "percentage": round(total_licenses / total_tco * 100.0, 1) if total_tco > 0 else 0.0,
                "color": "indigo"
            },
            {
                "category": "Infrastruttura Cloud & Hosting",
                "category_key": "cloud",
                "amount": round(total_cloud, 2),
                "percentage": round(total_cloud / total_tco * 100.0, 1) if total_tco > 0 else 0.0,
                "color": "cyan"
            },
            {
                "category": "Supporto Fornitore & AMS",
                "category_key": "maintenance",
                "amount": round(total_maintenance, 2),
                "percentage": round(total_maintenance / total_tco * 100.0, 1) if total_tco > 0 else 0.0,
                "color": "amber"
            },
            {
                "category": "Personale Interno & Operations",
                "category_key": "labor",
                "amount": round(total_labor, 2),
                "percentage": round(total_labor / total_tco * 100.0, 1) if total_tco > 0 else 0.0,
                "color": "emerald"
            }
        ]
        if total_unallocated > 0:
            cost_by_category.append({
                "category": "Costi Base Non Disaggregati",
                "category_key": "unallocated",
                "amount": total_unallocated,
                "percentage": round(total_unallocated / total_tco * 100.0, 1) if total_tco > 0 else 0.0,
                "color": "slate"
            })

        # Cost by Cost Center
        cc_map = {}
        for a in in_scope_apps:
            cc = a.get("cost_center") or "Generale / Non Assegnato"
            if cc not in cc_map:
                cc_map[cc] = {"cost_center": cc, "total_cost": 0.0, "app_count": 0}
            cc_map[cc]["total_cost"] += a.get("annual_cost", 0.0)
            cc_map[cc]["app_count"] += 1

        cost_by_cost_center = sorted(
            [
                {
                    "cost_center": k,
                    "total_cost": round(v["total_cost"], 2),
                    "app_count": v["app_count"],
                    "percentage": round(v["total_cost"] / total_tco * 100.0, 1) if total_tco > 0 else 0.0
                }
                for k, v in cc_map.items()
            ],
            key=lambda x: x["total_cost"],
            reverse=True
        )

        # Cost vs Business Fit (Value Analysis)
        avg_cost = total_tco / max(1, len(in_scope_apps))
        bad_cost_apps = [] # High Cost, Low Fit
        strategic_core_apps = [] # High Cost, High Fit
        efficiency_apps = [] # Low Cost, High Fit
        low_priority_apps = [] # Low Cost, Low Fit

        for a in in_scope_apps:
            c = a.get("annual_cost", 0.0)
            b_fit = a.get("business_fit", 3)
            app_summary = {
                "id": a["id"],
                "name": a["name"],
                "annual_cost": c,
                "business_fit": b_fit,
                "time_quadrant": a.get("time_quadrant"),
                "cost_center": a.get("cost_center")
            }
            if c >= avg_cost and b_fit < 3:
                bad_cost_apps.append(app_summary)
            elif c >= avg_cost and b_fit >= 3:
                strategic_core_apps.append(app_summary)
            elif c < avg_cost and b_fit >= 3:
                efficiency_apps.append(app_summary)
            else:
                low_priority_apps.append(app_summary)

        # Sort applications by annual cost desc
        sorted_apps = sorted(in_scope_apps, key=lambda x: x.get("annual_cost", 0.0), reverse=True)

        return {
            "summary": {
                "total_annual_tco": round(total_tco, 2),
                "total_software_licenses": round(total_licenses, 2),
                "total_cloud_infrastructure": round(total_cloud, 2),
                "total_vendor_maintenance": round(total_maintenance, 2),
                "total_internal_labor": round(total_labor, 2),
                "total_unallocated": total_unallocated,
                "total_capex": round(total_capex, 2),
                "total_opex": round(total_opex, 2),
                "capex_percentage": capex_pct,
                "opex_percentage": opex_pct,
                "total_active_users": total_users,
                "average_cost_per_user": avg_cost_per_user,
                "waste_eliminate_cost": round(waste_eliminate_cost, 2),
                "waste_eliminate_count": len(waste_apps),
                "strategic_invest_cost": round(strategic_invest_cost, 2),
                "total_applications": len(in_scope_apps),
                "average_cost_per_app": round(avg_cost, 2)
            },
            "cost_by_category": cost_by_category,
            "cost_by_cost_center": cost_by_cost_center,
            "cost_by_time_quadrant": summary.get("time_cost_distribution", {}),
            "cost_by_criticality": {
                crit: sum(a.get("annual_cost", 0.0) for a in in_scope_apps if a.get("business_criticality") == crit)
                for crit in ["Mission Critical", "Business Critical", "Business Operational", "Administrative"]
            },
            "cost_vs_value": {
                "bad_cost_apps": bad_cost_apps,
                "strategic_core_apps": strategic_core_apps,
                "efficiency_apps": efficiency_apps,
                "low_priority_apps": low_priority_apps
            },
            "applications": sorted_apps
        }

    @staticmethod
    def get_lifecycle_analysis(db: Session, model_id: str) -> Dict[str, Any]:
        """
        Calculates executive Application Lifecycle & Decommissioning metrics:
        - Breakdown by lifecycle phase (Plan, Phase In, Live, Phase Out, Retired)
        - Cost Takeout: potential annual savings from decommissioning sunset applications
        - Retirement deadlines (next 6, 12, 24 months)
        - Decommissioning readiness and architectural blockers (active serving/flow relationships to Live apps/processes)
        - Multi-year chronological timeline dataset
        """
        portfolio = APMService.get_portfolio_summary(db, model_id)
        all_apps = portfolio.get("applications", [])
        apps = [a for a in all_apps if a.get("is_business_app")]
        if not apps:
            apps = all_apps

        all_elements = db.query(ArchimateElement).filter(ArchimateElement.model_id == model_id).all()
        elem_map = {e.id: e for e in all_elements}

        relationships = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.model_id == model_id
        ).all()

        outgoing_rels: Dict[str, List[Dict[str, str]]] = {}
        incoming_rels: Dict[str, List[Dict[str, str]]] = {}
        for r in relationships:
            outgoing_rels.setdefault(r.source_id, []).append({"target_id": r.target_id, "type": r.type, "name": r.name or ""})
            incoming_rels.setdefault(r.target_id, []).append({"source_id": r.source_id, "type": r.type, "name": r.name or ""})

        today = date.today()

        status_counts = {"Plan": 0, "Phase In": 0, "Live": 0, "Phase Out": 0, "Retired": 0}
        status_costs = {"Plan": 0.0, "Phase In": 0.0, "Live": 0.0, "Phase Out": 0.0, "Retired": 0.0}

        total_takeout_savings = 0.0
        retirements_6m = 0
        retirements_12m = 0
        retirements_24m = 0

        ready_for_decommission = 0
        blocked_decommission = 0

        enhanced_apps = []

        for app in apps:
            l_stat = app.get("lifecycle_status") or "Live"
            cost = float(app.get("annual_cost") or 0.0)

            if l_stat in status_counts:
                status_counts[l_stat] += 1
                status_costs[l_stat] += cost
            else:
                status_counts["Live"] += 1
                status_costs["Live"] += cost

            raw_live = app.get("live_date")
            raw_ret = app.get("retirement_date")

            live_d = None
            if raw_live:
                try:
                    live_d = datetime.strptime(str(raw_live)[:10], "%Y-%m-%d").date()
                except Exception:
                    pass

            ret_d = None
            if raw_ret:
                try:
                    ret_d = datetime.strptime(str(raw_ret)[:10], "%Y-%m-%d").date()
                except Exception:
                    pass

            is_sunset = l_stat in ("Phase Out", "Retired") or (app.get("time_quadrant") == "Eliminate")
            if is_sunset and l_stat != "Retired":
                total_takeout_savings += cost

            if ret_d:
                diff_days = (ret_d - today).days
                if diff_days <= 180 and diff_days >= -365:
                    retirements_6m += 1
                if diff_days <= 365 and diff_days >= -365:
                    retirements_12m += 1
                if diff_days <= 730 and diff_days >= -365:
                    retirements_24m += 1

            app_id = app["id"]
            dependent_apps = []
            dependent_processes = []

            for rel in outgoing_rels.get(app_id, []):
                tgt = elem_map.get(rel["target_id"])
                if tgt:
                    if tgt.type == "ApplicationComponent":
                        tgt_props = tgt.properties if isinstance(tgt.properties, dict) else {}
                        tgt_stat = tgt_props.get("apm_lifecycle_status") or "Live"
                        if tgt_stat in ("Live", "Phase In"):
                            dependent_apps.append({
                                "id": tgt.id,
                                "name": tgt.name,
                                "type": tgt.type,
                                "relation_type": rel["type"]
                            })
                    elif tgt.type in ("BusinessProcess", "BusinessService", "BusinessFunction"):
                        dependent_processes.append({
                            "id": tgt.id,
                            "name": tgt.name,
                            "type": tgt.type,
                            "relation_type": rel["type"]
                        })

            for rel in incoming_rels.get(app_id, []):
                src = elem_map.get(rel["source_id"])
                if src and src.type in ("BusinessProcess", "BusinessService"):
                    dependent_processes.append({
                        "id": src.id,
                        "name": src.name,
                        "type": src.type,
                        "relation_type": rel["type"]
                    })

            total_dependencies = len(dependent_apps) + len(dependent_processes)

            is_ready = False
            if l_stat in ("Phase Out", "Retired") or (app.get("time_quadrant") == "Eliminate"):
                if total_dependencies == 0:
                    is_ready = True
                    ready_for_decommission += 1
                else:
                    blocked_decommission += 1

            enhanced_app = dict(app)
            enhanced_app.update({
                "live_date": live_d.isoformat() if live_d else raw_live,
                "retirement_date": ret_d.isoformat() if ret_d else raw_ret,
                "is_ready_for_decommission": is_ready,
                "active_dependencies_count": total_dependencies,
                "dependent_live_apps": dependent_apps,
                "dependent_processes": dependent_processes,
                "is_sunset": is_sunset
            })
            enhanced_apps.append(enhanced_app)

        return {
            "summary": {
                "total_applications": len(apps),
                "total_takeout_savings": round(total_takeout_savings, 2),
                "retirements_next_6m": retirements_6m,
                "retirements_next_12m": retirements_12m,
                "retirements_next_24m": retirements_24m,
                "ready_for_decommission_count": ready_for_decommission,
                "blocked_decommission_count": blocked_decommission,
                "counts_by_status": status_counts,
                "costs_by_status": {k: round(v, 2) for k, v in status_costs.items()}
            },
            "timeline_range": {
                "min_year": 2022,
                "max_year": 2029,
                "current_year": today.year,
                "current_date": today.isoformat()
            },
            "applications": enhanced_apps
        }

    @staticmethod
    def get_interface_inventory(db: Session, model_id: str) -> Dict[str, Any]:
        """
        Extracts and computes the Interface & Inter-Application Flow Inventory
        for APM according to ArchiMate 3.x and TOGAF standards.
        Supports both direct Flow relationships and explicit ApplicationInterface elements.
        """
        elements = db.query(ArchimateElement).filter(ArchimateElement.model_id == model_id).all()
        elem_map = {e.id: e for e in elements}

        schemas = db.query(ArchiSchema).filter(ArchiSchema.model_id == model_id).all()
        schema_rel_map: Dict[str, List[Dict[str, str]]] = {}
        for s in schemas:
            vd = s.view_data if isinstance(s.view_data, dict) else {}
            conns = vd.get("connections", [])
            for c in conns:
                rel_id = c.get("relationship_id") or c.get("id")
                if rel_id:
                    if rel_id not in schema_rel_map:
                        schema_rel_map[rel_id] = []
                    if not any(x["id"] == s.id for x in schema_rel_map[rel_id]):
                        schema_rel_map[rel_id].append({
                            "id": s.id,
                            "name": s.name,
                            "viewpoint": s.viewpoint or "Total"
                        })
            nodes = vd.get("nodes", [])
            for n in nodes:
                el_id = n.get("element_id") or n.get("id")
                if el_id:
                    if el_id not in schema_rel_map:
                        schema_rel_map[el_id] = []
                    if not any(x["id"] == s.id for x in schema_rel_map[el_id]):
                        schema_rel_map[el_id].append({
                            "id": s.id,
                            "name": s.name,
                            "viewpoint": s.viewpoint or "Total"
                        })

        flows = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.model_id == model_id,
            ArchimateRelationship.type.in_(["FlowRelationship", "Flow"])
        ).all()

        app_interfaces = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == model_id,
            ArchimateElement.type == "ApplicationInterface"
        ).all()

        def resolve_business_app(elem: Optional[ArchimateElement]):
            if not elem:
                return None
            eprops = elem.properties if isinstance(elem.properties, dict) else {}
            parent_id = eprops.get("parent_application_id")
            if parent_id and parent_id in elem_map:
                return elem_map[parent_id]
            return elem

        items: List[Dict[str, Any]] = []
        protocols_count: Dict[str, int] = {}
        patterns_count: Dict[str, int] = {}
        criticality_count: Dict[str, int] = {}
        status_count: Dict[str, int] = {}
        provider_counts: Dict[str, int] = {}
        consumer_counts: Dict[str, int] = {}
        unique_apps = set()

        for f in flows:
            src = elem_map.get(f.source_id)
            tgt = elem_map.get(f.target_id)
            if not src or not tgt:
                continue

            src_biz = resolve_business_app(src)
            tgt_biz = resolve_business_app(tgt)
            if not src_biz or not tgt_biz:
                continue

            unique_apps.add(src_biz.id)
            unique_apps.add(tgt_biz.id)
            provider_counts[src_biz.name] = provider_counts.get(src_biz.name, 0) + 1
            consumer_counts[tgt_biz.name] = consumer_counts.get(tgt_biz.name, 0) + 1

            props = f.properties if isinstance(f.properties, dict) else {}
            src_biz_props = src_biz.properties if isinstance(src_biz.properties, dict) else {}
            tgt_biz_props = tgt_biz.properties if isinstance(tgt_biz.properties, dict) else {}

            text = f"{(f.name or '')} {(f.documentation or '')} {src_biz.name} {tgt_biz.name}".lower()

            protocol = props.get("protocol") or props.get("interface_type")
            if not protocol:
                if any(k in text for k in ["kafka", "stream", "topic", "event", "broker"]):
                    protocol = "Kafka / Event Stream"
                elif any(k in text for k in ["iso 20022", "swift", "settlement", "pacs", "camt"]):
                    protocol = "ISO 20022 / Messaging"
                elif any(k in text for k in ["lakehouse", "replication", "etl", "batch", "historical", "sftp"]):
                    protocol = "Batch / Data Pipeline"
                elif any(k in text for k in ["database", "persists", "persistence", "sql", "jdbc"]):
                    protocol = "Database / JDBC"
                elif any(k in text for k in ["rest", "api", "gateway", "bff", "order", "validation"]):
                    protocol = "REST API / JSON"
                else:
                    protocol = "REST API / JSON"

            pattern = props.get("pattern")
            if not pattern:
                if protocol in ("Kafka / Event Stream", "ISO 20022 / Messaging"):
                    pattern = "Asynchronous"
                elif protocol == "Batch / Data Pipeline":
                    pattern = "Batch"
                else:
                    pattern = "Synchronous"

            data_format = props.get("data_format") or props.get("payload")
            if not data_format:
                if "order" in text:
                    data_format = "Order Message / JSON"
                elif any(k in text for k in ["price", "market", "tick"]):
                    data_format = "Market Tick Data / Protobuf"
                elif any(k in text for k in ["nav", "valuation"]):
                    data_format = "NAV Valuation Records / XML"
                elif "derivatives" in text:
                    data_format = "Derivatives Position Feed / FpML"
                elif "fraud" in text:
                    data_format = "Security Event Log / CEF"
                elif "settlement" in text:
                    data_format = "ISO 20022 pacs.008 XML"
                elif "replication" in text:
                    data_format = "Parquet / Delta Table"
                else:
                    data_format = "JSON Payload"

            criticality = props.get("criticality")
            if not criticality:
                if any(k in text for k in ["settlement", "fraud", "order", "target2", "swift"]):
                    criticality = "Mission Critical"
                elif any(k in text for k in ["valuation", "derivatives", "prices", "limit"]):
                    criticality = "Business Critical"
                elif any(k in text for k in ["replication", "persists"]):
                    criticality = "Operational"
                else:
                    criticality = "Business Critical"

            frequency = props.get("frequency")
            if not frequency:
                if pattern == "Batch":
                    frequency = "Daily Batch"
                elif pattern == "Asynchronous":
                    frequency = "Near Real-time"
                else:
                    frequency = "Real-time"

            status = props.get("status") or "Live"

            security_auth = props.get("security_auth")
            if not security_auth:
                if any(k in text for k in ["settlement", "fraud", "target2", "swift"]):
                    security_auth = "mTLS / Hardware Token"
                elif pattern == "Synchronous":
                    security_auth = "OAuth 2.0 / JWT"
                elif pattern == "Asynchronous":
                    security_auth = "SASL / SCRAM"
                else:
                    security_auth = "API Key / Token"

            data_classification = props.get("data_classification")
            if not data_classification:
                if any(k in text for k in ["order", "settlement", "fraud", "account", "credit"]):
                    data_classification = "Confidential / PII"
                else:
                    data_classification = "Internal"

            protocols_count[protocol] = protocols_count.get(protocol, 0) + 1
            patterns_count[pattern] = patterns_count.get(pattern, 0) + 1
            criticality_count[criticality] = criticality_count.get(criticality, 0) + 1
            status_count[status] = status_count.get(status, 0) + 1

            schemas_used = schema_rel_map.get(f.id, [])

            items.append({
                "id": f.id,
                "kind": "application_flow",
                "name": f.name or "Unnamed Flow",
                "documentation": f.documentation or "",
                "source_app": {
                    "id": src_biz.id,
                    "name": src_biz.name,
                    "type": src_biz.type,
                    "layer": src_biz.layer,
                    "app_code": src_biz_props.get("apm_app_code", ""),
                    "short_name": src_biz_props.get("apm_short_name", ""),
                    "component_name": src.name if src.id != src_biz.id else None
                },
                "target_app": {
                    "id": tgt_biz.id,
                    "name": tgt_biz.name,
                    "type": tgt_biz.type,
                    "layer": tgt_biz.layer,
                    "app_code": tgt_biz_props.get("apm_app_code", ""),
                    "short_name": tgt_biz_props.get("apm_short_name", ""),
                    "component_name": tgt.name if tgt.id != tgt_biz.id else None
                },
                "protocol": protocol,
                "pattern": pattern,
                "data_format": data_format,
                "criticality": criticality,
                "frequency": frequency,
                "security_auth": security_auth,
                "data_classification": data_classification,
                "status": status,
                "properties": props,
                "used_in_schemas": schemas_used,
                "schemas_count": len(schemas_used)
            })

        for iface in app_interfaces:
            props = iface.properties if isinstance(iface.properties, dict) else {}
            out_rels = [r for r in db.query(ArchimateRelationship).filter(ArchimateRelationship.source_id == iface.id).all()]
            in_rels = [r for r in db.query(ArchimateRelationship).filter(ArchimateRelationship.target_id == iface.id).all()]

            provider = None
            consumers = []
            for r in in_rels:
                src_el = elem_map.get(r.source_id)
                if src_el and src_el.type == "ApplicationComponent":
                    provider = src_el
                    break
            if not provider:
                for r in out_rels:
                    tgt_el = elem_map.get(r.target_id)
                    if tgt_el and tgt_el.type == "ApplicationComponent" and r.type in ("RealizationRelationship", "AssignmentRelationship"):
                        provider = tgt_el
                        break

            for r in out_rels:
                tgt_el = elem_map.get(r.target_id)
                if tgt_el and tgt_el.type == "ApplicationComponent" and tgt_el != provider:
                    consumers.append(tgt_el)

            protocol = props.get("protocol") or props.get("interface_type") or "REST API / JSON"
            pattern = props.get("pattern") or "Synchronous"
            criticality = props.get("criticality") or "Business Critical"
            status = props.get("status") or "Live"

            protocols_count[protocol] = protocols_count.get(protocol, 0) + 1
            patterns_count[pattern] = patterns_count.get(pattern, 0) + 1
            criticality_count[criticality] = criticality_count.get(criticality, 0) + 1
            status_count[status] = status_count.get(status, 0) + 1

            schemas_used = schema_rel_map.get(iface.id, [])

            provider_biz = resolve_business_app(provider) if provider else None
            consumer_first = resolve_business_app(consumers[0]) if consumers else None

            items.append({
                "id": iface.id,
                "kind": "interface_element",
                "name": iface.name,
                "documentation": iface.documentation or "",
                "source_app": {
                    "id": provider_biz.id,
                    "name": provider_biz.name,
                    "type": provider_biz.type,
                    "layer": provider_biz.layer,
                    "app_code": (provider_biz.properties or {}).get("apm_app_code", ""),
                    "short_name": (provider_biz.properties or {}).get("apm_short_name", ""),
                    "component_name": provider.name if provider and provider.id != provider_biz.id else None
                } if provider_biz else None,
                "target_app": {
                    "id": consumer_first.id,
                    "name": consumer_first.name,
                    "type": consumer_first.type,
                    "layer": consumer_first.layer,
                    "app_code": (consumer_first.properties or {}).get("apm_app_code", ""),
                    "short_name": (consumer_first.properties or {}).get("apm_short_name", ""),
                    "component_name": consumers[0].name if consumers and consumers[0].id != consumer_first.id else None
                } if consumer_first else None,
                "consumer_apps": [
                    {
                        "id": resolve_business_app(c).id,
                        "name": resolve_business_app(c).name,
                        "type": resolve_business_app(c).type,
                        "app_code": (resolve_business_app(c).properties or {}).get("apm_app_code", "")
                    } for c in consumers if resolve_business_app(c)
                ],
                "protocol": protocol,
                "pattern": pattern,
                "data_format": props.get("data_format") or "JSON Payload",
                "criticality": criticality,
                "frequency": props.get("frequency") or "Real-time",
                "security_auth": props.get("security_auth") or "OAuth 2.0 / JWT",
                "data_classification": props.get("data_classification") or "Internal",
                "status": status,
                "properties": props,
                "used_in_schemas": schemas_used,
                "schemas_count": len(schemas_used)
            })

        top_providers = sorted(
            [{"name": k, "count": v} for k, v in provider_counts.items()],
            key=lambda x: x["count"],
            reverse=True
        )[:5]

        top_consumers = sorted(
            [{"name": k, "count": v} for k, v in consumer_counts.items()],
            key=lambda x: x["count"],
            reverse=True
        )[:5]

        return {
            "summary": {
                "total_interfaces": len(items),
                "unique_applications": len(unique_apps),
                "protocols_breakdown": protocols_count,
                "patterns_breakdown": patterns_count,
                "criticality_breakdown": criticality_count,
                "status_breakdown": status_count,
                "top_providers": top_providers,
                "top_consumers": top_consumers
            },
            "interfaces": items
        }

    @staticmethod
    def update_interface(db: Session, interface_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        rel = db.query(ArchimateRelationship).filter(ArchimateRelationship.id == interface_id).first()
        if rel:
            if "name" in data and data["name"] is not None:
                rel.name = data["name"]
            if "documentation" in data and data["documentation"] is not None:
                rel.documentation = data["documentation"]
            props = dict(rel.properties or {})
            for field in ["protocol", "pattern", "data_format", "criticality", "frequency", "security_auth", "data_classification", "status"]:
                if field in data and data[field] is not None:
                    props[field] = data[field]
            rel.properties = props
            db.commit()
            return {"id": rel.id, "name": rel.name, "properties": rel.properties}

        elem = db.query(ArchimateElement).filter(ArchimateElement.id == interface_id).first()
        if elem:
            if "name" in data and data["name"] is not None:
                elem.name = data["name"]
            if "documentation" in data and data["documentation"] is not None:
                elem.documentation = data["documentation"]
            props = dict(elem.properties or {})
            for field in ["protocol", "pattern", "data_format", "criticality", "frequency", "security_auth", "data_classification", "status"]:
                if field in data and data[field] is not None:
                    props[field] = data[field]
            elem.properties = props
            db.commit()
            return {"id": elem.id, "name": elem.name, "properties": elem.properties}

        raise ValueError(f"Interface with id {interface_id} not found")

    @staticmethod
    def create_interface(db: Session, model_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        source_id = data.get("source_id")
        target_id = data.get("target_id")
        name = data.get("name") or "New Application Flow"
        doc = data.get("documentation") or ""

        src = db.query(ArchimateElement).filter(ArchimateElement.id == source_id, ArchimateElement.model_id == model_id).first()
        tgt = db.query(ArchimateElement).filter(ArchimateElement.id == target_id, ArchimateElement.model_id == model_id).first()
        if not src or not tgt:
            raise ValueError("Source or target application element not found in model")

        rel_id = f"rel-flow-{uuid.uuid4().hex[:12]}"
        props = {
            "protocol": data.get("protocol", "REST API / JSON"),
            "pattern": data.get("pattern", "Synchronous"),
            "data_format": data.get("data_format", "JSON Payload"),
            "criticality": data.get("criticality", "Business Critical"),
            "frequency": data.get("frequency", "Real-time"),
            "security_auth": data.get("security_auth", "OAuth 2.0 / JWT"),
            "data_classification": data.get("data_classification", "Internal"),
            "status": data.get("status", "Live")
        }

        new_rel = ArchimateRelationship(
            id=rel_id,
            model_id=model_id,
            source_id=source_id,
            target_id=target_id,
            type="FlowRelationship",
            name=name,
            documentation=doc,
            properties=props
        )
        db.add(new_rel)
        db.commit()
        return {
            "id": rel_id,
            "name": name,
            "source_id": source_id,
            "target_id": target_id,
            "properties": props
        }
