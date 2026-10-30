import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Plus,
  Search,
  Table as TableIcon,
  Grid,
  BarChart3,
  Sliders,
  Globe,
  Tag,
  Layers,
  Sparkles,
  ExternalLink,
  Edit2,
  Trash2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  ShieldAlert,
  Server,
  Cloud,
  Coins,
  Package,
  Workflow,
  Database
} from 'lucide-react';
import { CustomBusinessViewItem, CustomBusinessViewPayload } from '../../types';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import { BusinessViewEditorModal } from './BusinessViewEditorModal';

interface BusinessViewsManagerProps {
  modelId: string;
  onOpenInBusiness: (viewId: string) => void;
  onApplyToRepository?: (view: CustomBusinessViewItem) => void;
  onViewsChanged?: () => void;
}

const VIEW_ICONS: Record<string, React.ElementType> = {
  Table: TableIcon,
  Grid,
  BarChart3,
  LayoutGrid: LayoutDashboard,
  ShieldAlert,
  Sparkles,
  Building2,
  Server,
  Cloud,
  Coins,
  Package,
  Tag,
  Workflow,
  Layers
};

export const BusinessViewsManager: React.FC<BusinessViewsManagerProps> = ({
  modelId,
  onOpenInBusiness,
  onApplyToRepository,
  onViewsChanged,
}) => {
  const { t, interpolate } = useLanguage();
  const [views, setViews] = useState<CustomBusinessViewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScope, setFilterScope] = useState<'all' | 'workspace' | 'global'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingView, setEditingView] = useState<CustomBusinessViewItem | null>(null);

  // Feedback Notification
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchViews = async () => {
    if (!modelId) return;
    setLoading(true);
    try {
      const res = await api.getCustomBusinessViews(modelId);
      setViews(res.views || []);
    } catch (err: any) {
      console.error('Error fetching custom views:', err);
      setFeedback({ type: 'error', message: err.message || 'Errore nel caricamento delle viste' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViews();
  }, [modelId]);

  const handleOpenCreateModal = () => {
    setEditingView(null);
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = (view: CustomBusinessViewItem) => {
    setEditingView(view);
    setIsEditorOpen(true);
  };

  const handleSaveView = async (payload: CustomBusinessViewPayload) => {
    try {
      if (editingView) {
        await api.updateCustomBusinessView(editingView.id, payload);
        setFeedback({ type: 'success', message: 'Vista business aggiornata con successo!' });
      } else {
        await api.createCustomBusinessView(modelId, payload);
        setFeedback({ type: 'success', message: 'Nuova vista business creata con successo!' });
      }
      await fetchViews();
      if (onViewsChanged) {
        onViewsChanged();
      }
    } catch (err: any) {
      throw err;
    }
  };

  const handleToggleActive = async (view: CustomBusinessViewItem) => {
    const nextState = !view.is_active;
    try {
      await api.toggleCustomViewStatus(view.id, nextState);
      setViews(views.map(v => v.id === view.id ? { ...v, is_active: nextState } : v));
      setFeedback({
        type: 'success',
        message: nextState
          ? `Vista "${view.name}" attivata e pubblicata nel menù Business!`
          : `Vista "${view.name}" disattivata (ora in stato Bozza).`
      });
      if (onViewsChanged) {
        onViewsChanged();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Errore nella modifica dello stato della vista' });
    }
  };

  const handleOpenInBusiness = async (view: CustomBusinessViewItem) => {
    if (!view.is_active) {
      if (window.confirm("Questa vista è attualmente inattiva (bozza). Desideri attivarla e pubblicarla per aprirla nella sezione Business?")) {
        try {
          await api.toggleCustomViewStatus(view.id, true);
          setViews(views.map(v => v.id === view.id ? { ...v, is_active: true } : v));
          if (onViewsChanged) onViewsChanged();
          onOpenInBusiness(view.id);
        } catch (err: any) {
          setFeedback({ type: 'error', message: err.message || 'Errore nell\'attivazione della vista' });
        }
      }
    } else {
      onOpenInBusiness(view.id);
    }
  };

  const handleDuplicateView = async (view: CustomBusinessViewItem) => {
    try {
      const duplicatePayload: CustomBusinessViewPayload = {
        name: `${view.name} (Copia)`,
        view_key: `${view.view_key}_copy_${Date.now()}`,
        description: view.description || undefined,
        category: view.category,
        view_type: view.view_type,
        icon: view.icon,
        sort_order: (view.sort_order ?? 0) + 1,
        target_hub: view.target_hub || 'business',
        is_global: false, // Local to workspace by default
        is_active: false, // Inactive by default
        target_stereotypes: view.target_stereotypes || [],
        target_types: view.target_types || [],
        config: view.config || {}
      };
      await api.createCustomBusinessView(modelId, duplicatePayload);
      setFeedback({ type: 'success', message: 'Vista duplicata con successo!' });
      await fetchViews();
      if (onViewsChanged) {
        onViewsChanged();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Errore nella duplicazione della vista' });
    }
  };

  const handleDeleteView = async (viewId: string) => {
    if (!window.confirm(t.businessViews.deleteConfirm)) return;
    try {
      await api.deleteCustomBusinessView(viewId);
      setFeedback({ type: 'success', message: 'Vista eliminata con successo!' });
      await fetchViews();
      if (onViewsChanged) {
        onViewsChanged();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Errore nell\'eliminazione della vista' });
    }
  };

  // Filtered views
  const filteredViews = views.filter((v) => {
    if (filterScope === 'global' && !v.is_global) return false;
    if (filterScope === 'workspace' && v.is_global) return false;
    if (filterStatus === 'active' && !v.is_active) return false;
    if (filterStatus === 'inactive' && v.is_active) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = v.name.toLowerCase().includes(q);
      const matchCat = v.category.toLowerCase().includes(q);
      const matchDesc = (v.description || '').toLowerCase().includes(q);
      return matchName || matchCat || matchDesc;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* HEADER SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/20">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {t.businessViews.managerTitle}
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {views.length} {views.length === 1 ? 'Vista' : 'Viste'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {t.businessViews.managerSubtitle}
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/30 text-xs font-bold transition flex items-center justify-center space-x-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t.businessViews.createNewView}</span>
        </button>
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-bold underline hover:opacity-80"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* SEARCH AND SCOPE FILTER TABS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca viste per nome o categoria..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {/* Status Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                filterStatus === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t.businessViews.statusFilterAll} ({views.length})
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                filterStatus === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${filterStatus === 'active' ? 'bg-white' : 'bg-emerald-500'}`} />
              <span>{t.businessViews.statusFilterActive} ({views.filter((v) => v.is_active).length})</span>
            </button>
            <button
              onClick={() => setFilterStatus('inactive')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                filterStatus === 'inactive'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${filterStatus === 'inactive' ? 'bg-white' : 'bg-amber-500'}`} />
              <span>{t.businessViews.statusFilterInactive} ({views.filter((v) => !v.is_active).length})</span>
            </button>
          </div>

          {/* Scope Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setFilterScope('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                filterScope === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Tutte
            </button>
            <button
              onClick={() => setFilterScope('workspace')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                filterScope === 'workspace'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Libreria
            </button>
            <button
              onClick={() => setFilterScope('global')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                filterScope === 'global'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              🌐 Globali
            </button>
          </div>
        </div>
      </div>

      {/* VIEWS GRID */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="text-xs text-slate-500 font-semibold">Caricamento viste personalizzate...</span>
        </div>
      ) : filteredViews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-slate-800">
            {t.businessViews.noViewsFound}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {t.businessViews.noViewsHint}
          </p>
          <div className="pt-2">
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold transition inline-flex items-center space-x-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{t.businessViews.createNewView}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredViews
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
            .map((view) => {
              const IconComp = VIEW_ICONS[view.icon || 'Table'] || TableIcon;
              return (
                <div
                  key={view.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Top Row: Icon, Scope Badge, Type Badge */}
                    <div className="flex items-start justify-between">
                      <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
                        <IconComp className="w-5 h-5" />
                      </div>

                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1 justify-end">
                        {/* Status Toggle Button Badge */}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(view)}
                          title={view.is_active ? t.businessViews.deactivateView : t.businessViews.activateView}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1.5 transition shadow-2xs ${
                            view.is_active
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${view.is_active ? 'bg-emerald-600' : 'bg-amber-500'}`} />
                          <span>{view.is_active ? t.businessViews.statusActive : t.businessViews.statusInactive}</span>
                        </button>

                        {view.is_global ? (
                          <span
                            className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1"
                            title="Visibile in tutti i modelli della piattaforma"
                          >
                            <Globe className="w-3 h-3" />
                            <span>Global</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Workspace
                          </span>
                        )}

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
                          {view.view_type}
                        </span>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          view.target_hub === 'architecture'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : view.target_hub === 'both'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {view.target_hub === 'architecture' ? '🏛️ Arch Hub' : view.target_hub === 'both' ? '🌐 Dual Hub' : '💼 Business Hub'}
                        </span>
                      </div>
                    </div>

                    {/* Title & Category */}
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">
                        {view.category}
                      </div>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {view.name}
                      </h4>
                      {view.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                          {view.description}
                        </p>
                      )}
                    </div>

                    {/* Scope metadata: targets & count */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Elementi nel modello:</span>
                        <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                          {view.matching_elements_count}
                        </span>
                      </div>

                      {/* Chips of Target Types / Stereotypes */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {(view.target_types || []).slice(0, 3).map((tName, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md"
                          >
                            {tName}
                          </span>
                        ))}
                        {(view.target_stereotypes || []).slice(0, 2).map((st, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md"
                          >
                            «{st}»
                          </span>
                        ))}
                        {((view.target_types?.length || 0) + (view.target_stereotypes?.length || 0) > 5) && (
                          <span className="text-[10px] text-slate-400 self-center">
                            +{((view.target_types?.length || 0) + (view.target_stereotypes?.length || 0)) - 5} altri
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM ACTIONS */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleOpenInBusiness(view)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs ${
                          view.is_active
                            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{t.businessViews.openInBusiness}</span>
                        {!view.is_active && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 font-extrabold ml-1">
                            Bozza
                          </span>
                        )}
                      </button>

                      {onApplyToRepository && (
                        <button
                          onClick={() => onApplyToRepository(view)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white shadow-2xs cursor-pointer"
                          title="Filtra e applica negli Oggetti & Elementi del repository"
                        >
                          <Database className="w-3.5 h-3.5" />
                          <span>Repository</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleDuplicateView(view)}
                        title={t.businessViews.duplicateView}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(view)}
                        title={t.businessViews.editView}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteView(view.id)}
                        title={t.businessViews.deleteView}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* EDITOR MODAL */}
      <BusinessViewEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveView}
        initialView={editingView}
        modelId={modelId}
      />
    </div>
  );
};
