import React from 'react';
import { MainHub, BusinessSubTab, ArchitectureSubTab, AdminSubTab } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  Sparkles,
  LayoutGrid,
  GitMerge,
  Workflow,
  Database,
  Boxes,
  Upload,
  HardDrive,
  Sliders,
  Shield,
  BarChart3,
  Box,
  ChevronLeft,
  ChevronRight,
  Settings,
  Building2,
  KeyRound,
  UploadCloud,
  BookmarkCheck,
  FolderGit2
} from 'lucide-react';

interface SidebarProps {
  activeHub: MainHub;
  businessTab: BusinessSubTab;
  onSelectBusinessTab: (tab: BusinessSubTab) => void;
  architectureTab: ArchitectureSubTab;
  onSelectArchitectureTab: (tab: ArchitectureSubTab) => void;
  adminTab: AdminSubTab;
  onSelectAdminTab: (tab: AdminSubTab) => void;
  onOpenUpload: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeHub,
  businessTab,
  onSelectBusinessTab,
  architectureTab,
  onSelectArchitectureTab,
  adminTab,
  onSelectAdminTab,
  onOpenUpload,
  isCollapsed,
  onToggleCollapse
}) => {
  const { t } = useLanguage();

  const businessItems = [
    {
      id: 'overview' as BusinessSubTab,
      label: t.subtabs.executiveOverview,
      icon: Sparkles
    },
    {
      id: 'apm' as BusinessSubTab,
      label: t.subtabs.timePortfolio,
      icon: LayoutGrid
    },
    {
      id: 'overlap' as BusinessSubTab,
      label: t.subtabs.functionalOverlap,
      icon: GitMerge
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
      id: 'saved-views' as ArchitectureSubTab,
      label: t.subtabs.savedViews,
      icon: BookmarkCheck
    },
    {
      id: 'diagrams' as ArchitectureSubTab,
      label: t.subtabs.graphicViews,
      icon: Boxes
    },
    {
      id: 'import' as ArchitectureSubTab,
      label: t.subtabs.dataImport,
      icon: UploadCloud
    }
  ];

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
      id: 'apm_config' as AdminSubTab,
      label: t.subtabs.apmTimeParams,
      icon: Sliders
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

              {/* Quick Upload Action */}
              <button
                onClick={onOpenUpload}
                title={isCollapsed ? t.subtabs.importArchiFile : undefined}
                className={`w-full flex items-center rounded-xl text-xs font-bold border border-dashed border-emerald-300 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 hover:border-emerald-400 transition-all duration-150 mt-2 ${
                  isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 space-x-2.5 text-left'
                }`}
              >
                <Upload className="w-4 h-4 shrink-0 text-emerald-600" />
                {!isCollapsed && <span className="truncate">{t.subtabs.importArchiFile}</span>}
              </button>
            </div>
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
