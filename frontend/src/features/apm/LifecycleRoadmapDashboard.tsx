import React, { useState, useEffect, useMemo } from 'react';
import { LifecycleAnalysisData, LifecycleApplicationInfo } from '../../types';
import { api } from '../../lib/api';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  TrendingDown,
  Layers,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Edit2,
  ChevronRight,
  Info,
  Zap
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

interface LifecycleRoadmapDashboardProps {
  modelId: string;
  onEditApp?: (app: any) => void;
  onRefreshParent?: () => void;
}

export const LifecycleRoadmapDashboard: React.FC<LifecycleRoadmapDashboardProps> = ({
  modelId,
  onEditApp,
  onRefreshParent
}) => {
  const { t, language, interpolate } = useLanguage();
  const isEn = language === 'en';
  const { user } = useAuth();
  const userRoles = useMemo(() => new Set((user?.assignments || []).map((a) => a.role)), [user]);
  const canViewFinancials = Boolean(userRoles.has('admin') || userRoles.has('c_level') || !user);

  const [data, setData] = useState<LifecycleAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'sunset' | 'ready' | 'blocked'>('all');
  const [selectedApp, setSelectedApp] = useState<LifecycleApplicationInfo | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLifecycleAnalysis(modelId);
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to load Lifecycle & Decommissioning data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [modelId]);

  const formatEUR = (val: number | null | undefined) => {
    if (val === null || val === undefined) return `🔒 ${t.apm.confidentialCLevel}`;
    return new Intl.NumberFormat(isEn ? 'en-US' : 'it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
  };

  const formatCompactEUR = (val: number | null | undefined) => {
    if (val === null || val === undefined) return `🔒 ${t.apm.confidentialCLevel}`;
    if (val >= 1000000) return `€${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `€${(val / 1000).toFixed(0)}k`;
    return `€${val}`;
  };

  // Timeline boundaries (2022 to 2029)
  const minYear = data?.timeline_range?.min_year || 2022;
  const maxYear = data?.timeline_range?.max_year || 2029;
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      list.push(y);
    }
    return list;
  }, [minYear, maxYear]);

  const startTimelineMs = useMemo(() => new Date(`${minYear}-01-01`).getTime(), [minYear]);
  const endTimelineMs = useMemo(() => new Date(`${maxYear}-12-31`).getTime(), [maxYear]);
  const totalSpanMs = useMemo(() => Math.max(1, endTimelineMs - startTimelineMs), [endTimelineMs, startTimelineMs]);

  // Today marker percent position
  const todayPct = useMemo(() => {
    const todayMs = new Date().getTime();
    return Math.max(0, Math.min(100, ((todayMs - startTimelineMs) / totalSpanMs) * 100));
  }, [startTimelineMs, totalSpanMs]);

  const getTimelineBarPosition = (liveDateStr: string | null | undefined, retDateStr: string | null | undefined) => {
    let startMs = liveDateStr ? new Date(liveDateStr).getTime() : startTimelineMs;
    if (isNaN(startMs) || startMs < startTimelineMs) startMs = startTimelineMs;

    let endMs = retDateStr ? new Date(retDateStr).getTime() : endTimelineMs;
    if (isNaN(endMs) || endMs > endTimelineMs) endMs = endTimelineMs;
    if (endMs < startMs) endMs = startMs + 86400000 * 30; // Min 30 days width

    const leftPct = Math.max(0, Math.min(100, ((startMs - startTimelineMs) / totalSpanMs) * 100));
    const widthPct = Math.max(1.5, Math.min(100 - leftPct, ((endMs - startMs) / totalSpanMs) * 100));
    const isIndefinite = !retDateStr;

    return { leftPct, widthPct, isIndefinite };
  };

  const filteredApps = useMemo(() => {
    if (!data?.applications) return [];
    return data.applications.filter((app) => {
      const matchesSearch =
        search === '' ||
        app.name.toLowerCase().includes(search.toLowerCase()) ||
        (app.short_name && app.short_name.toLowerCase().includes(search.toLowerCase())) ||
        (app.app_code && app.app_code.toLowerCase().includes(search.toLowerCase())) ||
        (app.vendor && app.vendor.toLowerCase().includes(search.toLowerCase())) ||
        (app.business_owner && app.business_owner.toLowerCase().includes(search.toLowerCase()));

      let matchesFilter = true;
      if (activeFilter === 'sunset') {
        matchesFilter = Boolean(app.is_sunset);
      } else if (activeFilter === 'ready') {
        matchesFilter = Boolean(app.is_sunset && app.is_ready_for_decommission);
      } else if (activeFilter === 'blocked') {
        matchesFilter = Boolean(app.is_sunset && !app.is_ready_for_decommission);
      }

      return matchesSearch && matchesFilter;
    });
  }, [data?.applications, search, activeFilter]);

  const sunsetApps = useMemo(() => {
    if (!data?.applications) return [];
    return data.applications.filter((a) => a.is_sunset);
  }, [data?.applications]);

  const handleExportCsv = () => {
    const list = filteredApps.length > 0 ? filteredApps : (data?.applications || []);
    if (list.length === 0) return;

    const headers = [
      isEn ? 'Application ID' : 'ID Applicazione',
      isEn ? 'Application Name' : 'Nome Applicazione',
      isEn ? 'Code' : 'Codice',
      isEn ? 'Lifecycle Stage' : 'Stato Ciclo di Vita',
      isEn ? 'TIME Quadrant' : 'Quadrante TIME',
      isEn ? 'Go-Live Date' : 'Data Go-Live',
      isEn ? 'Planned Retirement Date' : 'Data Dismissione Prevista',
      ...(canViewFinancials ? [isEn ? 'Annual TCO (€)' : 'TCO Annuo (€)'] : []),
      isEn ? 'Shutdown Readiness' : 'Prontezza Spegnimento',
      isEn ? 'Active Dependency Count' : 'Conteggio Dipendenze Attive',
      isEn ? 'Business Owner' : 'Business Owner',
      isEn ? 'Technical Owner' : 'Technical Owner',
      isEn ? 'Vendor' : 'Fornitore'
    ];

    const rows = list.map((a) => [
      a.id,
      `"${a.name.replace(/"/g, '""')}"`,
      a.app_code || '',
      a.lifecycle_status,
      a.time_quadrant,
      a.live_date || '',
      a.retirement_date || (isEn ? 'Indefinite' : 'Indeterminato'),
      ...(canViewFinancials ? [a.annual_cost || 0] : []),
      a.is_ready_for_decommission ? (isEn ? 'Ready for Shutdown' : 'Pronta allo Spegnimento') : (isEn ? 'Blocked' : 'Bloccata'),
      a.active_dependencies_count || 0,
      `"${(a.business_owner || '').replace(/"/g, '""')}"`,
      `"${(a.technical_owner || '').replace(/"/g, '""')}"`,
      `"${(a.vendor || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `easyea_lifecycle_decommissioning_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStageColor = (status: string) => {
    switch (status) {
      case 'Plan':
        return {
          bar: 'bg-sky-500 text-white border-sky-400',
          badge: 'bg-sky-50 text-sky-700 border-sky-200'
        };
      case 'Phase In':
        return {
          bar: 'bg-purple-600 text-white border-purple-400',
          badge: 'bg-purple-50 text-purple-700 border-purple-200'
        };
      case 'Live':
        return {
          bar: 'bg-emerald-600 text-white border-emerald-400',
          badge: 'bg-emerald-50 text-emerald-800 border-emerald-200'
        };
      case 'Phase Out':
        return {
          bar: 'bg-amber-500 text-slate-950 font-black border-amber-300',
          badge: 'bg-amber-50 text-amber-800 border-amber-200'
        };
      case 'Retired':
        return {
          bar: 'bg-slate-600 text-slate-100 border-slate-500',
          badge: 'bg-slate-100 text-slate-700 border-slate-300'
        };
      default:
        return {
          bar: 'bg-slate-500 text-white border-slate-400',
          badge: 'bg-slate-100 text-slate-700 border-slate-200'
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600" />
          <p className="text-xs text-slate-500 font-medium">{t.apm.lifecycleLoading}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center space-y-4 shadow-sm my-6">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900">{t.apm.lifecycleFailedLoad}</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">{error || t.apm.lifecycleFailedRequest}</p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition cursor-pointer shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t.apm.lifecycleRetry}</span>
        </button>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            <span>{t.apm.lifecycleTitle}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">{t.apm.lifecycleSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer"
            title={t.apm.lifecycleRefreshData}
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">{t.apm.lifecycleRefreshData}</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.apm.lifecycleExportCsv}</span>
          </button>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Recoverable TCO Takeout Savings */}
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
              {t.apm.lifecycleKpiTakeoutSavings}
            </span>
            <div className="p-2 rounded-xl bg-emerald-100/80 text-emerald-700 border border-emerald-200">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-950 font-mono">
              {formatEUR(summary.total_takeout_savings)}
            </div>
            <div className="text-[11px] font-bold text-emerald-700 mt-0.5">
              {sunsetApps.length} {isEn ? 'sunset applications' : 'applicazioni in dismissione'}
            </div>
          </div>
          <p className="text-[11px] text-emerald-800/80 mt-2">{t.apm.lifecycleKpiTakeoutSavingsDesc}</p>
        </div>

        {/* KPI 2: Sunsets Next 12 Months */}
        <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800">
              {t.apm.lifecycleKpiRetirementsSoon}
            </span>
            <div className="p-2 rounded-xl bg-amber-100/80 text-amber-700 border border-amber-200">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-amber-950">
              {summary.retirements_next_12m} <span className="text-xs font-semibold text-amber-700 font-sans">app</span>
            </div>
            <div className="text-[11px] font-bold text-amber-700 mt-0.5">
              {summary.retirements_next_6m} {isEn ? 'within 6 months' : 'entro 6 mesi'}
            </div>
          </div>
          <p className="text-[11px] text-amber-800/80 mt-2">{t.apm.lifecycleKpiRetirementsSoonDesc}</p>
        </div>

        {/* KPI 3: Ready for Shutdown */}
        <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-800">
              {t.apm.lifecycleKpiReadyForShutdown}
            </span>
            <div className="p-2 rounded-xl bg-blue-100/80 text-blue-700 border border-blue-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-blue-950">
              {summary.ready_for_decommission_count} <span className="text-xs font-semibold text-blue-700 font-sans">app</span>
            </div>
            <div className="text-[11px] font-bold text-blue-700 mt-0.5">
              0 {isEn ? 'active dependencies' : 'dipendenze residue'}
            </div>
          </div>
          <p className="text-[11px] text-blue-800/80 mt-2">{t.apm.lifecycleKpiReadyForShutdownDesc}</p>
        </div>

        {/* KPI 4: Blocked by Dependencies */}
        <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-800">
              {t.apm.lifecycleKpiBlockedByDeps}
            </span>
            <div className="p-2 rounded-xl bg-rose-100/80 text-rose-700 border border-rose-200">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-rose-950">
              {summary.blocked_decommission_count} <span className="text-xs font-semibold text-rose-700 font-sans">app</span>
            </div>
            <div className="text-[11px] font-bold text-rose-700 mt-0.5">
              {isEn ? 'Requires interface decoupling' : 'Richiede bonifica interfacce'}
            </div>
          </div>
          <p className="text-[11px] text-rose-800/80 mt-2">{t.apm.lifecycleKpiBlockedByDepsDesc}</p>
        </div>
      </div>

      {/* 5-Stage Distribution Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
        <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>{isEn ? 'Application Portfolio Lifecycle Distribution' : 'Distribuzione Ciclo di Vita del Portafoglio'}</span>
          </span>
          <span className="text-slate-400 font-mono text-[11px]">
            {summary.total_applications} {isEn ? 'total business applications' : 'applicazioni di business totali'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
          {/* Plan */}
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-2.5 text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700">Plan</span>
            <div className="text-lg font-black text-sky-950 mt-0.5">{summary.counts_by_status.Plan || 0}</div>
            <span className="text-[10px] text-sky-600 font-mono">
              {summary.costs_by_status.Plan !== null && summary.costs_by_status.Plan !== undefined
                ? formatCompactEUR(summary.costs_by_status.Plan)
                : `🔒 ${t.apm.confidentialCLevel}`}
            </span>
          </div>

          {/* Phase In */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-2.5 text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700">Phase In</span>
            <div className="text-lg font-black text-purple-950 mt-0.5">{summary.counts_by_status['Phase In'] || 0}</div>
            <span className="text-[10px] text-purple-600 font-mono">
              {summary.costs_by_status['Phase In'] !== null && summary.costs_by_status['Phase In'] !== undefined
                ? formatCompactEUR(summary.costs_by_status['Phase In'])
                : `🔒 ${t.apm.confidentialCLevel}`}
            </span>
          </div>

          {/* Live */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Live</span>
            <div className="text-lg font-black text-emerald-950 mt-0.5">{summary.counts_by_status.Live || 0}</div>
            <span className="text-[10px] text-emerald-600 font-mono">
              {summary.costs_by_status.Live !== null && summary.costs_by_status.Live !== undefined
                ? formatCompactEUR(summary.costs_by_status.Live)
                : `🔒 ${t.apm.confidentialCLevel}`}
            </span>
          </div>

          {/* Phase Out */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">Phase Out</span>
            <div className="text-lg font-black text-amber-950 mt-0.5">{summary.counts_by_status['Phase Out'] || 0}</div>
            <span className="text-[10px] text-amber-700 font-mono">
              {summary.costs_by_status['Phase Out'] !== null && summary.costs_by_status['Phase Out'] !== undefined
                ? formatCompactEUR(summary.costs_by_status['Phase Out'])
                : `🔒 ${t.apm.confidentialCLevel}`}
            </span>
          </div>

          {/* Retired */}
          <div className="bg-slate-100 border border-slate-300 rounded-xl p-2.5 text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Retired</span>
            <div className="text-lg font-black text-slate-900 mt-0.5">{summary.counts_by_status.Retired || 0}</div>
            <span className="text-[10px] text-slate-500 font-mono">
              {summary.costs_by_status.Retired !== null && summary.costs_by_status.Retired !== undefined
                ? formatCompactEUR(summary.costs_by_status.Retired)
                : `🔒 ${t.apm.confidentialCLevel}`}
            </span>
          </div>
        </div>
      </div>

      {/* Chronological Timeline Roadmap (Interactive Gantt Chart) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>{t.apm.lifecycleTimelineTitle}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{t.apm.lifecycleTimelineSubtitle}</p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {interpolate(t.apm.lifecycleFilterAll, { count: String(data.applications.length) })}
            </button>
            <button
              onClick={() => setActiveFilter('sunset')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeFilter === 'sunset'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              {interpolate(t.apm.lifecycleFilterSunsetOnly, { count: String(sunsetApps.length) })}
            </button>
            <button
              onClick={() => setActiveFilter('ready')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeFilter === 'ready'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {interpolate(t.apm.lifecycleFilterReadyOnly, { count: String(summary.ready_for_decommission_count) })}
            </button>
            <button
              onClick={() => setActiveFilter('blocked')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeFilter === 'blocked'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
              }`}
            >
              {interpolate(t.apm.lifecycleFilterBlockedOnly, { count: String(summary.blocked_decommission_count) })}
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.apm.lifecycleSearchPlaceholder}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Gantt Timeline Canvas */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
          {/* Timeline Header (Years Grid) */}
          <div className="flex border-b border-slate-200 bg-slate-100/80 select-none text-[11px] font-bold text-slate-600 sticky top-0 z-10">
            <div className="w-64 sm:w-80 shrink-0 px-4 py-2.5 border-r border-slate-200 text-slate-700 font-extrabold uppercase tracking-wider text-[10px]">
              {isEn ? 'Application / Owner' : 'Applicazione / Owner'}
            </div>
            <div className="flex-1 relative flex">
              {years.map((year, idx) => (
                <div
                  key={year}
                  className={`flex-1 text-center py-2.5 border-r border-slate-200 last:border-r-0 font-mono ${
                    year === data.timeline_range.current_year ? 'bg-indigo-50/70 text-indigo-900 font-black' : ''
                  }`}
                >
                  <span>{year}</span>
                </div>
              ))}

              {/* Today Vertical Marker in Header */}
              <div
                className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center"
                style={{ left: `${todayPct}%` }}
              >
                <span className="bg-rose-600 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-full shadow-xs -translate-y-1">
                  {t.apm.lifecycleTodayMarker}
                </span>
              </div>
            </div>
          </div>

          {/* Timeline Rows */}
          <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
            {filteredApps.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 italic">
                {t.apm.lifecycleNoAppsFound}
              </div>
            ) : (
              filteredApps.map((app) => {
                const colors = getStageColor(app.lifecycle_status);
                const { leftPct, widthPct, isIndefinite } = getTimelineBarPosition(app.live_date, app.retirement_date);

                return (
                  <div
                    key={app.id}
                    className="flex items-center hover:bg-white transition group cursor-pointer"
                    onClick={() => onEditApp && onEditApp(app)}
                  >
                    {/* Left Column: App Metadata */}
                    <div className="w-64 sm:w-80 shrink-0 px-4 py-2.5 border-r border-slate-200/80 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-bold text-slate-500">[{app.app_code || 'AP0000'}]</span>
                        <span className="text-xs font-bold text-slate-900 truncate" title={app.name}>
                          {app.short_name || app.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border uppercase ${colors.badge}`}>
                          {app.lifecycle_status}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono font-medium">
                          {formatCompactEUR(app.annual_cost)}
                        </span>
                        {app.is_sunset && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black border flex items-center gap-0.5 ${
                              app.is_ready_for_decommission
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-rose-50 text-rose-800 border-rose-300'
                            }`}
                            title={app.is_ready_for_decommission ? t.apm.lifecycleStatusReady : t.apm.lifecycleStatusBlocked}
                          >
                            {app.is_ready_for_decommission ? (
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                            )}
                            <span>{app.is_ready_for_decommission ? 'Ready' : `${app.active_dependencies_count} deps`}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Timeline Gantt Bar */}
                    <div className="flex-1 relative h-10 flex items-center px-1">
                      {/* Grid background lines */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {years.map((year) => (
                          <div
                            key={year}
                            className={`flex-1 border-r border-slate-100 last:border-r-0 ${
                              year === data.timeline_range.current_year ? 'bg-indigo-50/20' : ''
                            }`}
                          />
                        ))}
                      </div>

                      {/* Today Red Vertical Line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-rose-500/80 z-20 pointer-events-none"
                        style={{ left: `${todayPct}%` }}
                      />

                      {/* The Timeline Bar */}
                      <div
                        className={`absolute h-5 rounded-lg border shadow-2xs flex items-center px-2 text-[10px] font-bold transition-all duration-200 group-hover:h-6 group-hover:shadow-md z-10 ${colors.bar} ${
                          isIndefinite ? 'rounded-r-none border-r-0' : ''
                        }`}
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`
                        }}
                        title={`${app.name} (${app.lifecycle_status})\nGo-Live: ${app.live_date || 'N/A'}\nSunset: ${app.retirement_date || (isEn ? 'Indefinite' : 'Indeterminato')}${canViewFinancials && app.annual_cost !== null && app.annual_cost !== undefined ? `\nTCO: ${formatEUR(app.annual_cost)}` : ''}`}
                      >
                        <span className="truncate select-none">
                          {app.short_name || app.name}
                        </span>
                        {isIndefinite && (
                          <ArrowRight className="w-3 h-3 ml-auto opacity-70 shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Decommissioning & Sunset Register Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>{t.apm.lifecycleRegisterTitle}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{t.apm.lifecycleRegisterSubtitle}</p>
          </div>
          <div className="text-xs font-mono font-bold text-slate-500">
            {sunsetApps.length} {isEn ? 'applications in sunset program' : 'applicazioni nel programma di sunset'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4">{t.apm.lifecycleColApp}</th>
                <th className="py-3 px-4">{t.apm.lifecycleColStage}</th>
                <th className="py-3 px-4">{t.apm.lifecycleColTime}</th>
                <th className="py-3 px-4">{t.apm.lifecycleColLiveDate}</th>
                <th className="py-3 px-4">{t.apm.lifecycleColRetirementDate}</th>
                <th className="py-3 px-4">{t.apm.lifecycleColSavings}</th>
                <th className="py-3 px-4">{t.apm.lifecycleColReadiness}</th>
                <th className="py-3 px-4">{t.apm.lifecycleColBlockers}</th>
                <th className="py-3 px-4 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sunsetApps.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                    {t.apm.lifecycleNoAppsFound}
                  </td>
                </tr>
              ) : (
                sunsetApps.map((app) => {
                  const colors = getStageColor(app.lifecycle_status);
                  return (
                    <tr key={app.id} className="hover:bg-slate-50/80 transition">
                      {/* Application */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span>{app.name}</span>
                            <span className="font-mono text-[10px] text-slate-400">({app.app_code || 'AP0000'})</span>
                          </div>
                          {app.business_owner && (
                            <span className="text-[10px] text-slate-400 font-normal">Owner: {app.business_owner}</span>
                          )}
                        </div>
                      </td>

                      {/* Stage */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${colors.badge}`}>
                          {app.lifecycle_status}
                        </span>
                      </td>

                      {/* TIME */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            app.time_quadrant === 'Invest'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : app.time_quadrant === 'Tolerate'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : app.time_quadrant === 'Migrate'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {app.time_quadrant}
                        </span>
                      </td>

                      {/* Live Date */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                        {app.live_date || '—'}
                      </td>

                      {/* Retirement Date */}
                      <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-amber-900">
                        {app.retirement_date || (isEn ? 'Indefinite' : 'Indeterminato')}
                      </td>

                      {/* Recoverable TCO */}
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                        {formatEUR(app.annual_cost)}
                      </td>

                      {/* Readiness */}
                      <td className="py-3.5 px-4">
                        {app.is_ready_for_decommission ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{t.apm.lifecycleStatusReady}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>{t.apm.lifecycleStatusBlocked}</span>
                          </span>
                        )}
                      </td>

                      {/* Blocker details */}
                      <td className="py-3.5 px-4">
                        {app.active_dependencies_count === 0 ? (
                          <span className="text-[11px] text-emerald-700 font-medium">
                            {t.apm.lifecycleNoBlockers}
                          </span>
                        ) : (
                          <div className="space-y-1">
                            {app.dependent_live_apps.length > 0 && (
                              <div className="text-[10px] font-bold text-rose-700">
                                ➔ {interpolate(t.apm.lifecycleBlockerAppsCount, { count: String(app.dependent_live_apps.length) })}:
                                <span className="font-normal text-slate-600 ml-1">
                                  {app.dependent_live_apps.map((d) => d.name).join(', ')}
                                </span>
                              </div>
                            )}
                            {app.dependent_processes.length > 0 && (
                              <div className="text-[10px] font-bold text-amber-800">
                                ➔ {interpolate(t.apm.lifecycleBlockerProcessesCount, { count: String(app.dependent_processes.length) })}:
                                <span className="font-normal text-slate-600 ml-1">
                                  {app.dependent_processes.map((d) => d.name).join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onEditApp && onEditApp(app)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-[11px] font-bold text-slate-700 transition cursor-pointer inline-flex items-center gap-1"
                          title={t.apm.btnEditAppTitle}
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>{t.apm.btnEditApp}</span>
                        </button>
                      </td>
                    </tr>
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
