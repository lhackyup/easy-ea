import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  Upload,
  FileCode,
  X
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { MetamodelManager } from './MetamodelManager';
import { AttributePackagesManager } from './AttributePackagesManager';
import { RolesManager } from './RolesManager';
import { AuthConfigManager } from './AuthConfigManager';
import { ApiKeysManager } from './ApiKeysManager';
import { AuditLogsManager } from './AuditLogsManager';

interface AdminHubProps {
  models: ModelWorkspace[];
  selectedModelId: string;
  onRefreshModels: () => void;
  onSelectModel: (id: string) => void;
  onPackageUpdated?: () => void;
  subTab: AdminSubTab;
  onSelectSubTab: (subTab: AdminSubTab) => void;
}

export const AdminHub: React.FC<AdminHubProps> = ({
  models,
  selectedModelId,
  onRefreshModels,
  onSelectModel,
  onPackageUpdated,
  subTab,
  onSelectSubTab
}) => {
  const { t, interpolate } = useLanguage();
  const { user } = useAuth();
  const isAdmin = Boolean(user?.assignments?.some((a) => a.role === 'admin'));
  const isViewer = Boolean(user?.assignments?.some((a) => a.role === 'viewer') && !isAdmin);

  // New model creation form
  const [newModelName, setNewModelName] = useState('');
  const [newModelCode, setNewModelCode] = useState('');
  const [isCodeManual, setIsCodeManual] = useState(false);
  const [newModelDesc, setNewModelDesc] = useState('');
  const [newModelVersion, setNewModelVersion] = useState('1.0.0');
  const [newModelingTool, setNewModelingTool] = useState<'archi' | 'drawio'>('archi');
  const [newStencilStyle, setNewStencilStyle] = useState<'standard' | 'modern'>('standard');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Create Mode in Library creation card
  const [createMode, setCreateMode] = useState<'empty' | 'file'>('empty');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importModelName, setImportModelName] = useState('');
  const [importModelCode, setImportModelCode] = useState('');
  const [isImportCodeManual, setIsImportCodeManual] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [fileImportError, setFileImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scope for Packages
  const [packagesScope, setPackagesScope] = useState<string>(selectedModelId || 'global');

  useEffect(() => {
    if (selectedModelId) {
      setPackagesScope(selectedModelId);
    }
  }, [selectedModelId]);

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
        version: newModelVersion.trim(),
        modeling_tool: newModelingTool,
        stencil_style: newStencilStyle
      });
      onRefreshModels();
      onSelectModel(created.id);
      setNewModelName('');
      setNewModelCode('');
      setIsCodeManual(false);
      setNewModelDesc('');
      setNewModelVersion('1.0.0');
      setNewModelingTool('archi');
      setNewStencilStyle('standard');
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || t.admin.errorCreatingLibrary);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStencilStyle = async (m: ModelWorkspace) => {
    try {
      const nextStyle = m.stencil_style === 'modern' ? 'standard' : 'modern';
      await api.updateModel(m.id, { stencil_style: nextStyle });
      onRefreshModels();
    } catch (err: any) {
      console.error('Error toggling stencil style:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      if (!importModelName) {
        setImportModelName(baseName);
        if (!isImportCodeManual) {
          setImportModelCode(suggestLibraryCode(baseName));
        }
      }
    }
  };

  const handleCreateFromFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    const trimmedCode = importModelCode.trim().toUpperCase();
    if (trimmedCode && trimmedCode.length !== 4) {
      setFileImportError(t.admin.codeErrorFormat);
      return;
    }

    setImportLoading(true);
    setFileImportError(null);
    try {
      const created = await api.uploadArchiModel(
        importFile,
        importModelName.trim() || undefined,
        trimmedCode || undefined
      );
      onRefreshModels();
      if (created && created.id) {
        onSelectModel(created.id);
      }
      setImportFile(null);
      setImportModelName('');
      setImportModelCode('');
      setIsImportCodeManual(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error(err);
      setFileImportError(err.message || t.admin.errorCreatingLibrary);
    } finally {
      setImportLoading(false);
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

  const handleExportArchimate = async (id: string, name: string) => {
    try {
      await api.downloadModelArchimate(id, undefined, `${name.replace(/\s+/g, '_')}.archimate`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportExchangeXml = async (id: string, name: string) => {
    try {
      await api.downloadModelExchangeXml(id, undefined, `${name.replace(/\s+/g, '_')}_archimate_exchange.xml`);
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

      {/* Demo Read-Only Banner */}
      {isViewer && (
        <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-2xl flex items-start space-x-3 text-cyan-900 shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center flex-shrink-0 font-bold text-sm">
            👁️
          </div>
          <div className="text-xs">
            <span className="font-extrabold uppercase tracking-wider text-cyan-800 block mb-0.5">
              {t.rbac?.demoNoticeTitle || 'Accesso Demo Attivo'}
            </span>
            <p className="text-cyan-700 leading-relaxed">
              {t.rbac?.demoNoticeDesc || 'Sei autenticato con il ruolo Demo Viewer. Puoi esplorare tutti gli Hubs, visualizzare i metamodelli, gli schemi e i cruscotti, ma le funzioni di creazione, modifica ed eliminazione sono disabilitate.'}
            </p>
          </div>
        </div>
      )}

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
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            m.modeling_tool === 'drawio'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-blue-50 text-blue-800 border-blue-300'
                          }`}>
                            {m.modeling_tool === 'drawio' ? '🎨 Draw.io' : '🏛️ Archi'}
                          </span>
                          {m.modeling_tool === 'drawio' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStencilStyle(m);
                              }}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border transition cursor-pointer flex items-center space-x-1 ${
                                m.stencil_style === 'modern'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                              }`}
                              title="Configurazione Stencil Libreria: clicca per commutare tra Standard ArchiMate e Stile Moderno"
                            >
                              <span>{m.stencil_style === 'modern' ? '✨ Stencil: Moderno' : '📐 Stencil: Standard'}</span>
                            </button>
                          )}
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
                          onClick={() => handleExportArchimate(m.id, m.name)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title={t.admin.exportArchiNative || 'Esporta modello Archi nativo (.archimate)'}
                        >
                          <Layers className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExportExchangeXml(m.id, m.name)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          title={t.admin.exportExchangeXml || 'Esporta ArchiMate Open Exchange XML (.xml)'}
                        >
                          <FileCode className="w-4 h-4" />
                        </button>
                        {!isViewer && (
                          <button
                            onClick={() => setDeleteConfirmId(m.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title={t.admin.deleteLibrary}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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

            {isViewer ? (
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-700 mx-auto flex items-center justify-center font-bold text-base">
                  👁️
                </div>
                <div className="text-xs">
                  <h4 className="font-bold text-slate-800">{t.rbac.adminOnlyNotice || 'Funzione Riservata agli Amministratori'}</h4>
                  <p className="text-slate-500 mt-1 leading-relaxed">
                    {t.rbac.demoCreateLibraryForbidden || "La creazione e l'importazione di nuove librerie ArchiMate non sono consentite in modalità Demo."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Mode Switcher Tabs */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/80 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setCreateMode('empty')}
                    className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                      createMode === 'empty'
                        ? 'bg-white text-rose-600 font-bold shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.admin.createEmptyTab}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateMode('file')}
                    className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                      createMode === 'file'
                        ? 'bg-white text-rose-600 font-bold shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{t.admin.createFromFileTab}</span>
                  </button>
                </div>

            {/* TAB 1: Empty Library */}
            {createMode === 'empty' && (
              <>
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

                  {/* Modeling Tool Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Strumento di Modellazione Predefinito</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewModelingTool('archi')}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                          newModelingTool === 'archi'
                            ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          <span>🏛️ Archi Tool</span>
                        </div>
                        <span className="text-[10px] text-slate-500 leading-tight">File nativi .archimate / Open Exchange</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewModelingTool('drawio')}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                          newModelingTool === 'drawio'
                            ? 'bg-amber-50/80 border-amber-500 ring-1 ring-amber-500 text-amber-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          <span>🎨 Draw.io Web</span>
                        </div>
                        <span className="text-[10px] text-slate-500 leading-tight">Editor Web cloud/locale con Palette e Catalogo</span>
                      </button>
                    </div>

                    {/* Stencil Style for Draw.io */}
                    {newModelingTool === 'drawio' && (
                      <div className="mt-2 p-2.5 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-1.5">
                        <label className="block text-[11px] font-bold text-amber-950">
                          Stile Stencil ArchiMate per Draw.io Web
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setNewStencilStyle('standard')}
                            className={`p-2 rounded-lg border text-left transition ${
                              newStencilStyle === 'standard'
                                ? 'bg-white border-amber-500 ring-1 ring-amber-500 text-slate-900 shadow-2xs font-bold'
                                : 'bg-white/60 border-amber-200 text-slate-600 hover:bg-white text-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span>📐 Standard</span>
                              <span className="text-[9px] px-1 py-0.2 bg-slate-200 rounded font-semibold text-slate-700">Default</span>
                            </div>
                            <span className="text-[10px] text-slate-500 block mt-0.5">Sagome ArchiMate 3.x ufficiali</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewStencilStyle('modern')}
                            className={`p-2 rounded-lg border text-left transition ${
                              newStencilStyle === 'modern'
                                ? 'bg-white border-amber-500 ring-1 ring-amber-500 text-slate-900 shadow-2xs font-bold'
                                : 'bg-white/60 border-amber-200 text-slate-600 hover:bg-white text-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span>✨ Moderno</span>
                              <span className="text-[9px] px-1 py-0.2 bg-amber-100 text-amber-800 rounded font-semibold">Attivabile</span>
                            </div>
                            <span className="text-[10px] text-slate-500 block mt-0.5">Card ombreggiate & stencil stereotipi</span>
                          </button>
                        </div>
                      </div>
                    )}
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
              </>
            )}

            {/* TAB 2: From Archi / Open Exchange File */}
            {createMode === 'file' && (
              <>
                {fileImportError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                    <span>{fileImportError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateFromFile} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.admin.labelUploadFile}
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".archimate,.xml"
                      onChange={handleFileChange}
                      className="hidden"
                      id="admin-archi-file-upload"
                    />

                    {!importFile ? (
                      <label
                        htmlFor="admin-archi-file-upload"
                        className="border-2 border-dashed border-slate-200 hover:border-rose-400 bg-slate-50 hover:bg-rose-50/30 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition text-center group"
                      >
                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                          <Upload className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">
                          {t.admin.browseFiles}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 max-w-xs">
                          {t.admin.helpUploadFile}
                        </span>
                      </label>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                            <FileCode className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-800 truncate">{importFile.name}</div>
                            <div className="text-[10px] text-slate-500">
                              {(importFile.size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setImportFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title={t.common.removeFile || 'Rimuovi file'}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.admin.labelLibraryName}</label>
                    <input
                      type="text"
                      placeholder={t.admin.placeholderLibraryName}
                      value={importModelName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setImportModelName(val);
                        if (!isImportCodeManual) {
                          setImportModelCode(suggestLibraryCode(val));
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
                      maxLength={4}
                      placeholder={t.admin.placeholderLibraryCode}
                      value={importModelCode}
                      onChange={(e) => {
                        setIsImportCodeManual(true);
                        setImportModelCode(sanitizeLibraryCode(e.target.value));
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white font-mono font-bold uppercase tracking-widest"
                    />
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      {t.admin.helpLibraryCode}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={!importFile || importLoading}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition flex items-center justify-center space-x-1.5"
                  >
                    {importLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{t.admin.creatingFromFile}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>{t.admin.createLibraryFromFileBtn}</span>
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
              </>
            )}
          </div>
        </div>
      )}

      {/* SubTab: Metamodel Administration */}
      {subTab === 'metamodel' && (
        <MetamodelManager models={models} activeModelId={selectedModelId} readOnly={isViewer} />
      )}

      {/* SubTab: Packages & Reference Frameworks */}
      {subTab === 'packages' && (
        <AttributePackagesManager
          models={models}
          selectedScope={packagesScope}
          readOnly={isViewer}
          onSelectScope={(scope) => {
            setPackagesScope(scope);
            if (scope !== 'global') {
              onSelectModel(scope);
            }
          }}
          onPackageUpdated={() => {
            onRefreshModels();
            if (onPackageUpdated) {
              onPackageUpdated();
            }
          }}
        />
      )}

      {/* SubTab 3: Roles & Permissions */}
      {subTab === 'roles' && (
        <RolesManager
          models={models}
          selectedModelId={selectedModelId}
          readOnly={isViewer}
        />
      )}

      {/* SubTab 4: Auth & IdP Configuration */}
      {subTab === 'auth_config' && (
        <AuthConfigManager
          models={models}
          readOnly={isViewer}
        />
      )}

      {/* SubTab: API Keys & AI Agents (MCP) */}
      {subTab === 'api_keys' && (
        <ApiKeysManager
          readOnly={isViewer}
        />
      )}

      {/* SubTab: Security Audit Trail (Tamper-Evident Logs) */}
      {subTab === 'audit_logs' && (
        <AuditLogsManager />
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

