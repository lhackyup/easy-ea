import React, { useState, useEffect, useMemo } from 'react';
import {
  GapAnalysisResult,
  GapItem,
  GapCategory,
  ModelWorkspace
} from '../../types';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import {
  ArrowRightLeft,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  Trash2,
  TrendingDown,
  TrendingUp,
  Briefcase,
  Layers,
  Calendar,
  Columns,
  List,
  Sparkles,
  Info
} from 'lucide-react';

interface GapAnalysisMatrixProps {
  modelId: string;
}

export const GapAnalysisMatrix: React.FC<GapAnalysisMatrixProps> = ({ modelId }) => {
  const { t, interpolate } = useLanguage();
  const gapT = t.gapAnalysis;
  const [data, setData] = useState<GapAnalysisResult | null>(null);
  const [models, setModels] = useState<ModelWorkspace[]>([]);
  const [compareModelId, setCompareModelId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [layerFilter, setLayerFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'swimlanes' | 'table'>('swimlanes');
  const [onlyMissingWp, setOnlyMissingWp] = useState<boolean>(false);

  // Load models list for cross-model comparison selector
  useEffect(() => {
    api.getModels().then(setModels).catch(() => {});
  }, []);

  const loadData = async (compModelId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getGapAnalysis(modelId, compModelId || undefined);
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || gapT.errorTitle);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (modelId) {
      loadData(compareModelId);
    }
  }, [modelId, compareModelId]);

  const handleCompareChange = (targetId: string) => {
    setCompareModelId(targetId);
  };

  const filteredItems = useMemo(() => {
    if (!data || !data.items) return [];
    return data.items.filter((item) => {
      // Search
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesWp = item.work_packages.some((wp) => wp.toLowerCase().includes(query));
        const matchesPlateau = item.target_plateau.toLowerCase().includes(query);
        if (!matchesName && !matchesWp && !matchesPlateau) return false;
      }

      // Layer Filter
      if (layerFilter !== 'all' && item.layer !== layerFilter) return false;

      // Missing WP Filter
      if (onlyMissingWp) {
        if (item.category === 'RETAINED') return false;
        if (item.has_work_package) return false;
      }

      return true;
    });
  }, [data, search, layerFilter, onlyMissingWp]);

  const swimlanes = useMemo(() => {
    return {
      retired: filteredItems.filter((i) => i.category === 'RETIRED'),
      modified: filteredItems.filter((i) => i.category === 'MODIFIED'),
      added: filteredItems.filter((i) => i.category === 'ADDED'),
      retained: filteredItems.filter((i) => i.category === 'RETAINED'),
    };
  }, [filteredItems]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {gapT.loading}
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-sm font-bold text-slate-900">{gapT.errorTitle}</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">{error || gapT.errorTitle}</p>
        <button
          onClick={() => loadData(compareModelId)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
        >
          {gapT.retry}
        </button>
      </div>
    );
  }

  const { metrics } = data;

  return (
    <div className="space-y-6 pb-12">
      {/* Header / Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-200 shadow-2xs">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900">{gapT.title}</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 rounded-full border border-blue-200 uppercase">
                {gapT.standardBadge}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {gapT.subtitle}
            </p>
          </div>
        </div>

        {/* Mode Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">{gapT.comparisonLabel}</span>
            <select
              value={compareModelId}
              onChange={(e) => handleCompareChange(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="">{gapT.intraModelOption}</option>
              <optgroup label={gapT.compareTargetGroup}>
                {models
                  .filter((m) => m.id !== modelId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      vs {m.name} ({m.code || 'LIB'})
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          <button
            onClick={() => loadData(compareModelId)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200 cursor-pointer"
            title={gapT.recalculate}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{gapT.recalculate}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Retained */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{gapT.retainedCardTitle}</span>
            <CheckCircle2 className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-slate-700">{metrics.retained_count}</span>
            <span className="text-xs text-slate-400">{gapT.retainedSub}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">{gapT.retainedDesc}</p>
        </div>

        {/* Added */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{gapT.addedCardTitle}</span>
            <PlusCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-emerald-600">{metrics.added_count}</span>
            <span className="text-xs text-slate-400">{gapT.addedSub}</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-semibold mt-2">
            {interpolate(gapT.addedCostDesc, { cost: metrics.total_added_investments.toLocaleString() })}
          </p>
        </div>

        {/* Modified */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{gapT.modifiedCardTitle}</span>
            <ArrowRightLeft className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-blue-600">{metrics.modified_count}</span>
            <span className="text-xs text-slate-400">{gapT.modifiedSub}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">{gapT.modifiedDesc}</p>
        </div>

        {/* Retired */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{gapT.retiredCardTitle}</span>
            <Trash2 className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-rose-600">{metrics.retired_count}</span>
            <span className="text-xs text-slate-400">{gapT.retiredSub}</span>
          </div>
          <p className="text-[11px] text-rose-700 font-semibold mt-2">
            {interpolate(gapT.retiredSavingsDesc, { savings: metrics.total_savings.toLocaleString() })}
          </p>
        </div>

        {/* Net Financial Delta */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{gapT.netTcoCardTitle}</span>
            {metrics.net_financial_delta <= 0 ? (
              <TrendingDown className="w-4 h-4 text-emerald-600" />
            ) : (
              <TrendingUp className="w-4 h-4 text-amber-600" />
            )}
          </div>
          <div className="mt-2 flex items-baseline space-x-1.5">
            <span
              className={`text-2xl font-black ${
                metrics.net_financial_delta <= 0 ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {metrics.net_financial_delta <= 0 ? '' : '+'}€{metrics.net_financial_delta.toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">{gapT.netTcoDesc}</p>
        </div>
      </div>

      {/* Governance Alert Bar (Missing WorkPackage Coverage) */}
      {metrics.gaps_missing_work_package > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{gapT.governanceAlertTitle}</strong>{' '}
              {interpolate(gapT.governanceAlertText, { count: metrics.gaps_missing_work_package })}
            </span>
          </div>
          <button
            onClick={() => setOnlyMissingWp(!onlyMissingWp)}
            className="px-2.5 py-1 bg-amber-200/70 hover:bg-amber-200 text-amber-950 font-bold rounded-lg transition cursor-pointer shrink-0 ml-2"
          >
            {onlyMissingWp ? gapT.showAll : gapT.filterMissingWp}
          </button>
        </div>
      )}

      {/* Control Bar: Filters & View Modes */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={gapT.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-800"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Layer Filter */}
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={layerFilter}
              onChange={(e) => setLayerFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">{gapT.allLayers}</option>
              <option value="Business">Business Layer</option>
              <option value="Application">Application Layer</option>
              <option value="Technology">Technology Layer</option>
              <option value="Strategy">Strategy Layer</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('swimlanes')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'swimlanes' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>{gapT.swimlanesView}</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>{gapT.tableView}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Swimlanes vs Table */}
      {viewMode === 'swimlanes' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {/* 1. RETIRED SWIMLANE */}
          <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-rose-200/80 pb-2.5">
              <div className="flex items-center space-x-1.5 text-rose-800">
                <Trash2 className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">{gapT.swimlaneRetiredTitle}</h3>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-200/80 text-rose-900 rounded-full">
                {swimlanes.retired.length}
              </span>
            </div>
            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {swimlanes.retired.length === 0 ? (
                <p className="text-xs text-rose-400 italic text-center py-6">{gapT.noRetired}</p>
              ) : (
                swimlanes.retired.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border border-rose-200 rounded-xl p-3 shadow-2xs space-y-2 hover:border-rose-400 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">{item.name}</h4>
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-100 text-rose-800 rounded shrink-0">
                        {item.type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Layer: <strong className="text-slate-700">{item.layer}</strong></span>
                      {item.annual_cost > 0 && (
                        <span className="font-bold text-rose-600">-€{item.annual_cost.toLocaleString()}</span>
                      )}
                    </div>
                    {item.work_packages.length > 0 ? (
                      <div className="flex items-center space-x-1 text-[10px] text-indigo-700 font-medium">
                        <Briefcase className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="truncate">{item.work_packages.join(', ')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 text-[10px] text-amber-600 font-bold">
                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>{gapT.missingWorkPackage}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. MODIFIED SWIMLANE */}
          <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-blue-200/80 pb-2.5">
              <div className="flex items-center space-x-1.5 text-blue-800">
                <ArrowRightLeft className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">{gapT.swimlaneModifiedTitle}</h3>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-200/80 text-blue-900 rounded-full">
                {swimlanes.modified.length}
              </span>
            </div>
            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {swimlanes.modified.length === 0 ? (
                <p className="text-xs text-blue-400 italic text-center py-6">{gapT.noModified}</p>
              ) : (
                swimlanes.modified.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border border-blue-200 rounded-xl p-3 shadow-2xs space-y-2 hover:border-blue-400 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">{item.name}</h4>
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-800 rounded shrink-0">
                        {item.type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Plateau: <strong className="text-slate-700">{item.target_plateau}</strong></span>
                      {item.cost_impact !== 0 && (
                        <span className="font-bold text-blue-600">
                          {item.cost_impact > 0 ? `+€${item.cost_impact.toLocaleString()}` : `-€${Math.abs(item.cost_impact).toLocaleString()}`}
                        </span>
                      )}
                    </div>
                    {item.work_packages.length > 0 ? (
                      <div className="flex items-center space-x-1 text-[10px] text-indigo-700 font-medium">
                        <Briefcase className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="truncate">{item.work_packages.join(', ')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 text-[10px] text-amber-600 font-bold">
                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>{gapT.missingWorkPackage}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. ADDED SWIMLANE */}
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2.5">
              <div className="flex items-center space-x-1.5 text-emerald-800">
                <PlusCircle className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">{gapT.swimlaneAddedTitle}</h3>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-200/80 text-emerald-900 rounded-full">
                {swimlanes.added.length}
              </span>
            </div>
            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {swimlanes.added.length === 0 ? (
                <p className="text-xs text-emerald-400 italic text-center py-6">{gapT.noAdded}</p>
              ) : (
                swimlanes.added.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border border-emerald-200 rounded-xl p-3 shadow-2xs space-y-2 hover:border-emerald-400 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">{item.name}</h4>
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-800 rounded shrink-0">
                        {item.type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Target: <strong className="text-slate-700">{item.target_plateau}</strong></span>
                      {item.cost_impact > 0 && (
                        <span className="font-bold text-emerald-600">+€{item.cost_impact.toLocaleString()}</span>
                      )}
                    </div>
                    {item.work_packages.length > 0 ? (
                      <div className="flex items-center space-x-1 text-[10px] text-indigo-700 font-medium">
                        <Briefcase className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="truncate">{item.work_packages.join(', ')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 text-[10px] text-amber-600 font-bold">
                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>{gapT.missingWorkPackage}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4. RETAINED SWIMLANE */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center space-x-1.5 text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider">{gapT.swimlaneRetainedTitle}</h3>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-800 rounded-full">
                {swimlanes.retained.length}
              </span>
            </div>
            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {swimlanes.retained.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">{gapT.noRetained}</p>
              ) : (
                swimlanes.retained.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-1.5 hover:border-slate-300 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-800 leading-snug">{item.name}</h4>
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 rounded shrink-0">
                        {item.type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>Layer: <strong className="text-slate-600">{item.layer}</strong></span>
                      <span className="text-[10px] text-emerald-600 font-semibold">{gapT.persistentBadge}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Table View */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">{gapT.thElement}</th>
                  <th className="py-3 px-4">{gapT.thTypeLayer}</th>
                  <th className="py-3 px-4">{gapT.thGapCategory}</th>
                  <th className="py-3 px-4">{gapT.thHorizon}</th>
                  <th className="py-3 px-4">{gapT.thPlateau}</th>
                  <th className="py-3 px-4">{gapT.thCostDelta}</th>
                  <th className="py-3 px-4">{gapT.thWorkPackage}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      {gapT.noElementsFound}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-700">{item.type}</span>
                          <span className="text-[10px] text-slate-400">{item.layer}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                            item.category === 'RETIRED'
                              ? 'bg-rose-100 text-rose-800'
                              : item.category === 'ADDED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.category === 'MODIFIED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{item.architecture_horizon}</td>
                      <td className="py-3 px-4 text-slate-600">{item.target_plateau}</td>
                      <td className="py-3 px-4">
                        {item.category === 'RETIRED' ? (
                          <span className="font-bold text-rose-600">-€{item.annual_cost.toLocaleString()}</span>
                        ) : item.category === 'ADDED' ? (
                          <span className="font-bold text-emerald-600">+€{item.cost_impact.toLocaleString()}</span>
                        ) : item.cost_impact !== 0 ? (
                          <span className="font-bold text-blue-600">
                            {item.cost_impact > 0 ? `+€${item.cost_impact.toLocaleString()}` : `-€${Math.abs(item.cost_impact).toLocaleString()}`}
                          </span>
                        ) : (
                          <span className="text-slate-400">€0</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {item.work_packages.length > 0 ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[11px] font-medium">
                            <Briefcase className="w-3 h-3 text-indigo-500" />
                            <span>{item.work_packages.join(', ')}</span>
                          </span>
                        ) : item.category !== 'RETAINED' ? (
                          <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-600">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            <span>{gapT.missingBadge}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
