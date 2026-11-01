import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ModelWorkspace, MainHub, MfaStatus, MfaSetupResponse } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
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
  Menu,
  X,
  KeyRound,
  CheckCircle2,
  AlertCircle
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
  const { user, logout, refreshUserProfile } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 2FA Security Modal State
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<MfaSetupResponse | null>(null);
  const [mfaTotpCode, setMfaTotpCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [mfaActionError, setMfaActionError] = useState<string | null>(null);
  const [mfaActionSuccess, setMfaActionSuccess] = useState<string | null>(null);

  const loadMfaStatus = async () => {
    setMfaLoading(true);
    setMfaActionError(null);
    try {
      const st = await api.getMfaStatus();
      setMfaStatus(st);
    } catch (err: any) {
      console.warn('Could not load MFA status:', err);
    } finally {
      setMfaLoading(false);
    }
  };

  useEffect(() => {
    if (isMfaModalOpen) {
      loadMfaStatus();
      setMfaSetupData(null);
      setMfaTotpCode('');
      setDisablePassword('');
      setMfaActionSuccess(null);
    }
  }, [isMfaModalOpen]);

  const handleStartSetup = async () => {
    setMfaLoading(true);
    setMfaActionError(null);
    try {
      const data = await api.setupMfa();
      setMfaSetupData(data);
    } catch (err: any) {
      setMfaActionError(err.message || 'Errore durante la generazione 2FA');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleConfirmEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaSetupData || !mfaTotpCode.trim()) return;
    setMfaLoading(true);
    setMfaActionError(null);
    try {
      await api.enableMfa({
        secret: mfaSetupData.secret,
        totp_code: mfaTotpCode.trim()
      });
      setMfaActionSuccess('Autenticazione a due fattori attivata con successo!');
      setMfaSetupData(null);
      setMfaTotpCode('');
      await refreshUserProfile();
      await loadMfaStatus();
    } catch (err: any) {
      setMfaActionError(err.message || 'Codice TOTP non valido');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleConfirmDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword) return;
    setMfaLoading(true);
    setMfaActionError(null);
    try {
      await api.disableMfa({ password: disablePassword });
      setMfaActionSuccess('Autenticazione a due fattori disattivata.');
      setDisablePassword('');
      await refreshUserProfile();
      await loadMfaStatus();
    } catch (err: any) {
      setMfaActionError(err.message || 'Impossibile disattivare 2FA');
    } finally {
      setMfaLoading(false);
    }
  };

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
  const isViewer = user?.assignments?.some((a) => a.role === 'viewer') && !isAdmin;

  // Compute allowed Hubs based on user assignments and current library
  const allowedHubs: MainHub[] = useMemo(() => {
    if (!user) return ['business'];
    const assignments = user.assignments || [];

    // Global admin and viewer (demo) have access to all Hubs
    if (isAdmin || isViewer) {
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
  }, [user, isAdmin, isViewer, selectedModelId]);

  // Ensure activeHub is valid
  useEffect(() => {
    if (!allowedHubs.includes(activeHub)) {
      onSelectHub(allowedHubs[0] || 'business');
    }
  }, [allowedHubs, activeHub, onSelectHub]);

  const primaryRole = isAdmin
    ? t.rbac.roleAdminName
    : isViewer
    ? (t.rbac.roleViewerName || '👁️ Demo (Sola Lettura)')
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
            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200 hidden sm:inline-block">
              v1.0.0
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
        
        {/* Demo Mode Pill */}
        {isViewer && (
          <div className="hidden md:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200/90 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <span>👁️ {t.rbac.demoModeBadge || 'Modalità Demo (Sola Lettura)'}</span>
          </div>
        )}

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

                {/* 2FA Security & Logout Actions */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsMfaModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition cursor-pointer"
                  >
                    <div className="flex items-center space-x-1.5">
                      <Shield className="w-3.5 h-3.5 text-rose-600" />
                      <span>Sicurezza & 2FA</span>
                    </div>
                    {user.is_mfa_enabled ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Attivo
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        Non attivo
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition cursor-pointer"
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

      {/* MFA Security Self-Service Modal */}
      {isMfaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Autenticazione a Due Fattori (2FA)</h3>
                  <p className="text-[11px] text-slate-500">Protezione dell'account con RFC 6238 TOTP</p>
                </div>
              </div>
              <button
                onClick={() => setIsMfaModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {mfaActionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-800 text-xs animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{mfaActionError}</span>
                </div>
              )}

              {mfaActionSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2 text-emerald-800 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{mfaActionSuccess}</span>
                </div>
              )}

              {/* Status Header */}
              {user?.is_local === false || (user?.auth_provider && user?.auth_provider !== 'local') ? (
                <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 text-xs text-indigo-900">
                  <div className="flex items-center space-x-2 font-bold">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    <span>Account Federato (SSO)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-indigo-800">
                    Il tuo account accede tramite Identity Provider aziendale ({user?.auth_provider || 'Keycloak'}).
                    Le opzioni di sicurezza e il secondo fattore di autenticazione sono gestiti direttamente sul portale dell'IdP.
                  </p>
                </div>
              ) : user?.is_mfa_enabled ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-900">2FA Attiva sul tuo account</div>
                        <div className="text-[10px] text-emerald-700">One-Time Password richiesta ad ogni accesso</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/60 text-emerald-800 border border-emerald-300">
                      Protetto
                    </span>
                  </div>

                  {mfaStatus?.is_enforced ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start space-x-2">
                      <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Policy Aziendale Obbligatoria:</strong> L'autenticazione a due fattori è richiesta per il tuo ruolo e non può essere disattivata.
                      </span>
                    </div>
                  ) : (
                    <form onSubmit={handleConfirmDisable} className="pt-2 border-t border-slate-100 space-y-3">
                      <label className="block text-xs font-bold text-slate-700">
                        Disattiva 2FA (Richiede la tua password attuale)
                      </label>
                      <input
                        type="password"
                        required
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        placeholder="Inserisci la tua password..."
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                      />
                      <button
                        type="submit"
                        disabled={mfaLoading || !disablePassword}
                        className="w-full py-2 px-3 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer disabled:opacity-50"
                      >
                        {mfaLoading ? 'Disattivazione...' : 'Conferma Disattivazione 2FA'}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                /* Not Enabled yet */
                <div className="space-y-4">
                  {!mfaSetupData ? (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Aggiungi un livello di protezione supplementare al tuo account. Quando accedi, oltre alla password ti verrà richiesto un codice a 6 cifre generato da un'app sul tuo smartphone.
                      </p>
                      <button
                        type="button"
                        onClick={handleStartSetup}
                        disabled={mfaLoading}
                        className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition cursor-pointer disabled:opacity-50"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>{mfaLoading ? 'Generazione...' : 'Configura 2FA con App Authenticator'}</span>
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleConfirmEnable} className="space-y-4">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <div className="flex justify-center p-3 bg-white rounded-xl border border-slate-200 shadow-xs max-w-[220px] mx-auto">
                          <img
                            src={
                              mfaSetupData.qr_code_data_url ||
                              (mfaSetupData.qr_code_svg?.startsWith('data:')
                                ? mfaSetupData.qr_code_svg
                                : `data:image/svg+xml;utf8,${encodeURIComponent(mfaSetupData.qr_code_svg || '')}`)
                            }
                            alt="EasyEA 2FA QR Code"
                            className="w-44 h-44 object-contain mx-auto"
                          />
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] text-slate-400 block mb-0.5">Chiave segreta manuale:</span>
                          <code className="text-xs font-mono font-bold bg-white px-2 py-1 border border-slate-200 rounded-lg text-slate-800 select-all tracking-wider inline-block">
                            {mfaSetupData.secret}
                          </code>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Digita il codice a 6 cifre generato dall'app:
                        </label>
                        <input
                          type="text"
                          required
                          autoFocus
                          maxLength={6}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={mfaTotpCode}
                          onChange={(e) => setMfaTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="000000"
                          className="w-full text-center font-mono font-bold text-xl py-2 tracking-[0.3em] border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                        />
                      </div>

                      <div className="flex space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setMfaSetupData(null)}
                          className="w-1/3 py-2 px-3 text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
                        >
                          Annulla
                        </button>
                        <button
                          type="submit"
                          disabled={mfaLoading || mfaTotpCode.length < 6}
                          className="w-2/3 py-2 px-3 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition cursor-pointer disabled:opacity-50"
                        >
                          {mfaLoading ? 'Verifica...' : 'Verifica e Attiva 2FA'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsMfaModalOpen(false)}
                className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

    </header>
  );
};
