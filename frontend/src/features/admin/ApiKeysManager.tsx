import React, { useState, useEffect } from 'react';
import { ApiKeyItem, ApiKeyCreatedResponse, SystemAuthSettings } from '../../types';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import {
  Key,
  Bot,
  ShieldCheck,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Search,
  AlertCircle,
  X,
  Code2
} from 'lucide-react';

interface ApiKeysManagerProps {
  readOnly?: boolean;
}

export const ApiKeysManager: React.FC<ApiKeysManagerProps> = ({ readOnly = false }) => {
  const { t, interpolate } = useLanguage();
  const m = t.apiKeysMgr;

  // State
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [authSettings, setAuthSettings] = useState<SystemAuthSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // MCP Toggle State
  const [togglingMcp, setTogglingMcp] = useState<boolean>(false);
  const [mcpToggleSuccess, setMcpToggleSuccess] = useState<string | null>(null);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedExpiry, setSelectedExpiry] = useState<number | null>(90);
  const [creatingKey, setCreatingKey] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Success Modal (One-time key display)
  const [createdKeyData, setCreatedKeyData] = useState<ApiKeyCreatedResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  // Revoke state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedKeys, fetchedUsers, fetchedConfig] = await Promise.all([
        api.getApiKeys().catch(() => []),
        api.getUsers().catch(() => []),
        api.getAdminAuthConfig().catch(() => null)
      ]);
      setKeys(fetchedKeys);
      setUsers(fetchedUsers);
      if (fetchedConfig) {
        setAuthSettings(fetchedConfig);
      }
    } catch (err: any) {
      console.error('Error loading API keys data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Toggle MCP Queries Access
  const handleToggleMcpAccess = async () => {
    if (readOnly || !authSettings || togglingMcp) return;
    const newStatus = authSettings.allow_mcp_access === false ? true : false;
    setTogglingMcp(true);
    setMcpToggleSuccess(null);
    try {
      const res = await api.updateAdminAuthConfig({ allow_mcp_access: newStatus });
      setAuthSettings(res.config);
      setMcpToggleSuccess(newStatus ? m.mcpEnableSuccess : m.mcpDisableSuccess);
      setTimeout(() => setMcpToggleSuccess(null), 4000);
    } catch (err: any) {
      alert(interpolate(m.mcpToggleError, { error: err.message }));
    } finally {
      setTogglingMcp(false);
    }
  };

  // Create Key
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setCreatingKey(true);
    setCreateError(null);
    try {
      const payload: { name: string; expires_in_days?: number | null; user_id?: string | null } = {
        name: newKeyName.trim(),
        expires_in_days: selectedExpiry && selectedExpiry > 0 ? selectedExpiry : null
      };
      if (selectedUserId) {
        payload.user_id = selectedUserId;
      }

      const res = await api.createApiKey(payload);
      setCreatedKeyData(res);
      setShowCreateModal(false);
      setNewKeyName('');
      setSelectedUserId('');
      setSelectedExpiry(90);
      loadData();
    } catch (err: any) {
      setCreateError(err.message || m.createErrorGeneric);
    } finally {
      setCreatingKey(false);
    }
  };

  // Revoke Key
  const handleRevokeKey = async (keyItem: ApiKeyItem) => {
    if (readOnly) return;
    const confirm = window.confirm(
      interpolate(m.revokeConfirm, { name: keyItem.name, prefix: keyItem.prefix })
    );
    if (!confirm) return;

    setRevokingId(keyItem.id);
    try {
      await api.revokeApiKey(keyItem.id);
      setKeys(prev => prev.map(k => (k.id === keyItem.id ? { ...k, is_active: false } : k)));
    } catch (err: any) {
      alert(interpolate(m.revokeError, { error: err.message }));
    } finally {
      setRevokingId(null);
    }
  };

  // Copy to clipboard
  const handleCopyKey = () => {
    if (!createdKeyData?.raw_key) return;
    navigator.clipboard.writeText(createdKeyData.raw_key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 3000);
  };

  // Helper to find user metadata
  const getUserInfo = (userId: string) => {
    return users.find(u => u.id === userId);
  };

  const isMcpEnabled = authSettings ? authSettings.allow_mcp_access !== false : true;

  // Filter keys
  const filteredKeys = keys.filter(k => {
    const q = searchFilter.toLowerCase();
    const user = getUserInfo(k.user_id);
    const userName = user ? `${user.username || ''} ${user.full_name || ''}`.toLowerCase() : '';
    return k.name.toLowerCase().includes(q) || k.prefix.toLowerCase().includes(q) || userName.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. MCP Administrative Global Access Toggle */}
      {/* ========================================================================= */}
      <div className={`p-5 rounded-2xl border transition-all duration-200 shadow-sm ${
        isMcpEnabled
          ? 'bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/50 border-emerald-200/80'
          : 'bg-gradient-to-r from-amber-50/80 via-white to-rose-50/50 border-amber-200/80'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className={`p-2.5 rounded-xl border ${
              isMcpEnabled
                ? 'bg-emerald-100/70 border-emerald-300 text-emerald-800'
                : 'bg-amber-100/70 border-amber-300 text-amber-800'
            }`}>
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="text-sm font-bold text-slate-900">
                  {m.mcpBannerTitle}
                </h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isMcpEnabled
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {isMcpEnabled ? m.mcpActiveBadge : m.mcpDisabledBadge}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                {m.mcpBannerDesc}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={handleToggleMcpAccess}
              disabled={readOnly || togglingMcp}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                isMcpEnabled ? 'bg-emerald-600' : 'bg-slate-300'
              } ${readOnly || togglingMcp ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isMcpEnabled ? m.mcpDisableTitle : m.mcpEnableTitle}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isMcpEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {mcpToggleSuccess && (
          <div className="mt-3 text-xs font-medium text-emerald-700 bg-emerald-100/60 border border-emerald-200 rounded-lg px-3 py-1.5 flex items-center space-x-1.5">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{mcpToggleSuccess}</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. API Keys Management Section */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Top Action Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Key className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">{m.cardTitle}</h3>
              <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                {interpolate(m.activeCount, { count: keys.filter(k => k.is_active).length })}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {m.cardSubtitle}
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder={m.searchPlaceholder}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 sm:w-56"
              />
            </div>

            {/* Refresh */}
            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition"
              title={m.refreshTooltip}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Create Button */}
            {!readOnly && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>{m.newKeyBtn}</span>
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">{m.thNamePrefix}</th>
                <th className="py-3 px-4">{m.thUser}</th>
                <th className="py-3 px-4">{m.thRoles}</th>
                <th className="py-3 px-4">{m.thCreatedAt}</th>
                <th className="py-3 px-4">{m.thExpiresAt}</th>
                <th className="py-3 px-4">{m.thLastUsed}</th>
                <th className="py-3 px-4">{m.thStatus}</th>
                <th className="py-3 px-4 text-right">{m.thActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    {m.loading}
                  </td>
                </tr>
              ) : filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    <Key className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    {m.emptyState}
                  </td>
                </tr>
              ) : (
                filteredKeys.map(k => {
                  const user = getUserInfo(k.user_id);
                  const isExpired = k.expires_at ? new Date(k.expires_at) < new Date() : false;
                  const isActive = k.is_active && !isExpired;

                  return (
                    <tr key={k.id} className="hover:bg-slate-50/70 transition">
                      {/* Name & Prefix */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{k.name}</div>
                        <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                          {k.prefix}
                        </div>
                      </td>

                      {/* User */}
                      <td className="py-3.5 px-4">
                        {user ? (
                          <div>
                            <div className="font-medium text-slate-800">{user.full_name || user.username}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">{k.user_id}</span>
                        )}
                      </td>

                      {/* Roles */}
                      <td className="py-3.5 px-4">
                        {user && user.assignments && user.assignments.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.assignments.map((a: any, i: number) => (
                              <span
                                key={i}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                  a.role === 'admin'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : a.role === 'architect'
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {a.role}
                                {a.model_id ? ` (${a.model_id.slice(0, 10)})` : ' [Global]'}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">{m.noRoles}</span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {k.created_at ? new Date(k.created_at).toLocaleDateString() : '—'}
                      </td>

                      {/* Expiry */}
                      <td className="py-3.5 px-4">
                        {k.expires_at ? (
                          <span className={isExpired ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                            {new Date(k.expires_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium">{m.neverExpires}</span>
                        )}
                      </td>

                      {/* Last Used */}
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : (
                          <span className="text-slate-400 italic font-sans">{m.neverUsed}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {m.statusActive}
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {m.statusExpired}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            {m.statusRevoked}
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        {k.is_active && !readOnly && (
                          <button
                            onClick={() => handleRevokeKey(k)}
                            disabled={revokingId === k.id}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title={m.revokeTooltip}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. Modal: Generate New API Key */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <Key className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">{m.modalCreateTitle}</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="p-5 space-y-4">
              {createError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {m.keyNameLabel}
                </label>
                <input
                  type="text"
                  required
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder={m.keyNamePlaceholder}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* User / Service Account Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {m.userSelectLabel}
                </label>
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="">{m.currentUserOption}</option>
                  {users.map(u => {
                    const roles = (u.assignments || []).map((a: any) => a.role).join(', ') || m.noRoles;
                    return (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.username} ({u.email}) — {interpolate(m.userRolesDisplay, { roles })}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {m.userSelectHelp}
                </p>
              </div>

              {/* Expiry */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {m.expiryLabel}
                </label>
                <select
                  value={selectedExpiry !== null ? selectedExpiry : ''}
                  onChange={e => setSelectedExpiry(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="30">{m.opt30Days}</option>
                  <option value="90">{m.opt90Days}</option>
                  <option value="180">{m.opt180Days}</option>
                  <option value="365">{m.opt365Days}</option>
                  <option value="">{m.optPermanent}</option>
                </select>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  {m.cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={creatingKey || !newKeyName.trim()}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {creatingKey ? m.generatingBtn : m.generateBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. Modal: Key Generated Success (One-Time Token Display) */}
      {/* ========================================================================= */}
      {createdKeyData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-200 bg-emerald-50/70 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-emerald-800">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold">{m.modalSuccessTitle}</h3>
              </div>
              <button
                onClick={() => setCreatedKeyData(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Alert */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                <div className="flex items-center space-x-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{m.securityNoticeTitle}</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {m.securityNoticeDesc}
                </p>
              </div>

              {/* Raw Key Display Box */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {interpolate(m.secretKeyFor, { name: createdKeyData.name })}
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={createdKeyData.raw_key}
                    className="w-full font-mono text-[11px] px-3 py-2.5 bg-slate-900 text-emerald-400 rounded-lg select-all border border-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg flex items-center space-x-1 shrink-0 transition"
                  >
                    {copiedKey ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>{m.copiedBtn}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-white" />
                        <span>{m.copyBtn}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Usage snippet */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{m.mcpConfigSnippetTitle}</span>
                </div>
                <pre className="font-mono text-[10px] bg-white p-2 rounded border border-slate-200 text-slate-700 overflow-x-auto">
{`"env": {
  "EASYEA_BASE_URL": "http://localhost:8000/api",
  "EASYEA_API_KEY": "${createdKeyData.raw_key}"
}`}
                </pre>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setCreatedKeyData(null)}
                  className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition"
                >
                  {m.savedCloseBtn}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
