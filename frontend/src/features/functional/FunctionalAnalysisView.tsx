import React, { useState, useEffect, useMemo } from 'react';
import {
  FunctionalAnalysisData,
  FunctionalNode,
  FunctionalLeafRow,
  FunctionalAppInfo
} from '../../types';
import { api } from '../../lib/api';
import {
  Network,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  DollarSign,
  Search,
  Filter,
  Layers,
  ArrowRight,
  ShieldAlert,
  Boxes,
  Sparkles,
  HelpCircle,
  FolderTree,
  Table as TableIcon,
  Zap,
  Check,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface FunctionalAnalysisViewProps {
  modelId: string;
}

export const FunctionalAnalysisView: React.FC<FunctionalAnalysisViewProps> = ({ modelId }) => {
  const { t, language, interpolate } = useLanguage();
  const [data, setData] = useState<FunctionalAnalysisData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'tree' | 'matrix' | 'remediation'>('tree');
  const [statusFilter, setStatusFilter] = useState<'all' | 'gap' | 'overlap' | 'optimal'>('all');
  const [search, setSearch] = useState<string>('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getFunctionalAnalysis(modelId);
      setData(res);
      // Initialize root nodes as expanded
      const initialExpanded: Record<string, boolean> = {};
      res.hierarchy_trees.forEach((tree) => {
        initialExpanded[tree.id] = true;
        // Expand L1 children by default as well
        tree.children.forEach((c) => {
          initialExpanded[c.id] = true;
        });
      });
      setExpandedNodes(initialExpanded);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error fetching functional architecture data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [modelId]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const expandAll = () => {
    if (!data) return;
    const allExp: Record<string, boolean> = {};
    const traverse = (node: FunctionalNode) => {
      allExp[node.id] = true;
      node.children.forEach(traverse);
    };
    data.hierarchy_trees.forEach(traverse);
    setExpandedNodes(allExp);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  const formatEUR = (val: number) =>
    new Intl.NumberFormat(language === 'en' ? 'en-US' : 'it-IT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(val);

  // Filtered leaves for the matrix view
  const filteredLeaves = useMemo(() => {
    if (!data?.leaf_functions) return [];
    return data.leaf_functions.filter((leaf) => {
      const query = search.toLowerCase();
      const matchesSearch =
        !search ||
        leaf.name.toLowerCase().includes(query) ||
        leaf.path.toLowerCase().includes(query) ||
        leaf.applications.some((a) => a.app_name.toLowerCase().includes(query));

      let matchesStatus = true;
      if (statusFilter === 'gap') matchesStatus = leaf.is_gap;
      else if (statusFilter === 'overlap') matchesStatus = leaf.is_overlapping;
      else if (statusFilter === 'optimal') matchesStatus = leaf.is_optimal;

      return matchesSearch && matchesStatus;
    });
  }, [data?.leaf_functions, search, statusFilter]);

  // Check if a tree branch matches the search or filter
  const nodeMatchesFilter = (node: FunctionalNode): boolean => {
    const query = search.toLowerCase();
    const selfMatchesSearch =
      !search ||
      node.name.toLowerCase().includes(query) ||
      node.effective_applications.some((a) => a.app_name.toLowerCase().includes(query));

    let selfMatchesStatus = true;
    if (node.is_leaf) {
      if (statusFilter === 'gap') selfMatchesStatus = node.is_gap;
      else if (statusFilter === 'overlap') selfMatchesStatus = node.is_overlapping;
      else if (statusFilter === 'optimal') selfMatchesStatus = node.is_optimal;
    } else {
      // For branch, matches if any leaves in subtree match
      if (statusFilter === 'gap') selfMatchesStatus = (node.rollup?.gap_leaves ?? 0) > 0;
      else if (statusFilter === 'overlap') selfMatchesStatus = (node.rollup?.overlapping_leaves ?? 0) > 0;
      else if (statusFilter === 'optimal') selfMatchesStatus = (node.rollup?.optimal_leaves ?? 0) > 0;
    }

    if (selfMatchesSearch && selfMatchesStatus) return true;

    // Check if any child matches
    return node.children.some((child) => nodeMatchesFilter(child));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">{t.functionalAnalysis.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm">
        <p className="font-bold">Error loading functional architecture:</p>
        <p className="mt-1">{error || 'No data found'}</p>
      </div>
    );
  }

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: FunctionalNode, depth: number = 0) => {
    const isExpanded = !!expandedNodes[node.id];
    const hasChildren = node.children.length > 0;
    const matches = nodeMatchesFilter(node);

    if (!matches) return null;

    return (
      <div key={node.id} className="relative flex flex-col">
        {/* Node card */}
        <div
          className={`flex flex-col md:flex-row md:items-center justify-between p-3.5 my-1.5 rounded-2xl border transition-all ${
            node.is_evaluation_unit
              ? node.is_gap
                ? 'bg-rose-50/60 border-rose-200/80 hover:bg-rose-50'
                : node.is_overlapping
                ? 'bg-amber-50/60 border-amber-200/80 hover:bg-amber-50'
                : 'bg-emerald-50/50 border-emerald-200/70 hover:bg-emerald-50'
              : node.level > 2
              ? 'bg-slate-50/60 border-slate-200/70 border-dashed hover:bg-slate-50'
              : depth === 0
              ? 'bg-slate-900 text-white border-slate-800 shadow-sm'
              : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-sm'
          }`}
          style={{ marginLeft: `${Math.min(depth * 24, 96)}px` }}
        >
          {/* Left section: expand icon, level pill, name */}
          <div className="flex items-start md:items-center space-x-2.5 flex-1 min-w-0">
            {hasChildren ? (
              <button
                onClick={() => toggleNode(node.id)}
                className={`p-1 rounded-lg transition ${
                  depth === 0
                    ? 'hover:bg-slate-800 text-slate-300'
                    : 'hover:bg-slate-100 text-slate-600'
                }`}
                title={isExpanded ? t.functionalAnalysis.collapseAll : t.functionalAnalysis.expandAll}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            ) : (
              <div className="w-6 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              </div>
            )}

            {/* Level Badge */}
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider shrink-0 ${
                depth === 0
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                  : node.level > 2
                  ? 'bg-slate-100 text-slate-600 border border-slate-200'
                  : node.is_evaluation_unit
                  ? 'bg-slate-200 text-slate-800'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
              }`}
            >
              {node.level_label}
              {node.is_evaluation_unit && ` • ${t.functionalAnalysis.evaluationUnitBadge}`}
              {node.level > 2 && ` • ${t.functionalAnalysis.detailSubfunctionBadge}`}
            </span>

            {/* Title & Type */}
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h4
                  className={`text-sm font-bold truncate ${
                    depth === 0 ? 'text-white' : 'text-slate-900'
                  }`}
                  title={node.name}
                >
                  {node.name}
                </h4>
                <span
                  className={`text-[10px] hidden sm:inline ${
                    depth === 0 ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  ({node.type})
                </span>
              </div>
              {node.documentation && (
                <p
                  className={`text-[11px] truncate mt-0.5 max-w-xl ${
                    depth === 0 ? 'text-slate-400' : 'text-slate-500'
                  }`}
                  title={node.documentation}
                >
                  {node.documentation}
                </p>
              )}
            </div>
          </div>

          {/* Right section: Rollup stats or Evaluation Unit Apps / Savings */}
          <div className="mt-3 md:mt-0 flex items-center flex-wrap gap-2 justify-end shrink-0">
            {node.is_evaluation_unit ? (
              <>
                {/* Status Badge */}
                {node.is_gap && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{t.functionalAnalysis.badgeGap}</span>
                  </span>
                )}
                {node.is_optimal && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t.functionalAnalysis.badgeOptimal}</span>
                  </span>
                )}
                {node.is_overlapping && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                    <GitMerge className="w-3.5 h-3.5" />
                    <span>{interpolate(t.functionalAnalysis.badgeOverlap, { count: node.app_count })}</span>
                  </span>
                )}

                {/* Applications Chips */}
                <div className="flex items-center flex-wrap gap-1 max-w-md justify-end">
                  {node.effective_applications.map((app) => (
                    <span
                      key={app.app_id}
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${
                        node.target_app?.app_id === app.app_id
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                      title={`${app.app_name} (${app.time_quadrant}) - Cost: ${formatEUR(app.annual_cost)}${app.is_imputed_from_child ? ` - Imputata da: ${app.imputed_from}` : ''}`}
                    >
                      <span>{app.app_name}</span>
                      {app.is_imputed_from_child && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {app.imputed_from}
                        </span>
                      )}
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                        {app.time_quadrant}
                      </span>
                    </span>
                  ))}
                </div>

                {/* Savings Pill if overlapping */}
                {node.potential_savings > 0 && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-600 text-white shadow-sm">
                    <DollarSign className="w-3 h-3" />
                    <span>{formatEUR(node.potential_savings)}{t.functionalAnalysis.perYear}</span>
                  </span>
                )}
              </>
            ) : node.level > 2 ? (
              /* Detail Subfunction (L3+) */
              <div className="flex items-center flex-wrap gap-1 max-w-md justify-end">
                {node.effective_applications.map((app) => (
                  <span
                    key={app.app_id}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] bg-slate-100 text-slate-600 border border-slate-200"
                  >
                    <span>{app.app_name}</span>
                  </span>
                ))}
              </div>
            ) : (
              /* Branch Rollup */
              <div className="flex items-center space-x-3 text-xs">
                {/* Coverage Pill */}
                <div
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl font-bold border ${
                    depth === 0
                      ? 'bg-slate-800 text-slate-200 border-slate-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <span className="text-[10px] text-slate-400 font-normal">{t.functionalAnalysis.rollupCoverage}</span>
                  <span className="font-extrabold text-indigo-400">
                    {node.rollup?.coverage_rate}%
                  </span>
                  <span className="text-[10px] text-slate-500">
                    ({node.rollup?.covered_leaves}/{node.rollup?.total_leaves})
                  </span>
                </div>

                {/* Overlaps Pill */}
                {(node.rollup?.overlapping_leaves ?? 0) > 0 && (
                  <div className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold text-[11px]">
                    <GitMerge className="w-3 h-3" />
                    <span>{node.rollup?.overlapping_leaves} {t.functionalAnalysis.rollupOverlap}</span>
                  </div>
                )}

                {/* Gaps Pill */}
                {(node.rollup?.gap_leaves ?? 0) > 0 && (
                  <div className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-[11px]">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{node.rollup?.gap_leaves} {t.functionalAnalysis.rollupGaps}</span>
                  </div>
                )}

                {/* Subtree Savings */}
                {(node.rollup?.potential_savings ?? 0) > 0 && (
                  <div className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black text-xs">
                    <DollarSign className="w-3 h-3" />
                    <span>{formatEUR(node.rollup!.potential_savings)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Child nodes */}
        {isExpanded && hasChildren && (
          <div className="flex flex-col">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Network className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {t.functionalAnalysis.title}
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-1 max-w-4xl">
            {t.functionalAnalysis.subtitle}
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 ${
              viewMode === 'tree'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>{t.functionalAnalysis.viewTree}</span>
          </button>
          <button
            onClick={() => setViewMode('matrix')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 ${
              viewMode === 'matrix'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>{t.functionalAnalysis.viewMatrix}</span>
          </button>
          <button
            onClick={() => setViewMode('remediation')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 ${
              viewMode === 'remediation'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{t.functionalAnalysis.viewRemediation}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Coverage Rate */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t.functionalAnalysis.coverageRate}
            </span>
            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-indigo-700">{data.coverage_rate_percentage}%</span>
            <span className="text-xs text-slate-600 font-medium">{t.functionalAnalysis.coverageSubtitle}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {interpolate(t.functionalAnalysis.coverageDetail, {
              covered: data.covered_leaf_functions,
              total: data.total_leaf_functions
            })}
          </p>
        </div>

        {/* Functional Gaps */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t.functionalAnalysis.gapCount}
            </span>
            <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600 border border-rose-100">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-rose-700">{data.gap_leaf_functions_count}</span>
            <span className="text-xs text-slate-600 font-medium">{t.functionalAnalysis.gapSubtitle}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {interpolate(t.functionalAnalysis.gapDetail, { gap: data.gap_leaf_functions_count })}
          </p>
        </div>

        {/* Redundancy Rate */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t.functionalAnalysis.redundancyRate}
            </span>
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 border border-amber-100">
              <GitMerge className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-amber-700">{data.redundancy_rate_percentage}%</span>
            <span className="text-xs text-slate-600 font-medium">{t.functionalAnalysis.redundancySubtitle}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {interpolate(t.functionalAnalysis.redundancyDetail, {
              redundant: data.overlapping_leaf_functions_count
            })}
          </p>
        </div>

        {/* Potential Savings */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t.functionalAnalysis.savingsOpportunity}
            </span>
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-700">
            {formatEUR(data.total_potential_savings)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {t.functionalAnalysis.savingsDetail}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.functionalAnalysis.searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center flex-wrap gap-1.5 w-full md:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {interpolate(t.functionalAnalysis.filterAll, { count: data.total_leaf_functions })}
          </button>
          <button
            onClick={() => setStatusFilter('gap')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
              statusFilter === 'gap'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>{interpolate(t.functionalAnalysis.filterGaps, { count: data.gap_leaf_functions_count })}</span>
          </button>
          <button
            onClick={() => setStatusFilter('overlap')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
              statusFilter === 'overlap'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <GitMerge className="w-3 h-3" />
            <span>{interpolate(t.functionalAnalysis.filterOverlaps, { count: data.overlapping_leaf_functions_count })}</span>
          </button>
          <button
            onClick={() => setStatusFilter('optimal')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
              statusFilter === 'optimal'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>{interpolate(t.functionalAnalysis.filterOptimal, { count: data.optimal_leaf_functions_count })}</span>
          </button>
        </div>

        {/* Tree expand / collapse actions */}
        {viewMode === 'tree' && (
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={expandAll}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition flex items-center space-x-1"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>{t.functionalAnalysis.expandAll}</span>
            </button>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition flex items-center space-x-1"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>{t.functionalAnalysis.collapseAll}</span>
            </button>
          </div>
        )}
      </div>

      {/* CONTENT AREA BASED ON VIEW MODE */}

      {/* 1. HIERARCHICAL TREE VIEW */}
      {viewMode === 'tree' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <FolderTree className="w-4 h-4 text-indigo-600" />
              <span>{t.functionalAnalysis.viewTree}</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              {interpolate(t.functionalAnalysis.totalFunctionsCount, {
                total: data.total_functional_elements,
                roots: data.total_root_functions,
                leaves: data.total_leaf_functions
              })}
            </span>
          </div>

          <div className="space-y-1">
            {data.hierarchy_trees.map((tree) => renderTreeNode(tree, 0))}
          </div>
        </div>
      )}

      {/* 2. LEAF MATRIX VIEW */}
      {viewMode === 'matrix' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <TableIcon className="w-4 h-4 text-indigo-600" />
              <span>{t.functionalAnalysis.viewMatrix}</span>
            </h3>
            <span className="text-xs text-slate-500">
              {filteredLeaves.length} / {data.total_leaf_functions} {t.functionalAnalysis.leafLevelBadge}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">{t.functionalAnalysis.colFunction}</th>
                  <th className="py-3 px-3">{t.functionalAnalysis.colLevel}</th>
                  <th className="py-3 px-4">{t.functionalAnalysis.colPath}</th>
                  <th className="py-3 px-3">{t.functionalAnalysis.colStatus}</th>
                  <th className="py-3 px-4">{t.functionalAnalysis.colApps}</th>
                  <th className="py-3 px-4 text-right">{t.functionalAnalysis.colSavings}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeaves.map((leaf) => (
                  <tr key={leaf.id} className="hover:bg-slate-50/70 transition">
                    {/* Function Name */}
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{leaf.name}</div>
                      <div className="text-[10px] text-slate-500 font-normal">({leaf.type})</div>
                    </td>

                    {/* Level */}
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-700">
                        {leaf.level_label}
                      </span>
                    </td>

                    {/* Hierarchy Path */}
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={leaf.path}>
                      {leaf.path}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {leaf.is_gap && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{t.functionalAnalysis.badgeGap}</span>
                        </span>
                      )}
                      {leaf.is_optimal && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{t.functionalAnalysis.badgeOptimal}</span>
                        </span>
                      )}
                      {leaf.is_overlapping && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                          <GitMerge className="w-3 h-3" />
                          <span>{interpolate(t.functionalAnalysis.badgeOverlap, { count: leaf.app_count })}</span>
                        </span>
                      )}
                    </td>

                    {/* Applications */}
                    <td className="py-3.5 px-4">
                      {leaf.applications.length === 0 ? (
                        <span className="text-slate-400 italic text-[11px]">{t.functionalAnalysis.gapWarning}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {leaf.applications.map((app) => (
                            <span
                              key={app.app_id}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                leaf.target_app?.app_id === app.app_id
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {app.app_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Savings */}
                    <td className="py-3.5 px-4 text-right font-black">
                      {leaf.potential_savings > 0 ? (
                        <span className="text-emerald-700">{formatEUR(leaf.potential_savings)}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredLeaves.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      {t.functionalAnalysis.emptySearch}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. REMEDIATION & ACTION PLANS VIEW */}
      {viewMode === 'remediation' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overlapping Rationalization Plans */}
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
              <h3 className="text-base font-extrabold text-amber-900 flex items-center space-x-2">
                <GitMerge className="w-5 h-5 text-amber-600" />
                <span>{t.functionalAnalysis.remediationOverlapsTitle}</span>
              </h3>
              <p className="text-xs text-amber-800 mt-1">
                {t.functionalAnalysis.remediationOverlapsDesc}
              </p>
            </div>

            <div className="space-y-3">
              {data.redundancy_clusters.map((cluster) => (
                <div
                  key={cluster.leaf_id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{cluster.leaf_name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{cluster.path}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                      +{formatEUR(cluster.potential_savings)}{t.functionalAnalysis.perYear}
                    </span>
                  </div>

                  {/* Recommendation block */}
                  <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-200/80">
                    <p className="font-semibold text-slate-900 mb-1">
                      {t.functionalAnalysis.targetSystem}:
                    </p>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {cluster.target_app?.app_name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        ({cluster.target_app?.time_quadrant})
                      </span>
                    </div>

                    <p className="font-semibold text-slate-900 mt-2 mb-1">
                      {t.functionalAnalysis.candidateDecomms}:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {cluster.candidate_decommissions?.map((app) => (
                        <span
                          key={app.app_id}
                          className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded text-[11px]"
                        >
                          {app.app_name} ({formatEUR(app.annual_cost)})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Functional Gap Coverage Initiatives */}
          <div className="space-y-4">
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
              <h3 className="text-base font-extrabold text-rose-900 flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>{t.functionalAnalysis.remediationGapsTitle}</span>
              </h3>
              <p className="text-xs text-rose-800 mt-1">
                {t.functionalAnalysis.remediationGapsDesc}
              </p>
            </div>

            <div className="space-y-3">
              {data.gap_clusters.map((gap) => (
                <div
                  key={gap.leaf_id}
                  className="bg-white border border-rose-200/80 rounded-2xl p-5 shadow-sm space-y-2 hover:border-rose-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800">
                          {gap.level_label}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">{gap.leaf_name}</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{gap.path}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      GAP
                    </span>
                  </div>

                  {gap.documentation && (
                    <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {gap.documentation}
                    </p>
                  )}

                  <div className="flex items-center space-x-1.5 text-xs text-rose-700 font-medium pt-1">
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    <span>{gap.recommendation}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
