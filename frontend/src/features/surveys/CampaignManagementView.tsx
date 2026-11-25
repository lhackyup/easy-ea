import React, { useState, useEffect } from 'react';
import { SurveyCampaignItem } from '../../types';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import { SurveyDiffReviewModal } from './SurveyDiffReviewModal';
import {
  Vote,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileDiff,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Layers,
  Sparkles,
  Users,
  CheckSquare
} from 'lucide-react';

interface CampaignManagementViewProps {
  selectedModelId: string;
}

export const CampaignManagementView: React.FC<CampaignManagementViewProps> = ({ selectedModelId }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<SurveyCampaignItem[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignDetail, setCampaignDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // New Campaign Form Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newMode, setNewMode] = useState<'approval_required' | 'direct_apply'>('approval_required');
  const [newTargetOwner, setNewTargetOwner] = useState<'all' | 'technical_owner' | 'process_owner'>('all');
  const [newDeadline, setNewDeadline] = useState('');
  const [creating, setCreating] = useState(false);

  // Diff Review Modal
  const [diffScope, setDiffScope] = useState<{ id: string; appName: string; ownerName?: string } | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, [selectedModelId]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listSurveyCampaigns(selectedModelId);
      setCampaigns(data);
      if (data.length > 0 && !selectedCampaignId) {
        loadCampaignDetail(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Errore nel caricamento delle campagne');
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignDetail = async (campaignId: string) => {
    try {
      setSelectedCampaignId(campaignId);
      setDetailLoading(true);
      const detail = await api.getSurveyCampaignDetail(campaignId);
      setCampaignDetail(detail);
    } catch (err: any) {
      console.error('Failed to load campaign detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setCreating(true);
      await api.createSurveyCampaign({
        model_id: selectedModelId,
        title: newTitle,
        description: newDesc,
        mode: newMode,
        target_owner_type: newTargetOwner,
        deadline: newDeadline ? new Date(newDeadline).toISOString() : undefined,
        sections: ['general', 'fit', 'costs', 'lifecycle', 'hosting']
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      setNewTargetOwner('all');
      setNewDeadline('');
      await loadCampaigns();
    } catch (err: any) {
      alert(err.message || 'Errore nella creazione della campagna');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 mb-2">
            <Vote className="w-3.5 h-3.5" />
            {t.surveys.campaignsTitle}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t.surveys.campaignsTitle}
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            {t.surveys.campaignsSubtitle}
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          {t.surveys.newCampaignBtn}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Campaigns Grid & Progress */}
      {campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <Vote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Nessuna campagna attiva</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Crea una campagna di survey per inviare questionari di verifica e aggiornamento agli Application Owner.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
          >
            <Plus className="w-4 h-4" />
            {t.surveys.newCampaignBtn}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Campaigns List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Campagne di Rilevazione ({campaigns.length})
            </h3>
            {campaigns.map((c) => {
              const isSelected = selectedCampaignId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => loadCampaignDetail(c.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/40 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {c.mode === 'direct_apply' ? 'Auto-Apply' : 'Approval'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {c.target_owner_type === 'process_owner'
                          ? t.surveys.badgeProcessOwner
                          : c.target_owner_type === 'technical_owner' || c.target_owner_type === 'app_owner'
                          ? t.surveys.badgeAppOwner
                          : t.surveys.badgeAllOwners}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {c.metrics.completion_rate}%
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm mb-1">{c.title}</h4>

                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden my-2">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${c.metrics.completion_rate}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                    <span>{c.metrics.total} {t.surveys.totalScopes}</span>
                    <span className="text-indigo-600 font-semibold flex items-center gap-1">
                      {c.metrics.submitted} da approvare
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Campaign Scopes & Diff Review Table */}
          <div className="lg:col-span-2">
            {detailLoading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-slate-500">{t.common.loading}</p>
              </div>
            ) : campaignDetail ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{campaignDetail.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{campaignDetail.description || 'Nessuna descrizione'}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                      {campaignDetail.completion_rate}% Completato
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <th className="p-3.5">Applicazione</th>
                        <th className="p-3.5">Application Owner</th>
                        <th className="p-3.5">Stato</th>
                        <th className="p-3.5 text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {campaignDetail.scopes?.map((s: any) => (
                        <tr key={s.scope_id} className="hover:bg-slate-50 transition">
                          <td className="p-3.5 font-bold text-slate-900">
                            {s.application_name}
                          </td>

                          <td className="p-3.5">
                            <span className="font-medium text-slate-700 block">{s.assigned_name}</span>
                            {s.assigned_email && (
                              <span className="text-slate-400 text-xs">{s.assigned_email}</span>
                            )}
                          </td>

                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                s.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : s.status === 'submitted'
                                  ? 'bg-blue-100 text-blue-800'
                                  : s.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {s.status.toUpperCase()}
                            </span>
                          </td>

                          <td className="p-3.5 text-right">
                            {s.status === 'submitted' ? (
                              <button
                                onClick={() =>
                                  setDiffScope({
                                    id: s.scope_id,
                                    appName: s.application_name,
                                    ownerName: s.assigned_name
                                  })
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                              >
                                <FileDiff className="w-3.5 h-3.5" />
                                {t.surveys.reviewDiffBtn}
                              </button>
                            ) : s.has_response ? (
                              <button
                                onClick={() =>
                                  setDiffScope({
                                    id: s.scope_id,
                                    appName: s.application_name,
                                    ownerName: s.assigned_name
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-800 rounded hover:bg-slate-100 text-xs transition"
                              >
                                Dettaglio Risposte
                              </button>
                            ) : (
                              <span className="text-slate-400 text-xs italic">In attesa risposta</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {t.surveys.newCampaignBtn}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Avvia una campagna di crowdsourcing per verificare e aggiornare gli attributi del portafoglio applicativo.
            </p>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Titolo Campagna *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es. Q4 2026 APM Health Check"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Descrizione o Istruzioni per gli Owner
                </label>
                <textarea
                  rows={2}
                  placeholder="Spiega gli obiettivi della rilevazione agli Application Owner..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {t.surveys.targetOwnerType}
                </label>
                <select
                  value={newTargetOwner}
                  onChange={(e: any) => setNewTargetOwner(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium"
                >
                  <option value="all">{t.surveys.targetAllOwners}</option>
                  <option value="technical_owner">{t.surveys.targetTechnicalOwnersOnly}</option>
                  <option value="process_owner">{t.surveys.targetProcessOwnersOnly}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Modalità Campagna
                  </label>
                  <select
                    value={newMode}
                    onChange={(e: any) => setNewMode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="approval_required">{t.surveys.modeApproval}</option>
                    <option value="direct_apply">{t.surveys.modeDirect}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Data di Scadenza (Opzionale)
                  </label>
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {creating ? t.common.loading : 'Avvia Campagna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diff Review Modal */}
      {diffScope && (
        <SurveyDiffReviewModal
          scopeId={diffScope.id}
          applicationName={diffScope.appName}
          ownerName={diffScope.ownerName}
          onClose={() => setDiffScope(null)}
          onSuccess={() => {
            setDiffScope(null);
            if (selectedCampaignId) loadCampaignDetail(selectedCampaignId);
            loadCampaigns();
          }}
        />
      )}
    </div>
  );
};
