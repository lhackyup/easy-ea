import React, { useState, useEffect } from 'react';
import { ArchitecturalRisksReport, BusinessProcessItem } from '../../types';
import { api } from '../../lib/api';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Play,
  ArrowRight,
  Filter,
  Server,
  Activity,
  Layers,
  Clock,
  Sparkles
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface ProcessRisksAuditViewProps {
  modelId: string;
  processes: BusinessProcessItem[];
  onNavigateToLineage: (processId: string) => void;
  onNavigateToOutage: (elementId: string) => void;
  onNavigateToDecom: (elementId: string) => void;
}

export const ProcessRisksAuditView: React.FC<ProcessRisksAuditViewProps> = ({
  modelId,
  processes,
  onNavigateToLineage,
  onNavigateToOutage,
  onNavigateToDecom
}) => {
  const { t, interpolate, language } = useLanguage();
  const [report, setReport] = useState<ArchitecturalRisksReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'spof' | 'lifecycle' | 'sla'>('all');

  const loadRisks = async () => {
    setLoading(true);
    try {
      const rep = await api.getArchitecturalRisks(modelId, language);
      setReport(rep);
    } catch (err) {
      console.error('Failed to load architectural risks audit:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRisks();
  }, [modelId, language]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-600">{t.processes.loading}</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center text-xs text-slate-500 shadow-sm">
        {t.processes.noRisksFound}
      </div>
    );
  }

  const showSpof = categoryFilter === 'all' || categoryFilter === 'spof';
  const showLifecycle = categoryFilter === 'all' || categoryFilter === 'lifecycle';
  const showSla = categoryFilter === 'all' || categoryFilter === 'sla';

  return (
    <div className="space-y-6">
      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-black text-slate-900">{report.summary.total_risks}</div>
          <div className="text-[11px] text-slate-600 uppercase font-bold mt-1">{t.processes.totalFindings}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm">
          <div className="text-2xl font-black text-rose-700">{report.summary.spof_count}</div>
          <div className="text-[11px] text-rose-700 uppercase font-bold mt-1">{t.processes.criticalSpofs}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
          <div className="text-2xl font-black text-amber-700">{report.summary.lifecycle_risks_count}</div>
          <div className="text-[11px] text-amber-700 uppercase font-bold mt-1">{t.processes.lifecycleRisks}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-sm">
          <div className="text-2xl font-black text-blue-700">{report.summary.sla_risks_count}</div>
          <div className="text-[11px] text-blue-700 uppercase font-bold mt-1">{t.processes.slaMismatches}</div>
        </div>
      </div>

      {/* Category Filter Toolbar */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {t.processes.categoryAll} ({report.summary.total_risks})
          </button>
          <button
            onClick={() => setCategoryFilter('spof')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              categoryFilter === 'spof'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            {t.processes.categorySpof} ({report.summary.spof_count})
          </button>
          <button
            onClick={() => setCategoryFilter('lifecycle')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              categoryFilter === 'lifecycle'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            {t.processes.categoryLifecycle} ({report.summary.lifecycle_risks_count})
          </button>
          <button
            onClick={() => setCategoryFilter('sla')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              categoryFilter === 'sla'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            {t.processes.categorySla} ({report.summary.sla_risks_count})
          </button>
        </div>

        <button
          onClick={loadRisks}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          {t.processes.refreshAudit}
        </button>
      </div>

      {/* SPOF Section */}
      {showSpof && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="p-1.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-600">
                <ShieldAlert className="w-4 h-4" />
              </span>
              <span>{t.processes.spofSectionTitle} ({report.spof_risks.length})</span>
            </h4>
          </div>

          {report.spof_risks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.spof_risks.map((spof, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-rose-50/50 border border-rose-200 rounded-xl space-y-3 flex flex-col justify-between shadow-2xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-rose-950">{spof.element_name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-200 text-rose-800 border border-rose-300">
                        {spof.severity}
                      </span>
                    </div>
                    <div className="text-[10px] text-rose-700 font-semibold">{spof.element_type}</div>
                    <p className="text-slate-700 text-xs leading-relaxed">{spof.message}</p>
                  </div>

                  <div className="pt-2 border-t border-rose-200/60 flex items-center justify-end gap-2">
                    <button
                      onClick={() => onNavigateToOutage(spof.element_id)}
                      className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition shadow-2xs cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>{t.processes.actionSimulateOutage}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{t.processes.noSpofRisks}</span>
            </div>
          )}
        </div>
      )}

      {/* Lifecycle Risks Section */}
      {showLifecycle && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="p-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <span>{t.processes.lifecycleSectionTitle} ({report.lifecycle_risks.length})</span>
            </h4>
          </div>

          {report.lifecycle_risks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.lifecycle_risks.map((lc, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-3 flex flex-col justify-between shadow-2xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-amber-950">{lc.process_name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-200 text-amber-900 border border-amber-300">
                        Lifecycle Risk
                      </span>
                    </div>
                    <p className="text-slate-700 text-xs leading-relaxed">{lc.message}</p>
                  </div>

                  <div className="pt-2 border-t border-amber-200/60 flex items-center justify-end gap-2">
                    {lc.process_id && (
                      <button
                        onClick={() => onNavigateToLineage(lc.process_id)}
                        className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition shadow-2xs cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                        <span>{t.processes.actionViewLineage}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{t.processes.noLifecycleRisks}</span>
            </div>
          )}
        </div>
      )}

      {/* SLA Gaps Section */}
      {showSla && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
                <Clock className="w-4 h-4" />
              </span>
              <span>{t.processes.slaSectionTitle} ({report.sla_risks.length})</span>
            </h4>
          </div>

          {report.sla_risks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.sla_risks.map((sla, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3 flex flex-col justify-between shadow-2xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-blue-950">{sla.process_name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-200 text-blue-900 border border-blue-300">
                        {sla.severity}
                      </span>
                    </div>
                    <p className="text-slate-700 text-xs leading-relaxed">{sla.message}</p>
                  </div>

                  <div className="pt-2 border-t border-blue-200/60 flex items-center justify-end gap-2">
                    {sla.process_id && (
                      <button
                        onClick={() => onNavigateToLineage(sla.process_id)}
                        className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition shadow-2xs cursor-pointer"
                      >
                        <span>{t.processes.actionViewLineage}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{t.processes.noSlaRisks}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
