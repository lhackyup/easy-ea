import React, { useState, useEffect } from 'react';
import { APMPortfolio, ApplicationInfo } from '../../types';
import { api } from '../../lib/api';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Server,
  Edit2,
  Check,
  X,
  Search,
  Filter,
  ShieldAlert,
  SlidersHorizontal,
  Cloud
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface APMDashboardProps {
  modelId: string;
}

export const APMDashboard: React.FC<APMDashboardProps> = ({ modelId }) => {
  const { t, language, interpolate } = useLanguage();
  const [data, setData] = useState<APMPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<'in_scope' | 'all' | 'out_of_scope'>('in_scope');
  const [editingApp, setEditingApp] = useState<ApplicationInfo | null>(null);
  const [editForm, setEditForm] = useState<Partial<ApplicationInfo>>({});
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getAPMPortfolio(modelId);
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

  const handleToggleScope = async (app: ApplicationInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextScope = app.in_apm_scope === false ? true : false;
    try {
      await api.updateApplicationAPM(app.id, { in_apm_scope: nextScope });
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditClick = (app: ApplicationInfo) => {
    setEditingApp(app);
    setEditForm({
      business_fit: app.business_fit,
      technical_fit: app.technical_fit,
      annual_cost: app.annual_cost,
      business_criticality: app.business_criticality,
      lifecycle_status: app.lifecycle_status,
      business_owner: app.business_owner,
      technical_owner: app.technical_owner,
      vendor: app.vendor,
      hosting_type: app.hosting_type,
      in_apm_scope: app.in_apm_scope !== false,
      notes: app.notes,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingApp) return;
    setSaving(true);
    try {
      await api.updateApplicationAPM(editingApp.id, editForm);
      await loadData();
      setEditingApp(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">{t.apm.loadingPortfolio}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const inScopeCount = data.applications.filter((a) => a.in_apm_scope !== false).length;
  const outScopeCount = data.applications.filter((a) => a.in_apm_scope === false).length;
  const totalCount = data.applications.length;

  const filteredApps = data.applications.filter((app) => {
    const isInScope = app.in_apm_scope !== false;
    if (scopeFilter === 'in_scope' && !isInScope) return false;
    if (scopeFilter === 'out_of_scope' && isInScope) return false;

    const matchesSearch =
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.vendor.toLowerCase().includes(search.toLowerCase()) ||
      app.business_owner.toLowerCase().includes(search.toLowerCase());
    const matchesQuad = selectedQuadrant ? app.time_quadrant === selectedQuadrant : true;
    return matchesSearch && matchesQuad;
  });

  const formatEUR = (val: number) =>
    new Intl.NumberFormat(language === 'en' ? 'en-US' : 'it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title & Intro */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t.apm.title}</h2>
          <p className="text-xs text-slate-600 mt-1">
            {t.apm.subtitle}
          </p>
        </div>
        
        {/* APM Scope Filter Pills */}
        <div className="flex items-center space-x-2 bg-white border border-slate-200 p-1 rounded-2xl shadow-sm">
          <button
            onClick={() => setScopeFilter('in_scope')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              scopeFilter === 'in_scope'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{interpolate(t.apm.scopeFilterInScope, { count: inScopeCount })}</span>
          </button>

          <button
            onClick={() => setScopeFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              scopeFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            <span>{interpolate(t.apm.scopeFilterAll, { count: totalCount })}</span>
          </button>

          <button
            onClick={() => setScopeFilter('out_of_scope')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              scopeFilter === 'out_of_scope'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            <X className="w-3.5 h-3.5" />
            <span>{interpolate(t.apm.scopeFilterOutOfScope, { count: outScopeCount })}</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cost */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.apm.totalAnnualCost}</span>
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">{formatEUR(data.total_annual_cost)}</div>
          <p className="text-[11px] text-slate-500 mt-1">{t.apm.costDesc}</p>
        </div>

        {/* Invest Quadrant */}
        <div
          onClick={() => setSelectedQuadrant(selectedQuadrant === 'Invest' ? null : 'Invest')}
          className={`bg-white border rounded-2xl p-5 shadow-sm cursor-pointer transition ${
            selectedQuadrant === 'Invest' ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20' : 'border-slate-200 hover:border-emerald-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">{t.apm.investTitle}</span>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              {data.time_distribution.Invest} App
            </span>
          </div>
          <div className="mt-3 text-xl font-bold text-slate-900">{formatEUR(data.time_cost_distribution.Invest)}</div>
          <p className="text-[11px] text-slate-600 mt-1">{t.apm.investDesc}</p>
        </div>

        {/* Migrate Quadrant */}
        <div
          onClick={() => setSelectedQuadrant(selectedQuadrant === 'Migrate' ? null : 'Migrate')}
          className={`bg-white border rounded-2xl p-5 shadow-sm cursor-pointer transition ${
            selectedQuadrant === 'Migrate' ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20' : 'border-slate-200 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">{t.apm.migrateTitle}</span>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              {data.time_distribution.Migrate} App
            </span>
          </div>
          <div className="mt-3 text-xl font-bold text-slate-900">{formatEUR(data.time_cost_distribution.Migrate)}</div>
          <p className="text-[11px] text-slate-600 mt-1">{t.apm.migrateDesc}</p>
        </div>

        {/* Tolerate & Eliminate */}
        <div
          onClick={() => setSelectedQuadrant(selectedQuadrant === 'Eliminate' ? null : 'Eliminate')}
          className={`bg-white border rounded-2xl p-5 shadow-sm cursor-pointer transition ${
            selectedQuadrant === 'Eliminate' ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20' : 'border-slate-200 hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">{t.apm.eliminateTitle}</span>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-200">
              {data.time_distribution.Eliminate} App
            </span>
          </div>
          <div className="mt-3 text-xl font-bold text-slate-900">{formatEUR(data.time_cost_distribution.Eliminate)}</div>
          <p className="text-[11px] text-slate-600 mt-1">{t.apm.eliminateDesc}</p>
        </div>
      </div>

      {/* Gartner TIME Matrix (Interactive Visual Scatter Grid) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>{t.apm.matrixTitle}</span>
              <span className="text-xs font-normal text-slate-500">{t.apm.matrixSubtitle}</span>
            </h3>
            <p className="text-xs text-slate-500">{t.apm.matrixHint}</p>
          </div>
          <div className="flex items-center space-x-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-800"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Invest</span>
            <span className="flex items-center gap-1.5 text-amber-800"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Migrate</span>
            <span className="flex items-center gap-1.5 text-blue-800"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Tolerate</span>
            <span className="flex items-center gap-1.5 text-rose-800"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Eliminate</span>
          </div>
        </div>

        {/* 2x2 Matrix Visual Container */}
        <div className="mt-6 relative h-[430px] bg-slate-50/70 border border-slate-200 rounded-2xl p-4 overflow-hidden">
          {/* Axis Labels */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-0.5 rounded-full border border-emerald-300 shadow-sm z-10">
            {t.apm.highBusinessFit}
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] font-bold uppercase tracking-wider text-rose-800 bg-rose-100 px-3 py-0.5 rounded-full border border-rose-300 shadow-sm z-10">
            {t.apm.lowBusinessFit}
          </div>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-3 py-0.5 rounded-full border border-amber-300 shadow-sm z-10">
            {t.apm.lowTechFit}
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-[11px] font-bold uppercase tracking-wider text-blue-800 bg-blue-100 px-3 py-0.5 rounded-full border border-blue-300 shadow-sm z-10">
            {t.apm.highTechFit}
          </div>

          {/* Quadrant Background Grid */}
          <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-2">
            {/* Top-Left: MIGRATE */}
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-xs font-extrabold text-amber-800">{t.apm.quadrantMigrateTitle}</span>
              <span className="text-[11px] font-medium text-amber-700/80">{t.apm.quadrantMigrateSubtitle}</span>
            </div>
            {/* Top-Right: INVEST */}
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-xs font-extrabold text-emerald-800">{t.apm.quadrantInvestTitle}</span>
              <span className="text-[11px] font-medium text-emerald-700/80">{t.apm.quadrantInvestSubtitle}</span>
            </div>
            {/* Bottom-Left: ELIMINATE */}
            <div className="bg-rose-50/60 border border-rose-200/80 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-xs font-extrabold text-rose-800">{t.apm.quadrantEliminateTitle}</span>
              <span className="text-[11px] font-medium text-rose-700/80">{t.apm.quadrantEliminateSubtitle}</span>
            </div>
            {/* Bottom-Right: TOLERATE */}
            <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-xs font-extrabold text-blue-800">{t.apm.quadrantTolerateTitle}</span>
              <span className="text-[11px] font-medium text-blue-700/80">{t.apm.quadrantTolerateSubtitle}</span>
            </div>
          </div>


          {/* Interactive Scatter App Badges on Matrix (Only In-Scope Applications) */}
          <div className="absolute inset-8">
            {data.applications.filter((a) => a.in_apm_scope !== false).map((app) => {
              const leftPercent = ((app.technical_fit - 1) / 4) * 80 + 10;
              const topPercent = 90 - ((app.business_fit - 1) / 4) * 80;

              const colorMap: Record<string, string> = {
                Invest: 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-600/30',
                Migrate: 'bg-amber-500 text-slate-950 border-amber-600 shadow-amber-500/30',
                Tolerate: 'bg-blue-600 text-white border-blue-700 shadow-blue-600/30',
                Eliminate: 'bg-rose-600 text-white border-rose-700 shadow-rose-600/30',
              };

              return (
                <div
                  key={app.id}
                  onClick={() => handleEditClick(app)}
                  style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                >
                  <div className={`px-2.5 py-1 text-xs font-bold rounded-lg shadow-md border ring-2 ring-white/80 transition transform group-hover:scale-110 flex items-center space-x-1.5 ${colorMap[app.time_quadrant]}`}>
                    <span>{app.name}</span>
                    <span className="text-[10px] opacity-90 font-mono">({formatEUR(app.annual_cost)})</span>
                  </div>
                  {/* Tooltip on Hover */}
                  <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl z-30 pointer-events-none">
                    <p className="font-bold text-white">{app.name}</p>
                    <p className="text-slate-300">Vendor: {app.vendor}</p>
                    <p className="text-slate-300">Owner: {app.business_owner}</p>
                    <p className="text-indigo-300 font-bold mt-1">B-Fit: {app.business_fit}/5 | T-Fit: {app.technical_fit}/5</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Application Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">{t.apm.inventoryTitle}</h3>
            <p className="text-xs text-slate-500">{t.apm.inventorySubtitle}</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={t.apm.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white w-64"
              />
            </div>
            {selectedQuadrant && (
              <button
                onClick={() => setSelectedQuadrant(null)}
                className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100"
              >
                <span>{interpolate(t.apm.filterActive, { quadrant: selectedQuadrant })}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">{t.apm.colApplication}</th>
                <th className="py-3 px-4">{t.apm.colApmScope}</th>
                <th className="py-3 px-4">{t.apm.colTimeQuadrant}</th>
                <th className="py-3 px-4">{t.apm.colFitScores}</th>
                <th className="py-3 px-4">{t.apm.colAnnualCost}</th>
                <th className="py-3 px-4">{t.apm.colCriticality}</th>
                <th className="py-3 px-4">{t.apm.colLifecycle}</th>
                <th className="py-3 px-4">{t.apm.colBusinessOwner}</th>
                <th className="py-3 px-4">{t.apm.colVendorHosting}</th>
                <th className="py-3 px-4 text-right">{t.apm.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredApps.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    <div className="flex flex-col">
                      <span>{app.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono font-normal">{app.id}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={(e) => handleToggleScope(app, e)}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border flex items-center space-x-1 transition ${
                        app.in_apm_scope !== false
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-sm'
                          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                      }`}
                      title={t.apm.toggleScopeTooltip}
                    >
                      {app.in_apm_scope !== false ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>{t.apm.inScopeBadge}</span>
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3 text-slate-400" />
                          <span>{t.apm.outOfScopeBadge}</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        app.time_quadrant === 'Invest'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : app.time_quadrant === 'Migrate'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : app.time_quadrant === 'Tolerate'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {app.time_quadrant}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold">
                    <span className="text-slate-900">B:{app.business_fit}</span> / <span className="text-slate-500">T:{app.technical_fit}</span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {formatEUR(app.annual_cost)}
                  </td>
                  <td className="py-3.5 px-4 font-medium">
                    <span className="text-slate-700 flex items-center gap-1">
                      {app.business_criticality === 'Mission Critical' && <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />}
                      {app.business_criticality}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      app.lifecycle_status === 'Live' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {app.lifecycle_status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium">{app.business_owner}</td>
                  <td className="py-3.5 px-4 text-slate-600">
                    <div className="flex flex-col text-[11px]">
                      <span className="text-slate-900 font-semibold">{app.vendor}</span>
                      <span className="text-slate-500">{app.hosting_type}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleEditClick(app)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      title={t.apm.colActions}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingApp(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">{interpolate(t.apm.editModalTitle, { name: editingApp.name })}</h3>
            <p className="text-xs text-slate-500 mb-6">{t.apm.editModalSubtitle}</p>

            <div className="space-y-4">
              
              {/* APM Scope Toggle */}
              <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-900 block">{t.apm.labelInApmScope}</label>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t.apm.labelInApmScopeDesc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={editForm.in_apm_scope !== false}
                  onChange={(e) => setEditForm({ ...editForm, in_apm_scope: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.apm.labelBusinessFit}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={editForm.business_fit || 3}
                    onChange={(e) => setEditForm({ ...editForm, business_fit: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.apm.labelTechnicalFit}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={editForm.technical_fit || 3}
                    onChange={(e) => setEditForm({ ...editForm, technical_fit: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.apm.labelAnnualCost}
                  </label>
                  <input
                    type="number"
                    value={editForm.annual_cost || 0}
                    onChange={(e) => setEditForm({ ...editForm, annual_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.apm.labelCriticality}
                  </label>
                  <select
                    value={editForm.business_criticality}
                    onChange={(e) => setEditForm({ ...editForm, business_criticality: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="Mission Critical">Mission Critical</option>
                    <option value="Business Critical">Business Critical</option>
                    <option value="Business Operational">Business Operational</option>
                    <option value="Administrative">Administrative</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.apm.labelLifecycle}
                  </label>
                  <select
                    value={editForm.lifecycle_status}
                    onChange={(e) => setEditForm({ ...editForm, lifecycle_status: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="Plan">Plan</option>
                    <option value="Evaluation">Evaluation</option>
                    <option value="Live">Live</option>
                    <option value="Phase-out">Phase-out</option>
                    <option value="Retired">Retired</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.apm.labelHosting}
                  </label>
                  <select
                    value={editForm.hosting_type}
                    onChange={(e) => setEditForm({ ...editForm, hosting_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="SaaS">SaaS</option>
                    <option value="Public Cloud">Public Cloud (AWS/GCP/Azure)</option>
                    <option value="Private Cloud">Private Cloud</option>
                    <option value="On-Premise">On-Premise</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.apm.labelBusinessOwner}
                  </label>
                  <input
                    type="text"
                    value={editForm.business_owner || ''}
                    onChange={(e) => setEditForm({ ...editForm, business_owner: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.apm.labelVendor}
                  </label>
                  <input
                    type="text"
                    value={editForm.vendor || ''}
                    onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.apm.labelNotes}
                </label>
                <textarea
                  rows={2}
                  value={editForm.notes || ''}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingApp(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition"
                >
                  <Check className="w-4 h-4" />
                  <span>{t.common.save}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
