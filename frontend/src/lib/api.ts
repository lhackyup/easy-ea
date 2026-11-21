import {
  ModelWorkspace,
  APMPortfolio,
  InterfaceInventoryData,
  TechRiskAnalysisData,
  TCOBreakdownData,
  LifecycleAnalysisData,
  OverlapMatrixData,
  FunctionalAnalysisData,
  BusinessProcessItem,
  ImpactSimulationResult,
  ArchitecturalRisksReport,
  PlateauRoadmap,
  DerivedRelationshipItem,
  ArchimateElementItem,
  PaginatedElementsResponse,
  ArchimateRelationshipItem,
  DiagramViewDetail,
  ApplicationInfo,
  SystemAuthSettings,
  IdpConnectionTestResult,
  SchemaFolder,
  ArchiSchema,
  SchemaVersionHistory,
  SchemaDiffResult,
  PackageInspectResult,
  PackageWithViews,
  PackageViewExecuteResponse,
  ResilienceAnalysisResult,
  ResilienceMetrics,
  GapAnalysisResult,
  GapMetrics,
  ApiKeyItem,
  ApiKeyCreatedResponse,
  MfaStatus,
  MfaSetupResponse,
  SecurityAuditItem,
  AuditVerificationResult,
  AuditSummary
} from '../types';

const API_BASE = '/api';

