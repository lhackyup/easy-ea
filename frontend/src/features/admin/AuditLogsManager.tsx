import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  SecurityAuditItem,
  AuditVerificationResult,
  AuditSummary
} from '../../types';
import { api } from '../../lib/api';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  User as UserIcon,
  Copy,
  Check,
  Eye,
  X,
  FileCheck2,
  Activity,
  Key,
  Shield,
  Fingerprint
} from 'lucide-react';

export const AuditLogsManager: React.FC = () => {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<SecurityAuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('');

  // Verification state
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<AuditVerificationResult | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Details Modal
  const [selectedLog, setSelectedLog] = useState<SecurityAuditItem | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs({
        page,
        size: pageSize,
        action: selectedAction || undefined,
        outcome: selectedOutcome || undefined,
        search: search.trim() || undefined
      });
      setLogs(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const s = await api.getAuditSummary();
      setSummary(s);
    } catch (err) {
      console.warn('Could not load audit summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, selectedAction, selectedOutcome]);

  useEffect(() => {
    loadSummary();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadLogs();
  };

  const handleRunVerification = async () => {
    setVerifying(true);
    setShowVerifyModal(true);
    try {
      const res = await api.verifyAuditTrail();
      setVerificationResult(res);
    } catch (err: any) {
      setVerificationResult({
        is_valid: false,
        total_records: 0,
        message: err.message || 'Errore durante la verifica crittografica'
      });
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const getActionBadgeColor = (action: string) => {
    if (action.startsWith('AUTH_LOGIN')) return 'bg-sky-50 text-sky-800 border-sky-200';
    if (action.startsWith('AUTH_MFA')) return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    if (action.startsWith('AUTH_LOGOUT')) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (action.startsWith('RBAC')) return 'bg-purple-50 text-purple-800 border-purple-200';
    if (action.startsWith('API_KEY')) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    return 'bg-amber-50 text-amber-800 border-amber-200';
  };

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            SUCCESS
          </span>
        );
      case 'FAILURE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            FAILURE
          </span>
        );
      case 'DENIED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <ShieldAlert className="w-3 h-3 text-amber-600" />
            DENIED
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{outcome}</span>;
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header & Verification Trigger */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Fingerprint className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{t.auditLogsManager?.title || 'Audit Trail di Sicurezza (Tamper-Evident)'}</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            {t.auditLogsManager?.subtitle || 'Registro crittografico immutabile basato su hash-chaining SHA-256. Ogni evento è vincolato al precedente: qualsiasi alterazione manuale o cancellazione viene rilevata matematicamente.'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={loadLogs}
            disabled={loading}
            className="p-2 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            title={t.common.retry || 'Ricarica log'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleRunVerification}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{verifying ? (t.auditLogsManager?.verifying || 'Verifica in corso...') : (t.auditLogsManager?.verifyChainBtn || 'Verifica Integrità Catena')}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">{t.auditLogsManager?.totalEvents || 'Totale Eventi Registrati'}</span>
            <span className="text-2xl font-black text-slate-900">{summary.total_records.toLocaleString()}</span>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
              <CheckCircle2 className="w-3 h-3" />
              <span>{t.auditLogsManager?.activeHashChain || 'Hash chain attiva'}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">{t.auditLogsManager?.recent24hEvents || 'Attività Ultime 24 Ore'}</span>
            <span className="text-2xl font-black text-indigo-600">{summary.recent_24h_events}</span>
            <span className="text-[10px] text-slate-400 block mt-1">{t.auditLogsManager?.totalEvents || 'Eventi di sicurezza totali'}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">{t.auditLogsManager?.recent24hLogins || 'Login Riusciti (24h)'}</span>
            <span className="text-2xl font-black text-emerald-600">{summary.recent_24h_logins}</span>
            <span className="text-[10px] text-slate-400 block mt-1">Accessi autenticati</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">{t.auditLogsManager?.recent24hFailures || 'Fallimenti / Rifiuti (24h)'}</span>
            <span className={`text-2xl font-black ${summary.recent_24h_failures > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {summary.recent_24h_failures}
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">Tentativi non autorizzati</span>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full md:max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.auditLogsManager?.searchPlaceholder || 'Cerca per utente, azione, target o IP...'}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 placeholder:text-slate-400 transition"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Action Filter */}
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 transition"
          >
            <option value="">{t.auditLogsManager?.allActions || 'Tutte le Azioni'}</option>
            <option value="AUTH_LOGIN">Login</option>
            <option value="AUTH_MFA_CHALLENGE">MFA Challenge</option>
            <option value="AUTH_MFA_VERIFY">MFA Verifica</option>
            <option value="AUTH_MFA_ENROLLED">MFA Attivato</option>
            <option value="AUTH_MFA_DISABLED">MFA Disattivato</option>
            <option value="AUTH_LOGOUT">Logout / Revoca Token</option>
            <option value="RBAC_USER_CREATED">Utente Creato</option>
            <option value="RBAC_PASSWORD_RESET">Reset Password</option>
            <option value="RBAC_ROLE_ASSIGNED">Ruolo Assegnato</option>
            <option value="RBAC_ROLE_REVOKED">Ruolo Revocato</option>
            <option value="API_KEY_CREATED">API Key Creata</option>
            <option value="API_KEY_REVOKED">API Key Revocata</option>
          </select>

          {/* Outcome Filter */}
          <select
            value={selectedOutcome}
            onChange={(e) => {
              setSelectedOutcome(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 transition"
          >
            <option value="">{t.auditLogsManager?.allOutcomes || 'Tutti gli Esiti'}</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
            <option value="DENIED">DENIED</option>
          </select>

          {(selectedAction || selectedOutcome || search) && (
            <button
              type="button"
              onClick={() => {
                setSelectedAction('');
                setSelectedOutcome('');
                setSearch('');
                setPage(1);
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1"
            >
              {t.auditLogsManager?.resetFilters || 'Azzera'}
            </button>
          )}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">{t.auditLogsManager?.thBlock || '# Blocco'}</th>
                <th className="py-3 px-4">{t.auditLogsManager?.thDateTime || 'Data / Ora (UTC)'}</th>
                <th className="py-3 px-4">{t.auditLogsManager?.thAction || 'Azione'}</th>
                <th className="py-3 px-4">{t.auditLogsManager?.thOutcome || 'Esito'}</th>
                <th className="py-3 px-4">{t.auditLogsManager?.thActor || 'Attore (User)'}</th>
                <th className="py-3 px-4">{t.auditLogsManager?.thTarget || 'Target'}</th>
                <th className="py-3 px-4">{t.auditLogsManager?.thHash || 'Hash Crittografico (SHA-256)'}</th>
                <th className="py-3 px-4 text-right">{t.auditLogsManager?.thDetails || 'Dettagli'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                      <span>{t.auditLogsManager?.loading || 'Caricamento audit trail...'}</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    {t.auditLogsManager?.noRecords || 'Nessun record di audit trovato con i filtri correnti.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition group">
                    <td className="py-3 px-4 font-mono font-bold text-slate-500">
                      #{log.sequence_number}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getOutcomeBadge(log.outcome)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{log.actor_username || 'Sistema'}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        {log.actor_role && <span>[{log.actor_role}]</span>}
                        {log.ip_address && <span>{log.ip_address}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {log.target_type ? (
                        <div>
                          <span className="font-semibold text-slate-700">{log.target_type}</span>
                          {log.target_id && <span className="block text-[10px] font-mono text-slate-400 truncate max-w-[120px]">{log.target_id}</span>}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-800 border border-slate-200 select-all" title={`Hash: ${log.current_hash}\nPrev: ${log.prev_hash}`}>
                          {log.current_hash.slice(0, 10)}...{log.current_hash.slice(-6)}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(log.current_hash, log.id)}
                          className="text-slate-400 hover:text-slate-600 transition p-1"
                          title="Copia hash completo SHA-256"
                        >
                          {copiedHash === log.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 p-1.5 rounded-lg hover:bg-indigo-50 transition"
                        title="Vedi payload JSON"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Mostrati <strong className="text-slate-800">{logs.length}</strong> di <strong className="text-slate-800">{total}</strong> record
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
            >
              Precedente
            </button>
            <span className="px-2 font-mono font-bold text-slate-700">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
            >
              Successivo
            </button>
          </div>
        </div>
      </div>

      {/* Verification Report Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Verifica Integrità Catena Audit</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {verifying ? (
              <div className="py-8 text-center space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                <p className="text-xs text-slate-600 font-medium">
                  Ricalcolo e verifica dei blocchi SHA-256 in corso...
                </p>
              </div>
            ) : verificationResult ? (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-xl border flex items-start space-x-3 ${
                    verificationResult.is_valid
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {verificationResult.is_valid ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs space-y-1">
                    <span className="font-bold text-sm block">
                      {verificationResult.is_valid ? 'Integrità Crittografica Confermata' : 'Allarme Manomissione Rilevata'}
                    </span>
                    <p className="leading-relaxed opacity-90">{verificationResult.message}</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Blocchi Verificati:</span>
                    <span className="font-mono font-bold text-slate-800">{verificationResult.total_records}</span>
                  </div>
                  {verificationResult.first_event_at && (
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Primo Blocco:</span>
                      <span className="font-mono text-[11px] text-slate-800">{new Date(verificationResult.first_event_at).toLocaleString()}</span>
                    </div>
                  )}
                  {verificationResult.last_event_at && (
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Ultimo Blocco:</span>
                      <span className="font-mono text-[11px] text-slate-800">{new Date(verificationResult.last_event_at).toLocaleString()}</span>
                    </div>
                  )}
                  {verificationResult.tampered_at_sequence && (
                    <div className="flex justify-between py-1 text-rose-600 font-bold">
                      <span>Violazione alla sequenza:</span>
                      <span className="font-mono">#{verificationResult.tampered_at_sequence}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowVerifyModal(false)}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Chiudi
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Details Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileCheck2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Dettagli Evento #{selectedLog.sequence_number} ({selectedLog.action})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-400 block">ID Evento (UUID):</span>
                  <span className="font-mono text-[11px] font-bold text-slate-800 select-all">{selectedLog.event_id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Timestamp UTC:</span>
                  <span className="font-mono text-[11px] font-bold text-slate-800">{selectedLog.timestamp}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Attore / Ruolo:</span>
                  <span className="font-bold text-slate-800">{selectedLog.actor_username || 'Sistema'} ({selectedLog.actor_role || 'n/a'})</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Indirizzo IP:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedLog.ip_address || 'Non specificato'}</span>
                </div>
              </div>

              {/* Cryptographic Linkage */}
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-indigo-900 block">Legame Crittografico Blockchain</span>
                <div>
                  <span className="text-[10px] text-slate-400 block">Previous Hash (Blocco Precedente):</span>
                  <code className="text-[10px] font-mono text-slate-600 block break-all bg-white p-1 rounded border border-slate-200 select-all">
                    {selectedLog.prev_hash}
                  </code>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Current Hash (Firma di questo blocco):</span>
                  <code className="text-[10px] font-mono text-indigo-900 font-bold block break-all bg-white p-1 rounded border border-indigo-200 select-all">
                    {selectedLog.current_hash}
                  </code>
                </div>
              </div>

              {/* Metadata JSON */}
              <div>
                <span className="text-[11px] font-bold text-slate-700 block mb-1">Payload Dettagli (Sanitizzato):</span>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 scrollbar-thin">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
