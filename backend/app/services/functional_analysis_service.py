from typing import Dict, List, Any, Optional, Set
from sqlalchemy.orm import Session, joinedload
from app.models.archimate import ArchimateElement, ArchimateRelationship

class FunctionalAnalysisService:
    @staticmethod
    def analyze_functional_architecture(db: Session, model_id: str) -> Dict[str, Any]:
        """
        Analyzes the functional architecture of a model:
        - Extracts Business Functions and Capabilities arranged in a hierarchical decomposition (Composition / Aggregation)
        - Supports variable depth hierarchies (branches stopping at L1, branches at L2, or branches continuing to L3+)
        - Architectural Rule: The evaluation of Functional Gaps and Overlaps is capped at Level 2 (L2):
            * If a branch stops at L1 (no children), L1 is the evaluation unit.
            * If a branch reaches L2, L2 is the evaluation unit (even if decomposed into L3/L4).
            * Applications mapped to L3+ sub-functions are automatically imputed (rolled up) to their parent L2 function.
            * Sub-functions at L3+ remain fully browsable in the hierarchical tree for fine-grained process/task visibility.
        - Evaluates Functional Gap (evaluation units with 0 applications)
        - Evaluates Functional Overlapping / Redundancy (evaluation units with >= 2 applications)
        - Evaluates Optimal Coverage (evaluation units with exactly 1 application)
        - Computes hierarchical Roll-up metrics (Coverage %, Redundancy %, Potential Savings) for parent/root branches
        """
        # 1. Fetch Functional Elements (BusinessFunction & Capability)
        functional_elements = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == model_id,
            ArchimateElement.type.in_(["BusinessFunction", "Capability", "ApplicationFunction"])
        ).all()

        func_map = {f.id: f for f in functional_elements}

        # 2. Fetch Applications (respecting in_apm_scope != False and excluding internal sub-components)
        all_applications = db.query(ArchimateElement).options(
            joinedload(ArchimateElement.apm_attributes),
            joinedload(ArchimateElement.stereotype)
        ).filter(
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
        app_map = {a.id: a for a in applications}

        # 3. Fetch all Relationships in the model
        relationships = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.model_id == model_id
        ).all()

        # Build adjacency maps
        outgoing: Dict[str, List[Dict[str, str]]] = {}
        incoming: Dict[str, List[Dict[str, str]]] = {}

        for r in relationships:
            outgoing.setdefault(r.source_id, []).append({"target": r.target_id, "type": r.type, "rel_id": r.id})
            incoming.setdefault(r.target_id, []).append({"source": r.source_id, "type": r.type, "rel_id": r.id})

        # 4. Map Applications directly or via 2-hop links to Functional Elements
        func_app_links: Dict[str, Dict[str, List[str]]] = {f_id: {} for f_id in func_map}

        for f_id in func_map:
            # Direct incoming: App -> Function
            for inc in incoming.get(f_id, []):
                s_id = inc["source"]
                if s_id in app_map:
                    func_app_links[f_id].setdefault(s_id, []).append(inc["type"])
                else:
                    # 2-hop check: App -> Intermediate (e.g. AppService) -> Function
                    for sub_inc in incoming.get(s_id, []):
                        if sub_inc["source"] in app_map:
                            func_app_links[f_id].setdefault(sub_inc["source"], []).append(f"{sub_inc['type']} -> {inc['type']}")

            # Direct outgoing: Function -> App
            for out in outgoing.get(f_id, []):
                t_id = out["target"]
                if t_id in app_map:
                    func_app_links[f_id].setdefault(t_id, []).append(out["type"])

        # 5. Build Hierarchy between functional elements (Composition / Aggregation)
        parent_to_children: Dict[str, List[str]] = {f_id: [] for f_id in func_map}
        child_to_parent: Dict[str, str] = {}

        for f_id in func_map:
            for out in outgoing.get(f_id, []):
                t_id = out["target"]
                rel_type = out["type"] or ""
                if t_id in func_map and ("Composition" in rel_type or "Aggregation" in rel_type):
                    parent_to_children[f_id].append(t_id)
                    child_to_parent[t_id] = f_id

        root_ids = [f_id for f_id in func_map if f_id not in child_to_parent]

        # Helper to extract cost and APM attributes for an application
        def _get_app_info(
            app_id: str,
            rel_types: List[str],
            inherited_from: Optional[str] = None,
            imputed_from: Optional[str] = None
        ) -> Dict[str, Any]:
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

            return {
                "app_id": app.id,
                "app_name": app.name,
                "annual_cost": cost,
                "time_quadrant": time_q,
                "business_fit": bfit,
                "technical_fit": tfit,
                "relation_types": rel_types,
                "is_inherited": inherited_from is not None,
                "inherited_from": inherited_from,
                "is_imputed_from_child": imputed_from is not None,
                "imputed_from": imputed_from
            }

        # Helper to recursively gather all direct applications from all descendants of a node
        def gather_descendant_direct_apps(node_id: str) -> Dict[str, Dict[str, Any]]:
            gathered: Dict[str, Dict[str, Any]] = {}
            for child_id in parent_to_children.get(node_id, []):
                child_elem = func_map.get(child_id)
                child_name = child_elem.name if child_elem else child_id
                # Direct apps on child
                for a_id, rel_types in func_app_links.get(child_id, {}).items():
                    if a_id in app_map and a_id not in gathered:
                        gathered[a_id] = _get_app_info(a_id, rel_types, imputed_from=child_name)
                # Recurse further down
                sub_gathered = gather_descendant_direct_apps(child_id)
                for a_id, info in sub_gathered.items():
                    if a_id not in gathered:
                        gathered[a_id] = info
            return gathered

        # 6. Recursive tree construction with L2 Cap rule & Bottom-up L3+ imputation
        def build_node(node_id: str, current_level: int, inherited_apps: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
            element = func_map[node_id]
            child_ids = parent_to_children.get(node_id, [])
            has_children = len(child_ids) > 0

            # Architectural Rule:
            # - If current_level >= 2, this is the evaluation unit (or detail sub-node if > 2).
            # - If current_level == 2, it is the Evaluation Unit (Analysis Unit).
            # - If current_level < 2 and has no children, it is also an Evaluation Unit.
            # - If current_level < 2 and has children, it is a branch for roll-up.
            is_evaluation_unit = (current_level == 2) or (not has_children and current_level <= 2)
            is_leaf = not has_children

            # Direct applications for this node
            direct_apps_dict: Dict[str, Dict[str, Any]] = {}
            for a_id, rel_types in func_app_links.get(node_id, {}).items():
                if a_id in app_map:
                    direct_apps_dict[a_id] = _get_app_info(a_id, rel_types)

            # Bottom-up imputation: If this node is at Level 2, impute applications from all L3+ descendants
            imputed_from_children_dict: Dict[str, Dict[str, Any]] = {}
            if current_level == 2 and has_children:
                imputed_from_children_dict = gather_descendant_direct_apps(node_id)

            # Combined effective applications
            effective_apps_dict = dict(inherited_apps)
            effective_apps_dict.update(imputed_from_children_dict)
            effective_apps_dict.update(direct_apps_dict) # Direct assignment takes highest precedence

            # Apps to pass down to children (inherited)
            apps_for_children = {
                a_id: _get_app_info(a_id, info["relation_types"], inherited_from=element.name)
                for a_id, info in effective_apps_dict.items()
            }

            # Build children recursively
            children_nodes = [
                build_node(c_id, current_level + 1, apps_for_children)
                for c_id in child_ids
            ]

            effective_apps_list = list(effective_apps_dict.values())
            direct_apps_list = list(direct_apps_dict.values())
            app_count = len(effective_apps_list)

            # Determine Status
            is_gap = False
            is_optimal = False
            is_overlapping = False
            target_app = None
            candidate_decommissions = []
            node_savings = 0.0
            recommendation = None

            if is_evaluation_unit:
                if app_count == 0:
                    is_gap = True
                    status = "gap"
                    recommendation = f"Buca funzionale: la funzione '{element.name}' non è coperta da alcun applicativo IT. Valutare digitalizzazione o sourcing."
                elif app_count == 1:
                    is_optimal = True
                    status = "optimal"
                    app_ref = effective_apps_list[0]
                    imputed_note = f" (imputata dal dettaglio '{app_ref['imputed_from']}')" if app_ref.get("imputed_from") else ""
                    recommendation = f"Copertura ottimale: la funzione '{element.name}' è servita in modo univoco da '{app_ref['app_name']}'{imputed_note}."
                else:
                    is_overlapping = True
                    status = "overlapping"
                    quadrant_rank = {"Invest": 4, "Tolerate": 3, "Migrate": 2, "Eliminate": 1}
                    sorted_apps = sorted(
                        effective_apps_list,
                        key=lambda x: (
                            quadrant_rank.get(x["time_quadrant"], 2),
                            (x.get("business_fit", 3) + x.get("technical_fit", 3)),
                            -x["annual_cost"]
                        ),
                        reverse=True
                    )
                    target_app = sorted_apps[0]
                    candidate_decommissions = sorted_apps[1:]
                    node_savings = sum(a["annual_cost"] for a in candidate_decommissions)
                    decomm_names = ", ".join(f"{a['app_name']} ({a['time_quadrant']})" for a in candidate_decommissions)
                    recommendation = (
                        f"Sovrapposizione rilevata a livello {f'L{current_level}'}: razionalizzare consolidando sul sistema target '{target_app['app_name']}' "
                        f"({target_app['time_quadrant']}) e pianificando la dismissione o migrazione di: {decomm_names}."
                    )
            elif current_level > 2:
                # Detail sub-function under an L2 evaluation unit
                status = "detail_subfunction"
                if app_count == 0:
                    recommendation = f"Sotto-funzione di dettaglio '{element.name}': nessun applicativo diretto (copertura delegata al livello L2 padre)."
                else:
                    assigned_names = ", ".join(a["app_name"] for a in effective_apps_list)
                    recommendation = f"Sotto-funzione di dettaglio servita da: {assigned_names} (imputata alla funzione L2 genitrice)."
            else:
                # Macro branch at L0 or L1
                status = "branch"

            # Rollup calculation: aggregate only the Evaluation Units (capped at L2)
            def collect_evaluation_units(n: Dict[str, Any]) -> List[Dict[str, Any]]:
                if n["is_evaluation_unit"]:
                    return [n]
                res = []
                for ch in n["children"]:
                    res.extend(collect_evaluation_units(ch))
                return res

            subtree_units = []
            if is_evaluation_unit:
                subtree_units = [{
                    "id": node_id,
                    "name": element.name,
                    "type": element.type,
                    "level": current_level,
                    "is_gap": is_gap,
                    "is_optimal": is_optimal,
                    "is_overlapping": is_overlapping,
                    "app_count": app_count,
                    "potential_savings": node_savings,
                    "target_app": target_app,
                    "candidate_decommissions": candidate_decommissions,
                    "applications": effective_apps_list
                }]
            else:
                for ch in children_nodes:
                    subtree_units.extend(collect_evaluation_units(ch))

            total_units_count = len(subtree_units)
            gap_units_count = sum(1 for u in subtree_units if u["is_gap"])
            optimal_units_count = sum(1 for u in subtree_units if u["is_optimal"])
            overlapping_units_count = sum(1 for u in subtree_units if u["is_overlapping"])
            covered_units_count = total_units_count - gap_units_count
            rollup_savings = sum(u["potential_savings"] for u in subtree_units)

            coverage_rate = round((covered_units_count / total_units_count * 100), 1) if total_units_count > 0 else 0.0
            redundancy_rate = round((overlapping_units_count / total_units_count * 100), 1) if total_units_count > 0 else 0.0

            node_data = {
                "id": node_id,
                "name": element.name,
                "type": element.type,
                "layer": element.layer,
                "documentation": element.documentation,
                "level": current_level,
                "level_label": f"L{current_level}",
                "is_leaf": is_leaf,
                "is_evaluation_unit": is_evaluation_unit,
                "has_children": has_children,
                "status": status,
                "recommendation": recommendation,
                "direct_applications": direct_apps_list,
                "effective_applications": effective_apps_list,
                "app_count": app_count,
                "is_gap": is_gap,
                "is_optimal": is_optimal,
                "is_overlapping": is_overlapping,
                "target_app": target_app,
                "candidate_decommissions": candidate_decommissions,
                "potential_savings": node_savings if is_evaluation_unit else rollup_savings,
                "children": children_nodes,
                # Rollup metrics for parent branches
                "rollup": {
                    "total_leaves": total_units_count,
                    "covered_leaves": covered_units_count,
                    "gap_leaves": gap_units_count,
                    "optimal_leaves": optimal_units_count,
                    "overlapping_leaves": overlapping_units_count,
                    "coverage_rate": coverage_rate,
                    "redundancy_rate": redundancy_rate,
                    "potential_savings": rollup_savings
                }
            }
            return node_data

        # Build trees starting from root nodes
        hierarchy_trees = [build_node(r_id, 0, {}) for r_id in root_ids]

        # 7. Flatten all evaluation units (capped at L2) for tabulations, search and global KPIs
        all_eval_units: List[Dict[str, Any]] = []
        def extract_units(n: Dict[str, Any], path: List[str]):
            current_path = path + [n["name"]]
            if n["is_evaluation_unit"]:
                all_eval_units.append({
                    "id": n["id"],
                    "name": n["name"],
                    "type": n["type"],
                    "layer": n["layer"],
                    "documentation": n["documentation"],
                    "level": n["level"],
                    "level_label": n["level_label"],
                    "path": " > ".join(current_path),
                    "root_domain": current_path[0] if current_path else n["name"],
                    "status": n["status"],
                    "app_count": n["app_count"],
                    "is_gap": n["is_gap"],
                    "is_optimal": n["is_optimal"],
                    "is_overlapping": n["is_overlapping"],
                    "target_app": n["target_app"],
                    "candidate_decommissions": n["candidate_decommissions"],
                    "potential_savings": n["potential_savings"],
                    "applications": n["effective_applications"],
                    "recommendation": n["recommendation"],
                    "has_subfunctions": n["has_children"]
                })
            else:
                for ch in n["children"]:
                    extract_units(ch, current_path)

        for tree in hierarchy_trees:
            extract_units(tree, [])

        # Global KPIs based on evaluation units
        total_eval_units = len(all_eval_units)
        gap_units = [u for u in all_eval_units if u["is_gap"]]
        optimal_units = [u for u in all_eval_units if u["is_optimal"]]
        overlapping_units = [u for u in all_eval_units if u["is_overlapping"]]

        total_covered = total_eval_units - len(gap_units)
        global_coverage_rate = round((total_covered / total_eval_units * 100), 1) if total_eval_units > 0 else 0.0
        global_redundancy_rate = round((len(overlapping_units) / total_eval_units * 100), 1) if total_eval_units > 0 else 0.0
        global_potential_savings = sum(u["potential_savings"] for u in overlapping_units)

        # Rationalization clusters (from evaluation units)
        redundancy_clusters = [
            {
                "leaf_id": u["id"],
                "leaf_name": u["name"],
                "path": u["path"],
                "app_count": u["app_count"],
                "target_app": u["target_app"],
                "candidate_decommissions": u["candidate_decommissions"],
                "potential_savings": u["potential_savings"],
                "applications": u["applications"],
                "recommendation": u["recommendation"]
            }
            for u in overlapping_units
        ]
        redundancy_clusters.sort(key=lambda x: x["potential_savings"], reverse=True)

        # Gap list
        gap_clusters = [
            {
                "leaf_id": u["id"],
                "leaf_name": u["name"],
                "path": u["path"],
                "level_label": u["level_label"],
                "root_domain": u["root_domain"],
                "documentation": u["documentation"],
                "recommendation": u["recommendation"]
            }
            for u in gap_units
        ]

        def _get_cost(a: ArchimateElement) -> float:
            apm = a.apm_attributes
            props = a.properties if isinstance(a.properties, dict) else {}
            raw = apm.annual_cost if apm and apm.annual_cost is not None else props.get("apm_annual_cost") or props.get("eea_annual_cost") or 0.0
            try:
                return float(raw)
            except (ValueError, TypeError):
                return 0.0

        return {
            "model_id": model_id,
            "total_functional_elements": len(functional_elements),
            "total_root_functions": len(root_ids),
            "total_leaf_functions": total_eval_units,
            "covered_leaf_functions": total_covered,
            "gap_leaf_functions_count": len(gap_units),
            "optimal_leaf_functions_count": len(optimal_units),
            "overlapping_leaf_functions_count": len(overlapping_units),
            "coverage_rate_percentage": global_coverage_rate,
            "redundancy_rate_percentage": global_redundancy_rate,
            "total_potential_savings": global_potential_savings,
            "applications_count": len(applications),
            "applications_columns": [{"id": a.id, "name": a.name, "annual_cost": _get_cost(a)} for a in applications],
            "hierarchy_trees": hierarchy_trees,
            "leaf_functions": sorted(all_eval_units, key=lambda x: (not x["is_gap"], not x["is_overlapping"], x["name"])),
            "redundancy_clusters": redundancy_clusters,
            "gap_clusters": gap_clusters
        }
