import React, { useState, useEffect } from 'react';
import { APMPortfolio, OverlapMatrixData, PlateauRoadmap, ArchitecturalRisksReport, TechRiskAnalysisData } from '../../types';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import {
  TrendingUp,
  DollarSign,
  ShieldCheck,
  GitMerge,
  ArrowUpRight,
  Sparkles,
  Milestone,
  ShieldAlert,
  Layers,
  ArrowRight
} from 'lucide-react';

interface ExecutiveOverviewProps {
  modelId: string;
  onNavigateTab: (tab: 'apm' | 'tech_risk' | 'tco' | 'overlap' | 'processes') => void;
}

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({ modelId, onNavigateTab }) => {
  const { t, interpolate } = useLanguage();
  const [apm, setApm] = useState<APMPortfolio | null>(null);
  const [overlap, setOverlap] = useState<OverlapMatrixData | null>(null);
  const [plateaus, setPlateaus] = useState<PlateauRoadmap | null>(null);
  const [risks, setRisks] = useState<ArchitecturalRisksReport | null>(null);
  const [techRisk, setTechRisk] = useState<TechRiskAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [aData, oData, pData, rData, tData] = await Promise.all([
          api.getAPMPortfolio(modelId),
          api.getOverlapMatrix(modelId),
          api.getPlateauRoadmap(modelId).catch(() => null),
          api.getArchitecturalRisks(modelId).catch(() => null),
          api.getTechRiskAnalysis(modelId).catch(() => null)
        ]);
        setApm(aData);
        setOverlap(oData);
        setPlateaus(pData);
        setRisks(rData);
        setTechRisk(tData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [modelId]);

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

  if (!apm || !overlap) return null;

  const formatEUR = (val: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

  const investPercent = apm.total_applications > 0 ? (apm.time_distribution.Invest / apm.total_applications) * 100 : 0;
  const portfolioHealth = Math.round(Math.max(10, Math.min(100, (investPercent * 0.6) + ((100 - overlap.redundancy_score_percentage) * 0.4))));

  return (
    <div className="space-y-6 pb-12">
      {/* Title & Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-xs font-semibold text-indigo-200 mb-3 backdrop-blur">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{t.executive.tagline}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {t.executive.title}
          </h2>
          <p className="text-sm text-indigo-100/80 mt-2 leading-relaxed">
            {t.executive.description}
          </p>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cost / TCO */}
        <div
          onClick={() => onNavigateTab('tco')}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm cursor-pointer hover:border-indigo-400 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.executive.totalItCost}</span>
            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">{formatEUR(apm.total_annual_cost)}</div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{interpolate(t.executive.annualCostOnApps, { count: apm.total_applications })}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-indigo-600" />
          </p>
        </div>

        {/* Portfolio Health Score */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.executive.portfolioHealthRating}</span>
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-700">{portfolioHealth}/100</span>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
              {portfolioHealth > 70 ? t.executive.healthOptimal : portfolioHealth > 45 ? t.executive.healthModerate : t.executive.healthReview}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{t.executive.balanceInvestDebt}</p>
        </div>

        {/* Rationalization Opportunity */}
        <div
          onClick={() => onNavigateTab('overlap')}
          className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm cursor-pointer hover:border-amber-400 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">{t.executive.potentialSavings}</span>
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 border border-amber-100">
              <GitMerge className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-amber-700">{formatEUR(overlap.potential_savings_opportunity)}</div>
          <p className="text-[11px] text-amber-800/80 mt-1 flex items-center gap-1 font-semibold">
            <span>{interpolate(t.executive.fromRedundancyClusters, { count: overlap.redundant_capabilities_count })}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </p>
        </div>

        {/* Strategic Capital Allocation */}
        <div
          onClick={() => onNavigateTab('apm')}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm cursor-pointer hover:border-indigo-400 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.executive.strategicInvestments}</span>
            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 border border-blue-100">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-blue-700">
            {formatEUR(apm.time_cost_distribution.Invest)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>{interpolate(t.executive.keyAppsGrowing, { count: apm.time_distribution.Invest })}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-indigo-600" />
          </p>
        </div>
      </div>

      {/* Technology Obsolescence & DORA Risk Banner */}
      {techRisk && (techRisk.summary.dora_compliance_alerts_count > 0 || techRisk.summary.obsolete_technologies_count > 0) && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-rose-100 rounded-xl text-rose-700">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-900">
                  DORA / NIS2 Tech Obsolescence Risk Radar
                </span>
                {techRisk.summary.dora_compliance_alerts_count > 0 && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-600 text-white uppercase tracking-wider animate-pulse">
                    {techRisk.summary.dora_compliance_alerts_count} Allerte DORA Critiche
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-800/90 mt-0.5">
                Rilevate <strong>{techRisk.summary.obsolete_technologies_count} tecnologie End-of-Life (EOL)</strong> e <strong>{techRisk.summary.approaching_eol_count} in scadenza</strong> che impattano applicazioni core del portafoglio.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('tech_risk')}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
          >
            <span>Apri Radar Obsolescenza</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Architectural Governance & SPOF Risk Alert Banner (if risks detected) */}
      {risks && risks.summary.total_risks > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-800">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Governance Architetturale & Allerta Rischi ({risks.risk_level})
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                  {risks.summary.total_risks} anomalie rilevate
                </span>
              </div>
              <p className="text-xs text-amber-800/90 mt-0.5">
                Rilevati <strong>{risks.summary.spof_count} Single Points of Failure (SPOF)</strong> e <strong>{risks.summary.lifecycle_risks_count} processi dipendenti da app in dismissione</strong>.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('processes')}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
          >
            <span>Analizza nei Processi</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2-Column Split: TIME Capital Allocation (Left) + Top Vendors & Quick Links (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Gartner TIME Capital Allocation */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">{t.executive.timeAllocationTitle}</h3>
              <p className="text-xs text-slate-500">{t.executive.timeAllocationDesc}</p>
            </div>
            <button
              onClick={() => onNavigateTab('apm')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>{t.executive.viewTimeMatrix}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 pt-1">
            {/* Invest Bar */}
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-emerald-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>INVEST</span>
                </span>
                <span className="text-slate-900">{formatEUR(apm.time_cost_distribution.Invest)} ({Math.round((apm.time_cost_distribution.Invest / (apm.total_annual_cost || 1)) * 100)}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${(apm.time_cost_distribution.Invest / (apm.total_annual_cost || 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Migrate Bar */}
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-amber-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>MIGRATE</span>
                </span>
                <span className="text-slate-900">{formatEUR(apm.time_cost_distribution.Migrate)} ({Math.round((apm.time_cost_distribution.Migrate / (apm.total_annual_cost || 1)) * 100)}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${(apm.time_cost_distribution.Migrate / (apm.total_annual_cost || 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Tolerate Bar */}
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-blue-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>TOLERATE</span>
                </span>
                <span className="text-slate-900">{formatEUR(apm.time_cost_distribution.Tolerate)} ({Math.round((apm.time_cost_distribution.Tolerate / (apm.total_annual_cost || 1)) * 100)}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(apm.time_cost_distribution.Tolerate / (apm.total_annual_cost || 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Eliminate Bar */}
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-rose-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>ELIMINATE</span>
                </span>
                <span className="text-slate-900">{formatEUR(apm.time_cost_distribution.Eliminate)} ({Math.round((apm.time_cost_distribution.Eliminate / (apm.total_annual_cost || 1)) * 100)}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{ width: `${(apm.time_cost_distribution.Eliminate / (apm.total_annual_cost || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Vendor Concentration & Quick Links */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">{t.executive.topVendorsTitle}</h3>
            <p className="text-xs text-slate-500">{t.executive.topVendorsDesc}</p>
          </div>

          <div className="space-y-2.5">
            {apm.top_vendors_by_cost.map((v, idx) => (
              <div key={v.vendor} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-slate-900">{v.vendor || t.executive.internalVendor}</span>
                </div>
                <span className="font-mono font-bold text-slate-900">{formatEUR(v.cost)}</span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => onNavigateTab('processes')}
              className="p-2.5 bg-indigo-50 text-indigo-700 font-bold rounded-xl border border-indigo-200 hover:bg-indigo-100 transition text-center"
            >
              {t.executive.goToProcesses}
            </button>
            <button
              onClick={() => onNavigateTab('overlap')}
              className="p-2.5 bg-amber-50 text-amber-800 font-bold rounded-xl border border-amber-200 hover:bg-amber-100 transition text-center"
            >
              {t.executive.goToOverlap}
            </button>
          </div>
        </div>

      </div>

      {/* ArchiMate Transition Horizons (Plateau Roadmap: As-Is -> Transition -> To-Be) */}
      {plateaus && plateaus.horizons && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
                <Milestone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Orizzonti di Transizione Architetturale (ArchiMate Plateaus & Roadmap)
                </h3>
                <p className="text-xs text-slate-500">
                  Evoluzione temporale del portfolio architetturale tra Baseline (As-Is), Plateau di Transizione e Target (To-Be)
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plateaus.horizons.map((h, idx) => {
              const borderStyles = [
                'border-slate-300 bg-slate-50/50',
                'border-amber-300 bg-amber-50/40',
                'border-emerald-300 bg-emerald-50/40'
              ][idx % 3];

              const badgeColors = [
                'bg-slate-200 text-slate-800',
                'bg-amber-100 text-amber-800',
                'bg-emerald-100 text-emerald-800'
              ][idx % 3];

              return (
                <div key={h.horizon} className={`border rounded-2xl p-4 space-y-3 ${borderStyles}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${badgeColors}`}>
                      Fase {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      {h.app_count} applicazioni
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{h.horizon}</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{h.description}</p>
                  </div>

                  {h.applications.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/60 space-y-1">
                      <div className="text-[10px] font-semibold text-slate-500 uppercase">Applicazioni Coinvolte:</div>
                      <div className="flex flex-wrap gap-1">
                        {h.applications.slice(0, 5).map((app) => (
                          <span
                            key={app.id}
                            className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-medium text-slate-800 shadow-2xs"
                          >
                            {app.name}
                          </span>
                        ))}
                        {h.applications.length > 5 && (
                          <span className="px-1.5 py-0.5 text-[10px] text-slate-500">
                            +{h.applications.length - 5} altre
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