export const getAuthHeaders = (): Record<string, string> => {
  const token = sessionStorage.getItem('easyea_auth_token') || localStorage.getItem('easyea_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const withAuthToken = (url: string): string => {
  const token = sessionStorage.getItem('easyea_auth_token') || localStorage.getItem('easyea_auth_token');
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
};

export const api = {
  // Models
  getModels: async (): Promise<ModelWorkspace[]> => {
    const res = await fetch(`${API_BASE}/models`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch models');
    return res.json();
  },

  getModelDetail: async (modelId: string): Promise<ModelWorkspace> => {
    const res = await fetch(`${API_BASE}/models/${modelId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch model detail');
    return res.json();
  },

  createEmptyModel: async (data: { name: string; code?: string; description?: string; version?: string; modeling_tool?: 'archi' | 'drawio'; stencil_style?: 'standard' | 'modern' }): Promise<ModelWorkspace> => {
    const res = await fetch(`${API_BASE}/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create model' }));
      throw new Error(err.detail || 'Failed to create model');
    }
    return res.json();
  },

  updateModel: async (modelId: string, data: { name?: string; description?: string; version?: string; modeling_tool?: 'archi' | 'drawio'; stencil_style?: 'standard' | 'modern' }): Promise<any> => {
    const res = await fetch(`${API_BASE}/models/${modelId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update model');
    return res.json();
  },

  seedSampleModel: async (): Promise<{ model_id: string }> => {
    const res = await fetch(`${API_BASE}/models/seed-sample`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to seed sample model');
    return res.json();
  },

  uploadArchiModel: async (file: File, modelName?: string, code?: string): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    if (modelName) formData.append('model_name', modelName);
    if (code) formData.append('code', code);

    const res = await fetch(`${API_BASE}/models/upload-archi`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to upload Archi file' }));
      throw new Error(err.detail || 'Failed to upload Archi file');
    }
    return res.json();
  },

  deleteModel: async (modelId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/models/${modelId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to delete model');
    return res.json();
  },

  // APM
  getAPMPortfolio: async (modelId: string): Promise<APMPortfolio> => {
    const res = await fetch(`${API_BASE}/apm/portfolio/${modelId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch APM portfolio');
    return res.json();
  },

  updateApplicationAPM: async (elementId: string, data: Partial<ApplicationInfo>): Promise<any> => {
    const res = await fetch(`${API_BASE}/apm/applications/${elementId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update application');
    return res.json();
  },

  getTechRiskAnalysis: async (modelId: string): Promise<TechRiskAnalysisData> => {
    const res = await fetch(`${API_BASE}/apm/tech-risk/${modelId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch Technology Risk Analysis');
    return res.json();
  },

  getTCOBreakdown: async (modelId: string): Promise<TCOBreakdownData> => {
    const res = await fetch(`${API_BASE}/apm/tco-breakdown/${modelId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch TCO Breakdown');
    return res.json();
  },

  getLifecycleAnalysis: async (modelId: string): Promise<LifecycleAnalysisData> => {
    const res = await fetch(`${API_BASE}/apm/lifecycle/${modelId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch Lifecycle Analysis');
    return res.json();
  },

  updateTechnologyLifecycle: async (elementId: string, data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/apm/technologies/${elementId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update technology lifecycle');
    return res.json();
  },

  getInterfaceInventory: async (modelId: string): Promise<InterfaceInventoryData> => {
    const res = await fetch(`${API_BASE}/apm/interfaces/${modelId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch interface inventory');
    return res.json();
  },

  updateInterfaceAttributes: async (interfaceId: string, data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/apm/interfaces/${interfaceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update interface');
    return res.json();
  },

  createInterface: async (modelId: string, data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/apm/interfaces/${modelId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create interface');
    return res.json();
  },

  // Functional Analysis
  getFunctionalAnalysis: async (modelId: string): Promise<FunctionalAnalysisData> => {
    const res = await fetch(`${API_BASE}/functional/analysis/${modelId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch Functional Analysis');
    return res.json();
  },

  // Overlap
  getOverlapMatrix: async (modelId: string): Promise<OverlapMatrixData> => {
    const res = await fetch(`${API_BASE}/overlap/matrix/${modelId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch Overlap Matrix');
    return res.json();
  },

  // Processes & Lineage
  getProcessCatalog: async (modelId: string): Promise<{ total_processes: number; processes: BusinessProcessItem[] }> => {
    const res = await fetch(`${API_BASE}/processes/catalog/${modelId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch process catalog');
    return res.json();
  },

  simulateImpact: async (
    modelId: string,
    elementId: string,
    mode: 'failure' | 'change' = 'failure',
    maxHops: number = 10
  ): Promise<ImpactSimulationResult> => {
    const url = new URL(`${window.location.origin}${API_BASE}/processes/impact/${modelId}/${elementId}`);
    url.searchParams.append('mode', mode);
    url.searchParams.append('max_hops', maxHops.toString());
    const res = await fetch(url.toString(), { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to simulate impact');
    return res.json();
  },

  getArchitecturalRisks: async (modelId: string): Promise<ArchitecturalRisksReport> => {
    const res = await fetch(`${API_BASE}/processes/risks/${modelId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch architectural risks');
    return res.json();
  },

  getDerivedRelationships: async (
    modelId: string,
    sourceId?: string,
    targetId?: string
  ): Promise<DerivedRelationshipItem[]> => {
    const url = new URL(`${window.location.origin}${API_BASE}/relationships/derived`);
    url.searchParams.append('model_id', modelId);
    if (sourceId) url.searchParams.append('source_id', sourceId);
    if (targetId) url.searchParams.append('target_id', targetId);
    const res = await fetch(url.toString(), { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch derived relationships');
    return res.json();
  },

  getPlateauRoadmap: async (modelId: string): Promise<PlateauRoadmap> => {
    const res = await fetch(`${API_BASE}/relationships/plateaus/${modelId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch plateau roadmap');
    return res.json();
  },

  // Architect Elements & Views & Relations
  getElements: async (modelId: string, layer?: string, type?: string, stereotypeId?: string, search?: string): Promise<ArchimateElementItem[]> => {
    const url = new URL(`${window.location.origin}${API_BASE}/elements`);
    url.searchParams.append('model_id', modelId);
    if (layer && layer !== 'All') url.searchParams.append('layer', layer);
    if (type && type !== 'All') url.searchParams.append('type', type);
    if (stereotypeId && stereotypeId !== 'all') url.searchParams.append('stereotype_id', stereotypeId);
    if (search && search.trim()) url.searchParams.append('search', search.trim());
    const res = await fetch(url.toString(), { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch elements');
    return res.json();
  },

  getElementsPaginated: async (
    modelId: string,
    page: number = 1,
    limit: number = 50,
    layer?: string,
    type?: string,
    stereotypeId?: string,
    search?: string
  ): Promise<PaginatedElementsResponse> => {
    const url = new URL(`${window.location.origin}${API_BASE}/elements`);
    url.searchParams.append('model_id', modelId);
    url.searchParams.append('page', String(page));
    url.searchParams.append('limit', String(limit));
    if (layer && layer !== 'All') url.searchParams.append('layer', layer);
    if (type && type !== 'All') url.searchParams.append('type', type);
    if (stereotypeId && stereotypeId !== 'all') url.searchParams.append('stereotype_id', stereotypeId);
    if (search && search.trim()) url.searchParams.append('search', search.trim());
    const res = await fetch(url.toString(), { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch paginated elements');
    return res.json();
  },

  getElementDetail: async (elementId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/elements/${elementId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch element details');
    return res.json();
  },

  createElement: async (modelId: string, data: { name: string; type: string; layer?: string; documentation?: string; properties?: Record<string, any>; stereotype_id?: string | null }): Promise<any> => {
    const res = await fetch(`${API_BASE}/elements?model_id=${encodeURIComponent(modelId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create element' }));
      throw new Error(err.detail || 'Failed to create element');
    }
    return res.json();
  },

  updateElement: async (elementId: string, data: { name?: string; type?: string; layer?: string; documentation?: string; properties?: Record<string, any>; stereotype_id?: string | null }): Promise<any> => {
    const res = await fetch(`${API_BASE}/elements/${elementId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update element' }));
      throw new Error(err.detail || 'Failed to update element');
    }
    return res.json();
  },

  deleteElement: async (elementId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/elements/${elementId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to delete element');
    return res.json();
  },

  getRelationships: async (modelId: string, type?: string): Promise<ArchimateRelationshipItem[]> => {
    const url = new URL(`${window.location.origin}${API_BASE}/relationships`);
    url.searchParams.append('model_id', modelId);
    if (type) url.searchParams.append('type', type);
    const res = await fetch(url.toString(), { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch relationships');
    return res.json();
  },

  getAllowedRelationshipTypes: async (sourceType: string, targetType: string): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/relationships/allowed-types?source_type=${encodeURIComponent(sourceType)}&target_type=${encodeURIComponent(targetType)}`, {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to fetch allowed relationship types');
    return res.json();
  },

  createRelationship: async (modelId: string, data: { source_id: string; target_id: string; type: string; name?: string; documentation?: string }): Promise<any> => {
    const res = await fetch(`${API_BASE}/relationships?model_id=${encodeURIComponent(modelId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create relationship' }));
      throw new Error(err.detail || 'Failed to create relationship');
    }
    return res.json();
  },

  updateRelationship: async (relationshipId: string, data: { type?: string; name?: string; documentation?: string }): Promise<any> => {
    const res = await fetch(`${API_BASE}/relationships/${relationshipId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update relationship' }));
      throw new Error(err.detail || 'Failed to update relationship');
    }
    return res.json();
  },

  deleteRelationship: async (relationshipId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/relationships/${relationshipId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to delete relationship');
    return res.json();
  },

  getViews: async (modelId: string): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/views?model_id=${modelId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch views');
    return res.json();
  },

  getViewDetail: async (viewId: string): Promise<DiagramViewDetail> => {
    const res = await fetch(`${API_BASE}/views/${viewId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch view details');
    return res.json();
  },

  createView: async (modelId: string, data: { name: string; viewpoint?: string; documentation?: string; view_data?: any }): Promise<any> => {
    const res = await fetch(`${API_BASE}/views?model_id=${encodeURIComponent(modelId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create view' }));
      throw new Error(err.detail || 'Failed to create view');
    }
    return res.json();
  },

  updateView: async (viewId: string, data: { name?: string; viewpoint?: string; documentation?: string; view_data?: any }): Promise<any> => {
    const res = await fetch(`${API_BASE}/views/${viewId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update view' }));
      throw new Error(err.detail || 'Failed to update view');
    }
    return res.json();
  },

  deleteView: async (viewId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/views/${viewId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to delete view');
    return res.json();
  },

  getViewDrawioExportUrl: (viewId: string): string => {
    return withAuthToken(`${API_BASE}/views/${viewId}/drawio`);
  },

  getModelDrawioExportUrl: (modelId: string): string => {
    return withAuthToken(`${API_BASE}/import/drawio/export?model_id=${encodeURIComponent(modelId)}`);
  },

  getModelExchangeXmlExportUrl: (modelId: string, viewId?: string): string => {
    let url = `${API_BASE}/models/${modelId}/export/exchange-xml`;
    if (viewId) url += `?view_id=${encodeURIComponent(viewId)}`;
    return withAuthToken(url);
  },

  getViewExchangeXmlExportUrl: (viewId: string): string => {
    return withAuthToken(`${API_BASE}/views/${viewId}/export/exchange-xml`);
  },

  getModelArchimateExportUrl: (modelId: string, viewId?: string): string => {
    let url = `${API_BASE}/models/${modelId}/export/archimate`;
    if (viewId) url += `?view_id=${encodeURIComponent(viewId)}`;
    return withAuthToken(url);
  },

  getViewArchimateExportUrl: (viewId: string): string => {
    return withAuthToken(`${API_BASE}/views/${viewId}/export/archimate`);
  },

  downloadModelArchimate: async (modelId: string, viewId?: string, fallbackFilename?: string): Promise<void> => {
    let url = `${API_BASE}/models/${modelId}/export/archimate`;
    if (viewId) url += `?view_id=${encodeURIComponent(viewId)}`;
    const res = await fetch(url, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to export .archimate model');
    const disposition = res.headers.get('content-disposition');
    let filename = fallbackFilename || 'model.archimate';
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  },

  downloadViewArchimate: async (viewId: string, fallbackFilename?: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/views/${viewId}/export/archimate`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to export diagram view in .archimate format');
    const disposition = res.headers.get('content-disposition');
    let filename = fallbackFilename || 'diagram_view.archimate';
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  },

  downloadModelExchangeXml: async (modelId: string, viewId?: string, fallbackFilename?: string): Promise<void> => {
    let url = `${API_BASE}/models/${modelId}/export/exchange-xml`;
    if (viewId) url += `?view_id=${encodeURIComponent(viewId)}`;
    const res = await fetch(url, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to export Open Exchange XML');
    const disposition = res.headers.get('content-disposition');
    let filename = fallbackFilename || 'archimate_model_exchange.xml';
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  },

  downloadViewExchangeXml: async (viewId: string, fallbackFilename?: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/views/${viewId}/export/exchange-xml`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to export diagram view Open Exchange XML');
    const disposition = res.headers.get('content-disposition');
    let filename = fallbackFilename || 'diagram_view_exchange.xml';
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  },

  importDrawioFile: async (modelId: string, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/import/drawio?model_id=${encodeURIComponent(modelId)}`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to import Draw.io file' }));
      throw new Error(err.detail || 'Failed to import Draw.io file');
    }
    return res.json();
  },

  // Metamodel
  getMetamodelTypes: async (modelId?: string): Promise<any[]> => {
    const url = modelId && modelId !== 'all' ? `${API_BASE}/metamodel/types?model_id=${encodeURIComponent(modelId)}` : `${API_BASE}/metamodel/types`;
    const res = await fetch(url, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch metamodel types');
    return res.json();
  },

  getMetamodelRelationshipsMatrix: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/relationships-matrix`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch metamodel relationships matrix');
    return res.json();
  },

  getCustomAttributes: async (elementType?: string, modelId?: string): Promise<any[]> => {
    const url = new URL(`${window.location.origin}${API_BASE}/metamodel/attributes`);
    if (elementType) url.searchParams.append('element_type', elementType);
    if (modelId && modelId !== 'all') url.searchParams.append('model_id', modelId);
    const res = await fetch(url.toString(), { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch custom attributes');
    return res.json();
  },

  createCustomAttribute: async (data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/attributes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create custom attribute' }));
      throw new Error(err.detail || 'Failed to create custom attribute');
    }
    return res.json();
  },

  updateCustomAttribute: async (attrId: string, data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/attributes/${attrId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update custom attribute' }));
      throw new Error(err.detail || 'Failed to update custom attribute');
    }
    return res.json();
  },

  renameCustomAttributeSection: async (data: { old_section: string; new_section: string; model_id?: string; element_type?: string }): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/sections/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to rename section' }));
      throw new Error(err.detail || 'Failed to rename section');
    }
    return res.json();
  },

  deleteCustomAttribute: async (attrId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/attributes/${attrId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to delete custom attribute');
    return res.json();
  },

  // Attribute Packages
  getAttributePackages: async (modelId?: string): Promise<any[]> => {
    const url = modelId && modelId !== 'all' && modelId !== 'global'
      ? `${API_BASE}/metamodel/packages?model_id=${encodeURIComponent(modelId)}`
      : `${API_BASE}/metamodel/packages`;
    const res = await fetch(url, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch attribute packages');
    return res.json();
  },

  getAttributePackage: async (packageId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/packages/${packageId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch attribute package details');
    return res.json();
  },

  createAttributePackage: async (data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create attribute package' }));
      const msg = typeof err.detail === 'string' ? err.detail : err.detail?.message || 'Failed to create attribute package';
      throw new Error(msg);
    }
    return res.json();
  },

  updateAttributePackage: async (packageId: string, data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/packages/${packageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update attribute package' }));
      const msg = typeof err.detail === 'string' ? err.detail : err.detail?.message || 'Failed to update attribute package';
      throw new Error(msg);
    }
    return res.json();
  },

  deleteAttributePackage: async (packageId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/packages/${packageId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to delete attribute package' }));
      const msg = typeof err.detail === 'string' ? err.detail : err.detail?.message || 'Failed to delete attribute package';
      throw new Error(msg);
    }
    return res.json();
  },

  createPackageItem: async (packageId: string, data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/packages/${packageId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to add attribute to package' }));
      const msg = typeof err.detail === 'string' ? err.detail : err.detail?.message || 'Failed to add attribute to package';
      throw new Error(msg);
    }
    return res.json();
  },

  updatePackageItem: async (packageId: string, itemId: string, data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/packages/${packageId}/items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update package attribute' }));
      const msg = typeof err.detail === 'string' ? err.detail : err.detail?.message || 'Failed to update package attribute';
      throw new Error(msg);
    }
    return res.json();
  },

  deletePackageItem: async (packageId: string, itemId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/packages/${packageId}/items/${itemId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to delete package attribute' }));
      const msg = typeof err.detail === 'string' ? err.detail : err.detail?.message || 'Failed to delete package attribute';
      throw new Error(msg);
    }
    return res.json();
  },

  toggleLibraryPackage: async (modelId: string, packageId: string, active?: boolean): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/libraries/${modelId}/packages/${packageId}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(active !== undefined ? { active } : {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to toggle package' }));
      const errorObj = typeof err.detail === 'object' ? err.detail : { message: err.detail || 'Failed to toggle package' };
      const e = new Error(errorObj.message || 'Operazione fallita');
      (e as any).data = errorObj;
      throw e;
    }
    return res.json();
  },

  getPackageUsageAudit: async (packageId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/packages/${packageId}/usage`, {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fetch package audit' }));
      throw new Error(err.detail || 'Failed to fetch package audit');
    }
    return res.json();
  },

  // Package Manager (.eap Bundle)
  inspectPackageBundle: async (file: File): Promise<PackageInspectResult> => {
    const formData = new FormData();
    formData.append('bundle', file);
    const res = await fetch(`${API_BASE}/metamodel/packages/inspect`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Errore nell\'ispezione del pacchetto' }));
      throw new Error(err.detail || 'Errore nell\'ispezione del pacchetto');
    }
    return res.json();
  },

  installPackageBundle: async (file: File, force: boolean = false): Promise<any> => {
    const formData = new FormData();
    formData.append('bundle', file);
    const res = await fetch(`${API_BASE}/metamodel/packages/install?force=${force}`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Errore nell\'installazione del pacchetto' }));
      throw new Error(err.detail || 'Errore nell\'installazione del pacchetto');
    }
    return res.json();
  },

  exportPackageBundle: async (packageId: string, filename?: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/metamodel/packages/${packageId}/export`, {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Errore nell\'esportazione del pacchetto' }));
      throw new Error(err.detail || 'Errore nell\'esportazione del pacchetto');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition');
    let outName = filename;
    if (!outName && disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) outName = match[1];
    }
    if (!outName) outName = `${packageId}.eap`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // External Package Repository / Marketplace
  getRepositoryPackages: async (customUrl?: string): Promise<{
    registry_name: string;
    registry_version: string;
    description?: string;
    source_type: string;
    configured_url: string;
    total: number;
    packages: any[];
  }> => {
    const url = customUrl
      ? `${API_BASE}/metamodel/packages/repository?url=${encodeURIComponent(customUrl)}`
      : `${API_BASE}/metamodel/packages/repository`;
    const res = await fetch(url, { headers: { ...getAuthHeaders() } });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fetch repository packages' }));
      throw new Error(err.detail || 'Failed to fetch repository packages');
    }
    return res.json();
  },

  installPackageFromRepository: async (packageIdOrCode: string, force: boolean = false): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/packages/repository/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ package_id_or_code: packageIdOrCode, force }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Errore durante l\'installazione dal repository' }));
      throw new Error(err.detail || 'Errore durante l\'installazione dal repository');
    }
    return res.json();
  },

  getRepositoryConfig: async (): Promise<{ configured_url: string; is_default: boolean; source: string }> => {
    const res = await fetch(`${API_BASE}/metamodel/packages/repository/config`, {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fetch repository config' }));
      throw new Error(err.detail || 'Failed to fetch repository config');
    }
    return res.json();
  },

  updateRepositoryConfig: async (newUrl?: string): Promise<{ status: string; message: string; configured_url: string }> => {
    const res = await fetch(`${API_BASE}/metamodel/packages/repository/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ url: newUrl || null }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update repository config' }));
      throw new Error(err.detail || 'Failed to update repository config');
    }
    return res.json();
  },

  testRepositoryConnection: async (url: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/packages/repository/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Test connessione repository fallito' }));
      throw new Error(err.detail || 'Test connessione repository fallito');
    }
    return res.json();
  },

  // Package Business Views (Framework Insights)
  getPackageViews: async (modelId: string): Promise<{ packages: PackageWithViews[] }> => {
    const res = await fetch(`${API_BASE}/business/package-views?model_id=${encodeURIComponent(modelId)}`, {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Errore nel caricamento delle viste dei pacchetti');
    return res.json();
  },

  executePackageView: async (
    viewId: string,
    modelId: string,
    payload: { search?: string; filters?: Record<string, any>; sort_field?: string; sort_direction?: string } = {}
  ): Promise<PackageViewExecuteResponse> => {
    const res = await fetch(`${API_BASE}/business/package-views/${encodeURIComponent(viewId)}/execute?model_id=${encodeURIComponent(modelId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Errore nell\'esecuzione della vista' }));
      throw new Error(err.detail || 'Errore nell\'esecuzione della vista');
    }
    return res.json();
  },

  // Custom Business Views (Architecture Hub -> Business Views)
  previewCustomBusinessView: async (modelId: string, payload: any): Promise<PackageViewExecuteResponse> => {
    const res = await fetch(`${API_BASE}/business/package-views/preview?model_id=${encodeURIComponent(modelId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Errore nell\'anteprima della vista' }));
      throw new Error(err.detail || 'Errore nell\'anteprima della vista');
    }
    return res.json();
  },

  getCustomBusinessViews: async (modelId: string): Promise<{ views: any[] }> => {
    const res = await fetch(`${API_BASE}/business/package-views/custom?model_id=${encodeURIComponent(modelId)}`, {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Errore nel caricamento delle viste business personalizzate');
    return res.json();
  },

  createCustomBusinessView: async (modelId: string, payload: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/business/package-views/custom?model_id=${encodeURIComponent(modelId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Errore nella creazione della vista' }));
      throw new Error(err.detail || 'Errore nella creazione della vista');
    }
    return res.json();
  },

  updateCustomBusinessView: async (viewId: string, payload: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/business/package-views/custom/${encodeURIComponent(viewId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Errore nell\'aggiornamento della vista' }));
      throw new Error(err.detail || 'Errore nell\'aggiornamento della vista');
    }
    return res.json();
  },

  toggleCustomViewStatus: async (viewId: string, isActive: boolean): Promise<any> => {
    const res = await fetch(`${API_BASE}/business/package-views/custom/${encodeURIComponent(viewId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ is_active: isActive }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Errore nell\'aggiornamento dello stato della vista' }));
      throw new Error(err.detail || 'Errore nell\'aggiornamento dello stato della vista');
    }
    return res.json();
  },

  deleteCustomBusinessView: async (viewId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/business/package-views/custom/${encodeURIComponent(viewId)}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Errore nell\'eliminazione della vista' }));
      throw new Error(err.detail || 'Errore nell\'eliminazione della vista');
    }
    return res.json();
  },

  updatePackageViewTargetHub: async (viewId: string, targetHub: 'business' | 'architecture' | 'both'): Promise<{ status: string; id: string; target_hub: string }> => {
    const res = await fetch(`${API_BASE}/business/package-views/${encodeURIComponent(viewId)}/target-hub`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ target_hub: targetHub }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Errore nell\'aggiornamento del target hub della vista' }));
      throw new Error(err.detail || 'Errore nell\'aggiornamento del target hub della vista');
    }
    return res.json();
  },

  // Stereotypes & Profiles
  getStereotypes: async (baseType?: string, modelId?: string): Promise<any[]> => {
    const params = new URLSearchParams();
    if (baseType && baseType !== '*') params.append('base_type', baseType);
    if (modelId && modelId !== 'all') params.append('model_id', modelId);
    const queryString = params.toString();
    const url = queryString ? `${API_BASE}/metamodel/stereotypes?${queryString}` : `${API_BASE}/metamodel/stereotypes`;
    const res = await fetch(url, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch stereotypes');
    return res.json();
  },

  getStereotype: async (stereotypeId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/stereotypes/${stereotypeId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch stereotype details');
    return res.json();
  },

  createStereotype: async (data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/stereotypes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create stereotype' }));
      throw new Error(err.detail || 'Failed to create stereotype');
    }
    return res.json();
  },

  updateStereotype: async (stereotypeId: string, data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/stereotypes/${stereotypeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update stereotype' }));
      throw new Error(err.detail || 'Failed to update stereotype');
    }
    return res.json();
  },

  deleteStereotype: async (stereotypeId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/stereotypes/${stereotypeId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to delete stereotype' }));
      throw new Error(err.detail || 'Failed to delete stereotype');
    }
    return res.json();
  },

  linkAttributeToStereotype: async (stereotypeId: string, data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/stereotypes/${stereotypeId}/attributes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to link attribute to stereotype' }));
      throw new Error(err.detail || 'Failed to link attribute to stereotype');
    }
    return res.json();
  },

  unlinkAttributeFromStereotype: async (stereotypeId: string, linkId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/metamodel/stereotypes/${stereotypeId}/attributes/${linkId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to unlink attribute from stereotype' }));
      throw new Error(err.detail || 'Failed to unlink attribute from stereotype');
    }
    return res.json();
  },

  // RBAC
  getRolesMetadata: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/rbac/roles`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch RBAC roles metadata');
    return res.json();
  },

  getUsers: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/rbac/users`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  createUser: async (data: { email: string; full_name: string; username?: string; password?: string }): Promise<any> => {
    const res = await fetch(`${API_BASE}/rbac/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create user' }));
      throw new Error(err.detail || 'Failed to create user');
    }
    return res.json();
  },

  resetUserPassword: async (userId: string, newPassword: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/rbac/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ new_password: newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to reset password' }));
      throw new Error(err.detail || 'Failed to reset password');
    }
    return res.json();
  },

  assignRole: async (data: { user_id: string; role: string; model_id?: string | null }): Promise<any> => {
    const res = await fetch(`${API_BASE}/rbac/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to assign role' }));
      throw new Error(err.detail || 'Failed to assign role');
    }
    return res.json();
  },

  deleteRoleAssignment: async (assignmentId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/rbac/assignments/${assignmentId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to delete role assignment');
    return res.json();
  },

  checkPermission: async (data: { user_id: string; action: string; target_model_id?: string }): Promise<any> => {
    const res = await fetch(`${API_BASE}/rbac/check-permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to check permission');
    return res.json();
  },

  // Authentication
  login: async (credentials: { username: string; password: string; totp_code?: string }): Promise<any> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Invalid credentials' }));
      throw new Error(err.detail || 'Invalid username or password');
    }
    return res.json();
  },

  loginMfa: async (payload: { mfa_token: string; totp_code: string }): Promise<any> => {
    const res = await fetch(`${API_BASE}/auth/login/mfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Verifica MFA fallita' }));
      throw new Error(err.detail || 'Codice TOTP non valido o scaduto');
    }
    return res.json();
  },

  getMfaStatus: async (): Promise<MfaStatus> => {
    const res = await fetch(`${API_BASE}/auth/mfa/status`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Impossibile recuperare lo stato 2FA' }));
      throw new Error(err.detail || 'Errore nel recupero dello stato 2FA');
    }
    return res.json();
  },

  setupMfa: async (): Promise<MfaSetupResponse> => {
    const res = await fetch(`${API_BASE}/auth/mfa/setup`, {
      method: 'POST',
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Impossibile avviare il setup 2FA' }));
      throw new Error(err.detail || 'Errore durante la configurazione 2FA');
    }
    return res.json();
  },

  enableMfa: async (payload: { secret: string; totp_code: string }): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE}/auth/mfa/enable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Attivazione 2FA non riuscita' }));
      throw new Error(err.detail || 'Codice di verifica 2FA errato');
    }
    return res.json();
  },

  disableMfa: async (payload: { password: string }): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE}/auth/mfa/disable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Disattivazione 2FA non riuscita' }));
      throw new Error(err.detail || 'Impossibile disattivare 2FA');
    }
    return res.json();
  },

  getCurrentUser: async (token: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) {
      throw new Error('Failed to fetch current user session');
    }
    return res.json();
  },

  logout: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      }
    });
    return res.json();
  },

  getOidcConfig: async (): Promise<{
    enabled: boolean;
    provider_name: string;
    issuer_url: string;
    login_url: string;
    rbac_mode: string;
    allow_local_login?: boolean;
    allow_idp_login?: boolean;
    show_demo_banner?: boolean;
    demo_banner_message?: string;
    demo_username?: string;
    demo_password?: string;
    demo_mode?: boolean;
  }> => {
    const res = await fetch(`${API_BASE}/auth/oidc/config`);
    if (!res.ok) throw new Error('Failed to fetch OIDC configuration');
    return res.json();
  },

  getAdminAuthConfig: async (): Promise<SystemAuthSettings> => {
    const res = await fetch(`${API_BASE}/auth/admin/config`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fetch auth configuration' }));
      throw new Error(err.detail || 'Failed to fetch auth configuration');
    }
    return res.json();
  },

  updateAdminAuthConfig: async (payload: Partial<SystemAuthSettings>): Promise<{ status: string; message: string; config: SystemAuthSettings }> => {
    const res = await fetch(`${API_BASE}/auth/admin/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update auth configuration' }));
      throw new Error(err.detail || 'Failed to update auth configuration');
    }
    return res.json();
  },

  testIdpConnection: async (issuerUrl: string): Promise<IdpConnectionTestResult> => {
    const res = await fetch(`${API_BASE}/auth/admin/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ issuer_url: issuerUrl })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to test IdP connection' }));
      throw new Error(err.detail || 'Failed to test IdP connection');
    }
    return res.json();
  },

  // API Keys & MCP Agent Access
  getApiKeys: async (): Promise<ApiKeyItem[]> => {
    const res = await fetch(`${API_BASE}/api-keys`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fetch API keys' }));
      throw new Error(err.detail || 'Failed to fetch API keys');
    }
    return res.json();
  },

  createApiKey: async (payload: { name: string; expires_in_days?: number | null; user_id?: string | null }): Promise<ApiKeyCreatedResponse> => {
    const res = await fetch(`${API_BASE}/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create API key' }));
      throw new Error(err.detail || 'Failed to create API key');
    }
    return res.json();
  },

  revokeApiKey: async (keyId: string): Promise<{ message: string; id: string }> => {
    const res = await fetch(`${API_BASE}/api-keys/${encodeURIComponent(keyId)}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to revoke API key' }));
      throw new Error(err.detail || 'Failed to revoke API key');
    }
    return res.json();
  },

  // Data Import & History
  getImportTemplateUrl: (modelId?: string, format: string = 'xlsx'): string => {
    return withAuthToken(`${API_BASE}/import/template?format=${encodeURIComponent(format)}${modelId ? `&model_id=${encodeURIComponent(modelId)}` : ''}`);
  },

  uploadImportFile: async (
    modelId: string,
    file: File,
    dryRun: boolean = false,
    updateExisting: boolean = true,
    userName: string = 'Architect'
  ): Promise<ImportPreviewResult> => {
    const formData = new FormData();
    formData.append('model_id', modelId);
    formData.append('file', file);
    formData.append('dry_run', dryRun ? 'true' : 'false');
    formData.append('update_existing', updateExisting ? 'true' : 'false');
    formData.append('user_name', userName);

    const res = await fetch(`${API_BASE}/import/upload`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to upload or parse import file' }));
      throw new Error(err.detail || 'Failed to upload or parse import file');
    }
    return res.json();
  },

  getImportHistory: async (modelId?: string): Promise<ImportHistoryItem[]> => {
    const url = new URL(`${window.location.origin}${API_BASE}/import/history`);
    if (modelId) url.searchParams.append('model_id', modelId);
    const res = await fetch(url.toString(), { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch import history');
    return res.json();
  },

  getImportHistoryDetail: async (historyId: string): Promise<ImportHistoryItem> => {
    const res = await fetch(`${API_BASE}/import/history/${historyId}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch import history details');
    return res.json();
  },

  deleteImportHistory: async (historyId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/import/history/${historyId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to delete import history entry');
    return res.json();
  },

  // Schema Repository & Checkin/Checkout
  getSchemaFolders: async (modelId: string): Promise<SchemaFolder[]> => {
    const res = await fetch(`${API_BASE}/schemas/${modelId}/folders`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) throw new Error('Failed to fetch schema folders');
    return res.json();
  },

  createSchemaFolder: async (modelId: string, data: { name: string; parent_id?: string | null; order_index?: number }): Promise<SchemaFolder> => {
    const res = await fetch(`${API_BASE}/schemas/${modelId}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create folder' }));
      throw new Error(err.detail || 'Failed to create folder');
    }
    return res.json();
  },

  updateSchemaFolder: async (folderId: string, data: { name?: string; parent_id?: string | null; order_index?: number }): Promise<any> => {
    const res = await fetch(`${API_BASE}/schemas/folders/${folderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update folder');
    return res.json();
  },

  deleteSchemaFolder: async (folderId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/schemas/folders/${folderId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) throw new Error('Failed to delete folder');
    return res.json();
  },

  getSchemas: async (modelId: string, folderId?: string | null, status?: string): Promise<ArchiSchema[]> => {
    const url = new URL(`${window.location.origin}${API_BASE}/schemas/${modelId}/list`);
    if (folderId !== undefined && folderId !== null) {
      url.searchParams.append('folder_id', folderId);
    }
    if (status) {
      url.searchParams.append('status', status);
    }
    const res = await fetch(url.toString(), {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) throw new Error('Failed to fetch schemas');
    return res.json();
  },

  getSchemaDetail: async (schemaId: string): Promise<ArchiSchema> => {
    const res = await fetch(`${API_BASE}/schemas/${schemaId}/detail`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) throw new Error('Failed to fetch schema details');
    return res.json();
  },

  createSchema: async (modelId: string, data: {
    name: string;
    folder_id?: string | null;
    viewpoint?: string;
    documentation?: string;
    view_data?: any;
    raw_xml?: string;
  }): Promise<ArchiSchema> => {
    const res = await fetch(`${API_BASE}/schemas/${modelId}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create schema' }));
      throw new Error(err.detail || 'Failed to create schema');
    }
    return res.json();
  },

  importSchemaFile: async (modelId: string, file: File, folderId?: string | null, schemaName?: string): Promise<ArchiSchema> => {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folder_id', folderId);
    if (schemaName) formData.append('schema_name', schemaName);

    const res = await fetch(`${API_BASE}/schemas/${modelId}/import-file`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to import schema file' }));
      throw new Error(err.detail || 'Failed to import schema file');
    }
    return res.json();
  },

  updateSchema: async (schemaId: string, data: { name?: string; folder_id?: string | null; viewpoint?: string; documentation?: string }): Promise<ArchiSchema> => {
    const res = await fetch(`${API_BASE}/schemas/${schemaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update schema');
    return res.json();
  },

  moveSchema: async (schemaId: string, folderId: string | null): Promise<ArchiSchema> => {
    const res = await fetch(`${API_BASE}/schemas/${schemaId}/move`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ folder_id: folderId })
    });
    if (!res.ok) throw new Error('Failed to move schema');
    return res.json();
  },

  deleteSchema: async (schemaId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/schemas/${schemaId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to delete schema' }));
      throw new Error(err.detail || 'Failed to delete schema');
    }
    return res.json();
  },

  checkoutSchema: async (schemaId: string): Promise<{ schema: ArchiSchema; filename: string; xml_content: string }> => {
    const timestamp = Date.now();
    const res = await fetch(`${API_BASE}/schemas/${schemaId}/checkout?_t=${timestamp}`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        ...getAuthHeaders()
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to checkout schema' }));
      throw new Error(err.detail || 'Failed to checkout schema');
    }
    return res.json();
  },

  downloadSchemaXmlUrl: (schemaId: string): string => {
    return withAuthToken(`${API_BASE}/schemas/${schemaId}/download?_t=${Date.now()}`);
  },

  getDrawioConfig: async (): Promise<{ local_url: string; cloud_url: string; default_mode: string }> => {
    try {
      const res = await fetch(`${API_BASE}/schemas/drawio/config`, {
        cache: 'no-store',
        headers: { ...getAuthHeaders() }
      });
      if (res.ok) return res.json();
    } catch (e) {}
    return {
      local_url: 'http://localhost:8080',
      cloud_url: 'https://embed.diagrams.net',
      default_mode: 'local'
    };
  },

  getSchemaXml: async (schemaId: string): Promise<string> => {
    const timestamp = Date.now();
    const res = await fetch(`${API_BASE}/schemas/${schemaId}/xml?_t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        ...getAuthHeaders()
      }
    });
    if (!res.ok) {
      // Fallback to /download endpoint
      const fallbackRes = await fetch(`${API_BASE}/schemas/${schemaId}/download?_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          ...getAuthHeaders()
        }
      });
      if (!fallbackRes.ok) throw new Error('Impossibile scaricare il contenuto XML dello schema');
      return fallbackRes.text();
    }
    return res.text();
  },

  discardCheckout: async (schemaId: string): Promise<{ success: boolean; message: string; schema: ArchiSchema }> => {
    const res = await fetch(`${API_BASE}/schemas/${schemaId}/discard-checkout`, {
      method: 'POST',
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to discard checkout' }));
      throw new Error(err.detail || 'Failed to discard checkout');
    }
    return res.json();
  },

  forcedUnlock: async (schemaId: string): Promise<{ success: boolean; message: string; schema: ArchiSchema }> => {
    const res = await fetch(`${API_BASE}/schemas/${schemaId}/forced-unlock`, {
      method: 'POST',
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to unlock schema' }));
      throw new Error(err.detail || 'Failed to unlock schema');
    }
    return res.json();
  },

  checkinDiff: async (schemaId: string, file: File): Promise<SchemaDiffResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/schemas/${schemaId}/checkin-diff`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to compute diff' }));
      throw new Error(err.detail || 'Failed to compute diff');
    }
    return res.json();
  },

  checkinConfirm: async (schemaId: string, payload: {
    file_content?: string;
    commit_message?: string;
    attribute_resolutions?: any[];
    catalog_removals?: any[];
    new_elements?: any[];
    new_relationships?: any[];
  }): Promise<{ success: boolean; message: string; schema: ArchiSchema }> => {
    const res = await fetch(`${API_BASE}/schemas/${schemaId}/checkin-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to confirm check-in' }));
      throw new Error(err.detail || 'Failed to confirm check-in');
    }
    return res.json();
  },

  getSchemaVersions: async (schemaId: string): Promise<SchemaVersionHistory[]> => {
    const res = await fetch(`${API_BASE}/schemas/${schemaId}/versions`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) throw new Error('Failed to fetch schema versions');
    return res.json();
  },

  downloadVersionXmlUrl: (schemaId: string, versionId: string): string => {
    return withAuthToken(`${API_BASE}/schemas/${schemaId}/versions/${versionId}/download`);
  },

  rollbackSchemaVersion: async (schemaId: string, versionId: string): Promise<{ success: boolean; message: string; schema: ArchiSchema }> => {
    const res = await fetch(`${API_BASE}/schemas/${schemaId}/versions/${versionId}/rollback`, {
      method: 'POST',
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to rollback schema version' }));
      throw new Error(err.detail || 'Failed to rollback schema version');
    }
    return res.json();
  },

  downloadArchiPluginUrl: (): string => {
    return withAuthToken(`${API_BASE}/plugin/download`);
  },

  getSchemaSaC: async (schemaId: string): Promise<{ success: boolean; schema_id: string; schema_name: string; code: string }> => {
    const res = await fetch(`${API_BASE}/schemas/${schemaId}/sac`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fetch Schema-as-Code' }));
      throw new Error(err.detail || 'Failed to fetch Schema-as-Code');
    }
    return res.json();
  },

  compileSaC: async (code: string, modelId?: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/schemas/sac/compile`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, model_id: modelId })
    });
    return res.json();
  },

  updateSchemaFromSaC: async (schemaId: string, code: string, commitMessage?: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/schemas/${schemaId}/sac`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, commit_message: commitMessage })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update schema from SaC' }));
      throw new Error(err.detail || 'Failed to update schema from SaC');
    }
    return res.json();
  },

  createSchemaFromSaC: async (code: string, modelId: string, folderId?: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/schemas/sac/create`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, model_id: modelId, folder_id: folderId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create schema from SaC' }));
      throw new Error(err.detail || 'Failed to create schema from SaC');
    }
    return res.json();
  },

  downloadSchemaSacUrl: (schemaId: string): string => {
    return withAuthToken(`${API_BASE}/schemas/${schemaId}/sac?download=true`);
  },

  downloadSacAsArchimate: async (code: string, modelId?: string): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/schemas/sac/to-archimate`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, model_id: modelId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to convert SaC to ArchiMate' }));
      throw new Error(err.detail || 'Failed to convert SaC to ArchiMate');
    }
    return res.blob();
  },

  downloadCamundaPluginUrl: (): string => {
    return withAuthToken(`${API_BASE}/plugin/camunda/download`);
  },

  downloadDrawioPluginUrl: (): string => {
    return withAuthToken(`${API_BASE}/plugin/drawio/download`);
  },

  downloadDrawioPaletteUrl: (): string => {
    return withAuthToken(`${API_BASE}/schemas/drawio/palette`);
  },

  // ========================================================
  // Architecture Decision Records (ADR)
  // ========================================================
  getADRs: async (
    modelId: string,
    params?: { status?: string; domain?: string; element_id?: string; search?: string }
  ): Promise<any> => {
    const url = new URL(`${window.location.origin}${API_BASE}/adrs`);
    url.searchParams.append('model_id', modelId);
    if (params?.status && params.status !== 'All') url.searchParams.append('status', params.status);
    if (params?.domain && params.domain !== 'All') url.searchParams.append('domain', params.domain);
    if (params?.element_id) url.searchParams.append('element_id', params.element_id);
    if (params?.search) url.searchParams.append('search', params.search);
    const res = await fetch(url.toString(), { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch ADRs');
    return res.json();
  },

  getADRDetail: async (adrId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/adrs/${encodeURIComponent(adrId)}`, {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to fetch ADR detail');
    return res.json();
  },

  createADR: async (modelId: string, payload: Record<string, any>): Promise<any> => {
    const res = await fetch(`${API_BASE}/adrs?model_id=${encodeURIComponent(modelId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create ADR' }));
      throw new Error(err.detail || 'Failed to create ADR');
    }
    return res.json();
  },

  updateADR: async (adrId: string, payload: Record<string, any>): Promise<any> => {
    const res = await fetch(`${API_BASE}/adrs/${encodeURIComponent(adrId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update ADR' }));
      throw new Error(err.detail || 'Failed to update ADR');
    }
    return res.json();
  },

  transitionADR: async (
    adrId: string,
    payload: { status: string; superseded_by_id?: string; deciders?: string }
  ): Promise<any> => {
    const res = await fetch(`${API_BASE}/adrs/${encodeURIComponent(adrId)}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to transition ADR status' }));
      throw new Error(err.detail || 'Failed to transition ADR status');
    }
    return res.json();
  },

  deleteADR: async (adrId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/adrs/${encodeURIComponent(adrId)}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to delete ADR' }));
      throw new Error(err.detail || 'Failed to delete ADR');
    }
    return res.json();
  },

  exportADRMarkdown: async (adrId: string): Promise<{ id: string; code: string; filename: string; markdown: string }> => {
    const res = await fetch(`${API_BASE}/adrs/${encodeURIComponent(adrId)}/export-md`, {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to export ADR Markdown');
    return res.json();
  },

  downloadSingleADRMarkdownUrl: (adrId: string): string => {
    return withAuthToken(`${API_BASE}/adrs/${encodeURIComponent(adrId)}/export-md?download=true`);
  },

  downloadAllADRsMarkdownUrl: (modelId: string): string => {
    return withAuthToken(`${API_BASE}/adrs/export-all?model_id=${encodeURIComponent(modelId)}&download=true`);
  },

  // ========================================================
  // Operational Resilience & SLA (DORA)
  // ========================================================
  getResilienceAnalysis: async (modelId: string): Promise<ResilienceAnalysisResult> => {
    const res = await fetch(`${API_BASE}/resilience/analysis/${encodeURIComponent(modelId)}`, {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to fetch operational resilience analysis');
    return res.json();
  },

  getResilienceSummary: async (modelId: string): Promise<{ model_id: string; metrics: ResilienceMetrics }> => {
    const res = await fetch(`${API_BASE}/resilience/summary/${encodeURIComponent(modelId)}`, {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to fetch resilience summary');
    return res.json();
  },

  // ========================================================
  // As-Is vs To-Be Gap Analysis
  // ========================================================
  getGapAnalysis: async (modelId: string, compareModelId?: string): Promise<GapAnalysisResult> => {
    let url = `${API_BASE}/gap-analysis/${encodeURIComponent(modelId)}`;
    if (compareModelId) url += `?compare_model_id=${encodeURIComponent(compareModelId)}`;
    const res = await fetch(url, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch Gap Analysis');
    return res.json();
  },

  getGapAnalysisSummary: async (modelId: string, compareModelId?: string): Promise<{ model_id: string; mode: string; metrics: GapMetrics }> => {
    let url = `${API_BASE}/gap-analysis/${encodeURIComponent(modelId)}/summary`;
    if (compareModelId) url += `?compare_model_id=${encodeURIComponent(compareModelId)}`;
    const res = await fetch(url, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch Gap Analysis summary');
    return res.json();
  },

  // ========================================================
  // Security Audit Trail (Tamper-Evident Logs)
  // ========================================================
  getAuditLogs: async (params?: {
    page?: number;
    size?: number;
    action?: string;
    outcome?: string;
    search?: string;
  }): Promise<{ items: SecurityAuditItem[]; total: number; page: number; size: number; pages: number }> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.size) searchParams.set('size', params.size.toString());
    if (params?.action) searchParams.set('action', params.action);
    if (params?.outcome) searchParams.set('outcome', params.outcome);
    if (params?.search) searchParams.set('search', params.search);

    const qs = searchParams.toString();
    const url = `${API_BASE}/admin/audit-logs${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers: { ...getAuthHeaders() } });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Impossibile recuperare i log di audit' }));
      throw new Error(err.detail || 'Errore nel recupero degli audit log');
    }
    return res.json();
  },

  verifyAuditTrail: async (): Promise<AuditVerificationResult> => {
    const res = await fetch(`${API_BASE}/admin/audit-logs/verify`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Verifica crittografica non riuscita' }));
      throw new Error(err.detail || 'Errore durante la verifica della catena audit');
    }
    return res.json();
  },

  getAuditSummary: async (): Promise<AuditSummary> => {
    const res = await fetch(`${API_BASE}/admin/audit-logs/summary`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Impossibile recuperare il riepilogo audit' }));
      throw new Error(err.detail || 'Errore durante il recupero delle metriche audit');
    }
    return res.json();
  },
};

