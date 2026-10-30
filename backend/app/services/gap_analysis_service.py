from typing import Dict, List, Any, Optional, Set, Tuple
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.archimate import (
    ModelWorkspace,
    ArchimateElement,
    ArchimateRelationship
)


class GapAnalysisService:
    @staticmethod
    def analyze_gap_matrix(
        db: Session,
        model_id: str,
        compare_model_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes an Architectural Gap Analysis (As-Is vs To-Be) conforming to TOGAF & ArchiMate 3.2.
        Supports both Intra-Model Lifecycle/Plateaus mode and Cross-Model Library Comparison.
        """
        base_model = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
        if not base_model:
            raise HTTPException(status_code=404, detail="Base model workspace not found")

        compare_model = None
        if compare_model_id and compare_model_id != model_id:
            compare_model = db.query(ModelWorkspace).filter(ModelWorkspace.id == compare_model_id).first()

        if compare_model:
            return GapAnalysisService._analyze_cross_model(db, base_model, compare_model)
        else:
            return GapAnalysisService._analyze_intra_model(db, base_model)

    @staticmethod
    def _analyze_intra_model(db: Session, model: ModelWorkspace) -> Dict[str, Any]:
        """
        Analyzes Gap categories (Retained, Added, Modified, Retired) within a single library
        using the pkg-gap-analysis attributes, ArchiMate Plateau aggregations, and APM data.
        """
        elements = db.query(ArchimateElement).options(
            joinedload(ArchimateElement.apm_attributes),
            joinedload(ArchimateElement.stereotype)
        ).filter(ArchimateElement.model_id == model.id).all()

        relationships = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.model_id == model.id
        ).all()

        elem_by_id = {e.id: e for e in elements}

        # 1. Map Plateaus and WorkPackages
        plateaus = [e for e in elements if e.type == "Plateau"]
        work_packages = [e for e in elements if e.type == "WorkPackage"]
        wp_names = {wp.name for wp in work_packages if wp.name}
        wp_by_id = {wp.id: wp.name for wp in work_packages}

        # Plateau -> Set of aggregated element IDs
        plateau_membership: Dict[str, Set[str]] = {}
        for r in relationships:
            if r.source_id in [p.id for p in plateaus] and r.type in ["AggregationRelationship", "CompositionRelationship", "RealizationRelationship", "Aggregation", "Composition"]:
                p_elem = elem_by_id.get(r.source_id)
                if p_elem:
                    plateau_membership.setdefault(r.target_id, set()).add(p_elem.name or "Plateau")

        # Element -> Linked WorkPackages via relationships
        elem_wp_links: Dict[str, Set[str]] = {}
        for r in relationships:
            if r.source_id in wp_by_id:
                elem_wp_links.setdefault(r.target_id, set()).add(wp_by_id[r.source_id])
            if r.target_id in wp_by_id:
                elem_wp_links.setdefault(r.source_id, set()).add(wp_by_id[r.target_id])

        # 2. Classify each architectural element
        gap_items: List[Dict[str, Any]] = []
        total_savings = 0.0
        total_added_investments = 0.0
        missing_wp_count = 0

        # Filter out meta-elements (Plateau, WorkPackage, Deliverable, Gap) from matrix rows
        filtered_elements = [
            e for e in elements
            if e.type not in ["Plateau", "WorkPackage", "Deliverable", "Gap"]
        ]

        for e in filtered_elements:
            props = e.properties if isinstance(e.properties, dict) else {}
            apm = e.apm_attributes

            # Read explicit attributes from pkg-gap-analysis if present
            raw_horizon = props.get("architecture_horizon")
            raw_action = props.get("gap_action")
            target_plateau = props.get("target_plateau") or "Target Architecture"
            work_package_ref = props.get("work_package_ref") or ""
            migration_rationale = props.get("migration_rationale") or e.documentation or ""

            try:
                cost_impact = float(props.get("transition_cost_impact") or 0.0)
            except (ValueError, TypeError):
                cost_impact = 0.0

            annual_cost = float(apm.annual_cost) if (apm and apm.annual_cost) else 0.0

            # Fallback/Inference Logic if not explicitly set
            if not raw_action or not raw_horizon:
                quadrant = apm.time_quadrant if apm else None
                lifecycle_status = props.get("eea_lifecycle_status")

                if quadrant == "Eliminate" or lifecycle_status in ["Phase-out", "Retired"]:
                    raw_action = "Retire / Decommission"
                    raw_horizon = "As-Is (Current)"
                elif quadrant == "Invest" or lifecycle_status in ["Plan", "Evaluation"]:
                    raw_action = "Add / Introduce"
                    raw_horizon = "To-Be (Target)"
                elif quadrant == "Migrate":
                    raw_action = "Modify / Migrate"
                    raw_horizon = "Transition Plateau"
                else:
                    # Check plateau membership
                    p_names = plateau_membership.get(e.id, set())
                    has_as_is = any("baseline" in p.lower() or "as-is" in p.lower() for p in p_names)
                    has_to_be = any("target" in p.lower() or "to-be" in p.lower() for p in p_names)
                    if has_as_is and not has_to_be:
                        raw_action = "Retire / Decommission"
                        raw_horizon = "As-Is (Current)"
                    elif has_to_be and not has_as_is:
                        raw_action = "Add / Introduce"
                        raw_horizon = "To-Be (Target)"
                    elif has_as_is and has_to_be:
                        raw_action = "Retain"
                        raw_horizon = "Persistent (Both)"
                    else:
                        raw_action = "Retain"
                        raw_horizon = "Persistent (Both)"

            # Normalize Category Code
            if "Retire" in raw_action:
                category = "RETIRED"
                badge_color = "rose"
                effective_savings = annual_cost if annual_cost > 0 else abs(cost_impact)
                total_savings += effective_savings
            elif "Add" in raw_action:
                category = "ADDED"
                badge_color = "emerald"
                effective_cost = cost_impact if cost_impact > 0 else annual_cost
                total_added_investments += effective_cost
            elif "Modify" in raw_action:
                category = "MODIFIED"
                badge_color = "blue"
                if cost_impact > 0:
                    total_added_investments += cost_impact
                elif cost_impact < 0:
                    total_savings += abs(cost_impact)
            else:
                category = "RETAINED"
                badge_color = "slate"

            # Check WorkPackage Coverage
            linked_wps = list(elem_wp_links.get(e.id, set()))
            if work_package_ref and work_package_ref not in linked_wps:
                linked_wps.append(work_package_ref)

            has_wp = len(linked_wps) > 0
            if category in ["ADDED", "MODIFIED", "RETIRED"] and not has_wp:
                missing_wp_count += 1

            gap_items.append({
                "id": e.id,
                "name": e.name,
                "type": e.type,
                "layer": e.layer or "Other",
                "category": category,
                "badge_color": badge_color,
                "architecture_horizon": raw_horizon or "Persistent (Both)",
                "gap_action": raw_action or "Retain",
                "target_plateau": target_plateau,
                "annual_cost": annual_cost,
                "cost_impact": cost_impact,
                "work_packages": linked_wps,
                "has_work_package": has_wp,
                "migration_rationale": migration_rationale,
                "plateaus": list(plateau_membership.get(e.id, []))
            })

        # Calculate metrics
        retained = [it for it in gap_items if it["category"] == "RETAINED"]
        added = [it for it in gap_items if it["category"] == "ADDED"]
        modified = [it for it in gap_items if it["category"] == "MODIFIED"]
        retired = [it for it in gap_items if it["category"] == "RETIRED"]

        net_delta = round(total_added_investments - total_savings, 2)

        return {
            "mode": "intra_model",
            "base_model": {
                "id": model.id,
                "name": model.name,
                "code": model.code or ""
            },
            "compare_model": None,
            "metrics": {
                "total_elements": len(gap_items),
                "retained_count": len(retained),
                "added_count": len(added),
                "modified_count": len(modified),
                "retired_count": len(retired),
                "total_savings": round(total_savings, 2),
                "total_added_investments": round(total_added_investments, 2),
                "net_financial_delta": net_delta,
                "gaps_missing_work_package": missing_wp_count,
                "available_plateaus_count": len(plateaus),
                "available_work_packages_count": len(work_packages)
            },
            "plateaus": [{"id": p.id, "name": p.name} for p in plateaus],
            "work_packages": [{"id": w.id, "name": w.name} for w in work_packages],
            "items": sorted(gap_items, key=lambda x: (
                0 if x["category"] == "RETIRED" else (1 if x["category"] == "MODIFIED" else (2 if x["category"] == "ADDED" else 3)),
                x["layer"],
                x["name"]
            ))
        }

    @staticmethod
    def _analyze_cross_model(
        db: Session,
        base_model: ModelWorkspace,
        compare_model: ModelWorkspace
    ) -> Dict[str, Any]:
        """
        Compares two distinct model workspaces (e.g. Baseline As-Is library vs Target To-Be library)
        to identify elements added, removed, modified, or preserved.
        """
        base_elements = db.query(ArchimateElement).filter(ArchimateElement.model_id == base_model.id).all()
        target_elements = db.query(ArchimateElement).filter(ArchimateElement.model_id == compare_model.id).all()

        # Build name/type lookup map for comparison
        target_map: Dict[Tuple[str, str], ArchimateElement] = {
            (e.name.strip().lower(), e.type): e for e in target_elements if e.name
        }
        base_map: Dict[Tuple[str, str], ArchimateElement] = {
            (e.name.strip().lower(), e.type): e for e in base_elements if e.name
        }

        gap_items: List[Dict[str, Any]] = []
        total_savings = 0.0
        total_added_investments = 0.0

        # Check Base elements (Retired or Retained or Modified)
        matched_target_keys: Set[Tuple[str, str]] = set()

        for b in base_elements:
            if b.type in ["Plateau", "WorkPackage", "Deliverable", "Gap"]:
                continue
            key = (b.name.strip().lower() if b.name else "", b.type)
            b_cost = float(b.apm_attributes.annual_cost) if (b.apm_attributes and b.apm_attributes.annual_cost) else 0.0

            if key in target_map:
                matched_target_keys.add(key)
                t_match = target_map[key]
                t_cost = float(t_match.apm_attributes.annual_cost) if (t_match.apm_attributes and t_match.apm_attributes.annual_cost) else 0.0
                
                # Compare properties to detect modification
                b_props = b.properties if isinstance(b.properties, dict) else {}
                t_props = t_match.properties if isinstance(t_match.properties, dict) else {}
                diffs = []
                for k, v in t_props.items():
                    if b_props.get(k) != v and k not in ["created_at", "updated_at"]:
                        diffs.append(k)

                is_modified = len(diffs) > 0 or abs(b_cost - t_cost) > 0.01

                if is_modified:
                    cost_delta = round(t_cost - b_cost, 2)
                    if cost_delta > 0:
                        total_added_investments += cost_delta
                    elif cost_delta < 0:
                        total_savings += abs(cost_delta)

                    gap_items.append({
                        "id": b.id,
                        "name": b.name,
                        "type": b.type,
                        "layer": b.layer or "Other",
                        "category": "MODIFIED",
                        "badge_color": "blue",
                        "architecture_horizon": "Transition (Modified in Target)",
                        "gap_action": "Modify / Migrate",
                        "target_plateau": compare_model.name,
                        "annual_cost": b_cost,
                        "cost_impact": cost_delta,
                        "work_packages": [],
                        "has_work_package": False,
                        "migration_rationale": f"Attributi modificati tra librerie: {', '.join(diffs[:3])}" if diffs else "Aggiornamento costi/versione"
                    })
                else:
                    gap_items.append({
                        "id": b.id,
                        "name": b.name,
                        "type": b.type,
                        "layer": b.layer or "Other",
                        "category": "RETAINED",
                        "badge_color": "slate",
                        "architecture_horizon": "Persistent (Present in Both)",
                        "gap_action": "Retain",
                        "target_plateau": compare_model.name,
                        "annual_cost": b_cost,
                        "cost_impact": 0.0,
                        "work_packages": [],
                        "has_work_package": True,
                        "migration_rationale": "Elemento identico presente in entrambi i modelli"
                    })
            else:
                # Element in Base but missing in Target -> RETIRED
                total_savings += b_cost
                gap_items.append({
                    "id": b.id,
                    "name": b.name,
                    "type": b.type,
                    "layer": b.layer or "Other",
                    "category": "RETIRED",
                    "badge_color": "rose",
                    "architecture_horizon": "As-Is Only (Retired in Target)",
                    "gap_action": "Retire / Decommission",
                    "target_plateau": compare_model.name,
                    "annual_cost": b_cost,
                    "cost_impact": -b_cost,
                    "work_packages": [],
                    "has_work_package": False,
                    "migration_rationale": f"Elemento presente in '{base_model.name}' ma escluso da '{compare_model.name}'"
                })

        # Check Target elements not in Base -> ADDED
        for t in target_elements:
            if t.type in ["Plateau", "WorkPackage", "Deliverable", "Gap"]:
                continue
            key = (t.name.strip().lower() if t.name else "", t.type)
            if key not in matched_target_keys:
                t_cost = float(t.apm_attributes.annual_cost) if (t.apm_attributes and t.apm_attributes.annual_cost) else 0.0
                total_added_investments += t_cost
                gap_items.append({
                    "id": t.id,
                    "name": t.name,
                    "type": t.type,
                    "layer": t.layer or "Other",
                    "category": "ADDED",
                    "badge_color": "emerald",
                    "architecture_horizon": "To-Be Only (Added in Target)",
                    "gap_action": "Add / Introduce",
                    "target_plateau": compare_model.name,
                    "annual_cost": t_cost,
                    "cost_impact": t_cost,
                    "work_packages": [],
                    "has_work_package": False,
                    "migration_rationale": f"Nuovo elemento introdotto nella libreria target '{compare_model.name}'"
                })

        retained = [it for it in gap_items if it["category"] == "RETAINED"]
        added = [it for it in gap_items if it["category"] == "ADDED"]
        modified = [it for it in gap_items if it["category"] == "MODIFIED"]
        retired = [it for it in gap_items if it["category"] == "RETIRED"]

        net_delta = round(total_added_investments - total_savings, 2)

        return {
            "mode": "cross_model",
            "base_model": {
                "id": base_model.id,
                "name": base_model.name,
                "code": base_model.code or ""
            },
            "compare_model": {
                "id": compare_model.id,
                "name": compare_model.name,
                "code": compare_model.code or ""
            },
            "metrics": {
                "total_elements": len(gap_items),
                "retained_count": len(retained),
                "added_count": len(added),
                "modified_count": len(modified),
                "retired_count": len(retired),
                "total_savings": round(total_savings, 2),
                "total_added_investments": round(total_added_investments, 2),
                "net_financial_delta": net_delta,
                "gaps_missing_work_package": len(added) + len(modified) + len(retired),
                "available_plateaus_count": 0,
                "available_work_packages_count": 0
            },
            "plateaus": [],
            "work_packages": [],
            "items": sorted(gap_items, key=lambda x: (
                0 if x["category"] == "RETIRED" else (1 if x["category"] == "MODIFIED" else (2 if x["category"] == "ADDED" else 3)),
                x["layer"],
                x["name"]
            ))
        }
