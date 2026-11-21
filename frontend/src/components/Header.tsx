import React, { useState, useEffect, useRef } from 'react';
import {
  ModelWorkspace,
  MainHub,
  BusinessSubTab,
  ArchitectureSubTab,
  AdminSubTab,
  PackageWithViews,
  ActivePackageViewSelection
} from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  Layers,
  Database,
  Upload,
  RefreshCw,
  Sparkles,
  Box,
  GitMerge,
  FileText,
  Sliders,
  Users,
  HardDrive,
  BarChart3,
  Settings,
  Workflow,
  Globe,
  Network,
  Boxes,
  Package,
  LogOut,
  Shield,
  User as UserIcon,
  KeyRound,
  Bot,
  UploadCloud,
  BookmarkCheck,
  FolderGit2,
  ChevronDown
} from 'lucide-react';

interface HeaderProps {
  models: ModelWorkspace[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  activeHub: MainHub;
  onSelectHub: (hub: MainHub) => void;
  businessTab: BusinessSubTab;
  onSelectBusinessTab: (tab: BusinessSubTab) => void;
  architectureTab: ArchitectureSubTab;
  onSelectArchitectureTab: (tab: ArchitectureSubTab) => void;
  adminTab: AdminSubTab;
  onSelectAdminTab: (tab: AdminSubTab) => void;
  onOpenUpload: () => void;
  onSeedSample: () => void;
  isSeeding: boolean;
  packagesWithViews?: PackageWithViews[];
  activePackageView?: ActivePackageViewSelection | null;
  onSelectPackageView?: (packageId: string, viewId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  activeHub,
  onSelectHub,
  businessTab,
  onSelectBusinessTab,
  architectureTab,
  onSelectArchitectureTab,
  adminTab,
  onSelectAdminTab,
  onOpenUpload,
  onSeedSample,
  isSeeding,
  packagesWithViews = [],
  activePackageView,
  onSelectPackageView
}) => {
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const [openPackageDropdown, setOpenPackageDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenPackageDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getHubTheme = () => {
    switch (activeHub) {
      case 'business':
        return {
          badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          logoBg: 'from-indigo-600 to-blue-600',
        };
      case 'architecture':
        return {
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          logoBg: 'from-emerald-600 to-teal-600',
        };
      case 'admin':
        return {
          badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
          logoBg: 'from-rose-600 to-red-600',
        };
    }
  };

  const theme = getHubTheme();

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Bar: Brand, High-Level Hub Switcher, Language & Library Selector */}
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className={`bg-gradient-to-tr ${theme.logoBg} p-2 rounded-xl shadow-md flex items-center justify-center transition-all duration-300`}>
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold text-slate-900 tracking-tight">EasyEA</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${theme.badgeBg}`}>
                  {activeHub === 'business' ? `💼 ${t.common.businessHub}` : activeHub === 'architecture' ? `🏛️ ${t.common.architectureHub}` : `⚙️ ${t.common.adminHub}`}
                </span>
              </div>
            </div>
          </div>

          {/* Primary Hub Switcher (3 Large Evident Sections) */}
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner">
            
            {/* 1. Business Hub Button */}
            <button
              onClick={() => onSelectHub('business')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeHub === 'business'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-600/20'
                  : 'text-slate-600 hover:text-indigo-600 hover:bg-white/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.common.businessBadge}</span>
            </button>

            {/* 2. Architecture Hub Button */}
            <button
              onClick={() => onSelectHub('architecture')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeHub === 'architecture'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-600/20'
                  : 'text-slate-600 hover:text-emerald-600 hover:bg-white/60'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>{t.common.architectureBadge}</span>
            </button>

            {/* 3. Administration Hub Button */}
            <button
              onClick={() => onSelectHub('admin')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeHub === 'admin'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-600/20'
                  : 'text-slate-600 hover:text-rose-600 hover:bg-white/60'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{t.common.adminBadge}</span>
            </button>
          </div>

          {/* Right Actions: Language Switcher, Library Selector & Demo */}
          <div className="flex items-center space-x-2">
            
            {/* Language Switcher Button (EN / IT) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-inner">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 text-[11px] font-bold rounded-lg transition ${
                  language === 'en'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="English"
              >
                🇬🇧 EN
              </button>
              <button
                onClick={() => setLanguage('it')}
                className={`px-2 py-1 text-[11px] font-bold rounded-lg transition ${
                  language === 'it'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Italiano"
              >
                🇮🇹 IT
              </button>
            </div>

            {/* Library Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-inner">
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedModelId}
                onChange={(e) => onSelectModel(e.target.value)}
                className="bg-transparent text-xs text-slate-800 font-bold focus:outline-none cursor-pointer max-w-[210px] truncate"
                title={t.common.selectLibrary}
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id} className="bg-white text-slate-800">
                    [{m.code || '----'}] {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Demo Button */}
            <button
              onClick={onSeedSample}
              disabled={isSeeding}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
              title={t.common.demoLibrary}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            {/* User Profile & Role Badge & Logout */}
            {user && (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                    {(user.username || user.full_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-[11px] font-bold text-slate-900 leading-tight">
                      {user.full_name || user.username}
                    </div>
                    <div className="text-[9px] font-semibold text-rose-600 flex items-center gap-0.5">
                      <Shield className="w-2.5 h-2.5" />
                      {user.assignments?.some(a => a.role === 'admin') ? 'System Admin' : user.assignments?.[0]?.role || 'User'}
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={logout}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition"
                  title={t.auth.logout}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dedicated Sub-Navigation Bar per Hub */}
        <div className="flex items-center space-x-2 border-t border-slate-100 pt-2 pb-2.5 overflow-x-auto scrollbar-none">
          
          {/* BUSINESS HUB SUB-MENU */}
          {activeHub === 'business' && (
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-900 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-lg mr-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> {t.subtabs.businessViews}:
              </span>

              <button
                onClick={() => onSelectBusinessTab('overview')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                  businessTab === 'overview'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/60'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{t.subtabs.executiveOverview}</span>
              </button>

              <button
                onClick={() => onSelectBusinessTab('functional')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                  businessTab === 'functional' || businessTab === 'overlap'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/60'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>{t.subtabs.functionalAnalysis}</span>
              </button>

              <button
                onClick={() => onSelectBusinessTab('processes')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                  businessTab === 'processes'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/60'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{t.subtabs.processLineage}</span>
              </button>

              <button
                onClick={() => onSelectBusinessTab('apm')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                  businessTab === 'apm'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{t.subtabs.applicationPortfolio}</span>
              </button>

              {/* DYNAMIC PACKAGE MENUS WITH SUBMENU OF VIEWS */}
              {packagesWithViews.filter((p) => p.views && p.views.length > 0).map((pkg) => {
                const isPkgActive = businessTab === 'package_view' && activePackageView?.packageId === pkg.id;
                const isOpen = openPackageDropdown === pkg.id;

                return (
                  <div key={pkg.id} className="relative inline-block" ref={isOpen ? dropdownRef : undefined}>
                    <button
                      onClick={() => setOpenPackageDropdown(isOpen ? null : pkg.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 border ${
                        isPkgActive
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-700 hover:text-indigo-700 hover:bg-indigo-50/60 border-slate-200/90'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>{pkg.name}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Sottomenù Viste Pacchetto */}
                    {isOpen && (
                      <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-1.5 z-50 animate-in fade-in slide-in-from-top-1">
                        <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                          <span>Viste {pkg.code.toUpperCase()}</span>
                          <span className="font-mono text-slate-400">v{pkg.version}</span>
                        </div>
                        <div className="space-y-0.5 mt-1">
                          {[...(pkg.views || [])]
                            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
                            .map((v) => {
                            const isViewActive =
                              isPkgActive &&
                              (activePackageView?.viewId === v.id || activePackageView?.viewId === v.view_key);

                            return (
                              <button
                                key={v.id}
                                onClick={() => {
                                  if (onSelectPackageView) {
                                    onSelectPackageView(pkg.id, v.id);
                                  }
                                  setOpenPackageDropdown(null);
                                }}
                                className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                                  isViewActive
                                    ? 'bg-indigo-600 text-white shadow-sm font-bold'
                                    : 'text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-700'
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="truncate font-bold">{v.name}</div>
                                  <div className={`text-[10px] truncate ${isViewActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                                    {v.category}
                                  </div>
                                </div>
                                {v.matching_elements_count > 0 && (
                                  <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                                      isViewActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {v.matching_elements_count}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ARCHITECTURE HUB SUB-MENU */}
          {activeHub === 'architecture' && (
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg mr-1 flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-emerald-600" /> {t.subtabs.architectTools}:
              </span>

              <button
                onClick={() => onSelectArchitectureTab('repository')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                  architectureTab === 'repository'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>{t.subtabs.archimateRepository}</span>
              </button>

              <button
                onClick={() => onSelectArchitectureTab('schemas')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                  architectureTab === 'schemas'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60'
                }`}
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>{t.subtabs.schemaRepository}</span>
              </button>

              <button
                onClick={() => onSelectArchitectureTab('relations')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                  architectureTab === 'relations'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60'
                }`}
              >
                <Workflow className="w-3.5 h-3.5" />
                <span>{t.subtabs.relationsMatrix}</span>
              </button>

              <button
                onClick={() => onSelectArchitectureTab('business-views')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                  architectureTab === 'business-views'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{t.subtabs.businessViews}</span>
              </button>

              <button
                onClick={() => onSelectArchitectureTab('import')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                  architectureTab === 'import'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{t.subtabs.dataImport}</span>
              </button>
            </div>
          )}

          {/* ADMINISTRATION HUB SUB-MENU */}
          {activeHub === 'admin' && (
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-900 bg-rose-50 border border-rose-200/80 px-2.5 py-1 rounded-lg mr-1 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-rose-600" /> {t.subtabs.adminSection}:
              </span>

              <button
                onClick={() => onSelectAdminTab('models')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                  adminTab === 'models'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50/60'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>{t.subtabs.librariesRepo}</span>
              </button>

              <button
                onClick={() => onSelectAdminTab('metamodel')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                  adminTab === 'metamodel'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50/60'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>{t.subtabs.metamodelManager}</span>
              </button>

              <button
                onClick={() => onSelectAdminTab('packages')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                  adminTab === 'packages'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50/60'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>{t.subtabs.packagesManager}</span>
              </button>

              <button
                onClick={() => onSelectAdminTab('roles')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                  adminTab === 'roles'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{t.subtabs.rolesAccess}</span>
              </button>

              <button
                onClick={() => onSelectAdminTab('auth_config')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                  adminTab === 'auth_config'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50/60'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{t.subtabs.authConfig}</span>
              </button>

              <button
                onClick={() => onSelectAdminTab('api_keys')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                  adminTab === 'api_keys'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50/60'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>{t.subtabs.apiKeys}</span>
              </button>

              <button
                onClick={() => onSelectAdminTab('system')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                  adminTab === 'system'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50/60'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>{t.subtabs.systemStatus}</span>
              </button>
            </div>
          )}

        </div>

      </div>
    </header>
  );
};
