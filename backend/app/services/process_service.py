from typing import Dict, List, Any, Optional, Set
from sqlalchemy.orm import Session, joinedload
from app.models.archimate import ArchimateElement, ArchimateRelationship, ArchitectureDecisionRecord

class ProcessService:
    @staticmethod
    def get_process_catalog(db: Session, model_id: str, lang: str = "it") -> Dict[str, Any]:
        """
        Retrieves all business processes with their related actors,
        supporting applications, underlying infrastructure nodes,
        and embedded architectural risk/SPOF diagnostics.
        """
        is_en = lang.lower().startswith("en")
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
                    "message": (
                        f"Single Point of Failure: The critical process relies on a single application ({supporting_apps[0]['name']}) without architectural redundancy."
                        if is_en else
                        f"Single Point of Failure: Il processo critico dipende da un'unica applicazione ({supporting_apps[0]['name']}) senza alternativa architetturale."
                    )
                })
            # Check 2: Infrastructure SPOF - only 1 node supporting the applications
            if len(supporting_apps) >= 1 and len(tech_nodes) == 1:
                process_risks.append({
                    "severity": "MEDIUM",
                    "type": "SPOF_INFRASTRUCTURE",
                    "message": (
                        f"Infrastructure Single Point of Failure: All application delivery converges onto a single technology node ({tech_nodes[0]['name']})."
                        if is_en else
                        f"Single Point of Failure Infrastrutturale: Tutta l'erogazione applicativa converge su un singolo nodo tecnologico ({tech_nodes[0]['name']})."
                    )
                })
            # Check 3: Lifecycle Mismatch - using Eliminate or Phase-out app
            for a in supporting_apps:
                if a.get("time_quadrant") == "Eliminate" or a.get("lifecycle_status") in ["Phase-out", "Retired"]:
                    process_risks.append({
                        "severity": "HIGH",
                        "type": "LIFECYCLE_RISK",
                        "message": (
                            f"Lifecycle Risk: The process relies on application '{a['name']}' in TIME quadrant '{a.get('time_quadrant')}' / Lifecycle '{a.get('lifecycle_status')}'."
                            if is_en else
                            f"Rischio Ciclo di Vita: Il processo dipende dall'applicazione '{a['name']}' in stato TIME '{a.get('time_quadrant')}' / Lifecycle '{a.get('lifecycle_status')}'."
                        )
                    })
            # Check 4: SLA / Criticality Mismatch
            if is_proc_critical:
                for a in supporting_apps:
                    if a.get("criticality") == "Administrative":
                        process_risks.append({
                            "severity": "MEDIUM",
                            "type": "SLA_MISMATCH",
                            "message": (
                                f"SLA Mismatch: Mission Critical process supported by '{a['name']}' classified with 'Administrative' criticality."
                                if is_en else
                                f"Disallineamento SLA: Processo Mission Critical supportato da '{a['name']}' classificata con criticità 'Administrative'."
                            )
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
                                "message": (
                                    f"SLA Gap: The process requires {t_sla_val}% availability, but application '{a['name']}' provides only {a_sla}%."
                                    if is_en else
                                    f"SLA Gap: Il processo richiede disponibilità {t_sla_val}%, ma l'applicazione '{a['name']}' offre solo {a_sla}%."
                                )
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
                                "message": (
                                    f"RTO Risk: The process requires recovery within {t_rto_val}h, but application '{a['name']}' has an estimated RTO of {a_rto}h."
                                    if is_en else
                                    f"Rischio RTO: Il processo richiede ripristino entro {t_rto_val}h, ma l'applicazione '{a['name']}' ha RTO stimato di {a_rto}h."
                                )
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
    def detect_architectural_risks(db: Session, model_id: str, lang: str = "it") -> Dict[str, Any]:
        """
        Performs an enterprise architecture audit across the model to detect:
        1. Single Points of Failure (SPOFs) in applications and infrastructure.
        2. Lifecycle Risks (active critical processes depending on Eliminate/Phase-out apps).
        3. SLA & Criticality Mismatches.
        """
        is_en = lang.lower().startswith("en")
        catalog = ProcessService.get_process_catalog(db, model_id, lang=lang)
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
                    "message": (
                        f"The application '{app_name}' is a critical single point of concentration for {len(proc_names)} mission-critical processes ({', '.join(proc_names[:3])})."
                        if is_en else
                        f"L'applicazione '{app_name}' è un punto singolo di concentrazione critica per {len(proc_names)} processi mission-critical ({', '.join(proc_names[:3])})."
                    )
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
                    "message": (
                        f"The infrastructure node '{node_name}' hosts {len(apps)} distinct business applications ({', '.join(apps[:3])})."
                        if is_en else
                        f"Il nodo infrastrutturale '{node_name}' ospita {len(apps)} applicazioni aziendali distinte ({', '.join(apps[:3])})."
                    )
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
                                f"Active element '{el.name}' is governed by {adr.code} ('{adr.title}') whose status is '{adr.status}'."
                                if is_en else
                                f"L'elemento attivo '{el.name}' è governato da {adr.code} ('{adr.title}') il cui stato è '{adr.status}'."
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
                                f"Approved decision {adr.code} mandates the retirement ('retires') of '{el.name}', but APM catalog still lists it as '{lifecycle}' in quadrant '{quadrant}'."
                                if is_en else
                                f"La decisione approvata {adr.code} prevede il ritiro ('retires') di '{el.name}', ma nel catalogo APM risulta ancora '{lifecycle}' nel quadrante '{quadrant}'."
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

    @staticmethod
    def calculate_process_tco(db: Session, model_id: str, lang: str = "it") -> Dict[str, Any]:
        """
        Calculates IT Cost Allocation and TCO across business processes.
        Provides both gross supporting IT spend and fair shared/allocated cost,
        breakdowns by application, and economic efficiency/overspending diagnostics.
        """
        is_en = lang.lower().startswith("en")
        catalog = ProcessService.get_process_catalog(db, model_id, lang=lang)
        processes = catalog.get("processes", [])

        # Count in how many processes each application is used
        app_usage_count: Dict[str, int] = {}
        app_lookup: Dict[str, Dict[str, Any]] = {}
        for p in processes:
            for a in p.get("supporting_applications", []):
                app_id = a["id"]
                app_usage_count[app_id] = app_usage_count.get(app_id, 0) + 1
                if app_id not in app_lookup:
                    app_lookup[app_id] = a

        process_items = []
        total_allocated_cost = 0.0
        total_gross_cost = 0.0
        cost_by_criticality: Dict[str, float] = {
            "Mission Critical": 0.0,
            "Business Operational": 0.0,
            "Administrative": 0.0
        }

        for p in processes:
            p_apps = p.get("supporting_applications", [])
            gross_c = sum(float(a.get("cost") or 0.0) for a in p_apps)
            
            allocated_c = 0.0
            apps_detail = []
            for a in p_apps:
                a_cost = float(a.get("cost") or 0.0)
                usage_cnt = max(1, app_usage_count.get(a["id"], 1))
                fair_share = a_cost / usage_cnt
                allocated_c += fair_share
                apps_detail.append({
                    "id": a["id"],
                    "name": a["name"],
                    "annual_cost": a_cost,
                    "allocated_cost": round(fair_share, 2),
                    "shared_across_processes_count": usage_cnt,
                    "time_quadrant": a.get("time_quadrant", "Tolerate"),
                    "lifecycle_status": a.get("lifecycle_status", "Live"),
                    "criticality": a.get("criticality", "Business Operational")
                })

            total_allocated_cost += allocated_c
            total_gross_cost += gross_c

            p_crit = "Mission Critical" if p.get("is_critical") else "Business Operational"
            if not p.get("is_critical") and any(a.get("criticality") == "Administrative" for a in p_apps):
                p_crit = "Administrative"

            cost_by_criticality[p_crit] = cost_by_criticality.get(p_crit, 0.0) + allocated_c

            process_items.append({
                "id": p["id"],
                "name": p["name"],
                "type": p["type"],
                "criticality": p_crit,
                "is_critical": p.get("is_critical", False),
                "gross_cost": round(gross_c, 2),
                "allocated_cost": round(allocated_c, 2),
                "supporting_apps_count": len(p_apps),
                "supporting_applications": sorted(apps_detail, key=lambda x: -x["allocated_cost"]),
                "efficiency_warning": None
            })

        # Calculate percentages and efficiency warnings
        efficiency_warnings_count = 0
        avg_cost = (total_allocated_cost / len(process_items)) if process_items else 0.0

        for item in process_items:
            pct = (item["allocated_cost"] / total_allocated_cost * 100) if total_allocated_cost > 0 else 0.0
            item["cost_percentage"] = round(pct, 2)

            warnings = []
            if item["criticality"] == "Administrative" and item["allocated_cost"] > 100000:
                warnings.append(
                    "Over-spending: Low-criticality process with high IT cost consumption (> €100k)"
                    if is_en else
                    "Over-spending: Processo a bassa criticità con elevato assorbimento di costi IT (> 100k€)"
                )
            
            eliminate_cost = sum(a["allocated_cost"] for a in item["supporting_applications"] if a["time_quadrant"] == "Eliminate")
            if eliminate_cost > 0:
                warnings.append(
                    f"Legacy Spend at Risk: €{round(eliminate_cost, 0)} allocated to applications in 'Eliminate' quadrant"
                    if is_en else
                    f"Spesa Legacy a Rischio: {round(eliminate_cost, 0)}€ allocati ad applicazioni in quadrante 'Eliminate'"
                )

            if warnings:
                item["efficiency_warning"] = " | ".join(warnings)
                efficiency_warnings_count += 1

        # Sort processes by allocated cost desc
        process_items.sort(key=lambda x: -x["allocated_cost"])

        top_process = None
        if process_items and process_items[0]["allocated_cost"] > 0:
            top_process = {
                "id": process_items[0]["id"],
                "name": process_items[0]["name"],
                "allocated_cost": process_items[0]["allocated_cost"],
                "cost_percentage": process_items[0]["cost_percentage"]
            }

        return {
            "model_id": model_id,
            "summary": {
                "total_allocated_cost": round(total_allocated_cost, 2),
                "total_gross_cost": round(total_gross_cost, 2),
                "top_spend_process": top_process,
                "average_process_cost": round(avg_cost, 2),
                "processes_with_cost_count": sum(1 for p in process_items if p["allocated_cost"] > 0),
                "total_processes_count": len(process_items),
                "efficiency_warnings_count": efficiency_warnings_count,
                "cost_by_criticality": {k: round(v, 2) for k, v in cost_by_criticality.items()}
            },
            "processes": process_items
        }

    @staticmethod
    def calculate_process_automation(db: Session, model_id: str, lang: str = "it") -> Dict[str, Any]:
        """
        Calculates Business Process Digital Maturity and BPMN 2.0 Automation Level.
        Evaluates task distribution (UserTask, ServiceTask, ScriptTask, ManualTask,
        BusinessRuleTask, AIAgentTask), Straight-Through Processing (STP) rate,
        and prioritizes high-ROI candidates for RPA & AI automation.
        """
        catalog = ProcessService.get_process_catalog(db, model_id, lang=lang)
        processes = catalog.get("processes", [])

        # Load elements lookup with stereotype eagerly loaded
        all_elements = {
            e.id: e for e in db.query(ArchimateElement).options(
                joinedload(ArchimateElement.stereotype)
            ).filter(ArchimateElement.model_id == model_id).all()
        }

        total_tasks_evaluated = 0
        global_automated_tasks = 0
        global_ai_tasks = 0
        global_user_tasks = 0
        global_manual_tasks = 0

        process_results = []

        for p in processes:
            p_steps = p.get("process_steps", [])
            has_steps = len(p_steps) > 0

            # If no composed BPMN steps exist, evaluate based on supporting applications
            if not has_steps:
                has_apps = len(p.get("supporting_applications", [])) > 0
                total_t = 1
                aut_t = 1 if (has_apps and not p.get("actors")) else 0
                ai_t = 0
                user_t = 1 if (has_apps and p.get("actors")) else 0
                man_t = 1 if (not has_apps) else 0
                steps_serialized = [
                    {
                        "id": p["id"],
                        "name": p["name"],
                        "bpmn_tag": "task",
                        "stereotype_label": "«ServiceTask»" if aut_t else "«UserTask»" if user_t else "«ManualTask»",
                        "category": "AUTOMATED" if aut_t else "SEMI_AUTOMATED" if user_t else "MANUAL",
                        "cycle_time_minutes": 15.0,
                        "monthly_volume": 1000
                    }
                ]
            else:
                total_t = len(p_steps)
                aut_t = 0
                ai_t = 0
                user_t = 0
                man_t = 0
                steps_serialized = []

                for s in p_steps:
                    s_elem = all_elements.get(s["id"])
                    st = s_elem.stereotype if s_elem else None
                    st_name = (st.name if st else "").lower()
                    st_label = st.label if st else ""
                    props = s_elem.properties if s_elem and isinstance(s_elem.properties, dict) else {}
                    tag = (s.get("bpmn_tag") or props.get("bpmn_tag") or "task").lower()
                    auto_level = props.get("bpmn_automation_level", "")
                    cycle_time = float(props.get("bpmn_cycle_time_minutes") or 15.0)
                    volume = int(props.get("bpmn_execution_volume_month") or 1000)

                    # Categorize step
                    if "ai" in st_name or "ai" in tag or auto_level == "AI-Assisted":
                        ai_t += 1
                        cat = "AI_ASSISTED"
                        lbl = st_label or "«AIAgentTask»"
                    elif "service" in st_name or "service" in tag or "script" in st_name or "script" in tag or "rule" in st_name or "rule" in tag or auto_level == "Full Automated":
                        aut_t += 1
                        cat = "AUTOMATED"
                        lbl = st_label or ("«ScriptTask»" if "script" in st_name or "script" in tag else "«BusinessRuleTask»" if "rule" in st_name or "rule" in tag else "«ServiceTask»")
                    elif "manual" in st_name or "manual" in tag or auto_level == "Manual":
                        man_t += 1
                        cat = "MANUAL"
                        lbl = st_label or "«ManualTask»"
                    else:
                        # UserTask / semi-automated default
                        user_t += 1
                        cat = "SEMI_AUTOMATED"
                        lbl = st_label or "«UserTask»"

                    steps_serialized.append({
                        "id": s["id"],
                        "name": s["name"],
                        "bpmn_tag": tag,
                        "stereotype_label": lbl,
                        "category": cat,
                        "cycle_time_minutes": cycle_time,
                        "monthly_volume": volume
                    })

            total_tasks_evaluated += total_t
            global_automated_tasks += aut_t
            global_ai_tasks += ai_t
            global_user_tasks += user_t
            global_manual_tasks += man_t

            # Straight-through automation rate (%)
            auto_rate = round(((aut_t + ai_t) / total_t * 100), 1) if total_t > 0 else 0.0
            # Weighted digital maturity score (%)
            dig_maturity = round(((aut_t * 1.0 + ai_t * 1.0 + user_t * 0.5) / total_t * 100), 1) if total_t > 0 else 0.0

            is_stp = (aut_t + ai_t == total_t) and total_t > 0
            tier = "Fully Automated (STP)" if is_stp else "High Automation" if auto_rate >= 70 else "Medium (Human-in-the-Loop)" if auto_rate >= 30 else "Low (Manual Dominant)"
            is_rpa_candidate = (man_t + user_t >= 2) or (man_t >= 1 and p.get("is_critical")) or (auto_rate < 50 and len(p.get("supporting_applications", [])) >= 1)

            # Potential handoff bottlenecks
            handoff_count = 0
            for i in range(len(steps_serialized) - 1):
                c_now = steps_serialized[i]["category"]
                c_next = steps_serialized[i + 1]["category"]
                if (c_now == "AUTOMATED" and c_next in ("MANUAL", "SEMI_AUTOMATED")) or (c_now in ("MANUAL", "SEMI_AUTOMATED") and c_next == "AUTOMATED"):
                    handoff_count += 1

            process_results.append({
                "id": p["id"],
                "name": p["name"],
                "type": p["type"],
                "is_critical": p.get("is_critical", False),
                "total_tasks": total_t,
                "automated_tasks": aut_t,
                "ai_tasks": ai_t,
                "user_tasks": user_t,
                "manual_tasks": man_t,
                "automation_rate_pct": auto_rate,
                "digital_maturity_score": dig_maturity,
                "maturity_tier": tier,
                "is_stp": is_stp,
                "is_rpa_candidate": is_rpa_candidate,
                "handoff_bottlenecks_count": handoff_count,
                "supporting_apps_count": len(p.get("supporting_applications", [])),
                "steps": steps_serialized
            })

        # Global aggregate metrics
        global_rate = round(((global_automated_tasks + global_ai_tasks) / total_tasks_evaluated * 100), 1) if total_tasks_evaluated > 0 else 0.0
        global_maturity = round(((global_automated_tasks * 1.0 + global_ai_tasks * 1.0 + global_user_tasks * 0.5) / total_tasks_evaluated * 100), 1) if total_tasks_evaluated > 0 else 0.0
        stp_count = sum(1 for p in process_results if p["is_stp"])
        rpa_candidates = [p for p in process_results if p["is_rpa_candidate"]]

        # Sort processes by automation rate ascending for optimization prioritization
        rpa_candidates_sorted = sorted(rpa_candidates, key=lambda x: (not x["is_critical"], x["automation_rate_pct"], -x["user_tasks"] - x["manual_tasks"]))

        return {
            "model_id": model_id,
            "summary": {
                "global_automation_rate": global_rate,
                "global_digital_maturity": global_maturity,
                "total_tasks_evaluated": total_tasks_evaluated,
                "stp_processes_count": stp_count,
                "rpa_ai_candidates_count": len(rpa_candidates),
                "manual_dominant_processes_count": sum(1 for p in process_results if p["maturity_tier"] == "Low (Manual Dominant)"),
                "task_distribution": {
                    "automated": global_automated_tasks,
                    "ai_assisted": global_ai_tasks,
                    "user_tasks": global_user_tasks,
                    "manual": global_manual_tasks
                }
            },
            "top_rpa_candidates": rpa_candidates_sorted[:5],
            "processes": sorted(process_results, key=lambda x: (x["automation_rate_pct"], -x["total_tasks"]))
        }
