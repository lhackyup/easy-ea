import re
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session, joinedload
from app.models.archimate import ArchimateElement, ApplicationBusinessAttributes, ModelWorkspace, ElementStereotype

def calculate_time_quadrant(business_fit: int, technical_fit: int) -> str:
    """
    Gartner TIME Model Matrix:
    - Business/Functional Fit >= 3 & Technical Fit >= 3  => INVEST (Strategic value, modern tech)
    - Business/Functional Fit >= 3 & Technical Fit < 3   => MIGRATE (High business value, legacy tech)
    - Business/Functional Fit < 3 & Technical Fit >= 3   => TOLERATE (Low business value, stable tech)
    - Business/Functional Fit < 3 & Technical Fit < 3    => ELIMINATE (Low value, high technical debt)
    """
    if business_fit >= 3 and technical_fit >= 3:
        return "Invest"
    elif business_fit >= 3 and technical_fit < 3:
        return "Migrate"
    elif business_fit < 3 and technical_fit >= 3:
        return "Tolerate"
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

            raw_cost = props.get("apm_annual_cost") or props.get("eea_annual_cost") or (apm.annual_cost if apm else 0.0)
            try:
                cost = float(raw_cost)
            except (ValueError, TypeError):
                cost = 0.0

            crit = props.get("apm_business_criticality") or props.get("eea_business_criticality") or (apm.business_criticality if apm else "Business Operational")
            l_stat = props.get("apm_lifecycle_status") or props.get("eea_lifecycle_status") or (apm.lifecycle_status if apm else "Live")
            
            auto_time = calculate_time_quadrant(b_fit, t_fit)
            time_override = props.get("apm_time_quadrant_override") or props.get("tme_quadrant") or props.get("eea_time_quadrant") or ""
            time_q = time_override if time_override in ("Invest", "Migrate", "Tolerate", "Eliminate") else auto_time

            b_owner = props.get("apm_business_owner") or props.get("eea_business_owner") or (apm.business_owner if apm else "")
            t_owner = props.get("apm_technical_owner") or props.get("eea_technical_owner") or (apm.technical_owner if apm else "")
            vendor = props.get("apm_vendor") or props.get("eea_vendor") or (apm.vendor if apm else "Internal")
            cost_center = props.get("apm_cost_center") or ""
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
                "documentation": app.documentation,
                "business_fit": b_fit,
                "technical_fit": t_fit,
                "functional_fit_label": str(raw_b_fit),
                "technical_fit_label": str(raw_t_fit),
                "time_quadrant": time_q,
                "time_quadrant_override": time_override,
                "annual_cost": cost,
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
            "total_applications": total_apps,
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
            for key in ["business_criticality", "lifecycle_status", "business_owner", "technical_owner", "vendor", "hosting_type", "data_classification", "sla_level", "notes"]:
                if key in attributes:
                    setattr(apm, key, attributes[key])
            if "annual_cost" in attributes:
                apm.annual_cost = float(attributes["annual_cost"])
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

        element.properties = elem_props

        db.commit()
        db.refresh(apm)
        return apm
