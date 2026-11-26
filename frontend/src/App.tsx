import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ModelWorkspace,
  MainHub,
  BusinessSubTab,
  ArchitectureSubTab,
  GovernanceSubTab,
  AdminSubTab,
  SavedFilterView,
  PackageWithViews,
  ActivePackageViewSelection
} from './types';
import { api } from './lib/api';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { UploadModal } from './components/UploadModal';
import { ExecutiveOverview } from './features/business/ExecutiveOverview';
import { FrameworkInsights } from './features/business/FrameworkInsights';
import { APMDashboard } from './features/apm/APMDashboard';
import { TechRiskRadar } from './features/apm/TechRiskRadar';
import { OverlapMatrix } from './features/overlap/OverlapMatrix';
import { FunctionalAnalysisView } from './features/functional/FunctionalAnalysisView';
import { ProcessNavigator } from './features/processes/ProcessNavigator';
import { OwnerDashboard } from './features/surveys/OwnerDashboard';
import { CampaignManagementView } from './features/surveys/CampaignManagementView';
import { ApplicationOwnershipMatrixView } from './features/surveys/ApplicationOwnershipMatrixView';
import { ArchitectRepository } from './features/architect/ArchitectRepository';
import { RelationsMatrix } from './features/architect/RelationsMatrix';
import { ADRManager } from './features/architect/ADRManager';
import { ResilienceDashboard } from './features/business/ResilienceDashboard';
import { GapAnalysisMatrix } from './features/business/GapAnalysisMatrix';
import { ArchitectSavedViews } from './features/architect/ArchitectSavedViews';
import { BusinessViewsManager } from './features/architect/BusinessViewsManager';
import { SchemaRepository } from './features/schemas/SchemaRepository';
import { DataImportHub } from './features/architect/DataImportHub';
import { AdminHub } from './features/admin/AdminHub';
import { LoginScreen } from './features/auth/LoginScreen';
import { Layers, ShieldCheck, Cpu } from 'lucide-react';
import { useLanguage } from './context/LanguageContext';
import { useAuth } from './context/AuthContext';

