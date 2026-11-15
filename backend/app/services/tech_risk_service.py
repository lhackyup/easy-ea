"""
Technology Obsolescence & Risk Radar Service for EasyEA APM.
Analyzes underlying Technology elements (SystemSoftware, Node, Device), calculates EOL/EOS status,
and propagates technology risk to Application Components via ArchiMate graph traversal.
"""

from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Optional, Set
from sqlalchemy.orm import Session, joinedload
from app.models.archimate import ArchimateElement, ArchimateRelationship, ModelWorkspace


def parse_date(val: Any) -> Optional[date]:
    """Safely parse a date from ISO string YYYY-MM-DD or date object."""
    if not val:
        return None
    if isinstance(val, (datetime, date)):
        return val if isinstance(val, date) else val.date()
    try:
        s = str(val).strip()[:10]
        return datetime.strptime(s, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def calculate_tech_status(props: Dict[str, Any], today: date) -> Dict[str, Any]:
    """
    Computes exact obsolescence status and risk score for a Technology element
    based on official EOL/EOS dates and declared status.
    """
    raw_status = props.get("tech_lifecycle_status") or props.get("lifecycle_status") or "Supported"
    raw_eol = props.get("tech_eol_date") or props.get("eol_date")
    raw_eoes = props.get("tech_eoes_date") or props.get("eoes_date")
    eol_date = parse_date(raw_eol)
    eoes_date = parse_date(raw_eoes)

    computed_status = raw_status
    if eol_date:
        if eol_date < today:
            if eoes_date and eoes_date >= today:
                computed_status = "Extended Support"
            else:
                computed_status = "End of Life / Obsolete"
        elif eol_date <= today + timedelta(days=180):
            if computed_status != "Extended Support":
                computed_status = "Approaching EOL"
        else:
            if computed_status not in ("Extended Support", "End of Life / Obsolete"):
                computed_status = "Supported"
    elif raw_status in ("End of Life / Obsolete", "Obsolete", "EOL", "Phase Out"):
        computed_status = "End of Life / Obsolete"
    elif raw_status in ("Extended Support", "Custom Support"):
        computed_status = "Extended Support"
    elif raw_status in ("Approaching EOL", "Sunset Approaching"):
        computed_status = "Approaching EOL"
    else:
        computed_status = "Supported"

    # Risk score: 4 = Critical, 3 = High, 2 = Medium, 1 = Low
    score_map = {
        "End of Life / Obsolete": 4,
        "Extended Support": 3,
        "Approaching EOL": 2,
        "Supported": 1
    }
    risk_level_map = {
        4: "Critical",
        3: "High",
        2: "Medium",
        1: "Low"
    }

    risk_score = score_map.get(computed_status, 1)
    risk_level = risk_level_map.get(risk_score, "Low")

    # CVE Severity adjustment
    cve_risk = props.get("tech_cve_risk") or "Low / Negligible"
    if "Critical" in str(cve_risk) and risk_score < 4:
        risk_score = 4
        risk_level = "Critical"
    elif "High" in str(cve_risk) and risk_score < 3:
        risk_score = 3
        risk_level = "High"

    days_to_eol = (eol_date - today).days if eol_date else None

    return {
        "computed_status": computed_status,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "eol_date": eol_date.isoformat() if eol_date else None,
        "eoes_date": eoes_date.isoformat() if eoes_date else None,
        "days_to_eol": days_to_eol,
        "cve_risk": cve_risk
    }


class TechRiskService:
    @staticmethod
    def analyze_tech_risk(db: Session, model_id: str) -> Dict[str, Any]:
        """
        Performs full Technology Obsolescence & Risk Analysis for all applications
        in a workspace. Traverses ArchiMate relationships between Technology and Application layers.
        """
        today = date.today()

        # 1. Fetch Applications (respecting in_apm_scope != False)
        all_apps = db.query(ArchimateElement).options(
            joinedload(ArchimateElement.apm_attributes),
            joinedload(ArchimateElement.stereotype)
        ).filter(
            ArchimateElement.model_id == model_id,
            ArchimateElement.type == "ApplicationComponent"
        ).all()

        apps = [
            a for a in all_apps
            if not (
                (a.apm_attributes and a.apm_attributes.in_apm_scope is False)
                or (isinstance(a.properties, dict) and str(a.properties.get("eea_in_apm_scope", "true")).lower() == "false")
                or (isinstance(a.properties, dict) and a.properties.get("is_internal_component") is True)
                or (a.stereotype_id is None and not a.apm_attributes and not (isinstance(a.properties, dict) and a.properties.get("apm_business_criticality")))
            )
        ]

        # 2. Fetch Technology elements (SystemSoftware, Node, Device, TechnologyService, Artifact)
        tech_elements = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == model_id,
            (ArchimateElement.layer == "Technology") |
            (ArchimateElement.type.in_(["SystemSoftware", "Node", "Device", "TechnologyService", "Artifact", "TechnologyInterface"]))
        ).all()

        tech_map: Dict[str, ArchimateElement] = {t.id: t for t in tech_elements}

        # 3. Fetch all Relationships in this model
        relationships = db.query(ArchimateRelationship).filter(
            ArchimateRelationship.model_id == model_id
        ).all()

        # Build graph adjacencies
        outgoing: Dict[str, List[Dict[str, str]]] = {}
        incoming: Dict[str, List[Dict[str, str]]] = {}
        for r in relationships:
            outgoing.setdefault(r.source_id, []).append({"target": r.target_id, "type": r.type})
            incoming.setdefault(r.target_id, []).append({"source": r.source_id, "type": r.type})

        # Precompute Technology element status and metadata
        tech_info_map: Dict[str, Dict[str, Any]] = {}
        for t in tech_elements:
            props = t.properties if isinstance(t.properties, dict) else {}
            st_calc = calculate_tech_status(props, today)

            vendor = props.get("tech_vendor") or props.get("vendor") or (
                "Oracle" if "oracle" in t.name.lower()
                else "IBM" if "ibm" in t.name.lower() or "mainframe" in t.name.lower() or "z15" in t.name.lower()
                else "Apache / Confluent" if "kafka" in t.name.lower() or "tomcat" in t.name.lower()
                else "Amazon Web Services" if "aws" in t.name.lower() or "aurora" in t.name.lower() or "eks" in t.name.lower()
                else "VMware" if "vmware" in t.name.lower() or "vsphere" in t.name.lower()
                else "Redis Ltd" if "redis" in t.name.lower()
                else "PostgreSQL Group" if "postgres" in t.name.lower()
                else "Commercial / OSS"
            )

            version = props.get("tech_version") or props.get("version") or (
                "10.2.0.5 R2" if "10g" in t.name.lower()
                else "z/OS 2.4" if "z15" in t.name.lower() or "mainframe" in t.name.lower()
                else "3.6 Enterprise" if "kafka" in t.name.lower()
                else "15.4 Aurora" if "aurora" in t.name.lower() or "postgres" in t.name.lower()
                else "1.28 Managed" if "eks" in t.name.lower()
                else "7.0 U3" if "vmware" in t.name.lower()
                else "7.2 Cluster" if "redis" in t.name.lower()
                else "Standard Release"
            )

            category = props.get("tech_category") or (
                "Database / RDBMS" if ("db" in t.name.lower() or "oracle" in t.name.lower() or "postgres" in t.name.lower() or "aurora" in t.name.lower() or "sql" in t.name.lower())
                else "Container & Kubernetes" if ("eks" in t.name.lower() or "k8s" in t.name.lower() or "docker" in t.name.lower())
                else "Middleware & Messaging" if ("kafka" in t.name.lower() or "mq" in t.name.lower() or "queue" in t.name.lower())
                else "Mainframe & Legacy OS" if ("mainframe" in t.name.lower() or "z15" in t.name.lower() or "as400" in t.name.lower())
                else "Virtualization & Cloud" if ("vmware" in t.name.lower() or "cloud" in t.name.lower() or "cluster" in t.name.lower())
                else "In-Memory Cache & NoSQL" if ("redis" in t.name.lower())
                else "Runtime & System Software"
            )

            tech_info_map[t.id] = {
                "id": t.id,
                "name": t.name,
                "type": t.type,
                "layer": t.layer,
                "vendor": vendor,
                "version": version,
                "category": category,
                "status": st_calc["computed_status"],
                "risk_score": st_calc["risk_score"],
                "risk_level": st_calc["risk_level"],
                "eol_date": st_calc["eol_date"],
                "eoes_date": st_calc["eoes_date"],
                "days_to_eol": st_calc["days_to_eol"],
                "cve_risk": st_calc["cve_risk"],
                "documentation": t.documentation or ""
            }

        # 4. Map Applications to Technologies via Semantic Traversal
        # Strict EA semantic rules:
        # A technology element serves/realizes an application:
        # Step 1: Direct link (Tech --[Serving/Realization/Assignment/Association]--> App)
        # Step 2: Indirect via Node/Container (SystemSoftware --[Composition/Assignment]--> Node --[Serving/Realization]--> App)
        # Step 3: Indirect via TechnologyService (Tech --[Realization]--> TechnologyService --[Serving]--> App)
        app_to_techs: Dict[str, Set[str]] = {a.id: set() for a in apps}
        tech_to_apps: Dict[str, Set[str]] = {t.id: set() for t in tech_elements}

        tech_rel_types = {
            "ServingRelationship", "RealizationRelationship", "AssignmentRelationship", "AssociationRelationship"
        }
        nesting_rel_types = {
            "CompositionRelationship", "AssignmentRelationship", "AggregationRelationship"
        }

        # Step 1: Direct links to Application
        for app in apps:
            for inc in incoming.get(app.id, []):
                src_id = inc["source"]
                if inc["type"] in tech_rel_types and src_id in tech_map:
                    app_to_techs[app.id].add(src_id)
                    tech_to_apps[src_id].add(app.id)

            # Some diagrams might have drawn App -> Serving/Association -> Tech
            for out in outgoing.get(app.id, []):
                tgt_id = out["target"]
                if out["type"] in tech_rel_types and tgt_id in tech_map:
                    app_to_techs[app.id].add(tgt_id)
                    tech_to_apps[tgt_id].add(app.id)

        # Step 2 & 3: Hierarchical / Nested Technology relationships
        # (e.g. Node hosts SystemSoftware, or TechnologyService realizes Tech)
        for app in apps:
            direct_tech_ids = list(app_to_techs[app.id])
            for direct_tid in direct_tech_ids:
                # Find software nested on this direct tech (incoming composition/assignment)
                for inc in incoming.get(direct_tid, []):
                    sub_id = inc["source"]
                    if inc["type"] in nesting_rel_types and sub_id in tech_map:
                        app_to_techs[app.id].add(sub_id)
                        tech_to_apps[sub_id].add(app.id)
                # Find host node on which this direct tech is nested (outgoing composition/assignment)
                for out in outgoing.get(direct_tid, []):
                    host_id = out["target"]
                    if out["type"] in nesting_rel_types and host_id in tech_map:
                        app_to_techs[app.id].add(host_id)
                        tech_to_apps[host_id].add(app.id)

        # 5. Calculate Technology Risk per Application
        app_analysis_list: List[Dict[str, Any]] = []

        risk_distribution = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Unassessed": 0}
        criticality_vs_risk_matrix: Dict[str, Dict[str, int]] = {
            "Mission Critical": {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Unassessed": 0},
            "Business Critical": {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Unassessed": 0},
            "Business Operational": {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Unassessed": 0},
            "Administrative": {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Unassessed": 0}
        }

        dora_compliance_alerts: List[Dict[str, Any]] = []

        criticality_weights = {
            "Mission Critical": 1.0,
            "Business Critical": 0.8,
            "Business Operational": 0.5,
            "Administrative": 0.2
        }

        for app in apps:
            apm = app.apm_attributes
            props = app.properties if isinstance(app.properties, dict) else {}

            crit = props.get("apm_business_criticality") or (apm.business_criticality if apm else "Business Operational")
            if crit not in criticality_vs_risk_matrix:
                crit = "Business Operational"

            annual_cost = float(props.get("apm_annual_cost") or (apm.annual_cost if apm else 0.0) or 0.0)
            time_q = props.get("apm_time_quadrant_override") or (apm.time_quadrant if apm else "Tolerate")
            b_owner = props.get("apm_business_owner") or (apm.business_owner if apm else "Non Assegnato")
            t_owner = props.get("apm_technical_owner") or (apm.technical_owner if apm else "Non Assegnato")

            linked_tech_ids = list(app_to_techs[app.id])
            linked_techs = [tech_info_map[tid] for tid in linked_tech_ids if tid in tech_info_map]

            if not linked_techs:
                app_risk_level = "Unassessed"
                max_risk_score = 0
                composite_risk_score = 0
                next_eol = None
                days_to_next_eol = None
                obsolete_count = 0
                approaching_eol_count = 0
                extended_count = 0
                supported_count = 0
            else:
                max_risk_score = max(t["risk_score"] for t in linked_techs)
                risk_level_reverse = {4: "Critical", 3: "High", 2: "Medium", 1: "Low"}
                app_risk_level = risk_level_reverse[max_risk_score]

                obsolete_count = sum(1 for t in linked_techs if t["status"] == "End of Life / Obsolete")
                approaching_eol_count = sum(1 for t in linked_techs if t["status"] == "Approaching EOL")
                extended_count = sum(1 for t in linked_techs if t["status"] == "Extended Support")
                supported_count = sum(1 for t in linked_techs if t["status"] == "Supported")

                # Upcoming EOL dates
                future_eols = [t["eol_date"] for t in linked_techs if t["eol_date"] and t["days_to_eol"] is not None and t["days_to_eol"] >= 0]
                if future_eols:
                    next_eol = min(future_eols)
                    days_to_next_eol = (datetime.strptime(next_eol, "%Y-%m-%d").date() - today).days
                else:
                    # If all are already expired or none have dates
                    past_eols = [t["eol_date"] for t in linked_techs if t["eol_date"]]
                    next_eol = min(past_eols) if past_eols else None
                    days_to_next_eol = (datetime.strptime(next_eol, "%Y-%m-%d").date() - today).days if next_eol else None

                # Composite score calculation (0 - 100)
                # Combines max risk score (25 pts per level) with business criticality weight
                base_risk_points = max_risk_score * 25 # 25, 50, 75, 100
                crit_weight = criticality_weights.get(crit, 0.5)
                # Extra penalty for multiple obsolete items
                penalty = min(20, obsolete_count * 5)
                composite_risk_score = min(100, int(base_risk_points * crit_weight + penalty))

            risk_distribution[app_risk_level] += 1
            criticality_vs_risk_matrix[crit][app_risk_level] += 1

            # Check DORA / Regulatory Compliance Alert
            is_dora_violation = (crit in ("Mission Critical", "Business Critical") and app_risk_level in ("Critical", "High"))
            if is_dora_violation:
                dora_compliance_alerts.append({
                    "application_id": app.id,
                    "application_name": app.name,
                    "business_criticality": crit,
                    "tech_risk_level": app_risk_level,
                    "annual_cost": annual_cost,
                    "business_owner": b_owner,
                    "technical_owner": t_owner,
                    "obsolete_components": [t["name"] for t in linked_techs if t["status"] == "End of Life / Obsolete"],
                    "reason": "Applicazione a criticità elevata ospitata su componenti tecnologici obsoleti / EOL privi di supporto di sicurezza vendor (violazione art. 7 DORA / NIS2)."
                })

            app_analysis_list.append({
                "id": app.id,
                "name": app.name,
                "documentation": app.documentation or "",
                "business_criticality": crit,
                "time_quadrant": time_q,
                "annual_cost": annual_cost,
                "business_owner": b_owner,
                "technical_owner": t_owner,
                "tech_risk_level": app_risk_level,
                "max_risk_score": max_risk_score,
                "composite_risk_score": composite_risk_score,
                "is_dora_violation": is_dora_violation,
                "next_eol_date": next_eol,
                "days_to_next_eol": days_to_next_eol,
                "counts": {
                    "total": len(linked_techs),
                    "obsolete": obsolete_count,
                    "approaching_eol": approaching_eol_count,
                    "extended_support": extended_count,
                    "supported": supported_count
                },
                "technologies": linked_techs
            })

        # Sort applications by composite risk score descending
        app_analysis_list.sort(key=lambda x: (x["composite_risk_score"], x["annual_cost"]), reverse=True)

        # 6. EOL Horizon Timeline Categorization
        already_expired = []
        expiring_6_months = []
        expiring_12_months = []
        expiring_24_months_plus = []
        supported_indefinitely = []

        for tid, tinfo in tech_info_map.items():
            st = tinfo["status"]
            days = tinfo["days_to_eol"]
            item_summary = {
                **tinfo,
                "impacted_applications_count": len(tech_to_apps.get(tid, set())),
                "impacted_applications": [
                    {"id": a_id, "name": next((a.name for a in apps if a.id == a_id), a_id)}
                    for a_id in tech_to_apps.get(tid, set())
                ]
            }

            if st == "End of Life / Obsolete" or (days is not None and days < 0):
                already_expired.append(item_summary)
            elif days is not None and days <= 180:
                expiring_6_months.append(item_summary)
            elif days is not None and days <= 365:
                expiring_12_months.append(item_summary)
            elif days is not None and days > 365:
                expiring_24_months_plus.append(item_summary)
            else:
                supported_indefinitely.append(item_summary)

        # Sort horizons by EOL date
        already_expired.sort(key=lambda x: x["eol_date"] or "")
        expiring_6_months.sort(key=lambda x: x["eol_date"] or "")
        expiring_12_months.sort(key=lambda x: x["eol_date"] or "")

        # 7. Technology Impact & Blast Radius Catalog
        tech_blast_radius = []
        for tid, tinfo in tech_info_map.items():
            impacted_app_ids = tech_to_apps.get(tid, set())
            impacted_app_objs = [a for a in apps if a.id in impacted_app_ids]
            total_impacted_cost = sum(
                float(a.properties.get("apm_annual_cost") or (a.apm_attributes.annual_cost if a.apm_attributes else 0.0) or 0.0)
                if isinstance(a.properties, dict) else (a.apm_attributes.annual_cost if a.apm_attributes else 0.0)
                for a in impacted_app_objs
            )

            crit_counts: Dict[str, int] = {}
            for a in impacted_app_objs:
                c = (a.properties.get("apm_business_criticality") if isinstance(a.properties, dict) else None) or (a.apm_attributes.business_criticality if a.apm_attributes else "Business Operational")
                crit_counts[c] = crit_counts.get(c, 0) + 1

            highest_crit = "Administrative"
            for test_c in ["Mission Critical", "Business Critical", "Business Operational", "Administrative"]:
                if crit_counts.get(test_c, 0) > 0:
                    highest_crit = test_c
                    break

            tech_blast_radius.append({
                **tinfo,
                "impacted_applications_count": len(impacted_app_objs),
                "total_impacted_annual_cost": total_impacted_cost,
                "highest_criticality": highest_crit,
                "impacted_applications": [
                    {
                        "id": a.id,
                        "name": a.name,
                        "business_criticality": (a.properties.get("apm_business_criticality") if isinstance(a.properties, dict) else None) or (a.apm_attributes.business_criticality if a.apm_attributes else "Business Operational"),
                        "annual_cost": float(a.properties.get("apm_annual_cost") if isinstance(a.properties, dict) else 0.0 or 0.0)
                    }
                    for a in impacted_app_objs
                ]
            })

        # Sort blast radius by number of impacted applications descending
        tech_blast_radius.sort(key=lambda x: (x["impacted_applications_count"], x["risk_score"]), reverse=True)

        total_apps_count = len(apps)
        assessed_apps_count = sum(1 for a in app_analysis_list if a["tech_risk_level"] != "Unassessed")
        obsolete_tech_count = sum(1 for t in tech_info_map.values() if t["status"] == "End of Life / Obsolete")

        return {
            "summary": {
                "total_applications": total_apps_count,
                "assessed_applications": assessed_apps_count,
                "unassessed_applications": total_apps_count - assessed_apps_count,
                "total_technologies": len(tech_elements),
                "obsolete_technologies_count": obsolete_tech_count,
                "approaching_eol_count": len(expiring_6_months) + len(expiring_12_months),
                "dora_compliance_alerts_count": len(dora_compliance_alerts),
                "risk_distribution": risk_distribution,
                "high_critical_risk_pct": round(
                    ((risk_distribution["Critical"] + risk_distribution["High"]) / max(1, assessed_apps_count)) * 100, 1
                )
            },
            "criticality_vs_risk_matrix": criticality_vs_risk_matrix,
            "dora_compliance_alerts": dora_compliance_alerts,
            "eol_timeline_horizon": {
                "already_expired": already_expired,
                "expiring_6_months": expiring_6_months,
                "expiring_12_months": expiring_12_months,
                "expiring_24_months_plus": expiring_24_months_plus,
                "supported_indefinitely": supported_indefinitely
            },
            "technology_blast_radius": tech_blast_radius,
            "applications": app_analysis_list
        }

    @staticmethod
    def update_technology_lifecycle(db: Session, element_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Updates technology lifecycle attributes (vendor, version, EOL, EOES, status, CVE risk)."""
        element = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
        if not element:
            raise ValueError(f"Technology element with id '{element_id}' not found.")

        props = dict(element.properties) if isinstance(element.properties, dict) else {}

        mapping = {
            "vendor": "tech_vendor",
            "tech_vendor": "tech_vendor",
            "version": "tech_version",
            "tech_version": "tech_version",
            "category": "tech_category",
            "tech_category": "tech_category",
            "status": "tech_lifecycle_status",
            "tech_lifecycle_status": "tech_lifecycle_status",
            "eol_date": "tech_eol_date",
            "tech_eol_date": "tech_eol_date",
            "eoes_date": "tech_eoes_date",
            "tech_eoes_date": "tech_eoes_date",
            "cve_risk": "tech_cve_risk",
            "tech_cve_risk": "tech_cve_risk"
        }

        for in_key, out_key in mapping.items():
            if in_key in updates:
                props[out_key] = updates[in_key]

        element.properties = props
        db.commit()
        db.refresh(element)

        today = date.today()
        st_calc = calculate_tech_status(props, today)
        return {
            "id": element.id,
            "name": element.name,
            "properties": element.properties,
            "status": st_calc["computed_status"],
            "risk_score": st_calc["risk_score"],
            "risk_level": st_calc["risk_level"]
        }
