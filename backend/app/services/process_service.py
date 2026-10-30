from typing import Dict, List, Any, Optional, Set
from sqlalchemy.orm import Session, joinedload
from app.models.archimate import ArchimateElement, ArchimateRelationship, ArchitectureDecisionRecord

class ProcessService:
    @staticmethod
    def get_process_catalog(db: Session, model_id: str) -> Dict[str, Any]:
        """
        Retrieves all business processes with their related actors,
        supporting applications, underlying infrastructure nodes,
        and embedded architectural risk/SPOF diagnostics.
        """
        processes = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == model_id,
            ArchimateElement.type.in_(["BusinessProcess", "BusinessFunction", "BusinessEvent"])
        ).all()

        relationships = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.model_id == model_id
        ).all()

        # Build element lookup with eager loaded APM attributes and stereotypes
        all_elements = {
            e.id: e for e in db.query(ArchimateElement).options(
                joinedload(ArchimateElement.apm_attributes),
                joinedload(ArchimateElement.stereotype)
            ).filter(ArchimateElement.model_id == model_id).all()
        }

        # Adjacency maps
        outgoing: Dict[str, List[Dict[str, str]]] = {}
        incoming: Dict[str, List[Dict[str, str]]] = {}
        for r in relationships:
            outgoing.setdefault(r.source_id, []).append({"target": r.target_id, "type": r.type})
            incoming.setdefault(r.target_id, []).append({"source": r.source_id, "type": r.type})

        # Identify child BPMN steps vs macro enterprise processes
        child_steps_by_parent: Dict[str, List[ArchimateElement]] = {}
        step_ids_with_parent: Set[str] = set()
        for p in processes:
            props = p.properties if isinstance(p.properties, dict) else {}
            parent_proc_id = props.get("parent_process_id")
            if props.get("is_bpmn_step") is True and parent_proc_id and parent_proc_id in all_elements and parent_proc_id != p.id:
                child_steps_by_parent.setdefault(parent_proc_id, []).append(p)
                step_ids_with_parent.add(p.id)
            else:
                for inc in incoming.get(p.id, []):
                    if "Composition" in (inc["type"] or ""):
                        parent_el = all_elements.get(inc["source"])
                        if parent_el and parent_el.type == "BusinessProcess" and parent_el.id != p.id and props.get("is_bpmn_step") is True:
                            child_steps_by_parent.setdefault(parent_el.id, []).append(p)
                            step_ids_with_parent.add(p.id)
                            break

        macro_processes = [p for p in processes if p.id not in step_ids_with_parent]
        process_list = []

        for p in macro_processes:
            scope_ids = [p.id] + [s.id for s in child_steps_by_parent.get(p.id, [])]

            # 1. Find Actors / Roles
            actors = []
            actor_ids_found: Set[str] = set()
            for sid in scope_ids:
                for inc in incoming.get(sid, []):
                    e = all_elements.get(inc["source"])
                    if e and e.type in ["BusinessActor", "BusinessRole", "BusinessCollaboration"] and e.id not in actor_ids_found:
                        actor_ids_found.add(e.id)
                        actors.append({"id": e.id, "name": e.name, "type": e.type})
                for out in outgoing.get(sid, []):
                    e = all_elements.get(out["target"])
                    if e and e.type in ["BusinessActor", "BusinessRole", "BusinessCollaboration"] and e.id not in actor_ids_found:
                        actor_ids_found.add(e.id)
                        actors.append({"id": e.id, "name": e.name, "type": e.type})

            # 2. Find Supporting Applications
            supporting_apps = []
            app_ids_found: Set[str] = set()

            for sid in scope_ids:
                for inc in incoming.get(sid, []):
                    s_elem = all_elements.get(inc["source"])
                    if s_elem:
                        if s_elem.type == "ApplicationComponent" and s_elem.id not in app_ids_found:
                            app_ids_found.add(s_elem.id)
                            apm = s_elem.apm_attributes
                            props = s_elem.properties if isinstance(s_elem.properties, dict) else {}
                            supporting_apps.append({
                                "id": s_elem.id,
                                "name": s_elem.name,
                                "criticality": apm.business_criticality if apm else "Business Operational",
                                "cost": apm.annual_cost if apm else 0.0,
                                "time_quadrant": apm.time_quadrant if apm else "Tolerate",
                                "lifecycle_status": props.get("eea_lifecycle_status", "Live")
                            })
                        elif s_elem.type in ["ApplicationService", "ApplicationFunction"]:
                            for sub_inc in incoming.get(s_elem.id, []):
                                sub_elem = all_elements.get(sub_inc["source"])
                                if sub_elem and sub_elem.type == "ApplicationComponent" and sub_elem.id not in app_ids_found:
                                    app_ids_found.add(sub_elem.id)
                                    apm = sub_elem.apm_attributes
                                    props = sub_elem.properties if isinstance(sub_elem.properties, dict) else {}
                                    supporting_apps.append({
                                        "id": sub_elem.id,
                                        "name": sub_elem.name,
                                        "criticality": apm.business_criticality if apm else "Business Operational",
                                        "cost": apm.annual_cost if apm else 0.0,
                                        "time_quadrant": apm.time_quadrant if apm else "Tolerate",
                                        "lifecycle_status": props.get("eea_lifecycle_status", "Live")
                                    })

            # 3. Find Infrastructure / Technology supporting these applications
            tech_nodes = []
            tech_ids_found: Set[str] = set()
            for app_id in app_ids_found:
                for inc in incoming.get(app_id, []):
                    t_elem = all_elements.get(inc["source"])
                    if t_elem and t_elem.layer == "Technology" and t_elem.id not in tech_ids_found:
                        tech_ids_found.add(t_elem.id)
                        tech_nodes.append({
                            "id": t_elem.id,
                            "name": t_elem.name,
                            "type": t_elem.type
                        })

            child_steps_serialized = [
                {
                    "id": s.id,
                    "name": s.name,
                    "type": s.type,
                    "bpmn_tag": (s.properties or {}).get("bpmn_tag", "task") if isinstance(s.properties, dict) else "task"
                }
                for s in child_steps_by_parent.get(p.id, [])
            ]

            is_proc_critical = any(a.get("criticality") == "Mission Critical" for a in supporting_apps)
            
            # Architectural Risk Checks for this process
            process_risks = []
            # Check 1: SPOF - only 1 app supporting a critical process
            if is_proc_critical and len(supporting_apps) == 1:
                process_risks.append({
                    "severity": "HIGH",
                    "type": "SPOF_APPLICATION",
                    "message": f"Single Point of Failure: Il processo critico dipende da un'unica applicazione ({supporting_apps[0]['name']}) senza alternativa architetturale."
                })
            # Check 2: Infrastructure SPOF - only 1 node supporting the applications
            if len(supporting_apps) >= 1 and len(tech_nodes) == 1:
                process_risks.append({
                    "severity": "MEDIUM",
                    "type": "SPOF_INFRASTRUCTURE",
                    "message": f"Single Point of Failure Infrastrutturale: Tutta l'erogazione applicativa converge su un singolo nodo tecnologico ({tech_nodes[0]['name']})."
                })
            # Check 3: Lifecycle Mismatch - using Eliminate or Phase-out app
            for a in supporting_apps:
                if a.get("time_quadrant") == "Eliminate" or a.get("lifecycle_status") in ["Phase-out", "Retired"]:
                    process_risks.append({
                        "severity": "HIGH",
                        "type": "LIFECYCLE_RISK",
                        "message": f"Rischio Ciclo di Vita: Il processo dipende dall'applicazione '{a['name']}' in stato TIME '{a.get('time_quadrant')}' / Lifecycle '{a.get('lifecycle_status')}'."
                    })
            # Check 4: SLA / Criticality Mismatch
            if is_proc_critical:
                for a in supporting_apps:
                    if a.get("criticality") == "Administrative":
                        process_risks.append({
                            "severity": "MEDIUM",
                            "type": "SLA_MISMATCH",
                            "message": f"Disallineamento SLA: Processo Mission Critical supportato da '{a['name']}' classificata con criticità 'Administrative'."
                        })

            # Check 5: Explicit RTO/RPO/SLA Package Mismatch
            p_props = p.properties if isinstance(p.properties, dict) else {}
            p_target_sla = p_props.get("target_sla_availability")
            p_target_rto = p_props.get("target_rto_hours")
            
            if p_target_sla is not None:
                try:
                    t_sla_val = float(p_target_sla)
                    for a in supporting_apps:
                        a_elem = all_elements.get(a["id"])
                        a_p = a_elem.properties if a_elem and isinstance(a_elem.properties, dict) else {}
                        a_sla = float(a_p.get("app_sla_availability") or 99.50)
                        if a_sla < t_sla_val:
                            process_risks.append({
                                "severity": "HIGH" if is_proc_critical else "MEDIUM",
                                "type": "SLA_AVAILABILITY_GAP",
                                "message": f"SLA Gap: Il processo richiede disponibilità {t_sla_val}%, ma l'applicazione '{a['name']}' offre solo {a_sla}%."
                            })
                            break
                except (ValueError, TypeError):
                    pass

            if p_target_rto is not None:
                try:
                    t_rto_val = float(p_target_rto)
                    for a in supporting_apps:
                        a_elem = all_elements.get(a["id"])
                        a_p = a_elem.properties if a_elem and isinstance(a_elem.properties, dict) else {}
                        a_rto = float(a_p.get("app_rto_hours") or 2.0)
                        if a_rto > t_rto_val:
                            process_risks.append({
                                "severity": "HIGH" if is_proc_critical else "MEDIUM",
                                "type": "RTO_BREACH_RISK",
                                "message": f"Rischio RTO: Il processo richiede ripristino entro {t_rto_val}h, ma l'applicazione '{a['name']}' ha RTO stimato di {a_rto}h."
                            })
                            break
                except (ValueError, TypeError):
                    pass

            process_list.append({
                "id": p.id,
                "name": p.name,
                "type": p.type,
                "documentation": p.documentation,
                "actors": actors,
                "supporting_applications": supporting_apps,
                "infrastructure_nodes": tech_nodes,
                "process_steps": child_steps_serialized,
                "steps_count": len(child_steps_serialized),
                "app_dependency_count": len(supporting_apps),
                "is_critical": is_proc_critical,
                "risks": process_risks,
                "has_spof": any("SPOF" in r["type"] for r in process_risks),
                "has_lifecycle_risk": any(r["type"] == "LIFECYCLE_RISK" for r in process_risks)
            })

        return {
            "total_processes": len(macro_processes),
            "processes": sorted(process_list, key=lambda x: (not x["is_critical"], -x["app_dependency_count"], x["name"]))
        }

    @staticmethod
    def simulate_impact(
        db: Session,
        model_id: str,
        element_id: str,
        mode: str = "failure",
        max_hops: int = 10
    ) -> Dict[str, Any]:
        """
        Executes a Semantic Multi-Hop Graph Traversal to calculate the Blast Radius
        when a specific element fails (failure mode) or is modified/decommissioned (change mode).
        Returns hop distances, shortest critical propagation paths, and layer-by-layer impact.
        """
        all_elements = {
            e.id: e for e in db.query(ArchimateElement).options(
                joinedload(ArchimateElement.apm_attributes),
                joinedload(ArchimateElement.stereotype)
            ).filter(ArchimateElement.model_id == model_id).all()
        }
        relationships = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == model_id).all()

        if element_id not in all_elements:
            return {"error": "Element not found"}

        source_elem = all_elements[element_id]

        # Build adjacency with relationship metadata
        # In failure mode: propagation follows operational dependency paths (Provider -> Consumer, Child -> Parent)
        # In change mode: also encompasses Access, Flow, Triggering, Aggregation and Associations
        outgoing_map: Dict[str, List[ArchimateRelationship]] = {}
        incoming_map: Dict[str, List[ArchimateRelationship]] = {}
        for r in relationships:
            outgoing_map.setdefault(r.source_id, []).append(r)
            incoming_map.setdefault(r.target_id, []).append(r)

        # BFS state: node_id -> {hop: int, path: list of {"id", "name", "type", "rel_type"}}
        visited: Dict[str, Dict[str, Any]] = {}
        visited[element_id] = {
            "hop": 0,
            "path": [{"id": source_elem.id, "name": source_elem.name, "type": source_elem.type, "rel": "START"}]
        }

        queue = [element_id]

        while queue:
            curr_id = queue.pop(0)
            curr_info = visited[curr_id]
            curr_hop = curr_info["hop"]

            if curr_hop >= max_hops:
                continue

            curr_elem = all_elements.get(curr_id)
            if not curr_elem:
                continue

            # Find next reachable neighbors based on ArchiMate semantics and mode
            neighbors: List[tuple[str, str]] = [] # (next_id, rel_type_name)

            if mode == "failure":
                # 1. Serving & Realization: Provider -> Consumer (source -> target)
                for r in outgoing_map.get(curr_id, []):
                    rel_type = r.type or ""
                    if any(t in rel_type for t in ["Serving", "Realization", "Flow", "Triggering"]):
                        neighbors.append((r.target_id, rel_type))
                    elif "Assignment" in rel_type:
                        # e.g. Node assigns SW -> if Node fails, SW fails (source -> target)
                        neighbors.append((r.target_id, rel_type))

                # 2. Composition: Child -> Parent (if critical part breaks, whole breaks)
                for r in incoming_map.get(curr_id, []):
                    rel_type = r.type or ""
                    if "Composition" in rel_type:
                        neighbors.append((r.source_id, rel_type))

                # 3. Realization target -> source (if abstract service is targeted by failure, implementations or callers)
                for r in incoming_map.get(curr_id, []):
                    rel_type = r.type or ""
                    if "Realization" in rel_type:
                        neighbors.append((r.source_id, rel_type))

            else:
                # Mode: "change" / "decommission" (Broader blast radius including data & bi-directional flows)
                for r in outgoing_map.get(curr_id, []):
                    rel_type = r.type or ""
                    neighbors.append((r.target_id, rel_type))

                for r in incoming_map.get(curr_id, []):
                    rel_type = r.type or ""
                    # Upstream consumers or dependent callers
                    if any(t in rel_type for t in ["Serving", "Access", "Flow", "Triggering", "Composition", "Aggregation"]):
                        neighbors.append((r.source_id, rel_type))

            for next_id, rel_type in neighbors:
                if next_id not in all_elements or next_id == element_id:
                    continue
                if next_id not in visited:
                    next_el = all_elements[next_id]
                    step_entry = {
                        "id": next_el.id,
                        "name": next_el.name,
                        "type": next_el.type,
                        "rel": rel_type
                    }
                    visited[next_id] = {
                        "hop": curr_hop + 1,
                        "path": curr_info["path"] + [step_entry]
                    }
                    queue.append(next_id)

        # Categorize impacted elements by architectural layer & entity type
        impacted_processes = []
        impacted_apps = []
        impacted_tech = []
        impacted_data = []
        impacted_stakeholders = []

        for imp_id, imp_meta in visited.items():
            if imp_id == element_id:
                continue
            e = all_elements.get(imp_id)
            if not e:
                continue

            entry = {
                "id": e.id,
                "name": e.name,
                "type": e.type,
                "layer": e.layer,
                "hop_distance": imp_meta["hop"],
                "path": imp_meta["path"]
            }

            if e.type in ["BusinessProcess", "BusinessFunction", "BusinessEvent"]:
                impacted_processes.append(entry)
            elif e.type in ["ApplicationComponent", "ApplicationService", "ApplicationInterface"]:
                apm = e.apm_attributes
                props = e.properties if isinstance(e.properties, dict) else {}
                entry["criticality"] = apm.business_criticality if apm else "Business Operational"
                entry["time_quadrant"] = apm.time_quadrant if apm else "Tolerate"
                entry["lifecycle_status"] = props.get("eea_lifecycle_status", "Live")
                impacted_apps.append(entry)
            elif e.layer == "Technology":
                impacted_tech.append(entry)
            elif e.type in ["DataObject", "Artifact"]:
                impacted_data.append(entry)
            elif e.type in ["BusinessActor", "BusinessRole", "BusinessCollaboration"]:
                impacted_stakeholders.append(entry)

        # Compute Blast Radius Score (weighted)
        crit_count = sum(1 for p in impacted_processes) * 10 + sum(1 for a in impacted_apps if a.get("criticality") == "Mission Critical") * 8 + len(impacted_apps) * 4 + len(impacted_tech) * 2
        severity = "HIGH" if (len(impacted_processes) > 0 or crit_count >= 20) else "MEDIUM" if crit_count >= 8 else "LOW"

        return {
            "source_element": {
                "id": source_elem.id,
                "name": source_elem.name,
                "type": source_elem.type,
                "layer": source_elem.layer
            },
            "simulation_mode": mode,
            "max_hops_configured": max_hops,
            "blast_radius": {
                "score": crit_count,
                "severity": severity,
                "max_hop_reached": max([v["hop"] for v in visited.values()], default=0),
                "total_impacted_elements": len(visited) - 1
            },
            "impact_summary": {
                "total_impacted_processes": len(impacted_processes),
                "total_impacted_applications": len(impacted_apps),
                "total_impacted_infrastructure": len(impacted_tech),
                "total_impacted_data_objects": len(impacted_data),
                "total_impacted_stakeholders": len(impacted_stakeholders)
            },
            "impacted_processes": sorted(impacted_processes, key=lambda x: (x["hop_distance"], x["name"])),
            "impacted_applications": sorted(impacted_apps, key=lambda x: (x["hop_distance"], x["name"])),
            "impacted_infrastructure": sorted(impacted_tech, key=lambda x: (x["hop_distance"], x["name"])),
            "impacted_data_objects": sorted(impacted_data, key=lambda x: (x["hop_distance"], x["name"])),
            "impacted_stakeholders": sorted(impacted_stakeholders, key=lambda x: (x["hop_distance"], x["name"]))
        }

    @staticmethod
    def detect_architectural_risks(db: Session, model_id: str) -> Dict[str, Any]:
        """
        Performs an enterprise architecture audit across the model to detect:
        1. Single Points of Failure (SPOFs) in applications and infrastructure.
        2. Lifecycle Risks (active critical processes depending on Eliminate/Phase-out apps).
        3. SLA & Criticality Mismatches.
        """
        catalog = ProcessService.get_process_catalog(db, model_id)
        all_elements = {
            e.id: e for e in db.query(ArchimateElement).options(
                joinedload(ArchimateElement.apm_attributes),
                joinedload(ArchimateElement.stereotype)
            ).filter(ArchimateElement.model_id == model_id).all()
        }
        all_relationships = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == model_id).all()

        spof_risks = []
        lifecycle_risks = []
        sla_risks = []

        # 1. App-level and Tech-level SPOF identification
        # Count how many critical processes rely on each application
        app_to_critical_processes: Dict[str, List[str]] = {}
        for p in catalog.get("processes", []):
            if p.get("is_critical"):
                for a in p.get("supporting_applications", []):
                    app_to_critical_processes.setdefault(a["id"], []).append(p["name"])

        for app_id, proc_names in app_to_critical_processes.items():
            if len(proc_names) >= 2:
                app_el = all_elements.get(app_id)
                app_name = app_el.name if app_el else app_id
                spof_risks.append({
                    "element_id": app_id,
                    "element_name": app_name,
                    "element_type": "ApplicationComponent",
                    "severity": "HIGH",
                    "type": "APPLICATION_BOTTLENECK_SPOF",
                    "message": f"L'applicazione '{app_name}' è un punto singolo di concentrazione critica per {len(proc_names)} processi mission-critical ({', '.join(proc_names[:3])})."
                })

        # Check Node-level SPOF
        node_to_apps: Dict[str, List[str]] = {}
        for r in all_relationships:
            if r.type in ["ServingRelationship", "AssignmentRelationship"]:
                src = all_elements.get(r.source_id)
                tgt = all_elements.get(r.target_id)
                if src and tgt and src.layer == "Technology" and tgt.type == "ApplicationComponent":
                    node_to_apps.setdefault(src.id, []).append(tgt.name)

        for node_id, apps in node_to_apps.items():
            if len(apps) >= 2:
                node_el = all_elements.get(node_id)
                node_name = node_el.name if node_el else node_id
                spof_risks.append({
                    "element_id": node_id,
                    "element_name": node_name,
                    "element_type": node_el.type if node_el else "Node",
                    "severity": "MEDIUM",
                    "type": "INFRASTRUCTURE_CONCENTRATION_SPOF",
                    "message": f"Il nodo infrastrutturale '{node_name}' ospita {len(apps)} applicazioni aziendali distinte ({', '.join(apps[:3])})."
                })

        # 2. Lifecycle & SLA Mismatches from catalog
        for p in catalog.get("processes", []):
            for r in p.get("risks", []):
                if r["type"] == "LIFECYCLE_RISK":
                    lifecycle_risks.append({
                        "process_id": p["id"],
                        "process_name": p["name"],
                        "message": r["message"],
                        "severity": r["severity"]
                    })
                elif r["type"] == "SLA_MISMATCH":
                    sla_risks.append({
                        "process_id": p["id"],
                        "process_name": p["name"],
                        "message": r["message"],
                        "severity": r["severity"]
                    })

        # 3. ADR Governance Drift & Retirement Mismatches
        adr_governance_risks = []
        model_adrs = db.query(ArchitectureDecisionRecord).filter(
            ArchitectureDecisionRecord.model_id == model_id
        ).all()
        for adr in model_adrs:
            for link in (adr.linked_elements or []):
                el = all_elements.get(link.element_id)
                if not el:
                    continue
                apm = el.apm_attributes
                lifecycle = apm.lifecycle_status if apm else "Live"
                quadrant = apm.time_quadrant if apm else "Tolerate"

                if adr.status in ("Deprecated", "Rejected", "Superseded") and link.impact_type in ("introduces", "governs", "modifies"):
                    if lifecycle not in ("Retired", "Phase-out"):
                        adr_governance_risks.append({
                            "adr_id": adr.id,
                            "adr_code": adr.code,
                            "adr_status": adr.status,
                            "element_id": el.id,
                            "element_name": el.name,
                            "type": "ADR_GOVERNANCE_DRIFT",
                            "severity": "MEDIUM",
                            "message": (
                                f"L'elemento attivo '{el.name}' è governato da {adr.code} ('{adr.title}') "
                                f"il cui stato è '{adr.status}'."
                            )
                        })
                elif adr.status == "Accepted" and link.impact_type == "retires":
                    if apm and quadrant in ("Invest", "Tolerate") and lifecycle == "Live":
                        adr_governance_risks.append({
                            "adr_id": adr.id,
                            "adr_code": adr.code,
                            "adr_status": adr.status,
                            "element_id": el.id,
                            "element_name": el.name,
                            "type": "ADR_RETIREMENT_MISMATCH",
                            "severity": "HIGH",
                            "message": (
                                f"La decisione approvata {adr.code} prevede il ritiro ('retires') di '{el.name}', "
                                f"ma nel catalogo APM risulta ancora '{lifecycle}' nel quadrante '{quadrant}'."
                            )
                        })

        total_issues = len(spof_risks) + len(lifecycle_risks) + len(sla_risks) + len(adr_governance_risks)
        risk_index = min(
            100,
            (len(spof_risks) * 20)
            + (len(lifecycle_risks) * 15)
            + (len(sla_risks) * 10)
            + (len(adr_governance_risks) * 10)
        )

        return {
            "model_id": model_id,
            "risk_index": risk_index,
            "risk_level": "CRITICAL" if risk_index >= 60 else "WARNING" if risk_index >= 25 else "HEALTHY",
            "summary": {
                "total_risks": total_issues,
                "spof_count": len(spof_risks),
                "lifecycle_risks_count": len(lifecycle_risks),
                "sla_risks_count": len(sla_risks),
                "adr_governance_risks_count": len(adr_governance_risks)
            },
            "spof_risks": spof_risks,
            "lifecycle_risks": lifecycle_risks,
            "sla_risks": sla_risks,
            "adr_governance_risks": adr_governance_risks
        }
