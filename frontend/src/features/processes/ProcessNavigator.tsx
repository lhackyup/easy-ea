import React, { useState, useEffect } from 'react';
import { BusinessProcessItem, ImpactSimulationResult } from '../../types';
import { api } from '../../lib/api';
import { FileText, Users, Server, ShieldAlert, Zap, Search, AlertTriangle, ArrowRight, Play } from 'lucide-react';
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

  // Impact simulation
  const [impactElementId, setImpactElementId] = useState<string>('');
  const [impactResult, setImpactResult] = useState<ImpactSimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);

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

  const handleSimulateImpact = async (elemId: string) => {
    if (!elemId) return;
    setSimulating(true);
    setImpactElementId(elemId);
    try {
      const res = await api.simulateImpact(modelId, elemId);
      setImpactResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(false);
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
      {/* Title & Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t.processes.title}</h2>
          <p className="text-xs text-slate-600 mt-1">
            {t.processes.subtitle}
          </p>
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
                      {proc.is_critical && (
                        <span className="flex items-center space-x-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          <ShieldAlert className="w-3 h-3" />
                          <span>{t.processes.criticalBadge}</span>
                        </span>
                      )}
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
                    <span className="text-[10px] text-slate-500 font-normal">{t.processes.simulateOutageHint}</span>
                  </div>
                  <div className="space-y-2">
                    {selectedProcess.supporting_applications.length > 0 ? (
                      selectedProcess.supporting_applications.map((app) => (
                        <div key={app.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                          <div>
                            <span className="text-xs font-bold text-slate-900">{app.name}</span>
                            <div className="flex items-center space-x-2 mt-0.5 text-[10px] text-slate-500">
                              <span>{t.processes.criticalityLabel} <strong className="text-slate-800 font-semibold">{app.criticality}</strong></span>
                              <span>•</span>
                              <span>{t.processes.timeLabel} <strong className="text-slate-800 font-semibold">{app.time_quadrant}</strong></span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSimulateImpact(app.id)}
                            className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition shadow-sm"
                          >
                            <Play className="w-3 h-3" />
                            <span>{t.processes.simulateOutageBtn}</span>
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
                            {t.processes.testBtn}
                          </button>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">{t.processes.noTech}</span>
                    )}
                  </div>
                </div>

              </div>

              {/* What-If Impact Simulation Panel */}
              {impactResult && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-rose-800">
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                      <h4 className="text-sm font-bold text-rose-900">
                        {interpolate(t.processes.impactResultTitle, { name: impactResult.source_element.name })}
                      </h4>
                    </div>
                    <button
                      onClick={() => setImpactResult(null)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      {t.processes.closeBtn}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
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
                      <div className="text-xl font-black text-blue-600">
                        {impactResult.impact_summary.total_impacted_stakeholders}
                      </div>
                      <div className="text-[10px] text-slate-600 uppercase font-bold mt-0.5">{t.processes.involvedRoles}</div>
                    </div>
                  </div>

                  {impactResult.impacted_processes.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-slate-800 block mb-1.5">{t.processes.downProcessesList}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {impactResult.impacted_processes.map((p) => (
                          <span key={p.id} className="text-[11px] px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded font-semibold">
                            {p.name}
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
    </div>
  );
};

