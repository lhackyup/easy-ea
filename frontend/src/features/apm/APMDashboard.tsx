import React, { useState, useEffect, useMemo } from 'react';
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
  Cloud,
  CircleDot,
  LayoutGrid
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
  const [matrixViewMode, setMatrixViewMode] = useState<'bubble' | 'cards'>('bubble');
  const [techRiskMap, setTechRiskMap] = useState<Record<string, { level: string; score: number; eolCount: number }>>({});
  const [editingApp, setEditingApp] = useState<ApplicationInfo | null>(null);
  const [editForm, setEditForm] = useState<Partial<ApplicationInfo>>({});
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, techRes] = await Promise.all([
        api.getAPMPortfolio(modelId),
        api.getTechRiskAnalysis(modelId).catch(() => null)
      ]);
      setData(res);
      if (techRes && techRes.applications) {
        const tMap: Record<string, { level: string; score: number; eolCount: number }> = {};
        techRes.applications.forEach((a: any) => {
          tMap[a.id] = {
            level: a.tech_risk_level,
            score: a.composite_risk_score,
            eolCount: a.counts?.obsolete || 0
          };
        });
        setTechRiskMap(tMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [modelId]);

  const handleEditClick = (app: ApplicationInfo) => {
    setEditingApp(app);
    const assetActive = isAsset(app);
    setEditForm({
      business_fit: app.business_fit,
      technical_fit: app.technical_fit,
      time_quadrant_override: app.time_quadrant_override || '',
      annual_cost: app.annual_cost,
      cost_type: app.cost_type || 'OPEX (SaaS / Canone Cloud)',
      cost_center: app.cost_center || '',
      business_criticality: app.business_criticality,
      lifecycle_status: app.lifecycle_status,
      live_date: app.live_date || '',
      retirement_date: app.retirement_date || '',
      business_owner: app.business_owner,
      technical_owner: app.technical_owner,
      vendor: app.vendor,
      hosting_type: app.hosting_type,
      architecture_type: app.architecture_type || '3-Tier Web App',
      data_classification: app.data_classification || 'Internal',
      personal_data: app.personal_data || false,
      sla_level: app.sla_level || 'Silver (99.0%)',
      rto_hours: app.rto_hours || '< 4 ore',
      is_business_app: assetActive,
      is_enterprise_app: assetActive,
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

  const isAsset = (a: ApplicationInfo) => a.is_business_app !== false && a.is_enterprise_app !== false && a.in_apm_scope !== false;

  const businessApps = useMemo(() => {
    if (!data?.applications) return [];
    return data.applications.filter(isAsset);
  }, [data?.applications]);

  const totalBusinessCost = useMemo(() => {
    return businessApps.reduce((acc, a) => acc + (a.annual_cost || 0), 0);
  }, [businessApps]);

  const filteredApps = useMemo(() => {
    return businessApps.filter((app) => {
      const matchesSearch =
        app.name.toLowerCase().includes(search.toLowerCase()) ||
        app.vendor.toLowerCase().includes(search.toLowerCase()) ||
        app.business_owner.toLowerCase().includes(search.toLowerCase());
      const matchesQuad = selectedQuadrant ? (app.time_quadrant_override || app.time_quadrant) === selectedQuadrant : true;
      return matchesSearch && matchesQuad;
    });
  }, [businessApps, search, selectedQuadrant]);

  const formatEUR = (val: number) =>
    new Intl.NumberFormat(language === 'en' ? 'en-US' : 'it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

  const formatCompactEUR = (val: number) => {
    if (val >= 1000000) return `€${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `€${(val / 1000).toFixed(0)}k`;
    return `€${val}`;
  };

  const timeSummary = useMemo(() => {
    if (!businessApps) return null;
    const counts = { Invest: 0, Tolerate: 0, Migrate: 0, Eliminate: 0 };
    const costs = { Invest: 0, Tolerate: 0, Migrate: 0, Eliminate: 0 };

    businessApps.forEach((app) => {
      const q = (app.time_quadrant_override || app.time_quadrant) as keyof typeof counts;
      if (counts[q] !== undefined) {
        counts[q] += 1;
        costs[q] += app.annual_cost || 0;
      }
    });

    return { counts, costs };
  }, [businessApps]);

  const bubbleApps = useMemo(() => {
    if (!businessApps || businessApps.length === 0) return [];

    const costs = businessApps.map((r) => Number(r.annual_cost) || 0);
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    const costSpread = Math.max(1, maxCost - minCost);

    const groups: { [key: string]: ApplicationInfo[] } = {};
    businessApps.forEach((r) => {
      const bFit = Number(r.business_fit) || 3;
      const tFit = Number(r.technical_fit) || 3;
      const key = `${bFit}_${tFit}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    return businessApps.map((app) => {
      const bFit = Number(app.business_fit) || 3;
      const tFit = Number(app.technical_fit) || 3;
      const cost = Number(app.annual_cost) || 0;

      const costRatio = Math.sqrt(Math.max(0, cost - minCost) / costSpread);
      const radius = 20 + costRatio * 32;

      const minX = 8;
      const maxX = 92;
      const baseX = minX + ((tFit - 1) / 3) * (maxX - minX);

      const minY = 9;
      const maxY = 91;
      const baseY = maxY - ((bFit - 1) / 3) * (maxY - minY);

      const key = `${bFit}_${tFit}`;
      const group = groups[key] || [];
      const indexInGroup = group.indexOf(app);
      let offsetX = 0;
      let offsetY = 0;

      if (group.length > 1) {
        const angle = indexInGroup * 2.39996;
        const dist = Math.min(4.5, 1.2 + Math.sqrt(indexInGroup) * 0.95);
        offsetX = Math.cos(angle) * dist;
        offsetY = Math.sin(angle) * dist;

        if (tFit >= 2.5 && baseX + offsetX < 52) offsetX = Math.abs(offsetX);
        if (tFit < 2.5 && baseX + offsetX > 48) offsetX = -Math.abs(offsetX);
        if (bFit >= 2.5 && baseY + offsetY > 48) offsetY = -Math.abs(offsetY);
        if (bFit < 2.5 && baseY + offsetY < 52) offsetY = Math.abs(offsetY);
      }

      const posX = Math.max(minX, Math.min(maxX, baseX + offsetX));
      const posY = Math.max(minY, Math.min(maxY, baseY + offsetY));

      const quadrant = app.time_quadrant_override || app.time_quadrant;
      const shortName = app.short_name || (app.name ? app.name.slice(0, 14) : 'App');
      const appCode = app.app_code || (app.id.startsWith('elem-') ? app.id.replace('elem-', 'AP') : 'AP0000');

      return {
        app,
        posX,
        posY,
        radius,
        diameter: radius * 2,
        quadrant,
        shortName,
        appCode,
        cost,
        bFit,
        tFit
      };
    });
  }, [businessApps]);

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
      </div>

      {/* Top Metric Cards & Executive KPI */}
      <div className="space-y-4">
        {/* Total Cost & Scope Summary Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.apm.totalAnnualCost}</span>
              <div className="text-2xl font-black text-slate-900">{formatEUR(totalBusinessCost)}</div>
              <p className="text-[11px] text-slate-500">{t.apm.costDesc}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-slate-600">
              <span className="font-bold text-slate-800">{businessApps.length}</span> Business Application censite nel portfolio APM
            </div>
            {selectedQuadrant && (
              <button
                onClick={() => setSelectedQuadrant(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1.5 transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>Rimuovi Filtro ({selectedQuadrant})</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Quadrants Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Invest */}
          <div
            onClick={() => setSelectedQuadrant(selectedQuadrant === 'Invest' ? null : 'Invest')}
            className={`bg-emerald-50/60 border rounded-2xl p-4 shadow-2xs cursor-pointer transition ${
              selectedQuadrant === 'Invest' ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-100/50' : 'border-emerald-200/80 hover:border-emerald-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">{t.apm.investTitle}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-950">{timeSummary?.counts.Invest || 0} app</div>
            <div className="text-xs font-bold text-emerald-700 font-mono mt-0.5">{formatEUR(timeSummary?.costs.Invest || 0)}</div>
            <p className="text-[11px] text-emerald-800/80 mt-1">{t.apm.investDesc}</p>
          </div>

          {/* Tolerate */}
          <div
            onClick={() => setSelectedQuadrant(selectedQuadrant === 'Tolerate' ? null : 'Tolerate')}
            className={`bg-blue-50/60 border rounded-2xl p-4 shadow-2xs cursor-pointer transition ${
              selectedQuadrant === 'Tolerate' ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-100/50' : 'border-blue-200/80 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-800">{t.apm.tolerateTitle}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-blue-950">{timeSummary?.counts.Tolerate || 0} app</div>
            <div className="text-xs font-bold text-blue-700 font-mono mt-0.5">{formatEUR(timeSummary?.costs.Tolerate || 0)}</div>
            <p className="text-[11px] text-blue-800/80 mt-1">{t.apm.tolerateDesc}</p>
          </div>

          {/* Migrate */}
          <div
            onClick={() => setSelectedQuadrant(selectedQuadrant === 'Migrate' ? null : 'Migrate')}
            className={`bg-amber-50/60 border rounded-2xl p-4 shadow-2xs cursor-pointer transition ${
              selectedQuadrant === 'Migrate' ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-100/50' : 'border-amber-200/80 hover:border-amber-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800">{t.apm.migrateTitle}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-amber-950">{timeSummary?.counts.Migrate || 0} app</div>
            <div className="text-xs font-bold text-amber-700 font-mono mt-0.5">{formatEUR(timeSummary?.costs.Migrate || 0)}</div>
            <p className="text-[11px] text-amber-800/80 mt-1">{t.apm.migrateDesc}</p>
          </div>

          {/* Eliminate */}
          <div
            onClick={() => setSelectedQuadrant(selectedQuadrant === 'Eliminate' ? null : 'Eliminate')}
            className={`bg-rose-50/60 border rounded-2xl p-4 shadow-2xs cursor-pointer transition ${
              selectedQuadrant === 'Eliminate' ? 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-100/50' : 'border-rose-200/80 hover:border-rose-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-800">{t.apm.eliminateTitle}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-rose-950">{timeSummary?.counts.Eliminate || 0} app</div>
            <div className="text-xs font-bold text-rose-700 font-mono mt-0.5">{formatEUR(timeSummary?.costs.Eliminate || 0)}</div>
            <p className="text-[11px] text-rose-800/80 mt-1">{t.apm.eliminateDesc}</p>
          </div>
        </div>
      </div>

      {/* Gartner TIME Matrix (Interactive Visual 2x2 Bubble Matrix & Cards) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <CircleDot className="w-4 h-4 text-indigo-600" />
              <span>Matrice Cartesiana a Bolle 2x2 (Gartner TIME)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ogni pallino posizionato all'incrocio di <strong>Technical Fit</strong> (X) e <strong>Business Fit</strong> (Y), con raggio proporzionale al <strong>TCO</strong>.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Legend */}
            <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <span className="font-semibold text-slate-700">Dimensione Bolla:</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> Basso TCO</span>
              <span className="text-slate-300">➔</span>
              <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-slate-700 inline-block" /> Alto TCO</span>
            </div>

            {/* View Switcher: Bubble vs Cards */}
            <div className="flex items-center bg-slate-100 border border-slate-200 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setMatrixViewMode('bubble')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
                  matrixViewMode === 'bubble'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Vista Matrice a Bolle Cartesiana"
              >
                <CircleDot className="w-3.5 h-3.5" />
                <span>Bolle</span>
              </button>
              <button
                type="button"
                onClick={() => setMatrixViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
                  matrixViewMode === 'cards'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Vista Quadranti a Schede"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Schede</span>
              </button>
            </div>
          </div>
        </div>

        {matrixViewMode === 'bubble' ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-stretch gap-2.5">
              {/* Y-Axis Label Area */}
              <div className="w-10 sm:w-12 shrink-0 flex flex-col items-center justify-between py-6 select-none bg-slate-50/80 border border-slate-200/90 rounded-2xl">
                <div className="text-[10px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded shadow-2xs border border-slate-200 font-mono" title="Punteggio Massimo (4.0)">
                  4.0
                </div>
                <div className="-rotate-90 whitespace-nowrap text-[11px] font-black uppercase tracking-wider text-slate-800 bg-white border border-slate-300 px-3 py-1 rounded-full shadow-xs">
                  ▲ BUSINESS FIT
                </div>
                <div className="text-[10px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded shadow-2xs border border-slate-200 font-mono" title="Punteggio Minimo (1.0)">
                  1.0
                </div>
              </div>

              {/* Chart Canvas Area */}
              <div className="relative flex-1 h-[640px] bg-slate-900/[0.02] border-2 border-slate-200/90 rounded-2xl overflow-hidden select-none">
                {/* 4 Quadrants Background Areas */}
                {/* Top-Left: TOLERATE */}
                <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-r-2 border-b-2 border-dashed border-slate-300 p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-blue-900 bg-blue-100/90 border border-blue-300 px-2.5 py-1 rounded-lg shadow-2xs">
                      {t.apm.quadrantTolerateTitle}
                    </span>
                    <span className="text-[11px] font-bold text-blue-700 bg-white/80 px-2 py-0.5 rounded-md border border-blue-200 font-mono">
                      {timeSummary?.counts.Tolerate || 0} app
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-blue-800/60 max-w-[260px]">
                    {t.apm.quadrantTolerateSubtitle}
                  </div>
                </div>

                {/* Top-Right: INVEST */}
                <div className="absolute top-0 left-1/2 w-1/2 h-1/2 bg-gradient-to-bl from-emerald-500/10 via-emerald-500/5 to-transparent border-b-2 border-dashed border-slate-300 p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-900 bg-emerald-100/90 border border-emerald-300 px-2.5 py-1 rounded-lg shadow-2xs">
                      {t.apm.quadrantInvestTitle}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200 font-mono">
                      {timeSummary?.counts.Invest || 0} app
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-800/60 max-w-[260px] text-right ml-auto">
                    {t.apm.quadrantInvestSubtitle}
                  </div>
                </div>

                {/* Bottom-Left: ELIMINATE */}
                <div className="absolute top-1/2 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-rose-500/10 via-rose-500/5 to-transparent border-r-2 border-dashed border-slate-300 p-4 flex flex-col justify-between">
                  <div className="text-[11px] font-semibold text-rose-800/60 max-w-[260px]">
                    {t.apm.quadrantEliminateSubtitle}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-900 bg-rose-100/90 border border-rose-300 px-2.5 py-1 rounded-lg shadow-2xs">
                      {t.apm.quadrantEliminateTitle}
                    </span>
                    <span className="text-[11px] font-bold text-rose-700 bg-white/80 px-2 py-0.5 rounded-md border border-rose-200 font-mono">
                      {timeSummary?.counts.Eliminate || 0} app
                    </span>
                  </div>
                </div>

                {/* Bottom-Right: MIGRATE */}
                <div className="absolute top-1/2 left-1/2 w-1/2 h-1/2 bg-gradient-to-tl from-amber-500/10 via-amber-500/5 to-transparent p-4 flex flex-col justify-between">
                  <div className="text-[11px] font-semibold text-amber-800/60 max-w-[260px] text-right ml-auto">
                    {t.apm.quadrantMigrateSubtitle}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-900 bg-amber-100/90 border border-amber-300 px-2.5 py-1 rounded-lg shadow-2xs">
                      {t.apm.quadrantMigrateTitle}
                    </span>
                    <span className="text-[11px] font-bold text-amber-800 bg-white/80 px-2 py-0.5 rounded-md border border-amber-200 font-mono">
                      {timeSummary?.counts.Migrate || 0} app
                    </span>
                  </div>
                </div>

                {/* Center Origin Threshold Marker */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-800 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-lg z-30 border border-slate-600">
                  Soglia 2.5
                </div>

                {/* Bubble Elements */}
                {bubbleApps.map((b) => (
                  <div
                    key={b.app.id}
                    className="absolute group z-20 hover:z-50 transition-all duration-200"
                    style={{
                      left: `${b.posX}%`,
                      top: `${b.posY}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleEditClick(b.app)}
                      className={`rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-200 transform group-hover:scale-115 group-hover:shadow-xl focus:outline-none focus:ring-4 ${
                        b.quadrant === 'Invest'
                          ? 'bg-emerald-600/95 hover:bg-emerald-500 text-white border-2 border-emerald-300 shadow-md ring-2 ring-emerald-500/30'
                          : b.quadrant === 'Tolerate'
                          ? 'bg-blue-600/95 hover:bg-blue-500 text-white border-2 border-blue-300 shadow-md ring-2 ring-blue-500/30'
                          : b.quadrant === 'Migrate'
                          ? 'bg-amber-500/95 hover:bg-amber-400 text-slate-950 font-black border-2 border-amber-200 shadow-md ring-2 ring-amber-500/30'
                          : 'bg-rose-600/95 hover:bg-rose-500 text-white border-2 border-rose-300 shadow-md ring-2 ring-rose-500/30'
                      }`}
                      style={{
                        width: `${b.diameter}px`,
                        height: `${b.diameter}px`
                      }}
                      aria-label={`${b.shortName} (${b.appCode})`}
                    >
                      <span className="font-extrabold text-[10px] leading-tight px-1 text-center truncate max-w-full select-none">
                        {b.shortName}
                      </span>
                      {b.diameter >= 52 && (
                        <span className="text-[9px] font-mono opacity-85 mt-0.5 select-none font-bold">
                          {formatCompactEUR(b.cost)}
                        </span>
                      )}
                    </button>

                    {/* Rich Hover Floating Tooltip */}
                    <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col bg-slate-950/95 text-white border border-slate-700/80 rounded-xl p-3 shadow-2xl z-50 min-w-[250px] max-w-[320px] pointer-events-none backdrop-blur-md">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
                        <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-black bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                          {b.appCode}
                        </span>
                        <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          b.quadrant === 'Invest' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                          b.quadrant === 'Tolerate' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                          b.quadrant === 'Migrate' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                          'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}>
                          {b.quadrant}
                        </span>
                      </div>
                      <div className="text-xs font-black text-slate-100 leading-snug">{b.app.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Nome Breve: <span className="text-slate-200 font-bold">{b.shortName}</span></div>
                      <div className="mt-2 space-y-1 text-[11px] border-t border-slate-800/80 pt-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">TCO Annuo:</span>
                          <span className="font-mono font-bold text-amber-300">{formatEUR(b.cost)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Business Fit:</span>
                          <span className="font-bold text-slate-200">{b.bFit} / 4</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Technical Fit:</span>
                          <span className="font-bold text-slate-200">{b.tFit} / 4</span>
                        </div>
                        {b.app.business_owner && (
                          <div className="text-[10px] text-slate-400 truncate pt-1 border-t border-slate-900">
                            Owner: {b.app.business_owner}
                          </div>
                        )}
                        {b.app.vendor && (
                          <div className="text-[10px] text-slate-400 truncate">
                            Vendor: {b.app.vendor}
                          </div>
                        )}
                      </div>
                      <div className="text-[9px] text-indigo-300/90 mt-2 text-center italic">
                        Fai clic per aprire la scheda di modifica
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* X-Axis Label Area */}
            <div className="flex items-center justify-between pl-12 sm:pl-14 pr-4 py-2 select-none bg-slate-50/80 border border-slate-200/90 rounded-2xl">
              <div className="text-[10px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded shadow-2xs border border-slate-200 font-mono" title="Punteggio Minimo (1.0)">
                1.0 Obsoleto
              </div>
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-800 bg-white border border-slate-300 px-4 py-1 rounded-full shadow-xs flex items-center gap-1.5">
                <span>TECHNICAL FIT (Qualità Architetturale & Tecnologia)</span>
                <span className="text-slate-400">►</span>
              </div>
              <div className="text-[10px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded shadow-2xs border border-slate-200 font-mono" title="Punteggio Massimo (4.0)">
                4.0 Cloud Native
              </div>
            </div>
          </div>
        ) : (
          /* VISTA 2: QUADRANTI A SCHEDE (CARDS) */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top-Left: TOLERATE */}
              <div className="bg-blue-50/40 border border-blue-200/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 mb-2">
                  <span className="text-xs font-black text-blue-900">{t.apm.quadrantTolerateTitle}</span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded font-mono">
                    {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Tolerate').length} app
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 content-start max-h-72 overflow-y-auto">
                  {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Tolerate').map((app) => (
                    <button
                      key={app.id}
                      onClick={() => handleEditClick(app)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs border border-blue-700 flex items-center gap-1.5 cursor-pointer transition transform hover:scale-105"
                      title={`[${app.app_code || 'AP0000'}] ${app.name} • TCO: ${formatEUR(app.annual_cost)}`}
                    >
                      <span className="font-mono text-[10px] opacity-80">[{app.app_code || 'AP0000'}]</span>
                      <span>{app.short_name || app.name}</span>
                      <span className="text-[10px] opacity-80 font-mono">({formatCompactEUR(app.annual_cost)})</span>
                    </button>
                  ))}
                  {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Tolerate').length === 0 && (
                    <span className="text-xs text-blue-500 italic p-2">Nessuna applicazione in questo quadrante</span>
                  )}
                </div>
              </div>

              {/* Top-Right: INVEST */}
              <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60 mb-2">
                  <span className="text-xs font-black text-emerald-900">{t.apm.quadrantInvestTitle}</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-mono">
                    {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Invest').length} app
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 content-start max-h-72 overflow-y-auto">
                  {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Invest').map((app) => (
                    <button
                      key={app.id}
                      onClick={() => handleEditClick(app)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-700 flex items-center gap-1.5 cursor-pointer transition transform hover:scale-105"
                      title={`[${app.app_code || 'AP0000'}] ${app.name} • TCO: ${formatEUR(app.annual_cost)}`}
                    >
                      <span className="font-mono text-[10px] opacity-80">[{app.app_code || 'AP0000'}]</span>
                      <span>{app.short_name || app.name}</span>
                      <span className="text-[10px] opacity-80 font-mono">({formatCompactEUR(app.annual_cost)})</span>
                    </button>
                  ))}
                  {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Invest').length === 0 && (
                    <span className="text-xs text-emerald-500 italic p-2">Nessuna applicazione in questo quadrante</span>
                  )}
                </div>
              </div>

              {/* Bottom-Left: ELIMINATE */}
              <div className="bg-rose-50/40 border border-rose-200/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between pb-2 border-b border-rose-200/60 mb-2">
                  <span className="text-xs font-black text-rose-900">{t.apm.quadrantEliminateTitle}</span>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded font-mono">
                    {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Eliminate').length} app
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 content-start max-h-72 overflow-y-auto">
                  {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Eliminate').map((app) => (
                    <button
                      key={app.id}
                      onClick={() => handleEditClick(app)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs border border-rose-700 flex items-center gap-1.5 cursor-pointer transition transform hover:scale-105"
                      title={`[${app.app_code || 'AP0000'}] ${app.name} • TCO: ${formatEUR(app.annual_cost)}`}
                    >
                      <span className="font-mono text-[10px] opacity-80">[{app.app_code || 'AP0000'}]</span>
                      <span>{app.short_name || app.name}</span>
                      <span className="text-[10px] opacity-80 font-mono">({formatCompactEUR(app.annual_cost)})</span>
                    </button>
                  ))}
                  {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Eliminate').length === 0 && (
                    <span className="text-xs text-rose-500 italic p-2">Nessuna applicazione in questo quadrante</span>
                  )}
                </div>
              </div>

              {/* Bottom-Right: MIGRATE */}
              <div className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 mb-2">
                  <span className="text-xs font-black text-amber-900">{t.apm.quadrantMigrateTitle}</span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-mono">
                    {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Migrate').length} app
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 content-start max-h-72 overflow-y-auto">
                  {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Migrate').map((app) => (
                    <button
                      key={app.id}
                      onClick={() => handleEditClick(app)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-xs border border-amber-600 flex items-center gap-1.5 cursor-pointer transition transform hover:scale-105"
                      title={`[${app.app_code || 'AP0000'}] ${app.name} • TCO: ${formatEUR(app.annual_cost)}`}
                    >
                      <span className="font-mono text-[10px] opacity-80">[{app.app_code || 'AP0000'}]</span>
                      <span>{app.short_name || app.name}</span>
                      <span className="text-[10px] opacity-80 font-mono">({formatCompactEUR(app.annual_cost)})</span>
                    </button>
                  ))}
                  {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Migrate').length === 0 && (
                    <span className="text-xs text-amber-600 italic p-2">Nessuna applicazione in questo quadrante</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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
                <th className="py-3 px-4">{t.apm.colTimeQuadrant}</th>
                <th className="py-3 px-4">Tech Risk (EOL)</th>
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
                      <div className="flex items-center space-x-1.5">
                        <span>{app.name}</span>
                        <span className="px-1.5 py-0.2 text-[9px] font-black rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                          «Business App»
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-normal">{app.id}</span>
                    </div>
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
                  <td className="py-3.5 px-4">
                    {techRiskMap[app.id] ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          techRiskMap[app.id].level === 'Critical'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : techRiskMap[app.id].level === 'High'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : techRiskMap[app.id].level === 'Medium'
                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                            : techRiskMap[app.id].level === 'Low'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {techRiskMap[app.id].level === 'Critical' ? '🔴 Critical' :
                         techRiskMap[app.id].level === 'High' ? '🟠 High' :
                         techRiskMap[app.id].level === 'Medium' ? '🟡 Medium' :
                         techRiskMap[app.id].level === 'Low' ? '🟢 Supported' : '⚪ N/A'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">⚪ N/A</span>
                    )}
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
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingApp(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">{interpolate(t.apm.editModalTitle, { name: editingApp.name })}</h3>
            <p className="text-xs text-slate-500 mb-5">{t.apm.editModalSubtitle}</p>

            <div className="space-y-5">
              
              {/* Enterprise Application Stereotype Toggle */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
                    <span>{t.apm.labelInApmScope}</span>
                    <span className="px-1.5 py-0.2 text-[9px] font-black rounded bg-indigo-600 text-white uppercase">
                      Stereotipo
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-600 mt-0.5">{t.apm.labelInApmScopeDesc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={editForm.is_business_app !== false}
                  onChange={(e) => setEditForm({ ...editForm, is_business_app: e.target.checked, is_enterprise_app: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                />
              </div>

              {/* Sezione: Fit & TIME */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Valutazione Gartner TIME & Fit
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelBusinessFit}
                    </label>
                    <select
                      value={editForm.business_fit || 3}
                      onChange={(e) => setEditForm({ ...editForm, business_fit: parseInt(e.target.value) || 1 })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value={1}>1 - Unreasonable (Inadeguata)</option>
                      <option value={2}>2 - Insufficient (Lacunosa)</option>
                      <option value={3}>3 - Appropriate (Adeguata)</option>
                      <option value={4}>4 - Perfect (Eccellente)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelTechnicalFit}
                    </label>
                    <select
                      value={editForm.technical_fit || 3}
                      onChange={(e) => setEditForm({ ...editForm, technical_fit: parseInt(e.target.value) || 1 })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value={1}>1 - Unreasonable (Obsoleta)</option>
                      <option value={2}>2 - Insufficient (Debito Tecnico)</option>
                      <option value={3}>3 - Appropriate (Stabile/Standard)</option>
                      <option value={4}>4 - Perfect (Cloud Native)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelTimeOverride}
                    </label>
                    <select
                      value={editForm.time_quadrant_override || ''}
                      onChange={(e) => setEditForm({ ...editForm, time_quadrant_override: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Auto (Calcolato dai Fit)</option>
                      <option value="Invest">Invest (Alto Valore/Tecnologia)</option>
                      <option value="Migrate">Migrate (Riprogettare/Cloud)</option>
                      <option value="Tolerate">Tolerate (Mantenere/Stabile)</option>
                      <option value="Eliminate">Eliminate (Dismettere)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sezione: Ciclo di Vita & Criticità */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Ciclo di Vita & Criticità
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelLifecycle}
                    </label>
                    <select
                      value={editForm.lifecycle_status}
                      onChange={(e) => setEditForm({ ...editForm, lifecycle_status: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Plan">Plan</option>
                      <option value="Phase In">Phase In</option>
                      <option value="Live">Live</option>
                      <option value="Phase Out">Phase Out</option>
                      <option value="Retired">Retired</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelCriticality}
                    </label>
                    <select
                      value={editForm.business_criticality}
                      onChange={(e) => setEditForm({ ...editForm, business_criticality: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Mission Critical">Mission Critical</option>
                      <option value="Business Critical">Business Critical</option>
                      <option value="Business Operational">Business Operational</option>
                      <option value="Administrative">Administrative</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelGoLiveDate}
                    </label>
                    <input
                      type="date"
                      value={editForm.live_date || ''}
                      onChange={(e) => setEditForm({ ...editForm, live_date: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelRetirementDate}
                    </label>
                    <input
                      type="date"
                      value={editForm.retirement_date || ''}
                      onChange={(e) => setEditForm({ ...editForm, retirement_date: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sezione: TCO & Finanza */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Financials & Costi TCO
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelAnnualCost}
                    </label>
                    <input
                      type="number"
                      value={editForm.annual_cost || 0}
                      onChange={(e) => setEditForm({ ...editForm, annual_cost: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelCostType}
                    </label>
                    <select
                      value={editForm.cost_type || 'OPEX (SaaS / Canone Cloud)'}
                      onChange={(e) => setEditForm({ ...editForm, cost_type: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="OPEX (SaaS / Canone Cloud)">OPEX (SaaS / Canone Cloud)</option>
                      <option value="CAPEX (Licenza Perpetua)">CAPEX (Licenza Perpetua)</option>
                      <option value="Internal (Sviluppo Interno)">Internal (Sviluppo Interno)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelCostCenter}
                    </label>
                    <input
                      type="text"
                      placeholder="es. CC-1020"
                      value={editForm.cost_center || ''}
                      onChange={(e) => setEditForm({ ...editForm, cost_center: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sezione: Architettura & Hosting */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Architettura Software & Hosting
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelHosting}
                    </label>
                    <select
                      value={editForm.hosting_type}
                      onChange={(e) => setEditForm({ ...editForm, hosting_type: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="SaaS">SaaS</option>
                      <option value="Public Cloud">Public Cloud (AWS/GCP/Azure)</option>
                      <option value="Private Cloud">Private Cloud</option>
                      <option value="On-Premise">On-Premise</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelArchitectureType}
                    </label>
                    <select
                      value={editForm.architecture_type || '3-Tier Web App'}
                      onChange={(e) => setEditForm({ ...editForm, architecture_type: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="SaaS Standard">SaaS Standard</option>
                      <option value="Microservices / Cloud Native">Microservices / Cloud Native</option>
                      <option value="3-Tier Web App">3-Tier Web App</option>
                      <option value="Monolith / Client-Server">Monolith / Client-Server</option>
                      <option value="Legacy Mainframe">Legacy Mainframe</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sezione: Governance & Ownership */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Governance & Ownership
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelBusinessOwner}
                    </label>
                    <input
                      type="text"
                      value={editForm.business_owner || ''}
                      onChange={(e) => setEditForm({ ...editForm, business_owner: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelTechnicalOwner}
                    </label>
                    <input
                      type="text"
                      value={editForm.technical_owner || ''}
                      onChange={(e) => setEditForm({ ...editForm, technical_owner: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
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
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sezione: Sicurezza & Resilienza */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Sicurezza, Privacy & SLA
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelDataClassification}
                    </label>
                    <select
                      value={editForm.data_classification || 'Internal'}
                      onChange={(e) => setEditForm({ ...editForm, data_classification: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Public">Public</option>
                      <option value="Internal">Internal</option>
                      <option value="Confidential">Confidential</option>
                      <option value="Restricted / GDPR PII">Restricted / GDPR PII</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelSla}
                    </label>
                    <select
                      value={editForm.sla_level || 'Silver (99.0%)'}
                      onChange={(e) => setEditForm({ ...editForm, sla_level: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Platinum (99.99%)">Platinum (99.99%)</option>
                      <option value="Gold (99.9%)">Gold (99.9%)</option>
                      <option value="Silver (99.0%)">Silver (99.0%)</option>
                      <option value="Bronze (95.0%)">Bronze (95.0%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelRto}
                    </label>
                    <select
                      value={editForm.rto_hours || '< 4 ore'}
                      onChange={(e) => setEditForm({ ...editForm, rto_hours: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="< 1 ora">&lt; 1 ora</option>
                      <option value="< 4 ore">&lt; 4 ore</option>
                      <option value="< 24 ore">&lt; 24 ore</option>
                      <option value="> 24 ore / Best Effort">&gt; 24 ore / Best Effort</option>
                    </select>
                  </div>
                </div>
                <div className="pt-2 flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="chk_personal_data"
                    checked={editForm.personal_data || false}
                    onChange={(e) => setEditForm({ ...editForm, personal_data: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="chk_personal_data" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    {t.apm.labelPersonalData}
                  </label>
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
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
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
                  className="flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? 'Salvataggio...' : t.common.save}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
