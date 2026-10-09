import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Trash2,
  Eye,
  FileText,
  Layers,
  ArrowRight,
  RefreshCw,
  Info,
  Check,
  X,
  Database
} from 'lucide-react';
import { api, ImportHistoryItem, ImportPreviewResult } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';

interface DataImportHubProps {
  modelId: string;
}

export const DataImportHub: React.FC<DataImportHubProps> = ({ modelId }) => {
  const { t } = useLanguage();
  const impT = t.importHub;

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'elements' | 'relationships' | 'errors'>('elements');

  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<ImportHistoryItem | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modelId) {
      loadHistory();
    }
  }, [modelId]);

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const data = await api.getImportHistory(modelId);
      setHistory(data);
    } catch (err: any) {
      console.error('Failed to load import history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreviewResult(null);
      setNotification(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setPreviewResult(null);
      setNotification(null);
    }
  };

  const handleUpload = async (dryRun: boolean) => {
    if (!file || !modelId) return;

    try {
      setLoading(true);
      setNotification(null);

      const result = await api.uploadImportFile(modelId, file, dryRun, updateExisting, 'Architect');
      setPreviewResult(result);

      if (!dryRun) {
        if (result.status === 'success') {
          setNotification({ type: 'success', message: impT.importSuccessMsg });
        } else if (result.status === 'partial_success') {
          setNotification({ type: 'warning', message: impT.importPartialMsg });
        } else {
          setNotification({ type: 'error', message: impT.importFailedMsg });
        }
        await loadHistory();
      } else {
        if (result.errors_count > 0) {
          setActivePreviewTab('errors');
        } else {
          setActivePreviewTab('elements');
        }
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Error executing import' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (!window.confirm(impT.deleteHistoryConfirm)) return;
    try {
      await api.deleteImportHistory(id);
      await loadHistory();
    } catch (err: any) {
      alert(err.message || 'Failed to delete log');
    }
  };

  const handleOpenDetailModal = async (id: string) => {
    try {
      const detail = await api.getImportHistoryDetail(id);
      setSelectedHistory(detail);
      setIsLogModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch details');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    return d.toLocaleString();
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 animate-fadeIn">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl p-8 shadow-xl shadow-emerald-950/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 text-emerald-400">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                  Architecture Hub
                </span>
                <h1 className="text-2xl font-black tracking-tight text-white">{impT.title}</h1>
              </div>
            </div>
            <p className="text-sm text-slate-300 max-w-2xl">
              {impT.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={api.getImportTemplateUrl(modelId, 'xlsx')}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-emerald-500/20 transition"
            >
              <Download className="w-4 h-4" />
              <span>{impT.downloadExcelTemplate}</span>
            </a>
          </div>
        </div>
      </div>

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between border shadow-sm transition animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notification.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center space-x-3">
            {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {notification.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />}
            {notification.type === 'error' && <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            <span className="text-xs font-bold">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: TEMPLATE DOWNLOADS */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{impT.downloadTemplatesTitle}</h2>
            <p className="text-xs text-slate-500">{impT.downloadTemplatesDesc}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <a
            href={api.getImportTemplateUrl(modelId, 'xlsx')}
            className="flex items-center justify-between p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-300 transition group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black text-emerald-950 block">Excel Template (.xlsx)</span>
                <span className="text-[11px] text-emerald-700 font-medium">Elements, Relations & Guide</span>
              </div>
            </div>
            <Download className="w-4 h-4 text-emerald-600 group-hover:translate-y-0.5 transition" />
          </a>

          <a
            href={api.getImportTemplateUrl(modelId, 'csv_elements')}
            className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 transition group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-900 block">{impT.downloadCsvElements}</span>
                <span className="text-[11px] text-slate-500 font-medium">elements.csv schema</span>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-600 group-hover:translate-y-0.5 transition" />
          </a>

          <a
            href={api.getImportTemplateUrl(modelId, 'csv_relationships')}
            className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 transition group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-purple-600 text-white rounded-xl shadow-sm">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-900 block">{impT.downloadCsvRelations}</span>
                <span className="text-[11px] text-slate-500 font-medium">relationships.csv schema</span>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-600 group-hover:translate-y-0.5 transition" />
          </a>
        </div>
      </div>

      {/* SECTION 2: UPLOAD & VALIDATION CONTROLS */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{impT.uploadZoneTitle}</h2>
            <p className="text-xs text-slate-500">{impT.supportedFormats}</p>
          </div>
        </div>

        {/* DRAG AND DROP ZONE */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/60'
              : file
              ? 'border-emerald-300 bg-emerald-50/20'
              : 'border-slate-300 hover:border-emerald-400 bg-slate-50/40 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.zip"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-emerald-600">
            <UploadCloud className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">
              {impT.uploadZonePrompt}{' '}
              <span className="text-emerald-600 underline font-extrabold">{impT.browseFiles}</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1">{impT.supportedFormats}</p>
          </div>

          {file && (
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold border border-emerald-200">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>{file.name}</span>
              <span className="text-[10px] text-emerald-600">({formatFileSize(file.size)})</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setPreviewResult(null);
                }}
                className="p-0.5 hover:bg-emerald-200 rounded text-emerald-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* IMPORT OPTIONS & ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <span className="text-xs font-bold text-slate-700">
                {impT.modeUpsert}
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => handleUpload(true)}
              disabled={!file || loading}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center space-x-2"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{impT.dryRunBtn}</span>
            </button>

            <button
              onClick={() => handleUpload(false)}
              disabled={!file || loading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition disabled:opacity-50 flex items-center space-x-2"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <Check className="w-4 h-4" />
              <span>{impT.executeBtn}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: PREVIEW & DRY-RUN REPORT */}
      {previewResult && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-base font-bold text-slate-900">{impT.previewTitle}</h2>
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    previewResult.status === 'success'
                      ? 'bg-emerald-100 text-emerald-800'
                      : previewResult.status === 'partial_success'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {previewResult.status === 'success'
                    ? impT.badgeSuccess
                    : previewResult.status === 'partial_success'
                    ? impT.badgePartial
                    : impT.badgeFailed}
                </span>
              </div>
              <p className="text-xs text-slate-500">{impT.previewSubtitle}</p>
            </div>

            {previewResult.dry_run && (
              <button
                onClick={() => handleUpload(false)}
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition flex items-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>{impT.executeBtn}</span>
              </button>
            )}
          </div>

          {/* METRIC BADGES */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 block">{impT.elementsToCreate}</span>
              <span className="text-2xl font-black text-emerald-600">{previewResult.elements_created}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 block">{impT.elementsToUpdate}</span>
              <span className="text-2xl font-black text-blue-600">{previewResult.elements_updated}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 block">{impT.relationshipsToCreate}</span>
              <span className="text-2xl font-black text-purple-600">{previewResult.relationships_created}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 block">{impT.errorsFound}</span>
              <span className={`text-2xl font-black ${previewResult.errors_count > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                {previewResult.errors_count}
              </span>
            </div>
          </div>

          {/* TABS */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActivePreviewTab('elements')}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition flex items-center space-x-2 ${
                activePreviewTab === 'elements'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{impT.tabElements}</span>
              <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px]">
                {(previewResult.elements || []).length}
              </span>
            </button>

            <button
              onClick={() => setActivePreviewTab('relationships')}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition flex items-center space-x-2 ${
                activePreviewTab === 'relationships'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{impT.tabRelationships}</span>
              <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px]">
                {(previewResult.relationships || []).length}
              </span>
            </button>

            <button
              onClick={() => setActivePreviewTab('errors')}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition flex items-center space-x-2 ${
                activePreviewTab === 'errors'
                  ? 'border-rose-600 text-rose-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{impT.tabErrors}</span>
              {previewResult.errors_count > 0 && (
                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[10px] font-black">
                  {previewResult.errors_count}
                </span>
              )}
            </button>
          </div>

          {/* TAB CONTENT: ELEMENTS */}
          {activePreviewTab === 'elements' && (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-black text-[10px]">
                  <tr>
                    <th className="py-3 px-4">{impT.colRow}</th>
                    <th className="py-3 px-4">{impT.colName}</th>
                    <th className="py-3 px-4">{impT.colType}</th>
                    <th className="py-3 px-4">{impT.colLayer}</th>
                    <th className="py-3 px-4">{impT.colAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(previewResult.elements || []).map((el, i) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 text-slate-400 font-mono">#{el.row_num}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{el.name}</td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">{el.type}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                          {el.layer}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            el.is_update ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {el.is_update ? impT.actUpdate : impT.actCreate}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(previewResult.elements || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        Nessun elemento individuato.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB CONTENT: RELATIONSHIPS */}
          {activePreviewTab === 'relationships' && (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-black text-[10px]">
                  <tr>
                    <th className="py-3 px-4">{impT.colRow}</th>
                    <th className="py-3 px-4">{impT.colSource}</th>
                    <th className="py-3 px-4">{impT.colRelType}</th>
                    <th className="py-3 px-4">{impT.colTarget}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(previewResult.relationships || []).map((rel, i) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 text-slate-400 font-mono">#{rel.row_num}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{rel.source_name}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-bold">
                          {rel.type.replace('Relationship', '')}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{rel.target_name}</td>
                    </tr>
                  ))}
                  {(previewResult.relationships || []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        Nessuna relazione individuata.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB CONTENT: ERRORS */}
          {activePreviewTab === 'errors' && (
            <div className="space-y-3">
              {(previewResult.errors || []).map((err, i) => (
                <div key={i} className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl flex items-start space-x-3 text-xs">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      {err.row ? `Riga #${err.row}: ` : ''} {err.message}
                    </span>
                    {err.source && err.target && (
                      <span className="text-[11px] text-rose-700 mt-0.5 block">
                        Origine: {err.source} ➔ Destinazione: {err.target}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {(previewResult.warnings || []).map((warn, i) => (
                <div key={i} className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-start space-x-3 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      {warn.row ? `Riga #${warn.row}: ` : ''} {warn.message}
                    </span>
                  </div>
                </div>
              ))}
              {(previewResult.errors || []).length === 0 && (previewResult.warnings || []).length === 0 && (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <span className="text-xs font-bold text-emerald-800">Nessun errore o avviso di validazione!</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: IMPORT HISTORY */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{impT.historyTitle}</h2>
              <p className="text-xs text-slate-500">{impT.historySubtitle}</p>
            </div>
          </div>

          <button
            onClick={loadHistory}
            disabled={historyLoading}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition"
            title="Ricarica storico"
          >
            <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-bold">{impT.noHistory}</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-black text-[10px]">
                <tr>
                  <th className="py-3 px-4">{impT.thImportedAt}</th>
                  <th className="py-3 px-4">{impT.thFilename}</th>
                  <th className="py-3 px-4">{impT.thUser}</th>
                  <th className="py-3 px-4">{impT.thStatus}</th>
                  <th className="py-3 px-4">{impT.thElements}</th>
                  <th className="py-3 px-4">{impT.thRelationships}</th>
                  <th className="py-3 px-4">{impT.thIssues}</th>
                  <th className="py-3 px-4 text-right">{impT.thActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {formatDate(h.imported_at)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center space-x-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate max-w-[200px]" title={h.filename}>{h.filename}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">({h.file_format})</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{h.user_name || 'Architect'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          h.status === 'success'
                            ? 'bg-emerald-100 text-emerald-800'
                            : h.status === 'partial_success'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {h.status === 'success'
                          ? impT.badgeSuccess
                          : h.status === 'partial_success'
                          ? impT.badgePartial
                          : impT.badgeFailed}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-emerald-700 font-bold">+{h.elements_created}</span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-blue-700 font-bold">~{h.elements_updated}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-purple-700">+{h.relationships_created}</td>
                    <td className="py-3 px-4">
                      {h.errors_count > 0 ? (
                        <span className="text-rose-600 font-bold">{h.errors_count} err</span>
                      ) : (
                        <span className="text-emerald-600 font-bold">0 err</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleOpenDetailModal(h.id)}
                          className="px-2.5 py-1 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{impT.viewDetails}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteHistory(h.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title={impT.deleteLog}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL LOG MODAL */}
      {isLogModalOpen && selectedHistory && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{impT.modalLogTitle}</h3>
                  <p className="text-xs text-slate-500">{selectedHistory.filename} • {formatDate(selectedHistory.imported_at)}</p>
                </div>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <span className="text-slate-500 font-bold block text-[11px]">Nuovi Oggetti</span>
                  <span className="text-lg font-black text-emerald-600">+{selectedHistory.elements_created}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <span className="text-slate-500 font-bold block text-[11px]">Oggetti Aggiornati</span>
                  <span className="text-lg font-black text-blue-600">~{selectedHistory.elements_updated}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <span className="text-slate-500 font-bold block text-[11px]">Relazioni Create</span>
                  <span className="text-lg font-black text-purple-600">+{selectedHistory.relationships_created}</span>
                </div>
              </div>

              {/* Errors list */}
              {selectedHistory.details?.errors && selectedHistory.details.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs">Errori Rilevati:</h4>
                  <div className="space-y-1.5">
                    {selectedHistory.details.errors.map((err, i) => (
                      <div key={i} className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
                        {err.row ? `Riga #${err.row}: ` : ''}{err.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Created Elements */}
              {selectedHistory.details?.created_elements && selectedHistory.details.created_elements.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs">Elementi Creati:</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedHistory.details.created_elements.map((el, i) => (
                      <span key={i} className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-medium text-[11px]">
                        {el.name} ({el.type})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Created Relationships */}
              {selectedHistory.details?.created_relationships && selectedHistory.details.created_relationships.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs">Relazioni Create:</h4>
                  <div className="space-y-1">
                    {selectedHistory.details.created_relationships.map((r, i) => (
                      <div key={i} className="p-2 bg-purple-50 border border-purple-100 rounded-lg text-purple-900 flex items-center justify-between text-[11px]">
                        <span className="font-bold">{r.source}</span>
                        <span className="text-purple-600 font-mono text-[10px]">--[{r.type.replace('Relationship', '')}]--&gt;</span>
                        <span className="font-bold">{r.target}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition"
              >
                {impT.modalLogClose}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
