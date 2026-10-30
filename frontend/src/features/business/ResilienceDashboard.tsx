import React, { useState, useEffect, useMemo } from 'react';
import {
  ResilienceAnalysisResult,
  ResilienceMismatchItem,
  ResilienceMetrics
} from '../../types';
import { api } from '../../lib/api';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Database,
  Server,
  Layers,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Activity,
  Zap,
  Info
} from 'lucide-react';

interface ResilienceDashboardProps {
  modelId: string;
}

export const ResilienceDashboard: React.FC<ResilienceDashboardProps> = ({ modelId }) => {
  const [data, setData] = useState<ResilienceAnalysisResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'mismatched' | 'critical' | 'compliant'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sla' | 'rto' | 'rpo'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getResilienceAnalysis(modelId);
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Errore nel caricamento dell\'analisi di resilienza');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (modelId) {
      loadData();
    }
  }, [modelId]);

  const toggleRow = (processId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(processId)) {
        next.delete(processId);
      } else {
        next.add(processId);
      }
      return next;
    });
  };

  const filteredItems = useMemo(() => {
    if (!data || !data.mismatches) return [];
    return data.mismatches.filter((item) => {
      // Search
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = item.process_name.toLowerCase().includes(query);
        const matchesBottleneck = item.bottleneck?.name.toLowerCase().includes(query);
        if (!matchesName && !matchesBottleneck) return false;
      }

      // Status Filter
      if (statusFilter === 'mismatched' && item.status === 'COMPLIANT') return false;
      if (statusFilter === 'critical' && item.status !== 'CRITICAL_MISMATCH') return false;
      if (statusFilter === 'compliant' && item.status !== 'COMPLIANT') return false;

      // Type Filter
      if (typeFilter === 'sla' && !item.has_sla_mismatch) return false;
      if (typeFilter === 'rto' && !item.has_rto_breach) return false;
      if (typeFilter === 'rpo' && !item.has_rpo_breach) return false;

      return true;
    });
  }, [data, search, statusFilter, typeFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Analisi Mismatch RTO/RPO e SLA in corso...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-sm font-bold text-slate-900">Errore Analisi di Resilienza</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">{error || 'Impossibile elaborare i dati'}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
        >
          Riprova
        </button>
      </div>
    );
  }

  const { metrics } = data;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 shadow-2xs">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900">Operational Resilience & SLA Mismatch Engine</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200 uppercase">
                DORA / ISO 22301
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Audit automatico della catena di fornitura tecnica: confronto tra requisiti di Business e capacità reali di Applicazioni e Nodi tecnologici.
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Ricalcola</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Compliance Rate */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tasso di Conformità</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className={`text-2xl font-black ${metrics.compliance_rate >= 80 ? 'text-emerald-600' : metrics.compliance_rate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
              {metrics.compliance_rate}%
            </span>
            <span className="text-xs text-slate-400">
              ({metrics.compliant_processes} / {metrics.total_processes} conformi)
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full ${metrics.compliance_rate >= 80 ? 'bg-emerald-500' : metrics.compliance_rate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
              style={{ width: `${metrics.compliance_rate}%` }}
            />
          </div>
        </div>

        {/* Mismatched Processes */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Processi con Mismatch</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-rose-600">{metrics.mismatched_processes}</span>
            <span className="text-xs text-slate-400">processi a rischio continuità</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Violazioni rilevate su SLA di disponibilità, RTO o RPO.
          </p>
        </div>

        {/* Critical DORA Processes */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Funzioni Critiche DORA / Tier-1</span>
            <Zap className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-indigo-600">{metrics.total_critical_processes}</span>
            <span className="text-xs text-slate-400">servizi essenziali monitorati</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Sottoposti a requisiti stringenti di resilienza operativa.
          </p>
        </div>

        {/* Worst SLA / RTO Gap */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Peggiori Scostamenti</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-lg font-black text-slate-800">-{metrics.worst_sla_gap}%</span>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Max SLA Gap</p>
            </div>
            <div>
              <span className="text-lg font-black text-slate-800">+{metrics.worst_rto_gap}h</span>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Max RTO Breach</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cerca processo o collo di bottiglia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
          />
        </div>

        {/* Status Filter Badges */}
        <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">
          <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Filtro:</span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tutti ({data.mismatches.length})
          </button>
          <button
            onClick={() => setStatusFilter('mismatched')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'mismatched'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            Solo Mismatch ({metrics.mismatched_processes})
          </button>
          <button
            onClick={() => setStatusFilter('critical')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'critical'
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            Critici DORA Tier-1
          </button>
          <button
            onClick={() => setStatusFilter('compliant')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'compliant'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Conformi ({metrics.compliant_processes})
          </button>
        </div>

        {/* Type Filter Select */}
        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">Tutti i tipi di mismatch</option>
            <option value="sla">Solo violazioni SLA</option>
            <option value="rto">Solo violazioni RTO</option>
            <option value="rpo">Solo violazioni RPO</option>
          </select>
        </div>
      </div>

      {/* Mismatches Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-8"></th>
                <th className="py-3 px-4">Processo di Business</th>
                <th className="py-3 px-4">Tier / DORA</th>
                <th className="py-3 px-4">SLA Disponibilità</th>
                <th className="py-3 px-4">RTO (Ripristino)</th>
                <th className="py-3 px-4">RPO (Perdita Dati)</th>
                <th className="py-3 px-4">Collo di Bottiglia (Weakest Link)</th>
                <th className="py-3 px-4">Stato Resilienza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Nessun processo corrispondente ai filtri selezionati.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isExpanded = expandedRows.has(item.process_id);
                  return (
                    <React.Fragment key={item.process_id}>
                      <tr
                        onClick={() => toggleRow(item.process_id)}
                        className={`hover:bg-slate-50 transition cursor-pointer ${isExpanded ? 'bg-slate-50/70' : ''}`}
                      >
                        <td className="py-3 px-4 text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div className="flex flex-col">
                            <span>{item.process_name}</span>
                            <span className="text-[10px] font-medium text-slate-400">
                              {item.supporting_apps_count} app collegate, {item.supporting_tech_count} nodi tech
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                                item.criticality_tier.includes('Tier-1')
                                  ? 'bg-rose-100 text-rose-800'
                                  : item.criticality_tier.includes('Tier-2')
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {item.criticality_tier.split(' ')[0]}
                            </span>
                            {item.dora_critical_function && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
                                DORA Critico
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <div className="flex items-center space-x-1.5">
                              <span className={`font-bold ${item.has_sla_mismatch ? 'text-rose-600' : 'text-slate-800'}`}>
                                {item.effective_sla}%
                              </span>
                              <span className="text-[10px] text-slate-400">/ {item.target_sla}%</span>
                            </div>
                            {item.has_sla_mismatch && (
                              <span className="text-[10px] font-bold text-rose-500">
                                Gap: -{item.sla_gap}%
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <div className="flex items-center space-x-1.5">
                              <span className={`font-bold ${item.has_rto_breach ? 'text-rose-600' : 'text-slate-800'}`}>
                                {item.effective_rto_hours}h
                              </span>
                              <span className="text-[10px] text-slate-400">/ max {item.target_rto_hours}h</span>
                            </div>
                            {item.has_rto_breach && (
                              <span className="text-[10px] font-bold text-rose-500">
                                Scostamento: +{item.rto_gap_hours}h
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <div className="flex items-center space-x-1.5">
                              <span className={`font-bold ${item.has_rpo_breach ? 'text-rose-600' : 'text-slate-800'}`}>
                                {item.effective_rpo_hours}h
                              </span>
                              <span className="text-[10px] text-slate-400">/ max {item.target_rpo_hours}h</span>
                            </div>
                            {item.has_rpo_breach && (
                              <span className="text-[10px] font-bold text-rose-500">
                                Scostamento: +{item.rpo_gap_hours}h
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {item.bottleneck ? (
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                {item.bottleneck.name}
                              </span>
                              <span className="text-[10px] text-slate-400">{item.bottleneck.issue}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Nessun collo di bottiglia</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {item.status === 'COMPLIANT' ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Conforme</span>
                            </span>
                          ) : item.status === 'CRITICAL_MISMATCH' ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Critico</span>
                            </span>
                          ) : item.status === 'HIGH_MISMATCH' ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-bold">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Alto Rischio</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-[11px] font-bold">
                              <Info className="w-3.5 h-3.5 text-orange-600" />
                              <span>Medio Rischio</span>
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Supply Chain Breakdown */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={8} className="p-4 pl-12 border-b border-slate-200">
                            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                  <Layers className="w-4 h-4 text-emerald-600" />
                                  <span>Dettaglio Catena di Fornitura Operativa (Supply Chain Breakdown)</span>
                                </h4>
                                <span className="text-[11px] text-slate-400">
                                  Obiettivi: SLA {item.target_sla}%, RTO {item.target_rto_hours}h, RPO {item.target_rpo_hours}h
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Supporting Applications */}
                                <div className="space-y-2">
                                  <div className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1">
                                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Applicazioni di Supporto ({item.supporting_apps.length})</span>
                                  </div>
                                  {item.supporting_apps.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">Nessuna applicazione collegata via relazioni Serving/Realization.</p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {item.supporting_apps.map((app) => (
                                        <div
                                          key={app.id}
                                          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                                            item.bottleneck?.id === app.id
                                              ? 'bg-rose-50/60 border-rose-300'
                                              : 'bg-slate-50 border-slate-200'
                                          }`}
                                        >
                                          <div>
                                            <p className="font-bold text-slate-800">{app.name}</p>
                                            <p className="text-[10px] text-slate-400">DR: {app.dr_strategy}</p>
                                          </div>
                                          <div className="text-right text-[11px] space-y-0.5">
                                            <span className="font-bold text-slate-700">SLA: {app.sla}%</span>
                                            <div className="text-[10px] text-slate-400">RTO: {app.rto_hours}h | RPO: {app.rpo_hours}h</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Supporting Technology Nodes */}
                                <div className="space-y-2">
                                  <div className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1">
                                    <Server className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Infrastrutture & Nodi Tecnologici ({item.supporting_tech.length})</span>
                                  </div>
                                  {item.supporting_tech.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">Nessun nodo tecnologico mappato sotto le applicazioni collegate.</p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {item.supporting_tech.map((node) => (
                                        <div
                                          key={node.id}
                                          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                                            item.bottleneck?.id === node.id
                                              ? 'bg-rose-50/60 border-rose-300'
                                              : 'bg-slate-50 border-slate-200'
                                          }`}
                                        >
                                          <div>
                                            <p className="font-bold text-slate-800">{node.name}</p>
                                            <p className="text-[10px] text-slate-400">HA: {node.ha_redundancy}</p>
                                          </div>
                                          <div className="text-right text-[11px] space-y-0.5">
                                            <span className="font-bold text-slate-700">SLA: {node.sla}%</span>
                                            <div className="text-[10px] text-slate-400">RTO: {node.rto_hours}h | RPO: {node.rpo_hours}h</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
