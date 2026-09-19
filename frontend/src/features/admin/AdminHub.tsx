import React, { useState, useEffect } from 'react';
import { ModelWorkspace, AdminSubTab } from '../../types';
import { api } from '../../lib/api';
import { suggestLibraryCode, sanitizeLibraryCode } from '../../lib/codeGenerator';
import {
  Plus,
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Shield,
  Clock,
  Key,
  Layers,
  Sparkles
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { MetamodelManager } from './MetamodelManager';
import { RolesManager } from './RolesManager';
import { AuthConfigManager } from './AuthConfigManager';

interface AdminHubProps {
  models: ModelWorkspace[];
  selectedModelId: string;
  onRefreshModels: () => void;
  onSelectModel: (id: string) => void;
  subTab: AdminSubTab;
  onSelectSubTab: (subTab: AdminSubTab) => void;
}

export const AdminHub: React.FC<AdminHubProps> = ({
  models,
  selectedModelId,
  onRefreshModels,
  onSelectModel,
  subTab,
  onSelectSubTab
}) => {
  const { t, interpolate } = useLanguage();

  // New model creation form
  const [newModelName, setNewModelName] = useState('');
  const [newModelCode, setNewModelCode] = useState('');
  const [isCodeManual, setIsCodeManual] = useState(false);
  const [newModelDesc, setNewModelDesc] = useState('');
  const [newModelVersion, setNewModelVersion] = useState('1.0.0');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // APM Config states
  const [investThreshold, setInvestThreshold] = useState(3);
  const [savingsAlertThreshold, setSavingsAlertThreshold] = useState(50000);
  const [configSaved, setConfigSaved] = useState(false);

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) return;

    const trimmedCode = newModelCode.trim().toUpperCase();
    if (trimmedCode && trimmedCode.length !== 4) {
      setFormError(t.admin.codeErrorFormat);
      return;
    }

    setCreating(true);
    setFormError(null);
    try {
      const created = await api.createEmptyModel({
        name: newModelName.trim(),
        code: trimmedCode || undefined,
        description: newModelDesc.trim(),
        version: newModelVersion.trim()
      });
      onRefreshModels();
      onSelectModel(created.id);
      setNewModelName('');
      setNewModelCode('');
      setIsCodeManual(false);
      setNewModelDesc('');
      setNewModelVersion('1.0.0');
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || t.admin.errorCreatingLibrary);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteModel = async (id: string) => {
    try {
      await api.deleteModel(id);
      setDeleteConfirmId(null);
      onRefreshModels();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportJson = async (id: string, name: string) => {
    try {
      const data = await api.exportModelJson(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/\s+/g, '_')}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title & Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t.admin.title}</h2>
          <p className="text-xs text-slate-600 mt-1">
            {t.admin.subtitle}
          </p>
        </div>
      </div>

      {/* SubTab 1: Libraries & Workspace */}
      {subTab === 'models' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Libraries List */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{t.admin.librariesRegisteredTitle}</h3>
                <p className="text-xs text-slate-500">{t.admin.librariesRegisteredSubtitle}</p>
              </div>
              <button
                onClick={onRefreshModels}
                className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {models.map((m) => {
                const isSelected = m.id === selectedModelId;
                return (
                  <div
                    key={m.id}
                    className={`p-4 rounded-xl border transition ${
                      isSelected
                        ? 'bg-rose-50/40 border-rose-400 ring-1 ring-rose-400/40'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] font-mono font-extrabold px-2 py-0.5 bg-slate-900 text-amber-300 rounded shadow-sm">
                            {m.code || '----'}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">{m.name}</h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                            v{m.version}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full">
                              {t.admin.activeTag}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{m.description || t.admin.noDesc}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleExportJson(m.id, m.name)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title={t.admin.exportJson}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(m.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title={t.admin.deleteLibrary}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center space-x-4">
                        <span>{interpolate(t.admin.elementsCount, { count: m.element_count })}</span>
                        <span>{interpolate(t.admin.relationsCount, { count: m.relationship_count })}</span>
                        <span>{interpolate(t.admin.viewsCount, { count: m.view_count })}</span>
                      </div>
                      {!isSelected && (
                        <button
                          onClick={() => onSelectModel(m.id)}
                          className="text-xs font-bold text-rose-600 hover:text-rose-800"
                        >
                          {t.admin.selectAsActive}
                        </button>
                      )}
                    </div>

                    {/* Delete confirmation modal */}
                    {deleteConfirmId === m.id && (
                      <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-2">
                        <p className="font-bold text-rose-800">
                          {t.admin.deleteConfirmTitle}
                        </p>
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2.5 py-1 text-slate-600 hover:text-slate-900 font-semibold"
                          >
                            {t.common.cancel}
                          </button>
                          <button
                            onClick={() => handleDeleteModel(m.id)}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold"
                          >
                            {t.admin.confirmDeleteBtn}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Create New Library */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-rose-600" />
                <span>{t.admin.createLibraryTitle}</span>
              </h3>
              <p className="text-xs text-slate-500">{t.admin.createLibrarySubtitle}</p>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateModel} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.admin.labelLibraryName}</label>
                <input
                  type="text"
                  required
                  placeholder={t.admin.placeholderLibraryName}
                  value={newModelName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewModelName(val);
                    if (!isCodeManual) {
                      setNewModelCode(suggestLibraryCode(val));
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">{t.admin.labelLibraryCode}</label>
                  <span className="text-[10px] text-slate-400 font-mono">{t.admin.charLimitHelp}</span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={4}
                  placeholder={t.admin.placeholderLibraryCode}
                  value={newModelCode}
                  onChange={(e) => {
                    setIsCodeManual(true);
                    setNewModelCode(sanitizeLibraryCode(e.target.value));
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white font-mono font-bold uppercase tracking-widest"
                />
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  {t.admin.helpLibraryCode}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.admin.labelInitialVersion}</label>
                <input
                  type="text"
                  placeholder="1.0.0"
                  value={newModelVersion}
                  onChange={(e) => setNewModelVersion(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.admin.labelDescriptionScope}</label>
                <textarea
                  rows={3}
                  placeholder={t.admin.placeholderDescriptionScope}
                  value={newModelDesc}
                  onChange={(e) => setNewModelDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition flex items-center justify-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{t.admin.createLibraryBtn}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SubTab: Metamodel Administration */}
      {subTab === 'metamodel' && (
        <MetamodelManager models={models} activeModelId={selectedModelId} />
      )}

      {/* SubTab 2: APM & TIME Config */}
      {subTab === 'apm_config' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 max-w-3xl">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">{t.admin.apmConfigTitle}</h3>
            <p className="text-xs text-slate-500">{t.admin.apmConfigSubtitle}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t.admin.investThresholdLabel}
              </label>
              <input
                type="range"
                min="2"
                max="4"
                step="1"
                value={investThreshold}
                onChange={(e) => setInvestThreshold(parseInt(e.target.value))}
                className="w-full accent-rose-600"
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-bold mt-1">
                <span>{t.admin.thresholdScaleMin}</span>
                <span className="text-rose-700 font-bold">{interpolate(t.admin.thresholdScaleCurrent, { val: investThreshold })}</span>
                <span>{t.admin.thresholdScaleMax}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t.admin.savingsThresholdLabel}
              </label>
              <input
                type="number"
                value={savingsAlertThreshold}
                onChange={(e) => setSavingsAlertThreshold(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {t.admin.savingsThresholdHint}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              {configSaved ? (
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> {t.admin.paramsSavedSuccess}
                </span>
              ) : <span />}
              <button
                type="button"
                onClick={() => {
                  setConfigSaved(true);
                  setTimeout(() => setConfigSaved(false), 3000);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition"
              >
                {t.admin.saveParamsBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 3: Roles & Permissions */}
      {subTab === 'roles' && (
        <RolesManager
          models={models}
          selectedModelId={selectedModelId}
        />
      )}

      {/* SubTab 4: Auth & IdP Configuration */}
      {subTab === 'auth_config' && (
        <AuthConfigManager
          models={models}
        />
      )}

      {/* SubTab 5: System & Database Health */}
      {subTab === 'system' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-rose-600" />
                <span>{t.admin.systemInfraTitle}</span>
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-600 font-medium">{t.admin.dbEngine}</span>
                <span className="font-bold text-slate-900">PostgreSQL 16 Enterprise</span>
              </div>
              <div className="flex justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-600 font-medium">{t.admin.hostPortBinding}</span>
                <span className="font-mono font-bold text-slate-900">{t.admin.portHostBindingVal}</span>
              </div>
              <div className="flex justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-600 font-medium">{t.admin.webServiceStatus}</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Healthy (Uvicorn / FastAPI 0.110)
                </span>
              </div>
              <div className="flex justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-600 font-medium">{t.admin.frontendAssets}</span>
                <span className="font-bold text-slate-900">React 18 + Vite SPA (Static Bundle)</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-600" />
                <span>{t.admin.recentAuditTitle}</span>
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">{t.admin.auditSeedTitle}</span>
                  <p className="text-[10px] text-slate-500">{t.admin.auditSeedDesc}</p>
                </div>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">SUCCESS</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">{t.admin.auditDriverTitle}</span>
                  <p className="text-[10px] text-slate-500">{t.admin.auditDriverDesc}</p>
                </div>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">SUCCESS</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">{t.admin.auditThemeTitle}</span>
                  <p className="text-[10px] text-slate-500">{t.admin.auditThemeDesc}</p>
                </div>
                <span className="text-[10px] text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded">COMPLETED</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

