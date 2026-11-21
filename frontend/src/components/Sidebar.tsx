import React, { useState } from 'react';
import {
  MainHub,
  BusinessSubTab,
  ArchitectureSubTab,
  AdminSubTab,
  PackageWithViews,
  ActivePackageViewSelection
} from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  Sparkles,
  GitMerge,
  Workflow,
  Layers,
  Database,
  Boxes,
  Upload,
  HardDrive,
  Sliders,
  Shield,
  BarChart3,
  Box,
  Package,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Table as TableIcon,
  ShieldAlert,
  Coins,
  PieChart,
  Grid,
  Settings,
  Building2,
  Server,
  KeyRound,
  Bot,
  UploadCloud,
  BookmarkCheck,
  FolderGit2,
  Scale,
  ScrollText,
  TrendingUp,
  Clock,
  Network
} from 'lucide-react';

interface SidebarProps {
  activeHub: MainHub;
  businessTab: BusinessSubTab;
  onSelectBusinessTab: (tab: BusinessSubTab) => void;
  apmTab?: 'catalog' | 'interfaces' | 'portfolio' | 'tech_risk' | 'tco' | 'lifecycle';
  onSelectApmTab?: (tab: 'catalog' | 'interfaces' | 'portfolio' | 'tech_risk' | 'tco' | 'lifecycle') => void;
  architectureTab: ArchitectureSubTab;
  onSelectArchitectureTab: (tab: ArchitectureSubTab) => void;
  adminTab: AdminSubTab;
  onSelectAdminTab: (tab: AdminSubTab) => void;
  onOpenUpload: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  packagesWithViews?: PackageWithViews[];
  activePackageView?: ActivePackageViewSelection | null;
  onSelectPackageView?: (packageId: string, viewId: string, hub?: 'business' | 'architecture') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeHub,
  businessTab,
  onSelectBusinessTab,
  apmTab = 'catalog',
  onSelectApmTab,
  architectureTab,
  onSelectArchitectureTab,
  adminTab,
  onSelectAdminTab,
  onOpenUpload,
  isCollapsed,
  onToggleCollapse,
  packagesWithViews = [],
  activePackageView,
  onSelectPackageView
}) => {
  const { t } = useLanguage();
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({});

  const togglePackageExpand = (pkgId: string) => {
    setExpandedPackages((prev) => ({
      ...prev,
      [pkgId]: prev[pkgId] === undefined ? false : !prev[pkgId]
    }));
  };

  const getViewIcon = (iconName?: string, viewType?: string) => {
    if (viewType === 'adr_manager' || iconName === 'Scale') return Scale;
    if (viewType === 'kpi_dashboard') return BarChart3;
    if (viewType === 'matrix') return Grid;
    if (iconName === 'Building2') return Building2;
    if (iconName === 'Workflow') return Workflow;
    if (iconName === 'Server') return Server;
    if (iconName === 'Sparkles') return Sparkles;
    if (iconName === 'Package') return Package;
    if (iconName === 'Database') return Database;
    if (iconName === 'Layers') return Layers;
    if (iconName === 'ShieldAlert') return ShieldAlert;
    if (iconName === 'PieChart') return PieChart;
    return TableIcon;
  };

  const getColorClasses = (colorName?: string) => {
    switch (colorName) {
      case 'indigo':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'purple':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'teal':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const businessItems = [
    {
      id: 'overview' as BusinessSubTab,
      label: t.subtabs.executiveOverview,
      icon: Sparkles
    },
    {
      id: 'apm' as BusinessSubTab,
      label: t.subtabs.applicationPortfolio,
      icon: Layers
    },
    {
      id: 'functional' as BusinessSubTab,
      label: t.subtabs.functionalAnalysis,
      icon: Network
    },
    {
      id: 'processes' as BusinessSubTab,
      label: t.subtabs.processLineage,
      icon: Workflow
    }
  ];

  const architectureItems = [
    {
      id: 'repository' as ArchitectureSubTab,
      label: t.subtabs.archimateRepository,
      icon: Database
    },
    {
      id: 'schemas' as ArchitectureSubTab,
      label: t.subtabs.schemaRepository,
      icon: FolderGit2
    },
    {
      id: 'relations' as ArchitectureSubTab,
      label: t.subtabs.relationsMatrix,
      icon: GitMerge
    },
    {
      id: 'business-views' as ArchitectureSubTab,
      label: t.subtabs.businessViews,
      icon: Sliders
    },
    {
      id: 'import' as ArchitectureSubTab,
      label: t.subtabs.dataImport,
      icon: UploadCloud
    }
  ];

  const businessPackages = packagesWithViews
    .filter((p) => p.id !== 'pkg-apm' && p.code !== 'APM')
    .map((p) => ({
      ...p,
      views: (p.views || []).filter(
        (v) => (v.target_hub || 'business') === 'business' || v.target_hub === 'both'
      )
    }))
    .filter((p) => p.views.length > 0);

  const architecturePackages = packagesWithViews
    .map((p) => ({
      ...p,
      views: (p.views || []).filter((v) => v.target_hub === 'architecture' || v.target_hub === 'both')
    }))
    .filter((p) => p.views.length > 0);

  const adminItems = [
    {
      id: 'models' as AdminSubTab,
      label: t.subtabs.librariesRepo,
      icon: HardDrive
    },
    {
      id: 'metamodel' as AdminSubTab,
      label: t.subtabs.metamodelManager,
      icon: Box
    },
    {
      id: 'packages' as AdminSubTab,
      label: t.subtabs.packagesManager,
      icon: Package
    },
    {
      id: 'roles' as AdminSubTab,
      label: t.subtabs.rolesAccess,
      icon: Shield
    },
    {
      id: 'auth_config' as AdminSubTab,
      label: t.subtabs.authConfig,
      icon: KeyRound
    },
    {
      id: 'api_keys' as AdminSubTab,
      label: t.subtabs.apiKeys,
      icon: Bot
    },
    {
      id: 'audit_logs' as AdminSubTab,
      label: t.subtabs.auditLogs,
      icon: ScrollText
    },
    {
      id: 'system' as AdminSubTab,
      label: t.subtabs.systemStatus,
      icon: BarChart3
    }
  ];

  return (
    <aside
      className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col justify-between select-none z-30 shrink-0 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Scrollable Navigation Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4 scrollbar-thin">
        
        {/* ======================================================== */}
        {/* ACTIVE HUB 1: BUSINESS HUB ONLY                          */}
        {/* ======================================================== */}
        {activeHub === 'business' && (
          <div>
            {!isCollapsed ? (
              <div className="flex items-center space-x-2 px-2 pb-3 mb-2 border-b border-slate-100">
                <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-indigo-900 uppercase tracking-wider block leading-tight">
                    {t.common.businessHub}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Executive & Portfolio
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex justify-center pb-3 mb-2 border-b border-slate-100" title={t.common.businessHub}>
                <div className="p-1.5 rounded-xl bg-indigo-100 text-indigo-700">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
            )}

            <div className="space-y-1">
              {businessItems.map((item) => {
                const Icon = item.icon;
                const isActive = businessTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectBusinessTab(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center rounded-xl text-xs font-bold transition-all duration-150 ${
                      isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 space-x-2.5 text-left'
                    } ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25 ring-1 ring-indigo-500/20'
                        : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/70'
                    }`}
                  >
                    <Icon className={`shrink-0 ${isCollapsed ? 'w-4 h-4' : 'w-4 h-4'} ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>

            {/* DYNAMIC PACKAGE VIEWS SECTION */}
            {businessPackages.length > 0 && (
              <div className="pt-3 mt-2 border-t border-slate-100">
                {!isCollapsed && (
                  <div className="px-3 pb-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <span>Pacchetti & Viste</span>
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-bold">
                      {businessPackages.length}
                    </span>
                  </div>
                )}

                <div className="space-y-1.5">
                  {businessPackages.map((pkg) => {
                    const isExpanded = expandedPackages[pkg.id] ?? true;

                    return (
                      <div key={pkg.id} className="space-y-0.5">
                        {/* Package Header button */}
                        <button
                          onClick={() => togglePackageExpand(pkg.id)}
                          title={isCollapsed ? pkg.name : undefined}
                          className={`w-full flex items-center justify-between rounded-xl text-xs font-bold transition-all duration-150 ${
                            isCollapsed ? 'justify-center p-2' : 'px-2.5 py-1.5 text-left'
                          } text-slate-700 hover:text-indigo-600 hover:bg-slate-50`}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border shrink-0 ${getColorClasses(
                                pkg.icon_color
                              )}`}
                            >
                              {pkg.code}
                            </span>
                            {!isCollapsed && (
                              <span className="truncate text-xs font-bold text-slate-800" title={pkg.name}>
                                {pkg.name}
                              </span>
                            )}
                          </div>
                          {!isCollapsed && (
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          )}
                        </button>

                        {/* Submenu of views */}
                        {(!isCollapsed && isExpanded) && (
                          <div className="pl-3.5 pr-1 space-y-0.5 border-l-2 border-slate-100 ml-3.5 my-1">
                            {[...(pkg.views || [])]
                              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
                              .map((v) => {
                              const Icon = getViewIcon(v.icon, v.view_type);
                              const isViewActive =
                                businessTab === 'package_view' &&
                                activePackageView?.packageId === pkg.id &&
                                (activePackageView?.viewId === v.id || activePackageView?.viewId === v.view_key);

                              return (
                                <button
                                  key={v.id}
                                  onClick={() => onSelectPackageView && onSelectPackageView(pkg.id, v.id, 'business')}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    isViewActive
                                      ? 'bg-indigo-600 text-white shadow-sm font-bold'
                                      : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/60'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2 min-w-0">
                                    <Icon
                                      className={`w-3.5 h-3.5 shrink-0 ${
                                        isViewActive ? 'text-white' : 'text-slate-400'
                                      }`}
                                    />
                                    <span className="truncate">{v.name}</span>
                                  </div>
                                  {v.matching_elements_count > 0 && (
                                    <span
                                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 shrink-0 ${
                                        isViewActive
                                          ? 'bg-white/20 text-white'
                                          : 'bg-slate-100 text-slate-500'
                                      }`}
                                    >
                                      {v.matching_elements_count}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* ACTIVE HUB 2: ARCHITECTURE HUB ONLY                      */}
        {/* ======================================================== */}
        {activeHub === 'architecture' && (
          <div>
            {!isCollapsed ? (
              <div className="flex items-center space-x-2 px-2 pb-3 mb-2 border-b border-slate-100">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-emerald-900 uppercase tracking-wider block leading-tight">
                    {t.common.architectureHub}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Modeling & Diagrams
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex justify-center pb-3 mb-2 border-b border-slate-100" title={t.common.architectureHub}>
                <div className="p-1.5 rounded-xl bg-emerald-100 text-emerald-700">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
            )}

            <div className="space-y-1">
              {architectureItems.map((item) => {
                const Icon = item.icon;
                const isActive = architectureTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectArchitectureTab(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center rounded-xl text-xs font-bold transition-all duration-150 ${
                      isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 space-x-2.5 text-left'
                    } ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 ring-1 ring-emerald-500/20'
                        : 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50/70'
                    }`}
                  >
                    <Icon className={`shrink-0 ${isCollapsed ? 'w-4 h-4' : 'w-4 h-4'} ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>

            {/* DYNAMIC ARCHITECTURE PACKAGE VIEWS SECTION */}
            {architecturePackages.length > 0 && (
              <div className="pt-3 mt-2 border-t border-slate-100">
                {!isCollapsed && (
                  <div className="px-3 pb-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <span>Pacchetti & Viste</span>
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-bold">
                      {architecturePackages.length}
                    </span>
                  </div>
                )}

                <div className="space-y-1.5">
                  {architecturePackages.map((pkg) => {
                    const isExpanded = expandedPackages[pkg.id] ?? true;

                    return (
                      <div key={pkg.id} className="space-y-0.5">
                        {/* Package Header button */}
                        <button
                          onClick={() => togglePackageExpand(pkg.id)}
                          title={isCollapsed ? pkg.name : undefined}
                          className={`w-full flex items-center justify-between rounded-xl text-xs font-bold transition-all duration-150 ${
                            isCollapsed ? 'justify-center p-2' : 'px-2.5 py-1.5 text-left'
                          } text-slate-700 hover:text-emerald-600 hover:bg-slate-50`}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border shrink-0 ${getColorClasses(
                                pkg.icon_color
                              )}`}
                            >
                              {pkg.code}
                            </span>
                            {!isCollapsed && (
                              <span className="truncate text-xs font-bold text-slate-800" title={pkg.name}>
                                {pkg.name}
                              </span>
                            )}
                          </div>
                          {!isCollapsed && (
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          )}
                        </button>

                        {/* Submenu of views */}
                        {(!isCollapsed && isExpanded) && (
                          <div className="pl-3.5 pr-1 space-y-0.5 border-l-2 border-slate-100 ml-3.5 my-1">
                            {[...(pkg.views || [])]
                              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
                              .map((v) => {
                              const Icon = getViewIcon(v.icon, v.view_type);
                              const isViewActive =
                                architectureTab === 'package_view' &&
                                activePackageView?.packageId === pkg.id &&
                                (activePackageView?.viewId === v.id || activePackageView?.viewId === v.view_key);

                              return (
                                <button
                                  key={v.id}
                                  onClick={() => onSelectPackageView && onSelectPackageView(pkg.id, v.id, 'architecture')}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    isViewActive
                                      ? 'bg-emerald-600 text-white shadow-sm font-bold'
                                      : 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50/60'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2 min-w-0">
                                    <Icon
                                      className={`w-3.5 h-3.5 shrink-0 ${
                                        isViewActive ? 'text-white' : 'text-slate-400'
                                      }`}
                                    />
                                    <span className="truncate">{v.name}</span>
                                  </div>
                                  {v.matching_elements_count > 0 && (
                                    <span
                                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 shrink-0 ${
                                        isViewActive
                                          ? 'bg-white/20 text-white'
                                          : 'bg-slate-100 text-slate-500'
                                      }`}
                                    >
                                      {v.matching_elements_count}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* ACTIVE HUB 3: ADMINISTRATION HUB ONLY                    */}
        {/* ======================================================== */}
        {activeHub === 'admin' && (
          <div>
            {!isCollapsed ? (
              <div className="flex items-center space-x-2 px-2 pb-3 mb-2 border-b border-slate-100">
                <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-rose-900 uppercase tracking-wider block leading-tight">
                    {t.common.adminHub}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Governance & Platform
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex justify-center pb-3 mb-2 border-b border-slate-100" title={t.common.adminHub}>
                <div className="p-1.5 rounded-xl bg-rose-100 text-rose-700">
                  <Settings className="w-4 h-4" />
                </div>
              </div>
            )}

            <div className="space-y-1">
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = adminTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectAdminTab(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center rounded-xl text-xs font-bold transition-all duration-150 ${
                      isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 space-x-2.5 text-left'
                    } ${
                      isActive
                        ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/25 ring-1 ring-rose-500/20'
                        : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50/70'
                    }`}
                  >
                    <Icon className={`shrink-0 ${isCollapsed ? 'w-4 h-4' : 'w-4 h-4'} ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Footer / Collapse Toggle */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/60">
        <button
          onClick={onToggleCollapse}
          className={`w-full flex items-center rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 transition p-2 ${
            isCollapsed ? 'justify-center' : 'justify-between px-3'
          }`}
          title={isCollapsed ? t.common.expandSidebar : t.common.collapseSidebar}
        >
          {!isCollapsed && <span>{t.common.collapseSidebar}</span>}
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
};
