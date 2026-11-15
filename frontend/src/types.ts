export type MainHub = 'business' | 'architecture' | 'admin';

export type BusinessSubTab = 'overview' | 'package_view' | 'insights' | 'apm' | 'tech_risk' | 'overlap' | 'processes';

export interface ActivePackageViewSelection {
  packageId: string;
  viewId: string;
}
export type ArchitectureSubTab = 'repository' | 'schemas' | 'relations' | 'adrs' | 'saved-views' | 'import' | 'business-views' | 'package_view';
export type AdminSubTab = 'models' | 'metamodel' | 'packages' | 'roles' | 'auth_config' | 'api_keys' | 'audit_logs' | 'system';

export interface MetamodelAttribute {
  name: string;
  label: string;
  data_type: 'string' | 'number' | 'boolean' | 'date' | 'select' | 'text';
  options?: string[];
  is_required: boolean;
  description?: string;
  default_value?: string;
}

export interface CustomAttributeDefinition {
  id: string;
  model_id?: string | null;
  library_code?: string | null;
  section?: string;
  name: string;
  label: string;
  description?: string;
  element_type: string;
  layer: string;
  data_type: 'string' | 'number' | 'boolean' | 'date' | 'select' | 'text';
  options?: string[];
  default_value?: string;
  is_required: boolean;
  is_system?: boolean;
  is_package?: boolean;
  package_id?: string;
  package_code?: string;
  package_name?: string;
  created_at?: string;
}

export interface AttributePackageItem {
  id: string;
  package_id: string;
  name: string;
  label: string;
  description?: string;
  element_type: string;
  layer: string;
  data_type: 'string' | 'number' | 'boolean' | 'date' | 'select' | 'text';
  options?: string[];
  default_value?: string;
  is_required: boolean;
  section: string;
  sort_order: number;
  created_at?: string;
}

export interface AttributePackage {
  id: string;
  code: string; // 3-8 character code e.g. "apm", "tme", "bian"
  name: string;
  version?: string;
  author?: string;
  license?: string;
  description?: string;
  icon_color?: string;
  package_type?: 'attribute_only' | 'framework';
  standard_version?: string | null;
  website_url?: string | null;
  is_default_active?: boolean;
  is_system?: boolean;
  is_active?: boolean | null; // Set when queried in the scope of a library workspace
  item_count?: number;
  items?: AttributePackageItem[];
  stereotypes_count?: number;
  reference_elements_count?: number;
  reference_relationships_count?: number;
  views_count?: number;
  stereotypes?: ElementStereotype[];
  reference_elements?: any[];
  reference_relationships?: any[];
  views?: any[];
  created_at?: string;
}

export interface PackageInspectResult {
  valid: boolean;
  action: 'new_install' | 'upgrade' | 'reinstall' | 'downgrade' | 'invalid';
  manifest: {
    id: string;
    code: string;
    name: string;
    version: string;
    package_type: 'attribute_only' | 'framework';
    standard_version?: string;
    description?: string;
    author?: string;
    license?: string;
    website_url?: string;
    icon_color?: string;
    is_default_active?: boolean;
  };
  counts: {
    attributes: number;
    stereotypes: number;
    reference_elements: number;
    reference_relationships: number;
  };
  existing_package?: {
    id: string;
    code: string;
    name: string;
    version: string;
    package_type: string;
    items_count: number;
    stereotypes_count: number;
    reference_elements_count: number;
    reference_relationships_count: number;
  } | null;
  readme?: string;
  warnings: string[];
  errors: string[];
}

export interface AttributePackageCreatePayload {
  code: string;
  name: string;
  description?: string;
  icon_color?: string;
  is_default_active?: boolean;
  package_type?: 'attribute_only' | 'framework';
  standard_version?: string;
  website_url?: string;
}

export interface AttributePackageUpdatePayload {
  name?: string;
  description?: string;
  icon_color?: string;
  is_default_active?: boolean;
  package_type?: 'attribute_only' | 'framework';
  standard_version?: string;
  website_url?: string;
}

export interface PackageItemCreatePayload {
  name: string;
  label: string;
  description?: string;
  element_type?: string;
  layer?: string;
  data_type?: string;
  options?: string[];
  default_value?: string;
  is_required?: boolean;
  section?: string;
  sort_order?: number;
}

