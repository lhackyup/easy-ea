import React, { useState, useEffect, useMemo } from 'react';
import { BusinessProcessItem } from '../../types';
import { api } from '../../lib/api';
import {
  FileText,
  AlertTriangle,
  ShieldAlert,
  GitBranch,
  GitPullRequest,
  Activity,
  Layers,
  Coins,
  Cpu
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { ProcessLineageView } from './ProcessLineageView';
import { ProcessOutageSimulatorView } from './ProcessOutageSimulatorView';
import { ProcessDecommissioningView } from './ProcessDecommissioningView';
import { ProcessRisksAuditView } from './ProcessRisksAuditView';
import { ProcessTCOView } from './ProcessTCOView';
import { ProcessAutomationView } from './ProcessAutomationView';

export type ProcessTab = 'lineage' | 'outage' | 'decommissioning' | 'risks' | 'cost' | 'automation';

interface ProcessNavigatorProps {
  modelId: string;
  initialTab?: ProcessTab;
  activeTab?: ProcessTab;
  onTabChange?: (tab: ProcessTab) => void;
}

export const ProcessNavigator: React.FC<ProcessNavigatorProps> = ({
  modelId,
  initialTab = 'lineage',
  activeTab: controlledTab,
  onTabChange
}) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const userRoles = useMemo(() => new Set((user?.assignments || []).map((a) => a.role)), [user]);
  const canViewFinancials = Boolean(userRoles.has('admin') || userRoles.has('c_level') || !user);

  const [internalTab, setInternalTab] = useState<ProcessTab>(initialTab);
  const currentTab = controlledTab !== undefined ? controlledTab : internalTab;

  const setTab = (newTab: ProcessTab) => {
    setInternalTab(newTab);
    onTabChange?.(newTab);
  };

  useEffect(() => {
    if (!canViewFinancials && currentTab === 'cost') {
      setTab('lineage');
    }
  }, [canViewFinancials, currentTab]);

  const [processes, setProcesses] = useState<BusinessProcessItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedProcess, setSelectedProcess] = useState<BusinessProcessItem | null>(null);

  // Cross-tab interaction targets
  const [simulationTargetId, setSimulationTargetId] = useState<string>('');

  const loadProcesses = async () => {
    setLoading(true);
    try {
      const res = await api.getProcessCatalog(modelId, language);
      setProcesses(res.processes);
      if (res.processes.length > 0) {
        if (!selectedProcess) {
          setSelectedProcess(res.processes[0]);
        } else {
          const updated = res.processes.find((p) => p.id === selectedProcess.id);
          if (updated) setSelectedProcess(updated);
        }
      }
    } catch (err) {
      console.error('Failed to load processes catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProcesses();
  }, [modelId, language]);

  // Handlers for cross-tab actions
  const handleSimulateImpactFromLineage = (elementId: string, mode: 'failure' | 'change') => {
    setSimulationTargetId(elementId);
    if (mode === 'failure') {
      setTab('outage');
    } else {
      setTab('decommissioning');
    }
  };

  const handleNavigateToProcessLineage = (processId: string) => {
    const target = processes.find((p) => p.id === processId);
    if (target) {
      setSelectedProcess(target);
    }
    setTab('lineage');
  };

  const handleNavigateToOutage = (elementId: string) => {
    setSimulationTargetId(elementId);
    setTab('outage');
  };

  const handleNavigateToDecom = (elementId: string) => {
    setSimulationTargetId(elementId);
    setTab('decommissioning');
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

  // Count total risks across processes for tab badge
  const totalProcessRisks = processes.reduce((acc, p) => acc + (p.risks?.length || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header: Title & Subtitle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t.processes.title}
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            {currentTab === 'lineage' && t.processes.lineageSubtitle}
            {currentTab === 'outage' && t.processes.outageSubtitle}
            {currentTab === 'decommissioning' && t.processes.decomSubtitle}
            {currentTab === 'risks' && t.processes.risksSubtitle}
            {currentTab === 'cost' && t.processes.costSubtitle}
            {currentTab === 'automation' && t.processes.automationSubtitle}
          </p>
        </div>
      </div>

      {/* Horizontal Tab Navigation Bar */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setTab('lineage')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer ${
            currentTab === 'lineage'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'
          }`}
        >
          <GitBranch className={`w-4 h-4 ${currentTab === 'lineage' ? 'text-white' : 'text-indigo-500'}`} />
          <span>{t.processes.tabLineage}</span>
        </button>

        <button
          onClick={() => setTab('outage')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer ${
            currentTab === 'outage'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-rose-600 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className={`w-4 h-4 ${currentTab === 'outage' ? 'text-white' : 'text-rose-500'}`} />
          <span>{t.processes.tabOutage}</span>
        </button>

        <button
          onClick={() => setTab('decommissioning')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer ${
            currentTab === 'decommissioning'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-amber-600 hover:bg-slate-100'
          }`}
        >
          <GitPullRequest className={`w-4 h-4 ${currentTab === 'decommissioning' ? 'text-white' : 'text-amber-500'}`} />
          <span>{t.processes.tabDecom}</span>
        </button>

        <button
          onClick={() => setTab('risks')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer ${
            currentTab === 'risks'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-indigo-900 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert className={`w-4 h-4 ${currentTab === 'risks' ? 'text-white' : 'text-amber-500'}`} />
          <span>{t.processes.tabRisks}</span>
          {totalProcessRisks > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                currentTab === 'risks'
                  ? 'bg-amber-400 text-slate-900'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {totalProcessRisks}
            </span>
          )}
        </button>

        {canViewFinancials && (
          <button
            onClick={() => setTab('cost')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer ${
              currentTab === 'cost'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-emerald-600 hover:bg-slate-100'
            }`}
          >
            <Coins className={`w-4 h-4 ${currentTab === 'cost' ? 'text-white' : 'text-emerald-500'}`} />
            <span>{t.processes.tabCost}</span>
          </button>
        )}

        <button
          onClick={() => setTab('automation')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer ${
            currentTab === 'automation'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-cyan-600 hover:bg-slate-100'
          }`}
        >
          <Cpu className={`w-4 h-4 ${currentTab === 'automation' ? 'text-white' : 'text-cyan-500'}`} />
          <span>{t.processes.tabAutomation}</span>
        </button>
      </div>

      {/* Tab Contents */}
      {currentTab === 'lineage' && (
        <ProcessLineageView
          processes={processes}
          selectedProcess={selectedProcess}
          onSelectProcess={setSelectedProcess}
          onSimulateImpact={handleSimulateImpactFromLineage}
        />
      )}

      {currentTab === 'outage' && (
        <ProcessOutageSimulatorView
          modelId={modelId}
          processes={processes}
          selectedElementId={simulationTargetId}
        />
      )}

      {currentTab === 'decommissioning' && (
        <ProcessDecommissioningView
          modelId={modelId}
          processes={processes}
          selectedElementId={simulationTargetId}
        />
      )}

      {currentTab === 'risks' && (
        <ProcessRisksAuditView
          modelId={modelId}
          processes={processes}
          onNavigateToLineage={handleNavigateToProcessLineage}
          onNavigateToOutage={handleNavigateToOutage}
          onNavigateToDecom={handleNavigateToDecom}
        />
      )}

      {currentTab === 'cost' && canViewFinancials && (
        <ProcessTCOView
          modelId={modelId}
          onNavigateToLineage={handleNavigateToProcessLineage}
          onNavigateToDecom={handleNavigateToDecom}
        />
      )}

      {currentTab === 'automation' && (
        <ProcessAutomationView
          modelId={modelId}
          onNavigateToLineage={handleNavigateToProcessLineage}
        />
      )}
    </div>
  );
};
