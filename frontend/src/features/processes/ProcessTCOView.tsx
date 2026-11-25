import React, { useState, useEffect, useMemo } from 'react';
import { ProcessTCOReport, ProcessTCOItem } from '../../types';
import { api } from '../../lib/api';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Server,
  Layers,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  PieChart,
  ShieldAlert,
  Play,
  GitBranch
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface ProcessTCOViewProps {
  modelId: string;
  onNavigateToLineage: (processId: string) => void;
  onNavigateToDecom: (elementId: string) => void;
}

export const ProcessTCOView: React.FC<ProcessTCOViewProps> = ({
  modelId,
  onNavigateToLineage,
  onNavigateToDecom
}) => {
  const { t, language, interpolate } = useLanguage();
  const [data, setData] = useState<ProcessTCOReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'cost_only' | 'warnings_only'>('all');
  const [sortBy, setSortBy] = useState<'allocated' | 'gross' | 'name'>('allocated');
  const [expandedProcessIds, setExpandedProcessIds] = useState<Set<string>>(new Set());

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return `🔒 ${t.processes.confidentialCLevel}`;
    return new Intl.NumberFormat(language === 'it' ? 'it-IT' : 'en-US', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const loadTCO = async () => {
    setLoading(true);
    try {
      const res = await api.getProcessTCO(modelId, language);
      setData(res);
    } catch (err) {
      console.error('Failed to load process TCO report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTCO();
  }, [modelId, language]);

  const toggleExpand = (id: string) => {
    setExpandedProcessIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredProcesses = useMemo(() => {
    if (!data) return [];
    let list = [...data.processes];

    if (filterMode === 'cost_only') {
      list = list.filter((p) => p.allocated_cost !== null && p.allocated_cost > 0);
    } else if (filterMode === 'warnings_only') {
      list = list.filter((p) => !!p.efficiency_warning);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.supporting_applications.some((a) => a.name.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'allocated') {
      list.sort((a, b) => (b.allocated_cost ?? 0) - (a.allocated_cost ?? 0));
    } else if (sortBy === 'gross') {
      list.sort((a, b) => (b.gross_cost ?? 0) - (a.gross_cost ?? 0));
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [data, search, filterMode, sortBy]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-600">{t.processes.loading}</p>
      </div>
    );
  }

  if (!data || data.processes.length === 0) {
    return (
      <div className="p-12 bg-white border border-dashed border-slate-300 rounded-2xl text-center text-xs text-slate-400">
        {t.processes.noCostData}
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="space-y-6">
      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-black text-indigo-600">
            {formatCurrency(summary.total_allocated_cost)}
          </div>
          <div className="text-[11px] text-slate-600 uppercase font-bold mt-1">
            {t.processes.totalAllocatedSpend}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-black text-slate-800">
            {formatCurrency(summary.average_process_cost)}
          </div>
          <div className="text-[11px] text-slate-600 uppercase font-bold mt-1">
            {t.processes.averageProcessCost}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-sm font-bold text-slate-900 truncate" title={summary.top_spend_process?.name || ''}>
            {summary.top_spend_process?.name || 'N/A'}
          </div>
          <div className="text-base font-black text-purple-700 mt-0.5">
            {summary.top_spend_process && summary.top_spend_process.allocated_cost !== null ? (
              <>
                {formatCurrency(summary.top_spend_process.allocated_cost)}
                {summary.top_spend_process.cost_percentage !== null && (
                  <span className="text-[10px] text-slate-500 font-semibold ml-1">
                    ({summary.top_spend_process.cost_percentage}%)
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs font-bold text-slate-400">🔒 {t.processes.confidentialCLevel}</span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 uppercase font-bold mt-1">
            {t.processes.topSpendProcess}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
          <div className="text-2xl font-black text-amber-700">
            {summary.efficiency_warnings_count}
          </div>
          <div className="text-[11px] text-amber-800 uppercase font-bold mt-1">
            {t.processes.efficiencyAlertsCount}
          </div>
        </div>
      </div>

      {/* Breakdown by Criticality Bar */}
      {summary.cost_by_criticality && summary.total_allocated_cost !== null && summary.total_allocated_cost > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-indigo-600" />
              <span>{t.processes.tcoBreakdownByCriticality}</span>
            </span>
            <span className="text-slate-500 text-[11px]">
              {t.processes.tcoGrossLabel} <strong className="text-slate-700">{formatCurrency(summary.total_gross_cost)}</strong>
            </span>
          </div>

          <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            {summary.cost_by_criticality['Mission Critical'] > 0 && (
              <div
                style={{
                  width: `${(summary.cost_by_criticality['Mission Critical'] / summary.total_allocated_cost) * 100}%`
                }}
                className="bg-rose-500 hover:opacity-90 transition"
                title={`Mission Critical: ${formatCurrency(summary.cost_by_criticality['Mission Critical'])}`}
              />
            )}
            {summary.cost_by_criticality['Business Operational'] > 0 && (
              <div
                style={{
                  width: `${(summary.cost_by_criticality['Business Operational'] / summary.total_allocated_cost) * 100}%`
                }}
                className="bg-indigo-500 hover:opacity-90 transition"
                title={`Business Operational: ${formatCurrency(summary.cost_by_criticality['Business Operational'])}`}
              />
            )}
            {summary.cost_by_criticality['Administrative'] > 0 && (
              <div
                style={{
                  width: `${(summary.cost_by_criticality['Administrative'] / summary.total_allocated_cost) * 100}%`
                }}
                className="bg-slate-400 hover:opacity-90 transition"
                title={`Administrative: ${formatCurrency(summary.cost_by_criticality['Administrative'])}`}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] pt-1 font-medium text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Mission Critical: <strong>{formatCurrency(summary.cost_by_criticality['Mission Critical'] || 0)}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span>Business Operational: <strong>{formatCurrency(summary.cost_by_criticality['Business Operational'] || 0)}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span>Administrative: <strong>{formatCurrency(summary.cost_by_criticality['Administrative'] || 0)}</strong></span>
            </span>
          </div>
        </div>
      )}

      {/* Toolbar: Search, Filters & Sorters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={t.processes.searchProcess}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Mode */}
          <div className="inline-flex rounded-xl p-0.5 bg-slate-100 text-xs font-semibold text-slate-600">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterMode === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              {t.processes.filterAll} ({data.processes.length})
            </button>
            <button
              onClick={() => setFilterMode('cost_only')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterMode === 'cost_only' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              {t.processes.filterWithCostOnly}
            </button>
            <button
              onClick={() => setFilterMode('warnings_only')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterMode === 'warnings_only' ? 'bg-amber-100 text-amber-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              ⚠️ {t.processes.filterWarningsOnly} ({summary.efficiency_warnings_count})
            </button>
          </div>

          {/* Sorter */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-500"
          >
            <option value="allocated">{t.processes.sortByAllocatedCost}</option>
            <option value="gross">{t.processes.grossCostLabel} (Desc)</option>
            <option value="name">{t.processes.sortByName}</option>
          </select>
        </div>
      </div>

      {/* Process TCO List */}
      <div className="space-y-3">
        {filteredProcesses.map((proc) => {
          const isExpanded = expandedProcessIds.has(proc.id);
          return (
            <div
              key={proc.id}
              className={`bg-white border rounded-2xl transition shadow-2xs ${
                proc.efficiency_warning ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Process Row Header */}
              <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 shrink-0">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900">{proc.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          proc.criticality === 'Mission Critical'
                            ? 'bg-rose-100 text-rose-800'
                            : proc.criticality === 'Business Operational'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {proc.criticality}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 font-medium flex-wrap">
                      <span className="flex items-center gap-1">
                        <Server className="w-3.5 h-3.5 text-slate-400" />
                        {interpolate(t.processes.appsDependentCount, { count: proc.supporting_apps_count })}
                      </span>
                      <span>•</span>
                      <span>
                        {t.processes.grossCostLabel}: <strong className="text-slate-700">{formatCurrency(proc.gross_cost)}</strong>
                      </span>
                    </div>

                    {proc.efficiency_warning && (
                      <div className="mt-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{proc.efficiency_warning}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Allocated Cost & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
                  <div className="text-right">
                    <div className="text-lg font-black text-slate-900">
                      {formatCurrency(proc.allocated_cost)}
                    </div>
                    {proc.cost_percentage !== null && proc.cost_percentage !== undefined ? (
                      <div className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                        {proc.cost_percentage}% {t.processes.shareOfTotalItSpend}
                      </div>
                    ) : (
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                        🔒 {t.processes.confidentialCLevel}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => onNavigateToLineage(proc.id)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                      title={t.processes.actionViewLineage}
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                    </button>
                    {proc.supporting_applications.length > 0 && (
                      <button
                        onClick={() => toggleExpand(proc.id)}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        <span>{isExpanded ? t.processes.collapseApps : t.processes.expandApps}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Breakdown: Supporting Applications */}
              {isExpanded && proc.supporting_applications.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50/70 p-4 rounded-b-2xl space-y-3">
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{t.processes.supportingAppsCostBreakdown} ({proc.supporting_applications.length})</span>
                  </div>

                  <div className="space-y-2">
                    {proc.supporting_applications.map((app) => (
                      <div
                        key={app.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-slate-900">{app.name}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                app.time_quadrant === 'Eliminate'
                                  ? 'bg-rose-100 text-rose-800'
                                  : app.time_quadrant === 'Migrate'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              TIME: {app.time_quadrant}
                            </span>
                            {app.lifecycle_status && (
                              <span className="text-[9px] text-slate-500 font-medium">
                                ({app.lifecycle_status})
                              </span>
                            )}
                          </div>

                          <div className="text-[10px] text-slate-500 mt-1 font-medium">
                            {app.shared_across_processes_count > 1
                              ? interpolate(t.processes.sharedAcrossProcesses, { count: app.shared_across_processes_count - 1 })
                              : t.processes.singleProcessExclusive}
                            {' • '}
                            {t.processes.tcoTotalAnnualAppCost} <strong className="text-slate-700">{formatCurrency(app.annual_cost)}</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs font-black text-indigo-700">
                              {formatCurrency(app.allocated_cost)}
                            </div>
                            <div className="text-[9px] text-slate-400 font-semibold uppercase">
                              {t.processes.tcoAllocatedShare}
                            </div>
                          </div>

                          {app.time_quadrant === 'Eliminate' && (
                            <button
                              onClick={() => onNavigateToDecom(app.id)}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition shadow-2xs cursor-pointer flex items-center space-x-1"
                            >
                              <Play className="w-3 h-3" />
                              <span>{t.processes.actionSimulateDecom}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
