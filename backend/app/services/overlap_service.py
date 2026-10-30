from typing import Dict, List, Any, Set
from sqlalchemy.orm import Session
from app.models.archimate import ArchimateElement, ArchimateRelationship, ApplicationBusinessAttributes

class OverlapService:
    @staticmethod
    def analyze_functional_overlap(db: Session, model_id: str) -> Dict[str, Any]:
        """
        Builds the Capability/Function vs Application Component matrix
        and detects redundant / overlapping application coverage.
        """
        # 1. Fetch Capabilities & Business Functions
        capabilities = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == model_id,
            ArchimateElement.type.in_(["Capability", "BusinessFunction", "BusinessService", "ApplicationFunction"])
        ).all()

        # 2. Fetch Applications (respecting in_apm_scope != False and excluding internal sub-components)
        all_applications = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == model_id,
            ArchimateElement.type == "ApplicationComponent"
        ).all()
        applications = [
            a for a in all_applications
            if not (
                (a.apm_attributes and a.apm_attributes.in_apm_scope is False)
                or (isinstance(a.properties, dict) and str(a.properties.get("eea_in_apm_scope", "true")).lower() == "false")
                or (isinstance(a.properties, dict) and a.properties.get("is_internal_component") is True)
                or (a.stereotype_id is None and not a.apm_attributes)
            )
        ]

        # 3. Fetch all relationships in this model
        relationships = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.model_id == model_id
        ).all()

        # Build adjacency maps
        # source -> [(target, type, rel_id)]
        outgoing: Dict[str, List[Dict[str, str]]] = {}
        # target -> [(source, type, rel_id)]
        incoming: Dict[str, List[Dict[str, str]]] = {}

        for r in relationships:
            outgoing.setdefault(r.source_id, []).append({"target": r.target_id, "type": r.type, "rel_id": r.id})
            incoming.setdefault(r.target_id, []).append({"source": r.source_id, "type": r.type, "rel_id": r.id})

        app_map = {a.id: a for a in applications}
        cap_map = {c.id: c for c in capabilities}

        # Build connections between Application and Capability
        # Support direct links and 2-hop links (e.g., App -> AppFunction -> Capability)
        matrix_cells: Dict[str, Dict[str, List[str]]] = {} # {cap_id: {app_id: [rel_types]}}

        for cap_id in cap_map:
            matrix_cells[cap_id] = {}

            # Direct incoming to Capability from App
            for inc in incoming.get(cap_id, []):
                s_id = inc["source"]
                if s_id in app_map:
                    matrix_cells[cap_id].setdefault(s_id, []).append(inc["type"])
                else:
                    # Check 1-hop intermediate (e.g. App -> Function -> Cap)
                    for sub_inc in incoming.get(s_id, []):
                        if sub_inc["source"] in app_map:
                            matrix_cells[cap_id].setdefault(sub_inc["source"], []).append(f"{sub_inc['type']} -> {inc['type']}")

            # Direct outgoing from Capability to App (e.g. Capability composed of App or served by App)
            for out in outgoing.get(cap_id, []):
                t_id = out["target"]
                if t_id in app_map:
                    matrix_cells[cap_id].setdefault(t_id, []).append(out["type"])

        # Construct Capability Rows and calculate Overlaps
        capability_rows = []
        redundant_clusters = []
        total_overlap_count = 0
        potential_cost_waste = 0.0

        for cap_id, cap in cap_map.items():
            serving_apps_info = []
            linked_app_ids = matrix_cells.get(cap_id, {})

            for app_id, rel_types in linked_app_ids.items():
                app = app_map[app_id]
                apm = app.apm_attributes
                props = app.properties if isinstance(app.properties, dict) else {}

                raw_cost = (
                    apm.annual_cost if apm and apm.annual_cost is not None
                    else props.get("apm_annual_cost") or props.get("eea_annual_cost") or 0.0
                )
                try:
                    cost = float(raw_cost)
                except (ValueError, TypeError):
                    cost = 0.0

                time_q = (
                    apm.time_quadrant if apm and apm.time_quadrant
                    else props.get("apm_time_quadrant_override") or props.get("eea_time_quadrant") or "Tolerate"
                )

                raw_bfit = apm.business_fit if apm and apm.business_fit is not None else props.get("apm_functional_fit") or 3
                raw_tfit = apm.technical_fit if apm and apm.technical_fit is not None else props.get("apm_technical_fit") or 3
                try:
                    bfit = int(str(raw_bfit).split("-")[0].strip())
                except (ValueError, TypeError):
                    bfit = 3
                try:
                    tfit = int(str(raw_tfit).split("-")[0].strip())
                except (ValueError, TypeError):
                    tfit = 3

                serving_apps_info.append({
                    "app_id": app.id,
                    "app_name": app.name,
                    "annual_cost": cost,
                    "time_quadrant": time_q,
                    "business_fit": bfit,
                    "technical_fit": tfit,
                    "relation_types": rel_types
                })

            app_count = len(serving_apps_info)
            is_redundant = app_count > 1
            if is_redundant:
                total_overlap_count += 1
                # Prioritize keeping the strategic target application:
                # 1. Quadrant priority: Invest (4) > Tolerate (3) > Migrate (2) > Eliminate (1)
                # 2. Higher combined fit (business_fit + technical_fit)
                # 3. Lower annual cost (tie-breaker)
                quadrant_rank = {"Invest": 4, "Tolerate": 3, "Migrate": 2, "Eliminate": 1}
                sorted_by_target_priority = sorted(
                    serving_apps_info,
                    key=lambda x: (
                        quadrant_rank.get(x["time_quadrant"], 2),
                        (x.get("business_fit", 3) + x.get("technical_fit", 3)),
                        -x["annual_cost"]
                    ),
                    reverse=True
                )
                target_keeper = sorted_by_target_priority[0]
                candidate_decommissions = sorted_by_target_priority[1:]
                # Sum the annual cost of non-target redundant applications as potential rationalization savings
                waste = sum(a["annual_cost"] for a in candidate_decommissions)
                potential_cost_waste += waste

                decomm_names = ", ".join(f"{a['app_name']} ({a['time_quadrant']})" for a in candidate_decommissions)
                redundant_clusters.append({
                    "capability_id": cap.id,
                    "capability_name": cap.name,
                    "capability_type": cap.type,
                    "app_count": app_count,
                    "target_app_id": target_keeper["app_id"],
                    "target_app_name": target_keeper["app_name"],
                    "potential_savings": waste,
                    "applications": serving_apps_info,
                    "recommendation": (
                        f"Razionalizzare '{cap.name}' consolidando sul sistema target '{target_keeper['app_name']}' "
                        f"({target_keeper['time_quadrant']}) e dismettendo/migrando: {decomm_names}."
                    )
                })

            capability_rows.append({
                "id": cap.id,
                "name": cap.name,
                "type": cap.type,
                "layer": cap.layer,
                "documentation": cap.documentation,
                "app_count": app_count,
                "is_redundant": is_redundant,
                "serving_applications": serving_apps_info
            })

        # Calculate Redundancy Score (Percentage of capabilities served by multiple applications)
        total_caps = len(capabilities)
        redundancy_score = round((total_overlap_count / total_caps * 100), 1) if total_caps > 0 else 0.0

        def _get_cost(a: ArchimateElement) -> float:
            apm = a.apm_attributes
            props = a.properties if isinstance(a.properties, dict) else {}
            raw = apm.annual_cost if apm and apm.annual_cost is not None else props.get("apm_annual_cost") or props.get("eea_annual_cost") or 0.0
            try:
                return float(raw)
            except (ValueError, TypeError):
                return 0.0

        return {
            "total_capabilities": total_caps,
            "total_applications": len(applications),
            "redundant_capabilities_count": total_overlap_count,
            "redundancy_score_percentage": redundancy_score,
            "potential_savings_opportunity": potential_cost_waste,
            "applications_columns": [{"id": a.id, "name": a.name, "annual_cost": _get_cost(a)} for a in applications],
            "capability_rows": sorted(capability_rows, key=lambda x: (not x["is_redundant"], -x["app_count"], x["name"])),
            "redundancy_clusters": sorted(redundant_clusters, key=lambda x: x["potential_savings"], reverse=True)
        }
