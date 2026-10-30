from typing import Dict, List, Any, Optional, Set, Tuple
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.archimate import (
    ModelWorkspace,
    ArchimateElement,
    ArchimateRelationship,
    WorkspaceAttributePackage
)


class ResilienceService:
    @staticmethod
    def analyze_resilience_mismatches(db: Session, model_id: str) -> Dict[str, Any]:
        """
        Analyzes RTO, RPO, and SLA Availability alignment across Business,
        Application, and Technology layers according to DORA / ISO 22301 principles.
        Detects bottlenecks and operational resilience violations.
        """
        model = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
        if not model:
            raise HTTPException(status_code=404, detail="Model workspace not found")

        # 1. Fetch all elements and relationships
        all_elements = {
            e.id: e for e in db.query(ArchimateElement).options(
                joinedload(ArchimateElement.apm_attributes),
                joinedload(ArchimateElement.stereotype)
            ).filter(ArchimateElement.model_id == model_id).all()
        }
        relationships = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == model_id).all()

        incoming_map: Dict[str, List[ArchimateRelationship]] = {}
        outgoing_map: Dict[str, List[ArchimateRelationship]] = {}
        for r in relationships:
            incoming_map.setdefault(r.target_id, []).append(r)
            outgoing_map.setdefault(r.source_id, []).append(r)

        # 2. Identify Macro Business Processes and Services
        business_targets: List[ArchimateElement] = []
        for e in all_elements.values():
            if e.type in ["BusinessProcess", "BusinessService", "Product"]:
                props = e.properties if isinstance(e.properties, dict) else {}
                # Exclude micro BPMN child steps to focus on macro capabilities
                if props.get("is_bpmn_step") is True and props.get("bpmn_parent_process_id"):
                    continue
                business_targets.append(e)

        # 3. Analyze each business process
        items: List[Dict[str, Any]] = []
        total_critical = 0
        total_mismatched = 0
        total_compliant = 0
        worst_sla_gap = 0.0
        worst_rto_gap = 0.0
        worst_rpo_gap = 0.0

        for b_elem in business_targets:
            b_props = b_elem.properties if isinstance(b_elem.properties, dict) else {}
            b_apm = b_elem.apm_attributes

            # Infer Business Targets
            is_dora = bool(b_props.get("dora_critical_function", False))
            crit_tier = b_props.get("resilience_criticality")
            if not crit_tier:
                if b_apm and b_apm.business_criticality == "Mission Critical":
                    crit_tier = "Tier-1 (Mission Critical)"
                elif b_apm and b_apm.business_criticality == "Business Critical":
                    crit_tier = "Tier-2 (Business Critical)"
                else:
                    crit_tier = "Tier-2 (Business Critical)"

            if "Tier-1" in crit_tier or is_dora:
                total_critical += 1

            # Defaults based on Tier
            default_sla = 99.99 if "Tier-1" in crit_tier else (99.90 if "Tier-2" in crit_tier else 99.50)
            default_rto = 1.0 if "Tier-1" in crit_tier else (4.0 if "Tier-2" in crit_tier else 12.0)
            default_rpo = 0.25 if "Tier-1" in crit_tier else (1.0 if "Tier-2" in crit_tier else 4.0)

            try:
                target_sla = float(b_props.get("target_sla_availability") or default_sla)
            except (ValueError, TypeError):
                target_sla = default_sla

            try:
                target_rto = float(b_props.get("target_rto_hours") or default_rto)
            except (ValueError, TypeError):
                target_rto = default_rto

            try:
                target_rpo = float(b_props.get("target_rpo_hours") or default_rpo)
            except (ValueError, TypeError):
                target_rpo = default_rpo

            # 4. Find Supporting Application Components
            # Trace incoming and outgoing semantic links (Serving, Realization, Composition, Flow, Association)
            supporting_apps: List[Dict[str, Any]] = []
            visited_app_ids: Set[str] = set()

            # Inspect incoming to process
            candidate_links = incoming_map.get(b_elem.id, []) + outgoing_map.get(b_elem.id, [])
            for rel in candidate_links:
                other_id = rel.source_id if rel.target_id == b_elem.id else rel.target_id
                other_elem = all_elements.get(other_id)
                if other_elem and other_elem.type in ["ApplicationComponent", "ApplicationService"] and other_elem.id not in visited_app_ids:
                    visited_app_ids.add(other_elem.id)
                    app_p = other_elem.properties if isinstance(other_elem.properties, dict) else {}
                    
                    app_sla = float(app_p.get("app_sla_availability") or 99.50)
                    app_rto = float(app_p.get("app_rto_hours") or 2.0)
                    app_rpo = float(app_p.get("app_rpo_hours") or 1.0)
                    dr_strat = app_p.get("dr_strategy") or "Active-Passive Automated"

                    supporting_apps.append({
                        "id": other_elem.id,
                        "name": other_elem.name,
                        "type": other_elem.type,
                        "sla": app_sla,
                        "rto_hours": app_rto,
                        "rpo_hours": app_rpo,
                        "dr_strategy": dr_strat
                    })

            # 5. Find Supporting Infrastructure & Tech Nodes for each Application
            supporting_tech: List[Dict[str, Any]] = []
            visited_tech_ids: Set[str] = set()

            for app_info in supporting_apps:
                app_links = incoming_map.get(app_info["id"], []) + outgoing_map.get(app_info["id"], [])
                for rel in app_links:
                    tech_id = rel.source_id if rel.target_id == app_info["id"] else rel.target_id
                    tech_elem = all_elements.get(tech_id)
                    if tech_elem and tech_elem.type in ["Node", "Device", "SystemSoftware", "TechnologyService", "Artifact"]:
                        if tech_elem.id not in visited_tech_ids:
                            visited_tech_ids.add(tech_elem.id)
                            t_p = tech_elem.properties if isinstance(tech_elem.properties, dict) else {}
                            
                            infra_sla = float(t_p.get("infra_sla_availability") or 99.90)
                            infra_rto = float(t_p.get("infra_rto_hours") or 1.0)
                            infra_rpo = float(t_p.get("infra_rpo_hours") or 1.0)
                            ha_mode = t_p.get("ha_redundancy") or "Multi-AZ Redundant"

                            supporting_tech.append({
                                "id": tech_elem.id,
                                "name": tech_elem.name,
                                "type": tech_elem.type,
                                "sla": infra_sla,
                                "rto_hours": infra_rto,
                                "rpo_hours": infra_rpo,
                                "ha_redundancy": ha_mode,
                                "serves_app": app_info["name"]
                            })

            # 6. Calculate Effective Chain Capabilities
            app_slas = [a["sla"] for a in supporting_apps] if supporting_apps else [99.50]
            infra_slas = [t["sla"] for t in supporting_tech] if supporting_tech else [99.90]
            effective_sla = min(min(app_slas), min(infra_slas))

            max_app_rto = max([a["rto_hours"] for a in supporting_apps], default=2.0)
            max_infra_rto = max([t["rto_hours"] for t in supporting_tech], default=1.0)
            effective_rto = max_app_rto + max_infra_rto

            max_app_rpo = max([a["rpo_hours"] for a in supporting_apps], default=1.0)
            max_infra_rpo = max([t["rpo_hours"] for t in supporting_tech], default=1.0)
            effective_rpo = max(max_app_rpo, max_infra_rpo)

            # 7. Check Gaps & Violations
            sla_gap = round(target_sla - effective_sla, 4)
            rto_gap = round(effective_rto - target_rto, 2)
            rpo_gap = round(effective_rpo - target_rpo, 2)

            has_sla_mismatch = (effective_sla < target_sla)
            has_rto_breach = (effective_rto > target_rto)
            has_rpo_breach = (effective_rpo > target_rpo)
            is_mismatched = has_sla_mismatch or has_rto_breach or has_rpo_breach

            if is_mismatched:
                total_mismatched += 1
                if sla_gap > worst_sla_gap:
                    worst_sla_gap = sla_gap
                if rto_gap > worst_rto_gap:
                    worst_rto_gap = rto_gap
                if rpo_gap > worst_rpo_gap:
                    worst_rpo_gap = rpo_gap
            else:
                total_compliant += 1

            # 8. Identify Weakest Link / Bottleneck
            bottleneck = None
            if has_sla_mismatch:
                # Find element with lowest SLA
                all_chain = supporting_apps + supporting_tech
                if all_chain:
                    lowest = min(all_chain, key=lambda x: x["sla"])
                    bottleneck = {
                        "id": lowest["id"],
                        "name": lowest["name"],
                        "type": lowest["type"],
                        "issue": f"Lowest SLA ({lowest['sla']}%) vs Target ({target_sla}%)"
                    }
            elif has_rto_breach:
                # Find element with highest RTO
                all_chain = supporting_apps + supporting_tech
                if all_chain:
                    highest_rto = max(all_chain, key=lambda x: x["rto_hours"])
                    bottleneck = {
                        "id": highest_rto["id"],
                        "name": highest_rto["name"],
                        "type": highest_rto["type"],
                        "issue": f"Longest RTO ({highest_rto['rto_hours']}h) contributing to {effective_rto}h chain total"
                    }
            elif has_rpo_breach:
                all_chain = supporting_apps + supporting_tech
                if all_chain:
                    highest_rpo = max(all_chain, key=lambda x: x["rpo_hours"])
                    bottleneck = {
                        "id": highest_rpo["id"],
                        "name": highest_rpo["name"],
                        "type": highest_rpo["type"],
                        "issue": f"Worst RPO ({highest_rpo['rpo_hours']}h) vs Target ({target_rpo}h)"
                    }

            # 9. Determine Status Severity
            if is_mismatched:
                if "Tier-1" in crit_tier or is_dora:
                    status = "CRITICAL_MISMATCH"
                    badge_color = "rose"
                elif "Tier-2" in crit_tier:
                    status = "HIGH_MISMATCH"
                    badge_color = "amber"
                else:
                    status = "MEDIUM_MISMATCH"
                    badge_color = "orange"
            else:
                status = "COMPLIANT"
                badge_color = "emerald"

            items.append({
                "process_id": b_elem.id,
                "process_name": b_elem.name,
                "process_type": b_elem.type,
                "criticality_tier": crit_tier,
                "dora_critical_function": is_dora,
                "target_sla": target_sla,
                "effective_sla": round(effective_sla, 4),
                "sla_gap": max(0.0, sla_gap),
                "has_sla_mismatch": has_sla_mismatch,
                "target_rto_hours": target_rto,
                "effective_rto_hours": round(effective_rto, 2),
                "rto_gap_hours": max(0.0, rto_gap),
                "has_rto_breach": has_rto_breach,
                "target_rpo_hours": target_rpo,
                "effective_rpo_hours": round(effective_rpo, 2),
                "rpo_gap_hours": max(0.0, rpo_gap),
                "has_rpo_breach": has_rpo_breach,
                "status": status,
                "badge_color": badge_color,
                "bottleneck": bottleneck,
                "supporting_apps_count": len(supporting_apps),
                "supporting_apps": supporting_apps,
                "supporting_tech_count": len(supporting_tech),
                "supporting_tech": supporting_tech
            })

        # Calculate Compliance Rate
        total_p = len(business_targets)
        compliance_rate = round((total_compliant / total_p * 100), 1) if total_p > 0 else 100.0

        # Sort items: Critical first, then biggest SLA gap, then name
        sorted_items = sorted(
            items,
            key=lambda x: (
                0 if x["status"] == "CRITICAL_MISMATCH" else (1 if x["status"] == "HIGH_MISMATCH" else (2 if x["status"] == "MEDIUM_MISMATCH" else 3)),
                -x["sla_gap"],
                -x["rto_gap_hours"],
                x["process_name"]
            )
        )

        return {
            "model_id": model_id,
            "model_name": model.name,
            "metrics": {
                "total_processes": total_p,
                "total_critical_processes": total_critical,
                "compliant_processes": total_compliant,
                "mismatched_processes": total_mismatched,
                "compliance_rate": compliance_rate,
                "worst_sla_gap": worst_sla_gap,
                "worst_rto_gap": worst_rto_gap,
                "worst_rpo_gap": worst_rpo_gap
            },
            "mismatches": sorted_items
        }
