import React, { useState, useEffect } from 'react';
import { UserOwnedApplication, UserOwnedProcess, UserSurveyTask } from '../../types';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { SurveyWizardModal } from './SurveyWizardModal';
import {
  Layers,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  Search,
  ChevronRight,
  TrendingUp,
  Building,
  Workflow,
  Cpu,
  Activity
} from 'lucide-react';

interface OwnerDashboardProps {
  selectedModelId: string;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ selectedModelId }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownedApps, setOwnedApps] = useState<UserOwnedApplication[]>([]);
  const [ownedProcesses, setOwnedProcesses] = useState<UserOwnedProcess[]>([]);
  const [surveys, setSurveys] = useState<UserSurveyTask[]>([]);
  const [activeTab, setActiveTab] = useState<'apps' | 'processes'>('apps');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeScopeIdForWizard, setActiveScopeIdForWizard] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedModelId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [appsData, processesData, surveysData] = await Promise.all([
        api.getMyApplications(selectedModelId),
        api.getMyProcesses(selectedModelId),
        api.getMySurveys(selectedModelId)
      ]);
      setOwnedApps(appsData);
      setOwnedProcesses(processesData);
      setSurveys(surveysData);
      if (appsData.length === 0 && processesData.length > 0) {
        setActiveTab('processes');
      }
    } catch (err: any) {
      setError(err.message || 'Errore nel caricamento dei dati di ownership');
    } finally {
      setLoading(false);
    }
  };

  const pendingSurveysCount = surveys.filter(
    (s) => s.status === 'pending' || s.status === 'in_progress' || s.status === 'rejected'
  ).length;

  const filteredApps = ownedApps.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProcesses = ownedProcesses.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-teal-800 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm text-blue-100 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              {t.surveys.ownerPortalTitle}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t.surveys.ownerPortalTitle} — {user?.full_name || user?.username}
            </h1>
            <p className="text-blue-100 text-sm mt-1 max-w-2xl">
              {t.surveys.ownerPortalSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-sm px-4 py-3 rounded-xl border border-white/20 text-center">
              <span className="block text-2xl font-black">{ownedApps.length}</span>
              <span className="text-xs text-blue-200">{t.surveys.myApps}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm px-4 py-3 rounded-xl border border-white/20 text-center">
              <span className="block text-2xl font-black text-teal-300">{ownedProcesses.length}</span>
              <span className="text-xs text-blue-200">{t.surveys.myProcesses}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm px-4 py-3 rounded-xl border border-white/20 text-center">
              <span className="block text-2xl font-black text-amber-300">{pendingSurveysCount}</span>
              <span className="text-xs text-blue-200">{t.surveys.pendingSurveys}</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SECTION 1: Pending Surveys Banner / List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            {t.surveys.mySurveys} ({surveys.length})
          </h2>
        </div>

        {surveys.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
            <h3 className="text-base font-bold text-slate-700">{t.surveys.allUpToDateTitle}</h3>
            <p className="text-sm text-slate-500 mt-1">{t.surveys.noSurveysPending}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {surveys.map((s) => {
              const isUrgent = s.status === 'pending' || s.status === 'rejected';
              const isProcessSurvey = s.sections?.includes('process_general') || s.sections?.includes('process_performance');
              return (
                <div
                  key={s.scope_id}
                  className={`bg-white rounded-2xl border transition-all p-5 shadow-sm flex flex-col justify-between ${
                    isUrgent ? 'border-amber-300 hover:border-amber-400 bg-amber-50/20' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {s.campaign_title}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isProcessSurvey ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-slate-100 text-slate-600'}`}>
                          {isProcessSurvey ? t.surveys.processScopeBadge : t.surveys.appScopeBadge}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          s.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : s.status === 'submitted'
                            ? 'bg-blue-100 text-blue-700'
                            : s.status === 'rejected'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {s.status.toUpperCase()}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base mb-1">
                      {s.application_name}
                    </h3>

                    {s.deadline && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Scadenza: {new Date(s.deadline).toLocaleDateString()}</span>
                      </div>
                    )}

                    {s.review_feedback && s.status === 'rejected' && (
                      <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                        <span className="font-bold block mb-0.5">{t.surveys.architectNotesLabel}</span>
                        {s.review_feedback}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {s.sections.length} {t.surveys.verificationAreasLabel}
                    </span>
                    <button
                      onClick={() => setActiveScopeIdForWizard(s.scope_id)}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm ${
                        s.status === 'approved'
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : isProcessSurvey
                          ? 'bg-teal-600 text-white hover:bg-teal-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {s.status === 'approved' ? t.surveys.viewResponsesBtn : t.surveys.fillSurvey}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Owned Resources with Tabs (Applications vs Business Processes) */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          {/* Sub-tabs */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('apps')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'apps'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{t.surveys.tabOwnedApps}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'apps' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-700'
              }`}>
                {ownedApps.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('processes')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'processes'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Workflow className="w-4 h-4" />
              <span>{t.surveys.tabOwnedProcesses}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'processes' ? 'bg-teal-50 text-teal-700' : 'bg-slate-200 text-slate-700'
              }`}>
                {ownedProcesses.length}
              </span>
            </button>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={t.common.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* TAB 1: APPLICATIONS */}
        {activeTab === 'apps' && (
          <div>
            {ownedApps.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
                <Building className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-700">{t.surveys.noAppsAssignedTitle}</h3>
                <p className="text-sm text-slate-500 mt-1">{t.surveys.noAppsAssigned}</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <th className="p-4">Applicazione</th>
                        <th className="p-4">{t.surveys.completeness}</th>
                        <th className="p-4">Gartner TIME</th>
                        <th className="p-4">Hosting & SLA</th>
                        <th className="p-4">Stato Lifecycle</th>
                        <th className="p-4">Spesa Annua (€)</th>
                        <th className="p-4 text-center">Survey Attive</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredApps.map((app) => (
                        <tr key={app.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{app.name}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
                                {t.surveys.badgeAppOwner}
                              </span>
                            </div>
                            {app.vendor && (
                              <span className="text-slate-400 text-xs block mt-0.5">Vendor: {app.vendor}</span>
                            )}
                          </td>

                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-2 rounded-full ${
                                    app.completeness >= 80
                                      ? 'bg-emerald-500'
                                      : app.completeness >= 50
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${app.completeness}%` }}
                                />
                              </div>
                              <span className="font-semibold text-slate-700">{app.completeness}%</span>
                            </div>
                          </td>

                          <td className="p-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                app.time_quadrant === 'Invest'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : app.time_quadrant === 'Tolerate'
                                  ? 'bg-blue-100 text-blue-800'
                                  : app.time_quadrant === 'Migrate'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {app.time_quadrant}
                            </span>
                          </td>

                          <td className="p-4">
                            <span className="font-medium text-slate-700 block">{app.hosting_type}</span>
                            <span className="text-slate-400 text-xs">{app.sla_level}</span>
                          </td>

                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-xs">
                              {app.lifecycle_status}
                            </span>
                          </td>

                          <td className="p-4 font-bold text-slate-900">
                            {app.annual_cost !== null ? (
                              `€ ${app.annual_cost.toLocaleString('it-IT')}`
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-normal">
                                {t.surveys.financialsRedactedBadge}
                              </span>
                            )}
                          </td>

                          <td className="p-4 text-center">
                            {app.pending_surveys_count > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                {app.pending_surveys_count} {t.surveys.pendingBadgeText}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BUSINESS PROCESSES */}
        {activeTab === 'processes' && (
          <div>
            {ownedProcesses.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
                <Workflow className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-700">{t.surveys.noProcessesAssignedTitle}</h3>
                <p className="text-sm text-slate-500 mt-1">{t.surveys.noProcessesAssigned}</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <th className="p-4">{t.surveys.processName}</th>
                        <th className="p-4">{t.surveys.completeness}</th>
                        <th className="p-4">{t.surveys.processAutomationLevel}</th>
                        <th className="p-4">{t.surveys.processCycleTime}</th>
                        <th className="p-4">{t.surveys.processVolume}</th>
                        <th className="p-4">{t.surveys.processCriticality}</th>
                        <th className="p-4 text-center">Survey Attive</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProcesses.map((proc) => (
                        <tr key={proc.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{proc.name}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-teal-50 text-teal-800 border-teal-200">
                                {t.surveys.badgeProcessOwner}
                              </span>
                            </div>
                            {proc.documentation && (
                              <p className="text-slate-400 text-xs mt-0.5 line-clamp-1 max-w-sm">
                                {proc.documentation}
                              </p>
                            )}
                          </td>

                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-2 rounded-full ${
                                    proc.completeness >= 80
                                      ? 'bg-teal-500'
                                      : proc.completeness >= 50
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${proc.completeness}%` }}
                                />
                              </div>
                              <span className="font-semibold text-slate-700">{proc.completeness}%</span>
                            </div>
                          </td>

                          <td className="p-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {proc.bpmn_automation_level}
                            </span>
                          </td>

                          <td className="p-4">
                            <span className="font-semibold text-slate-800">
                              {proc.bpmn_cycle_time_minutes > 0 ? `${proc.bpmn_cycle_time_minutes} min` : '—'}
                            </span>
                            {proc.bpmn_error_rework_rate_pct > 0 && (
                              <span className="text-[11px] text-rose-600 block">
                                Rework: {proc.bpmn_error_rework_rate_pct}%
                              </span>
                            )}
                          </td>

                          <td className="p-4">
                            <span className="font-medium text-slate-700">
                              {proc.bpmn_execution_volume_month > 0 ? `${proc.bpmn_execution_volume_month.toLocaleString('it-IT')} / mese` : '—'}
                            </span>
                          </td>

                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-md font-medium text-xs ${
                              proc.process_criticality === 'Mission Critical'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold'
                                : proc.process_criticality === 'Business Critical'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {proc.process_criticality}
                            </span>
                          </td>

                          <td className="p-4 text-center">
                            {proc.pending_surveys_count > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                {proc.pending_surveys_count} {t.surveys.pendingBadgeText}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Survey Wizard Modal */}
      {activeScopeIdForWizard && (
        <SurveyWizardModal
          scopeId={activeScopeIdForWizard}
          onClose={() => setActiveScopeIdForWizard(null)}
          onSuccess={() => {
            setActiveScopeIdForWizard(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};
