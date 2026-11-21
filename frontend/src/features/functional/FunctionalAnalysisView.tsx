import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toPng } from 'html-to-image';
import {
  FunctionalAnalysisData,
  FunctionalNode,
  FunctionalLeafRow,
  FunctionalAppInfo,
  HeatmapMacroDomain,
  HeatmapL1Group
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
  Minimize2,
  LayoutGrid,
  X,
  Star,
  Activity,
  Award,
  Info,
  FileText,
  Loader2
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

  const [viewMode, setViewModeState] = useState<'tree' | 'heatmap' | 'matrix' | 'remediation'>(() => {
    const saved = localStorage.getItem('easyea_functional_view_mode');
    const validModes = ['tree', 'heatmap', 'matrix', 'remediation'];
    return (saved && validModes.includes(saved)) ? (saved as any) : 'tree';
  });

  const setViewMode = (mode: 'tree' | 'heatmap' | 'matrix' | 'remediation') => {
    setViewModeState(mode);
    localStorage.setItem('easyea_functional_view_mode', mode);
  };
  const [statusFilter, setStatusFilter] = useState<'all' | 'gap' | 'overlap' | 'optimal'>('all');
  const [search, setSearch] = useState<string>('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Heatmap specific states
  const [heatmapColoring, setHeatmapColoring] = useState<'fit' | 'tech' | 'maturity' | 'status'>('fit');
  const [selectedInspectNode, setSelectedInspectNode] = useState<FunctionalNode | null>(null);
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  const heatmapContainerRef = useRef<HTMLDivElement>(null);

  const handleExportDocx = async () => {
    if (!modelId) return;
    try {
      setIsExportingDocx(true);
      let heatmapPngBase64: string | undefined = undefined;
      const heatmapEl = heatmapContainerRef.current || document.getElementById('functional-heatmap-container');
      if (heatmapEl) {
        try {
          heatmapPngBase64 = await toPng(heatmapEl, {
            backgroundColor: '#ffffff',
            pixelRatio: 2,
            cacheBust: true,
          });
        } catch (imgErr) {
          console.warn('Could not capture visual heatmap screenshot:', imgErr);
        }
      }
      await api.exportFunctionalDocxReport(modelId, language, heatmapPngBase64);
    } catch (err: any) {
      console.error('Error exporting DOCX report:', err);
      alert(t.functionalAnalysis.exportError);
    } finally {
      setIsExportingDocx(false);
    }
  };

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

  // Filtered domains and tiles for the heatmap canvas view
  const filteredHeatmapDomains = useMemo(() => {
    if (!data?.heatmap_domains) return [];

    return data.heatmap_domains
      .map((domain) => {
        const query = search.toLowerCase();
        const domainMatchesText = !search || domain.name.toLowerCase().includes(query);

        const filteredGroups = domain.groups
          .map((grp) => {
            const grpMatchesText = domainMatchesText || grp.name.toLowerCase().includes(query);

            const filteredTiles = grp.tiles.filter((tile) => {
              const tileMatchesSearch =
                grpMatchesText ||
                tile.name.toLowerCase().includes(query) ||
                tile.effective_applications.some((a) => a.app_name.toLowerCase().includes(query));

              let tileMatchesStatus = true;
              if (statusFilter === 'gap') tileMatchesStatus = tile.is_gap;
              else if (statusFilter === 'overlap') tileMatchesStatus = tile.is_overlapping;
              else if (statusFilter === 'optimal') tileMatchesStatus = tile.is_optimal;

              return tileMatchesSearch && tileMatchesStatus;
            });

            return {
              ...grp,
              tiles: filteredTiles
            };
          })
          .filter((grp) => grp.tiles.length > 0);

        return {
          ...domain,
          groups: filteredGroups
        };
      })
      .filter((domain) => domain.groups.length > 0);
  }, [data?.heatmap_domains, search, statusFilter]);

  // Check if a tree branch matches the search or filter
  const nodeMatchesFilter = (node: FunctionalNode): boolean => {
    const query = search.toLowerCase();
    const selfMatchesSearch =
      !search ||
      node.name.toLowerCase().includes(query) ||
      node.effective_applications.some((a) => a.app_name.toLowerCase().includes(query));

    let selfMatchesStatus = true;
    if (node.is_evaluation_unit) {
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

    return node.children.some((child) => nodeMatchesFilter(child));
  };

  // Helper to get tile style based on chosen coloring mode
  const getTileStyle = (node: FunctionalNode) => {
    if (heatmapColoring === 'fit') {
      if (node.is_gap || (node.functional_fit ?? 0) === 0) {
        return 'bg-slate-100 border-rose-300 border-dashed text-slate-700 hover:bg-rose-50';
      }
      const fit = node.functional_fit ?? 0;
      if (fit >= 4.0) return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-950 hover:bg-emerald-500/25';
      if (fit >= 3.0) return 'bg-teal-500/15 border-teal-500/30 text-teal-950 hover:bg-teal-500/25';
      if (fit >= 2.0) return 'bg-amber-500/15 border-amber-500/30 text-amber-950 hover:bg-amber-500/25';
      return 'bg-rose-500/15 border-rose-500/30 text-rose-950 hover:bg-rose-500/25';
    }

    if (heatmapColoring === 'tech') {
      if (node.is_gap || (node.technical_fit ?? 0) === 0) {
        return 'bg-slate-100 border-slate-300 border-dashed text-slate-700 hover:bg-slate-200';
      }
      const tech = node.technical_fit ?? 0;
      if (tech >= 4.0) return 'bg-indigo-500/15 border-indigo-500/30 text-indigo-950 hover:bg-indigo-500/25';
      if (tech >= 3.0) return 'bg-blue-500/15 border-blue-500/30 text-blue-950 hover:bg-blue-500/25';
      if (tech >= 2.0) return 'bg-amber-500/15 border-amber-500/30 text-amber-950 hover:bg-amber-500/25';
      return 'bg-rose-500/15 border-rose-500/30 text-rose-950 hover:bg-rose-500/25';
    }

    if (heatmapColoring === 'maturity') {
      const mat = node.maturity_level ?? 1;
      if (mat === 5) return 'bg-purple-500/15 border-purple-500/35 text-purple-950 hover:bg-purple-500/25';
      if (mat === 4) return 'bg-indigo-500/15 border-indigo-500/30 text-indigo-950 hover:bg-indigo-500/25';
      if (mat === 3) return 'bg-blue-500/15 border-blue-500/30 text-blue-950 hover:bg-blue-500/25';
      if (mat === 2) return 'bg-amber-500/15 border-amber-500/30 text-amber-950 hover:bg-amber-500/25';
      return 'bg-slate-100 border-rose-300 border-dashed text-slate-700 hover:bg-rose-50';
    }

    // Default: Status
    if (node.is_gap) return 'bg-rose-50 border-rose-300 text-rose-900 hover:bg-rose-100';
    if (node.is_overlapping) return 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100';
    return 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100';
  };

  const getTilePill = (node: FunctionalNode) => {
    if (heatmapColoring === 'fit') {
      if (node.is_gap) return <span className="text-[10px] font-black text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">GAP</span>;
      const fit = node.functional_fit ?? 0;
      const color = fit >= 4.0 ? 'bg-emerald-100 text-emerald-800' : fit >= 3.0 ? 'bg-teal-100 text-teal-800' : fit >= 2.0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';
      return <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${color}`}>★ {fit.toFixed(1)}</span>;
    }

    if (heatmapColoring === 'tech') {
      if (node.is_gap) return <span className="text-[10px] font-black text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">-</span>;
      const tech = node.technical_fit ?? 0;
      const color = tech >= 4.0 ? 'bg-indigo-100 text-indigo-800' : tech >= 3.0 ? 'bg-blue-100 text-blue-800' : tech >= 2.0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';
      return <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${color}`}>Tech {tech.toFixed(1)}</span>;
    }

    if (heatmapColoring === 'maturity') {
      const mat = node.maturity_level ?? 1;
      const color = mat >= 4 ? 'bg-indigo-100 text-indigo-800' : mat === 3 ? 'bg-blue-100 text-blue-800' : mat === 2 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';
      return <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${color}`}>L{mat}</span>;
    }

    // Status
    if (node.is_gap) return <span className="text-[10px] font-black text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">GAP</span>;
    if (node.is_overlapping) return <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">{node.app_count} Apps</span>;
    return <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">1 App</span>;
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
                {/* Fit pill */}
                {node.functional_fit !== undefined && !node.is_gap && (
                  <span
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200"
                    title={`Fit Funzionale: ${node.functional_fit}/5 - Maturità: L${node.maturity_level}`}
                  >
                    <Star className="w-3 h-3 text-indigo-600" />
                    <span>Fit {node.functional_fit}</span>
                  </span>
                )}

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
                      title={`${app.app_name} (${app.time_quadrant}) - ${t.functionalAnalysis.costLabel}: ${formatEUR(app.annual_cost)}${app.is_imputed_from_child ? ` - ${interpolate(t.functionalAnalysis.imputedFromDetail, { child: app.imputed_from ?? '' })}` : ''}`}
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
                {/* Fit Rollup */}
                {(node.rollup?.avg_functional_fit ?? 0) > 0 && (
                  <div
                    className={`flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                      depth === 0 ? 'bg-slate-800 text-indigo-300 border-slate-700' : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                    }`}
                  >
                    <Star className="w-3 h-3" />
                    <span>Fit {node.rollup?.avg_functional_fit}</span>
                  </div>
                )}

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

        {/* Global Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Export Word Report Button */}
          <button
            onClick={handleExportDocx}
            disabled={isExportingDocx || !data}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            title={t.functionalAnalysis.btnExportDocx}
          >
            {isExportingDocx ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
            )}
            <span>{isExportingDocx ? t.functionalAnalysis.exportingDocx : t.functionalAnalysis.btnExportDocx}</span>
          </button>
        </div>
      </div>

      {/* Top Module Switcher Bar (Dedicated Row like Application Management) */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setViewMode('tree')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer ${
            viewMode === 'tree'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'
          }`}
        >
          <FolderTree className={`w-4 h-4 ${viewMode === 'tree' ? 'text-white' : 'text-indigo-500'}`} />
          <span>{t.functionalAnalysis.viewTree}</span>
        </button>

        <button
          onClick={() => setViewMode('heatmap')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer ${
            viewMode === 'heatmap'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'
          }`}
        >
          <LayoutGrid className={`w-4 h-4 ${viewMode === 'heatmap' ? 'text-white' : 'text-purple-500'}`} />
          <span>{t.functionalAnalysis.viewHeatmap}</span>
        </button>

        <button
          onClick={() => setViewMode('matrix')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer ${
            viewMode === 'matrix'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'
          }`}
        >
          <TableIcon className={`w-4 h-4 ${viewMode === 'matrix' ? 'text-white' : 'text-cyan-500'}`} />
          <span>{t.functionalAnalysis.viewMatrix}</span>
        </button>

        <button
          onClick={() => setViewMode('remediation')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer ${
            viewMode === 'remediation'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'
          }`}
        >
          <Zap className={`w-4 h-4 ${viewMode === 'remediation' ? 'text-white' : 'text-amber-500'}`} />
          <span>{t.functionalAnalysis.viewRemediation}</span>
        </button>
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

        {/* Functional Fit & Quality */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t.functionalAnalysis.avgFunctionalFit}
            </span>
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 border border-amber-100">
              <Star className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-amber-700">{data.global_avg_functional_fit} / 5.0</span>
            <span className="text-xs text-slate-600 font-medium">L{data.global_avg_maturity_level} Maturità</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Salute Tecnica: {data.global_avg_technical_fit}/5.0
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
            {interpolate(t.functionalAnalysis.redundancyDetail, {
              redundant: data.overlapping_leaf_functions_count
            })}
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

      {/* 2. HEATMAP & CAPABILITY CANVAS VIEW */}
      <div
        id="functional-heatmap-container"
        ref={heatmapContainerRef}
        className={viewMode === 'heatmap' ? 'space-y-4' : 'fixed -left-[9999px] top-0 w-[1200px] pointer-events-none opacity-0'}
      >
        {/* Heatmap Toolbar & Legend */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700">{t.functionalAnalysis.heatmapColorBy}</span>
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setHeatmapColoring('fit')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                    heatmapColoring === 'fit'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.functionalAnalysis.colorByFit}
                </button>
                <button
                  onClick={() => setHeatmapColoring('tech')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                    heatmapColoring === 'tech'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.functionalAnalysis.colorByTech}
                </button>
                <button
                  onClick={() => setHeatmapColoring('maturity')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                    heatmapColoring === 'maturity'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.functionalAnalysis.colorByMaturity}
                </button>
                <button
                  onClick={() => setHeatmapColoring('status')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                    heatmapColoring === 'status'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.functionalAnalysis.colorByStatus}
                </button>
              </div>
            </div>

            {/* Dynamic Legend */}
            <div className="flex items-center flex-wrap gap-2 text-[11px] font-medium text-slate-600">
              {heatmapColoring === 'fit' && (
                <>
                  <div className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /><span>{t.functionalAnalysis.fitLegendExcellent}</span></div>
                  <div className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-teal-500" /><span>{t.functionalAnalysis.fitLegendAdequate}</span></div>
                  <div className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-amber-500" /><span>{t.functionalAnalysis.fitLegendTolerable}</span></div>
                  <div className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-rose-500" /><span>{t.functionalAnalysis.fitLegendInadequate}</span></div>
                  <div className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-slate-200 border border-rose-400" /><span>{t.functionalAnalysis.fitLegendGap}</span></div>
                </>
              )}
              {heatmapColoring === 'maturity' && (
                <>
                  <div className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-purple-600" /><span>{t.functionalAnalysis.maturityLegendL5}</span></div>
                  <div className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-indigo-600" /><span>{t.functionalAnalysis.maturityLegendL4}</span></div>
                  <div className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-blue-600" /><span>{t.functionalAnalysis.maturityLegendL3}</span></div>
                  <div className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-amber-500" /><span>{t.functionalAnalysis.maturityLegendL2}</span></div>
                  <div className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-slate-200 border border-rose-400" /><span>{t.functionalAnalysis.maturityLegendL1}</span></div>
                </>
              )}
              {heatmapColoring === 'status' && (
                <>
                  <div className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /><span>{t.functionalAnalysis.statusLegendOptimal}</span></div>
                  <div className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-amber-500" /><span>{t.functionalAnalysis.statusLegendOverlap}</span></div>
                  <div className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-rose-500" /><span>{t.functionalAnalysis.statusLegendGap}</span></div>
                </>
              )}
            </div>
          </div>

          {/* Macro Domain Columns */}
          {filteredHeatmapDomains.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">{t.functionalAnalysis.emptySearch}</p>
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setSearch('');
                }}
                className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition"
              >
                {t.functionalAnalysis.heatmapResetFilters}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {filteredHeatmapDomains.map((domain) => (
                <div
                  key={domain.id}
                  className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col"
                >
                  {/* Domain Header */}
                  <div className="pb-3 border-b border-slate-100 flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded tracking-wider">
                        {t.functionalAnalysis.heatmapMacroDomain}
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900 mt-1">{domain.name}</h3>
                    </div>
                    {domain.rollup && (
                      <div className="text-right">
                        <div className="text-xs font-black text-slate-800">
                          {t.functionalAnalysis.domainAverage} {domain.rollup.avg_functional_fit}/5
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {interpolate(t.functionalAnalysis.heatmapDomainCoverage, {
                            covered: domain.rollup.covered_leaves,
                            total: domain.rollup.total_leaves,
                            rate: domain.rollup.coverage_rate
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Groups inside domain (L1) */}
                  <div className="space-y-4 flex-1">
                    {domain.groups.map((grp) => (
                      <div key={grp.id} className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/70 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">{grp.name}</span>
                          {grp.rollup && (
                            <span className="text-[10px] text-slate-500">
                              Fit {grp.rollup.avg_functional_fit}
                            </span>
                          )}
                        </div>

                        {/* Tiles (L2 evaluation units) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {grp.tiles.map((tile) => (
                            <button
                              key={tile.id}
                              onClick={() => setSelectedInspectNode(tile)}
                              className={`p-3 rounded-xl border text-left transition relative flex flex-col justify-between ${getTileStyle(
                                tile
                              )}`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className="text-xs font-bold leading-snug line-clamp-2">
                                  {tile.name}
                                </span>
                                <div className="shrink-0">{getTilePill(tile)}</div>
                              </div>

                              <div className="mt-2.5 pt-2 border-t border-black/5 flex items-center justify-between text-[10px]">
                                <span className="truncate max-w-[120px] text-slate-600 font-medium">
                                  {tile.effective_applications.length === 0
                                    ? t.functionalAnalysis.heatmapNoApps
                                    : tile.effective_applications.map((a) => a.app_name).join(', ')}
                                </span>
                                {tile.has_children && (
                                  <span className="text-indigo-600 font-semibold" title={t.functionalAnalysis.hasSubfunctionsBadge}>
                                    L3+
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* 3. LEAF MATRIX VIEW */}
      {viewMode === 'matrix' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <TableIcon className="w-4 h-4 text-indigo-600" />
              <span>{t.functionalAnalysis.viewMatrix}</span>
            </h3>
            <span className="text-xs text-slate-500">
              {filteredLeaves.length} / {data.total_leaf_functions} {t.functionalAnalysis.evaluationUnitBadge}
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
                  <th className="py-3 px-3">Fit / Tech</th>
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

                    {/* Fit & Tech */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {leaf.is_gap ? (
                        <span className="text-slate-400 font-mono text-[11px]">-</span>
                      ) : (
                        <div className="flex items-center space-x-1.5 font-bold">
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            ★ {leaf.functional_fit}
                          </span>
                          <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 text-[10px]">
                            L{leaf.maturity_level}
                          </span>
                        </div>
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
                              title={app.is_imputed_from_child ? interpolate(t.functionalAnalysis.imputedFromDetail, { child: app.imputed_from ?? '' }) : undefined}
                            >
                              {app.app_name}
                              {app.is_imputed_from_child && <span className="ml-1 text-[9px] text-indigo-600 font-bold">L3+</span>}
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
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      {t.functionalAnalysis.emptySearch}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. REMEDIATION & ACTION PLANS VIEW */}
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

      {/* NODE DETAIL MODAL (INSPECTOR) */}
      {selectedInspectNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md">
                  {selectedInspectNode.level_label} • {selectedInspectNode.type}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-1.5">{selectedInspectNode.name}</h3>
              </div>
              <button
                onClick={() => setSelectedInspectNode(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedInspectNode.documentation && (
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                {selectedInspectNode.documentation}
              </p>
            )}

            {/* Scorecard row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Functional Fit</span>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {selectedInspectNode.is_gap ? t.functionalAnalysis.statusGapShort : `${selectedInspectNode.functional_fit}/5`}
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">{t.functionalAnalysis.modalTechnicalFit}</span>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {selectedInspectNode.is_gap ? '-' : `${selectedInspectNode.technical_fit}/5`}
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">{t.functionalAnalysis.modalMaturity}</span>
                <div className="text-lg font-black text-indigo-700 mt-1">
                  L{selectedInspectNode.maturity_level}
                </div>
              </div>
            </div>

            {/* Applications List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t.functionalAnalysis.modalSupportingApps}</h4>
              {selectedInspectNode.effective_applications.length === 0 ? (
                <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200">
                  {t.functionalAnalysis.gapWarning}
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedInspectNode.effective_applications.map((app) => (
                    <div
                      key={app.app_id}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{app.app_name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {t.functionalAnalysis.modalQuadrant}: <span className="font-semibold text-slate-700">{app.time_quadrant}</span> | {t.functionalAnalysis.modalFit}: {app.business_fit}/5
                          {app.is_imputed_from_child && (
                            <span className="text-indigo-600 font-semibold ml-2">
                              ({interpolate(t.functionalAnalysis.modalImputedFrom, { child: app.imputed_from ?? '' })})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="font-black text-slate-800">{formatEUR(app.annual_cost)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recommendation */}
            {selectedInspectNode.recommendation && (
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/70 rounded-2xl text-xs text-indigo-900 flex items-start space-x-2">
                <Info className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />
                <span>{selectedInspectNode.recommendation}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