export function App() {
  const { t } = useLanguage();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [models, setModels] = useState<ModelWorkspace[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    return localStorage.getItem('easyea_selected_model_id') || '';
  });

  const handleSelectModel = (id: string) => {
    setSelectedModelId(id);
    if (id) {
      localStorage.setItem('easyea_selected_model_id', id);
    } else {
      localStorage.removeItem('easyea_selected_model_id');
    }
  };
  
  // 4 Hubs State with UX persistence
  const [activeHub, setActiveHubState] = useState<MainHub>(() => {
    const saved = localStorage.getItem('easyea_active_hub');
    const valid: MainHub[] = ['business', 'architecture', 'governance', 'admin'];
    return (saved && valid.includes(saved as MainHub)) ? (saved as MainHub) : 'business';
  });
  const setActiveHub = (hub: MainHub) => {
    setActiveHubState(hub);
    localStorage.setItem('easyea_active_hub', hub);
  };

  const [businessTab, setBusinessTabState] = useState<BusinessSubTab>(() => {
    const saved = localStorage.getItem('easyea_business_tab');
    const valid: BusinessSubTab[] = ['overview', 'apm', 'functional', 'processes', 'package_view', 'insights', 'overlap', 'tech_risk', 'tco'];
    return (saved && valid.includes(saved as BusinessSubTab)) ? (saved as BusinessSubTab) : 'overview';
  });
  const setBusinessTab = (tab: BusinessSubTab) => {
    setBusinessTabState(tab);
    localStorage.setItem('easyea_business_tab', tab);
  };

  const [governanceTab, setGovernanceTabState] = useState<GovernanceSubTab>(() => {
    const saved = localStorage.getItem('easyea_governance_tab');
    const valid: GovernanceSubTab[] = ['my_surveys', 'campaigns', 'ownership'];
    return (saved && valid.includes(saved as GovernanceSubTab)) ? (saved as GovernanceSubTab) : 'my_surveys';
  });
  const setGovernanceTab = (tab: GovernanceSubTab) => {
    setGovernanceTabState(tab);
    localStorage.setItem('easyea_governance_tab', tab);
  };

  const [apmTab, setApmTabState] = useState<'catalog' | 'interfaces' | 'portfolio' | 'tech_risk' | 'tco' | 'lifecycle'>(() => {
    const saved = localStorage.getItem('easyea_apm_active_tab');
    const valid = ['catalog', 'interfaces', 'portfolio', 'tech_risk', 'tco', 'lifecycle'];
    return (saved && valid.includes(saved)) ? (saved as any) : 'catalog';
  });
  const setApmTab = (tab: 'catalog' | 'interfaces' | 'portfolio' | 'tech_risk' | 'tco' | 'lifecycle') => {
    setApmTabState(tab);
    localStorage.setItem('easyea_apm_active_tab', tab);
  };

  const [architectureTab, setArchitectureTabState] = useState<ArchitectureSubTab>(() => {
    const saved = localStorage.getItem('easyea_architecture_tab');
    const valid: ArchitectureSubTab[] = ['repository', 'schemas', 'relations', 'business-views', 'import', 'package_view'];
    return (saved && valid.includes(saved as ArchitectureSubTab)) ? (saved as ArchitectureSubTab) : 'repository';
  });
  const setArchitectureTab = (tab: ArchitectureSubTab) => {
    setArchitectureTabState(tab);
    localStorage.setItem('easyea_architecture_tab', tab);
  };

  const [adminTab, setAdminTabState] = useState<AdminSubTab>(() => {
    const saved = localStorage.getItem('easyea_admin_tab');
    const valid: AdminSubTab[] = ['models', 'metamodel', 'packages', 'roles', 'auth_config', 'api_keys'];
    return (saved && valid.includes(saved as AdminSubTab)) ? (saved as AdminSubTab) : 'models';
  });
  const setAdminTab = (tab: AdminSubTab) => {
    setAdminTabState(tab);
    localStorage.setItem('easyea_admin_tab', tab);
  };

  // Role-based capabilities and default landing pages
  const userRoles = useMemo(() => new Set((user?.assignments || []).map((a) => a.role)), [user]);
  const isAdmin = userRoles.has('admin');
  const isViewer = userRoles.has('viewer');
  const isCLevelOrAdmin = isAdmin || userRoles.has('c_level');
  const isArchitectOrAdmin = isAdmin || userRoles.has('architect') || userRoles.has('lead_architect');
  const isAppOwner = userRoles.has('app_owner') || userRoles.has('process_owner') || isAdmin;
  const isBusinessUserOnly = userRoles.has('business_user') && !isCLevelOrAdmin && !isArchitectOrAdmin && !isAppOwner;

  const getDefaultHomeForUser = (currentUser: typeof user): { hub: MainHub; bTab: BusinessSubTab; gTab: GovernanceSubTab; apm: 'catalog' } => {
    if (!currentUser) {
      return { hub: 'business', bTab: 'overview', gTab: 'my_surveys', apm: 'catalog' };
    }
    const roles = new Set((currentUser.assignments || []).map((a) => a.role));
    if ((roles.has('app_owner') || roles.has('process_owner')) && !roles.has('admin') && !roles.has('architect') && !roles.has('lead_architect')) {
      return { hub: 'governance', bTab: 'overview', gTab: 'my_surveys', apm: 'catalog' };
    }
    if (roles.has('business_user') && !roles.has('admin') && !roles.has('c_level') && !roles.has('architect') && !roles.has('lead_architect')) {
      return { hub: 'business', bTab: 'processes', gTab: 'my_surveys', apm: 'catalog' };
    }
    return { hub: 'business', bTab: 'overview', gTab: 'campaigns', apm: 'catalog' };
  };

  // Always reset navigation to role homepage when a different user logs in or re-authenticates
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (user) {
      if (lastUserIdRef.current !== user.id) {
        lastUserIdRef.current = user.id;
        const home = getDefaultHomeForUser(user);
        setActiveHub(home.hub);
        setBusinessTab(home.bTab);
        setGovernanceTab(home.gTab);
        setApmTab(home.apm);
        setArchitectureTab('repository');
        setAdminTab('models');
      }
    } else {
      lastUserIdRef.current = null;
    }
  }, [user?.id]);

  // Strict role-based enforcement on active hub and tabs
  let effectiveHub: MainHub = activeHub;
  if (effectiveHub === 'admin' && !isAdmin && !isViewer) {
    effectiveHub = 'business';
  }
  if (effectiveHub === 'governance') {
    const hasGovAccess = isAdmin || isAppOwner || isArchitectOrAdmin || userRoles.has('c_level') || userRoles.has('viewer');
    if (!hasGovAccess) {
      effectiveHub = 'business';
    }
  }

  let effectiveBusinessTab: BusinessSubTab = businessTab;
  if (effectiveBusinessTab === 'overview' && isBusinessUserOnly) {
    effectiveBusinessTab = 'processes';
  }

  let effectiveGovernanceTab: GovernanceSubTab = governanceTab;
  if (effectiveGovernanceTab === 'campaigns' && !isArchitectOrAdmin && !isAdmin) {
    effectiveGovernanceTab = isAppOwner ? 'my_surveys' : 'ownership';
  } else if (effectiveGovernanceTab === 'my_surveys' && !isAppOwner && !isAdmin && !isArchitectOrAdmin) {
    effectiveGovernanceTab = 'ownership';
  }

  useEffect(() => {
    if (user) {
      if (effectiveHub !== activeHub) {
        setActiveHub(effectiveHub);
      }
      if (effectiveBusinessTab !== businessTab) {
        setBusinessTab(effectiveBusinessTab);
      }
      if (effectiveGovernanceTab !== governanceTab) {
        setGovernanceTab(effectiveGovernanceTab);
      }
    }
  }, [user, effectiveHub, activeHub, effectiveBusinessTab, businessTab, effectiveGovernanceTab, governanceTab]);
  const [selectedSavedView, setSelectedSavedView] = useState<any | null>(null);
  const [selectedAdrId, setSelectedAdrId] = useState<string | null>(null);

  // Dynamic Package Views State
  const [packagesWithViews, setPackagesWithViews] = useState<PackageWithViews[]>([]);
  const [activePackageView, setActivePackageView] = useState<ActivePackageViewSelection | null>(null);

  const loadPackageViews = async (modelId: string) => {
    if (!modelId || !isAuthenticated) {
      setPackagesWithViews([]);
      return;
    }
    try {
      const res = await api.getPackageViews(modelId);
      setPackagesWithViews(res.packages || []);
    } catch (err) {
      console.error('Failed to load package views', err);
      setPackagesWithViews([]);
    }
  };

  useEffect(() => {
    if (selectedModelId && isAuthenticated) {
      loadPackageViews(selectedModelId);
    }
  }, [selectedModelId, isAuthenticated, user?.id]);

  const handleSelectPackageView = (packageId: string, viewId: string, hub?: 'business' | 'architecture') => {
    const targetHub = hub || (activeHub === 'architecture' ? 'architecture' : 'business');
    if (targetHub === 'architecture') {
      setActiveHub('architecture');
      setArchitectureTab('package_view');
    } else {
      setActiveHub('business');
      setBusinessTab('package_view');
    }
    setActivePackageView({ packageId, viewId });
    setIsMobileSidebarOpen(false);
  };

  const activeViewObj = packagesWithViews
    .flatMap((p) => p.views || [])
    .find((v) => v.id === activePackageView?.viewId || v.view_key === activePackageView?.viewId);
  const isAdrView = activeViewObj?.view_type === 'adr_manager' || activePackageView?.viewId === 'pkv-adr-registry';
  const isResilienceView = activeViewObj?.view_type === 'resilience_dashboard' || activePackageView?.viewId === 'pview-resilience-dashboard';
  const isGapView = activeViewObj?.view_type === 'gap_matrix' || activePackageView?.viewId === 'pview-gap-analysis-matrix';

  // Sidebar Collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('easyea_sidebar_collapsed') === 'true';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('easyea_sidebar_collapsed', String(next));
      return next;
    });
  };

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadModels = async (selectId?: string) => {
    try {
      const list = await api.getModels();
      setModels(list);
      if (list.length > 0) {
        const storedModelId = localStorage.getItem('easyea_selected_model_id');
        const candidateId = selectId || storedModelId || selectedModelId;
        const validCandidate = candidateId && list.some((m) => m.id === candidateId);
        const targetModelId = validCandidate ? candidateId! : list[0].id;
        handleSelectModel(targetModelId);
        loadPackageViews(targetModelId);
      } else {
        handleSelectModel('');
        setPackagesWithViews([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadModels();
    }
  }, [isAuthenticated, user?.id]);

  const handleSeedSample = async () => {
    setIsSeeding(true);
    try {
      const res = await api.seedSampleModel();
      await loadModels(res.model_id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleUploadSuccess = async (newModelId: string) => {
    await loadModels(newModelId);
    setActiveHub('architecture');
    setArchitectureTab('repository');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold">{t.common.initializing}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold">{t.common.initializing}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* 1. Sleek TopBar: Context & User Profile with Hub Switcher */}
      <TopBar
        activeHub={effectiveHub}
        onSelectHub={(hub) => setActiveHub(hub)}
        models={models}
        selectedModelId={selectedModelId}
        onSelectModel={handleSelectModel}
        onSeedSample={handleSeedSample}
        isSeeding={isSeeding}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      {/* 2. Main Layout Container: Left Sidebar + Center Workspace */}
      <div className="flex flex-1 min-h-[calc(100vh-3.5rem)]">
        
        {/* Collapsible Left Sidebar */}
        <div className={`${isMobileSidebarOpen ? 'block fixed inset-y-0 left-0 z-50 pt-14 md:pt-0' : 'hidden'} md:flex md:static`}>
          <Sidebar
            activeHub={effectiveHub}
            businessTab={effectiveBusinessTab}
            onSelectBusinessTab={(tab) => {
              setBusinessTab(tab);
              setIsMobileSidebarOpen(false);
            }}
            apmTab={apmTab}
            onSelectApmTab={setApmTab}
            architectureTab={architectureTab}
            onSelectArchitectureTab={(tab) => {
              setArchitectureTab(tab);
              setIsMobileSidebarOpen(false);
            }}
            governanceTab={effectiveGovernanceTab}
            onSelectGovernanceTab={(tab) => {
              setGovernanceTab(tab);
              setIsMobileSidebarOpen(false);
            }}
            adminTab={adminTab}
            onSelectAdminTab={(tab) => {
              setAdminTab(tab);
              setIsMobileSidebarOpen(false);
            }}
            onOpenUpload={() => {
              setIsUploadOpen(true);
              setIsMobileSidebarOpen(false);
            }}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={toggleSidebarCollapse}
            packagesWithViews={packagesWithViews}
            activePackageView={activePackageView}
            onSelectPackageView={handleSelectPackageView}
          />
        </div>

        {/* Mobile Backdrop */}
        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 z-40 md:hidden"
          />
        )}

        {/* Center Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6">
            {selectedModelId ? (
              <>
                {/* 1. BUSINESS HUB */}
                {effectiveHub === 'business' && (
                  <>
                    {effectiveBusinessTab === 'overview' && (
                      <ExecutiveOverview
                        modelId={selectedModelId}
                        onNavigateTab={(tab) => {
                          if (tab === 'tech_risk') {
                            setBusinessTab('apm');
                            setApmTab('tech_risk');
                          } else if (tab === 'tco') {
                            setBusinessTab('apm');
                            setApmTab('tco');
                          } else {
                            setBusinessTab(tab);
                          }
                        }}
                      />
                    )}
                    {(effectiveBusinessTab === 'package_view' || effectiveBusinessTab === 'insights') && (
                      isAdrView ? (
                        <ADRManager
                          modelId={selectedModelId}
                          initialAdrId={selectedAdrId}
                          onClearInitialAdr={() => setSelectedAdrId(null)}
                        />
                      ) : isResilienceView ? (
                        <ResilienceDashboard modelId={selectedModelId} />
                      ) : isGapView ? (
                        <GapAnalysisMatrix modelId={selectedModelId} />
                      ) : (
                        <FrameworkInsights
                          modelId={selectedModelId}
                          packages={packagesWithViews}
                          activePackageView={activePackageView}
                          onSelectPackageView={handleSelectPackageView}
                        />
                      )
                    )}
                    {effectiveBusinessTab === 'apm' && (
                      <APMDashboard
                        modelId={selectedModelId}
                        isApmPackageActive={packagesWithViews.some((p) => p.id === 'pkg-apm' || p.code === 'APM')}
                        onNavigateMetamodel={() => {
                          setActiveHub('architecture');
                          setArchitectureTab('schemas');
                        }}
                        activeTab={apmTab}
                        onTabChange={setApmTab}
                      />
                    )}
                    {effectiveBusinessTab === 'tech_risk' && (
                      <APMDashboard
                        modelId={selectedModelId}
                        isApmPackageActive={packagesWithViews.some((p) => p.id === 'pkg-apm' || p.code === 'APM')}
                        onNavigateMetamodel={() => {
                          setActiveHub('architecture');
                          setArchitectureTab('schemas');
                        }}
                        activeTab="tech_risk"
                        onTabChange={setApmTab}
                      />
                    )}
                    {effectiveBusinessTab === 'tco' && (
                      <APMDashboard
                        modelId={selectedModelId}
                        isApmPackageActive={packagesWithViews.some((p) => p.id === 'pkg-apm' || p.code === 'APM')}
                        onNavigateMetamodel={() => {
                          setActiveHub('architecture');
                          setArchitectureTab('schemas');
                        }}
                        activeTab="tco"
                        onTabChange={setApmTab}
                      />
                    )}
                    {effectiveBusinessTab === 'functional' && <FunctionalAnalysisView modelId={selectedModelId} />}
                    {effectiveBusinessTab === 'overlap' && <OverlapMatrix modelId={selectedModelId} />}
                    {effectiveBusinessTab === 'processes' && <ProcessNavigator modelId={selectedModelId} />}
                  </>
                )}

                {/* 2. ARCHITECTURE HUB */}
                {effectiveHub === 'architecture' && (
                  <>
                    {architectureTab === 'repository' && (
                      <ArchitectRepository
                        modelId={selectedModelId}
                        initialSavedView={selectedSavedView}
                        onClearInitialView={() => setSelectedSavedView(null)}
                        onOpenAdr={(adrId) => {
                          setSelectedAdrId(adrId || null);
                          handleSelectPackageView('pkg-adr', 'pkv-adr-registry', 'architecture');
                        }}
                        onOpenSchema={(schemaId) => {
                          setArchitectureTab('schemas');
                        }}
                      />
                    )}
                    {architectureTab === 'schemas' && <SchemaRepository modelId={selectedModelId} />}
                    {architectureTab === 'relations' && <RelationsMatrix modelId={selectedModelId} />}
                    {(architectureTab === 'package_view' || architectureTab === 'adrs') && (
                      isAdrView || architectureTab === 'adrs' ? (
                        <ADRManager
                          modelId={selectedModelId}
                          initialAdrId={selectedAdrId}
                          onClearInitialAdr={() => setSelectedAdrId(null)}
                        />
                      ) : isResilienceView ? (
                        <ResilienceDashboard modelId={selectedModelId} />
                      ) : isGapView ? (
                        <GapAnalysisMatrix modelId={selectedModelId} />
                      ) : (
                        <FrameworkInsights
                          modelId={selectedModelId}
                          packages={packagesWithViews}
                          activePackageView={activePackageView}
                          onSelectPackageView={(pId, vId) => handleSelectPackageView(pId, vId, 'architecture')}
                        />
                      )
                    )}
                    {architectureTab === 'business-views' && (
                      <BusinessViewsManager
                        modelId={selectedModelId}
                        onOpenInBusiness={(viewId) => {
                          handleSelectPackageView('custom-business-views', viewId, 'business');
                        }}
                        onApplyToRepository={(view) => {
                          setSelectedSavedView(view);
                          setArchitectureTab('repository');
                        }}
                        onViewsChanged={() => loadPackageViews(selectedModelId)}
                      />
                    )}
                    {architectureTab === 'import' && (
                      <DataImportHub modelId={selectedModelId} />
                    )}
                  </>
                )}

                {/* 3. GOVERNANCE & SURVEYS HUB */}
                {effectiveHub === 'governance' && (
                  <>
                    {effectiveGovernanceTab === 'my_surveys' && (
                      <OwnerDashboard selectedModelId={selectedModelId} />
                    )}
                    {effectiveGovernanceTab === 'campaigns' && (
                      <CampaignManagementView selectedModelId={selectedModelId} />
                    )}
                    {effectiveGovernanceTab === 'ownership' && (
                      <ApplicationOwnershipMatrixView selectedModelId={selectedModelId} />
                    )}
                  </>
                )}

                {/* 4. ADMINISTRATION HUB */}
                {effectiveHub === 'admin' && (
                  <AdminHub
                    models={models}
                    selectedModelId={selectedModelId}
                    onRefreshModels={() => loadModels()}
                    onSelectModel={handleSelectModel}
                    onPackageUpdated={() => selectedModelId && loadPackageViews(selectedModelId)}
                    subTab={adminTab}
                    onSelectSubTab={(tab) => setAdminTab(tab)}
                  />
                )}
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center max-w-xl mx-auto my-12 space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 border border-indigo-100">
                  <Layers className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">{t.common.noLibraryPresent}</h2>
                <p className="text-xs text-slate-500">
                  {t.common.noLibraryDesc}
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={handleSeedSample}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition"
                  >
                    {t.common.loadDemoLibrary}
                  </button>
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition"
                  >
                    {t.common.importFromArchi}
                  </button>
                </div>
              </div>
            )}
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-200 bg-white py-3.5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 mt-auto">
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="font-medium">EasyEA • {t.common.dualCoreTagline}</span>
              <div className="flex items-center space-x-4 text-slate-500">
                <span className="flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-indigo-600" /> {t.common.cloudNative}
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> {t.common.enterpriseReady}
                </span>
              </div>
            </div>
          </footer>
        </div>

      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}

export default App;

