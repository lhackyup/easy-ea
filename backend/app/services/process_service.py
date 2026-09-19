from typing import Dict, List, Any, Optional, Set
from sqlalchemy.orm import Session
from app.models.archimate import ArchimateElement, ArchimateRelationship

class ProcessService:
    @staticmethod
    def get_process_catalog(db: Session, model_id: str) -> Dict[str, Any]:
        """
        Retrieves all business processes with their related actors,
        supporting applications, and underlying infrastructure nodes.
        """
        processes = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == model_id,
            ArchimateElement.type.in_(["BusinessProcess", "BusinessFunction", "BusinessEvent"])
        ).all()

        relationships = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.model_id == model_id
        ).all()

        # Build element lookup
        all_elements = {e.id: e for e in db.query(ArchimateElement).filter(ArchimateElement.model_id == model_id).all()}

        # Adjacency
        outgoing: Dict[str, List[Dict[str, str]]] = {}
        incoming: Dict[str, List[Dict[str, str]]] = {}
        for r in relationships:
            outgoing.setdefault(r.source_id, []).append({"target": r.target_id, "type": r.type})
            incoming.setdefault(r.target_id, []).append({"source": r.source_id, "type": r.type})

        process_list = []

        for p in processes:
            # 1. Find Actors / Roles (Incoming or Outgoing Assignment)
            actors = []
            for inc in incoming.get(p.id, []):
                e = all_elements.get(inc["source"])
                if e and e.type in ["BusinessActor", "BusinessRole", "BusinessCollaboration"]:
                    actors.append({"id": e.id, "name": e.name, "type": e.type})
            for out in outgoing.get(p.id, []):
                e = all_elements.get(out["target"])
                if e and e.type in ["BusinessActor", "BusinessRole", "BusinessCollaboration"]:
                    actors.append({"id": e.id, "name": e.name, "type": e.type})

            # 2. Find Supporting Applications (Direct Serving/Realization or via ApplicationService)
            supporting_apps = []
            app_ids_found: Set[str] = set()

            for inc in incoming.get(p.id, []):
                s_elem = all_elements.get(inc["source"])
                if s_elem:
                    if s_elem.type == "ApplicationComponent" and s_elem.id not in app_ids_found:
                        app_ids_found.add(s_elem.id)
                        apm = s_elem.apm_attributes
                        supporting_apps.append({
                            "id": s_elem.id,
                            "name": s_elem.name,
                            "criticality": apm.business_criticality if apm else "Business Operational",
                            "cost": apm.annual_cost if apm else 0.0,
                            "time_quadrant": apm.time_quadrant if apm else "Tolerate"
                        })
                    elif s_elem.type in ["ApplicationService", "ApplicationFunction"]:
                        # Look for App Component providing this service/function
                        for sub_inc in incoming.get(s_elem.id, []):
                            sub_elem = all_elements.get(sub_inc["source"])
                            if sub_elem and sub_elem.type == "ApplicationComponent" and sub_elem.id not in app_ids_found:
                                app_ids_found.add(sub_elem.id)
                                apm = sub_elem.apm_attributes
                                supporting_apps.append({
                                    "id": sub_elem.id,
                                    "name": sub_elem.name,
                                    "criticality": apm.business_criticality if apm else "Business Operational",
                                    "cost": apm.annual_cost if apm else 0.0,
                                    "time_quadrant": apm.time_quadrant if apm else "Tolerate"
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

            process_list.append({
                "id": p.id,
                "name": p.name,
                "type": p.type,
                "documentation": p.documentation,
                "actors": actors,
                "supporting_applications": supporting_apps,
                "infrastructure_nodes": tech_nodes,
                "app_dependency_count": len(supporting_apps),
                "is_critical": any(a.get("criticality") == "Mission Critical" for a in supporting_apps)
            })

        return {
            "total_processes": len(processes),
            "processes": sorted(process_list, key=lambda x: (not x["is_critical"], -x["app_dependency_count"], x["name"]))
        }

    @staticmethod
    def simulate_impact(db: Session, model_id: str, element_id: str) -> Dict[str, Any]:
        """
        Calculates the ripple/downstream business impact if a specific
        element (e.g. Application Component or Technology Node) fails or is decommissioned.
        """
        all_elements = {e.id: e for e in db.query(ArchimateElement).filter(ArchimateElement.model_id == model_id).all()}
        relationships = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == model_id).all()

        if element_id not in all_elements:
            return {"error": "Element not found"}

        target_elem = all_elements[element_id]

        # BFS / Graph Traversal upwards to find impacted Business Processes & Capabilities
        # target -> outgoing targets (or incoming sources depending on relationship direction)
        impacted_elements: Set[str] = set()
        queue = [element_id]

        # Serving/Realization flows: Provider -> Consumer (e.g. Tech serves App, App serves Process)
        while queue:
            curr_id = queue.pop(0)
            for r in relationships:
                # If current element is source in Serving/Realization/Flow
                if r.source_id == curr_id and r.target_id not in impacted_elements:
                    impacted_elements.add(r.target_id)
                    queue.append(r.target_id)
                # Or if current element is realized by another
                elif r.target_id == curr_id and r.type in ["AssignmentRelationship", "CompositionRelationship"] and r.source_id not in impacted_elements:
                    impacted_elements.add(r.source_id)
                    queue.append(r.source_id)

        impacted_processes = []
        impacted_apps = []
        impacted_actors = []

        for imp_id in impacted_elements:
            e = all_elements.get(imp_id)
            if not e:
                continue
            if e.type in ["BusinessProcess", "BusinessFunction"]:
                impacted_processes.append({"id": e.id, "name": e.name, "type": e.type})
            elif e.type == "ApplicationComponent":
                apm = e.apm_attributes
                impacted_apps.append({
                    "id": e.id,
                    "name": e.name,
                    "criticality": apm.business_criticality if apm else "Business Operational"
                })
            elif e.type in ["BusinessActor", "BusinessRole"]:
                impacted_actors.append({"id": e.id, "name": e.name, "type": e.type})

        return {
            "source_element": {
                "id": target_elem.id,
                "name": target_elem.name,
                "type": target_elem.type,
                "layer": target_elem.layer
            },
            "impact_summary": {
                "total_impacted_processes": len(impacted_processes),
                "total_impacted_applications": len(impacted_apps),
                "total_impacted_stakeholders": len(impacted_actors)
            },
            "impacted_processes": impacted_processes,
            "impacted_applications": impacted_apps,
            "impacted_stakeholders": impacted_actors
        }
