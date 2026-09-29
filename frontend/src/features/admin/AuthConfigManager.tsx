import React, { useState, useEffect } from 'react';
import { ModelWorkspace, SystemAuthSettings, RoleMappingRule, ClaimType, RoleType, IdpConnectionTestResult } from '../../types';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import {
  Shield,
  KeyRound,
  Server,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Globe,
  Sliders,
  Sparkles,
  Save,
  Info,
  FolderGit2
} from 'lucide-react';

interface AuthConfigManagerProps {
  models: ModelWorkspace[];
}

export const AuthConfigManager: React.FC<AuthConfigManagerProps> = ({ models }) => {
  const { t, interpolate } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Main Form State
  const [settings, setSettings] = useState<SystemAuthSettings>({
    allow_local_login: true,
    allow_idp_login: true,
    provider_name: 'Keycloak SSO',
    issuer_url: 'http://localhost:18000/realms/dev-realm',
    client_id: 'easyea-client',
    client_secret: 'easyea-dev-secret-key-2026',
    scopes: 'openid profile email roles',
    prompt_login: false,
    enable_single_logout: true,
    rbac_mode: 'hybrid',
    role_mappings: []
  });

  const [showClientSecret, setShowClientSecret] = useState(false);

  // IdP Connection Test State
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<IdpConnectionTestResult | null>(null);

  // Mapping Rule Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<RoleMappingRule>({
    id: '',
    claim_type: 'realm_role',
    claim_name: '',
    expected_value: '',
    target_role: 'architect',
    target_model_id: null,
    description: ''
  });

  const loadConfig = async () => {
    setLoading(true);
    setSaveError(null);
    try {
      const cfg = await api.getAdminAuthConfig();
      setSettings(cfg);
    } catch (err: any) {
      setSaveError(err.message || t.authConfig.loadErrorGeneric);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleToggleLocal = () => {
    if (settings.allow_local_login && !settings.allow_idp_login) {
      setSaveError(t.authConfig.lockoutError);
      return;
    }
    setSaveError(null);
    setSettings(prev => ({ ...prev, allow_local_login: !prev.allow_local_login }));
  };

  const handleToggleIdp = () => {
    if (settings.allow_idp_login && !settings.allow_local_login) {
      setSaveError(t.authConfig.lockoutError);
      return;
    }
    setSaveError(null);
    setSettings(prev => ({ ...prev, allow_idp_login: !prev.allow_idp_login }));
  };

  const handleTestConnection = async () => {
    if (!settings.issuer_url.trim()) return;
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await api.testIdpConnection(settings.issuer_url.trim());
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || t.authConfig.connectionFailed
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveAll = async () => {
    if (!settings.allow_local_login && !settings.allow_idp_login) {
      setSaveError(t.authConfig.lockoutError);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const res = await api.updateAdminAuthConfig(settings);
      setSettings(res.config);
      setSaveSuccess(res.message || t.authConfig.saveSuccess);
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err: any) {
      setSaveError(err.message || t.authConfig.saveErrorGeneric);
    } finally {
      setSaving(false);
    }
  };

  const openAddRuleModal = () => {
    setEditingRuleId(null);
    setRuleForm({
      id: `rule-${Date.now()}`,
      claim_type: 'realm_role',
      claim_name: '',
      expected_value: '',
      target_role: 'architect',
      target_model_id: null,
      description: ''
    });
    setModalOpen(true);
  };

  const openEditRuleModal = (rule: RoleMappingRule) => {
    setEditingRuleId(rule.id);
    setRuleForm({ ...rule });
    setModalOpen(true);
  };

  const handleDeleteRule = (ruleId: string) => {
    setSettings(prev => ({
      ...prev,
      role_mappings: prev.role_mappings.filter(r => r.id !== ruleId)
    }));
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.claim_name.trim()) return;

    if (editingRuleId) {
      setSettings(prev => ({
        ...prev,
        role_mappings: prev.role_mappings.map(r => r.id === editingRuleId ? ruleForm : r)
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        role_mappings: [...prev.role_mappings, { ...ruleForm, id: ruleForm.id || `rule-${Date.now()}` }]
      }));
    }
    setModalOpen(false);
  };

  const handleRestoreDefaultMappings = () => {
    const defaults: RoleMappingRule[] = [
      {
        id: 'map-admin-role',
        claim_type: 'realm_role',
        claim_name: 'admin',
        expected_value: '',
        target_role: 'admin',
        target_model_id: null,
        description: t.authConfig.defAdminRole
      },
      {
        id: 'map-admin-group',
        claim_type: 'group',
        claim_name: 'easyea-admins',
        expected_value: '',
        target_role: 'admin',
        target_model_id: null,
        description: t.authConfig.defAdminGroup
      },
      {
        id: 'map-arch-role',
        claim_type: 'realm_role',
        claim_name: 'architect',
        expected_value: '',
        target_role: 'architect',
        target_model_id: null,
        description: t.authConfig.defArchRole
      },
      {
        id: 'map-arch-group',
        claim_type: 'group',
        claim_name: 'easyea-architects',
        expected_value: '',
        target_role: 'architect',
        target_model_id: null,
        description: t.authConfig.defArchGroup
      },
      {
        id: 'map-analyst-role',
        claim_type: 'realm_role',
        claim_name: 'analyst',
        expected_value: '',
        target_role: 'analyst',
        target_model_id: null,
        description: t.authConfig.defAnalystRole
      },
      {
        id: 'map-exec-role',
        claim_type: 'realm_role',
        claim_name: 'executive',
        expected_value: '',
        target_role: 'executive',
        target_model_id: null,
        description: t.authConfig.defExecRole
      }
    ];
    setSettings(prev => ({ ...prev, role_mappings: defaults }));
  };

  const getClaimTypeBadge = (type: ClaimType) => {
    switch (type) {
      case 'realm_role':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-800 border border-purple-200">{t.authConfig.claimRealmRole}</span>;
      case 'client_role':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">{t.authConfig.claimClientRole}</span>;
      case 'group':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">{t.authConfig.claimGroup}</span>;
      case 'custom_claim':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">{t.authConfig.claimCustom}</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700">{type}</span>;
    }
  };

  const getRoleBadge = (role: RoleType) => {
    switch (role) {
      case 'admin':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-200">Admin</span>;
      case 'architect':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Architect</span>;
      case 'analyst':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-100 text-sky-800 border border-sky-200">Analyst</span>;
      case 'executive':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">Executive</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700">{role}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
        <RefreshCw className="w-6 h-6 text-rose-600 animate-spin mr-3" />
        <span className="text-sm font-medium text-slate-600">{t.authConfig.loading}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t.authConfig.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.authConfig.subtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={loadConfig}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
            title={t.authConfig.reload}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center space-x-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? t.authConfig.saving : t.authConfig.saveAll}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-3 text-emerald-900 text-xs shadow-xs animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-3 text-rose-900 text-xs shadow-xs animate-shake">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-medium">{saveError}</span>
        </div>
      )}

      {/* SECTION 1: Metodi di Accesso Abilitati */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-rose-600" />
            <span>{t.authConfig.section1Title}</span>
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            {t.authConfig.section1Desc}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Local Login Switch */}
          <div className={`p-4 rounded-xl border transition flex items-center justify-between ${
            settings.allow_local_login ? 'bg-slate-50/80 border-slate-300' : 'bg-slate-100/50 border-slate-200 opacity-80'
          }`}>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold text-slate-900">{t.authConfig.localLoginTitle}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {t.authConfig.localLoginDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleLocal}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                settings.allow_local_login ? 'bg-rose-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  settings.allow_local_login ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* IdP SSO Login Switch */}
          <div className={`p-4 rounded-xl border transition flex items-center justify-between ${
            settings.allow_idp_login ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-100/50 border-slate-200 opacity-80'
          }`}>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-900">{t.authConfig.idpLoginTitle}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {t.authConfig.idpLoginDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleIdp}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                settings.allow_idp_login ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  settings.allow_idp_login ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2 text-amber-900 text-xs">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>{t.authConfig.lockoutWarningTitle}</strong> {t.authConfig.lockoutWarningDesc}
          </span>
        </div>
      </div>

      {/* SECTION 2: Parametri di Connessione Identity Provider (OAuth2 / OIDC) */}
      <div className={`bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 transition ${
        !settings.allow_idp_login ? 'opacity-50 pointer-events-none' : ''
      }`}>
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-600" />
              <span>{t.authConfig.section2Title}</span>
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              {t.authConfig.section2Desc}
            </p>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold">
            OIDC Core 1.0
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.authConfig.providerNameLabel}
            </label>
            <input
              type="text"
              value={settings.provider_name}
              onChange={(e) => setSettings({ ...settings, provider_name: e.target.value })}
              placeholder={t.authConfig.providerNamePlaceholder}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.authConfig.issuerUrlLabel}
            </label>
            <input
              type="text"
              value={settings.issuer_url}
              onChange={(e) => setSettings({ ...settings, issuer_url: e.target.value })}
              placeholder={t.authConfig.issuerUrlPlaceholder}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              {t.authConfig.issuerUrlHelp} <code className="bg-slate-100 px-1 rounded font-mono">/.well-known/openid-configuration</code>.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.authConfig.clientIdLabel}
            </label>
            <input
              type="text"
              value={settings.client_id}
              onChange={(e) => setSettings({ ...settings, client_id: e.target.value })}
              placeholder={t.authConfig.clientIdPlaceholder}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.authConfig.clientSecretLabel}
            </label>
            <div className="relative rounded-xl shadow-xs">
              <input
                type={showClientSecret ? 'text' : 'password'}
                value={settings.client_secret || ''}
                onChange={(e) => setSettings({ ...settings, client_secret: e.target.value })}
                placeholder={t.authConfig.clientSecretPlaceholder}
                className="w-full px-3 pr-10 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowClientSecret(!showClientSecret)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.authConfig.scopesLabel}
            </label>
            <input
              type="text"
              value={settings.scopes}
              onChange={(e) => setSettings({ ...settings, scopes: e.target.value })}
              placeholder={t.authConfig.scopesPlaceholder}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
            />
          </div>
        </div>

        {/* Toggles for prompt=login and single logout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <span className="text-xs font-bold text-slate-800">{t.authConfig.promptLoginLabel}</span>
              <p className="text-[10px] text-slate-500">{t.authConfig.promptLoginDesc}</p>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ ...settings, prompt_login: !settings.prompt_login })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                settings.prompt_login ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  settings.prompt_login ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <span className="text-xs font-bold text-slate-800">{t.authConfig.singleLogoutLabel}</span>
              <p className="text-[10px] text-slate-500">{t.authConfig.singleLogoutDesc}</p>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ ...settings, enable_single_logout: !settings.enable_single_logout })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                settings.enable_single_logout ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  settings.enable_single_logout ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* IdP Connectivity Test Button & Result Box */}
        <div className="pt-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection || !settings.issuer_url.trim()}
              className="flex items-center space-x-2 px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-300 text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer"
            >
              {testingConnection ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{testingConnection ? t.authConfig.testingConnection : t.authConfig.testConnectionBtn}</span>
            </button>
          </div>

          {testResult && (
            <div className={`mt-3 p-4 rounded-xl border text-xs space-y-2 ${
              testResult.success ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}>
              <div className="flex items-center space-x-2 font-bold">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                )}
                <span>{testResult.message}</span>
              </div>

              {testResult.success && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pt-2 border-t border-emerald-200 text-[11px] font-mono">
                  <div className="p-2 bg-white/70 rounded-lg border border-emerald-200">
                    <span className="block font-sans font-bold text-emerald-800 text-[10px]">{t.authConfig.authEndpoint}</span>
                    <span className="truncate block">{testResult.authorization_endpoint}</span>
                  </div>
                  <div className="p-2 bg-white/70 rounded-lg border border-emerald-200">
                    <span className="block font-sans font-bold text-emerald-800 text-[10px]">{t.authConfig.tokenEndpoint}</span>
                    <span className="truncate block">{testResult.token_endpoint}</span>
                  </div>
                  <div className="p-2 bg-white/70 rounded-lg border border-emerald-200">
                    <span className="block font-sans font-bold text-emerald-800 text-[10px]">{t.authConfig.userinfoEndpoint}</span>
                    <span className="truncate block">{testResult.userinfo_endpoint || 'N/A'}</span>
                  </div>
                  <div className="p-2 bg-white/70 rounded-lg border border-emerald-200">
                    <span className="block font-sans font-bold text-emerald-800 text-[10px]">{t.authConfig.endSessionEndpoint}</span>
                    <span className="truncate block">{testResult.end_session_endpoint || 'N/A'}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: Modalità RBAC & Mappatura Ruoli JWT */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="border-b border-slate-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>{t.authConfig.section3Title}</span>
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              {t.authConfig.section3Desc}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleRestoreDefaultMappings}
              className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
            >
              {t.authConfig.restoreDefaults}
            </button>
            <button
              type="button"
              onClick={openAddRuleModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.authConfig.addRule}</span>
            </button>
          </div>
        </div>

        {/* RBAC Mode Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            {t.authConfig.rbacPolicyLabel}
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setSettings({ ...settings, rbac_mode: 'hybrid' })}
              className={`p-3 text-left rounded-xl border transition cursor-pointer ${
                settings.rbac_mode === 'hybrid'
                  ? 'bg-rose-50/50 border-rose-500 ring-2 ring-rose-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{t.authConfig.rbacHybridTitle}</span>
                {settings.rbac_mode === 'hybrid' && <CheckCircle2 className="w-4 h-4 text-rose-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {t.authConfig.rbacHybridDesc}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSettings({ ...settings, rbac_mode: 'idp_sync' })}
              className={`p-3 text-left rounded-xl border transition cursor-pointer ${
                settings.rbac_mode === 'idp_sync'
                  ? 'bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{t.authConfig.rbacSyncTitle}</span>
                {settings.rbac_mode === 'idp_sync' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {t.authConfig.rbacSyncDesc}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSettings({ ...settings, rbac_mode: 'internal' })}
              className={`p-3 text-left rounded-xl border transition cursor-pointer ${
                settings.rbac_mode === 'internal'
                  ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{t.authConfig.rbacInternalTitle}</span>
                {settings.rbac_mode === 'internal' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {t.authConfig.rbacInternalDesc}
              </p>
            </button>
          </div>
        </div>

        {/* Rules Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              {interpolate(t.authConfig.configuredRulesCount, { count: settings.role_mappings?.length || 0 })}
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">{t.authConfig.thClaimType}</th>
                  <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">{t.authConfig.thClaimName}</th>
                  <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">{t.authConfig.thExpectedValue}</th>
                  <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">{t.authConfig.thEasyEARole}</th>
                  <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">{t.authConfig.thScope}</th>
                  <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">{t.authConfig.thDescription}</th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-slate-600">{t.authConfig.thActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(!settings.role_mappings || settings.role_mappings.length === 0) ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      {t.authConfig.noRulesDefined}
                    </td>
                  </tr>
                ) : (
                  settings.role_mappings.map((rule) => {
                    const targetWorkspace = rule.target_model_id ? models.find(m => m.id === rule.target_model_id) : null;
                    return (
                      <tr key={rule.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          {getClaimTypeBadge(rule.claim_type)}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono font-bold text-slate-800">
                          {rule.claim_name}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-slate-500">
                          {rule.expected_value || <span className="text-slate-300 italic">{t.authConfig.anyValue}</span>}
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          {getRoleBadge(rule.target_role)}
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-600">
                          {targetWorkspace ? (
                            <span className="font-semibold text-indigo-700">
                              {interpolate(t.authConfig.libraryPrefix, { code: targetWorkspace.code || '----', name: targetWorkspace.name })}
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-500">{t.authConfig.globalScope}</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-500 max-w-xs truncate">
                          {rule.description || '-'}
                        </td>
                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap space-x-1">
                          <button
                            type="button"
                            onClick={() => openEditRuleModal(rule)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title={t.authConfig.editRule}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title={t.authConfig.deleteRule}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 4: Schema Repository & Version Retention */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-purple-600" />
            <span>Schema Repository & Conservazione Storico Versioni</span>
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            Configura le policy globali di retention per le versioni storiche degli schemi ArchiMate importati.
          </p>
        </div>

        <div className="max-w-md space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Numero Massimo di Versioni da Conservare per Schema (N)
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="number"
              min={1}
              max={100}
              value={settings.max_schema_versions ?? 10}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  max_schema_versions: parseInt(e.target.value) || 10
                })
              }
              className="w-32 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 font-bold"
            />
            <span className="text-xs text-slate-500">versioni (default: 10)</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Durante ogni operazione di Check-in, le versioni più vecchie oltre questo limite verranno automaticamente eliminate.
          </p>
        </div>
      </div>

      {/* MODAL: Aggiungi / Modifica Regola di Mapping */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingRuleId ? t.authConfig.modalTitleEdit : t.authConfig.modalTitleAdd}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.authConfig.modalClaimTypeLabel}
                </label>
                <select
                  value={ruleForm.claim_type}
                  onChange={(e) => setRuleForm({ ...ruleForm, claim_type: e.target.value as ClaimType })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-slate-900 bg-white"
                >
                  <option value="realm_role">{t.authConfig.optRealmRole}</option>
                  <option value="client_role">{t.authConfig.optClientRole}</option>
                  <option value="group">{t.authConfig.optGroup}</option>
                  <option value="custom_claim">{t.authConfig.optCustomClaim}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.authConfig.modalClaimNameLabel}
                </label>
                <input
                  type="text"
                  required
                  value={ruleForm.claim_name}
                  onChange={(e) => setRuleForm({ ...ruleForm, claim_name: e.target.value })}
                  placeholder={t.authConfig.modalClaimNamePlaceholder}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-slate-900 font-mono"
                />
              </div>

              {ruleForm.claim_type === 'custom_claim' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t.authConfig.modalExpectedValLabel}
                  </label>
                  <input
                    type="text"
                    value={ruleForm.expected_value || ''}
                    onChange={(e) => setRuleForm({ ...ruleForm, expected_value: e.target.value })}
                    placeholder={t.authConfig.modalExpectedValPlaceholder}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-slate-900 font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t.authConfig.modalTargetRoleLabel}
                  </label>
                  <select
                    value={ruleForm.target_role}
                    onChange={(e) => setRuleForm({ ...ruleForm, target_role: e.target.value as RoleType })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-slate-900 bg-white"
                  >
                    <option value="admin">{t.authConfig.roleAdmin}</option>
                    <option value="architect">{t.authConfig.roleArchitect}</option>
                    <option value="analyst">{t.authConfig.roleAnalyst}</option>
                    <option value="executive">{t.authConfig.roleExecutive}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t.authConfig.modalScopeLabel}
                  </label>
                  <select
                    value={ruleForm.target_model_id || ''}
                    onChange={(e) => setRuleForm({ ...ruleForm, target_model_id: e.target.value ? e.target.value : null })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-slate-900 bg-white"
                  >
                    <option value="">{t.authConfig.globalScopeOption}</option>
                    {models.map(m => (
                      <option key={m.id} value={m.id}>📚 [{m.code || '----'}] {m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.authConfig.modalDescLabel}
                </label>
                <input
                  type="text"
                  value={ruleForm.description || ''}
                  onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                  placeholder={t.authConfig.modalDescPlaceholder}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl transition cursor-pointer"
                >
                  {t.authConfig.modalCancelBtn}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  {editingRuleId ? t.authConfig.modalUpdateBtn : t.authConfig.modalAddBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
