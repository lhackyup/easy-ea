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
            if not apm:
                # Default mock attributes if not set
                b_fit = 3
                t_fit = 3
                cost = 0.0
                crit = "Business Operational"
                l_stat = "Live"
                time_q = "Tolerate"
                b_owner = "Unassigned"
                t_owner = "Unassigned"
                vendor = "Internal"
                hosting = "Cloud"
                in_scope = True
            else:
                b_fit = apm.business_fit
                t_fit = apm.technical_fit
                cost = apm.annual_cost or 0.0
                crit = apm.business_criticality or "Business Operational"
                l_stat = apm.lifecycle_status or "Live"
                time_q = apm.time_quadrant or calculate_time_quadrant(b_fit, t_fit)
                b_owner = apm.business_owner or "Unassigned"
                t_owner = apm.technical_owner or "Unassigned"
                vendor = apm.vendor or "Internal"
                hosting = apm.hosting_type or "Cloud"
                in_scope = apm.in_apm_scope if apm.in_apm_scope is not None else True

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

        db.commit()
        db.refresh(apm)
        return apm
