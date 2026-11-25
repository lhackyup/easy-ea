import React, { useState, useEffect, useMemo } from 'react';
import { ProcessAutomationReport, ProcessAutomationItem } from '../../types';
import { api } from '../../lib/api';
import {
  Cpu,
  Bot,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Sparkles,
  GitBranch,
  Clock,
  Activity,
  FileCode,
  Users,
  Hand
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface ProcessAutomationViewProps {
  modelId: string;
  onNavigateToLineage: (processId: string) => void;
}

export const ProcessAutomationView: React.FC<ProcessAutomationViewProps> = ({
  modelId,
  onNavigateToLineage
}) => {
  const { t, interpolate, language } = useLanguage();
  const [data, setData] = useState<ProcessAutomationReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'stp_only' | 'rpa_only'>('all');
  const [sortBy, setSortBy] = useState<'automation_asc' | 'automation_desc' | 'tasks_desc' | 'name'>('automation_asc');
  const [expandedProcessIds, setExpandedProcessIds] = useState<Set<string>>(new Set());

  const getTierLabel = (tier: string) => {
    if (tier.includes('STP')) return t.processes.tierSTP;
    if (tier.includes('High')) return t.processes.tierHigh;
    if (tier.includes('Medium')) return t.processes.tierMedium;
    if (tier.includes('Low')) return t.processes.tierLow;
    return tier;
  };

  const loadAutomation = async () => {
    setLoading(true);
    try {
      const res = await api.getProcessAutomation(modelId, language);
      setData(res);
    } catch (err) {
      console.error('Failed to load process automation report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAutomation();
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

    if (filterMode === 'stp_only') {
      list = list.filter((p) => p.is_stp);
    } else if (filterMode === 'rpa_only') {
      list = list.filter((p) => p.is_rpa_candidate);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.steps.some((s) => s.name.toLowerCase().includes(q) || s.stereotype_label.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'automation_asc') {
      list.sort((a, b) => a.automation_rate_pct - b.automation_rate_pct);
    } else if (sortBy === 'automation_desc') {
      list.sort((a, b) => b.automation_rate_pct - a.automation_rate_pct);
    } else if (sortBy === 'tasks_desc') {
      list.sort((a, b) => b.total_tasks - a.total_tasks);
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [data, search, filterMode, sortBy]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-600">{t.processes.loading}</p>
      </div>
    );
  }

  if (!data || data.processes.length === 0) {
    return (
      <div className="p-12 bg-white border border-dashed border-slate-300 rounded-2xl text-center text-xs text-slate-400">
        {t.processes.noAutomationData}
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="space-y-6">
      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-black text-cyan-600">
            {summary.global_automation_rate}%
          </div>
          <div className="text-[11px] text-slate-600 uppercase font-bold mt-1">
            {t.processes.globalAutomationRate}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-black text-indigo-600">
            {summary.global_digital_maturity} pts
          </div>
          <div className="text-[11px] text-slate-600 uppercase font-bold mt-1">
            {t.processes.globalDigitalMaturity}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
          <div className="text-2xl font-black text-emerald-700">
            {summary.stp_processes_count}
          </div>
          <div className="text-[11px] text-emerald-800 uppercase font-bold mt-1">
            {t.processes.stpProcessesCount}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
          <div className="text-2xl font-black text-amber-700">
            {summary.rpa_ai_candidates_count}
          </div>
          <div className="text-[11px] text-amber-800 uppercase font-bold mt-1">
            {t.processes.rpaCandidatesCount}
          </div>
        </div>
      </div>

      {/* Task Distribution & Operational Maturity Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-cyan-600" />
            <span>{t.processes.taskDistributionTitle} ({summary.total_tasks_evaluated} Task BPMN)</span>
          </span>
        </div>

        <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          {summary.task_distribution.automated > 0 && (
            <div
              style={{
                width: `${(summary.task_distribution.automated / summary.total_tasks_evaluated) * 100}%`
              }}
              className="bg-indigo-600 hover:opacity-90 transition"
              title={`${t.processes.taskTypeAutomated}: ${summary.task_distribution.automated}`}
            />
          )}
          {summary.task_distribution.ai_assisted > 0 && (
            <div
              style={{
                width: `${(summary.task_distribution.ai_assisted / summary.total_tasks_evaluated) * 100}%`
              }}
              className="bg-emerald-500 hover:opacity-90 transition"
              title={`${t.processes.taskTypeAi}: ${summary.task_distribution.ai_assisted}`}
            />
          )}
          {summary.task_distribution.user_tasks > 0 && (
            <div
              style={{
                width: `${(summary.task_distribution.user_tasks / summary.total_tasks_evaluated) * 100}%`
              }}
              className="bg-blue-400 hover:opacity-90 transition"
              title={`${t.processes.taskTypeSemi}: ${summary.task_distribution.user_tasks}`}
            />
          )}
          {summary.task_distribution.manual > 0 && (
            <div
              style={{
                width: `${(summary.task_distribution.manual / summary.total_tasks_evaluated) * 100}%`
              }}
              className="bg-amber-500 hover:opacity-90 transition"
              title={`${t.processes.taskTypeManual}: ${summary.task_distribution.manual}`}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] pt-1 font-medium text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            <span>{t.processes.taskTypeAutomated}: <strong>{summary.task_distribution.automated}</strong></span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>{t.processes.taskTypeAi}: <strong>{summary.task_distribution.ai_assisted}</strong></span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span>{t.processes.taskTypeSemi}: <strong>{summary.task_distribution.user_tasks}</strong></span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>{t.processes.taskTypeManual}: <strong>{summary.task_distribution.manual}</strong></span>
          </span>
        </div>
      </div>

      {/* Top High-ROI RPA / AI Candidates Highlight */}
      {data.top_rpa_candidates && data.top_rpa_candidates.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>{t.processes.topRpaCandidatesTitle}</span>
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {data.top_rpa_candidates.slice(0, 3).map((candidate) => (
              <div
                key={candidate.id}
                className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 truncate" title={candidate.name}>
                      {candidate.name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800">
                      {t.processes.roiHigh}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                    <span>{t.processes.automationLabel} <strong className="text-amber-700">{candidate.automation_rate_pct}%</strong></span>
                    <span>•</span>
                    <span>{interpolate(t.processes.manualTasksCount, { count: candidate.user_tasks + candidate.manual_tasks })}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {candidate.is_critical ? 'Mission Critical' : 'Business Process'}
                  </span>
                  <button
                    onClick={() => onNavigateToLineage(candidate.id)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Lineage</span>
                    <GitBranch className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
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
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white"
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
              onClick={() => setFilterMode('stp_only')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterMode === 'stp_only' ? 'bg-emerald-100 text-emerald-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              ⚡ {t.processes.filterStpOnly} ({summary.stp_processes_count})
            </button>
            <button
              onClick={() => setFilterMode('rpa_only')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterMode === 'rpa_only' ? 'bg-amber-100 text-amber-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              🤖 {t.processes.filterRpaOnly} ({summary.rpa_ai_candidates_count})
            </button>
          </div>

          {/* Sorter */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-cyan-500"
          >
            <option value="automation_asc">{t.processes.sortByAutomationRate}</option>
            <option value="automation_desc">{t.processes.automationRate} (Decrescente)</option>
            <option value="tasks_desc">{t.processes.sortByTasksCount}</option>
            <option value="name">{t.processes.sortByName}</option>
          </select>
        </div>
      </div>

      {/* Process List */}
      <div className="space-y-3">
        {filteredProcesses.map((proc) => {
          const isExpanded = expandedProcessIds.has(proc.id);
          return (
            <div
              key={proc.id}
              className={`bg-white border rounded-2xl transition shadow-2xs ${
                proc.is_stp
                  ? 'border-emerald-300 ring-1 ring-emerald-200/50'
                  : proc.is_rpa_candidate
                  ? 'border-amber-300 ring-1 ring-amber-200/50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Process Card Header */}
              <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <div
                    className={`p-2 rounded-xl border shrink-0 ${
                      proc.is_stp
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : proc.is_rpa_candidate
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-cyan-50 border-cyan-100 text-cyan-600'
                    }`}
                  >
                    {proc.is_stp ? <Zap className="w-5 h-5" /> : proc.is_rpa_candidate ? <Bot className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900">{proc.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          proc.maturity_tier.includes('STP')
                            ? 'bg-emerald-100 text-emerald-800'
                            : proc.maturity_tier.includes('High')
                            ? 'bg-cyan-100 text-cyan-800'
                            : proc.maturity_tier.includes('Medium')
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {getTierLabel(proc.maturity_tier)}
                      </span>
                      {proc.is_stp && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-600 text-white shadow-2xs">
                          {t.processes.stpBadge}
                        </span>
                      )}
                      {proc.is_rpa_candidate && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-500 text-white shadow-2xs">
                          {t.processes.rpaBadge}
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500 font-medium flex-wrap">
                      <span>
                        {interpolate(t.processes.tasksSummaryDetail, {
                          total: proc.total_tasks,
                          automated: proc.automated_tasks,
                          ai: proc.ai_tasks,
                          user: proc.user_tasks,
                          manual: proc.manual_tasks
                        })}
                      </span>
                      {proc.handoff_bottlenecks_count > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-amber-700 font-semibold">
                            ⚠️ {interpolate(t.processes.handoffBottlenecks, { count: proc.handoff_bottlenecks_count })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Side: Rate Gauge & Expand */}
                <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
                  <div className="text-right">
                    <div className="text-lg font-black text-slate-900">
                      {proc.automation_rate_pct}%
                    </div>
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden mt-1 shadow-inner">
                      <div
                        style={{ width: `${proc.automation_rate_pct}%` }}
                        className={`h-full transition ${
                          proc.automation_rate_pct >= 80
                            ? 'bg-emerald-500'
                            : proc.automation_rate_pct >= 40
                            ? 'bg-cyan-500'
                            : 'bg-amber-500'
                        }`}
                      />
                    </div>
                    <div className="text-[9px] text-slate-400 font-semibold uppercase mt-0.5">
                      {t.processes.automationRate}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => onNavigateToLineage(proc.id)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                      title={t.processes.actionViewLineage}
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                    </button>
                    {proc.steps.length > 0 && (
                      <button
                        onClick={() => toggleExpand(proc.id)}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        <span>{isExpanded ? t.processes.collapseTasks : t.processes.expandTasks}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Breakdown: BPMN Tasks List */}
              {isExpanded && proc.steps.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50/70 p-4 rounded-b-2xl space-y-3">
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-600" />
                    <span>{t.processes.tasksBreakdownTitle} ({proc.steps.length})</span>
                  </div>

                  <div className="space-y-2">
                    {proc.steps.map((step) => (
                      <div
                        key={step.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`p-1.5 rounded-lg border text-xs font-mono font-bold ${
                              step.category === 'AUTOMATED'
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                : step.category === 'AI_ASSISTED'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : step.category === 'SEMI_AUTOMATED'
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : 'bg-amber-50 border-amber-200 text-amber-700'
                            }`}
                          >
                            {step.stereotype_label}
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900">{step.name}</span>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {t.processes.tagLabel} <strong className="font-mono text-slate-600">{step.bpmn_tag}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-600 font-medium">
                          <span className="flex items-center gap-1" title="Cycle Time">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{step.cycle_time_minutes} min</span>
                          </span>
                          <span className="flex items-center gap-1" title="Monthly Volume">
                            <Activity className="w-3.5 h-3.5 text-slate-400" />
                            <span>{step.monthly_volume.toLocaleString()} tx/m</span>
                          </span>
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
