import React, { useState, useMemo } from 'react';
import { BusinessProcessItem } from '../../types';
import {
  FileText,
  Users,
  Server,
  ShieldAlert,
  Search,
  AlertTriangle,
  Play,
  Filter
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface ProcessLineageViewProps {
  processes: BusinessProcessItem[];
  selectedProcess: BusinessProcessItem | null;
  onSelectProcess: (process: BusinessProcessItem) => void;
  onSimulateImpact: (elementId: string, mode: 'failure' | 'change') => void;
}

export const ProcessLineageView: React.FC<ProcessLineageViewProps> = ({
  processes,
  selectedProcess,
  onSelectProcess,
  onSimulateImpact
}) => {
  const { t, interpolate } = useLanguage();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'critical' | 'spof' | 'lifecycle' | 'bpmn'>('all');

  const filteredProcesses = useMemo(() => {
    let list = processes;
    if (filterType === 'critical') {
      list = list.filter((p) => p.is_critical);
    } else if (filterType === 'spof') {
      list = list.filter((p) => p.has_spof);
    } else if (filterType === 'lifecycle') {
      list = list.filter((p) => p.has_lifecycle_risk);
    } else if (filterType === 'bpmn') {
      list = list.filter((p) => p.steps_count !== undefined && p.steps_count > 0);
    }

    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.supporting_applications.some((a) => a.name.toLowerCase().includes(q))
    );
  }, [processes, search, filterType]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Process List & Filters */}
      <div className="lg:col-span-5 space-y-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          {/* Search bar */}
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

          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 text-[11px] font-semibold text-slate-600">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                filterType === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {t.processes.filterAll} ({processes.length})
            </button>
            <button
              onClick={() => setFilterType('critical')}
              className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                filterType === 'critical'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              {t.processes.filterCritical}
            </button>
            <button
              onClick={() => setFilterType('spof')}
              className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                filterType === 'spof'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              {t.processes.filterSpof}
            </button>
            <button
              onClick={() => setFilterType('lifecycle')}
              className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                filterType === 'lifecycle'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              {t.processes.filterLifecycle}
            </button>
            <button
              onClick={() => setFilterType('bpmn')}
              className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                filterType === 'bpmn'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              {t.processes.filterBpmn}
            </button>
          </div>

          {/* Process Items */}
          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {filteredProcesses.map((proc) => {
              const isSelected = selectedProcess?.id === proc.id;
              return (
                <div
                  key={proc.id}
                  onClick={() => onSelectProcess(proc)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'bg-indigo-50/80 border-indigo-400 ring-1 ring-indigo-400/40 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">{proc.name}</h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
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
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-semibold">
                        {interpolate(t.processes.bpmnTasksCount, { count: proc.steps_count })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Selected Process Detail & Lineage Flow */}
      <div className="lg:col-span-7 space-y-6">
        {selectedProcess ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            {/* Header info */}
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
                  <span>{t.processes.processRisksTitle} ({selectedProcess.risks.length})</span>
                </div>
                <div className="space-y-1.5">
                  {selectedProcess.risks.map((rk, idx) => (
                    <div
                      key={idx}
                      className="flex items-start space-x-2 text-xs text-rose-900 bg-white p-2 rounded-lg border border-rose-200 shadow-2xs"
                    >
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          rk.severity === 'HIGH' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
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
                  {t.processes.bpmnStepsTitle} ({selectedProcess.process_steps.length})
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
                      <span
                        key={act.id}
                        className="text-xs px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg font-medium shadow-sm"
                      >
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
                </div>
                <div className="space-y-2">
                  {selectedProcess.supporting_applications.length > 0 ? (
                    selectedProcess.supporting_applications.map((app) => (
                      <div
                        key={app.id}
                        className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm"
                      >
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
                            <span>
                              {t.processes.criticalityLabel}{' '}
                              <strong className="text-slate-800 font-semibold">{app.criticality}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              {t.processes.timeLabel}{' '}
                              <strong className="text-slate-800 font-semibold">{app.time_quadrant}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => onSimulateImpact(app.id, 'failure')}
                            className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition shadow-2xs"
                          >
                            <Play className="w-3 h-3" />
                            <span>{t.processes.simulateOutageBtn}</span>
                          </button>
                          <button
                            onClick={() => onSimulateImpact(app.id, 'change')}
                            className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition shadow-2xs"
                          >
                            <Play className="w-3 h-3" />
                            <span>{t.processes.simulateDecomBtn}</span>
                          </button>
                        </div>
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
                      <div
                        key={node.id}
                        className="flex items-center space-x-2 text-xs px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-medium shadow-sm"
                      >
                        <span>{node.name}</span>
                        <div className="flex items-center space-x-1 ml-1 pl-1 border-l border-emerald-200">
                          <button
                            onClick={() => onSimulateImpact(node.id, 'failure')}
                            className="text-[10px] text-rose-600 hover:text-rose-800 font-bold"
                          >
                            {t.processes.simulateDownBtn}
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            onClick={() => onSimulateImpact(node.id, 'change')}
                            className="text-[10px] text-amber-700 hover:text-amber-900 font-bold"
                          >
                            {t.processes.simulateRetireBtn}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">{t.processes.noTech}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-400 text-xs">
            {t.processes.selectProcessHint}
          </div>
        )}
      </div>
    </div>
  );
};
