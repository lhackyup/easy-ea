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
  KeyRound
} from 'lucide-react';

interface SidebarProps {
  activeHub: MainHub;
  onSelectHub: (hub: MainHub) => void;
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
  onSelectHub,
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
      id: 'diagrams' as ArchitectureSubTab,
      label: t.subtabs.graphicViews,
      icon: Boxes
    },
    {
      id: 'relations' as ArchitectureSubTab,
      label: t.subtabs.relationsMatrix,
      icon: GitMerge
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-6 scrollbar-thin">
        
        {/* ======================================================== */}
        {/* GROUP 1: BUSINESS HUB                                    */}
        {/* ======================================================== */}
        <div>
          {!isCollapsed ? (
            <button
              onClick={() => onSelectHub('business')}
              className="w-full flex items-center justify-between text-left px-2 mb-2 group cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <div className={`p-1 rounded-lg transition ${activeHub === 'business' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 group-hover:text-indigo-600'}`}>
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className={`text-[11px] font-extrabold uppercase tracking-wider ${activeHub === 'business' ? 'text-indigo-900 font-black' : 'text-slate-500 group-hover:text-slate-800'}`}>
                  {t.common.businessHub}
                </span>
              </div>
              {activeHub === 'business' && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
              )}
            </button>
          ) : (
            <div className="flex justify-center mb-2" title={t.common.businessHub}>
              <div className={`p-1.5 rounded-xl ${activeHub === 'business' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
          )}

          <div className="space-y-1">
            {businessItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeHub === 'business' && businessTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectHub('business');
                    onSelectBusinessTab(item.id);
                  }}
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

        {/* ======================================================== */}
        {/* GROUP 2: ARCHITECTURE HUB                                */}
        {/* ======================================================== */}
        <div>
          {!isCollapsed ? (
            <button
              onClick={() => onSelectHub('architecture')}
              className="w-full flex items-center justify-between text-left px-2 mb-2 group cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <div className={`p-1 rounded-lg transition ${activeHub === 'architecture' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500 group-hover:text-emerald-600'}`}>
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <span className={`text-[11px] font-extrabold uppercase tracking-wider ${activeHub === 'architecture' ? 'text-emerald-900 font-black' : 'text-slate-500 group-hover:text-slate-800'}`}>
                  {t.common.architectureHub}
                </span>
              </div>
              {activeHub === 'architecture' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              )}
            </button>
          ) : (
            <div className="flex justify-center mb-2" title={t.common.architectureHub}>
              <div className={`p-1.5 rounded-xl ${activeHub === 'architecture' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                <Building2 className="w-4 h-4" />
              </div>
            </div>
          )}

          <div className="space-y-1">
            {architectureItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeHub === 'architecture' && architectureTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectHub('architecture');
                    onSelectArchitectureTab(item.id);
                  }}
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
              className={`w-full flex items-center rounded-xl text-xs font-bold border border-dashed border-emerald-300 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 hover:border-emerald-400 transition-all duration-150 ${
                isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 space-x-2.5 text-left'
              }`}
            >
              <Upload className="w-4 h-4 shrink-0 text-emerald-600" />
              {!isCollapsed && <span className="truncate">{t.subtabs.importArchiFile}</span>}
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* GROUP 3: ADMINISTRATION HUB                             */}
        {/* ======================================================== */}
        <div>
          {!isCollapsed ? (
            <button
              onClick={() => onSelectHub('admin')}
              className="w-full flex items-center justify-between text-left px-2 mb-2 group cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <div className={`p-1 rounded-lg transition ${activeHub === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500 group-hover:text-rose-600'}`}>
                  <Settings className="w-3.5 h-3.5" />
                </div>
                <span className={`text-[11px] font-extrabold uppercase tracking-wider ${activeHub === 'admin' ? 'text-rose-900 font-black' : 'text-slate-500 group-hover:text-slate-800'}`}>
                  {t.common.adminHub}
                </span>
              </div>
              {activeHub === 'admin' && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
              )}
            </button>
          ) : (
            <div className="flex justify-center mb-2" title={t.common.adminHub}>
              <div className={`p-1.5 rounded-xl ${activeHub === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-400'}`}>
                <Settings className="w-4 h-4" />
              </div>
            </div>
          )}

          <div className="space-y-1">
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeHub === 'admin' && adminTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectHub('admin');
                    onSelectAdminTab(item.id);
                  }}
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
