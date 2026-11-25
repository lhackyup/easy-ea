import uuid
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.archimate import ArchimateElement, ApplicationBusinessAttributes, User, ModelWorkspace
from app.models.surveys import ApplicationOwnership, SurveyCampaign, SurveyScope, SurveyResponse
from app.services.rbac_service import is_user_app_owner

logger = logging.getLogger(__name__)

def utc_now():
    return datetime.now(timezone.utc)


class SurveyService:

    @staticmethod
    def assign_application_owner(
        db: Session,
        element_id: str,
        user_id: str,
        ownership_type: str = "app_owner",
        notes: Optional[str] = None
    ) -> ApplicationOwnership:
        """Assign an application or business process to a user with a specific ownership type."""
        # Check if assignment already exists
        existing = db.query(ApplicationOwnership).filter(
            ApplicationOwnership.element_id == element_id,
            ApplicationOwnership.user_id == user_id
        ).first()

        if existing:
            existing.ownership_type = ownership_type
            if notes is not None:
                existing.notes = notes
            db.commit()
            db.refresh(existing)
            target_record = existing
        else:
            ownership = ApplicationOwnership(
                id=f"own-{uuid.uuid4().hex[:12]}",
                element_id=element_id,
                user_id=user_id,
                ownership_type=ownership_type,
                notes=notes
            )
            db.add(ownership)
            target_record = ownership

        # Synchronize text field on ApplicationBusinessAttributes / ArchimateElement properties
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            owner_repr = user.email or user.full_name or user.username
            apm = db.query(ApplicationBusinessAttributes).filter(
                ApplicationBusinessAttributes.element_id == element_id
            ).first()
            if apm:
                if ownership_type in ("business_owner", "process_owner") and not apm.business_owner:
                    apm.business_owner = owner_repr
                elif ownership_type in ("technical_owner", "process_manager") and not apm.technical_owner:
                    apm.technical_owner = owner_repr

            el = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
            if el and el.type == "BusinessProcess":
                props = dict(el.properties or {})
                if ownership_type in ("process_owner", "business_owner"):
                    props["process_owner"] = user.full_name or user.email or user.username
                    props["processOwner"] = user.full_name or user.email or user.username
                elif ownership_type in ("process_manager", "technical_owner"):
                    props["process_manager"] = user.full_name or user.email or user.username
                    props["processManager"] = user.full_name or user.email or user.username
                el.properties = props

        db.commit()
        db.refresh(target_record)
        return target_record

    @staticmethod
    def remove_application_owner(db: Session, element_id: str, user_id: str) -> bool:
        """Removes an ownership relation from an application or business process."""
        ownership = db.query(ApplicationOwnership).filter(
            ApplicationOwnership.element_id == element_id,
            ApplicationOwnership.user_id == user_id
        ).first()
        if not ownership:
            return False
        db.delete(ownership)
        db.commit()

        # Clean up synced properties on BusinessProcess if no other owner of that type remains
        el = db.query(ArchimateElement).filter(ArchimateElement.id == element_id).first()
        if el and el.type == "BusinessProcess":
            rem = db.query(ApplicationOwnership).filter(
                ApplicationOwnership.element_id == element_id
            ).all()
            props = dict(el.properties or {})
            if not any(o.ownership_type in ("process_owner", "business_owner") for o in rem):
                props.pop("process_owner", None)
                props.pop("processOwner", None)
            if not any(o.ownership_type in ("process_manager", "technical_owner") for o in rem):
                props.pop("process_manager", None)
                props.pop("processManager", None)
            el.properties = props
            db.commit()

        return True

    @staticmethod
    def get_application_owners(db: Session, element_id: str) -> List[Dict[str, Any]]:
        """Returns all owners assigned to an application."""
        records = db.query(ApplicationOwnership).filter(
            ApplicationOwnership.element_id == element_id
        ).all()
        result = []
        for r in records:
            u = r.user
            result.append({
                "id": r.id,
                "user_id": r.user_id,
                "email": u.email if u else None,
                "full_name": u.full_name if u else None,
                "username": u.username if u else None,
                "ownership_type": r.ownership_type,
                "notes": r.notes,
                "created_at": r.created_at.isoformat() if r.created_at else None
            })
        return result

    @staticmethod
    def get_ownership_matrix(db: Session, model_id: str) -> Dict[str, Any]:
        """
        Returns all applications and business processes for a model workspace along with their assigned owners,
        orphan status, and overall ownership coverage metrics.
        """
        # 1. Applications
        apps = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == model_id,
            ArchimateElement.type == "ApplicationComponent"
        ).order_by(ArchimateElement.name.asc()).all()

        # 2. Business Processes (excluding child BPMN steps)
        all_procs = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == model_id,
            ArchimateElement.type == "BusinessProcess"
        ).order_by(ArchimateElement.name.asc()).all()
        procs = [p for p in all_procs if not (isinstance(p.properties, dict) and p.properties.get("is_bpmn_step") is True)]

        all_elem_ids = [a.id for a in apps] + [p.id for p in procs]
        ownerships = db.query(ApplicationOwnership).filter(
            ApplicationOwnership.element_id.in_(all_elem_ids)
        ).all() if all_elem_ids else []

        ownership_map: Dict[str, List[Dict[str, Any]]] = {}
        for o in ownerships:
            u = o.user
            if o.element_id not in ownership_map:
                ownership_map[o.element_id] = []
            ownership_map[o.element_id].append({
                "id": o.id,
                "user_id": o.user_id,
                "username": u.username if u else None,
                "full_name": u.full_name if u else None,
                "email": u.email if u else None,
                "ownership_type": o.ownership_type,
                "notes": o.notes,
                "created_at": o.created_at.isoformat() if o.created_at else None
            })

        app_list = []
        assigned_apps_count = 0
        for app in apps:
            owners = ownership_map.get(app.id, [])
            props = app.properties if isinstance(app.properties, dict) else {}
            apm = app.apm_attributes
            b_owner_prop = (apm.business_owner if apm else None) or props.get("business_owner") or props.get("businessOwner")
            t_owner_prop = (apm.technical_owner if apm else None) or props.get("technical_owner") or props.get("technicalOwner")

            has_owner = len(owners) > 0 or bool(b_owner_prop) or bool(t_owner_prop)
            if has_owner:
                assigned_apps_count += 1

            app_list.append({
                "id": app.id,
                "name": app.name,
                "type": app.type,
                "layer": app.layer or "Application",
                "category": "application",
                "owners": owners,
                "has_owner": has_owner,
                "legacy_business_owner": b_owner_prop,
                "legacy_technical_owner": t_owner_prop,
            })

        proc_list = []
        assigned_procs_count = 0
        for p in procs:
            owners = ownership_map.get(p.id, [])
            props = p.properties if isinstance(p.properties, dict) else {}
            p_owner_prop = props.get("process_owner") or props.get("processOwner") or props.get("owner")
            p_mgr_prop = props.get("process_manager") or props.get("processManager") or props.get("technical_owner")
            b_owner_prop = props.get("business_owner") or props.get("businessOwner")

            has_owner = len(owners) > 0 or bool(p_owner_prop) or bool(p_mgr_prop) or bool(b_owner_prop)
            if has_owner:
                assigned_procs_count += 1

            proc_list.append({
                "id": p.id,
                "name": p.name,
                "type": p.type,
                "layer": p.layer or "Business",
                "category": "process",
                "owners": owners,
                "has_owner": has_owner,
                "legacy_business_owner": b_owner_prop or p_owner_prop,
                "legacy_technical_owner": p_mgr_prop,
                "legacy_process_owner": p_owner_prop,
                "legacy_process_manager": p_mgr_prop,
            })

        total_apps = len(apps)
        unassigned_apps = total_apps - assigned_apps_count
        coverage_apps = round((assigned_apps_count / total_apps * 100), 1) if total_apps > 0 else 0.0

        total_procs = len(procs)
        unassigned_procs = total_procs - assigned_procs_count
        coverage_procs = round((assigned_procs_count / total_procs * 100), 1) if total_procs > 0 else 0.0

        total_elements = total_apps + total_procs
        total_assigned = assigned_apps_count + assigned_procs_count
        total_unassigned = unassigned_apps + unassigned_procs
        overall_coverage = round((total_assigned / total_elements * 100), 1) if total_elements > 0 else 0.0

        return {
            "total_applications": total_apps,
            "assigned_applications": assigned_apps_count,
            "unassigned_applications": unassigned_apps,
            "coverage_applications": coverage_apps,

            "total_processes": total_procs,
            "assigned_processes": assigned_procs_count,
            "unassigned_processes": unassigned_procs,
            "coverage_processes": coverage_procs,

            "total_elements": total_elements,
            "assigned_count": total_assigned,
            "unassigned_count": total_unassigned,
            "coverage_percentage": overall_coverage,

            "applications": app_list,
            "processes": proc_list,
            "elements": app_list + proc_list
        }

    @staticmethod
    def get_user_owned_applications(
        db: Session,
        user: User,
        model_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves all applications owned by the user across ApplicationOwnership table
        and matching email/username in business_owner / technical_owner fields.
        """
        # 1. Applications from explicit ApplicationOwnership
        explicit_app_ids = [
            r.element_id for r in db.query(ApplicationOwnership.element_id).filter(
                ApplicationOwnership.user_id == user.id
            ).all()
        ]

        # 2. Query elements
        query = db.query(ArchimateElement).filter(
            ArchimateElement.type == "ApplicationComponent"
        )
        if model_id:
            query = query.filter(ArchimateElement.model_id == model_id)

        all_apps = query.all()
        user_apps = []

        user_identifiers = {
            ident.strip().lower() for ident in [user.email, user.username, user.full_name]
            if ident and ident.strip()
        }

        for app in all_apps:
            apm = app.apm_attributes
            is_owner = app.id in explicit_app_ids

            if not is_owner and apm:
                biz_owner = (apm.business_owner or "").strip().lower()
                tech_owner = (apm.technical_owner or "").strip().lower()
                if (biz_owner and biz_owner in user_identifiers) or (tech_owner and tech_owner in user_identifiers):
                    is_owner = True

            if is_owner:
                # Calculate completeness
                fields_to_check = [
                    apm.business_fit if apm else None,
                    apm.technical_fit if apm else None,
                    apm.time_quadrant if apm else None,
                    apm.hosting_type if apm else None,
                    apm.lifecycle_status if apm else None,
                    apm.sla_level if apm else None,
                    apm.data_classification if apm else None,
                    apm.vendor if apm else None
                ]
                filled = sum(1 for f in fields_to_check if f is not None and str(f).strip() != "")
                completeness = round((filled / max(len(fields_to_check), 1)) * 100)

                # Check for active pending surveys assigned to this specific user
                pending_surveys = db.query(SurveyScope).join(SurveyCampaign).filter(
                    SurveyScope.element_id == app.id,
                    SurveyScope.status.in_(["pending", "in_progress", "rejected"]),
                    SurveyCampaign.status == "active",
                    or_(
                        SurveyScope.assigned_user_id == user.id,
                        SurveyScope.assigned_email.ilike(user.email or "----")
                    )
                ).count()

                ownership_rec = db.query(ApplicationOwnership).filter(
                    ApplicationOwnership.element_id == app.id,
                    ApplicationOwnership.user_id == user.id
                ).first()
                ownership_type = ownership_rec.ownership_type if ownership_rec else (
                    "business_owner" if (apm and (apm.business_owner or "").strip().lower() in user_identifiers) else "technical_owner"
                )

                user_apps.append({
                    "id": app.id,
                    "name": app.name,
                    "model_id": app.model_id,
                    "ownership_type": ownership_type,
                    "business_fit": apm.business_fit if apm else 3,
                    "technical_fit": apm.technical_fit if apm else 3,
                    "time_quadrant": apm.time_quadrant if apm else "Tolerate",
                    "lifecycle_status": apm.lifecycle_status if apm else "Live",
                    "hosting_type": apm.hosting_type if apm else "Cloud",
                    "annual_cost": apm.annual_cost if apm else 0.0,
                    "sla_level": apm.sla_level if apm else "Silver (99.0%)",
                    "vendor": apm.vendor if apm else None,
                    "completeness": completeness,
                    "pending_surveys_count": pending_surveys
                })

        return user_apps

    @staticmethod
    def get_user_owned_processes(
        db: Session,
        user: User,
        model_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves all business processes owned by the user across ApplicationOwnership table
        and matching email/username in process_owner / process_manager fields.
        """
        # 1. Processes from explicit ApplicationOwnership
        explicit_proc_ids = [
            r.element_id for r in db.query(ApplicationOwnership.element_id).filter(
                ApplicationOwnership.user_id == user.id
            ).all()
        ]

        # 2. Query business processes
        query = db.query(ArchimateElement).filter(
            ArchimateElement.type == "BusinessProcess"
        )
        if model_id:
            query = query.filter(ArchimateElement.model_id == model_id)

        all_procs = query.all()
        # Exclude internal bpmn steps
        all_procs = [p for p in all_procs if not (isinstance(p.properties, dict) and p.properties.get("is_bpmn_step") is True)]

        user_procs = []
        user_identifiers = {
            ident.strip().lower() for ident in [user.email, user.username, user.full_name]
            if ident and ident.strip()
        }

        for p in all_procs:
            props = p.properties if isinstance(p.properties, dict) else {}
            is_owner = p.id in explicit_proc_ids

            if not is_owner:
                proc_owner = (props.get("process_owner") or props.get("processOwner") or "").strip().lower()
                proc_mgr = (props.get("process_manager") or props.get("processManager") or "").strip().lower()
                if (proc_owner and proc_owner in user_identifiers) or (proc_mgr and proc_mgr in user_identifiers):
                    is_owner = True

            if is_owner:
                # Calculate process completeness
                fields_to_check = [
                    p.documentation,
                    props.get("process_criticality"),
                    props.get("bpmn_automation_level"),
                    props.get("bpmn_cycle_time_minutes"),
                    props.get("bpmn_execution_volume_month"),
                    props.get("sla_target"),
                    props.get("regulatory_compliance")
                ]
                filled = sum(1 for f in fields_to_check if f is not None and str(f).strip() != "")
                completeness = round((filled / max(len(fields_to_check), 1)) * 100)

                pending_surveys = db.query(SurveyScope).join(SurveyCampaign).filter(
                    SurveyScope.element_id == p.id,
                    SurveyScope.status.in_(["pending", "in_progress", "rejected"]),
                    SurveyCampaign.status == "active",
                    or_(
                        SurveyScope.assigned_user_id == user.id,
                        SurveyScope.assigned_email.ilike(user.email or "----")
                    )
                ).count()

                ownership_rec = db.query(ApplicationOwnership).filter(
                    ApplicationOwnership.element_id == p.id,
                    ApplicationOwnership.user_id == user.id
                ).first()
                ownership_type = ownership_rec.ownership_type if ownership_rec else (
                    "process_owner" if (props.get("process_owner") or "").strip().lower() in user_identifiers else "process_manager"
                )

                user_procs.append({
                    "id": p.id,
                    "name": p.name,
                    "model_id": p.model_id,
                    "type": p.type,
                    "layer": p.layer or "Business",
                    "ownership_type": ownership_type,
                    "documentation": p.documentation or "",
                    "process_criticality": props.get("process_criticality") or "Business Critical",
                    "bpmn_automation_level": props.get("bpmn_automation_level") or "Semi-Automated",
                    "bpmn_cycle_time_minutes": float(props.get("bpmn_cycle_time_minutes", 15.0)),
                    "bpmn_execution_volume_month": int(props.get("bpmn_execution_volume_month", 1000)),
                    "bpmn_error_rework_rate_pct": float(props.get("bpmn_error_rework_rate_pct", 2.0)),
                    "sla_target": props.get("sla_target") or "< 4 ore",
                    "regulatory_compliance": props.get("regulatory_compliance") or "DORA Critical Function",
                    "completeness": completeness,
                    "pending_surveys_count": pending_surveys
                })

        return user_procs

    @staticmethod
    def create_campaign(
        db: Session,
        model_id: str,
        title: str,
        description: Optional[str],
        created_by: User,
        mode: str = "approval_required",
        target_owner_type: str = "all",
        deadline: Optional[datetime] = None,
        sections: Optional[List[str]] = None,
        custom_questions: Optional[List[Dict[str, Any]]] = None,
        target_element_ids: Optional[List[str]] = None
    ) -> SurveyCampaign:
        """Create a new survey campaign and dispatch scopes to application or process owners."""
        if not sections:
            if target_owner_type == "process_owner":
                sections = ["process_general", "process_performance", "process_automation", "process_governance"]
            else:
                sections = ["general", "fit", "costs", "lifecycle", "hosting"]

        campaign = SurveyCampaign(
            id=f"cmp-{uuid.uuid4().hex[:12]}",
            model_id=model_id,
            title=title,
            description=description,
            status="active",
            mode=mode,
            target_owner_type=target_owner_type,
            deadline=deadline,
            sections_json=sections,
            custom_questions=custom_questions or [],
            created_by_id=created_by.id,
            created_at=utc_now()
        )
        db.add(campaign)
        db.flush()

        # Target query
        query = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == model_id
        )
        if target_owner_type == "process_owner":
            query = query.filter(ArchimateElement.type == "BusinessProcess")
        elif target_owner_type in ("app_owner", "technical_owner", "business_owner"):
            query = query.filter(ArchimateElement.type == "ApplicationComponent")
        else: # "all"
            query = query.filter(ArchimateElement.type.in_(["ApplicationComponent", "BusinessProcess"]))

        if target_element_ids and len(target_element_ids) > 0:
            query = query.filter(ArchimateElement.id.in_(target_element_ids))

        raw_elements = query.all()
        # Filter out bpmn child steps
        elements = [e for e in raw_elements if not (e.type == "BusinessProcess" and isinstance(e.properties, dict) and e.properties.get("is_bpmn_step") is True)]

        for el in elements:
            # Resolve assigned user(s) based on target_owner_type
            ownerships_query = db.query(ApplicationOwnership).filter(
                ApplicationOwnership.element_id == el.id
            )
            if target_owner_type == "process_owner":
                ownerships_query = ownerships_query.filter(
                    ApplicationOwnership.ownership_type.in_(["process_owner", "process_manager"])
                )
            elif target_owner_type in ("app_owner", "technical_owner", "business_owner"):
                ownerships_query = ownerships_query.filter(
                    ApplicationOwnership.ownership_type == target_owner_type
                )
            
            matching_ownerships = ownerships_query.all()

            if matching_ownerships:
                # Dispatch scope for each matching registered owner
                for own in matching_ownerships:
                    scope = SurveyScope(
                        id=f"scp-{uuid.uuid4().hex[:12]}",
                        campaign_id=campaign.id,
                        element_id=el.id,
                        assigned_user_id=own.user_id,
                        assigned_email=own.user.email if own.user else None,
                        status="pending"
                    )
                    db.add(scope)
            else:
                # Fallback to textual fields
                assigned_user_id = None
                assigned_email = None

                owner_email_cand = None
                if el.type == "BusinessProcess" and el.properties:
                    props = el.properties if isinstance(el.properties, dict) else {}
                    owner_email_cand = props.get("process_owner") or props.get("processOwner") or props.get("process_manager")
                elif el.apm_attributes:
                    if target_owner_type in ("app_owner", "technical_owner"):
                        owner_email_cand = el.apm_attributes.business_owner
                    elif target_owner_type == "technical_owner":
                        owner_email_cand = el.apm_attributes.technical_owner
                    else:
                        owner_email_cand = el.apm_attributes.business_owner or el.apm_attributes.technical_owner

                if owner_email_cand:
                    assigned_email = owner_email_cand.strip()
                    matched_user = db.query(User).filter(
                        or_(
                            User.email.ilike(assigned_email),
                            User.username.ilike(assigned_email),
                            User.full_name.ilike(assigned_email)
                        )
                    ).first()
                    if matched_user:
                        assigned_user_id = matched_user.id

                scope = SurveyScope(
                    id=f"scp-{uuid.uuid4().hex[:12]}",
                    campaign_id=campaign.id,
                    element_id=el.id,
                    assigned_user_id=assigned_user_id,
                    assigned_email=assigned_email,
                    status="pending"
                )
                db.add(scope)

        db.commit()
        db.refresh(campaign)
        return campaign

    @staticmethod
    def list_campaigns(db: Session, model_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List campaigns with completion metrics."""
        query = db.query(SurveyCampaign)
        if model_id:
            query = query.filter(SurveyCampaign.model_id == model_id)

        campaigns = query.order_by(SurveyCampaign.created_at.desc()).all()
        result = []

        for c in campaigns:
            total_scopes = len(c.scopes)
            submitted = sum(1 for s in c.scopes if s.status == "submitted")
            approved = sum(1 for s in c.scopes if s.status == "approved")
            pending = sum(1 for s in c.scopes if s.status in ("pending", "in_progress"))
            rejected = sum(1 for s in c.scopes if s.status == "rejected")

            completion_rate = round(((submitted + approved) / max(total_scopes, 1)) * 100)

            result.append({
                "id": c.id,
                "model_id": c.model_id,
                "title": c.title,
                "description": c.description,
                "status": c.status,
                "mode": c.mode,
                "target_owner_type": getattr(c, "target_owner_type", "all"),
                "deadline": c.deadline.isoformat() if c.deadline else None,
                "sections": c.sections_json or [],
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "created_by": c.created_by.full_name if c.created_by else None,
                "metrics": {
                    "total": total_scopes,
                    "pending": pending,
                    "submitted": submitted,
                    "approved": approved,
                    "rejected": rejected,
                    "completion_rate": completion_rate
                }
            })
        return result

    @staticmethod
    def get_campaign_detail(db: Session, campaign_id: str) -> Optional[Dict[str, Any]]:
        """Detailed view of a campaign including all assigned scopes."""
        c = db.query(SurveyCampaign).filter(SurveyCampaign.id == campaign_id).first()
        if not c:
            return None

        scopes_data = []
        for s in c.scopes:
            el = s.element
            u = s.assigned_user
            apm = el.apm_attributes if el else None
            scopes_data.append({
                "scope_id": s.id,
                "element_id": s.element_id,
                "application_name": el.name if el else "Unknown Application",
                "assigned_user_id": s.assigned_user_id,
                "assigned_name": u.full_name if u else (s.assigned_email or "Non assegnato"),
                "assigned_email": u.email if u else s.assigned_email,
                "status": s.status,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
                "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
                "review_feedback": s.review_feedback,
                "has_response": s.response is not None,
                "diff_summary": s.response.diff_summary_json if s.response else {}
            })

        total = len(c.scopes)
        submitted = sum(1 for s in c.scopes if s.status == "submitted")
        approved = sum(1 for s in c.scopes if s.status == "approved")

        return {
            "id": c.id,
            "model_id": c.model_id,
            "title": c.title,
            "description": c.description,
            "status": c.status,
            "mode": c.mode,
            "target_owner_type": getattr(c, "target_owner_type", "all"),
            "deadline": c.deadline.isoformat() if c.deadline else None,
            "sections": c.sections_json or [],
            "custom_questions": c.custom_questions or [],
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "created_by": c.created_by.full_name if c.created_by else None,
            "completion_rate": round(((submitted + approved) / max(total, 1)) * 100),
            "scopes": scopes_data
        }

    @staticmethod
    def get_user_surveys(db: Session, user: User, model_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Lists all survey tasks assigned to the current user."""
        # Find scopes assigned directly to user_id or to user's email
        query = db.query(SurveyScope).join(SurveyCampaign).filter(
            SurveyCampaign.status.in_(["active", "closed"]),
            or_(
                SurveyScope.assigned_user_id == user.id,
                SurveyScope.assigned_email.ilike(user.email or "----")
            )
        )
        if model_id:
            query = query.filter(SurveyCampaign.model_id == model_id)

        scopes = query.order_by(SurveyScope.status.asc(), SurveyCampaign.deadline.asc()).all()
        result = []

        for s in scopes:
            el = s.element
            c = s.campaign
            apm = el.apm_attributes if el else None
            result.append({
                "scope_id": s.id,
                "campaign_id": c.id,
                "campaign_title": c.title,
                "campaign_mode": c.mode,
                "deadline": c.deadline.isoformat() if c.deadline else None,
                "element_id": s.element_id,
                "application_name": el.name if el else "App",
                "status": s.status,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
                "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
                "review_feedback": s.review_feedback,
                "sections": c.sections_json or []
            })

        return result

    @staticmethod
    def get_survey_scope_details(db: Session, scope_id: str, user: User) -> Optional[Dict[str, Any]]:
        """
        Retrieves survey form details for an application scope, snapshotting current
        values if not already initialized.
        """
        scope = db.query(SurveyScope).filter(SurveyScope.id == scope_id).first()
        if not scope:
            return None

        el = scope.element
        if not el:
            return None

        apm = el.apm_attributes
        c = scope.campaign

        is_process = el.type == "BusinessProcess"
        if is_process:
            props = el.properties if isinstance(el.properties, dict) else {}
            current_values = {
                "name": el.name,
                "documentation": el.documentation or "",
                "process_criticality": props.get("process_criticality") or "Business Critical",
                "bpmn_automation_level": props.get("bpmn_automation_level") or "Semi-Automated",
                "bpmn_cycle_time_minutes": float(props.get("bpmn_cycle_time_minutes", 15.0)),
                "bpmn_execution_volume_month": int(props.get("bpmn_execution_volume_month", 1000)),
                "bpmn_error_rework_rate_pct": float(props.get("bpmn_error_rework_rate_pct", 2.0)),
                "sla_target": props.get("sla_target") or "< 4 ore",
                "regulatory_compliance": props.get("regulatory_compliance") or "DORA Critical Function",
                "process_owner": props.get("process_owner") or "",
                "notes": props.get("notes") or ""
            }
            default_sections = ["process_general", "process_performance", "process_automation", "process_governance"]
        else:
            current_values = {
                "name": el.name,
                "documentation": el.documentation or "",
                "business_fit": apm.business_fit if apm else 3,
                "technical_fit": apm.technical_fit if apm else 3,
                "time_quadrant": apm.time_quadrant if apm else "Tolerate",
                "annual_cost": apm.annual_cost if apm else 0.0,
                "cost_software_licenses": apm.cost_software_licenses if apm else 0.0,
                "cost_cloud_infrastructure": apm.cost_cloud_infrastructure if apm else 0.0,
                "cost_vendor_maintenance": apm.cost_vendor_maintenance if apm else 0.0,
                "cost_internal_labor": apm.cost_internal_labor if apm else 0.0,
                "active_users": apm.active_users if apm else 0,
                "hosting_type": apm.hosting_type if apm else "Cloud",
                "lifecycle_status": apm.lifecycle_status if apm else "Live",
                "sla_level": apm.sla_level if apm else "Silver (99.0%)",
                "data_classification": apm.data_classification if apm else "Internal",
                "business_criticality": apm.business_criticality if apm else "Business Operational",
                "vendor": apm.vendor if apm else "",
                "notes": apm.notes if apm else ""
            }
            default_sections = ["general", "fit", "costs", "lifecycle", "hosting"]

        # Check existing response
        response = scope.response
        if not response:
            response_data = {
                "initial_values": current_values,
                "answers": current_values.copy(),
                "diff_summary": {},
                "notes": ""
            }
        else:
            response_data = {
                "initial_values": response.initial_values_json or current_values,
                "answers": response.answers_json or current_values,
                "diff_summary": response.diff_summary_json or {},
                "notes": response.notes or ""
            }

        return {
            "scope_id": scope.id,
            "campaign_id": c.id,
            "campaign_title": c.title,
            "campaign_mode": c.mode,
            "deadline": c.deadline.isoformat() if c.deadline else None,
            "sections": c.sections_json or default_sections,
            "custom_questions": c.custom_questions or [],
            "element_id": el.id,
            "element_type": el.type,
            "element_category": "process" if is_process else "application",
            "application_name": el.name,
            "status": scope.status,
            "review_feedback": scope.review_feedback,
            "response": response_data
        }

    @staticmethod
    def submit_survey_response(
        db: Session,
        scope_id: str,
        user: User,
        answers: Dict[str, Any],
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Submits survey answers. Computes the diff and either auto-applies or flags for review.
        """
        scope = db.query(SurveyScope).filter(SurveyScope.id == scope_id).first()
        if not scope:
            raise ValueError("Survey scope not found")

        el = scope.element
        apm = el.apm_attributes
        c = scope.campaign

        # Build initial snapshot
        is_process = el.type == "BusinessProcess"
        if is_process:
            props = el.properties if isinstance(el.properties, dict) else {}
            initial_values = {
                "name": el.name,
                "documentation": el.documentation or "",
                "process_criticality": props.get("process_criticality") or "Business Critical",
                "bpmn_automation_level": props.get("bpmn_automation_level") or "Semi-Automated",
                "bpmn_cycle_time_minutes": float(props.get("bpmn_cycle_time_minutes", 15.0)),
                "bpmn_execution_volume_month": int(props.get("bpmn_execution_volume_month", 1000)),
                "bpmn_error_rework_rate_pct": float(props.get("bpmn_error_rework_rate_pct", 2.0)),
                "sla_target": props.get("sla_target") or "< 4 ore",
                "regulatory_compliance": props.get("regulatory_compliance") or "DORA Critical Function",
                "process_owner": props.get("process_owner") or "",
                "notes": props.get("notes") or ""
            }
        else:
            initial_values = {
                "name": el.name,
                "documentation": el.documentation or "",
                "business_fit": apm.business_fit if apm else 3,
                "technical_fit": apm.technical_fit if apm else 3,
                "time_quadrant": apm.time_quadrant if apm else "Tolerate",
                "annual_cost": apm.annual_cost if apm else 0.0,
                "cost_software_licenses": apm.cost_software_licenses if apm else 0.0,
                "cost_cloud_infrastructure": apm.cost_cloud_infrastructure if apm else 0.0,
                "cost_vendor_maintenance": apm.cost_vendor_maintenance if apm else 0.0,
                "cost_internal_labor": apm.cost_internal_labor if apm else 0.0,
                "active_users": apm.active_users if apm else 0,
                "hosting_type": apm.hosting_type if apm else "Cloud",
                "lifecycle_status": apm.lifecycle_status if apm else "Live",
                "sla_level": apm.sla_level if apm else "Silver (99.0%)",
                "data_classification": apm.data_classification if apm else "Internal",
                "business_criticality": apm.business_criticality if apm else "Business Operational",
                "vendor": apm.vendor if apm else "",
                "notes": apm.notes if apm else ""
            }

        # Compute diff
        diff_summary = {}
        for k, new_val in answers.items():
            old_val = initial_values.get(k)
            # Compare normalized values
            if str(old_val) != str(new_val):
                diff_summary[k] = {"old": old_val, "new": new_val}

        # Store or update SurveyResponse
        resp = scope.response
        if not resp:
            resp = SurveyResponse(
                id=f"res-{uuid.uuid4().hex[:12]}",
                survey_scope_id=scope.id,
                initial_values_json=initial_values,
                answers_json=answers,
                diff_summary_json=diff_summary,
                notes=notes
            )
            db.add(resp)
        else:
            resp.answers_json = answers
            resp.diff_summary_json = diff_summary
            resp.notes = notes

        scope.submitted_at = utc_now()

        # If campaign mode is direct_apply, immediately merge into live model!
        if c.mode == "direct_apply":
            SurveyService._apply_answers_to_model(db, el, apm, answers)
            scope.status = "approved"
            scope.reviewed_at = utc_now()
            scope.review_feedback = "Auto-approved via direct application campaign mode."
        else:
            scope.status = "submitted"

        db.commit()
        db.refresh(scope)

        return {
            "scope_id": scope.id,
            "status": scope.status,
            "diff_summary": diff_summary,
            "mode": c.mode
        }

    @staticmethod
    def approve_survey_response(
        db: Session,
        scope_id: str,
        reviewer_user: User,
        feedback: Optional[str] = None
    ) -> Dict[str, Any]:
        """Approves a submitted survey response and commits changes to the live model."""
        scope = db.query(SurveyScope).filter(SurveyScope.id == scope_id).first()
        if not scope or not scope.response:
            raise ValueError("Submitted survey response not found")

        el = scope.element
        apm = el.apm_attributes
        answers = scope.response.answers_json or {}

        SurveyService._apply_answers_to_model(db, el, apm, answers)

        scope.status = "approved"
        scope.reviewed_at = utc_now()
        scope.reviewed_by_id = reviewer_user.id
        scope.review_feedback = feedback or "Approved by Enterprise Architect"

        db.commit()
        db.refresh(scope)
        return {"scope_id": scope.id, "status": scope.status, "message": "Changes successfully applied to model."}

    @staticmethod
    def reject_survey_response(
        db: Session,
        scope_id: str,
        reviewer_user: User,
        feedback: str
    ) -> Dict[str, Any]:
        """Rejects a submitted survey and sends it back to the owner with feedback."""
        scope = db.query(SurveyScope).filter(SurveyScope.id == scope_id).first()
        if not scope:
            raise ValueError("Survey scope not found")

        scope.status = "rejected"
        scope.reviewed_at = utc_now()
        scope.reviewed_by_id = reviewer_user.id
        scope.review_feedback = feedback

        db.commit()
        db.refresh(scope)
        return {"scope_id": scope.id, "status": scope.status, "message": "Survey rejected and sent back for revisions."}

    @staticmethod
    def _apply_answers_to_model(
        db: Session,
        el: ArchimateElement,
        apm: Optional[ApplicationBusinessAttributes],
        answers: Dict[str, Any]
    ):
        """Helper to write verified answers into ArchimateElement and ApplicationBusinessAttributes or properties."""
        if el.type == "BusinessProcess":
            if "name" in answers and answers["name"]:
                el.name = str(answers["name"]).strip()
            if "documentation" in answers:
                el.documentation = answers["documentation"]
            props = dict(el.properties or {})
            for key in [
                "process_criticality", "bpmn_automation_level", "bpmn_cycle_time_minutes",
                "bpmn_execution_volume_month", "bpmn_error_rework_rate_pct", "sla_target",
                "regulatory_compliance", "notes", "process_owner"
            ]:
                if key in answers and answers[key] is not None:
                    props[key] = answers[key]
            el.properties = props
            return

        if not apm:
            apm = ApplicationBusinessAttributes(element_id=el.id)
            db.add(apm)

        if "name" in answers and answers["name"]:
            el.name = str(answers["name"]).strip()
        if "documentation" in answers:
            el.documentation = answers["documentation"]

        if "business_fit" in answers and answers["business_fit"] is not None:
            apm.business_fit = int(answers["business_fit"])
        if "technical_fit" in answers and answers["technical_fit"] is not None:
            apm.technical_fit = int(answers["technical_fit"])
        if "time_quadrant" in answers and answers["time_quadrant"]:
            apm.time_quadrant = str(answers["time_quadrant"])
        if "annual_cost" in answers and answers["annual_cost"] is not None:
            apm.annual_cost = float(answers["annual_cost"])
        if "cost_software_licenses" in answers and answers["cost_software_licenses"] is not None:
            apm.cost_software_licenses = float(answers["cost_software_licenses"])
        if "cost_cloud_infrastructure" in answers and answers["cost_cloud_infrastructure"] is not None:
            apm.cost_cloud_infrastructure = float(answers["cost_cloud_infrastructure"])
        if "cost_vendor_maintenance" in answers and answers["cost_vendor_maintenance"] is not None:
            apm.cost_vendor_maintenance = float(answers["cost_vendor_maintenance"])
        if "cost_internal_labor" in answers and answers["cost_internal_labor"] is not None:
            apm.cost_internal_labor = float(answers["cost_internal_labor"])
        if "active_users" in answers and answers["active_users"] is not None:
            apm.active_users = int(answers["active_users"])
        if "hosting_type" in answers and answers["hosting_type"]:
            apm.hosting_type = str(answers["hosting_type"])
        if "lifecycle_status" in answers and answers["lifecycle_status"]:
            apm.lifecycle_status = str(answers["lifecycle_status"])
        if "sla_level" in answers and answers["sla_level"]:
            apm.sla_level = str(answers["sla_level"])
        if "data_classification" in answers and answers["data_classification"]:
            apm.data_classification = str(answers["data_classification"])
        if "business_criticality" in answers and answers["business_criticality"]:
            apm.business_criticality = str(answers["business_criticality"])
        if "vendor" in answers:
            apm.vendor = answers["vendor"]
        if "notes" in answers:
            apm.notes = answers["notes"]
