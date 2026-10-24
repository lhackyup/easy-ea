export type MainHub = 'business' | 'architecture' | 'admin';

export type BusinessSubTab = 'overview' | 'apm' | 'overlap' | 'processes';
export type ArchitectureSubTab = 'repository' | 'schemas' | 'relations' | 'saved-views' | 'import';
export type AdminSubTab = 'models' | 'metamodel' | 'apm_config' | 'roles' | 'auth_config' | 'system';

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
  code: string; // 3-character code e.g. "apm", "tme"
  name: string;
  description?: string;
  icon_color?: string;
  is_default_active?: boolean;
  is_system?: boolean;
  is_active?: boolean | null; // Set when queried in the scope of a library workspace
  item_count?: number;
  items?: AttributePackageItem[];
  created_at?: string;
}

export interface AttributePackageCreatePayload {
  code: string;
  name: string;
  description?: string;
  icon_color?: string;
  is_default_active?: boolean;
}

export interface AttributePackageUpdatePayload {
  name?: string;
  description?: string;
  icon_color?: string;
  is_default_active?: boolean;
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
  base_type: string;
  name: string;
  label: string;
  description?: string | null;
  icon_color: string;
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
  model_id?: string | null;
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
  documentation?: string;
  business_fit: number;
  technical_fit: number;
  time_quadrant: 'Invest' | 'Migrate' | 'Tolerate' | 'Eliminate';
  annual_cost: number;
  business_criticality: string;
  lifecycle_status: string;
  business_owner: string;
  technical_owner: string;
  vendor: string;
  hosting_type: string;
  data_classification: string;
  sla_level: string;
  in_apm_scope?: boolean;
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

export interface ArchimateElementItem {
  id: string;
  model_id: string;
  name: string;
  type: string;
  layer: string;
  documentation?: string;
  properties?: Record<string, any>;
  stereotype_id?: string | null;
  stereotype?: { id: string; name: string; label: string; icon_color: string } | null;
  incoming_count?: number;
  outgoing_count?: number;
  apm?: Partial<ApplicationInfo>;
}

export interface ArchimateRelationshipItem {
  id: string;
  model_id: string;
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
export type RoleType = 'admin' | 'architect' | 'analyst' | 'executive';

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
  is_active: boolean;
  assignments: UserRoleAssignmentItem[];
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
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
  provider_name: string;
  issuer_url: string;
  client_id: string;
  client_secret?: string;
  scopes: string;
  prompt_login: boolean;
  enable_single_logout: boolean;
  rbac_mode: 'hybrid' | 'idp_sync' | 'internal';
  role_mappings: RoleMappingRule[];
  max_schema_versions?: number;
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
}