export interface PackageUsageAuditLibrary {
  model_id: string;
  model_code?: string;
  model_name: string;
  is_active: boolean;
  total_elements: number;
  populated_elements_count: number;
  populated_elements_sample: Array<{
    id: string;
    name: string;
    type: string;
    populated_attributes: string[];
  }>;
  attribute_counts: Record<string, number>;
}

export interface PackageUsageAudit {
  package_id: string;
  package_code: string;
  package_name: string;
  is_system: boolean;
  total_active_libraries: number;
  total_populated_elements: number;
  libraries: PackageUsageAuditLibrary[];
}

export interface CustomAttributeCreatePayload {
  name: string;
  label: string;
  section?: string;
  model_id?: string | null;
  description?: string;
  element_type: string;
  layer: string;
  data_type: string;
  options?: string[];
  default_value?: string;
  is_required: boolean;
}

export interface CustomAttributeUpdatePayload {
  label?: string;
  section?: string;
  description?: string;
  data_type?: string;
  options?: string[];
  default_value?: string;
  is_required?: boolean;
}

export interface StereotypeAttributeLink {
  id: string;
  stereotype_id: string;
  attribute_name: string;
  is_required: boolean;
  default_value?: string | null;
  section_override?: string | null;
  sort_order: number;
}

export interface ElementStereotype {
  id: string;
  model_id?: string | null;
  package_id?: string | null;
  package_name?: string | null;
  package_code?: string | null;
  base_type: string;
  name: string;
  label: string;
  description?: string | null;
  icon_color: string;
  stencil_shape?: string | null;
  stencil_icon?: string | null;
  custom_drawio_style?: string | null;
  is_system: boolean;
  attribute_links: StereotypeAttributeLink[];
  created_at?: string | null;
}

export interface StereotypeCreatePayload {
  name: string;
  label?: string;
  base_type: string;
  description?: string;
  icon_color?: string;
  stencil_shape?: string | null;
  stencil_icon?: string | null;
  custom_drawio_style?: string | null;
  model_id?: string | null;
  package_id?: string | null;
  attribute_links?: Array<{
    attribute_name: string;
    is_required?: boolean;
    default_value?: string;
    section_override?: string;
    sort_order?: number;
  }>;
}

export interface StereotypeUpdatePayload {
  name?: string;
  label?: string;
  description?: string;
  icon_color?: string;
  stencil_shape?: string | null;
  stencil_icon?: string | null;
  custom_drawio_style?: string | null;
}

export interface MetamodelElementType {
  type: string;
  name: string;
  layer: string;
  description: string;
  standard_attributes: MetamodelAttribute[];
  apm_attributes?: MetamodelAttribute[];
  custom_attributes?: CustomAttributeDefinition[];
  stereotypes?: ElementStereotype[];
}

export interface MetamodelLayer {
  layer: string;
  color: string;
  bg_color: string;
  border_color: string;
  text_color: string;
  description: string;
  element_types: MetamodelElementType[];
}

export interface ArchiMateRelationshipType {
  type: string;
  name: string;
  nature: 'Structural' | 'Dependency' | 'Dynamic' | 'Other';
  category: string;
  symbol: string;
  strength: number;
  is_directed: boolean;
  color: string;
  badge_bg: string;
  badge_text: string;
  border_color: string;
  description: string;
}

export interface MetamodelRelationshipElement {
  type: string;
  name: string;
  layer: string;
  color: string;
  bg_color: string;
  text_color: string;
  border_color: string;
}

export interface MetamodelRelationshipsMatrixData {
  relationship_types: ArchiMateRelationshipType[];
  rules: Record<string, Record<string, string[]>>;
  elements: MetamodelRelationshipElement[];
  layers: string[];
}


