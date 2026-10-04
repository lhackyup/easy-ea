import React, { useState, useEffect } from 'react';
import { ModelWorkspace, MainHub, BusinessSubTab, ArchitectureSubTab, AdminSubTab, SavedFilterView } from './types';
import { api } from './lib/api';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { UploadModal } from './components/UploadModal';
import { ExecutiveOverview } from './features/business/ExecutiveOverview';
import { APMDashboard } from './features/apm/APMDashboard';
import { OverlapMatrix } from './features/overlap/OverlapMatrix';
import { ProcessNavigator } from './features/processes/ProcessNavigator';
import { ArchitectRepository } from './features/architect/ArchitectRepository';
import { RelationsMatrix } from './features/architect/RelationsMatrix';
import { ArchitectSavedViews } from './features/architect/ArchitectSavedViews';
import { SchemaRepository } from './features/schemas/SchemaRepository';
import { DataImportHub } from './features/architect/DataImportHub';
import { AdminHub } from './features/admin/AdminHub';
import { LoginScreen } from './features/auth/LoginScreen';
import { Layers, ShieldCheck, Cpu } from 'lucide-react';
import { useLanguage } from './context/LanguageContext';
import { useAuth } from './context/AuthContext';

export function App() {
  const { t } = useLanguage();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [models, setModels] = useState<ModelWorkspace[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  
  // 3 Hubs State
  const [activeHub, setActiveHub] = useState<MainHub>('business');
  const [businessTab, setBusinessTab] = useState<BusinessSubTab>('overview');
  const [architectureTab, setArchitectureTab] = useState<ArchitectureSubTab>('repository');
  const [adminTab, setAdminTab] = useState<AdminSubTab>('models');
  const [selectedSavedView, setSelectedSavedView] = useState<SavedFilterView | null>(null);

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
        if (selectId && list.some((m) => m.id === selectId)) {
          setSelectedModelId(selectId);
        } else if (!selectedModelId || !list.some((m) => m.id === selectedModelId)) {
          setSelectedModelId(list[0].id);
        }
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
  }, [isAuthenticated]);

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
        activeHub={activeHub}
        onSelectHub={(hub) => setActiveHub(hub)}
        models={models}
        selectedModelId={selectedModelId}
        onSelectModel={(id) => setSelectedModelId(id)}
        onSeedSample={handleSeedSample}
        isSeeding={isSeeding}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      {/* 2. Main Layout Container: Left Sidebar + Center Workspace */}
      <div className="flex flex-1 min-h-[calc(100vh-3.5rem)]">
        
        {/* Collapsible Left Sidebar */}
        <div className={`${isMobileSidebarOpen ? 'block fixed inset-y-0 left-0 z-50 pt-14 md:pt-0' : 'hidden'} md:flex md:static`}>
          <Sidebar
            activeHub={activeHub}
            businessTab={businessTab}
            onSelectBusinessTab={(tab) => {
              setBusinessTab(tab);
              setIsMobileSidebarOpen(false);
            }}
            architectureTab={architectureTab}
            onSelectArchitectureTab={(tab) => {
              setArchitectureTab(tab);
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
                {activeHub === 'business' && (
                  <>
                    {businessTab === 'overview' && (
                      <ExecutiveOverview
                        modelId={selectedModelId}
                        onNavigateTab={(tab) => setBusinessTab(tab)}
                      />
                    )}
                    {businessTab === 'apm' && <APMDashboard modelId={selectedModelId} />}
                    {businessTab === 'overlap' && <OverlapMatrix modelId={selectedModelId} />}
                    {businessTab === 'processes' && <ProcessNavigator modelId={selectedModelId} />}
                  </>
                )}

                {/* 2. ARCHITECTURE HUB */}
                {activeHub === 'architecture' && (
                  <>
                    {architectureTab === 'repository' && (
                      <ArchitectRepository
                        modelId={selectedModelId}
                        initialSavedView={selectedSavedView}
                        onClearInitialView={() => setSelectedSavedView(null)}
                      />
                    )}
                    {architectureTab === 'schemas' && <SchemaRepository modelId={selectedModelId} />}
                    {architectureTab === 'relations' && <RelationsMatrix modelId={selectedModelId} />}
                    {architectureTab === 'saved-views' && (
                      <ArchitectSavedViews
                        modelId={selectedModelId}
                        onApplyView={(view) => {
                          setSelectedSavedView(view);
                          setArchitectureTab('repository');
                        }}
                        onNavigateToRepository={() => {
                          setSelectedSavedView(null);
                          setArchitectureTab('repository');
                        }}
                      />
                    )}
                    {architectureTab === 'import' && <DataImportHub modelId={selectedModelId} />}
                  </>
                )}

                {/* 3. ADMINISTRATION HUB */}
                {activeHub === 'admin' && (
                  <AdminHub
                    models={models}
                    selectedModelId={selectedModelId}
                    onRefreshModels={() => loadModels()}
                    onSelectModel={(id) => setSelectedModelId(id)}
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

