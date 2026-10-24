import React, { useState, useEffect } from 'react';
import { BusinessProcessItem, ImpactSimulationResult, ArchitecturalRisksReport } from '../../types';
import { api } from '../../lib/api';
import {
  FileText,
  Users,
  Server,
  ShieldAlert,
  Search,
  AlertTriangle,
  Play,
  Activity,
  Layers,
  Database,
  GitBranch,
  ShieldCheck,
  CheckCircle2,
  X
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface ProcessNavigatorProps {
  modelId: string;
}

export const ProcessNavigator: React.FC<ProcessNavigatorProps> = ({ modelId }) => {
  const { t, interpolate } = useLanguage();
  const [processes, setProcesses] = useState<BusinessProcessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProcess, setSelectedProcess] = useState<BusinessProcessItem | null>(null);

  // Impact simulation state
  const [simulationMode, setSimulationMode] = useState<'failure' | 'change'>('failure');
  const [impactElementId, setImpactElementId] = useState<string>('');
  const [impactResult, setImpactResult] = useState<ImpactSimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [expandedPathElemId, setExpandedPathElemId] = useState<string | null>(null);

  // Architectural Risk Audit state
  const [risksReport, setRisksReport] = useState<ArchitecturalRisksReport | null>(null);
  const [showRisksModal, setShowRisksModal] = useState(false);
  const [loadingRisks, setLoadingRisks] = useState(false);

  const loadProcesses = async () => {
    setLoading(true);
    try {
      const res = await api.getProcessCatalog(modelId);
      setProcesses(res.processes);
      if (res.processes.length > 0 && !selectedProcess) {
        setSelectedProcess(res.processes[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProcesses();
  }, [modelId]);

  const handleSimulateImpact = async (elemId: string, modeOverride?: 'failure' | 'change') => {
    if (!elemId) return;
    const mode = modeOverride || simulationMode;
    setSimulating(true);
    setImpactElementId(elemId);
    try {
      const res = await api.simulateImpact(modelId, elemId, mode, 10);
      setImpactResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(false);
    }
  };

  const handleOpenRisksModal = async () => {
    setShowRisksModal(true);
    if (!risksReport) {
      setLoadingRisks(true);
      try {
        const rep = await api.getArchitecturalRisks(modelId);
        setRisksReport(rep);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingRisks(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">{t.processes.loading}</p>
        </div>
      </div>
    );
  }

  const filteredProcesses = processes.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.supporting_applications.some((a) => a.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Title & Info & Audit Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t.processes.title}</h2>
          <p className="text-xs text-slate-600 mt-1">
            {t.processes.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenRisksModal}
            className="flex items-center space-x-2 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition shadow-xs"
          >
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Audit Rischi & SPOF</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Process List (Left) + Detail & Impact (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Process List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={t.processes.searchProcess}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredProcesses.map((proc) => {
                const isSelected = selectedProcess?.id === proc.id;
                return (
                  <div
                    key={proc.id}
                    onClick={() => setSelectedProcess(proc)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-400 ring-1 ring-indigo-400/40 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
                          <FileText className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-900">{proc.name}</h4>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {proc.has_spof && (
                          <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                            SPOF
                          </span>
                        )}
                        {proc.has_lifecycle_risk && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            Lifecycle
                          </span>
                        )}
                        {proc.is_critical && (
                          <span className="flex items-center space-x-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            <ShieldAlert className="w-3 h-3" />
                            <span>{t.processes.criticalBadge}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2 font-medium">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {interpolate(t.processes.actorsCount, { count: proc.actors.length })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Server className="w-3.5 h-3.5 text-slate-400" />
                        {interpolate(t.processes.appsDependentCount, { count: proc.supporting_applications.length })}
                      </span>
                      {proc.steps_count !== undefined && proc.steps_count > 0 && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          {proc.steps_count} task BPMN
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Process Detail & Lineage + Impact Simulation */}
        <div className="lg:col-span-7 space-y-6">
          {selectedProcess ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              
              {/* Process Header */}
              <div className="border-b border-slate-100 pb-4 flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    {selectedProcess.type}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1.5">{selectedProcess.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedProcess.documentation || t.processes.noDocumentation}
                  </p>
                </div>
              </div>

              {/* Architectural Risks Diagnostic (if detected on this process) */}
              {selectedProcess.risks && selectedProcess.risks.length > 0 && (
                <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Diagnostica Rischi Architetturali & SPOF ({selectedProcess.risks.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedProcess.risks.map((rk, idx) => (
                      <div key={idx} className="flex items-start space-x-2 text-xs text-rose-900 bg-white p-2 rounded-lg border border-rose-200 shadow-2xs">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          rk.severity === 'HIGH' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {rk.type}
                        </span>
                        <span className="flex-1 text-[11px] font-medium leading-relaxed">{rk.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Composed BPMN Operational Steps (if any) */}
              {selectedProcess.process_steps && selectedProcess.process_steps.length > 0 && (
                <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                    Attività / Task Operativi del Processo ({selectedProcess.process_steps.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProcess.process_steps.map((step) => (
                      <span
                        key={step.id}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 shadow-xs"
                      >
                        <span>{step.name}</span>
                        {step.bpmn_tag && (
                          <span className="text-[9px] font-mono text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                            {step.bpmn_tag}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Simulation Mode Bar */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-700">Modalità Simulazione Impatto:</span>
                </div>
                <div className="inline-flex rounded-lg p-0.5 bg-slate-200">
                  <button
                    onClick={() => {
                      setSimulationMode('failure');
                      if (impactElementId) handleSimulateImpact(impactElementId, 'failure');
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                      simulationMode === 'failure'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Guasto Operativo (Outage)
                  </button>
                  <button
                    onClick={() => {
                      setSimulationMode('change');
                      if (impactElementId) handleSimulateImpact(impactElementId, 'change');
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                      simulationMode === 'change'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Modifica / Decommission
                  </button>
                </div>
              </div>

              {/* End-to-End Lineage Flow */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t.processes.lineageTitle}
                </h4>

                {/* Layer 1: Actors */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="text-[11px] font-bold text-slate-600 uppercase mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t.processes.stakeholdersTitle}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedProcess.actors.length > 0 ? (
                      selectedProcess.actors.map((act) => (
                        <span key={act.id} className="text-xs px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg font-medium shadow-sm">
                          {act.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">{t.processes.noActors}</span>
                    )}
                  </div>
                </div>

                {/* Layer 2: Supporting Applications */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="text-[11px] font-bold text-slate-600 uppercase mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{t.processes.supportingAppsTitle}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Clicca per simulare {simulationMode === 'failure' ? 'guasto' : 'decommission'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {selectedProcess.supporting_applications.length > 0 ? (
                      selectedProcess.supporting_applications.map((app) => (
                        <div key={app.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-slate-900">{app.name}</span>
                              {app.lifecycle_status && app.lifecycle_status !== 'Live' && (
                                <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                  {app.lifecycle_status}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 mt-0.5 text-[10px] text-slate-500">
                              <span>{t.processes.criticalityLabel} <strong className="text-slate-800 font-semibold">{app.criticality}</strong></span>
                              <span>•</span>
                              <span>{t.processes.timeLabel} <strong className="text-slate-800 font-semibold">{app.time_quadrant}</strong></span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSimulateImpact(app.id)}
                            className={`flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold rounded-lg transition shadow-sm ${
                              simulationMode === 'failure'
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            <Play className="w-3 h-3" />
                            <span>{simulationMode === 'failure' ? 'Simula Outage' : 'Simula Decommission'}</span>
                          </button>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">{t.processes.noApps}</span>
                    )}
                  </div>
                </div>

                {/* Layer 3: Underlying Technology */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="text-[11px] font-bold text-slate-600 uppercase mb-2 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t.processes.infrastructureTitle}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedProcess.infrastructure_nodes.length > 0 ? (
                      selectedProcess.infrastructure_nodes.map((node) => (
                        <div key={node.id} className="flex items-center space-x-2 text-xs px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-medium shadow-sm">
                          <span>{node.name}</span>
                          <button
                            onClick={() => handleSimulateImpact(node.id)}
                            className="text-[10px] text-rose-600 hover:text-rose-800 underline font-bold ml-1"
                          >
                            {simulationMode === 'failure' ? 'Simula Down' : 'Simula Ritiro'}
                          </button>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">{t.processes.noTech}</span>
                    )}
                  </div>
                </div>

              </div>

              {/* What-If Impact Simulation Panel (Multi-Hop Semantic Blast Radius) */}
              {impactResult && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-rose-800">
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                      <div>
                        <h4 className="text-sm font-bold text-rose-900">
                          {interpolate(t.processes.impactResultTitle, { name: impactResult.source_element.name })}
                        </h4>
                        <div className="text-[10px] text-rose-700 font-semibold flex items-center gap-2 mt-0.5">
                          <span>Modalità: <strong>{impactResult.simulation_mode === 'failure' ? 'Outage Operativo' : 'Modifica / Ritiro'}</strong></span>
                          {impactResult.blast_radius && (
                            <>
                              <span>•</span>
                              <span>Blast Radius: <strong className="uppercase">{impactResult.blast_radius.severity}</strong> ({impactResult.blast_radius.score} pts)</span>
                              <span>•</span>
                              <span>Profondità Massima: <strong>{impactResult.blast_radius.max_hop_reached} Hop</strong></span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setImpactResult(null)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      {t.processes.closeBtn}
                    </button>
                  </div>

                  {/* 4 Summary Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="bg-white p-2.5 rounded-xl border border-rose-200 shadow-sm">
                      <div className="text-xl font-black text-rose-600">
                        {impactResult.impact_summary.total_impacted_processes}
                      </div>
                      <div className="text-[10px] text-slate-600 uppercase font-bold mt-0.5">{t.processes.blockedProcesses}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-rose-200 shadow-sm">
                      <div className="text-xl font-black text-amber-600">
                        {impactResult.impact_summary.total_impacted_applications}
                      </div>
                      <div className="text-[10px] text-slate-600 uppercase font-bold mt-0.5">{t.processes.impactedSystems}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-rose-200 shadow-sm">
                      <div className="text-xl font-black text-emerald-600">
                        {impactResult.impact_summary.total_impacted_infrastructure || 0}
                      </div>
                      <div className="text-[10px] text-slate-600 uppercase font-bold mt-0.5">Nodi Tech</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-rose-200 shadow-sm">
                      <div className="text-xl font-black text-blue-600">
                        {impactResult.impact_summary.total_impacted_stakeholders}
                      </div>
                      <div className="text-[10px] text-slate-600 uppercase font-bold mt-0.5">{t.processes.involvedRoles}</div>
                    </div>
                  </div>

                  {/* Impacted Processes with Hop & Path inspection */}
                  {impactResult.impacted_processes.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-800 block">{t.processes.downProcessesList}</span>
                      <div className="space-y-1.5">
                        {impactResult.impacted_processes.map((p) => {
                          const isPathExpanded = expandedPathElemId === p.id;
                          return (
                            <div key={p.id} className="p-2 bg-white border border-rose-200 rounded-lg text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    Hop {p.hop_distance || 1}
                                  </span>
                                  <span className="font-bold text-slate-900">{p.name}</span>
                                </div>
                                {p.path && p.path.length > 1 && (
                                  <button
                                    onClick={() => setExpandedPathElemId(isPathExpanded ? null : p.id)}
                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold underline"
                                  >
                                    {isPathExpanded ? 'Nascondi Percorso' : 'Vedi Percorso di Propagazione'}
                                  </button>
                                )}
                              </div>

                              {isPathExpanded && p.path && (
                                <div className="p-2 bg-slate-50 border border-slate-200 rounded mt-1.5 text-[11px] space-y-1">
                                  <div className="font-semibold text-slate-500 uppercase text-[9px]">Catena Critica:</div>
                                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                                    {p.path.map((step, idx) => (
                                      <React.Fragment key={idx}>
                                        <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-800 font-semibold">
                                          {step.name} ({step.type})
                                        </span>
                                        {idx < (p.path?.length || 0) - 1 && (
                                          <span className="text-rose-600 font-bold">➔</span>
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
                  )}

                  {/* Impacted Applications */}
                  {impactResult.impacted_applications.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-800 block">Applicazioni Coinvolte nella Catena:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {impactResult.impacted_applications.map((app) => (
                          <span
                            key={app.id}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs font-semibold"
                          >
                            <span>{app.name}</span>
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-200/60 px-1 py-0.2 rounded">
                              Hop {app.hop_distance || 1}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          ) : (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-400 text-xs">
              {t.processes.selectProcessHint}
            </div>
          )}
        </div>

      </div>

      {/* Model-Wide Architectural Risk & SPOF Audit Modal */}
      {showRisksModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-50 rounded-xl text-amber-600 border border-amber-200">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Audit Rischi Architetturali & SPOF</h3>
                  <p className="text-xs text-slate-500">Rilevamento automatico colli di bottiglia, disallineamenti di SLA e componenti a fine vita</p>
                </div>
              </div>
              <button
                onClick={() => setShowRisksModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingRisks ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : risksReport ? (
              <div className="space-y-5">
                {/* Score bar */}
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-xl font-black text-slate-900">{risksReport.summary.total_risks}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold mt-0.5">Totale Rilievi</div>
                  </div>
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                    <div className="text-xl font-black text-rose-700">{risksReport.summary.spof_count}</div>
                    <div className="text-[10px] text-rose-700 uppercase font-bold mt-0.5">SPOF Critici</div>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="text-xl font-black text-amber-700">{risksReport.summary.lifecycle_risks_count}</div>
                    <div className="text-[10px] text-amber-700 uppercase font-bold mt-0.5">Rischi Lifecycle</div>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="text-xl font-black text-blue-700">{risksReport.summary.sla_risks_count}</div>
                    <div className="text-[10px] text-blue-700 uppercase font-bold mt-0.5">SLA Mismatches</div>
                  </div>
                </div>

                {/* SPOF List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Punti Singoli di Concentrazione / Fallimento (SPOF)
                  </h4>
                  {risksReport.spof_risks.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {risksReport.spof_risks.map((spof, idx) => (
                        <div key={idx} className="p-3 bg-rose-50/60 border border-rose-200 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-rose-900">{spof.element_name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-200 text-rose-800">
                              {spof.severity}
                            </span>
                          </div>
                          <p className="text-slate-700 text-[11px] leading-relaxed">{spof.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Nessun Single Point of Failure rilevato nei percorsi critici.</span>
                    </div>
                  )}
                </div>

                {/* Lifecycle Risks */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Incompatibilità con Ciclo di Vita (TIME & Decommission)
                  </h4>
                  {risksReport.lifecycle_risks.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {risksReport.lifecycle_risks.map((lc, idx) => (
                        <div key={idx} className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs space-y-1">
                          <div className="font-bold text-amber-900">{lc.process_name}</div>
                          <p className="text-slate-700 text-[11px] leading-relaxed">{lc.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Nessuna dipendenza da componenti in dismissione/ritiro.</span>
                    </div>
                  )}
                </div>

              </div>
            ) : null}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowRisksModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
