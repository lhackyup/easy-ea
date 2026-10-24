from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from app.models.archimate import ArchimateElement, ApplicationBusinessAttributes, ModelWorkspace

def calculate_time_quadrant(business_fit: int, technical_fit: int) -> str:
    """
    Gartner TIME Model Matrix:
    - Business Fit >= 3 & Technical Fit >= 3  => INVEST (Strategic value, modern tech)
    - Business Fit >= 3 & Technical Fit < 3   => MIGRATE (High business value, legacy tech)
    - Business Fit < 3 & Technical Fit >= 3   => TOLERATE (Low business value, stable tech)
    - Business Fit < 3 & Technical Fit < 3    => ELIMINATE (Low value, high technical debt)
    """
    if business_fit >= 3 and technical_fit >= 3:
        return "Invest"
    elif business_fit >= 3 and technical_fit < 3:
        return "Migrate"
    elif business_fit < 3 and technical_fit >= 3:
        return "Tolerate"
    else:
        return "Eliminate"

class APMService:
    @staticmethod
    def get_portfolio_summary(db: Session, model_id: str) -> Dict[str, Any]:
        """Calculates executive APM metrics for a model workspace."""
        apps = db.query(ArchimateElement).filter(
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
        lifecycle_counts = {"Plan": 0, "Evaluation": 0, "Live": 0, "Phase-out": 0, "Retired": 0}
        hosting_counts = {}
        vendor_costs = {}

        app_list = []

        for app in apps:
            apm = app.apm_attributes
            props = app.properties if isinstance(app.properties, dict) else {}

            # Read from package attributes (apm_ / tme_), then legacy eea_, then apm model, then default
            b_fit = int(props.get("tme_business_fit") or props.get("eea_business_fit") or (apm.business_fit if apm else 3))
            t_fit = int(props.get("tme_technical_fit") or props.get("eea_technical_fit") or (apm.technical_fit if apm else 3))
            
            raw_cost = props.get("apm_annual_cost") or props.get("eea_annual_cost") or (apm.annual_cost if apm else 0.0)
            try:
                cost = float(raw_cost)
            except (ValueError, TypeError):
                cost = 0.0

            crit = props.get("apm_business_criticality") or props.get("eea_business_criticality") or (apm.business_criticality if apm else "Business Operational")
            l_stat = props.get("apm_lifecycle_status") or props.get("eea_lifecycle_status") or (apm.lifecycle_status if apm else "Live")
            
            auto_time = calculate_time_quadrant(b_fit, t_fit)
            time_q = props.get("tme_quadrant") or props.get("eea_time_quadrant") or (apm.time_quadrant if apm else auto_time)
            
            b_owner = props.get("apm_business_owner") or props.get("eea_business_owner") or (apm.business_owner if apm else "Unassigned")
            t_owner = props.get("apm_technical_owner") or props.get("eea_technical_owner") or (apm.technical_owner if apm else "Unassigned")
            vendor = props.get("apm_vendor") or props.get("eea_vendor") or (apm.vendor if apm else "Internal")
            hosting = props.get("apm_hosting_type") or props.get("eea_hosting_type") or (apm.hosting_type if apm else "Cloud")
            
            raw_in_scope = props.get("apm_in_scope") if "apm_in_scope" in props else props.get("eea_in_apm_scope")
            if raw_in_scope is not None:
                in_scope = str(raw_in_scope).lower() in ("true", "1", "yes")
            else:
                in_scope = apm.in_apm_scope if apm and apm.in_apm_scope is not None else True

            if in_scope:
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
                "time_quadrant": time_q,
                "annual_cost": cost,
                "business_criticality": crit,
                "lifecycle_status": l_stat,
                "business_owner": b_owner,
                "technical_owner": t_owner,
                "vendor": vendor,
                "hosting_type": hosting,
                "in_apm_scope": in_scope,
                "data_classification": apm.data_classification if apm else "Internal",
                "sla_level": apm.sla_level if apm else "Silver (99.0%)",
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
        """Creates or updates business attributes for an Application Component."""
        apm = db.query(ApplicationBusinessAttributes).filter(
            ApplicationBusinessAttributes.element_id == element_id
        ).first()

        b_fit = attributes.get("business_fit", apm.business_fit if apm else 3)
        t_fit = attributes.get("technical_fit", apm.technical_fit if apm else 3)
        auto_time = calculate_time_quadrant(b_fit, t_fit)

        if not apm:
            apm = ApplicationBusinessAttributes(
                element_id=element_id,
                business_fit=b_fit,
                technical_fit=t_fit,
                time_quadrant=attributes.get("time_quadrant", auto_time),
                annual_cost=attributes.get("annual_cost", 0.0),
                business_criticality=attributes.get("business_criticality", "Business Operational"),
                lifecycle_status=attributes.get("lifecycle_status", "Live"),
                business_owner=attributes.get("business_owner", ""),
                technical_owner=attributes.get("technical_owner", ""),
                vendor=attributes.get("vendor", ""),
                hosting_type=attributes.get("hosting_type", "Cloud"),
                data_classification=attributes.get("data_classification", "Internal"),
                sla_level=attributes.get("sla_level", "Silver (99.0%)"),
                in_apm_scope=attributes.get("in_apm_scope", True),
                notes=attributes.get("notes", "")
            )
            db.add(apm)
        else:
            for key, val in attributes.items():
                if hasattr(apm, key):
                    setattr(apm, key, val)
            if "business_fit" in attributes or "technical_fit" in attributes:
                if "time_quadrant" not in attributes:
                    apm.time_quadrant = auto_time

        # Also sync to element properties
        element = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
        if element:
            elem_props = dict(element.properties) if isinstance(element.properties, dict) else {}
            prop_mapping = {
                "business_fit": "tme_business_fit",
                "technical_fit": "tme_technical_fit",
                "time_quadrant": "tme_quadrant",
                "annual_cost": "apm_annual_cost",
                "business_criticality": "apm_business_criticality",
                "lifecycle_status": "apm_lifecycle_status",
                "business_owner": "apm_business_owner",
                "technical_owner": "apm_technical_owner",
                "vendor": "apm_vendor",
                "hosting_type": "apm_hosting_type",
                "data_classification": "apm_data_classification",
                "sla_level": "apm_sla_level",
                "in_apm_scope": "apm_in_scope"
            }
            for attr_key, pkg_prop in prop_mapping.items():
                if attr_key in attributes:
                    elem_props[pkg_prop] = attributes[attr_key]
            element.properties = elem_props

        db.commit()
        db.refresh(apm)
        return apm
