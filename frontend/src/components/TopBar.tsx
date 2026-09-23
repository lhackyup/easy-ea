import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ModelWorkspace, MainHub } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  Layers,
  Database,
  RefreshCw,
  LogOut,
  Shield,
  User as UserIcon,
  ChevronDown,
  Building2,
  Globe,
  Sparkles,
  Settings,
  Menu
} from 'lucide-react';

interface TopBarProps {
  activeHub: MainHub;
  onSelectHub: (hub: MainHub) => void;
  models: ModelWorkspace[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  onSeedSample: () => void;
  isSeeding: boolean;
  onToggleMobileSidebar?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeHub,
  onSelectHub,
  models,
  selectedModelId,
  onSelectModel,
  onSeedSample,
  isSeeding,
  onToggleMobileSidebar
}) => {
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const activeModel = models.find((m) => m.id === selectedModelId);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdmin = user?.assignments?.some((a) => a.role === 'admin');

  // Compute allowed Hubs based on user assignments and current library
  const allowedHubs: MainHub[] = useMemo(() => {
    if (!user) return ['business'];
    const assignments = user.assignments || [];

    // Global admin has access to all Hubs
    if (isAdmin) {
      return ['business', 'architecture', 'admin'];
    }

    // Filter assignments valid for the current library (or global)
    const activeAssignments = assignments.filter(
      (a) => !a.model_id || a.model_id === selectedModelId
    );
    const roles = new Set(activeAssignments.map((a) => a.role));

    const hubs: MainHub[] = ['business']; // Business Hub is accessible to all assigned roles

    if (roles.has('architect')) {
      hubs.push('architecture');
    }

    return hubs;
  }, [user, isAdmin, selectedModelId]);

  // Ensure activeHub is valid
  useEffect(() => {
    if (!allowedHubs.includes(activeHub)) {
      onSelectHub(allowedHubs[0] || 'business');
    }
  }, [allowedHubs, activeHub, onSelectHub]);

  const primaryRole = isAdmin
    ? t.rbac.roleAdminName
    : user?.assignments?.[0]?.role
    ? user.assignments[0].role === 'architect'
      ? t.rbac.roleArchitectName
      : user.assignments[0].role === 'analyst'
      ? t.rbac.roleAnalystName
      : t.rbac.roleExecutiveName
    : t.rbac.roleUserName;

  return (
    <header className="h-14 bg-white/95 backdrop-blur border-b border-slate-200 sticky top-0 z-40 px-4 flex items-center justify-between shadow-xs">
      
      {/* LEFT: Mobile menu button & Logo */}
      <div className="flex items-center space-x-3">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 md:hidden"
            title="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center space-x-2.5">
          <div className="bg-gradient-to-tr from-indigo-600 to-indigo-700 p-1.5 rounded-xl shadow-sm flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-base font-black text-slate-900 tracking-tight">EasyEA</span>
            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-md border border-slate-200 hidden sm:inline-block">
              Dual-Core
            </span>
          </div>
        </div>
      </div>

      {/* CENTER: Hub Switcher (Left) + Workspace & Library Selector (Right) */}
      <div className="flex items-center space-x-3">
        
        {/* Hub Switcher (Filtered by permissions) */}
        <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200 shadow-2xs">
          {allowedHubs.includes('business') && (
            <button
              onClick={() => onSelectHub('business')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                activeHub === 'business'
                  ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30 ring-1 ring-indigo-500/20'
                  : 'text-slate-600 hover:text-indigo-600 hover:bg-white/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.common.businessBadge}</span>
            </button>
          )}

          {allowedHubs.includes('architecture') && (
            <button
              onClick={() => onSelectHub('architecture')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                activeHub === 'architecture'
                  ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/30 ring-1 ring-emerald-500/20'
                  : 'text-slate-600 hover:text-emerald-600 hover:bg-white/60'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{t.common.architectureBadge}</span>
            </button>
          )}

          {allowedHubs.includes('admin') && (
            <button
              onClick={() => onSelectHub('admin')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                activeHub === 'admin'
                  ? 'bg-rose-600 text-white shadow-xs shadow-rose-600/30 ring-1 ring-rose-500/20'
                  : 'text-slate-600 hover:text-rose-600 hover:bg-white/60'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{t.common.adminBadge}</span>
            </button>
          )}
        </div>

        {/* Workspace & Library Selector */}
        <div className="flex items-center bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 rounded-xl px-2.5 py-1 transition shadow-2xs">
          <div className="flex items-center space-x-2">
            <Database className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            
            {activeModel?.code && (
              <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.2 bg-indigo-100/80 text-indigo-800 rounded border border-indigo-200 shrink-0">
                {activeModel.code}
              </span>
            )}

            <select
              value={selectedModelId}
              onChange={(e) => onSelectModel(e.target.value)}
              className="bg-transparent text-xs text-slate-800 font-bold focus:outline-none cursor-pointer max-w-[160px] sm:max-w-[220px] truncate"
              title={t.common.selectLibrary}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id} className="bg-white text-slate-800 font-medium">
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onSeedSample}
            disabled={isSeeding}
            className="ml-2 pl-2 border-l border-slate-200 text-slate-400 hover:text-indigo-600 transition"
            title={t.common.demoLibrary}
          >
            <RefreshCw className={`w-3 h-3 ${isSeeding ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>

      </div>

      {/* RIGHT: Language Switcher & User Profile Dropdown */}
      <div className="flex items-center space-x-2.5">
        
        {/* Language Switcher */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => setLanguage('en')}
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition ${
              language === 'en'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="English"
          >
            🇬🇧 EN
          </button>
          <button
            onClick={() => setLanguage('it')}
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition ${
              language === 'it'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Italiano"
          >
            🇮🇹 IT
          </button>
        </div>

        {/* User Profile Popover */}
        {user && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 p-1 pl-1.5 pr-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition text-left cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[11px] font-extrabold shadow-xs">
                {(user.full_name || user.username || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-[11px] font-bold text-slate-800 max-w-[110px] truncate">
                  {user.full_name || user.username}
                </div>
                <div className="text-[9px] font-semibold text-rose-600 flex items-center gap-0.5">
                  {isAdmin ? '👑 Admin' : primaryRole}
                </div>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-1 duration-150 space-y-3">
                
                {/* User Header */}
                <div className="border-b border-slate-100 pb-2.5">
                  <div className="text-xs font-bold text-slate-900">
                    {user.full_name || user.username}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">
                    {user.email}
                  </div>
                  <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                    <Shield className="w-3 h-3" />
                    <span>{primaryRole}</span>
                  </div>
                </div>

                {/* Assigned Scopes list */}
                {user.assignments && user.assignments.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                      {t.rbac.colAssignedRoles}
                    </span>
                    <div className="max-h-24 overflow-y-auto space-y-1 scrollbar-thin">
                      {user.assignments.map((a) => (
                        <div
                          key={a.id}
                          className="text-[10px] font-medium text-slate-700 bg-slate-50 border border-slate-200/80 px-2 py-1 rounded-lg flex items-center justify-between"
                        >
                          <span className="capitalize font-bold">{a.role}</span>
                          <span className="text-[9px] font-mono text-slate-500 truncate max-w-[120px]">
                            {a.role === 'admin' || !a.model_id ? t.rbac.scopeGlobalBadge : a.library_name || a.library_code || a.model_id}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Logout Action */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t.auth.logout}</span>
                  </button>
                </div>

              </div>
            )}
          </div>
        )}

      </div>

    </header>
  );
};