export interface ModelWorkspace {
  id: string;
  code: string;
  name: string;
  description?: string;
  version: string;
  source_format: string;
  modeling_tool?: 'archi' | 'drawio';
  stencil_style?: 'standard' | 'modern';
  element_count: number;
  relationship_count: number;
  view_count: number;
  application_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ApplicationInfo {
  id: string;
  name: string;
  short_name?: string;
  app_code?: string;
  documentation?: string;
  business_fit: number;
  technical_fit: number;
  functional_fit_label?: string;
  technical_fit_label?: string;
  time_quadrant: 'Invest' | 'Migrate' | 'Tolerate' | 'Eliminate';
  time_quadrant_override?: string;
  annual_cost: number;
  cost_type?: string;
  cost_center?: string;
  business_criticality: string;
  lifecycle_status: string;
  live_date?: string | null;
  retirement_date?: string | null;
  business_owner: string;
  technical_owner: string;
  vendor: string;
  hosting_type: string;
  architecture_type?: string;
  data_classification: string;
  personal_data?: boolean;
  sla_level: string;
  rto_hours?: string;
  is_business_app?: boolean;
  is_enterprise_app?: boolean;
  in_apm_scope?: boolean;
  stereotype_id?: string | null;
  stereotype_name?: string;
  stereotype_label?: string;
  notes?: string;
}

export interface APMPortfolio {
  total_applications: number;
  total_in_scope?: number;
  total_out_of_scope?: number;
  total_annual_cost: number;
  time_distribution: {
    Invest: number;
    Migrate: number;
    Tolerate: number;
    Eliminate: number;
  };
  time_cost_distribution: {
    Invest: number;
    Migrate: number;
    Tolerate: number;
    Eliminate: number;
  };
  criticality_distribution: Record<string, number>;
  lifecycle_distribution: Record<string, number>;
  hosting_distribution: Record<string, number>;
  top_vendors_by_cost: Array<{ vendor: string; cost: number }>;
  applications: ApplicationInfo[];
}

export interface TechnologyItemInfo {
  id: string;
  name: string;
  type: string;
  layer: string;
  vendor: string;
  version: string;
  category: string;
  status: 'Supported' | 'Approaching EOL' | 'Extended Support' | 'End of Life / Obsolete';
  risk_score: number;
  risk_level: 'Critical' | 'High' | 'Medium' | 'Low';
  eol_date: string | null;
  eoes_date: string | null;
  days_to_eol: number | null;
  cve_risk: string;
  documentation?: string;
  impacted_applications_count?: number;
  impacted_applications?: Array<{ id: string; name: string; business_criticality?: string; annual_cost?: number }>;
  total_impacted_annual_cost?: number;
  highest_criticality?: string;
}

export interface AppTechRiskInfo {
  id: string;
  name: string;
  documentation?: string;
  business_criticality: string;
  time_quadrant: string;
  annual_cost: number;
  business_owner: string;
  technical_owner: string;
  tech_risk_level: 'Critical' | 'High' | 'Medium' | 'Low' | 'Unassessed';
  max_risk_score: number;
  composite_risk_score: number;
  is_dora_violation: boolean;
  next_eol_date: string | null;
  days_to_next_eol: number | null;
  counts: {
    total: number;
    obsolete: number;
    approaching_eol: number;
    extended_support: number;
    supported: number;
  };
  technologies: TechnologyItemInfo[];
}

export interface DoraComplianceAlert {
  application_id: string;
  application_name: string;
  business_criticality: string;
  tech_risk_level: string;
  annual_cost: number;
  business_owner: string;
  technical_owner: string;
  obsolete_components: string[];
  reason: string;
}

export interface TechRiskAnalysisData {
  summary: {
    total_applications: number;
    assessed_applications: number;
    unassessed_applications: number;
    total_technologies: number;
    obsolete_technologies_count: number;
    approaching_eol_count: number;
    dora_compliance_alerts_count: number;
    risk_distribution: {
      Critical: number;
      High: number;
      Medium: number;
      Low: number;
      Unassessed: number;
    };
    high_critical_risk_pct: number;
  };
  criticality_vs_risk_matrix: Record<string, Record<string, number>>;
  dora_compliance_alerts: DoraComplianceAlert[];
  eol_timeline_horizon: {
    already_expired: TechnologyItemInfo[];
    expiring_6_months: TechnologyItemInfo[];
    expiring_12_months: TechnologyItemInfo[];
    expiring_24_months_plus: TechnologyItemInfo[];
    supported_indefinitely: TechnologyItemInfo[];
  };
  technology_blast_radius: TechnologyItemInfo[];
  applications: AppTechRiskInfo[];
}

export interface OverlapMatrixData {
  total_capabilities: number;
  total_applications: number;
  redundant_capabilities_count: number;
  redundancy_score_percentage: number;
  potential_savings_opportunity: number;
  applications_columns: Array<{ id: string; name: string; annual_cost: number }>;
  capability_rows: Array<{
    id: string;
    name: string;
    type: string;
    layer: string;
    documentation?: string;
    app_count: number;
    is_redundant: boolean;
    serving_applications: Array<{
      app_id: string;
      app_name: string;
      annual_cost: number;
      time_quadrant: string;
      relation_types: string[];
    }>;
  }>;
  redundancy_clusters: Array<{
    capability_id: string;
    capability_name: string;
    capability_type: string;
    app_count: number;
    potential_savings: number;
    applications: Array<{
      app_id: string;
      app_name: string;
      annual_cost: number;
      time_quadrant: string;
    }>;
    recommendation: string;
  }>;
}

export interface BusinessProcessItem {
  id: string;
  name: string;
  type: string;
  documentation?: string;
  actors: Array<{ id: string; name: string; type: string }>;
  supporting_applications: Array<{
    id: string;
    name: string;
    criticality: string;
    cost: number;
    time_quadrant: string;
    lifecycle_status?: string;
  }>;
  infrastructure_nodes: Array<{ id: string; name: string; type: string }>;
  process_steps?: Array<{ id: string; name: string; type: string; bpmn_tag?: string }>;
  steps_count?: number;
  app_dependency_count: number;
  is_critical: boolean;
  risks?: Array<{ severity: string; type: string; message: string }>;
  has_spof?: boolean;
  has_lifecycle_risk?: boolean;
}

export interface ImpactSimulationResult {
  source_element: {
    id: string;
    name: string;
    type: string;
    layer: string;
  };
  simulation_mode?: 'failure' | 'change';
  max_hops_configured?: number;
  blast_radius?: {
    score: number;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    max_hop_reached: number;
    total_impacted_elements: number;
  };
  impact_summary: {
    total_impacted_processes: number;
    total_impacted_applications: number;
    total_impacted_infrastructure?: number;
    total_impacted_data_objects?: number;
    total_impacted_stakeholders: number;
  };
  impacted_processes: Array<{
    id: string;
    name: string;
    type: string;
    hop_distance?: number;
    path?: Array<{ id: string; name: string; type: string; rel?: string }>;
  }>;
  impacted_applications: Array<{
    id: string;
    name: string;
    criticality: string;
    time_quadrant?: string;
    lifecycle_status?: string;
    hop_distance?: number;
    path?: Array<{ id: string; name: string; type: string; rel?: string }>;
  }>;
  impacted_infrastructure?: Array<{
    id: string;
    name: string;
    type: string;
    hop_distance?: number;
    path?: Array<{ id: string; name: string; type: string; rel?: string }>;
  }>;
  impacted_data_objects?: Array<{
    id: string;
    name: string;
    type: string;
    hop_distance?: number;
    path?: Array<{ id: string; name: string; type: string; rel?: string }>;
  }>;
  impacted_stakeholders: Array<{
    id: string;
    name: string;
    type: string;
    hop_distance?: number;
    path?: Array<{ id: string; name: string; type: string; rel?: string }>;
  }>;
}

export interface ArchitecturalRisksReport {
  model_id: string;
  risk_index: number;
  risk_level: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  summary: {
    total_risks: number;
    spof_count: number;
    lifecycle_risks_count: number;
    sla_risks_count: number;
  };
  spof_risks: Array<{
    element_id: string;
    element_name: string;
    element_type: string;
    severity: string;
    type: string;
    message: string;
  }>;
  lifecycle_risks: Array<{
    process_id: string;
    process_name: string;
    message: string;
    severity: string;
  }>;
  sla_risks: Array<{
    process_id: string;
    process_name: string;
    message: string;
    severity: string;
  }>;
}

export interface PlateauRoadmap {
  has_explicit_plateaus: boolean;
  plateaus?: Array<{
    id: string;
    name: string;
    documentation?: string;
    element_count: number;
    elements: Array<{ id: string; name: string; type: string; layer: string }>;
  }>;
  horizons?: Array<{
    horizon: string;
    description: string;
    app_count: number;
    applications: Array<{ id: string; name: string; time_quadrant: string; lifecycle_status: string; cost: number }>;
  }>;
  work_packages: Array<{ id: string; name: string; doc?: string }>;
}

export interface DerivedRelationshipItem {
  id: string;
  source_id: string;
  source_name: string;
  source_type: string;
  target_id: string;
  target_name: string;
  target_type: string;
  type: string;
  is_derived: boolean;
  strength: number;
  chain: Array<{ source_name: string; rel_type: string; target_name: string }>;
}

export interface SchemaUsageSummary {
  id: string;
  name: string;
  format?: string;
  viewpoint?: string | null;
  current_version?: string;
  status?: string;
  folder_id?: string | null;
  folder_name?: string | null;
  documentation?: string | null;
  nodes_count?: number;
  connections_count?: number;
}

export interface ArchimateElementItem {
  id: string;
  model_id: string;
  is_reference?: boolean;
  package_id?: string | null;
  package_code?: string | null;
  package_name?: string | null;
  name: string;
  type: string;
  layer: string;
  documentation?: string;
  properties?: Record<string, any>;
  stereotype_id?: string | null;
  stereotype?: { id: string; name: string; label: string; icon_color: string } | null;
  incoming_count?: number;
  outgoing_count?: number;
  adr_count?: number;
  schemas_count?: number;
  used_in_schemas?: SchemaUsageSummary[];
  apm?: Partial<ApplicationInfo>;
}

export interface PaginatedElementsResponse {
  items: ArchimateElementItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ArchimateRelationshipItem {
  id: string;
  model_id: string;
  is_reference?: boolean;
  package_id?: string | null;
  package_code?: string | null;
  type: string;
  name?: string;
  source_id: string;
  source_name: string;
  source_type: string;
  target_id: string;
  target_name: string;
  target_type: string;
  documentation?: string;
}

export interface DiagramViewDetail {
  id: string;
  model_id: string;
  name: string;
  viewpoint?: string;
  documentation?: string;
  drawio_xml?: string;
  nodes: Array<{
    id: string;
    element_id?: string;
    name: string;
    type: string;
    layer: string;
    documentation?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    parent_id?: string;
  }>;
  connections: Array<{
    id: string;
    relationship_id?: string;
    type: string;
    name?: string;
    source_node_id: string;
    target_node_id: string;
  }>;
}

// RBAC Types
export type RoleType = 'admin' | 'architect' | 'analyst' | 'executive' | 'viewer';

export interface UserRoleAssignmentItem {
  id: string;
  role: RoleType;
  model_id?: string | null;
  library_code?: string | null;
  library_name?: string | null;
  created_at?: string;
}

export interface UserItem {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at?: string;
  role_assignments: UserRoleAssignmentItem[];
}

export interface RolePermission {
  domain: string;
  action: string;
  description: string;
  allowed?: boolean;
}

export interface RoleDefinition {
  role: RoleType;
  name: string;
  scope_type: 'global' | 'library';
  badge_color: string;
  description: string;
  permissions: RolePermission[];
}

export interface RolesMetadataResponse {
  roles: RoleDefinition[];
  scope_rules: Record<string, {
    scope_type: 'global' | 'library';
    requires_model_id: boolean;
    description: string;
  }>;
}

export interface PermissionCheckResult {
  allowed: boolean;
  role?: string;
  scope?: string;
  reason: string;
}

export interface AuthUser {
  id: string;
  username?: string | null;
  email: string;
  full_name: string;
  auth_provider?: string;
  is_active: boolean;
  is_local?: boolean;
  is_mfa_enabled?: boolean;
  mfa_enrolled_at?: string | null;
  assignments: UserRoleAssignmentItem[];
}

export interface LoginResponse {
  token?: string;
  user?: AuthUser;
  mfa_required?: boolean;
  mfa_setup_required?: boolean;
  mfa_token?: string;
  secret?: string;
  otpauth_url?: string;
  qr_code_svg?: string;
  qr_code_data_url?: string;
}

export interface MfaStatus {
  is_local: boolean;
  is_mfa_enabled: boolean;
  mfa_enrolled_at?: string | null;
  mfa_policy: 'disabled' | 'admin_only' | 'write_roles' | 'all';
  is_enforced: boolean;
}

export interface MfaSetupResponse {
  secret: string;
  otpauth_url: string;
  qr_code_svg: string;
  qr_code_data_url?: string;
}

export type ClaimType = 'realm_role' | 'client_role' | 'group' | 'custom_claim';

export interface RoleMappingRule {
  id: string;
  claim_type: ClaimType;
  claim_name: string;
  expected_value?: string;
  target_role: RoleType;
  target_model_id?: string | null;
  description?: string;
}

export interface SystemAuthSettings {
  allow_local_login: boolean;
  allow_idp_login: boolean;
  allow_mcp_access?: boolean;
  provider_name: string;
  issuer_url: string;
  client_id: string;
  client_secret?: string;
  scopes: string;
  prompt_login: boolean;
  enable_single_logout: boolean;
  rbac_mode: 'hybrid' | 'idp_sync' | 'internal';
  mfa_policy?: 'disabled' | 'admin_only' | 'write_roles' | 'all';
  role_mappings: RoleMappingRule[];
  max_schema_versions?: number;
  show_demo_banner?: boolean;
  demo_banner_message?: string;
  demo_username?: string;
  demo_password?: string;
}
export interface IdpConnectionTestResult {
  success: boolean;
  message: string;
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
  end_session_endpoint?: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  user_id: string;
  created_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  last_used_at: string | null;
}

export interface ApiKeyCreatedResponse extends ApiKeyItem {
  raw_key: string;
  warning: string;
}

export interface SavedViewAttributeRule {
  id: string;
  attributeName: string;
  operator: string;
  value: string | number | boolean;
  secondValue?: string | number;
}

export interface SavedViewFilterConfig {
  selectedLayer?: string;
  selectedType?: string;
  search?: string;
  searchInProps?: boolean;
  relationshipFilter?: 'all' | 'orphan' | 'connected';
  documentationFilter?: 'all' | 'with_doc' | 'no_doc';
  matchLogic?: 'AND' | 'OR';
  attributeFilterRules?: SavedViewAttributeRule[];
  sortBy?: string;
}

export interface SavedFilterView {
  id: string;
  model_id: string;
  name: string;
  description?: string | null;
  author?: string;
  is_shared: boolean;
  tags: string[];
  filter_config: SavedViewFilterConfig;
  created_at?: string;
  updated_at?: string;
}

export interface SavedViewCreatePayload {
  model_id: string;
  name: string;
  description?: string;
  author?: string;
  is_shared?: boolean;
  tags?: string[];
  filter_config: SavedViewFilterConfig;
}

export interface SavedViewUpdatePayload {
  name?: string;
  description?: string;
  author?: string;
  is_shared?: boolean;
  tags?: string[];
  filter_config?: SavedViewFilterConfig;
}

export interface SchemaFolder {
  id: string;
  model_id: string;
  parent_id: string | null;
  name: string;
  order_index: number;
  schema_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ArchiSchema {
  id: string;
  model_id: string;
  folder_id: string | null;
  name: string;
  viewpoint: string;
  documentation: string;
  format?: 'archi' | 'drawio' | 'bpmn';
  status: 'available' | 'checked_out';
  locked_by_user_id: string | null;
  locked_by_username: string | null;
  locked_at: string | null;
  current_version: string;
  nodes_count?: number;
  connections_count?: number;
  view_data?: any;
  created_at?: string;
  updated_at?: string;
}

export interface SchemaVersionHistory {
  id: string;
  version_number: number;
  version_label: string;
  commit_message: string;
  author_user_id?: string;
  author_name: string;
  has_raw_xml?: boolean;
  created_at: string;
}

export interface SchemaDiffChange {
  field: string;
  label: string;
  prop_key?: string;
  current_value: string;
  new_value: string;
  overwrite: boolean;
}

export interface SchemaDiffModifiedElement {
  id: string;
  xml_id?: string;
  name: string;
  type: string;
  changes: SchemaDiffChange[];
}

export interface SchemaDiffNewElement {
  xml_id: string;
  name: string;
  type: string;
  layer: string;
  documentation?: string;
  properties?: Record<string, any>;
}

export interface SchemaDiffRemovedElement {
  id: string;
  name: string;
  type: string;
  layer: string;
  remove_from_catalog: boolean;
}

export interface SchemaDiffNewRelationship {
  xml_id: string;
  type: string;
  name?: string;
  source_xml_id?: string;
  target_xml_id?: string;
  source_name?: string;
  target_name?: string;
  documentation?: string;
  properties?: Record<string, any>;
}

export interface SchemaDiffModifiedRelationship {
  id: string;
  xml_id?: string;
  type: string;
  source_name?: string;
  target_name?: string;
  changes: SchemaDiffChange[];
}

export interface SchemaDiffRemovedRelationship {
  id: string;
  type: string;
  name?: string;
  source_name?: string;
  target_name?: string;
  remove_from_catalog: boolean;
}

export interface SchemaDiffResult {
  has_differences: boolean;
  summary: {
    new_elements_count: number;
    modified_elements_count: number;
    removed_elements_count: number;
    new_relationships_count: number;
    modified_relationships_count: number;
    removed_relationships_count: number;
  };
  modified_elements: SchemaDiffModifiedElement[];
  new_elements: SchemaDiffNewElement[];
  removed_elements: SchemaDiffRemovedElement[];
  modified_relationships: SchemaDiffModifiedRelationship[];
  new_relationships: SchemaDiffNewRelationship[];
  removed_relationships: SchemaDiffRemovedRelationship[];
  xml_content?: string;
  parsed_view_data?: any;
  format?: string;
}

export interface PackageViewSummary {
  id: string;
  view_key: string;
  name: string;
  description?: string | null;
  category: string;
  view_type: 'table' | 'matrix' | 'kpi_dashboard' | 'adr_manager' | 'resilience_dashboard' | 'gap_matrix';
  icon?: string;
  sort_order?: number;
  target_hub?: 'business' | 'architecture' | 'both';
  matching_elements_count: number;
  is_global?: boolean;
  is_active?: boolean;
  package_id?: string | null;
  model_id?: string | null;
  author?: string | null;
  target_stereotypes?: string[];
  target_types?: string[];
  config?: Record<string, any>;
}

export interface CustomBusinessViewPayload {
  name: string;
  view_key?: string;
  description?: string;
  category: string;
  view_type: 'table' | 'matrix' | 'kpi_dashboard' | 'adr_manager' | 'resilience_dashboard' | 'gap_matrix';
  icon?: string;
  sort_order?: number;
  target_hub?: 'business' | 'architecture' | 'both';
  is_global?: boolean;
  is_active?: boolean;
  package_id?: string | null;
  target_stereotypes?: string[];
  target_types?: string[];
  config?: Record<string, any>;
}

export type CustomBusinessViewItem = PackageViewSummary;

export interface PackageWithViews {
  id: string;
  code: string;
  name: string;
  version: string;
  icon_color?: string;
  package_type: string;
  views: PackageViewSummary[];
}

export interface PackageViewColumn {
  field: string;
  label: string;
  type: 'string' | 'enum' | 'badge' | 'number' | 'date' | 'currency';
  sortable?: boolean;
  filterable?: boolean;
}

export interface PackageViewKPIMetric {
  id: string;
  label: string;
  value: number;
  type: string;
}

export interface PackageViewChartItem {
  label: string;
  count: number;
}

export interface PackageViewChart {
  id: string;
  title: string;
  type: 'bar' | 'pie' | 'donut';
  group_by: string;
  data: PackageViewChartItem[];
}

export interface PackageViewExecuteResponse {
  view_id: string;
  view_key: string;
  name: string;
  description?: string | null;
  category: string;
  view_type: 'table' | 'matrix' | 'kpi_dashboard';
  icon?: string;
  config?: Record<string, any>;
  columns?: PackageViewColumn[];
  rows?: Record<string, any>[];
  total?: number;
  total_items?: number;
  metrics?: PackageViewKPIMetric[];
  charts?: PackageViewChart[];
  facet_options?: Record<string, string[]>;
  matrix_summary?: {
    counts?: Record<string, number>;
    costs?: Record<string, number>;
    grid?: Record<string, Record<string, number>>;
  };
}

export type ADRStatus = 'Draft' | 'Proposed' | 'Accepted' | 'Rejected' | 'Deprecated' | 'Superseded';
export type ADRDomain = 'Strategy' | 'Business' | 'Application' | 'Data' | 'Technology' | 'Security' | 'Integration' | 'Governance';
export type ADRImpactType = 'driven_by' | 'introduces' | 'governs' | 'modifies' | 'retires';

export interface ADRConsideredOption {
  title: string;
  description?: string;
  pros?: string;
  cons?: string;
}

export interface ADRLinkedElementItem {
  id?: string;
  element_id: string;
  element_name?: string;
  element_type?: string;
  element_layer?: string;
  impact_type: ADRImpactType;
  notes?: string;
}

export interface ADRRefInfo {
  id: string;
  code: string;
  title: string;
  status: ADRStatus;
}

export interface ADRItem {
  id: string;
  model_id: string;
  code: string;
  title: string;
  status: ADRStatus;
  domain: ADRDomain;
  context_and_problem: string;
  decision_drivers: string[];
  considered_options: ADRConsideredOption[];
  decision_outcome: string;
  consequences: string;
  compliance_impact: string;
  deciders: string;
  author_id?: string | null;
  author_name: string;
  superseded_by_id?: string | null;
  superseded_by?: ADRRefInfo | null;
  supersedes?: ADRRefInfo[];
  linked_elements: ADRLinkedElementItem[];
  linked_elements_count: number;
  decided_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ADRListSummary {
  total: number;
  accepted: number;
  proposed: number;
  draft: number;
  rejected: number;
  deprecated: number;
  superseded: number;
  by_status: Record<string, number>;
  by_domain: Record<string, number>;
}

export interface ADRListResponse {
  model_id: string;
  summary: ADRListSummary;
  items: ADRItem[];
}

export interface ResilienceMetrics {
  total_processes: number;
  total_critical_processes: number;
  compliant_processes: number;
  mismatched_processes: number;
  compliance_rate: number;
  worst_sla_gap: number;
  worst_rto_gap: number;
  worst_rpo_gap: number;
}

export interface ResilienceSupportingApp {
  id: string;
  name: string;
  type: string;
  sla: number;
  rto_hours: number;
  rpo_hours: number;
  dr_strategy: string;
}

export interface ResilienceSupportingTech {
  id: string;
  name: string;
  type: string;
  sla: number;
  rto_hours: number;
  rpo_hours: number;
  ha_redundancy: string;
  serves_app?: string;
}

export interface ResilienceBottleneck {
  id: string;
  name: string;
  type: string;
  issue: string;
}

export interface ResilienceMismatchItem {
  process_id: string;
  process_name: string;
  process_type: string;
  criticality_tier: string;
  dora_critical_function: boolean;
  target_sla: number;
  effective_sla: number;
  sla_gap: number;
  has_sla_mismatch: boolean;
  target_rto_hours: number;
  effective_rto_hours: number;
  rto_gap_hours: number;
  has_rto_breach: boolean;
  target_rpo_hours: number;
  effective_rpo_hours: number;
  rpo_gap_hours: number;
  has_rpo_breach: boolean;
  status: 'COMPLIANT' | 'CRITICAL_MISMATCH' | 'HIGH_MISMATCH' | 'MEDIUM_MISMATCH';
  badge_color: 'emerald' | 'rose' | 'amber' | 'orange';
  bottleneck?: ResilienceBottleneck | null;
  supporting_apps_count: number;
  supporting_apps: ResilienceSupportingApp[];
  supporting_tech_count: number;
  supporting_tech: ResilienceSupportingTech[];
}

export interface ResilienceAnalysisResult {
  model_id: string;
  model_name: string;
  metrics: ResilienceMetrics;
  mismatches: ResilienceMismatchItem[];
}

export type GapCategory = 'RETAINED' | 'ADDED' | 'MODIFIED' | 'RETIRED';

export interface GapItem {
  id: string;
  name: string;
  type: string;
  layer: string;
  category: GapCategory;
  badge_color: 'slate' | 'emerald' | 'blue' | 'rose';
  architecture_horizon: string;
  gap_action: string;
  target_plateau: string;
  annual_cost: number;
  cost_impact: number;
  work_packages: string[];
  has_work_package: boolean;
  migration_rationale: string;
  plateaus?: string[];
}

export interface GapMetrics {
  total_elements: number;
  retained_count: number;
  added_count: number;
  modified_count: number;
  retired_count: number;
  total_savings: number;
  total_added_investments: number;
  net_financial_delta: number;
  gaps_missing_work_package: number;
  available_plateaus_count?: number;
  available_work_packages_count?: number;
}

export interface GapAnalysisResult {
  mode: 'intra_model' | 'cross_model';
  base_model: {
    id: string;
    name: string;
    code: string;
  };
  compare_model?: {
    id: string;
    name: string;
    code: string;
  } | null;
  metrics: GapMetrics;
  plateaus?: Array<{ id: string; name: string }>;
  work_packages?: Array<{ id: string; name: string }>;
  items: GapItem[];
}

export interface SecurityAuditItem {
  id: string;
  sequence_number: number;
  timestamp: string;
  event_id: string;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  actor_id?: string | null;
  actor_username?: string | null;
  actor_role?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  details: Record<string, any>;
  prev_hash: string;
  current_hash: string;
}

export interface AuditVerificationResult {
  is_valid: boolean;
  total_records: number;
  first_event_at?: string | null;
  last_event_at?: string | null;
  tampered_at_sequence?: number | null;
  broken_event_id?: string | null;
  reason?: string | null;
  message: string;
}

export interface AuditSummary {
  total_records: number;
  recent_24h_events: number;
  recent_24h_failures: number;
  recent_24h_logins: number;
  top_actions: Array<{ action: string; count: number }>;
}





