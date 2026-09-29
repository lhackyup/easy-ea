import React, { useState, useEffect } from 'react';
import { ArchiSchema, SchemaVersionHistory } from '../../types';
import { api } from '../../lib/api';
import {
  History,
  Download,
  RotateCcw,
  User,
  Calendar,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

interface SchemaVersionHistoryModalProps {
  schema: ArchiSchema;
  onClose: () => void;
  onRollbackSuccess: (updatedSchema: ArchiSchema) => void;
}

export const SchemaVersionHistoryModal: React.FC<SchemaVersionHistoryModalProps> = ({
  schema,
  onClose,
  onRollbackSuccess
}) => {
  const [versions, setVersions] = useState<SchemaVersionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSchemaVersions(schema.id);
      setVersions(data);
    } catch (err: any) {
      setError(err.message || 'Errore nel recupero dello storico versioni.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, [schema.id]);

  const handleRollback = async (version: SchemaVersionHistory) => {
    if (!window.confirm(`Sei sicuro di voler ripristinare lo schema alla versione ${version.version_label}?`)) {
      return;
    }
    setActionLoadingId(version.id);
    setError(null);
    try {
      const res = await api.rollbackSchemaVersion(schema.id, version.id);
      setSuccessMsg(res.message);
      await fetchVersions();
      setTimeout(() => {
        onRollbackSuccess(res.schema);
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Errore durante il rollback.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Storico Versioni Schema</h2>
              <p className="text-xs text-slate-500">
                {schema.name} • Versione attuale: <span className="font-semibold text-purple-700">{schema.current_version}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center space-x-3 text-rose-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-3 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-500 mb-2" />
              <p className="text-xs font-semibold">Caricamento versioni...</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Nessuna versione precedente registrata.
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((ver, idx) => {
                const isCurrent = idx === 0;
                return (
                  <div
                    key={ver.id}
                    className={`p-4 rounded-xl border transition flex items-start justify-between ${
                      isCurrent
                        ? 'bg-purple-50/40 border-purple-200 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 pr-4">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                            isCurrent
                              ? 'bg-purple-600 text-white'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {ver.version_label}
                        </span>
                        {isCurrent && (
                          <span className="text-[11px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                            Versione Corrente
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-medium text-slate-800 leading-snug">
                        {ver.commit_message || 'Nessun messaggio di commit'}
                      </div>

                      <div className="flex items-center space-x-4 text-[11px] text-slate-400 pt-1">
                        <span className="flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span>{ver.author_name}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {ver.created_at
                              ? new Date(ver.created_at).toLocaleString('it-IT', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : ''}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0 pt-1">
                      <a
                        href={api.downloadVersionXmlUrl(schema.id, ver.id)}
                        download={`${schema.name}_${ver.version_label}.archimate`}
                        title="Scarica snapshot .archimate"
                        className="p-2 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 transition"
                      >
                        <Download className="w-4 h-4" />
                      </a>

                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleRollback(ver)}
                          disabled={actionLoadingId === ver.id}
                          title="Ripristina a questa versione"
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-700 hover:text-white bg-purple-50 hover:bg-purple-600 border border-purple-200 transition flex items-center space-x-1"
                        >
                          {actionLoadingId === ver.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          <span>Ripristina</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <span>Lo storico conserva fino alle $N$ versioni configurate dall'amministratore.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
