import React, { useState, useEffect } from 'react';
import {
  BookmarkCheck,
  Search,
  Plus,
  Trash2,
  Edit2,
  Copy,
  ExternalLink,
  Users,
  User,
  Tag,
  Filter,
  Layers,
  ArrowUpDown,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Sparkles,
  FileSpreadsheet,
  FileArchive,
  FileText
} from 'lucide-react';
import { SavedFilterView, SavedViewUpdatePayload } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

interface ArchitectSavedViewsProps {
  modelId: string;
  onApplyView: (view: SavedFilterView) => void;
  onNavigateToRepository: () => void;
}

export const ArchitectSavedViews: React.FC<ArchitectSavedViewsProps> = ({
  modelId,
  onApplyView,
  onNavigateToRepository,
}) => {
  const { t, interpolate } = useLanguage();
  const { user } = useAuth();
  const currentAuthor = user?.full_name || user?.username || user?.email || 'Architetto';
  const [views, setViews] = useState<SavedFilterView[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'shared' | 'private'>('all');

  // Edit Modal State
  const [editingView, setEditingView] = useState<SavedFilterView | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editIsShared, setEditIsShared] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchViews = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('easyea_auth_token') || localStorage.getItem('easyea_auth_token');
      const res = await fetch(`/api/saved-views?model_id=${modelId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setViews(data);
      }
    } catch (err) {
      console.error('Error loading saved views:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (modelId) {
      fetchViews();
    }
  }, [modelId]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleDeleteView = async (id: string, name: string) => {
    if (!window.confirm(`${t.architect.deleteViewConfirm}\n"${name}"`)) return;
    try {
      const token = sessionStorage.getItem('easyea_auth_token') || localStorage.getItem('easyea_auth_token');
      const res = await fetch(`/api/saved-views/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setViews((prev) => prev.filter((v) => v.id !== id));
        showFeedback('success', t.architect.deleteViewSuccess);
      }
    } catch (err) {
      showFeedback('error', 'Errore durante l\'eliminazione della vista.');
    }
  };

  const handleDuplicateView = async (id: string) => {
    try {
      const token = sessionStorage.getItem('easyea_auth_token') || localStorage.getItem('easyea_auth_token');
      const res = await fetch(`/api/saved-views/${id}/duplicate`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const dup = await res.json();
        setViews((prev) => [dup, ...prev]);
        showFeedback('success', `Vista duplicata come "${dup.name}"`);
      }
    } catch (err) {
      showFeedback('error', 'Errore durante la duplicazione della vista.');
    }
  };

  const handleOpenEditModal = (view: SavedFilterView) => {
    setEditingView(view);
    setEditName(view.name);
    setEditDesc(view.description || '');
    setEditAuthor(view.author || currentAuthor);
    setEditTags((view.tags || []).join(', '));
    setEditIsShared(view.is_shared ?? true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingView) return;
    if (!editName.trim()) return;

    try {
      setSavingEdit(true);
      const parsedTags = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: SavedViewUpdatePayload = {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        author: editAuthor || currentAuthor,
        is_shared: editIsShared,
        tags: parsedTags,
      };

      const token = sessionStorage.getItem('easyea_auth_token') || localStorage.getItem('easyea_auth_token');
      const res = await fetch(`/api/saved-views/${editingView.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        setViews((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
        setEditingView(null);
        showFeedback('success', t.architect.updateViewSuccess);
      }
    } catch (err) {
      showFeedback('error', 'Errore durante l\'aggiornamento.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleExportView = async (view: SavedFilterView, format: 'xlsx' | 'csv') => {
    try {
      showFeedback('success', t.architect.exportingData);
      const token = sessionStorage.getItem('easyea_auth_token') || localStorage.getItem('easyea_auth_token');
      const res = await fetch(`/api/saved-views/${view.id}/export?format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = format === 'xlsx' ? 'xlsx' : 'zip';
        const cleanName = view.name.toLowerCase().replace(/[^a-z0-9]/gi, '_') || 'saved_view';
        a.download = `EasyEA_${cleanName}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showFeedback('success', t.architect.exportDataSuccess);
      } else {
        showFeedback('error', 'Errore durante l\'esportazione della vista.');
      }
    } catch (err) {
      showFeedback('error', 'Errore di connessione durante l\'export.');
    }
  };

  const handleExportJson = (view: SavedFilterView) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(view, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `easyea_view_${view.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filtering
  const filteredViews = views.filter((v) => {
    if (filterTab === 'shared' && !v.is_shared) return false;
    if (filterTab === 'private' && v.is_shared) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = v.name.toLowerCase().includes(q);
      const matchDesc = (v.description || '').toLowerCase().includes(q);
      const matchAuthor = (v.author || '').toLowerCase().includes(q);
      const matchTags = (v.tags || []).some((tag) => tag.toLowerCase().includes(q));
      if (!matchName && !matchDesc && !matchAuthor && !matchTags) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BookmarkCheck className="w-7 h-7 text-emerald-600" />
            <span>{t.savedViews.title}</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            {t.savedViews.subtitle}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onNavigateToRepository}
            className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.architect.saveViewBtn}</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm animate-fadeIn ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
              : 'bg-rose-50 text-rose-900 border border-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Control Bar: Search & Filter Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={t.savedViews.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {t.savedViews.allViews} ({views.length})
            </button>
            <button
              onClick={() => setFilterTab('shared')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                filterTab === 'shared'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5 inline mr-1" />
              {t.savedViews.sharedOnly} ({views.filter((v) => v.is_shared).length})
            </button>
            <button
              onClick={() => setFilterTab('private')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                filterTab === 'private'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <User className="w-3.5 h-3.5 inline mr-1" />
              {t.savedViews.privateOnly} ({views.filter((v) => !v.is_shared).length})
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Views */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">
          Caricamento viste salvate...
        </div>
      ) : filteredViews.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredViews.map((view) => {
            const cfg = view.filter_config || {};
            const rules = cfg.attributeFilterRules || [];
            const hasLayer = cfg.selectedLayer && cfg.selectedLayer !== 'All';
            const hasType = cfg.selectedType && cfg.selectedType !== 'All';
            const hasSearch = cfg.search && cfg.search.trim().length > 0;
            const hasRel = cfg.relationshipFilter && cfg.relationshipFilter !== 'all';
            const hasDoc = cfg.documentationFilter && cfg.documentationFilter !== 'all';

            return (
              <div
                key={view.id}
                className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative"
              >
                <div className="space-y-3">
                  {/* Top Row: Sharing Badge & Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {view.is_shared ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-extrabold">
                          <Users className="w-3 h-3" />
                          {t.savedViews.sharedBadge}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[10px] font-extrabold">
                          <User className="w-3 h-3" />
                          {t.savedViews.privateBadge}
                        </span>
                      )}

                      {view.tags &&
                        view.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[10px] font-bold"
                          >
                            <Tag className="w-2.5 h-2.5 text-emerald-600" />
                            {tag}
                          </span>
                        ))}
                    </div>

                    <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition">
                      <button
                        onClick={() => handleExportView(view, 'xlsx')}
                        className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                        title={t.savedViews.exportExcelBtn}
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      </button>
                      <button
                        onClick={() => handleExportView(view, 'csv')}
                        className="p-1 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition"
                        title={t.savedViews.exportCsvBtn}
                      >
                        <FileArchive className="w-3.5 h-3.5 text-purple-600" />
                      </button>
                      <button
                        onClick={() => handleExportJson(view)}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        title={t.savedViews.exportJsonBtn}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDuplicateView(view.id)}
                        className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                        title={t.savedViews.duplicateBtn}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(view)}
                        className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                        title={t.savedViews.editBtn}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteView(view.id, view.name)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title={t.savedViews.deleteBtn}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 leading-snug group-hover:text-emerald-700 transition">
                      {view.name}
                    </h3>
                    {view.description ? (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {view.description}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic mt-1">
                        Nessuna descrizione specificata
                      </p>
                    )}
                  </div>

                  {/* Author and Date */}
                  <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between pt-1 border-t border-slate-100">
                    <span>{view.author || 'Enterprise Architect'}</span>
                    <span>
                      {view.updated_at
                        ? new Date(view.updated_at).toLocaleDateString()
                        : ''}
                    </span>
                  </div>

                  {/* Filter Configuration Summary Pills */}
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span className="flex items-center gap-1">
                        <Filter className="w-3 h-3 text-emerald-600" />
                        <span>Configurazione Filtri</span>
                      </span>
                      {cfg.matchLogic && rules.length > 1 && (
                        <span className="px-1.5 py-0.2 bg-slate-200 text-slate-800 rounded text-[9px] font-extrabold">
                          {cfg.matchLogic}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {hasLayer && (
                        <span className="px-2 py-0.5 bg-white border border-emerald-200 text-emerald-800 rounded-md text-[10px] font-bold">
                          Layer: {cfg.selectedLayer}
                        </span>
                      )}
                      {hasType && (
                        <span className="px-2 py-0.5 bg-white border border-blue-200 text-blue-800 rounded-md text-[10px] font-bold">
                          Tipo: {cfg.selectedType}
                        </span>
                      )}
                      {hasSearch && (
                        <span className="px-2 py-0.5 bg-white border border-slate-200 text-slate-800 rounded-md text-[10px] font-bold">
                          "{cfg.search}"
                        </span>
                      )}
                      {hasRel && (
                        <span className="px-2 py-0.5 bg-white border border-purple-200 text-purple-800 rounded-md text-[10px] font-bold">
                          {cfg.relationshipFilter === 'orphan' ? 'Orfani' : 'Connessi'}
                        </span>
                      )}
                      {hasDoc && (
                        <span className="px-2 py-0.5 bg-white border border-amber-200 text-amber-800 rounded-md text-[10px] font-bold">
                          {cfg.documentationFilter === 'with_doc' ? 'Con desc.' : 'Senza desc.'}
                        </span>
                      )}
                      {rules.map((r) => (
                        <span
                          key={r.id}
                          className="px-2 py-0.5 bg-white border border-teal-200 text-teal-900 rounded-md text-[10px] font-bold"
                        >
                          {r.attributeName} {r.operator} {String(r.value || '')}
                        </span>
                      ))}
                      {!hasLayer && !hasType && !hasSearch && !hasRel && !hasDoc && rules.length === 0 && (
                        <span className="text-[10px] text-slate-400 italic">
                          Tutti gli oggetti del modello
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="pt-4 mt-2">
                  <button
                    onClick={() => onApplyView(view)}
                    className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300 hover:border-emerald-600 rounded-xl text-xs font-extrabold transition flex items-center justify-center space-x-2 shadow-2xs group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{t.savedViews.applyInRepoBtn}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-12 text-center max-w-xl mx-auto my-6 space-y-4 shadow-sm">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 border border-emerald-100">
            <BookmarkCheck className="w-8 h-8" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">{t.savedViews.noViewsFound}</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {t.savedViews.noViewsFoundDesc}
          </p>
          <button
            onClick={onNavigateToRepository}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center space-x-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Vai al Repository</span>
          </button>
        </div>
      )}

      {/* Edit View Metadata Modal */}
      {editingView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-700 border border-emerald-200">
                  <BookmarkCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">{t.architect.editViewModalTitle}</h3>
                  <p className="text-[11px] text-slate-500">{editingView.id}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingView(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.architect.viewNameLabel} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.architect.viewDescLabel}
                </label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>{t.architect.viewAuthorLabel}</span>
                    <span className="text-[10px] font-medium text-slate-400">Autore (non modificabile)</span>
                  </label>
                  <div className="relative flex items-center">
                    <User className="w-3.5 h-3.5 text-emerald-600 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      value={editAuthor || currentAuthor}
                      readOnly
                      disabled
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-slate-700 cursor-not-allowed select-none focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.architect.viewTagsLabel}
                  </label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="es. APM, Governance"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsShared}
                    onChange={(e) => setEditIsShared(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {t.architect.viewSharedLabel}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {t.architect.viewSharedHelp}
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingView(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || !editName.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  {savingEdit ? 'Salvataggio...' : 'Salva Modifiche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