export interface ImportHistoryItem {
  id: string;
  model_id: string;
  filename: string;
  file_format: string;
  file_size_bytes: number;
  user_name: string;
  status: 'success' | 'partial_success' | 'failed';
  elements_created: number;
  elements_updated: number;
  relationships_created: number;
  views_count?: number;
  views_imported?: number;
  errors_count: number;
  warnings_count: number;
  imported_at: string;
  details?: {
    errors?: Array<{ type?: string; row?: number; message?: string; source?: string; target?: string }>;
    warnings?: Array<{ type?: string; row?: number; message?: string; element_name?: string }>;
    created_elements?: Array<{ id: string; name: string; type: string }>;
    updated_elements?: Array<{ id: string; name: string; type: string }>;
    created_relationships?: Array<{ source: string; target: string; type: string }>;
  };
}

export interface ImportPreviewResult {
  dry_run?: boolean;
  success?: boolean;
  import_id?: string;
  status: 'success' | 'partial_success' | 'failed';
  filename: string;
  file_format?: string;
  elements_created: number;
  elements_updated: number;
  relationships_created: number;
  views_count?: number;
  views_imported?: number;
  errors_count: number;
  warnings_count: number;
  elements?: Array<{
    id: string;
    name: string;
    type: string;
    layer: string;
    documentation?: string;
    properties?: Record<string, any>;
    is_update: boolean;
    row_num: number;
  }>;
  relationships?: Array<{
    id: string;
    source_name: string;
    source_type: string;
    target_name: string;
    target_type: string;
    type: string;
    name?: string;
    documentation?: string;
    row_num: number;
  }>;
  errors: Array<{ type?: string; row?: number; message: string; source?: string; target?: string }>;
  warnings: Array<{ type?: string; row?: number; message: string; element_name?: string }>;
}

