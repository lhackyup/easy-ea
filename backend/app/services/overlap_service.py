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

        # 2. Fetch Applications
        applications = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == model_id,
            ArchimateElement.type == "ApplicationComponent"
        ).all()

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
                cost = apm.annual_cost if apm else 0.0
                time_q = apm.time_quadrant if apm else "Tolerate"
                serving_apps_info.append({
                    "app_id": app.id,
                    "app_name": app.name,
                    "annual_cost": cost,
                    "time_quadrant": time_q,
                    "relation_types": rel_types
                })

            app_count = len(serving_apps_info)
            is_redundant = app_count > 1
            if is_redundant:
                total_overlap_count += 1
                # If redundant, calculate cost of non-invest or lowest fit applications as potential savings
                sorted_by_cost = sorted(serving_apps_info, key=lambda x: x["annual_cost"], reverse=True)
                # Keep top 1, sum others as candidate rationalization
                waste = sum(a["annual_cost"] for a in sorted_by_cost[1:])
                potential_cost_waste += waste

                redundant_clusters.append({
                    "capability_id": cap.id,
                    "capability_name": cap.name,
                    "capability_type": cap.type,
                    "app_count": app_count,
                    "potential_savings": waste,
                    "applications": serving_apps_info,
                    "recommendation": f"Razionalizzare: '{cap.name}' è implementata da {app_count} applicazioni ({', '.join(a['app_name'] for a in serving_apps_info)}). Opportunità di consolidamento su un unico sistema di riferimento."
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

        return {
            "total_capabilities": total_caps,
            "total_applications": len(applications),
            "redundant_capabilities_count": total_overlap_count,
            "redundancy_score_percentage": redundancy_score,
            "potential_savings_opportunity": potential_cost_waste,
            "applications_columns": [{"id": a.id, "name": a.name, "annual_cost": a.apm_attributes.annual_cost if a.apm_attributes else 0.0} for a in applications],
            "capability_rows": sorted(capability_rows, key=lambda x: (not x["is_redundant"], -x["app_count"], x["name"])),
            "redundancy_clusters": sorted(redundant_clusters, key=lambda x: x["potential_savings"], reverse=True)
        }
