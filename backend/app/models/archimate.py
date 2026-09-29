from sqlalchemy import Column, String, Text, Float, Integer, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class ModelWorkspace(Base):
    __tablename__ = "model_workspaces"

    id = Column(String, primary_key=True, index=True)
    code = Column(String(4), unique=True, index=True, nullable=True) # 4-letter unique immutable code
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    version = Column(String, default="1.0.0")
    source_format = Column(String, default="manual") # archi_native, open_exchange, manual
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    elements = relationship("ArchimateElement", back_populates="workspace", cascade="all, delete-orphan")
    relationships = relationship("ArchimateRelationship", back_populates="workspace", cascade="all, delete-orphan")
    views = relationship("ArchimateView", back_populates="workspace", cascade="all, delete-orphan")
    saved_views = relationship("SavedFilterView", back_populates="workspace", cascade="all, delete-orphan")
    schema_folders = relationship("SchemaFolder", back_populates="workspace", cascade="all, delete-orphan")
    schemas = relationship("ArchiSchema", back_populates="workspace", cascade="all, delete-orphan")


class ArchimateElement(Base):
    __tablename__ = "archimate_elements"

    id = Column(String, primary_key=True, index=True)
    model_id = Column(String, ForeignKey("model_workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    type = Column(String, nullable=False, index=True) # e.g. ApplicationComponent, BusinessProcess
    layer = Column(String, nullable=False, index=True) # Strategy, Business, Application, Technology, Motivation, Implementation
    documentation = Column(Text, nullable=True)
    properties = Column(JSON, default=dict)

    workspace = relationship("ModelWorkspace", back_populates="elements")
    outgoing_relations = relationship("ArchimateRelationship", foreign_keys="ArchimateRelationship.source_id", back_populates="source_element", cascade="all, delete-orphan")
    incoming_relations = relationship("ArchimateRelationship", foreign_keys="ArchimateRelationship.target_id", back_populates="target_element", cascade="all, delete-orphan")
    
    # Optional 1-to-1 APM business attributes
    apm_attributes = relationship("ApplicationBusinessAttributes", back_populates="element", uselist=False, cascade="all, delete-orphan")


class ArchimateRelationship(Base):
    __tablename__ = "archimate_relationships"

    id = Column(String, primary_key=True, index=True)
    model_id = Column(String, ForeignKey("model_workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id = Column(String, ForeignKey("archimate_elements.id", ondelete="CASCADE"), nullable=False, index=True)
    target_id = Column(String, ForeignKey("archimate_elements.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False, index=True) # e.g. ServingRelationship, RealizationRelationship
    name = Column(String, nullable=True)
    documentation = Column(Text, nullable=True)
    properties = Column(JSON, default=dict)

    workspace = relationship("ModelWorkspace", back_populates="relationships")
    source_element = relationship("ArchimateElement", foreign_keys=[source_id], back_populates="outgoing_relations")
    target_element = relationship("ArchimateElement", foreign_keys=[target_id], back_populates="incoming_relations")


class ArchimateView(Base):
    __tablename__ = "archimate_views"

    id = Column(String, primary_key=True, index=True)
    model_id = Column(String, ForeignKey("model_workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    viewpoint = Column(String, nullable=True)
    documentation = Column(Text, nullable=True)
    view_data = Column(JSON, default=dict) # Contains visual nodes, connections, bounds

    workspace = relationship("ModelWorkspace", back_populates="views")


class ApplicationBusinessAttributes(Base):
    __tablename__ = "application_business_attributes"

    element_id = Column(String, ForeignKey("archimate_elements.id", ondelete="CASCADE"), primary_key=True)
    business_fit = Column(Integer, default=3) # 1 (Poor) to 5 (Excellent)
    technical_fit = Column(Integer, default=3) # 1 (Poor) to 5 (Excellent)
    time_quadrant = Column(String, default="Tolerate") # Tolerate, Invest, Migrate, Eliminate
    annual_cost = Column(Float, default=0.0) # in Euros/USD
    business_criticality = Column(String, default="Business Operational") # Mission Critical, Business Critical, Business Operational, Administrative
    lifecycle_status = Column(String, default="Live") # Plan, Evaluation, Live, Phase-out, Retired
    business_owner = Column(String, nullable=True)
    technical_owner = Column(String, nullable=True)
    vendor = Column(String, nullable=True)
    hosting_type = Column(String, default="Cloud") # SaaS, Public Cloud, Private Cloud, On-Premise
    data_classification = Column(String, default="Internal") # Public, Internal, Confidential, Restricted/GDPR
    sla_level = Column(String, default="Silver (99.0%)")
    in_apm_scope = Column(Boolean, default=True) # Flag to include/exclude application from APM portfolio/matrix
    notes = Column(Text, nullable=True)

    element = relationship("ArchimateElement", back_populates="apm_attributes")


class CustomAttributeDefinition(Base):
    __tablename__ = "custom_attribute_definitions"

    id = Column(String, primary_key=True, index=True)
    model_id = Column(String, ForeignKey("model_workspaces.id", ondelete="CASCADE"), nullable=True, index=True) # Null = Global metamodel attribute; Non-null = Library-specific attribute
    library_code = Column(String(4), nullable=True, index=True) # e.g. "EASY"
    section = Column(String, nullable=False, default="Custom Attributes", index=True) # Category/Section e.g. "Security & Compliance", "Financial Governance"
    name = Column(String, nullable=False, index=True) # key, e.g. "rto_hours", "easy_cost_center"
    label = Column(String, nullable=False) # Display label, e.g. "RTO (Ore)", "Conformità GDPR"
    description = Column(Text, nullable=True)
    element_type = Column(String, nullable=False, default="*", index=True) # Target type e.g. "ApplicationComponent", "BusinessProcess" or "*" for all
    layer = Column(String, nullable=False, default="All", index=True) # Layer constraint or "All"
    data_type = Column(String, nullable=False, default="string") # string, number, boolean, date, select
    options = Column(JSON, default=list) # List of selectable string choices if data_type == 'select'
    default_value = Column(String, nullable=True)
    is_required = Column(Boolean, default=False)
    is_system = Column(Boolean, default=False, nullable=False, server_default='0', index=True) # True for Easy-EA extension system attributes
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    workspace = relationship("ModelWorkspace", foreign_keys=[model_id])


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=True, default="")
    auth_provider = Column(String, default="local", index=True) # "local", "keycloak", "google", etc.
    external_id = Column(String, unique=True, index=True, nullable=True) # sub from IdP
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)

    role_assignments = relationship("UserRoleAssignment", back_populates="user", cascade="all, delete-orphan")



class UserRoleAssignment(Base):
    __tablename__ = "user_role_assignments"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False, index=True) # "admin", "architect", "analyst", "executive"
    model_id = Column(String, ForeignKey("model_workspaces.id", ondelete="CASCADE"), nullable=True, index=True) # None = Global scope (for admin); Non-null = Library scope
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="role_assignments")
    workspace = relationship("ModelWorkspace", foreign_keys=[model_id])


class SystemAuthSettings(Base):
    __tablename__ = "system_auth_settings"

    id = Column(String, primary_key=True, default="default") # single row configuration
    allow_local_login = Column(Boolean, default=True)
    allow_idp_login = Column(Boolean, default=True)
    provider_name = Column(String, default="Keycloak SSO")
    issuer_url = Column(String, default="http://localhost:18000/realms/dev-realm")
    client_id = Column(String, default="easyea-client")
    client_secret = Column(String, default="easyea-dev-secret-key-2026")
    scopes = Column(String, default="openid profile email roles")
    prompt_login = Column(Boolean, default=False) # True = force login prompt (ignore IdP session cookie)
    enable_single_logout = Column(Boolean, default=True)
    rbac_mode = Column(String, default="hybrid") # hybrid, idp_sync, internal
    role_mappings = Column(JSON, default=list) # List of mapping rule objects
    max_schema_versions = Column(Integer, default=10) # Max versions to keep per schema in repository
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class ImportHistory(Base):
    __tablename__ = "import_history"

    id = Column(String, primary_key=True, index=True)
    model_id = Column(String, ForeignKey("model_workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    file_format = Column(String, nullable=False) # xlsx, csv, zip
    file_size_bytes = Column(Integer, default=0)
    user_name = Column(String, nullable=True, default="Architect")
    status = Column(String, nullable=False, default="success") # success, partial_success, failed
    elements_created = Column(Integer, default=0)
    elements_updated = Column(Integer, default=0)
    relationships_created = Column(Integer, default=0)
    errors_count = Column(Integer, default=0)
    warnings_count = Column(Integer, default=0)
    details = Column(JSON, default=dict)
    imported_at = Column(DateTime, default=utc_now)
    workspace = relationship("ModelWorkspace", foreign_keys=[model_id])


class SavedFilterView(Base):
    __tablename__ = "saved_filter_views"

    id = Column(String, primary_key=True, index=True)
    model_id = Column(String, ForeignKey("model_workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    author = Column(String, default="Enterprise Architect")
    is_shared = Column(Boolean, default=True)
    tags = Column(JSON, default=list)
    filter_config = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    workspace = relationship("ModelWorkspace", back_populates="saved_views")


class SchemaFolder(Base):
    __tablename__ = "schema_folders"

    id = Column(String, primary_key=True, index=True)
    model_id = Column(String, ForeignKey("model_workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(String, ForeignKey("schema_folders.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, nullable=False)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    workspace = relationship("ModelWorkspace", back_populates="schema_folders")
    parent = relationship("SchemaFolder", remote_side=[id], backref="subfolders")
    schemas = relationship("ArchiSchema", back_populates="folder", cascade="all, delete-orphan")


class ArchiSchema(Base):
    __tablename__ = "archi_schemas"

    id = Column(String, primary_key=True, index=True)
    model_id = Column(String, ForeignKey("model_workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    folder_id = Column(String, ForeignKey("schema_folders.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    viewpoint = Column(String, nullable=True, default="Total")
    documentation = Column(Text, nullable=True)
    status = Column(String, default="available", index=True) # "available", "checked_out"
    locked_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    locked_by_username = Column(String, nullable=True)
    locked_at = Column(DateTime, nullable=True)
    current_version = Column(String, default="v1.0")
    view_data = Column(JSON, default=dict) # visual nodes, connections, bounds
    raw_xml = Column(Text, nullable=True) # Standalone Archi / Open Exchange XML content
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    workspace = relationship("ModelWorkspace", back_populates="schemas")
    folder = relationship("SchemaFolder", back_populates="schemas")
    locked_by = relationship("User", foreign_keys=[locked_by_user_id])
    versions = relationship("SchemaVersionHistory", back_populates="schema", cascade="all, delete-orphan", order_by="desc(SchemaVersionHistory.version_number)")


class SchemaVersionHistory(Base):
    __tablename__ = "schema_version_history"

    id = Column(String, primary_key=True, index=True)
    schema_id = Column(String, ForeignKey("archi_schemas.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False, index=True)
    version_label = Column(String, nullable=False) # e.g. "v1.0", "v1.1"
    commit_message = Column(Text, nullable=True)
    author_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    author_name = Column(String, nullable=True)
    view_data_snapshot = Column(JSON, default=dict)
    raw_xml_snapshot = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    schema = relationship("ArchiSchema", back_populates="versions")

