import React, { useState, useEffect } from 'react';
import { TCOBreakdownData, ApplicationInfo } from '../../types';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import {
  DollarSign,
  TrendingUp,
  PieChart,
  Users,
  Search,
  Filter,
  ArrowUpRight,
  ShieldAlert,
  Edit3,
  Check,
  X,
  Building2,
  Server,
  RefreshCw,
  Coins,
  BarChart3,
  Layers,
  Sparkles,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';

interface TCOBreakdownDashboardProps {
  modelId: string;
  onRefreshParent?: () => void;
}

export const TCOBreakdownDashboard: React.FC<TCOBreakdownDashboardProps> = ({
  modelId,
  onRefreshParent
}) => {
  const { t, language, interpolate } = useLanguage();
  const [data, setData] = useState<TCOBreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('all');
  const [selectedTimeQuadrant, setSelectedTimeQuadrant] = useState<string>('all');
  const [editingApp, setEditingApp] = useState<ApplicationInfo | null>(null);
  const [editForm, setEditForm] = useState<{
    cost_software_licenses: number;
    cost_cloud_infrastructure: number;
    cost_vendor_maintenance: number;
    cost_internal_labor: number;
    active_users: number;
    capex_ratio: number;
    cost_center: string;
    cost_type: string;
  }>({
    cost_software_licenses: 0,
    cost_cloud_infrastructure: 0,
    cost_vendor_maintenance: 0,
    cost_internal_labor: 0,
    active_users: 0,
    capex_ratio: 0,
    cost_center: '',
    cost_type: 'OPEX (SaaS / Canone Cloud)'
  });
  const [saving, setSaving] = useState(false);

  const getCategoryLabel = (categoryKey: string, fallback: string) => {
    switch (categoryKey) {
      case 'licenses':
        return t.apm.costCatLicenses;
      case 'cloud':
        return t.apm.costCatCloud;
      case 'maintenance':
        return t.apm.costCatMaintenance;
      case 'labor':
        return t.apm.costCatLabor;
      case 'unallocated':
        return t.apm.costCatUnallocated;
      default:
        return fallback;
    }
  };

  const getCategoryDesc = (categoryKey: string) => {
    switch (categoryKey) {
      case 'licenses':
        return t.apm.costCatLicensesDesc;
      case 'cloud':
        return t.apm.costCatCloudDesc;
      case 'maintenance':
        return t.apm.costCatMaintenanceDesc;
      case 'labor':
        return t.apm.costCatLaborDesc;
      case 'unallocated':
        return t.apm.costCatUnallocatedDesc;
      default:
        return '';
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getTCOBreakdown(modelId);
      setData(res);
    } catch (err: any) {
      console.error('Failed to load TCO breakdown', err);
      setError(err?.message || t.apm.tcoErrorDefault);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [modelId]);

  const formatEUR = (val?: number) =>
    new Intl.NumberFormat(language === 'en' ? 'en-US' : 'it-IT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(val || 0);

  const formatNumber = (val?: number) =>
    new Intl.NumberFormat(language === 'en' ? 'en-US' : 'it-IT').format(val || 0);

  const handleEditClick = (app: ApplicationInfo) => {
    setEditingApp(app);
    setEditForm({
      cost_software_licenses: app.cost_software_licenses || 0,
      cost_cloud_infrastructure: app.cost_cloud_infrastructure || 0,
      cost_vendor_maintenance: app.cost_vendor_maintenance || 0,
      cost_internal_labor: app.cost_internal_labor || 0,
      active_users: app.active_users || 0,
      capex_ratio: app.capex_ratio || 0,
      cost_center: app.cost_center || 'Generale / IT',
      cost_type: app.cost_type || 'OPEX (SaaS / Canone Cloud)'
    });
  };

  const handleSaveEdit = async () => {
    if (!editingApp) return;
    setSaving(true);
    try {
      const computedTotal =
        Number(editForm.cost_software_licenses || 0) +
        Number(editForm.cost_cloud_infrastructure || 0) +
        Number(editForm.cost_vendor_maintenance || 0) +
        Number(editForm.cost_internal_labor || 0);

      await api.updateApplicationAPM(editingApp.id, {
        annual_cost: computedTotal > 0 ? computedTotal : editingApp.annual_cost,
        cost_software_licenses: Number(editForm.cost_software_licenses || 0),
        cost_cloud_infrastructure: Number(editForm.cost_cloud_infrastructure || 0),
        cost_vendor_maintenance: Number(editForm.cost_vendor_maintenance || 0),
        cost_internal_labor: Number(editForm.cost_internal_labor || 0),
        active_users: Number(editForm.active_users || 0),
        capex_ratio: Number(editForm.capex_ratio || 0),
        cost_center: editForm.cost_center,
        cost_type: editForm.cost_type
      });

      setEditingApp(null);
      await loadData();
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      console.error('Failed to update TCO breakdown attributes', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-semibold">{t.apm.tcoLoading}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4 my-6">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900">{t.apm.tcoErrorTitle}</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            {error || t.apm.tcoErrorDefault}
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t.apm.tcoRetry}</span>
        </button>
      </div>
    );
  }

  const { summary, cost_by_category, cost_by_cost_center, cost_vs_value } = data;

  // Filter applications in table
  const filteredApps = data.applications.filter((app) => {
    const matchesSearch =
      search === '' ||
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      (app.app_code && app.app_code.toLowerCase().includes(search.toLowerCase())) ||
      (app.cost_center && app.cost_center.toLowerCase().includes(search.toLowerCase())) ||
      (app.vendor && app.vendor.toLowerCase().includes(search.toLowerCase()));

    const matchesCostCenter =
      selectedCostCenter === 'all' || app.cost_center === selectedCostCenter;

    const matchesTime =
      selectedTimeQuadrant === 'all' || app.time_quadrant === selectedTimeQuadrant;

    return matchesSearch && matchesCostCenter && matchesTime;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.25),transparent_70%)] pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              Enterprise APM Financials
            </span>
            <span className="text-xs text-indigo-200/80 font-medium">
              Standard LeanIX / TOGAF / Gartner TCO
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Coins className="w-6 h-6 text-indigo-400" />
            {t.subtabs.tcoBreakdown || 'Analytic TCO & Cost Breakdown'}
          </h2>
          <p className="text-xs text-indigo-200/90 max-w-2xl leading-relaxed">
            {t.apm.tcoSubtitle}
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 shrink-0">
          <button
            onClick={loadData}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold transition text-white"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t.apm.tcoReloadData}</span>
          </button>
        </div>
      </div>

      {/* 4 Main Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TCO Totale */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {t.apm.tcoTotalAnnualTco}
            </span>
            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {formatEUR(summary.total_annual_tco)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{interpolate(t.apm.tcoAvgPerApp, { amount: formatEUR(summary.average_cost_per_app) })}</span>
            <span className="font-bold text-slate-700">{interpolate(t.apm.tcoTotalAppsCount, { count: summary.total_applications })}</span>
          </p>
        </div>

        {/* OPEX vs CAPEX Split */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {t.apm.tcoAccountingProfile}
            </span>
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900">
              {summary.opex_percentage}% OPEX
            </span>
            <span className="text-xs font-bold text-slate-500">
              {summary.capex_percentage}% CAPEX
            </span>
          </div>
          {/* Progress bar split */}
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mt-2 flex">
            <div
              className="bg-emerald-500 h-full"
              style={{ width: `${summary.opex_percentage}%` }}
              title={`OPEX: ${formatEUR(summary.total_opex)}`}
            />
            <div
              className="bg-blue-500 h-full"
              style={{ width: `${summary.capex_percentage}%` }}
              title={`CAPEX: ${formatEUR(summary.total_capex)}`}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex justify-between">
            <span>{interpolate(t.apm.tcoRun, { amount: formatEUR(summary.total_opex) })}</span>
            <span>{interpolate(t.apm.tcoCapital, { amount: formatEUR(summary.total_capex) })}</span>
          </p>
        </div>

        {/* Utenti Attivi & Costo per Utente */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {t.apm.tcoUnitEconomics}
            </span>
            <div className="p-2.5 bg-cyan-50 rounded-xl text-cyan-600 border border-cyan-100">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-cyan-800">
            {formatEUR(summary.average_cost_per_user)}
            <span className="text-xs font-bold text-slate-500 ml-1">{t.apm.tcoPerYear}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{t.apm.tcoTotalUsersVolume}</span>
            <span className="font-bold text-slate-800">
              {interpolate(t.apm.tcoUsersCount, { count: formatNumber(summary.total_active_users) })}
            </span>
          </p>
        </div>

        {/* Spesa Intrappolata su Eliminate (Waste / Bad Cost) */}
        <div className="bg-white border border-rose-200 rounded-2xl p-5 shadow-xs bg-gradient-to-br from-rose-50/40 via-white to-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              {t.apm.tcoWasteTitle}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-rose-100 text-rose-700 border border-rose-200 uppercase">
              {t.apm.tcoWasteSavingsBadge}
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-700">
            {formatEUR(summary.waste_eliminate_cost)}
          </div>
          <p className="text-[11px] text-rose-700/80 mt-1 flex items-center justify-between">
            <span>{t.apm.tcoWasteDesc}</span>
            <span className="font-bold text-rose-900">{summary.waste_eliminate_count} app</span>
          </p>
        </div>
      </div>

      {/* 4-Way Cost Bucket Breakdown Bar & Details */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              {t.apm.tcoBucketsTitle}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.apm.tcoBucketsDesc}
            </p>
          </div>
        </div>

        {/* Multi-segment stacked progress bar */}
        <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          {cost_by_category.map((cat) => {
            const colorClass =
              cat.category_key === 'licenses'
                ? 'bg-indigo-600'
                : cat.category_key === 'cloud'
                ? 'bg-cyan-500'
                : cat.category_key === 'maintenance'
                ? 'bg-amber-500'
                : cat.category_key === 'labor'
                ? 'bg-emerald-500'
                : 'bg-slate-400';
            const catLabel = getCategoryLabel(cat.category_key, cat.category);
            return (
              <div
                key={cat.category_key}
                style={{ width: `${cat.percentage}%` }}
                className={`${colorClass} h-full transition-all duration-300 relative group`}
                title={`${catLabel}: ${formatEUR(cat.amount)} (${cat.percentage}%)`}
              />
            );
          })}
        </div>

        {/* Bucket Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {cost_by_category.map((cat) => {
            const isLic = cat.category_key === 'licenses';
            const isCld = cat.category_key === 'cloud';
            const isMnt = cat.category_key === 'maintenance';
            const isLab = cat.category_key === 'labor';

            const borderClass = isLic
              ? 'border-indigo-100 bg-indigo-50/30'
              : isCld
              ? 'border-cyan-100 bg-cyan-50/30'
              : isMnt
              ? 'border-amber-100 bg-amber-50/30'
              : isLab
              ? 'border-emerald-100 bg-emerald-50/30'
              : 'border-slate-100 bg-slate-50/30';

            const dotClass = isLic
              ? 'bg-indigo-600'
              : isCld
              ? 'bg-cyan-500'
              : isMnt
              ? 'bg-amber-500'
              : isLab
              ? 'bg-emerald-500'
              : 'bg-slate-400';

            return (
              <div
                key={cat.category_key}
                className={`p-4 rounded-2xl border ${borderClass} flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
                      <span>{getCategoryLabel(cat.category_key, cat.category)}</span>
                    </span>
                    <span className="text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200/80 shadow-2xs">
                      {cat.percentage}%
                    </span>
                  </div>
                  <div className="mt-3 text-xl font-black text-slate-900">
                    {formatEUR(cat.amount)}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  {getCategoryDesc(cat.category_key)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2-Column Split: Cost Center Allocation (Left) + Cost vs Value Quadrants (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Spend by Cost Center */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                {t.apm.tcoCostCentersTitle}
              </h3>
              <p className="text-xs text-slate-500">
                {t.apm.tcoCostCentersDesc}
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
              {interpolate(t.apm.tcoCostCentersCount, { count: cost_by_cost_center.length })}
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {cost_by_cost_center.map((cc) => (
              <div
                key={cc.cost_center}
                onClick={() =>
                  setSelectedCostCenter(
                    selectedCostCenter === cc.cost_center ? 'all' : cc.cost_center
                  )
                }
                className={`p-3 rounded-2xl border transition cursor-pointer ${
                  selectedCostCenter === cc.cost_center
                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/30'
                    : 'border-slate-100 hover:border-slate-300 bg-slate-50/40'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                    <span>{cc.cost_center}</span>
                    <span className="text-[10px] text-slate-500 font-semibold bg-white px-1.5 py-0.2 rounded border border-slate-200">
                      {cc.app_count} app
                    </span>
                  </span>
                  <span className="font-black text-slate-900">
                    {formatEUR(cc.total_cost)} ({cc.percentage}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, cc.percentage * 2.5)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Cost vs Business Fit (Value Analysis) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                {t.apm.tcoCostVsValueTitle}
              </h3>
              <p className="text-xs text-slate-500">
                {t.apm.tcoCostVsValueDesc}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Bad Cost / High Cost, Low Fit */}
            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-rose-800 uppercase tracking-wider">
                    {t.apm.tcoBadCostTitle}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-800">
                    {cost_vs_value.bad_cost_apps.length}
                  </span>
                </div>
                <p className="text-[10px] text-rose-700/80 mt-1">
                  {t.apm.tcoBadCostDesc}
                </p>
                <div className="mt-2.5 space-y-1">
                  {cost_vs_value.bad_cost_apps.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className="text-xs font-bold text-rose-900 flex justify-between bg-white/80 p-1.5 rounded-lg border border-rose-100"
                    >
                      <span className="truncate max-w-[130px]">{a.name}</span>
                      <span>{formatEUR(a.annual_cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Strategic Core / High Cost, High Fit */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">
                    {t.apm.tcoStrategicCoreTitle}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800">
                    {cost_vs_value.strategic_core_apps.length}
                  </span>
                </div>
                <p className="text-[10px] text-emerald-700/80 mt-1">
                  {t.apm.tcoStrategicCoreDesc}
                </p>
                <div className="mt-2.5 space-y-1">
                  {cost_vs_value.strategic_core_apps.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className="text-xs font-bold text-emerald-900 flex justify-between bg-white/80 p-1.5 rounded-lg border border-emerald-100"
                    >
                      <span className="truncate max-w-[130px]">{a.name}</span>
                      <span>{formatEUR(a.annual_cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Efficiency Champions / Low Cost, High Fit */}
            <div className="p-4 rounded-2xl bg-cyan-50/70 border border-cyan-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-cyan-800 uppercase tracking-wider">
                    {t.apm.tcoEfficiencyTitle}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-200 text-cyan-800">
                    {cost_vs_value.efficiency_apps.length}
                  </span>
                </div>
                <p className="text-[10px] text-cyan-700/80 mt-1">
                  {t.apm.tcoEfficiencyDesc}
                </p>
                <div className="mt-2.5 space-y-1">
                  {cost_vs_value.efficiency_apps.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className="text-xs font-bold text-cyan-900 flex justify-between bg-white/80 p-1.5 rounded-lg border border-cyan-100"
                    >
                      <span className="truncate max-w-[130px]">{a.name}</span>
                      <span>{formatEUR(a.annual_cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Low Priority / Commodity */}
            <div className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    {t.apm.tcoCommodityTitle}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                    {cost_vs_value.low_priority_apps.length}
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 mt-1">
                  {t.apm.tcoCommodityDesc}
                </p>
                <div className="mt-2.5 space-y-1">
                  {cost_vs_value.low_priority_apps.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className="text-xs font-bold text-slate-800 flex justify-between bg-white/80 p-1.5 rounded-lg border border-slate-200"
                    >
                      <span className="truncate max-w-[130px]">{a.name}</span>
                      <span>{formatEUR(a.annual_cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytical Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        {/* Table Filters & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t.apm.tcoSearchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Cost Center Filter */}
            <select
              value={selectedCostCenter}
              onChange={(e) => setSelectedCostCenter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">{t.apm.tcoAllCostCenters}</option>
              {cost_by_cost_center.map((cc) => (
                <option key={cc.cost_center} value={cc.cost_center}>
                  {cc.cost_center}
                </option>
              ))}
            </select>

            {/* TIME Quadrant Filter */}
            <select
              value={selectedTimeQuadrant}
              onChange={(e) => setSelectedTimeQuadrant(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">{t.apm.tcoAllTimeQuadrants}</option>
              <option value="Invest">Invest</option>
              <option value="Tolerate">Tolerate</option>
              <option value="Migrate">Migrate</option>
              <option value="Eliminate">Eliminate</option>
            </select>

            <span className="text-xs font-bold text-slate-400">
              {filteredApps.length} {language === 'en' ? 'applications' : 'applicazioni'}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase font-black text-[10px] tracking-wider bg-slate-50/50">
                <th className="py-3 px-3">{t.apm.tcoColApp}</th>
                <th className="py-3 px-3">{t.apm.tcoColCostCenter}</th>
                <th className="py-3 px-3 text-right">{t.apm.tcoColLicenses}</th>
                <th className="py-3 px-3 text-right">{t.apm.tcoColCloud}</th>
                <th className="py-3 px-3 text-right">{t.apm.tcoColMaintenance}</th>
                <th className="py-3 px-3 text-right">{t.apm.tcoColLabor}</th>
                <th className="py-3 px-3 text-right">{t.apm.tcoColTotalTco}</th>
                <th className="py-3 px-3 text-center">{t.apm.tcoColUsers}</th>
                <th className="py-3 px-3 text-right">{t.apm.tcoColCostPerUser}</th>
                <th className="py-3 px-3 text-center">{t.apm.tcoColActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredApps.map((app) => {
                const timeColor =
                  app.time_quadrant === 'Invest'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : app.time_quadrant === 'Tolerate'
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : app.time_quadrant === 'Migrate'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-rose-100 text-rose-800 border-rose-200';

                return (
                  <tr
                    key={app.id}
                    className="hover:bg-slate-50/80 transition group"
                  >
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{app.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {app.app_code && (
                          <span className="text-[10px] font-mono px-1 rounded bg-slate-100 text-slate-600 font-semibold">
                            {app.app_code}
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border ${timeColor}`}
                        >
                          {app.time_quadrant}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {app.hosting_type}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {app.cost_center || 'Generale / IT'}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-700">
                      {formatEUR(app.cost_software_licenses)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-700">
                      {formatEUR(app.cost_cloud_infrastructure)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-700">
                      {formatEUR(app.cost_vendor_maintenance)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-700">
                      {formatEUR(app.cost_internal_labor)}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-slate-900 bg-slate-50/50">
                      {formatEUR(app.annual_cost)}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-slate-700">
                      {app.active_users ? formatNumber(app.active_users) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-700">
                      {app.cost_per_user ? formatEUR(app.cost_per_user) : '—'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleEditClick(app)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition flex items-center justify-center gap-1 mx-auto"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{t.apm.tcoBtnEdit}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {t.apm.tcoEditModalSubtitle}
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  {interpolate(t.apm.tcoEditModalTitle, { name: editingApp.name })}
                </h3>
              </div>
              <button
                onClick={() => setEditingApp(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Cost Buckets Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.apm.costCatLicenses} (€)
                  </label>
                  <input
                    type="number"
                    value={editForm.cost_software_licenses}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        cost_software_licenses: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.apm.costCatCloud} (€)
                  </label>
                  <input
                    type="number"
                    value={editForm.cost_cloud_infrastructure}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        cost_cloud_infrastructure: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.apm.costCatMaintenance} (€)
                  </label>
                  <input
                    type="number"
                    value={editForm.cost_vendor_maintenance}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        cost_vendor_maintenance: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.apm.costCatLabor} (€)
                  </label>
                  <input
                    type="number"
                    value={editForm.cost_internal_labor}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        cost_internal_labor: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Total TCO Live Preview */}
              <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900">
                  {t.apm.tcoComputedTotalTco}
                </span>
                <span className="text-base font-black text-indigo-700">
                  {formatEUR(
                    Number(editForm.cost_software_licenses || 0) +
                      Number(editForm.cost_cloud_infrastructure || 0) +
                      Number(editForm.cost_vendor_maintenance || 0) +
                      Number(editForm.cost_internal_labor || 0)
                  )}
                </span>
              </div>

              {/* Users & Allocation */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.apm.tcoLabelActiveUsers}
                  </label>
                  <input
                    type="number"
                    value={editForm.active_users}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        active_users: parseInt(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.apm.tcoLabelCapexRatio}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.capex_ratio}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        capex_ratio: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Cost Center & Model */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.apm.tcoLabelCostCenter}
                  </label>
                  <input
                    type="text"
                    value={editForm.cost_center}
                    onChange={(e) =>
                      setEditForm({ ...editForm, cost_center: e.target.value })
                    }
                    placeholder="es. CC-3010 Core Platforms"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.apm.tcoLabelCostType}
                  </label>
                  <select
                    value={editForm.cost_type}
                    onChange={(e) =>
                      setEditForm({ ...editForm, cost_type: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  >
                    <option value="OPEX (SaaS / Canone Cloud)">OPEX (SaaS / Canone Cloud)</option>
                    <option value="CAPEX (Licenza Perpetua)">CAPEX (Licenza Perpetua)</option>
                    <option value="Interno (Sviluppo In-House)">Interno (Sviluppo In-House)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setEditingApp(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? (language === 'en' ? 'Saving...' : 'Salvataggio...') : t.common.save}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
