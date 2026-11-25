import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class ApplicationOwnership(Base):
    """
    Relational assignment of an application to an application owner, technical owner or delegate.
    """
    __tablename__ = "application_ownerships"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    element_id = Column(String, ForeignKey("archimate_elements.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ownership_type = Column(String(32), default="business_owner", nullable=False) # business_owner, technical_owner, delegate
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    element = relationship("ArchimateElement", foreign_keys=[element_id], back_populates="ownerships")
    user = relationship("User", foreign_keys=[user_id], back_populates="ownerships")


class SurveyCampaign(Base):
    """
    Campaign initiated by an Enterprise Architect or Admin to crowdsource and verify
    application data, APM attributes, costs, lifecycle and risks.
    """
    __tablename__ = "survey_campaigns"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    model_id = Column(String, ForeignKey("model_workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(32), default="active", nullable=False, index=True) # draft, active, closed
    mode = Column(String(32), default="approval_required", nullable=False) # approval_required, direct_apply
    target_owner_type = Column(String(32), default="all", nullable=False) # all, business_owner, technical_owner
    deadline = Column(DateTime, nullable=True)
    sections_json = Column(JSON, default=list) # e.g. ["general", "fit", "costs", "lifecycle", "hosting"]
    custom_questions = Column(JSON, default=list) # e.g. [{"id": "q1", "label": "Cloud Migration Target", "type": "text"}]
    created_by_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=utc_now)
    closed_at = Column(DateTime, nullable=True)

    workspace = relationship("ModelWorkspace")
    created_by = relationship("User", foreign_keys=[created_by_id])
    scopes = relationship("SurveyScope", back_populates="campaign", cascade="all, delete-orphan")


class SurveyScope(Base):
    """
    Single application instance within a survey campaign, assigned to an application owner.
    """
    __tablename__ = "survey_scopes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String, ForeignKey("survey_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    element_id = Column(String, ForeignKey("archimate_elements.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_email = Column(String(255), nullable=True)
    status = Column(String(32), default="pending", nullable=False, index=True) # pending, in_progress, submitted, approved, rejected
    submitted_at = Column(DateTime, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    review_feedback = Column(Text, nullable=True)

    campaign = relationship("SurveyCampaign", back_populates="scopes")
    element = relationship("ArchimateElement", foreign_keys=[element_id])
    assigned_user = relationship("User", foreign_keys=[assigned_user_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    response = relationship("SurveyResponse", back_populates="scope", uselist=False, cascade="all, delete-orphan")


class SurveyResponse(Base):
    """
    Snapshot of initial values and answers submitted by the application owner for a survey scope.
    """
    __tablename__ = "survey_responses"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    survey_scope_id = Column(String, ForeignKey("survey_scopes.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    initial_values_json = Column(JSON, default=dict) # Application state when survey was started
    answers_json = Column(JSON, default=dict) # Answers submitted by owner
    diff_summary_json = Column(JSON, default=dict) # Computed diff: field -> {"old": x, "new": y}
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    scope = relationship("SurveyScope", back_populates="response")
