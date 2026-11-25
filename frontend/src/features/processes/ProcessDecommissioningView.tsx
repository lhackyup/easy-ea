import React, { useState, useMemo, useEffect } from 'react';
import { BusinessProcessItem, ImpactSimulationResult } from '../../types';
import { api } from '../../lib/api';
import {
  Calendar,
  Play,
  Server,
  Users,
  Database,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  FileSpreadsheet,
  AlertOctagon,
  RefreshCw,
  GitPullRequest
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface ProcessDecommissioningViewProps {
  modelId: string;
  processes: BusinessProcessItem[];
  selectedElementId?: string;
}

export const ProcessDecommissioningView: React.FC<ProcessDecommissioningViewProps> = ({
  modelId,
  processes,
  selectedElementId
}) => {
  const { t, interpolate } = useLanguage();
  const [targetAppId, setTargetAppId] = useState<string>(selectedElementId || '');
  const [maxHops, setMaxHops] = useState<number>(10);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [impactResult, setImpactResult] = useState<ImpactSimulationResult | null>(null);
  const [expandedPathElemId, setExpandedPathElemId] = useState<string | null>(null);

  // Group applications into Decommission Candidates (Eliminate / Phase-out / Retired) and Other Apps
  const { candidateApps, otherApps } = useMemo(() => {
    const appsMap = new Map<
      string,
      {
        id: string;
        name: string;
        criticality: string;
        cost: number;
        time_quadrant: string;
        lifecycle_status?: string;
      }
    >();

    processes.forEach((p) => {
      p.supporting_applications.forEach((a) => {
        if (!appsMap.has(a.id)) {
          appsMap.set(a.id, a);
        }
      });
    });

    const all = Array.from(appsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const candidates = all.filter(
      (a) =>
        a.time_quadrant === 'Eliminate' ||
        a.time_quadrant === 'Migrate' ||
        a.lifecycle_status === 'Phase-out' ||
        a.lifecycle_status === 'Retired'
    );
    const others = all.filter(
      (a) =>
        a.time_quadrant !== 'Eliminate' &&
        a.time_quadrant !== 'Migrate' &&
        a.lifecycle_status !== 'Phase-out' &&
        a.lifecycle_status !== 'Retired'
    );

    return { candidateApps: candidates, otherApps: others };
  }, [processes]);

  useEffect(() => {
    if (selectedElementId) {
      setTargetAppId(selectedElementId);
      handleSimulate(selectedElementId);
    } else if (!targetAppId) {
      if (candidateApps.length > 0) {
        setTargetAppId(candidateApps[0].id);
      } else if (otherApps.length > 0) {
        setTargetAppId(otherApps[0].id);
      }
    }
  }, [selectedElementId, candidateApps, otherApps]);

  const handleSimulate = async (elemIdToSimulate?: string) => {
    const id = elemIdToSimulate || targetAppId;
    if (!id) return;
    setSimulating(true);
    try {
      const res = await api.simulateImpact(modelId, id, 'change', maxHops);
      setImpactResult(res);
    } catch (err) {
      console.error('Decommissioning impact simulation failed:', err);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Target Application & Configuration Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="p-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
                <GitPullRequest className="w-4 h-4" />
              </span>
              <span>{t.processes.selectDecomTarget}</span>
            </h3>
            <p className="text-xs text-slate-500">
              {t.processes.decomSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-600">{t.processes.maxHopsLabel}</span>
              <select
                value={maxHops}
                onChange={(e) => setMaxHops(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
              >
                <option value={3}>3 Hop</option>
                <option value={5}>5 Hop</option>
                <option value={10}>10 Hop</option>
                <option value={15}>15 Hop</option>
              </select>
            </div>

            <button
              onClick={() => handleSimulate()}
              disabled={simulating || !targetAppId}
              className="flex items-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              {simulating ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>{t.processes.runSimulationBtn}</span>
            </button>
          </div>
        </div>

        {/* Application Selector with Optgroup */}
        <div className="pt-2">
          <select
            value={targetAppId}
            onChange={(e) => setTargetAppId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white"
          >
            {candidateApps.length > 0 && (
              <optgroup label={t.processes.candidateAppsTitle}>
                {candidateApps.map((app) => (
                  <option key={app.id} value={app.id}>
                    ⚠️ {app.name} — TIME: {app.time_quadrant} | Status: {app.lifecycle_status || 'Active'}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={t.processes.allAppsTitle}>
              {otherApps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name} — TIME: {app.time_quadrant} | {t.processes.criticalityLabel} {app.criticality}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* Simulation Results */}
      {simulating ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs font-semibold text-slate-600">{t.processes.simulating}</p>
        </div>
      ) : impactResult ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          {/* Header Summary Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-amber-50/70 border border-amber-200 rounded-xl">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-amber-100 rounded-xl text-amber-800">
                <GitPullRequest className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {interpolate(t.processes.impactResultTitle, { name: impactResult.source_element.name })}
                </h4>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-amber-800 font-medium">
                  <span>{t.processes.modeLabel} <strong className="font-bold">{t.processes.modeChange}</strong></span>
                </div>
              </div>
            </div>

            {impactResult.blast_radius && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-500">{t.processes.blastRadiusScore}</div>
                  <div className="text-lg font-black text-amber-800">
                    {impactResult.blast_radius.score} pts
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-xl text-xs font-extrabold uppercase border ${
                    impactResult.blast_radius.severity === 'HIGH'
                      ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                      : impactResult.blast_radius.severity === 'MEDIUM'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  }`}
                >
                  {impactResult.blast_radius.severity === 'HIGH'
                    ? t.processes.severityHigh
                    : impactResult.blast_radius.severity === 'MEDIUM'
                    ? t.processes.severityMedium
                    : t.processes.severityLow}
                </span>
              </div>
            )}
          </div>

          {/* 4 Metric KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-2xl font-black text-rose-600">
                {impactResult.impact_summary.total_impacted_processes}
              </div>
              <div className="text-[11px] text-slate-600 uppercase font-bold mt-1">
                {t.processes.blockedProcesses}
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-2xl font-black text-amber-600">
                {impactResult.impact_summary.total_impacted_applications}
              </div>
              <div className="text-[11px] text-slate-600 uppercase font-bold mt-1">
                {t.processes.impactedSystems}
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-2xl font-black text-indigo-600">
                {impactResult.impact_summary.total_impacted_data_objects || 0}
              </div>
              <div className="text-[11px] text-slate-600 uppercase font-bold mt-1">
                {t.processes.impactedDataTitle}
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-2xl font-black text-blue-600">
                {impactResult.impact_summary.total_impacted_stakeholders}
              </div>
              <div className="text-[11px] text-slate-600 uppercase font-bold mt-1">
                {t.processes.involvedRoles}
              </div>
            </div>
          </div>

          {/* Architectural Recommendations Box for Decommissioning */}
          <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2.5">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-indigo-700" />
              <span>{t.processes.decomRecommendationsTitle}</span>
            </h4>
            <ul className="text-xs text-indigo-950 space-y-1.5 list-disc list-inside">
              <li>
                <span className="font-semibold">{t.processes.decomRecProcesses}:</span>{' '}
                {impactResult.impact_summary.total_impacted_processes > 0
                  ? interpolate(t.processes.decomImpactedProcessesSummary, { count: impactResult.impact_summary.total_impacted_processes })
                  : t.processes.decomNoImpactedProcesses}
              </li>
              <li>
                <span className="font-semibold">{t.processes.decomRecData}:</span>{' '}
                {t.processes.decomRecData}
              </li>
              <li>
                <span className="font-semibold">{t.processes.decomRecTeams}:</span>{' '}
                {t.processes.decomRecTeams}
              </li>
              <li>
                <span className="font-semibold">{t.processes.decomRecContinuity}</span>
              </li>
            </ul>
          </div>

          {/* Impacted Processes with Hop & Path Inspection */}
          {impactResult.impacted_processes.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-amber-600" />
                <span>{interpolate(t.processes.decomProcessesToMigrateTitle, { count: impactResult.impacted_processes.length })}</span>
              </h4>
              <div className="space-y-2">
                {impactResult.impacted_processes.map((proc) => {
                  const isExpanded = expandedPathElemId === proc.id;
                  return (
                    <div
                      key={proc.id}
                      className="p-3.5 bg-white border border-amber-200/80 rounded-xl space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Hop {proc.hop_distance || 1}
                          </span>
                          <span className="font-bold text-xs text-slate-900">{proc.name}</span>
                          <span className="text-[10px] text-slate-400">({proc.type})</span>
                        </div>
                        {proc.path && proc.path.length > 1 && (
                          <button
                            onClick={() => setExpandedPathElemId(isExpanded ? null : proc.id)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                          >
                            {isExpanded ? t.processes.hidePath : t.processes.showPath}
                          </button>
                        )}
                      </div>

                      {/* Path visualization */}
                      {isExpanded && proc.path && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2 mt-2">
                          <div className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">
                            {t.processes.criticalChainLabel}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {proc.path.map((step, idx) => (
                              <React.Fragment key={idx}>
                                <div className="px-2.5 py-1 bg-white border border-slate-200 rounded-md shadow-2xs text-[11px] font-semibold text-slate-800">
                                  <span>{step.name}</span>
                                  <span className="text-[9px] text-slate-400 ml-1">({step.type})</span>
                                </div>
                                {idx < (proc.path?.length || 0) - 1 && (
                                  <ArrowRight className="w-3.5 h-3.5 text-amber-600 font-bold" />
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{t.processes.noImpactDetected}</span>
            </div>
          )}

          {/* Impacted Applications */}
          {impactResult.impacted_applications.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {t.processes.impactedAppsTitle}
              </h4>
              <div className="flex flex-wrap gap-2">
                {impactResult.impacted_applications.map((app) => (
                  <span
                    key={app.id}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs font-semibold shadow-2xs"
                  >
                    <span>{app.name}</span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-200/60 px-1.5 py-0.2 rounded">
                      Hop {app.hop_distance || 1}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Impacted Data Objects */}
          {impactResult.impacted_data_objects && impactResult.impacted_data_objects.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {t.processes.impactedDataTitle}
              </h4>
              <div className="flex flex-wrap gap-2">
                {impactResult.impacted_data_objects.map((data) => (
                  <span
                    key={data.id}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-semibold shadow-2xs"
                  >
                    <Database className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{data.name}</span>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-200/60 px-1.5 py-0.2 rounded">
                      Hop {data.hop_distance || 1}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Impacted Stakeholders */}
          {impactResult.impacted_stakeholders && impactResult.impacted_stakeholders.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {t.processes.stakeholdersTitle}
              </h4>
              <div className="flex flex-wrap gap-2">
                {impactResult.impacted_stakeholders.map((act) => (
                  <span
                    key={act.id}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-xl text-xs font-semibold shadow-2xs"
                  >
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>{act.name}</span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-200/60 px-1.5 py-0.2 rounded">
                      Hop {act.hop_distance || 1}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-400 text-xs">
          {t.processes.selectElementHint}
        </div>
      )}
    </div>
  );
};
