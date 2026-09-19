import React, { useState, useEffect } from 'react';
import { OverlapMatrixData } from '../../types';
import { api } from '../../lib/api';
import { GitMerge, AlertCircle, DollarSign, CheckCircle2, Search, Filter, ArrowRight, Zap } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface OverlapMatrixProps {
  modelId: string;
}

export const OverlapMatrix: React.FC<OverlapMatrixProps> = ({ modelId }) => {
  const { t, language, interpolate } = useLanguage();
  const [data, setData] = useState<OverlapMatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterRedundantOnly, setFilterRedundantOnly] = useState(false);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getOverlapMatrix(modelId);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [modelId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">{t.overlap.loading}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const formatEUR = (val: number) =>
    new Intl.NumberFormat(language === 'en' ? 'en-US' : 'it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

  const filteredCapabilities = data.capability_rows.filter((cap) => {
    const matchesSearch = cap.name.toLowerCase().includes(search.toLowerCase());
    const matchesRedundant = filterRedundantOnly ? cap.is_redundant : true;
    return matchesSearch && matchesRedundant;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Title & Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t.overlap.title}</h2>
          <p className="text-xs text-slate-600 mt-1">
            {t.overlap.subtitle}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Redundancy Score */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.overlap.redundancyIndex}</span>
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 border border-amber-100">
              <GitMerge className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-amber-700">{data.redundancy_score_percentage}%</span>
            <span className="text-xs text-slate-600 font-medium">{t.overlap.redundancySubtitle}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {interpolate(t.overlap.redundancyDetail, { redundant: data.redundant_capabilities_count, total: data.total_capabilities })}
          </p>
        </div>

        {/* Potential Savings */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.overlap.savingsOpportunity}</span>
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-700">
            {formatEUR(data.potential_savings_opportunity)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{t.overlap.savingsDetail}</p>
        </div>

        {/* Rationalization Clusters */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.overlap.clustersToRationalize}</span>
            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">
            {data.redundancy_clusters.length} Cluster
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{t.overlap.clustersDetail}</p>
        </div>
      </div>

      {/* Redundancy Recommendations List */}
      {data.redundancy_clusters.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <span>{t.overlap.recommendationsTitle}</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.redundancy_clusters.map((cluster) => (
              <div key={cluster.capability_id} className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">{t.overlap.overlappedCapability}</span>
                    <h4 className="text-sm font-bold text-slate-900">{cluster.capability_name}</h4>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg border border-amber-200">
                    {interpolate(t.overlap.systemsCount, { count: cluster.app_count })}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed font-medium">{cluster.recommendation}</p>

                <div className="flex flex-wrap gap-2 pt-1 border-t border-amber-200/60">
                  {cluster.applications.map((app) => (
                    <div key={app.app_id} className="text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 shadow-sm flex items-center space-x-1">
                      <span className="font-bold text-slate-900">{app.app_name}</span>
                      <span className="text-slate-500 font-mono">({formatEUR(app.annual_cost)})</span>
                      <span className={`ml-1 text-[9px] px-1 rounded font-bold ${
                        app.time_quadrant === 'Invest' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {app.time_quadrant}
                      </span>
                    </div>
                  ))}
                </div>

                {cluster.potential_savings > 0 && (
                  <div className="text-xs font-bold text-emerald-700 flex items-center space-x-1">
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>{t.overlap.savingsConsolidating} <strong>{formatEUR(cluster.potential_savings)}{t.overlap.perYear}</strong></span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2D Capability vs Application Matrix Heatmap */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">{t.overlap.matrixTitle}</h3>
            <p className="text-xs text-slate-500">{t.overlap.matrixSubtitle}</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={t.overlap.searchCapability}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white w-52"
              />
            </div>

            <button
              onClick={() => setFilterRedundantOnly(!filterRedundantOnly)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
                filterRedundantOnly
                  ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{interpolate(t.overlap.filterRedundantOnly, { count: data.redundant_capabilities_count })}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-20 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 min-w-[240px] bg-slate-50 sticky left-0 z-30 border-r border-slate-200">
                  {t.overlap.colCapability}
                </th>
                <th className="py-3.5 px-3 text-center w-24">{t.overlap.colAppCount}</th>
                {data.applications_columns.map((app) => (
                  <th key={app.id} className="py-3.5 px-3 text-center min-w-[130px] border-l border-slate-200">
                    <div className="truncate max-w-[120px] font-bold text-slate-900" title={app.name}>
                      {app.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 font-normal">
                      {formatEUR(app.annual_cost)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredCapabilities.map((cap) => {
                const servingAppIds = new Set(cap.serving_applications.map((s) => s.app_id));

                return (
                  <tr key={cap.id} className={`hover:bg-slate-50/80 transition ${cap.is_redundant ? 'bg-amber-50/30' : ''}`}>
                    <td className="py-3 px-4 font-bold text-slate-900 sticky left-0 z-10 bg-white border-r border-slate-200">
                      <div className="flex items-center space-x-2">
                        {cap.is_redundant ? (
                          <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                        )}
                        <span className="truncate">{cap.name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cap.app_count > 1 ? 'bg-amber-100 text-amber-800' : cap.app_count === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {cap.app_count}
                      </span>
                    </td>

                    {data.applications_columns.map((app) => {
                      const isLinked = servingAppIds.has(app.id);
                      const linkDetail = cap.serving_applications.find((s) => s.app_id === app.id);

                      return (
                        <td key={app.id} className="py-3 px-3 text-center border-l border-slate-100">
                          {isLinked ? (
                            <div className="flex flex-col items-center justify-center">
                              <span className="inline-flex items-center justify-center p-1 rounded-full bg-indigo-100 text-indigo-600 shadow-sm">
                                <CheckCircle2 className="w-4 h-4" />
                              </span>
                              {linkDetail && (
                                <span className={`text-[9px] mt-0.5 px-1 rounded font-bold font-mono ${
                                  linkDetail.time_quadrant === 'Invest' ? 'text-emerald-700' : 'text-amber-700'
                                }`}>
                                  {linkDetail.time_quadrant}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono text-base">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

