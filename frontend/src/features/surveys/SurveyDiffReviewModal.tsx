import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  FileDiff,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  Building
} from 'lucide-react';

interface SurveyDiffReviewModalProps {
  scopeId: string;
  applicationName: string;
  ownerName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const SurveyDiffReviewModal: React.FC<SurveyDiffReviewModalProps> = ({
  scopeId,
  applicationName,
  ownerName,
  onClose,
  onSuccess
}) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopeData, setScopeData] = useState<any>(null);
  const [feedback, setFeedback] = useState<string>('');

  useEffect(() => {
    loadScope();
  }, [scopeId]);

  const loadScope = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getSurveyScope(scopeId);
      setScopeData(data);
    } catch (err: any) {
      setError(err.message || 'Errore nel caricamento del diff');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await api.approveSurveyScope(scopeId, feedback);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'approvazione');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!feedback.trim()) {
      setError('Inserisci una motivazione o feedback prima di rifiutare la survey.');
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      await api.rejectSurveyScope(scopeId, feedback);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Errore durante il rifiuto');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  const diffSummary = scopeData?.response?.diff_summary || {};
  const diffEntries = Object.entries(diffSummary);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                Architect Diff Review
              </span>
              {ownerName && (
                <span className="text-xs text-slate-500 font-medium">
                  Inviata da: {ownerName}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              {t.surveys.diffModalTitle}: <span className="text-indigo-600">{applicationName}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {scopeData?.response?.notes && (
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">
                <MessageSquare className="w-3.5 h-3.5" />
                Note inviate dall'Application Owner
              </div>
              <p className="text-sm text-slate-700 italic">
                "{scopeData.response.notes}"
              </p>
            </div>
          )}

          {/* Diff Table */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <FileDiff className="w-4 h-4 text-indigo-600" />
              Modifiche Proposte ({diffEntries.length})
            </h4>

            {diffEntries.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm text-slate-500 italic">
                Nessun valore modificato rispetto al modello live.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="p-3">{t.surveys.field}</th>
                      <th className="p-3 text-slate-500">{t.surveys.oldValue}</th>
                      <th className="p-3 w-6 text-center"></th>
                      <th className="p-3 text-indigo-700">{t.surveys.newValue}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {diffEntries.map(([key, diff]: [string, any]) => (
                      <tr key={key} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-semibold text-slate-800 capitalize">
                          {key.replace(/_/g, ' ')}
                        </td>
                        <td className="p-3 text-slate-400 line-through">
                          {String(diff.old ?? 'n/d')}
                        </td>
                        <td className="p-3 text-center text-slate-400">
                          <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                        </td>
                        <td className="p-3 font-bold text-emerald-700 bg-emerald-50/40">
                          {String(diff.new ?? 'n/d')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Feedback Form */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Note di Feedback o Revisione
            </label>
            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={t.surveys.feedbackPrompt}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
          >
            {t.common.cancel}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleReject}
              className="px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl text-sm font-semibold transition disabled:opacity-50"
            >
              {t.surveys.rejectWithFeedback}
            </button>

            <button
              type="button"
              disabled={actionLoading}
              onClick={handleApprove}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {actionLoading ? t.common.loading : t.surveys.approveAndMerge}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
